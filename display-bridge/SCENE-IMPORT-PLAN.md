# Plan: clean import of To Love Ru-style scene cards

Planning baseline: Display Bridge 0.15.1 / V3 Asset Sprites 0.7.1. This document proposes work; it does not claim the features below have been implemented. Desktop is the primary target.

Stages 1–2 completed as an audit/design milestone on 2026-09-23: [source dependency audit](SCENE-SOURCE-AUDIT.md), [scene/state contract](SCENE-STATE-CONTRACT.md), neutral four-/five-field fixtures and 15 test-only contract checks. Stage 3's reviewed standard-scene presentation is now implemented in 0.16.0: captured background layers, bounded cast offsets, tooltips, scene labels and safe rich text. See [the supported subset and remaining exclusions](SCENE-ASSEMBLY.md). Specialized source poses, dynamic weather/state, recency conditions and source-wide CSS fidelity remain outside this milestone; the state reference tests are still design-only.

Stages 4–5 presentation/media components are implemented in 0.17.0 / provider 0.8.0 through explicit v7 profiles and complete per-scene snapshots. The drawer and local player do not evaluate the original Risu state or music scripts. Stage 6 supplies those dependencies; stage 7 assembles automatic configuration. See [scene controls](SCENE-CONTROLS.md).

Stage 6's reviewed explicit-profile foundation is implemented in 0.18.0: typed literal updates, selected startup branches, revision-owned chat persistence, model-visible facts, and state-driven local music continuity after Play. Native ST request/swipe/streaming checks supplement the neutral contract tests. This does not close every original source dependency: macro translation, random startup and history-edit triggers remain unsupported. See [conversation state](SCENE-STATE.md).

## Intended result

Import a supported source CHARX through the extension, complete the ordinary permission/review prompts, and start using its scene UI without hand-editing a profile, repairing asset paths, removing macro fragments, or manually disabling required lorebook entries. A missing or unsupported dependency must be identified accurately; a working picture alone is not a clean import.

The target is a reusable scene family: location-dependent backgrounds, multiple portraits with hover alternatives, compact/expanded/collapsed dialogue, a character-information drawer, and music controls. Card names, character names, artwork names, and narrative content belong in imported configuration. Recognition should continue to depend on supported source structure or an explicit profile.

Configured exports should retain their supported behavior when imported into a fresh ST installation. Preserve original Risu metadata where available; there is no requirement to generate Risu scripts from a Display Bridge profile.

## What already exists

- Source-rule inspection and a versioned profile/importer handoff.
- Four-/five-field scene fragments; zero to four portraits; per-portrait hover alternatives and stable alpha-based hit testing.
- Local scene backgrounds, basic scene status, translucent dialogue with expand/collapse, one shared control bar on the newest assistant message, image mappings and appearance options.
- Presentation preferences, character/chat isolation, replacement and asset-collision recovery.
- Configured CHARX export with images/profile/rule definitions and corrected Risu asset types. The user has confirmed clean Risu image import after the 0.15.1 patch.
- Performance and Snapshot work that must remain covered by regression tests.

Remaining gaps include source state/recency expressions, specialized scene forms, dynamic weather, automatic drawer/music configuration, and conditional startup behavior. Current scene support is documented in SCENE-ASSEMBLY.md.

Technical inspection of the supplied To Love Ru module found 76 regex entries and 28 trigger groups, including structured variable, condition, random, message-read and chat-modification operations. Counts include entries that may be disabled or irrelevant. These are evidence for a dependency audit, not a claim that all operations need implementation. This module's trigger effect list does not establish a need for a Lua interpreter.

## Ordered stages

| Stage | Difficulty | Depends on | Deliverable |
| --- | --- | --- | --- |
| 1. Trace the source and build representative fixtures | 4/10 | Existing importer | A feature/dependency inventory and neutral reproductions of the real formats |
| 2. Define scene data and state ownership | 8/10 | 1 | A typed, versioned contract for visible values and supported updates |
| 3. Complete the scene presentation | 6/10 | 1–2 | Backgrounds, cast, text and controls behave correctly across supported scene forms |
| 4. Add a reusable character-information drawer | 6/10 | 2–3 | Working roster/location/relationship display and navigation |
| 5. Add local audio import and playback | 5/10 | 1–2 | Music assets, selection, playback lifecycle and portable export |
| 6. Close required startup and conversation dependencies | 9/10 | 1–2; integrate with 3–5 | Supported conditions/updates work without leaving broken macros or misleading state |
| 7. Assemble automatic import and configuration | 5/10 | 3–6 | A single import produces the complete supported profile and useful coverage report |
| 8. Run release acceptance | 7/10 | 7 | Repeatable evidence on clean installations, larger cards and source variants |

