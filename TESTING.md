# Testing and feedback

See the [current release acceptance matrix](RELEASE-ACCEPTANCE.md) for fresh checks, earlier evidence, known limitations and the release verdict.

The current combined matrix covers Display Bridge 0.21.1 and provider 0.9.1. Earlier milestone notes remain historical evidence; they are not fresh results.

## Automated tests

Use Node.js 24 or newer. From the repository root:

```sh
npm ci --prefix display-bridge --ignore-scripts
node --test --test-isolation=none display-bridge/tests/*.test.js
node display-bridge/tests/integration-server.mjs /path/to/SillyTavern
```

The unit suite uses built-in Node modules, the sibling provider source and the pinned CSS-parser development dependency installed above. The browser suite needs an installed SillyTavern checkout with its dependencies (`npm install` in that checkout), and reads its actual formatter, regex engine and bundled libraries. Open the local URL printed by the command and wait for the results. Stop the server with Ctrl+C. The harness binds only to loopback; it does not require model access or read your real cards/chats/settings.

Latest 0.21.1 checks: **181 unit tests and 151 browser checks passed**. Scene-control tests cover historical/unknown roster values, keyboard dismissal, one audio owner, generation gating, rejected playback, local-only resolution, preferences and mixed image/audio CHARX round trips, repair and rollback. Token-count dry runs and offline generation attempts cannot leave playback disabled. Earlier coverage checks both scene families, strict capture bindings, offsets, layers, rich text, keyboard tooltips, alpha hit testing, missing assets, editor preservation and portable profiles. The browser harness mocks parts of ST, so real installation testing remains necessary. Prior native checks cover import/reload, image mapping, appearance persistence and recovery; these are not a claim of universal compatibility.

The suite includes 15 tests in `scene-state-contract.test.js` from the stages 1–2 design milestone. These cover neutral source fixtures and a host-independent reference model; they do not establish native ST story-state persistence or Risu trigger equivalence. See the [scene/state contract](display-bridge/SCENE-STATE-CONTRACT.md). Run the focused checks with `node --test --test-isolation=none display-bridge/tests/scene-state-contract.test.js`.

## Useful manual checks

The [0.17.2 pointer fix and audio investigation](SCENE-RELEASE-0.17.2.md) passed **146 unit tests and 137 browser checks**, plus 50 managed audio lifecycle cycles and native mouse checks. Scene text controls must receive pointer input above the portrait layer; invoking `.click()` directly does not check this. For native audio controls in the Codex in-app browser, use coordinate clicks: accessibility-index Play clicks reproduced a tab crash even on a script-free HTML page.

- Import a neutral fixture; confirm images, panels and compatibility report.
- Switch outfits, reset/undo, change chats and refresh.
- Edit a closed outfit's settings, preview, review/apply and export its profile.
- Try complete/incomplete tagged dialogue during streaming and swipes.
- Try `"Ohayou!" (Good morning!)`, the `「Good morning!」` suffix, and a line without a translation. Confirm English first, hover/focus reveal and return to translation when leaving/blurring.
- Disable a panel and confirm ordinary message display returns.
- Report ambiguous or unsupported source formats with a minimal neutral example.

Use a disposable test card for destructive replacement/recovery checks. Keep personal cards, API settings and chat logs out of issues. Share extension/ST versions, browser, reproduction steps, expected/actual results and the smallest neutral snippet/profile. Review compatibility reports and screenshots for identifying labels before posting.

## Large asset performance check

With the integration server running, open `/fixtures/performance-benchmark.html` and click **Run benchmark**. It uses 1,111 neutral asset names, four portraits and six outfits. One warm-up is discarded; the page reports five editor-construction/layout timings and DOM counts. No personal card or asset files are needed. This is an editor benchmark, not a whole-app scrolling measurement. See [performance notes](PERFORMANCE.md).

## Snapshot checks

See [Snapshot compatibility](SNAPSHOT.md) for the opt-in 3.3.0 patch and renderer test. Check regular/grid capture, a small message range, anonymization, compact/expanded images, selected outfits and unchanged live chat. The normal harness includes capture-copy regressions and does not load an external renderer; the optional renderer page does.

## Configured CHARX round trips

Display Bridge 0.15.0 / V3 Asset Sprites 0.7.0 add [portable export](EXPORT.md). The acceptance matrix covers image-only, Afternoon, Community, Witchcure, streamer and assembled scenes through export, fresh import, rescan and re-export. Checks compare asset bytes, portable profiles/defaults and rule definitions; new local markers and fresh permissions are required. Negative cases include malformed templates, edited rules, missing assets, explicit omission of UI/rules, cancellation and edits during export review.

Native ST 1.15.0 acceptance passed for three configured exports (neutral styled Afternoon, assembled scene A and Community), each imported as a new character and exported again. Profiles, assets and portable rule settings survived; regex permission remained ungranted. A further page-reload check retained the Community profile, mappings and rendered panel. Test-only instrumentation requested in-memory files rather than triggering downloads; the normal export action still downloads via the browser. Import tag/regex dialogs were exercised normally. These tests do not certify every third-party script or every ST version.

The 0.15.1 / 0.7.1 patch repeats the browser matrix with generic images exported as `x-risu-asset`, checking image bytes, exact names, one main icon, archive entry counts and stable re-export. A unit regression covers shared-file deduplication and preservation of explicit special/custom roles. Classification was checked against Risu's current official importer source and the user confirmed clean Risu import; a full Risu application import has not been automated. The native round trips described above were performed on 0.15.0. A further 0.15.1 acceptance pass completed 23 native assertions, the real browser download, the current Snapshot renderer check and the large-editor benchmark; see [the matrix](RELEASE-ACCEPTANCE.md) for results and limits.

## Scene state milestone (0.18.0)

Use `examples/scene-state-startup.charx` and [the state guide](display-bridge/SCENE-STATE.md). Verify selected-branch-only startup, reload, exact-once increments, swipe-parent context, old-swipe totals, cancelled/completed streams, edited-history recovery and chat isolation. Model-context tests must inspect the assembled request using a local stub; a model following instructions is a separate check. State rules must not execute during render or silently accept malformed annotations. Existing v7 snapshots and presentation-only cards remain regression coverage.

## 0.19.0 source-only scene trial

Use `examples/scene-auto-import.charx` with both updated extensions. Inspect Scene import coverage and initialize Conversation state. Verify that Chat music stays outside messages, Loop starts on, Hide preserves playback, generation leaves the old track running and a completed track annotation selects the next track. Check export/reimport and reattachment with edited mappings. See [release evidence and limitations](SCENE-RELEASE-0.19.0.md).
