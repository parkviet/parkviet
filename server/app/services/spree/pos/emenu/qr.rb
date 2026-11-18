# frozen_string_literal: true

module Spree
  module Pos
    module Emenu
      # A VietQR a guest can scan. It is the same bank QR PayLater prints
      # (account, amount, EMVCo payload), with the transfer note this payment
      # is matched by. Nothing is reserved: the note is what the webhook reads.
      module Qr
        PREFIX = 'EM'
        CODE_PATTERN = /\b#{PREFIX}\s*(\d+)\b/i

        module_function

        def code_for(guest_order)
          "#{PREFIX}#{guest_order.id}"
        end

        def guest_order_id(content)
          content.to_s.match(CODE_PATTERN)&.[](1)&.to_i
        end

        def content_for(guest_order)
          note = code_for(guest_order)
          return note unless defined?(SpreeVietqr)

          SpreeVietqr::TransferContent.with_suffix(note)
        end

        # Open shift that books electronic-menu orders at this branch: the
        # table register's shift first, otherwise any open shift of the branch.
        def open_shift(branch)
          shifts = Shift.for_store(branch.store).open_now
          (branch.table_register_id && shifts.where(register_id: branch.table_register_id).order(opened_at: :desc).first) ||
            shifts.where(branch_id: branch.id).order(opened_at: :desc).first
        end

        # The QR for `amount` (a whole number of VND) carrying `content`, or
        # nil when the branch has no account to pay into.
        def details(branch, amount, content)
          account = PayLater.receiving_account(branch.store, branch)
          amount = BigDecimal(amount.to_s)
          return nil if account.nil? || !amount.positive? || amount.frac.nonzero?

          whole = amount.to_i
          {
            'amount' => amount.to_s('F'), 'currency' => PayLater::CURRENCY, 'transfer_content' => content,
            'bank_bin' => account.bank_bin,
            'bank_name' => account.bank_name.presence || (defined?(SpreeVietqr) && SpreeVietqr::PaymentInfo::BANK_NAMES[account.bank_bin]) || nil,
            'account_number' => account.account_number, 'account_name' => account.account_name,
            'payload' => PayLater.payload(bank_bin: account.bank_bin, account_number: account.account_number, amount: whole, content: content),
            'image_url' => image_url(account, whole, content)
          }
        end

        def image_url(account, amount, content)
          return unless defined?(SpreeVietqr)

          SpreeVietqr::GenerateQr.new.call_for_topup(payment_method: account.payment_method, amount: amount,
                                                    transfer_content: content, receiving_account: account)
        rescue StandardError => e
          Rails.logger.info("[pos] emenu qr image skipped: #{e.class}: #{e.message}")
          nil
        end

        # What the table's open order still has to collect.
        def due(workspace)
          order = workspace.order.reload
          allocated = FundsAllocation.where(workspace_id: workspace.id, status: 'active').sum(:amount)
          prepared = TenderAttempt.where(workspace_id: workspace.id, status: %w[prepared unknown]).sum(:amount)
          order.total - BigDecimal(allocated.to_s) - BigDecimal(prepared.to_s)
        end
      end
    end
  end
end
