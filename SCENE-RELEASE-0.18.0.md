# 0.18.0 — reviewed conversation state

Display Bridge 0.18.0 / V3 Asset Sprites 0.8.1. Desktop testing release; no production installation or remote repository was changed by this milestone.

The stage-6 foundation now supports explicit v8 scene profiles with typed state updates, finite badge lookups, selected startup branches, saved per-chat/per-swipe history and declared model-context facts. Scene/background mappings select local tracks; playback can continue after the user's initial Play action, and Pause cancels that continuity. The neutral demonstration is `examples/scene-state-startup.charx` with a matching JSON profile.

Startup saves only the selected greeting. Accepted output applies an update once; rendering and cancelled streaming do not. Replacement requests use parent state. Historical scenes retain their own values. Invalid annotations, conflicting snapshots and edited ancestry require review, with an explicit rebuild operation. The journal is excluded from profile/card distribution exports.

## Verification

- 161 unit tests and 143 browser checks pass, including previous presentation, importer/export, Snapshot, audio, image, outfit and recovery regressions.
- Six distributed fixture profiles validate against the published JSON schema; runtime validation also checks references, types and semantic constraints.
- Isolated SillyTavern 1.15.0: selected startup persisted through reload; actual outgoing loopback request contained the selected greeting and current facts; completed output committed exactly once and persisted.
- Native swipe replacement used parent facts; old-swipe totals restored correctly; cancelled streaming committed no delta; the following completed stream succeeded and survived reload.
- An unresolved edited response stopped generation before a request reached the loopback endpoint.
- Native Play continuity and Pause behavior were checked across completed scene transitions. Testing exposed and fixed cancelled/delayed internal pause-event handling.

Native testing also exposed and fixed a first-message reload/save-queue deadlock. Native audio controls are exercised without the accessibility-index Play action that previously crashed the browser provider; see the 0.17.2 note.

## Limits and next gate

This is an explicit-profile state implementation, not automatic translation of every Risu feature. Original conditional macros, lorebook `getvar` references, random/weather startup, recency expressions, context-copy/history edits, Lua and STscript remain unsupported. State-dependent source cards with those missing dependencies must remain partial imports.

Stage 7 should assemble the tested source subset and produce an exact coverage report. It must not mark unrepresented source dependencies as supported. Stage 8 remains combined clean-install/large-card acceptance plus user-side confirmation with original prompts and assets. This milestone did not use a live model, a paid API, or the provided OpenRouter key.

See [setup, schema and recovery](display-bridge/SCENE-STATE.md). The journal contains source text and increases saved chat size; bounds and rebuild semantics are documented there. No new background network service is shipped.
