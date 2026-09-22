# Portrait preset and ordinary-image acceptance — 0.8.0

Validated 2026-09-21 against isolated SillyTavern 1.15.0 staging, commit 23ba3e5bb2e7aad59d0912b2b026a14052936f1b. Production install was not modified.

- 58/58 unit tests pass, including profile validation, literal/JSON parsing, presentation actions, old preferences, exact source recognition and a large preference-export round trip.
- 75/75 browser integration checks pass. New coverage includes two grammars, markup inertness, controls, character/chat isolation, stale controls, restart persistence, streaming completion, manual preview/staging, profile recovery, native text colour, optional image ownership, borderless hover, simultaneous inline expansion, source/chat change cleanup and disabling the trial.
- 50 JavaScript modules pass syntax validation.
- Native CHARX imports: Neutral Observatory mapped 3/3 images and Neutral Workshop mapped 4/4. Both applied explicit profiles and displayed their different formats. Native image-rule and regex approval prompts were exercised.
- Live controls changed image variants, toggled portrait visibility, undid a choice and survived native saved-chat reload while preserving message strings. A full page reload and reopening the same named Workshop chat retained the selected Workshop variant.
- Final native check confirmed that disabling Visual layout inherits the surrounding chat colour while restoring it retains the custom theme.
- Live compact-image check confirmed floating hover, no frame controls, larger dimensions in the original chat container, two concurrent expanded images, independent collapse and unchanged message text. Custom preset portraits were not wrapped.

The initial native test helper clicked the wrong last-child button for Undo; it now selects the exact control. A reload check initially selected a fresh default chat, so it correctly received default settings. The final test explicitly reopens the same saved chat. These corrections are recorded to avoid mistaking test errors for product regressions.

Hover is exercised with a dispatched PointerEvent from the test-only lab; button, keyboard, DOM geometry and image loading assertions run in the actual ST page. User trials also informed inline expansion and normal text-colour behaviour. No external model/API or imported Lua was executed for this milestone.

Neutral fixtures and explicit profiles establish the reusable renderer contract. They do not establish automatic compatibility with arbitrary real-world Risu card patterns. Native server-wide replacement and the earlier full-generation matrix were not repeated; the retained browser regression suite covers existing swipe behaviour.