Difficulty estimates describe complexity and risk, not elapsed-time promises. Tests accompany every stage; stage 8 is the final combined gate.

### 1. Trace the actual dependencies

Inspect technical rule/trigger definitions, initial values, UI templates, greeting conditions, asset declarations and any lorebook variable references needed by this scene family. Record each visible field's source and every operation that can change it. Separate inactive rules, display-only controls, source normalization, story state and prompt-affecting behavior.

Build neutral fixtures that preserve the technical formats: first load, empty cast, one through four characters, changing location, hover alternatives, opening the information drawer, changing music and any specialized scene forms actually found. Reuse a second independently authored scene-family example to expose accidental hard-coding. Keep private card text/artwork out of distributable fixtures.

Exit: every required feature has an identified input and dependency, or an explicitly unresolved question. Do not infer source semantics from screenshots alone.

### 2. Define scene data and state ownership first

Extend the existing profile/parser/action boundaries rather than adding card-specific event handlers. Distinguish configuration, saved presentation preferences, values captured from a message, and story values that affect future responses. Define initialization, scope, defaults, validation, update timing and precedence for each supported field.

Prefer reading a complete status snapshot already emitted by the card. Where the source genuinely depends on stored state, define the smallest reviewed conversion needed. Affection/location values must never be fabricated to fill a drawer. A UI toggle must not become a story variable by accident.

Resolve swipe/edit/regeneration semantics before arithmetic updates: rerendering cannot apply an increment twice; an abandoned swipe cannot overwrite the active branch; historical messages cannot display future state. Specify persistence and migration separately for chat state and exported profile defaults. Keep chat runtime state out of ordinary distribution exports.

Exit: neutral event sequences produce deterministic scene data through streaming, completion, failed generation, swipe, edit, reload and chat switching. Any required model-visible variable behavior is explicitly assigned to stage 6.

### 3. Complete scene presentation

Extend existing scene assembly to the supported variants identified in stage 1. Add bounded cast positioning/size and tooltip bindings where the original fields have a known meaning. Support the necessary main/secondary backgrounds, tint/effect layers and scene identifiers through reviewed fields, with image mapping for every role.

Preserve the compact translucent text panel, expanded and collapsed modes, desktop hover behavior and shared controls. Add safe supported rich-text formatting inside scene dialogue so ordinary emphasis and paragraphs do not appear as raw markup. Keep unknown/incomplete source readable; never discard a fragment merely to make the panel look finished.

Scope the default presentation to the scene. If full-page backgrounds are needed for fidelity, define their precedence over ST themes and restore the prior background on card switch/disable. Do not leak a card's styles into ST menus.

Exit: representative scenes match their intended behavior, with no stale cast/background, text loss, hover range regression or premature replacement while streaming.

### 4. Character-information drawer

Build a generic scrollable drawer configured by the card: character identity, portrait, location, relationship/affection values, labels and supported badges. Use the scene data contract from stage 2, not a second variable store. Implement open/close, focus/keyboard handling and the intended current-scene versus historical-scene behavior.

Missing values should be shown as unavailable or omitted according to the profile, never as invented zeroes. Asset names and labels remain configuration. Reuse existing mapping and compatibility reporting.

Exit: updates, opening/closing, character changes, reload and older-message viewing all show the correct data without affecting conversation text.

### 5. Audio and its asset lifecycle

Extend the image-only provider contract to support the required local audio assets explicitly. Include file validation, name/type mapping, collision/recovery behavior, portable CHARX packaging and missing/unsupported-format reporting. Avoid an isolated audio loader that bypasses the existing asset ownership model.

Use native browser audio controls plus Hide/Show. Derive track selection from scene/background changes through the source adapter, without a manual track dropdown. Hide/Show controls visibility while Pause stops the sound. Respect browser playback permission when implementing automatic transitions. Define whether hiding the player affects playback based on the source contract. User-initiated playback must work when automatic playback is unavailable. Stop or transfer playback deliberately on scene/chat/character changes; never leave multiple invisible players running.

Exit: one intended playback owner, no playback restart on routine redraw, no unnecessary preloading of a whole soundtrack, and audio survives export/import without duplicate files. Snapshot captures the control's visual state, not playable sound.

### 6. Required startup and conversation behavior

Use stage 1's dependency list to handle only the source normalization, conditions and structured state operations actually needed by the supported family. Where feasible, translate reviewed operations into declarative behavior. Do not assume every trigger requires arbitrary script execution.

This stage includes initial-state setup, display conditions and any selected-greeting flow required by these cards. If one greeting contains multiple conditional branches, establish which text is displayed, saved and sent to the model; hiding unused branches visually is insufficient. Do not undertake a universal greeting engine unless the chosen family requires it.

