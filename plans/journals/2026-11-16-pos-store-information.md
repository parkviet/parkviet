---
title: POS store information
date: 2026-11-16
summary: "Added POS store info, multi business types, and branch inheritance."
---

# POS store information

## What happened
Implemented the POS store-information plan: store and branch info tables, a Vietnam two-level address catalog, multi business-type union, the store-info page, and branch overrides for name, phone and cutoff.

## Decision
Existing branch business-day cutoffs stay stored. Only a null cutoff inherits the store. profile_key remains the first of profile_keys.

## Next steps
Run the mocked Playwright setup and business-model specs. Extend the branch tab so every store field can be overridden in the form.

> Historical work record — not durable authority. Prefer docs/specs/ADRs for current decisions.
