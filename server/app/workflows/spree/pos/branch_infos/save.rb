# frozen_string_literal: true

module Spree
  module Pos
    module BranchInfos
      # Writes a branch's overrides. A null field returns to the store value.
      # The industry list stays on the profile preview; this only stores details
      # and the business-day cutoff (null inherits the store clock).
      module Save
        FIELDS = (StoreInfo::CONTACT - ['business_day_cutoff']).freeze

        module_function

        def call(store:, actor:, branch:, attributes:)
          policy = AccessPolicy.new(store: store, staff: actor)
          raise CanCan::AccessDenied unless BranchModules::Set.manage?(policy, branch)

          ApplicationRecord.transaction do
            branch.lock!
            record = BranchInfo.for_branch(branch) || BranchInfo.new(store: store, branch: branch)
            before = record.persisted? ? snapshot(record, branch) : nil
            assign(record, attributes)
            if attributes.key?(:business_day_cutoff) || attributes.key?('business_day_cutoff')
              branch.business_day_cutoff = cutoff_value(attributes)
              branch.save!
            end
            record.changed_by = actor
            record.save!
            after = snapshot(record, branch)
            if before != after
              AuditEntry.record!(store: store, actor: actor, action: 'branch_info.change', subject: record,
                                 metadata: { branch_id: branch.prefixed_id, from: before, to: after })
            end
            present(branch, reveal: policy.permission?('write_pos_topology'))
          end
        end

        def attach_logo!(store:, actor:, branch:, io:, filename:, content_type:)
          policy = AccessPolicy.new(store: store, staff: actor)
          raise CanCan::AccessDenied unless BranchModules::Set.manage?(policy, branch)

          ApplicationRecord.transaction do
            branch.lock!
            record = BranchInfo.for_branch(branch) || BranchInfo.new(store: store, branch: branch)
            record.logo.attach(io: io, filename: filename, content_type: content_type)
            record.changed_by = actor
            record.save!
            AuditEntry.record!(store: store, actor: actor, action: 'branch_info.change', subject: record,
                               metadata: { branch_id: branch.prefixed_id, logo: [false, true] })
            present(branch, reveal: policy.permission?('write_pos_topology'))
          end
        end

        def remove_logo!(store:, actor:, branch:)
          policy = AccessPolicy.new(store: store, staff: actor)
          raise CanCan::AccessDenied unless BranchModules::Set.manage?(policy, branch)

          record = BranchInfo.for_branch(branch) || raise(ActiveRecord::RecordNotFound)
          record.logo.purge if record.logo.attached?
          AuditEntry.record!(store: store, actor: actor, action: 'branch_info.change', subject: record,
                             metadata: { branch_id: branch.prefixed_id, logo: [true, false] })
          present(branch, reveal: policy.permission?('write_pos_topology'))
        end

        def present(branch, reveal:)
          info = BranchInfo.for_branch(branch)
          overrides = FIELDS.index_with do |field|
            next if info.nil?

            %w[opening_time closing_time].include?(field) ? info.clock(info.public_send(field)) : info.public_send(field)
          end
          {
            id: info&.prefixed_id,
            overrides: overrides,
            business_day_cutoff: branch.business_day_cutoff.present? ? branch.cutoff_clock : nil,
            effective: StoreInfo.effective(branch, reveal_identity: reveal),
            profile_key: branch.profile_key,
            profile_keys: branch.resolved_keys,
            logo_url: info && StoreInfo.logo_url(info),
            open_shifts: Shift.where(branch_id: branch.id, status: 'open').count
          }
        end

        def snapshot(record, branch)
          body = record.slice(*FIELDS)
          body['opening_time'] = record.clock(record.opening_time)
          body['closing_time'] = record.clock(record.closing_time)
          body['business_day_cutoff'] = branch.business_day_cutoff.present? ? branch.cutoff_clock : nil
          body['representative_id_number'] = StoreInfos::Save.mask(record.representative_id_number)
          body
        end

        def assign(record, attributes)
          hash = attributes.respond_to?(:to_unsafe_h) ? attributes.to_unsafe_h : attributes.to_h
          hash = hash.stringify_keys
          FIELDS.each do |field|
            next unless hash.key?(field)

            record.public_send("#{field}=", hash[field].presence)
          end
        end

        def cutoff_value(attributes)
          hash = attributes.respond_to?(:to_unsafe_h) ? attributes.to_unsafe_h : attributes.to_h
          hash.stringify_keys['business_day_cutoff'].presence
        end
      end
    end
  end
end
