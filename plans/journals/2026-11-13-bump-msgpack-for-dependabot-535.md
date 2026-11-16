---
title: Bump msgpack for Dependabot 535
date: 2026-11-13
summary: Updated msgpack 1.8.6 to 1.8.7 to clear GHSA-73v3-wf97-vpgj.
---

# Bump msgpack for Dependabot 535

## What happened
Dependabot alert 535 flagged msgpack 1.8.6 (GHSA-73v3-wf97-vpgj / CVE-2026-126366). The JRuby decoder pre-allocates from the declared header size. The patched gem is 1.8.7. Bootsnap depends on msgpack (~> 1.5), so the lockfile could move without a Gemfile pin.

## Decision
Ran bundle update msgpack --conservative through the Spree CLI. server/Gemfile.lock now records msgpack 1.8.7. A fresh process in the API container loads /usr/local/bundle/ruby/4.0.0/gems/msgpack-1.8.7.

## Next steps
Commit and push the lockfile so GitHub can close the alert. The already-running API process still has the previous native extension loaded until it restarts. This app runs CRuby, where the same class of bug was already fixed in 1.8.6; the bump closes the advisory range.

> Historical work record — not durable authority. Prefer docs/specs/ADRs for current decisions.
