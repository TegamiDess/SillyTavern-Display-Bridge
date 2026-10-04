# Performance

## Long-chat work — 0.22.1

Deterministic source parsing uses a bounded cache, cleared on chat/configuration
changes. Saved journal validation and applied state remain authoritative. Render
plans now depend on presentation boundaries and committed state, rather than
every numeric depth increment. A render pass shares its message lookup and state
read; closed information drawers avoid reading scroll position.

In a visible-browser trial using the actual To Love Ru card with scripted SFW
responses, the 600-message state refresh fell from 1,312 ms to 68 ms, and reply
accept/save/render from 4,864 ms to 1,143 ms. All 297 earlier assistant views were
retained after append. These are single-run synthetic timings, not FPS or model
speed claims. Idle timings were mixed; cold loading and genuine earlier edits
still require work.

The optional Summaryception companion separately reduces hidden/Off UI work and
reuses matching display calculations. On a 600-message chat, 20 unchanged Off
Status refreshes fell from 345 ms to 90 ms and Off Memory from 313 ms to 142 ms.
Regex-dependent history plans remain uncached; provider caching is unaffected.
These measurements are hardware-dependent diagnostics, not universal guarantees.

## Earlier editor cleanup — 0.14.3 / 0.6.5

- A preset editor shares one asset-name suggestion list across all mappings. Existing outfit mapping rows are created when their section first opens. Unopened options retain their mappings and are still validated during preview/review/export.
- Closed Display Bridge settings no longer compute compatibility reports on chat render passes. Opening the panel computes a fresh report; explicit report exports and API requests remain fresh. An open panel still updates with chat/asset changes. Diagnostics are computed once per settings update rather than twice.
- The image provider reuses the most recently parsed serialized card. Changed JSON is parsed again, and live metadata is merged on each read. The cache retains only one serialized revision, not a copy of the entire character library.
- Native regex metadata is used directly when present, avoiding an unnecessary JSON parse. Idle scroll events no longer rewrite an already-hidden image preview or clear an absent timer.

No new polling or background observers were added. Import permissions, saved chat text, profiles, asset storage and image interaction behaviour are unchanged. Snapshot compatibility is not part of this patch.

## Controlled browser check

Neutral fixture: 1,111 asset names, four portrait references and six outfits. Identical benchmark page against 0.14.2 and the updated source in the same local browser; one warm-up discarded, five measured runs. Timing includes editor creation and one forced layout. No asset image files are loaded.

| Measurement | Before | After |
|---|---:|---:|
| Suggestion lists | 7 | 1 |
| Suggestion entries | 7,777 | 1,111 |
| Mapping rows constructed for closed outfits | 24 | 0 |
| Editor descendant elements | 8,242 | 1,258 |
| Median creation/layout time | 32.5 ms | 7.4 ms |

These timings are illustrative and hardware-dependent. They do not measure full-card image decoding, peak browser memory, whole-app scrolling or the performance of unrelated extensions. The original reported scrolling slowdown involved other rendering activity; this cleanup is not a claim that every source of that slowdown is fixed.

Validation: 107 unit tests and 113 browser checks, including unopened/edited/removed outfit retention, unresolved mapping rejection, fresh reports after reopening settings, saved choices, swipes, image hover/expansion and import/recovery flows. Reproduce the benchmark using [TESTING.md](TESTING.md).
