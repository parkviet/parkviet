# frozen_string_literal: true

module Spree
  module Pos
    module StoreInfos
      # Writes the store's POS details and, when asked, the industry list new
      # branches copy. Existing branches are not touched. Audited as
      # store_info.change; the industry list also keeps store_profile.change.
      module Save
        PERMISSION = 'write_pos_topology'

        module_function

        def call(store:, actor:, attributes:, profile_key: nil, profile_keys: nil, interests: nil, reason: 'store_info')
          raise CanCan::AccessDenied unless AccessPolicy.new(store: store, staff: actor).permission?(PERMISSION)

          ApplicationRecord.transaction do
            store.lock!
            record = StoreInfo.for_store(store) || StoreInfo.new(store: store, business_day_cutoff: '04:00')
            before = record.persisted? ? snapshot(record) : nil
            assign(record, attributes)
            record.changed_by = actor
            record.save!
            after = snapshot(record)
            if before != after
              AuditEntry.record!(store: store, actor: actor, action: 'store_info.change', subject: record,
                                 metadata: { from: before, to: after })
            end
            if profile_key.present? || profile_keys.present? || !interests.nil?
              keys = if profile_key.present? || profile_keys.present?
                       BusinessProfiles.keys_for(profile_key: profile_key, profile_keys: profile_keys)
                     else
                       StoreProfile.for_store(store).first&.resolved_keys
                     end
              Profiles::UpdateStore.call(store: store, actor: actor, profile_keys: keys,
                                         interests: interests, reason: reason)
            end
            present(store, reveal: true)
          end
        end

        def attach_logo!(store:, actor:, io:, filename:, content_type:)
          raise CanCan::AccessDenied unless AccessPolicy.new(store: store, staff: actor).permission?(PERMISSION)

          ApplicationRecord.transaction do
            store.lock!
            record = StoreInfo.for_store(store) ||
                     raise(Conflict.new('Save the store name and phone first.', reason: 'store_info_required'))
            record.logo.attach(io: io, filename: filename, content_type: content_type)
            record.changed_by = actor
            record.save!
            AuditEntry.record!(store: store, actor: actor, action: 'store_info.change', subject: record,
                               metadata: { logo: [false, true] })
            present(store, reveal: true)
          end
        end

        def remove_logo!(store:, actor:)
          raise CanCan::AccessDenied unless AccessPolicy.new(store: store, staff: actor).permission?(PERMISSION)

          ApplicationRecord.transaction do
            record = StoreInfo.for_store(store) || raise(ActiveRecord::RecordNotFound)
            record.logo.purge if record.logo.attached?
            AuditEntry.record!(store: store, actor: actor, action: 'store_info.change', subject: record,
                               metadata: { logo: [true, false] })
            present(store, reveal: true)
          end
        end

        def present(store, reveal:)
          info = StoreInfo.for_store(store)
          profile = StoreProfile.for_store(store).first
          keys = profile&.resolved_keys || []
          number = info&.representative_id_number
          {
            id: info&.prefixed_id,
            name: info&.name,
            phone: info&.phone,
            admin_email: info&.admin_email,
            contact_email: info&.contact_email,
            tax_code: info&.tax_code,
            representative_id_number: reveal ? number : nil,
            representative_id_set: number.present?,
            opening_time: info&.clock(info.opening_time),
            closing_time: info&.clock(info.closing_time),
            business_day_cutoff: info ? info.clock(info.business_day_cutoff) : '04:00',
            province_code: info&.province_code,
            ward_code: info&.ward_code,
            province_name: info&.province_name,
            ward_name: info&.ward_name,
            street: info&.street,
            description: info&.description,
            logo_url: info && StoreInfo.logo_url(info),
            profile_key: keys.first,
            profile_keys: keys,
            interests: Array(profile&.interests),
            filled: info ? info.filled_count(keys) : (keys.any? ? 1 : 0),
            filled_total: StoreInfo::FILLED.size,
            open_shifts: Shift.for_store(store).where(status: 'open').count,
            fallback: {
              name: store.name,
              phone: store.respond_to?(:contact_phone) ? store.contact_phone.to_s.presence : nil,
              contact_email: store.respond_to?(:customer_support_email) ? store.customer_support_email.to_s.presence : nil,
              address: store.respond_to?(:address) ? store.address.to_s.strip.presence : nil,
              logo_url: StoreInfo.logo_url(store)
            }
          }
        end

        def snapshot(record)
          body = record.slice(*StoreInfo::CONTACT)
          body['opening_time'] = record.clock(record.opening_time)
          body['closing_time'] = record.clock(record.closing_time)
          body['business_day_cutoff'] = record.clock(record.business_day_cutoff)
          body['representative_id_number'] = mask(record.representative_id_number)
          body
        end

        def mask(number)
          return if number.blank?

          "********#{number[-4, 4]}"
        end

        def assign(record, attributes)
          hash = attributes.respond_to?(:to_unsafe_h) ? attributes.to_unsafe_h : attributes.to_h
          hash = hash.stringify_keys
          StoreInfo::CONTACT.each do |field|
            next unless hash.key?(field)

            record.public_send("#{field}=", hash[field].presence)
          end
          record.business_day_cutoff ||= '04:00'
        end
      end
    end
  end
end
