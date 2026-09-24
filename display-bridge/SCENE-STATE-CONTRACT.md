# Scene/state contract — design version 1

Status: stage-2 design with executable **test-only** examples. This document does not add fields to the current portable profile, claim an ST transaction implementation, or enable Risu scripts. Basis: [source audit](SCENE-SOURCE-AUDIT.md). Production adoption requires validator/editor/export changes and host integration tests together.

## Ownership

| Owner | Data | Persistence / export |
| --- | --- | --- |
| Character configuration | Family/field-role mapping, asset aliases, entity IDs, finite badge/track mappings, literal typed initial values, capability declarations | Versioned portable profile. Export configuration and defaults, never the active chat's state. |
| Chat presentation preferences | Appearance, visual/image/dialogue visibility, audio enabled/volume, recency preference where exposed | Existing character identity + stable chat + configuration signature. No model-context effect. |
| Message revision | Parsed scenes, ordered state changes, effective scene/drawer snapshot, message-specific weather/effects | Proposed namespaced chat metadata journal. Bound to character generation, chat, stable message key, swipe key and content revision. |
| Story state | Declared score/location/relationship and startup choices that affect future responses | Fold committed active-branch events over typed initial values. Stage 6 owns model-context binding. No write during render. |
| Widget / session | Drawer open, tooltip/hover, current focus, expanded text, pending stream, player instance | Transient. Hover and playback never survive a reload automatically. |

Keep the existing preferences store and `core/actions.js` presentation actions. Neither is an implicit Risu `getvar` store. Proposed story persistence must not reuse the preference store's eviction policy: silently losing an old preference is tolerable; silently resetting story totals is not.

## Scene record

Each parsed candidate has `contractVersion: 1`, an owner, source range, source-family identifier and provenance for every field. An owner is `(characterIdentity, chatIdentity, messageKey, swipeKey, revision, sceneOrdinal)`. A source-supplied scene label is display data, **not** a unique key. Two scenes may have the same label.

| Field | Type / initial design bounds | Rules |
| --- | --- | --- |
| Label | Optional plain string, 80 chars | Preserve the captured label; no inferred message identity. |
| Main background | Asset reference or missing | Resolve through the provider; no URL/path concatenation from source text. |
| Layers | At most 4 `{role, asset, opacity}` entries | Roles: sky, weather, effect. Opacity 0–1; missing layers omitted with a diagnostic. No imported CSS/HTML. |
| Period | Optional configured enum | Family A derives it from a finite sky mapping; family B captures it explicitly. Unknown stays unknown. |
| Status | Optional date/time/location strings, at most 256 chars each | Missing does not mean zero, current OS time, or last scene's location. |
| Cast | 0–4 `{entityId?, image, hover?, offset?, tooltips[]}` | `ct` maps to offset + 1 or 3 tooltip strings. Asset names are not entity IDs unless explicitly mapped. |
| Offset | `{value, unit}`; finite value, unit `px` or `%` | Parse only a complete numeric token. Proposed range −1000…1000px or −100…100%; reject expressions, URLs and arbitrary style text. Stage 3 verifies geometry on source examples. |
| Tooltips | Up to 3 plain strings, 512 chars each | Scoped regions, keyboard focus, no HTML. Unrecognized metadata remains a reported unsupported field. |
| Dialogue | Up to 12,000 chars represented as bounded text/emphasis/paragraph/break runs | Preserve order and narration distinction. Do not evaluate HTML handlers, macros, Markdown images or commands. Unsupported content remains readable outside the rendered candidate. |
| Roster | Configured entity entries + revision-specific optional score/location/relationship | Score is a finite number or unknown; display gauge can clamp 0–100 without altering story value. Badge/icon is a finite derived mapping. |
| Music | Optional declared track ID or explicit stop | Scene selects a track; user preference controls whether playback is allowed. Missing track cannot trigger a remote fetch or guessed substitute. |

The parser retains the existing 64-scene/message and 20,000-character candidate bounds. Source order and consumed ranges are authoritative; do not borrow another scene's cast or swallow unrecognized text. A complete scene may preview during streaming, but preview cannot commit state changes or start audio.

## Initialization, unknown values and precedence

1. Validate the complete configuration before applying it. Defaults must be literals of declared types; macros inside source defaults are dependencies to translate, not values to evaluate as JavaScript.
2. At a new chat, initialize only explicitly declared values. Unknown is `null`; source sentinel strings may normalize to unknown through a reviewed mapping.
3. Replay the active branch's committed events in source order. Explicit snapshots assign only their declared fields; they do not erase unrelated fields. Delta to unknown is an unresolved dependency, never `0 + delta`.
4. Derive badges and asset selections from finite tables after state updates. Never execute a source-generated variable/property name. Import can expand reviewed entity suffix patterns into a closed registry.
5. Apply presentation preferences last. An outfit override changes rendering, not the recorded source asset or story prompt. Missing replacement uses the base mapping with a diagnostic.

Multiple scenes within one message require source-position checkpoints. An update before scene 2 must not change scene 1's historical snapshot. The latest assistant toolbar/drawer uses the final committed checkpoint; a historical scene uses its own checkpoint. The reference model tests message-level transactions only; intra-message checkpoints require parser integration in stage 6.

## Transaction and branch rules