If required values are read by prompts or lorebooks, define and test an explicit model-context connection. The existing presentation-state engine does not supply this automatically. Preview the assembled request locally with a stubbed generation endpoint; live model/API credentials are not required to verify which text and values would be sent. Original chat edits, random updates and message-reading effects need equivalent timing/branch semantics before being labeled supported.

If a necessary dependency cannot be represented by the reviewed subset, record the exact gap and decide separately whether a bounded script runtime is justified. Lua and general STscript remain deferred unless that decision is made. A card missing such a dependency may be labeled a presentation preview, but not a complete working import.

Exit: the supported fixture family starts correctly and keeps visible state and model-visible content consistent without manual deletion of required lorebook entries or raw variable syntax leaking through.

### 7. Automatic import and portable configuration

Recognize the compatible source group and generate its combined profile: scenes, drawer, media and supported state bindings. Preserve explicit-profile precedence and existing mapping edits. Report support by behavior (for example, scene ready, music missing, required state unsupported) rather than hiding failures behind one successful panel.

Make ambiguous mappings reviewable in the existing editor. Add profile versioning/migrations and conservative handling of older extensions. Update export, recovery and replacement together so a newly imported feature is not lost on the next round trip. Broader native drag/drop support remains a separate convenience milestone; the existing extension import route is sufficient for this goal.

Exit: import one source CHARX through the supported route, review it, and use all declared supported features without editing JSON. A configured re-export reproduces the result on another installation.

### 8. Release acceptance

Test source-only import and configured reimport in isolated ST, with neutral equivalents of all required interactions. Cover repeated import, duplicate names, missing/ambiguous assets, replacement/restore, extension upgrades, reload, chat/character switches, edited messages, swipes, failed generation and streaming. Retain Afternoon, Community, Witchcure, basic image and Snapshot regressions.

Exercise a realistic large gallery, long chat, several simultaneous scenes and media. Compare idle, scrolling and normal ST menu interactions to the existing performance baseline. Parse changed messages only, reuse asset indexes, bound hover-mask/media caches and keep closed drawers/settings inexpensive; do not add whole-gallery work to pointer movement or scrolling.

Publish the tested support envelope and a short user checklist. A neutral demonstration proves the mechanism; final acceptance of the original card also needs a user-side check of the real prompts/assets and source-specific behavior. Risu asset round trips remain a packaging check, not a requirement to implement reverse UI conversion.

## Dependencies and likely regressions

- Doing the drawer before state ownership would produce a convincing but potentially stale panel. Stage 2 precedes both drawer work and story updates.
- Adding more triggers without swipe/branch rules risks duplicate updates or history contamination. State transition tests are a prerequisite, not final cleanup.
- Audio needs provider/import/export/recovery support together; otherwise it works locally and disappears when shared.
- Rich text and new scene syntax can change parsing boundaries. Preserve surrounding prose and test incomplete streamed fragments before widening recognition.
- New profile fields require validation, editor, export and migration changes in the same milestone. Existing profiles must continue to load.
- Broader source recognition should follow tested rendering/state contracts; importing an uncertain pattern early can silently misidentify capture roles.
- Default thumbnail/hover behavior must continue to defer to scene-owned portraits. Snapshot must preserve new overlays without copying live playback or changing live chat.

## Suggested release checkpoints

1. **Scene preview:** stages 1–3. Useful original-format import with backgrounds/cast/dialogue and an honest list of missing dependencies.
2. **Interactive scene preview:** stages 4–5 plus tested stage-2 state reads. Drawer and music are usable; incomplete story/startup behavior remains explicitly marked.
3. **Clean supported-family import:** required stage-6 behavior, automatic assembly and release acceptance complete. This is the point to advertise a clean import for the tested source family.

The 0.18.0 stage-6 milestone supplies reviewed explicit state/startup configuration and a tested model-context connection. Automatic source conversion is still absent. Before claiming a clean import, stage 7 must map the supported source subset and report every missing dependency; unsupported random, history-edit and conditional macro behavior cannot be marked ready. See SCENE-STATE.md for the exact support envelope.

## Stage 7 checkpoint — 0.19.0

Recognized source layout, roster/defaults, finite badges, assignments and music are assembled together, with per-feature coverage and explicit-profile precedence. Source-only import and configured round trips have dedicated tests. Original sources with unresolved startup/prompt macros or unknown triggers remain partial and require review. Chat-owned looping audio continues during generation. See [automatic import](SCENE-AUTO-IMPORT.md). Stage 8 was completed for the documented experimental scope in 0.21.1 / provider 0.9.1. See the [combined acceptance matrix](../RELEASE-ACCEPTANCE.md) for fresh clean-profile tests, carried-forward live evidence and the original-card user checklist. Unsupported original-card dependencies remain open.
