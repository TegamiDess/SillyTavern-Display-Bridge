# Release acceptance — 0.15.1 / 0.7.1

Target: Display Bridge 0.15.1 and V3 Asset Sprites 0.7.1, together, on the isolated SillyTavern 1.15.0 installation. PC/browser use is the primary target. Production installation and user source archives were not changed.

This matrix distinguishes fresh checks from earlier evidence. It is acceptance of the documented experimental feature set, not universal Risu compatibility. The subsequent scene-family plan is separate work.

## Fresh automated checks

| Area | Result | Evidence / boundary |
| --- | --- | --- |
| Unit suite | Pass: 115/115 | Parsers, profiles, actions, identity/persistence, recovery journals, portable export and Snapshot patching |
| Browser integration suite | Pass: 130/130 | Actual ST formatter/regex engine with simulated host data and requests; not a complete native installation |
| Six-family portable round trips | Pass | Asset-only, Afternoon, Community, Witchcure, streamer and assembled scenes: export, fresh import, rescan and re-export |
| Export role/byte integrity | Pass | Named Risu asset type, one main avatar, existing special roles, unchanged image bytes, exact names and shared-path deduplication |
| Negative import/export cases | Pass | Invalid templates before native writes; edited rules; missing/unsafe asset paths; cancellation; changed source during review; intentionally omitted UI/rules |
| Streaming and swipe lifecycle | Pass | Incomplete/complete fragments, pending/failed swipe, source edits, old controls and native restoration; simulated generation events |
| Recovery failure paths | Pass | Journal ordering, interrupted/unverified writes, failed backups, revision changes and cancellation; fault injection, not a deliberately killed native server |
| Upgrade/identity boundaries | Pass | Existing profile versions, serialized state, rename/deletion/reused identity, late provider/handoff and replay protection |
| Syntax | Pass: 91 files | Runtime, tests and tool JS/MJS parse successfully with Node 24 |
| Repository documentation/privacy checks | Pass | Markdown links resolve; no workstation username, private absolute user paths, test-lab references or test-origin URLs found in distributable source |

## Fresh native checks

Existing fixture cards were loaded with the current extension files. Five UI families rendered through their native chats; the image-only card rendered its ordinary images. Visible image bytes decoded successfully. All six exported through the current configured-card API, with profiles and chat text unchanged.

| Family | Render / images | Export | Saved-chat reload |
| --- | --- | --- | --- |
| Asset-only | Pass | Complete | Pass; saved chat explicitly reopened |
| Afternoon with appearance options | Pass | Complete | Pass |
| Community | Pass | Complete | Pass |
| Streamer/gallery | Pass | Complete | Pass |
| Assembled scene | Pass | Complete | Pass |
| Witchcure | Pass | Expected incomplete warning for ten alternate icons | Pass |

The original Witchcure fixture declares ten alternate-icon entries. Alternate avatars are outside the configured exporter scope. Export correctly lists these omissions, requires confirmation and uses the `-incomplete.charx` suffix; its supported mapped images and UI remain available. This is not a clean, lossless archive export. Keep the original if those icon variants matter.

The older asset-only QA fixture has no native last-chat field. ST generated a new greeting chat on selection, so the first test's automatic-chat-identity assertion failed. Its saved chat was then explicitly reopened and its profile/mappings/messages checked after reload. That corrected test passed; the five other families returned to their expected chats automatically.

Native recovery coverage includes fresh same-name imports with distinct colliding image names and bytes, preservation of the first import when the second arrives, selected-card replacement preserving chat text, and restoration from the durable recovery journal after a browser reload. A deliberate later native edit blocked rollback without changing that edit; after removing the test edit, verified restoration succeeded. Character regex permission remained ungranted/revoked as appropriate.

Image-only repair also passed cancellation, asset replacement and undo. Hashes confirmed that the native card bytes remained unchanged while the mapped image bytes changed and were restored; UI profile and chat text were preserved.

## Performance and Snapshot

The current 1,111-asset editor benchmark retained one shared suggestion list, 1,111 entries, zero constructed rows for closed outfits and 1,258 descendant elements. Five measured construction/layout runs after warm-up: 7.7, 6.3, 7.5, 6.8 and 7.1 ms; median **7.1 ms**. The earlier cleanup measured 7.4 ms. This shows no regression in that specific test, not a guarantee about whole-app scrolling, image decoding or other extensions.

The actual html2canvas collapsed-reasoning reproduction was rerun. The legacy capture differed from the visible-content reference by 15,005 pixels; the current helper differed by **zero**. Live source remained unchanged. The installed Snapshot compatibility patch was recognized as already applied. Current browser tests also cover flattened widgets, regular/expanded thumbnails, anonymization ordering, lazy images and hidden/nested details.

## Earlier evidence carried forward

- On 0.15.0, native ST export → fresh import → re-export passed for configured neutral Afternoon, assembled scene and Community cards, including native tag/regex prompts and a further reload. The current browser suite repeats the round-trip contract with the corrected asset type; the current native family checks use the corrected exporter.
- Native Snapshot 3.3.0 regular/grid capture with anonymization was exercised previously on Afternoon and assembled scene fixtures. That four-case native capture was not repeated here; current helper/browser/renderer regressions were repeated.
- Earlier native generation and lifecycle checks supplement the current simulated streaming/swipe cases. No model requests or credentials were needed for this acceptance pass.
- The user confirmed that the corrected configured export imports cleanly into Risu. This is user acceptance, not an automated full-Risu-app test.
- The user reported no visible interaction slowdown after the performance cleanup. The current controlled benchmark supports the editor result; full user performance traces were not recollected for this matrix.

## Remaining support boundaries

- Use the extension's import command. Ordinary ST drag/drop does not perform the full handoff.
- Audio/video/fonts/models and alternate avatars are not included in configured export. Missing/unsupported assets must remain explicit; general source-archive reconstruction is not implemented.
- General Lua/STscript, story-variable automation, conditional greeting conversion and complete To Love Ru behavior remain outside this release.
- Group chats, other ST versions, arbitrary third-party regex combinations and newer/different Snapshot source layouts are not certified by this matrix.
- Recovery covers the documented card/provider/display state, not a server-wide transaction. Other browsers/external writes cannot be locked; old uploaded files are retained.
- Persistence uses ST saving behavior. This pass tests ordinary page reload and recovery from saved journals, not power-loss durability or a fresh OS/server restart.
- No full extension uninstall/reinstall or rollback to older extension code was performed. Disable/native restoration and versioned-profile rejection paths are covered by the browser suite.

## Final verification

**Verdict: pass for the documented experimental release scope.** There were 23 passing native assertions, in addition to the 115 unit and 130 browser checks. The ordinary extensions-menu export was also exercised with its real confirmation and browser download. The resulting neutral assembled-scene CHARX passed ZIP CRC, embedded-reference, asset-role and portable-profile/rule checks; no local provider bindings appeared in its card metadata.

No new runtime defect was found. Two initial acceptance assumptions were corrected and retained in the local test evidence rather than silently counted as passes. Documentation was corrected for current Snapshot update instructions and the shipped scene-fixture paths. Runtime versions remain 0.15.1 / 0.7.1.

The refreshed acceptance bundle is checked against repository file bytes, with archive CRC verification and a SHA-256 recorded alongside the local results. Temporary native QA controls were removed afterward. This acceptance pass does not publish or push the repository; the next scene-family implementation can start from this tested baseline.
