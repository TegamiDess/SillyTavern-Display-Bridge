# Scene pointer controls and audio crash investigation — 0.17.2

Display Bridge 0.17.2; V3 Asset Sprites remains 0.8.1. Tested on 2026-09-23 in the isolated SillyTavern 1.15.0 installation.

## Pointer fix

The scene's portrait container intercepted mouse clicks on Expand/Collapse dialogue. Its stacking level was above the text controls. Direct JavaScript button clicks in earlier tests bypassed hit testing and missed the problem.

The text controls now sit above the portrait layer. A browser regression checks the actual element at each button's center before activating it, through collapse, restore and expand. It failed before the fix and passes afterward. Native coordinate clicks now hide the whole dialogue surface and restore it correctly.

## Audio crash isolation

The observed crash is reproducible without SillyTavern or either extension. In the Codex in-app browser, an automation click addressed to the accessibility index of the browser-native audio Play control crashed the tab. A coordinate click on the same minimal page played successfully.

| Check | Result |
| --- | --- |
| Plain audio control on the three-case diagnostic page; accessibility-index Play click | Tab crashed |
| Pure HTML audio page, no scripts or author-created shadow root; coordinate Play click | Played successfully |
| Same pure HTML page after reload; accessibility-index Play click | Tab crashed |
| Managed audio: 50 play/hide/show/rebind/invalidate cycles | Passed; one player reused, source cleared and playback stopped on invalidation |
| Native ST after the pointer fix: coordinate Collapse, Play, Hide/Show music, restore dialogue, Play/Pause | Passed; playback continued through Hide/Show; no crash |

This isolates a reproducible trigger to the browser automation/native-control interaction. It does not identify the underlying browser defect, establish that every crash has that cause, or claim to fix Codex itself. Use screenshot-based coordinate clicks for native audio controls in this environment. Do not treat an accessibility-index click failure as evidence of an extension audio failure.

The minimal diagnostic page is `display-bridge/tests/browser/native-audio-only.html`. Start the integration server using [TESTING.md](TESTING.md), then visit `/fixtures/native-audio-only.html`. It serves a generated local WAV and runs no client JavaScript. **Reproducing the accessibility-index action may crash that disposable tab.** The separate `/fixtures/audio-crash-repro.html` page compares plain, shadow-root and managed players and provides the muted 50-cycle test.

## Verification and scope

- 146 unit tests and 137 browser checks passed after the pointer fix.
- The 50-cycle diagnostic and native mouse interactions above were also checked separately.
- The test installation remains running with playback paused. Production files were not changed.
- No extra polling, event listeners or runtime work were added; the runtime fix is a stacking-order change.
- Stage 6 has not started. This remains the explicit scene-state implementation described in [0.17.1](SCENE-RELEASE-0.17.1.md), not automatic translation of original Risu state or scripts.
