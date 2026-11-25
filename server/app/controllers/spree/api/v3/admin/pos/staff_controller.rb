# frozen_string_literal: true

module Spree
  module Api
    module V3
      module Admin
        module Pos
          # Store-level staff directory. Staff can be created here without a
          # branch assignment first, then assigned to one or more branches
          # either from this screen or from each branch's staff tab.
          class StaffController < BaseController
            scoped_resource :pos_topology
            pos_permissions index: %w[read_pos_topology write_pos_topology],
                            show: %w[read_pos_topology write_pos_topology]

            POS_STAFF_ROLE_NAME = 'pos_staff'
            POS_STAFF_PERMISSIONS = %w[read_pos_orders write_pos_orders].freeze

            def index
              return if channel_rejected?

              base = store_staff_scope
              assigned_ids = Spree::Pos::StaffMembership.for_store(current_store).people.distinct.pluck(:staff_id)
              total = base.count
              active_count = base.where(deactivated_at: nil).count
              assigned_count = assigned_ids.any? ? base.where(id: assigned_ids).count : 0

              scope = base
              term = params[:q].to_s.strip
              if term.present?
                pattern = "%#{ActiveRecord::Base.sanitize_sql_like(term)}%"
                scope = scope.where(
                  'email ILIKE :q OR first_name ILIKE :q OR last_name ILIKE :q',
                  q: pattern
                )
              end

              case params[:status].to_s
              when 'active'
                scope = scope.where(deactivated_at: nil)
              when 'disabled'
                scope = scope.where.not(deactivated_at: nil)
              end

              if params[:branch_id].present?
                if params[:branch_id].to_s == 'unassigned'
                  scope = assigned_ids.any? ? scope.where.not(id: assigned_ids) : scope
                else
                  branch = branch!(params[:branch_id])
                  branch_staff_ids = Spree::Pos::StaffMembership.for_store(current_store).people
                    .where(branch_id: branch.id).select(:staff_id)
                  scope = scope.where(id: branch_staff_ids)
                end
              end

              records, meta = page_scope(scope.order(:first_name, :last_name, :email, :id))
              memberships_by_staff = load_memberships_by_staff(records.map(&:id))

              render json: {
                data: records.map { |user| serialize_staff(user, memberships_by_staff[user.id] || []) },
                meta: meta.merge(
                  summary: {
                    total: total,
                    active: active_count,
                    disabled: total - active_count,
                    assigned: assigned_count,
                    unassigned: total - assigned_count
                  }
                )
              }
            end

            def show
              return if channel_rejected?

              user = staff!(params[:id])
              memberships = load_memberships_by_staff([user.id])[user.id] || []
              render json: { data: serialize_staff(user, memberships) }
            end

            def create
              return if channel_rejected?

              email = params[:email].to_s.strip.downcase
              password = params[:password].to_s
              raise Spree::Pos::Conflict, 'Password must be at least 6 characters.' if password.length < 6

              user = nil
              created_memberships = []

              ApplicationRecord.transaction do
                user = Spree.admin_user_class.create!(
                  email: email,
                  first_name: params[:first_name].to_s.strip.presence,
                  last_name: params[:last_name].to_s.strip.presence,
                  password: password,
                  password_confirmation: password
                )
                Spree::RoleUser.create!(role: pos_staff_role!, user: user)

                Array(params[:memberships]).each do |entry|
                  next unless entry.respond_to?(:[]) && entry[:branch_id].present?

                  created_memberships << Spree::Pos::StaffMembership.create!(
                    store: current_store,
                    branch: branch!(entry[:branch_id]),
                    staff: user,
                    staff_role: entry[:staff_role_id].present? ? staff_role!(entry[:staff_role_id]) : nil,
                    capabilities: Array(entry[:capabilities]),
                    status: 'active'
                  )
                end
              end

              audit!('staff.create', user, { email: user.email, branch_ids: created_memberships.map { |m| m.branch.prefixed_id } })
              render json: { data: serialize_staff(user, created_memberships) }, status: :created
            rescue ActiveRecord::RecordNotUnique
              raise Spree::Pos::Conflict, 'An account with this email already exists.'
            end

            def update
              return if channel_rejected?

              user = staff!(params[:id])
              attrs = {}
              attrs[:first_name] = params[:first_name].to_s.strip.presence if params.key?(:first_name)
              attrs[:last_name] = params[:last_name].to_s.strip.presence if params.key?(:last_name)
              attrs[:email] = params[:email].to_s.strip.downcase if params.key?(:email)
              if params[:password].present?
                password = params[:password].to_s
                raise Spree::Pos::Conflict, 'Password must be at least 6 characters.' if password.length < 6

                attrs[:password] = password
                attrs[:password_confirmation] = password
              end

              user.update!(attrs) if attrs.any?
              audit!('staff.update', user, attrs.except(:password, :password_confirmation))
              memberships = load_memberships_by_staff([user.id])[user.id] || []
              render json: { data: serialize_staff(user, memberships) }
            rescue ActiveRecord::RecordNotUnique
              raise Spree::Pos::Conflict, 'An account with this email already exists.'
            end

            def disable
              return if channel_rejected?

              user = staff!(params[:id])
              raise Spree::Pos::Conflict, 'Cannot disable your own account.' if user.id == current_user.id

              user.update!(deactivated_at: Time.current) if user.deactivated_at.nil?
              audit!('staff.disable', user, { email: user.email })
              memberships = load_memberships_by_staff([user.id])[user.id] || []
              render json: { data: serialize_staff(user, memberships) }
            end

            def enable
              return if channel_rejected?

              user = staff!(params[:id])
              user.update!(deactivated_at: nil) if user.deactivated_at.present?
              audit!('staff.enable', user, { email: user.email })
              memberships = load_memberships_by_staff([user.id])[user.id] || []
              render json: { data: serialize_staff(user, memberships) }
            end

            private

            def store_staff_scope
              service_ids = Spree::Pos::StaffMembership.for_store(current_store).where(service_account: true).select(:staff_id)
              Spree.admin_user_class.joins(:spree_roles)
                .merge(Spree::Role.for_resource(current_store))
                .where.not(id: service_ids)
                .distinct
            end

            def load_memberships_by_staff(staff_ids)
              return {} if staff_ids.empty?

              Spree::Pos::StaffMembership.for_store(current_store).people
                .where(staff_id: staff_ids)
                .includes(:staff, :branch, :staff_role)
                .order(:id)
                .group_by(&:staff_id)
            end

            def serialize_staff(user, memberships)
              {
                id: user.prefixed_id,
                email: user.email,
                first_name: user.first_name,
                last_name: user.last_name,
                full_name: user.full_name,
                status: user.deactivated_at.present? ? 'disabled' : 'active',
                deactivated_at: user.deactivated_at&.iso8601,
                last_active_at: user.last_active_at&.iso8601,
                created_at: user.created_at&.iso8601,
                memberships: memberships.map(&:to_pos)
              }
            end

            def pos_staff_role!
              Spree::Role.find_or_create_by!(name: POS_STAFF_ROLE_NAME, resource: current_store) do |role|
                role.permissions = POS_STAFF_PERMISSIONS
                role.description = 'POS staff'
              end
            end

            def staff_role!(prefixed)
              role = Spree::Pos::StaffRole.locate(Spree::Pos::StaffRole.for_store(current_store), prefixed)
              raise ActiveRecord::RecordNotFound if role.nil?

              role
            end
          end
        end
      end
    end
  end
end
