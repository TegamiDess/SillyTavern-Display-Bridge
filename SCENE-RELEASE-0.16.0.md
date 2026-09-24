# Scene presentation testing build — 0.16.0

Display Bridge 0.16.0 / V3 Asset Sprites 0.7.1. This is stage 3's standard-scene presentation milestone, not complete To Love Ru compatibility.

## Added

- Recognized background, sky and effect layers, with image mapping for each role.
- Bounded portrait offsets and literal source offset aliases; existing alpha-based hover regions follow the positioned artwork.
- Per-portrait notes shown by hover or keyboard focus, plus scene labels and reviewed period brightness.
- Safe dialogue emphasis, paragraph breaks and distinct narration styling. Unknown markup stays readable through native fallback.
- Version 6 portrait profiles preserve these fields through editing and portable export. Older profiles keep their existing behavior.

See [scene assembly](display-bridge/SCENE-ASSEMBLY.md) for the exact configuration, upgrade route and exclusions.

## Try it

Update the two extension folders using the usual [installation instructions](START-HERE.md), then reload ST. Import `examples/scene-details-four.charx` or `examples/scene-details-five.charx` through **Import card with images and supported UI**. Hover/focus the two guides, expand/collapse dialogue and toggle the portrait/layout controls. The four-field example includes sky and effect artwork. These are neutral source-only cards: no manually embedded profile is needed.

The isolated test installation has been updated; the production installation has not. This build has not been pushed to GitHub.

## Evidence and limits

- 138/138 unit tests pass, including 15 design-only state contract tests.
- 132/132 browser checks pass, including layer mapping, rich text, offsets, alpha hover, tooltips, old profiles, streaming, Snapshot and portable export regressions. The final alias-report bookkeeping change was subsequently checked by the unit suite and native reload; the full browser suite was not repeated for that small change.
- Native ST 1.15.0: imported the four-field CHARX through the normal tag/import prompts, declined ST regex execution permission, and observed a rendered scene with all seven image elements loaded, two tooltips, strong/emphasized text and surrounding prose. Keyboard focus revealed a tooltip. Reloading and reopening the card retained the imported display profile and rendered assets. This does not claim same-chat persistence testing or a new full release acceptance matrix.
- Both source families were checked technically for recognized roles and in neutral browser fixtures. The five-field fixture was not separately imported into native ST in this pass. No original-card narrative or artwork is included in the fixtures.

State-driven weather, source recency conditions, specialized poses/animations, information drawers, audio, story variables, prompt dependencies and conditional greetings remain pending. Geometry/tints approximate reviewed source behavior within the scene, rather than reproducing arbitrary imported CSS. The next planned stage is the character-information drawer.
