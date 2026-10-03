# Layered scene fidelity

Included in Display Bridge 0.22.0. This uses the existing layered
scene contract; no new profile field or adapter version is required.

The artwork has a separate 40:21 viewport, derived from the reviewed source's
16:14 outer frame and 60% background band. One portrait uses a 60% slot at 20%;
two use 30% slots at 18% and 52%; three at 10%, 35%, 60%; four at 5%, 25%, 45%,
65%. Three- and four-person layouts intentionally overlap. Ordinary portrait
slots start one twelfth of a frame above the background, matching the source's
32% clipper origin versus its 37% background origin. Images contain their aspect
ratio inside a 90% fitting box and use the declared vertical center. Offset art
clips to the frame. The separate single-image percentage box remains unchanged.

The border interpolates between the reviewed period colours. The clock uses a
monospaced face, restrained glow and translucent border. Sizes use the message
container width instead of the entire application window.

Dialogue expansion moves text below the artwork without changing frame size.
At container widths of 480px or less, ordinary dialogue also moves below it.
Controls sit below the frame or expanded text. Hiding artwork collapses its
environment space while retaining dialogue. Existing opacity and speaker-colour
preferences still apply. Status remains hover/focus-only, above dialogue, while
portrait images stay behind it. The frame deliberately avoids a stacking context
that would trap captions below the dialogue.

## Scope and verification

The source's page-wide sky/cloud styling remains bounded to each message, with a
bottom fade. Controls and narrow-screen text placement follow the native chat
layout. This is a faithful adaptation of reviewed geometry, not a claim of
pixel-identical full-page Risu rendering. No imported scripts execute.

234 unit tests and 25 focused checks passed in the visible local browser. The
checks cover history/motion, outgoing cleanup, single-image layout, one-to-four
portrait geometry, long dialogue, expansion/collapse, 320px and 480px containers,
status layering, image hiding and the separate reviewed frame. Native chat
verification confirmed loaded artwork and readable focused status. A new live
Risu screenshot comparison and clean-profile release acceptance were not run.

Optional audio and click-image work remain outside this baseline. This change
does not claim their specialized source interactions are implemented here.
