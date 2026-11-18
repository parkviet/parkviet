# frozen_string_literal: true

module Spree
  module Pos
    module GuestSessions
      # A guest scans a table's code. The code orders nothing: in pay-after
      # mode it opens a session bound to the order open at the table now (or a
      # menu-only session when none is open). In pay-before mode the session
      # stays unbound (`workspace_id: nil`) so each round creates and settles
      # its own order.
      module Open
        Result = Data.define(:session, :token)

        module_function

        # @return [Result, nil] nil when the code is unknown, revoked or its
        #   table or branch no longer takes guests' orders
        def call(table_code:, client_address:, user_agent:)
          code = TableCode.authenticate(table_code)
          return if code.nil? || !code.resource.active? || !GuestOrders::Guard.enabled?(code.branch)

          token = GuestSession.new_token
          prepay = EmenuSettings.of(code.branch)['payment_timing'] == 'pay_before'
          workspace = prepay ? nil : GuestOrders::Guard.open_order(code.resource)
          now = Time.current
          session = GuestSession.create!(
            store: code.store, branch: code.branch, table_code: code, resource: code.resource, workspace: workspace,
            token_digest: GuestSession.digest(token), expires_at: now + GuestSession::TTL,
            client_fingerprint_digest: GuestSession.fingerprint(client_address, user_agent)
          )
          Result.new(session: session, token: token)
        end
      end
    end
  end
end
