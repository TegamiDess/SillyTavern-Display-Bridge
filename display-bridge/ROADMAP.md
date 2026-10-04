# Remaining work

Current baseline: Display Bridge 0.22.1 / V3 Asset Sprites 0.10.0. See the [current audit](../RELEASE-ACCEPTANCE.md) for tested scope.

## Wider card compatibility

- Extend reviewed setup to automatic embedded-branch selection without leaking unselected content into prompts.
- Support explicitly bounded reply choices, weather/history and randomization only after defining their persistence and replay semantics.
- Complete larger image-catalog handling and original-card import/export acceptance. Scene rendering, reviewed setup and startup screens do not establish full Raen gameplay parity.
- Add broader native coverage across ST versions, mobile, group chats and third-party themes/extensions.

## Presentation and optional interactions

Layered scene fidelity, normal/hover portraits, single-image offsets, scene history/motion and outgoing cleanup are in the baseline. Portrait audio and temporary click-image changes remain a separate experiment; they are not bundled in this release. Arbitrary specialized source handlers remain unsupported. Page-wide source styles remain scoped to message panels.

## Hardening

- Bounded archive extraction that protects browser memory while accommodating legitimate large cards. Current size warnings are advisory.
- Better handling of costly native card regex; explicit permission does not bound execution time.
- Continue testing branch recovery and portable exports against actual host changes.

The project translates supported declarative structures; it does not aim to execute arbitrary imported scripts. Older plans and milestone reports are available in Git history.
