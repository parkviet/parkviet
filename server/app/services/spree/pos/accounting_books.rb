# frozen_string_literal: true

module Spree
  module Pos
    # Computes the 6 statutory household business accounting books under
    # Circular 152/2025/TT-BTC (S1a-HKD through S2e-HKD) and tax declaration
    # figures directly from live POS orders, tax snapshots, fund vouchers,
    # stock documents, fund accounts, and payrolls.
    class AccountingBooks
      BOOKS = [
        { code: 's1a', number: 'S1a-HKD', group: 'revenue' },
        { code: 's2a', number: 'S2a-HKD', group: 'revenue' },
        { code: 's2b', number: 'S2b-HKD', group: 'revenue' },
        { code: 's2c', number: 'S2c-HKD', group: 'revenue_expense' },
        { code: 's2d', number: 'S2d-HKD', group: 'inventory' },
        { code: 's2e', number: 'S2e-HKD', group: 'cash' }
      ].freeze

      S2C_GROUPS = [
        { key: 'a', categories: %w[purchase_goods] },
        { key: 'b', categories: %w[labor_cost social_insurance health_insurance unemployment_insurance] },
        { key: 'c', categories: %w[depreciation] },
        { key: 'd', categories: %w[electricity water telecom rent shipping asset_rent maintenance] },
        { key: 'dd', categories: %w[interest_expense] },
        { key: 'e', categories: %w[management other_expense] }
      ].freeze

      def initialize(store:, from_date:, to_date:, branch_id: nil, options: {})
        @store = store
        @from_date = from_date.to_date
        @to_date = to_date.to_date
        @branch_id = branch_id
        @options = (options || {}).transform_keys(&:to_s)
      end

      def self.taxpayer_snapshot(store)
        presented = Spree::Pos::TaxProfiles::Save.present(store)
        regime = TaxRegime.current(store)

        {
          store_name: presented[:name].presence || store.name,
          tax_code: presented[:tax_code].presence,
          legacy_tax_code: presented[:legacy_tax_code].presence,
          declaration_period: presented[:declaration_period].presence || 'quarter',
          tax_authority_code: presented[:tax_authority_code].presence,
          industry_code: presented[:industry_code].presence,
          signer_name: presented[:signer_name].presence,
          preparer_name: presented[:preparer_name].presence,
          storekeeper_name: presented[:storekeeper_name].presence,
          cashier_name: presented[:cashier_name].presence,
          readiness: presented[:readiness],
          regime: regime ? {
            enabled: regime.enabled,
            method: regime.tax_method,
            revenue_group: regime.revenue_group,
            pit_method: regime.pit_method,
            pit_income_rate: regime.pit_income_rate&.to_s('F')
          } : nil
        }
      end

      def compute_book(book_code)
        code = book_code.to_s.downcase
        meta = BOOKS.find { |b| b[:code] == code }
        raise ArgumentError, "Unknown book: #{book_code}" unless meta

        payload = case code
                  when 's1a', 's2a', 's2b' then compute_revenue_book(code)
                  when 's2c' then compute_s2c
                  when 's2d' then compute_s2d
                  when 's2e' then compute_s2e
                  end

        payload.merge(
          book: meta,
          from_date: @from_date.iso8601,
          to_date: @to_date.iso8601,
          currency: @store.default_currency || 'VND',
          options: normalized_options,
          taxpayer: self.class.taxpayer_snapshot(@store)
        )
      end

      def compute_declaration(declaration_type)
        case declaration_type.to_s
        when '01_cnkd' then compute_cnkd_declaration
        when '01_gtgt', '04_gtgt' then compute_vat_declaration(declaration_type.to_s)
        when '05_kk_tncn' then compute_pit_declaration
        else raise ArgumentError, "Unknown declaration type: #{declaration_type}"
        end
      end

      private

      def normalized_options
        {
          'revenue_source' => @options['revenue_source'].presence || 'all_orders',
          'date_field' => @options['date_field'].presence || 'completed_at',
          'rate_source' => @options['rate_source'].presence || 'order_time',
          'include_cancelled' => ActiveModel::Type::Boolean.new.cast(@options['include_cancelled']) || false,
          'has_excise' => ActiveModel::Type::Boolean.new.cast(@options['has_excise']) || false,
          'has_resource_env' => ActiveModel::Type::Boolean.new.cast(@options['has_resource_env']) || false
        }
      end

      def time_range
        zone = ActiveSupport::TimeZone['Asia/Ho_Chi_Minh'] || Time.zone
        start_at = zone.local(@from_date.year, @from_date.month, @from_date.day).beginning_of_day
        end_at = zone.local(@to_date.year, @to_date.month, @to_date.day).end_of_day
        start_at..end_at
      end

      def scoped_orders
        opts = normalized_options
        statuses = opts['include_cancelled'] ? %w[placed completed canceled] : %w[placed completed]
        date_col = opts['date_field'] == 'created_at' ? :created_at : :completed_at

        scope = Spree::Order.where(store_id: @store.id, status: statuses).where(date_col => time_range)
        if @branch_id.present?
          branch = Branch.for_store(@store).find_by_prefix_id(@branch_id) || Branch.for_store(@store).find_by(id: @branch_id)
          if branch
            order_ids = Workspace.where(store_id: @store.id, branch_id: branch.id).where.not(order_id: nil).select(:order_id)
            scope = scope.where(id: order_ids)
          else
            return scope.none
          end
        end

        if opts['revenue_source'] == 'einvoice_only'
          einv_order_ids = Einvoice.where(store_id: @store.id, status: 'issued').select(:order_id)
          scope = scope.where(id: einv_order_ids)
        end

        scope.order(date_col => :asc, id: :asc)
      end

      def default_rates
        regime = TaxRegime.current(@store)
        if regime
          option = VnTaxCatalog.option(regime.item_option)
          if option
            vat = option[:vat_rate] ? BigDecimal(option[:vat_rate].to_s) : BigDecimal('0')
            pit = option[:pit_rate] ? BigDecimal(option[:pit_rate].to_s) : BigDecimal('0')
            return [vat, pit, option[:code]]
          end
        end
        [BigDecimal('0.01'), BigDecimal('0.005'), 'direct.retail']
      end

      def revenue_rows_and_totals
        opts = normalized_options
        orders = scoped_orders.to_a
        order_ids = orders.map(&:id)
        snapshots_by_order = LineTaxSnapshot.for_store(@store).where(order_id: order_ids).group_by(&:order_id)
        einvoice_order_ids = Einvoice.where(store_id: @store.id, order_id: order_ids, status: 'issued').pluck(:order_id).to_set
        fallback_vat, fallback_pit, fallback_key = default_rates

        total_rev = BigDecimal('0')
        total_vat = BigDecimal('0')
        total_pit = BigDecimal('0')
        by_rate = Hash.new { |h, k| h[k] = { rate_key: k, revenue: BigDecimal('0'), vat: BigDecimal('0'), pit: BigDecimal('0'), orders: 0 } }

        rows = orders.each_with_index.map do |order, idx|
          snaps = snapshots_by_order[order.id]
          if snaps.present? && opts['rate_source'] != 'current_config'
            rev = snaps.sum(BigDecimal('0'), &:revenue_amount)
            vat = snaps.sum(BigDecimal('0'), &:vat_amount)
            pit = snaps.sum(BigDecimal('0'), &:pit_amount)
            rate_key = snaps.first.rate_key
          else
            rev = BigDecimal(order.total.to_s)
            vat = (rev * fallback_vat).round(0)
            pit = (rev * fallback_pit).round(0)
            rate_key = fallback_key
          end

          total_rev += rev
          total_vat += vat
          total_pit += pit

          bucket = by_rate[rate_key]
          bucket[:revenue] += rev
          bucket[:vat] += vat
          bucket[:pit] += pit
          bucket[:orders] += 1

          doc_time = opts['date_field'] == 'created_at' ? order.created_at : (order.completed_at || order.created_at)
          {
            stt: idx + 1,
            order_id: order.prefixed_id,
            document_number: order.number,
            document_date: doc_time&.to_date&.iso8601,
            description: "Bán hàng theo đơn #{order.number}",
            rate_key: rate_key,
            revenue: rev.round(0).to_d.to_s('F'),
            vat_amount: vat.round(0).to_d.to_s('F'),
            pit_amount: pit.round(0).to_d.to_s('F'),
            has_einvoice: einvoice_order_ids.include?(order.id)
          }
        end

        {
          rows: rows,
          total_revenue: total_rev.round(0),
          total_vat: total_vat.round(0),
          total_pit: total_pit.round(0),
          order_count: orders.size,
          by_rate: by_rate.values.map do |b|
            {
              rate_key: b[:rate_key],
              order_count: b[:orders],
              revenue: b[:revenue].round(0).to_d.to_s('F'),
              vat_amount: b[:vat].round(0).to_d.to_s('F'),
              pit_amount: b[:pit].round(0).to_d.to_s('F')
            }
          end
        }
      end

      def compute_revenue_book(code)
        data = revenue_rows_and_totals
        summary = case code
                  when 's1a'
                    {
                      total_revenue: data[:total_revenue].to_d.to_s('F'),
                      order_count: data[:order_count]
                    }
                  when 's2a'
                    {
                      total_revenue: data[:total_revenue].to_d.to_s('F'),
                      total_vat: data[:total_vat].to_d.to_s('F'),
                      total_pit: data[:total_pit].to_d.to_s('F'),
                      order_count: data[:order_count]
                    }
                  when 's2b'
                    {
                      total_revenue: data[:total_revenue].to_d.to_s('F'),
                      total_vat: data[:total_vat].to_d.to_s('F'),
                      order_count: data[:order_count]
                    }
                  end

        { summary: summary, rows: data[:rows], by_rate: data[:by_rate] }
      end

      def compute_s2c
        rev_data = revenue_rows_and_totals
        voucher_scope = FundVoucher.for_store(@store).completed.where(occurred_at: time_range)
        if @branch_id.present?
          branch = Branch.for_store(@store).find_by_prefix_id(@branch_id) || Branch.for_store(@store).find_by(id: @branch_id)
          voucher_scope = branch ? voucher_scope.where(branch_id: branch.id) : voucher_scope.none
        end

        other_sales = voucher_scope.where(kind: 'income', category_code: 'sales_other').sum(:amount).to_d
        total_revenue = (rev_data[:total_revenue] + other_sales).round(0)

        expense_vouchers = voucher_scope.where(kind: 'expense').order(:occurred_at, :id).to_a
        deductible_vouchers = expense_vouchers.select(&:tax_deductible)
        excluded_vouchers = expense_vouchers.reject(&:tax_deductible)

        expense_sections = S2C_GROUPS.map do |grp|
          items = deductible_vouchers.select { |v| grp[:categories].include?(v.category_code) }
          subtotal = items.sum(BigDecimal('0'), &:amount).round(0)
          {
            key: grp[:key],
            amount: subtotal.to_d.to_s('F'),
            count: items.size,
            items: items.map do |v|
              {
                id: v.prefixed_id,
                code: v.code,
                date: v.occurred_at&.to_date&.iso8601,
                category_code: v.category_code,
                description: v.note.presence || v.category_label.presence || v.counterparty_name.presence || v.code,
                amount: v.amount.round(0).to_d.to_s('F')
              }
            end
          }
        end

        total_deductible = expense_sections.sum(BigDecimal('0')) { |s| BigDecimal(s[:amount]) }.round(0)
        total_excluded = excluded_vouchers.sum(BigDecimal('0'), &:amount).round(0)
        net_income = (total_revenue - total_deductible).round(0)

        regime = TaxRegime.current(@store)
        pit_rate = regime&.pit_income_rate ? BigDecimal(regime.pit_income_rate.to_s) : BigDecimal('0.15')
        pit_payable = net_income.positive? ? (net_income * pit_rate).round(0) : BigDecimal('0')

        {
          summary: {
            total_revenue: total_revenue.to_d.to_s('F'),
            order_revenue: rev_data[:total_revenue].to_d.to_s('F'),
            other_sales_revenue: other_sales.round(0).to_d.to_s('F'),
            total_deductible_expense: total_deductible.to_d.to_s('F'),
            total_excluded_expense: total_excluded.to_d.to_s('F'),
            net_income: net_income.to_d.to_s('F'),
            pit_income_rate: pit_rate.to_s('F'),
            pit_payable: pit_payable.to_d.to_s('F')
          },
          expense_sections: expense_sections,
          revenue_rows: rev_data[:rows]
        }
      end

      def compute_s2d
        doc_scope = StockDocument.for_store(@store).where(status: 'completed')
        if @branch_id.present?
          branch = Branch.for_store(@store).find_by_prefix_id(@branch_id) || Branch.for_store(@store).find_by(id: @branch_id)
          doc_scope = branch ? doc_scope.where(branch_id: branch.id) : doc_scope.none
        end

        period_docs = doc_scope.where(occurred_at: time_range).includes(lines: { variant: :product }).order(:occurred_at, :id).to_a
        prior_docs = doc_scope.where('occurred_at < ?', time_range.begin).includes(lines: { variant: :product }).to_a

        by_variant = {}
        ensure_variant = lambda do |line|
          vid = line.variant_id
          by_variant[vid] ||= {
            variant_id: line.variant&.prefixed_id || vid.to_s,
            sku: line.variant&.sku.presence || "SKU-#{vid}",
            name: line.variant&.product&.name.presence || line.variant&.sku || "Hàng hóa ##{vid}",
            unit_cost: (line.unit_cost.to_d.positive? ? line.unit_cost.to_d : (line.variant&.cost_price.to_d)),
            opening_qty: BigDecimal('0'),
            opening_value: BigDecimal('0'),
            in_qty: BigDecimal('0'),
            in_value: BigDecimal('0'),
            out_qty: BigDecimal('0'),
            out_value: BigDecimal('0'),
            movements: []
          }
        end

        prior_docs.each do |doc|
          doc.lines.each do |line|
            entry = ensure_variant.call(line)
            qty = line.quantity.to_d
            val = line.line_total.to_d
            case doc.kind
            when 'opening', 'import'
              entry[:opening_qty] += qty
              entry[:opening_value] += val
            when 'export'
              entry[:opening_qty] -= qty
              entry[:opening_value] -= val
            when 'count'
              entry[:opening_qty] += qty
              entry[:opening_value] += (qty >= 0 ? val : -val)
            end
          end
        end

        period_docs.each do |doc|
          doc.lines.each do |line|
            entry = ensure_variant.call(line)
            qty = line.quantity.to_d
            val = line.line_total.to_d
            is_in = %w[opening import].include?(doc.kind) || (doc.kind == 'count' && qty >= 0)
            abs_qty = qty.abs
            if is_in
              entry[:in_qty] += abs_qty
              entry[:in_value] += val
            else
              entry[:out_qty] += abs_qty
              entry[:out_value] += val
            end
            entry[:movements] << {
              document_code: doc.code,
              document_date: doc.occurred_at&.to_date&.iso8601,
              kind: doc.kind,
              description: doc.note.presence || "#{doc.kind.upcase} #{doc.code}",
              unit_cost: line.unit_cost.round(0).to_d.to_s('F'),
              in_qty: is_in ? abs_qty.to_f : 0,
              in_value: is_in ? val.round(0).to_d.to_s('F') : '0',
              out_qty: is_in ? 0 : abs_qty.to_f,
              out_value: is_in ? '0' : val.round(0).to_d.to_s('F')
            }
          end
        end

        total_in = BigDecimal('0')
        total_out = BigDecimal('0')
        total_closing = BigDecimal('0')

        items = by_variant.values.sort_by { |e| e[:sku].to_s }.map do |e|
          closing_qty = e[:opening_qty] + e[:in_qty] - e[:out_qty]
          closing_val = [e[:opening_value] + e[:in_value] - e[:out_value], BigDecimal('0')].max
          total_in += e[:in_value]
          total_out += e[:out_value]
          total_closing += closing_val
          {
            variant_id: e[:variant_id],
            sku: e[:sku],
            name: e[:name],
            unit_cost: e[:unit_cost].round(0).to_d.to_s('F'),
            opening_qty: e[:opening_qty].to_f,
            opening_value: e[:opening_value].round(0).to_d.to_s('F'),
            in_qty: e[:in_qty].to_f,
            in_value: e[:in_value].round(0).to_d.to_s('F'),
            out_qty: e[:out_qty].to_f,
            out_value: e[:out_value].round(0).to_d.to_s('F'),
            closing_qty: closing_qty.to_f,
            closing_value: closing_val.round(0).to_d.to_s('F'),
            movements: e[:movements]
          }
        end

        {
          summary: {
            total_in_value: total_in.round(0).to_d.to_s('F'),
            total_out_value: total_out.round(0).to_d.to_s('F'),
            closing_stock_value: total_closing.round(0).to_d.to_s('F'),
            sku_count: items.size
          },
          items: items
        }
      end

      def compute_s2e
        account_scope = FundAccount.where(store_id: @store.id).order(:kind, :name)
        voucher_scope = FundVoucher.for_store(@store).completed
        if @branch_id.present?
          branch = Branch.for_store(@store).find_by_prefix_id(@branch_id) || Branch.for_store(@store).find_by(id: @branch_id)
          if branch
            account_scope = account_scope.where(branch_id: branch.id)
            voucher_scope = voucher_scope.where(branch_id: branch.id)
          else
            account_scope = account_scope.none
            voucher_scope = voucher_scope.none
          end
        end

        accounts = account_scope.to_a
        period_vouchers = voucher_scope.where(occurred_at: time_range).order(:occurred_at, :id).to_a
        prior_vouchers = voucher_scope.where('occurred_at < ?', time_range.begin).to_a

        total_in = BigDecimal('0')
        total_out = BigDecimal('0')
        total_closing = BigDecimal('0')

        account_books = accounts.map do |acc|
          opening = BigDecimal(acc.opening_balance.to_s)
          prior_vouchers.each do |v|
            if v.fund_account_id == acc.id
              opening += v.kind == 'income' ? v.amount.to_d : -v.amount.to_d
            elsif v.kind == 'transfer' && v.target_fund_account_id == acc.id
              opening += v.amount.to_d
            end
          end

          acc_in = BigDecimal('0')
          acc_out = BigDecimal('0')
          running = opening
          rows = []

          period_vouchers.each do |v|
            in_amt = BigDecimal('0')
            out_amt = BigDecimal('0')
            if v.fund_account_id == acc.id
              if v.kind == 'income'
                in_amt = v.amount.to_d
              else
                out_amt = v.amount.to_d
              end
            elsif v.kind == 'transfer' && v.target_fund_account_id == acc.id
              in_amt = v.amount.to_d
            else
              next
            end

            acc_in += in_amt
            acc_out += out_amt
            running += in_amt - out_amt
            rows << {
              id: v.prefixed_id,
              code: v.code,
              date: v.occurred_at&.to_date&.iso8601,
              kind: v.kind,
              description: v.note.presence || v.category_label.presence || v.counterparty_name.presence || v.code,
              in_amount: in_amt.round(0).to_d.to_s('F'),
              out_amount: out_amt.round(0).to_d.to_s('F'),
              balance: running.round(0).to_d.to_s('F')
            }
          end

          total_in += acc_in
          total_out += acc_out
          total_closing += running

          {
            account_id: acc.prefixed_id,
            name: acc.name,
            kind: acc.kind,
            account_number: acc.account_number.presence,
            opening_balance: opening.round(0).to_d.to_s('F'),
            total_in: acc_in.round(0).to_d.to_s('F'),
            total_out: acc_out.round(0).to_d.to_s('F'),
            closing_balance: running.round(0).to_d.to_s('F'),
            rows: rows
          }
        end

        {
          summary: {
            total_in: total_in.round(0).to_d.to_s('F'),
            total_out: total_out.round(0).to_d.to_s('F'),
            closing_balance: total_closing.round(0).to_d.to_s('F'),
            account_count: account_books.size
          },
          accounts: account_books
        }
      end

      def compute_cnkd_declaration
        data = revenue_rows_and_totals
        total_tax_due = (data[:total_vat] + data[:total_pit]).round(0)
        {
          revenue_total: data[:total_revenue].to_d.to_s('F'),
          vat_total: data[:total_vat].to_d.to_s('F'),
          pit_total: data[:total_pit].to_d.to_s('F'),
          total_tax_due: total_tax_due.to_d.to_s('F'),
          order_count: data[:order_count],
          by_rate: data[:by_rate]
        }
      end

      def compute_vat_declaration(type)
        data = revenue_rows_and_totals
        output_vat = data[:total_vat]
        input_vat = BigDecimal('0')
        purchase_count = 0

        if type == '01_gtgt'
          imports = StockDocument.for_store(@store)
                                 .where(kind: 'import', status: 'completed', invoice_type: 'vat_invoice', occurred_at: time_range)
          purchase_count = imports.count
          input_vat = imports.sum(:tax_amount).to_d.round(0)
        end

        net_vat = [output_vat - input_vat, BigDecimal('0')].max.round(0)
        {
          revenue_total: data[:total_revenue].to_d.to_s('F'),
          output_vat: output_vat.to_d.to_s('F'),
          input_vat: input_vat.to_d.to_s('F'),
          purchase_invoice_count: purchase_count,
          total_tax_due: net_vat.to_d.to_s('F'),
          order_count: data[:order_count],
          by_rate: data[:by_rate]
        }
      end

      def compute_pit_declaration
        payrolls = Payroll.for_store(@store)
                          .where('period_start <= ? AND period_end >= ?', @to_date, @from_date)
                          .includes(:lines)
                          .to_a
        lines = payrolls.flat_map(&:lines)
        employee_ids = lines.map(&:staff_id).uniq
        gross_total = lines.sum(BigDecimal('0'), &:gross_amount).round(0)
        deductions_total = lines.sum(BigDecimal('0'), &:total_deductions).round(0)
        net_total = lines.sum(BigDecimal('0'), &:net_amount).round(0)
        # Statutory personal deduction (11,000,000 VND/month/person) estimate for 05/KK-TNCN
        months = [((@to_date.year * 12 + @to_date.month) - (@from_date.year * 12 + @from_date.month) + 1), 1].max
        personal_deduction = BigDecimal('11000000') * months
        by_employee = lines.group_by(&:staff_id).map do |staff_id, emp_lines|
          emp_gross = emp_lines.sum(BigDecimal('0'), &:gross_amount).round(0)
          taxable = [emp_gross - personal_deduction, BigDecimal('0')].max
          pit = (taxable * BigDecimal('0.05')).round(0)
          {
            staff_id: emp_lines.first.staff&.prefixed_id || staff_id.to_s,
            staff_name: StaffName.call(emp_lines.first.staff),
            gross_income: emp_gross.to_d.to_s('F'),
            taxable_income: taxable.to_d.to_s('F'),
            pit_withheld: pit.to_d.to_s('F')
          }
        end
        total_pit = by_employee.sum(BigDecimal('0')) { |r| BigDecimal(r[:pit_withheld]) }.round(0)

        {
          payroll_count: payrolls.size,
          employee_count: employee_ids.size,
          gross_income_total: gross_total.to_d.to_s('F'),
          deductions_total: deductions_total.to_d.to_s('F'),
          net_pay_total: net_total.to_d.to_s('F'),
          total_tax_due: total_pit.to_d.to_s('F'),
          employees: by_employee
        }
      end
    end
  end
end
