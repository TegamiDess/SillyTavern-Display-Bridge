# Optional Summaryception compatibility build

**23.40.0-db.1**, based on Summaryception 23.40.0. This is a separately maintained
companion, not a requirement for Display Bridge or V3 Asset Sprites. Original
Summaryception authorship is retained in the source and manifest (Lodactio).
Upstream: [vadash/Extension-Summaryception](https://github.com/vadash/Extension-Summaryception).
The upstream manifest also identifies [Lodactio's repository](https://github.com/Lodactio/Extension-Summaryception).

## Installation

1. Back up your existing Summaryception extension folder and SillyTavern data.
2. Copy this complete folder over `data/default-user/extensions/Extension-Summaryception`.
   Keep that folder name and use only one active Summaryception installation.
3. Reload SillyTavern. Existing settings and per-chat memory remain in their usual
   locations; this folder contains no settings, credentials or saved chats.

The repository root is not an installable Summaryception Git extension. Download
the source archive and copy the folder. Automatic updates are disabled in this
companion's manifest; an explicit upstream update can replace these changes.
To return to upstream, restore the backed-up extension folder and reload.
Creating, editing or deleting summaries still changes your normal saved memory.

## Changes

- Hidden panels defer work, refresh requests coalesce, and unchanged controls
  retain their DOM, scroll position and active edits.
- Off skips live history-budget planning while preserving configuration and
  explicit saved-memory review. Easy, Advanced and Memory reuse matching display
  calculations. Input changes invalidate results; failed/estimated counts retry.
  Regex-dependent history plans recalculate because macros can change externally.
- Foreground generation freezes summary commits even if a background summary
  request is already running. Clear Memory unhides only messages owned by
  Summaryception, preserving unrelated hidden/system messages.
- New summaries track compact source revisions. Changed/missing source text is
  marked for review; existing memory stays included until manually repaired.
  Older/imported summaries without revision baselines are marked unverified.
- Regeneration can read its own hidden sources without unhiding saved chat.
  Context changes or foreground generation reject pending stale results.
- Owned summarization prompts are excluded from foreground cache diagnostics
  using local object identity, without adding marker text to provider requests.

Display caching does not change summarization algorithms, prompt assembly or
provider Prefix Cache behavior. Source revision fingerprints detect changes;
they are not security/authenticity checks. No automatic model calls are made
solely to repair stale memory.

## Validation and limits

Tested with SillyTavern 1.15.0 staging. The full private suite passed 577 tests,
including cross-extension actual-card checks; 13 visible UI checks passed on a
600-message SFW conversation. Private card profiles and conversations are not
distributed. The **535-test public subset** passes against the included source with
synthetic inputs and mocked provider responses, without model calls.

```sh
npm ci --ignore-scripts
npm test
npx tsc --noEmit
```

Display Bridge's hidden-history fixes work independently with the original
Summaryception. The changes listed above require this companion. Compatibility
with other SillyTavern versions or forks needs testing. Host routes that deep-clone
all prompt messages may need additional request-identity adaptation.

Licensed under the included [GNU AGPL v3](LICENSE). The supplied upstream LICENSE
and README identify AGPL v3; this companion corrects the upstream package metadata's
inconsistent ISC label. Existing authorship and notices are preserved.