A journal entry records an immutable event key, parent checkpoint, profile/configuration fingerprint, source revision, ordered validated updates and any resolved nondeterministic choices. Reusing a key with different content is an error. Normal redraw is a pure projection, not an event. Events from another chat/character/configuration cannot be applied.

| Lifecycle | Required result |
| --- | --- |
| Open / reload | Validate schema, owner, fingerprint and active message revisions; replay existing committed entries, do not run startup again. Missing state is reported as unresolved rather than reconstructed with invented defaults. |
| Generate / swipe attempt | Snapshot parent checkpoint and previous active selection; use a distinct attempt key. Hide the previous scene for a pending new swipe, while retaining it as rollback data. |
| Stream | Parse a disposable preview from the captured parent. Repeated chunks replace preview; they do not repeatedly increment totals. No prompt writes, durable updates or audio side effects. |
| Successful completion | Confirm matching attempt, owner, selected swipe and complete saved content. Validate the entire update batch, commit once, then publish scene state. |
| Failure / cancellation | Discard preview and restore previous selection. Generation-ended alone is insufficient evidence of success. If ST saves partial text, render it as text/preview; do not silently commit a partial state transaction. |
| Switch to an existing swipe | Select its checkpoint and ancestry. Do not replay its updates on top of the previously selected swipe. |
| Edit / delete / regenerate earlier message | Invalidate dependent checkpoints after the changed revision on the current path. Recompute only from verified retained source; keep later text readable with unresolved-state status until reconciled. Never attach old descendants to a new parent automatically. |
| Branch chat | Copy only ancestry shared with the selected branch point, rebind to the new chat identity; diverging events stay isolated. |
| Character/chat switch | Abort pending owners and stop media; restore the destination's own journal/preferences. Reject late callbacks and detached controls. |
| Configuration change | Mapping-only presentation changes may reuse story state if its schema/fingerprint is unchanged. Changed operation/schema/default semantics require an explicit migration or a new namespace, not silent replay under new rules. |

Stable identity is required even when two messages contain identical text. Proposed host integration uses namespaced message metadata plus per-swipe revision records and a namespaced chat-metadata journal. Array indexes and content hashes alone are insufficient. Existing ST exposes chat metadata, save hooks and generation/message events, but event order and per-swipe metadata durability must be verified in the isolated host before implementation is marked supported. Do not mutate message bodies to embed IDs.

Persist journal/active head in one host save where possible. On interrupted save, reconcile journal revision fingerprints against actual saved messages before exposing derived state. Bound records/bytes and cache checkpoints; on exhaustion report state unavailable or compact with a verified baseline and retained branch ancestry. Never silently drop an event that still contributes to active state. Host persistence, corruption recovery, quotas and migration are integration gates, not implemented by the reference model.

## Reviewed operation boundary

The initial semantic subset is typed assignment, finite numeric delta, enum/boolean choice, finite lookup derivation and attachment of declared effects to a specific message revision. Existing action expressions may supply bounded comparisons; no generic imported evaluator is introduced. Preserve source order for overlapping supported rules. If a required write is unsupported or malformed, reject the dependent transaction atomically and keep the source readable.

Source loops over past messages, chat rewriting, arbitrary regex extraction, dynamic handler/variable names, waits and recursive trigger invocation are **not** operations in this contract. Stage 6 may translate a demonstrated behavior into a bounded declarative action (for example current roster context, or weather on this message). It must not advertise original trigger support merely because the screen looks similar.

Randomness is sampled once for a validated user/output transaction and its resolved result persisted. Replay, hover, reload and stream preview cannot resample. No random runtime is implemented in this milestone. User input, message insertion and any model-facing variables require explicit stage-6 bindings and local request-preview tests.

## Media and UI behavior

- One playback owner per active chat, bound to the selected committed scene/track. Redraw must not restart it. Disable, switch or owner invalidation stops playback; restore control state without autoplay after reload. Family A's hide/music toggle stops audio because its source removes the audio branch.
- Drawer visibility is transient; its values come from the chosen snapshot. Never pull present-day totals into an older scene.
- Page-wide backgrounds are not implicit. Scene-local layers are the default; any optional page mode must restore ST's prior background on switch/disable.
- Alpha hit testing remains per portrait; transparent pixels and dialogue overlays cannot activate unrelated portraits. Thumbnail behavior yields to scene-owned images.
- Snapshot renders a frozen visible projection with controls as decoration, no triggers or media playback.

## Capability reporting and export

Report capabilities independently: scene presentation, typed state reads, state updates, drawer, audio, startup, model context. Each has `ready`, `partial`, `unsupported` or `missing-assets`, plus concrete source references and unresolved requirements. A working background cannot turn required unsupported prompt dependencies green.

An ordinary CHARX export includes profile configuration, reviewed mapping definitions and local assets. Exclude active totals, pending attempts, chat text, selected track playback state and chat journal. Preserve original Risu metadata separately; no reverse conversion from this contract to Risu scripts is required. Unsupported contract versions must retain the source and request an extension upgrade, never reinterpret as the old schema.

## Validation supplied now

`tests/scene-state-contract.test.js` checks neutral source grammars and a small host-independent journal model: streaming/commit/failure, idempotence, swipe selection, edit ancestry, historical values, reload and owner isolation, atomic errors, ordered updates, unknown values and recorded choices. This proves the intended state semantics, **not** Risu equivalence or native ST persistence. The existing production scene parser is exercised separately for source ranges/cast/background/dialogue; newly specified fields remain future work.
