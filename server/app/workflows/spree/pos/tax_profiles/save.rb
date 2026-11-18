# frozen_string_literal: true

module Spree
  module Pos
    module TaxProfiles
      # Writes the store's tax declaration details in one transaction: the
      # shared taxpayer fields on StoreInfo, the TaxProfile row and each
      # branch's location code and head office mark. Only keys sent change.
      # Audited as tax_profile.change.
      module Save
        PERMISSION = 'write_pos_topology'
        # Read and written through StoreInfo, never copied.
        SHARED = %w[name tax_code province_code ward_code street description].freeze
        LOCATION_FIELDS = %w[tax_location_code tax_head_office].freeze

        module_function

        def call(store:, actor:, attributes:, locations: nil)
          raise CanCan::AccessDenied unless AccessPolicy.new(store: store, staff: actor).permission?(PERMISSION)

          hash = plain(attributes)
          ApplicationRecord.transaction do
            store.lock!
            info = StoreInfo.for_store(store)
            raise Conflict.new('Save the store information first.', reason: 'store_info_required') if info.nil?

            profile = TaxProfile.for_store(store) || TaxProfile.new(store: store)
            rows = location_rows(store)
            before = snapshot(info, profile, rows)

            StoreInfos::Save.assign(info, hash.slice(*SHARED))
            assign_profile(profile, hash)
            changed = assign_locations(store, rows, locations)
            validate!(info, profile, changed)

            persist!(info, actor)
            persist!(profile, actor)
            save_locations!(changed, actor)

            rows = location_rows(store)
            after = snapshot(info, profile, rows)
            if before != after
              AuditEntry.record!(store: store, actor: actor, action: 'tax_profile.change', subject: profile,
                                 metadata: { from: before, to: after })
            end
            present(store)
          end
        end

        def present(store)
          info = StoreInfo.for_store(store)
          profile = TaxProfile.for_store(store) || TaxProfile.new(store: store)
          rows = location_rows(store)
          head_office = rows.values.find(&:tax_head_office)
          {
            id: profile.persisted? ? profile.prefixed_id : nil,
            store_info_saved: info.present?,
            name: info&.name,
            tax_code: info&.tax_code,
            province_code: info&.province_code,
            ward_code: info&.ward_code,
            province_name: info&.province_name,
            ward_name: info&.ward_name,
            street: info&.street,
            description: info&.description,
            **profile_fields(profile),
            locations: locations_payload(store, rows),
            readiness: profile.readiness(info: info, head_office: head_office),
            updated_at: profile.updated_at&.iso8601
          }
        end

        def profile_fields(profile)
          fields = TaxProfile::TEXT_FIELDS.index_with { |field| profile.public_send(field) }
          fields['business_area_m2'] = profile.business_area_m2&.to_s('F')&.delete_suffix('.0')
          fields.symbolize_keys
        end

        def locations_payload(store, rows)
          Branch.for_store(store).order(:name, :id).map do |branch|
            row = rows[branch.id]
            {
              branch_id: branch.prefixed_id,
              name: branch.name,
              code: branch.code,
              status: branch.status,
              address: StoreInfo.effective(branch)[:address][:value],
              tax_location_code: row&.tax_location_code,
              tax_head_office: row&.tax_head_office == true
            }
          end
        end

        # Branch id => BranchInfo for every branch of the store that has one.
        def location_rows(store)
          BranchInfo.where(store_id: store.id).index_by(&:branch_id)
        end

        def assign_profile(profile, hash)
          TaxProfile::FIELDS.each do |field|
            next unless hash.key?(field)

            value = hash[field]
            profile.public_send("#{field}=", value.is_a?(String) ? value.strip.presence : value)
          end
        end

        # Applies the sent rows to the store's BranchInfo rows, creating one
        # for a branch that has none. Marking a head office clears the
        # previous one. Returns the rows to save, the cleared ones first so
        # the partial unique index never sees two head offices.
        def assign_locations(store, rows, locations)
          return [] if locations.nil?

          entries = location_entries(locations)
          branches = Branch.for_store(store).index_by(&:prefixed_id)
          ids = entries.map { |entry| entry['branch_id'] }
          raise ActiveRecord::RecordNotFound if ids.any? { |id| !branches.key?(id) } || ids.uniq.size != ids.size

          touched = entries.map do |entry|
            branch = branches.fetch(entry['branch_id'])
            row = rows[branch.id] || BranchInfo.new(store: store, branch: branch)
            row.tax_location_code = entry['tax_location_code'] if entry.key?('tax_location_code')
            row.tax_head_office = truthy?(entry['tax_head_office']) if entry.key?('tax_head_office')
            row
          end
          marked = entries.index { |entry| truthy?(entry['tax_head_office']) }
          head = marked && touched[marked]
          cleared = head ? clear_head_offices(rows, except: head) - touched : []
          (cleared + touched).sort_by { |row| row.tax_head_office ? 1 : 0 }
        end

        def location_entries(locations)
          raise invalid_locations unless locations.is_a?(Array)

          entries = locations.map { |entry| plain(entry) }
          raise invalid_locations unless entries.all? { |entry| entry['branch_id'].is_a?(String) }

          heads = entries.count { |entry| truthy?(entry['tax_head_office']) }
          raise Conflict.new('Mark one head office.', reason: 'tax_head_office_invalid') if heads > 1

          entries
        end

        # Unmarks every other head office; returns the rows it changed.
        def clear_head_offices(rows, except:)
          rows.values.select { |row| row.tax_head_office && !row.equal?(except) }.each do |row|
            row.tax_head_office = false
          end
        end

        # Collects every field error on the profile so one 422 lists them all
        # with the keys the form uses.
        def validate!(info, profile, rows)
          info.valid?
          profile.valid?
          info.errors.each { |error| profile.errors.import(error) if SHARED.include?(error.attribute.to_s) }
          rows.each do |row|
            row.valid?
            row.errors.each do |error|
              # The previous head office is cleared in this transaction, under
              # the store lock; the row check only sees the database.
              next if error.attribute == :tax_head_office

              profile.errors.add(:locations, "#{row.branch.name}: #{error.message}")
            end
          end
          other = info.errors.reject { |error| SHARED.include?(error.attribute.to_s) }
          other.each { |error| profile.errors.add(:base, error.full_message) }
          raise ActiveRecord::RecordInvalid, profile if profile.errors.any?
        end

        def persist!(record, actor)
          return unless record.new_record? || record.changed?

          record.changed_by = actor
          record.save!(validate: false)
        end

        def save_locations!(rows, actor)
          rows.each do |row|
            next unless row.new_record? || row.changed?

            row.changed_by = actor
            row.save!(validate: false)
          end
        end

        def snapshot(info, profile, rows)
          body = info.slice(*SHARED)
          body.merge!(profile_fields(profile).stringify_keys)
          body['locations'] = rows.values.sort_by(&:branch_id).filter_map do |row|
            next if row.tax_location_code.nil? && !row.tax_head_office

            { 'branch_id' => Branch.prefixed_for(row.branch_id), 'tax_location_code' => row.tax_location_code,
              'tax_head_office' => row.tax_head_office }
          end
          body
        end

        def plain(value)
          hash = value.respond_to?(:to_unsafe_h) ? value.to_unsafe_h : value
          raise invalid_locations unless hash.is_a?(Hash)

          hash.to_h.stringify_keys
        end

        def truthy?(value)
          ActiveModel::Type::Boolean.new.cast(value) == true
        end

        def invalid_locations
          Conflict.new('Each location needs a branch.', reason: 'parameter_invalid')
        end
      end
    end
  end
end
