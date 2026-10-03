# Release acceptance

## Display Bridge 0.22.0 / provider 0.10.0 — 2026-10-03

This release incorporates the audited development changes since 0.21.2 / 0.9.1. Optional portrait audio/click-image experiments remain outside the baseline.

Two functional defects were reproduced and fixed:

- Renaming a character in the preset editor updated the live mapping label but could omit that label from the staged/exported preset. Saving now compares against the original label, independently of the live label used by the mapping rows. The existing outfit regression caught the failure and now passes.
- Reopening setup could replace explicitly saved empty enum/number choices with initial defaults. Saved values now use own-key presence rather than null coalescing, and empty enum choices have a visible label. A new regression checks restoration, explicit reset and defaults for genuinely missing keys.

Fresh verification: **234/234 unit tests**, **187/187 visible browser checks**, **147 JavaScript files parsed**, **18 JSON files parsed**, and `git diff --check` passed. The inventory scan covered 254 release files and 73 entries inside eight bundled CHARX fixtures, with no matches for the checked credential/private-key and personal-path patterns. This pattern scan is not a guarantee that every secret is detectable. The npm bulk advisory endpoint returned no advisories for the only locked development dependency, `@adobe/css-tools@4.4.4`; host-supplied ST libraries are outside that dependency check.

Browser checks used neutral fixture assets, the actual installed ST formatter/regex engine and mocked host state, requests and persistence. The standard harness was staged under the existing isolated test server; test-only path rewriting and a scope-limited service worker reproduced its delayed image fixture. Missing dynamically named fixture images and the delay were corrected before the final run; the worker unregistered on completion. No model calls or native destructive import operations were made during this audit. Earlier native acceptance remains available in Git history.

Security boundaries reviewed include sanitized rendering, supported CSS/HTML compilation, local asset URL restrictions, archive paths, portable exports, declarative state/setup validation, request-copy mutation and recovery guards. No new high-severity exploit was confirmed in those paths. Remaining limits:

- Archive size checks are warnings, not enforced extraction budgets. `card.json` and asset entries can be inflated without a hard output limit; a malicious or very large card can exhaust browser memory. Do not treat the central-directory estimate as a security boundary. A future bounded/streaming extraction design must account for legitimate large cards.
- User-approved native card regex runs in the host regex engine and can be computationally expensive. Permission to use a rule is not a runtime or complexity limit.
- This is an extension audit, not a full audit of SillyTavern, its dependencies, every third-party extension or every original card. The separately reviewed SFW showcase contains selected display data and embedded artwork, not card definitions, system prompts, keys or private chat files.

The stale current-test summary in `TESTING.md` was updated. These results are not a claim of complete Risu parity or universal compatibility. Previous milestone notes remain in Git history.
