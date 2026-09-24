# Scene-family dependency audit — stages 1–2

Audited 2026-09-23 against the supplied To Love Ru CHARX (family A) and independently authored Raen CHARX (family B), their embedded modules, card defaults, greetings, prompt fields, lorebooks and technical HTML/CSS. Runtime baseline: Display Bridge 0.15.1 / V3 Asset Sprites 0.7.1. **This is a design audit, not a new supported-card claim.** Original narrative, artwork, full templates and archives are not distributed here.

Rule and trigger references below are one-based positions in the decoded module. They are audit references, not identifiers the importer should hard-code.

## Inventory and provenance

| Inventory | Family A | Family B |
| --- | --- | --- |
| Rules | 76: 37 display, 22 output, 1 process, 2 empty input, 14 disabled | 23: 17 display, 3 output, 3 process |
| Trigger groups | 28: 10 manual, 2 start, 16 output | 51: 49 manual, 2 output |
| Embedded asset declarations, excluding main icon | 600 images, 83 MP3 | 2,699 images |
| Card / module lorebook entries | 31 / 31 | 7 / 7 |
| Lua/code trigger effects | None found | None found |
| Technical extract SHA-256 | `d7322ff21274a6b3fa2dcb4f9561a076899c851da12e3ad71bb1fbe2935c1d72` | `3b2c5e0e1082c2e166c296ea4df46161dc65a65c25c395df829d40a2eb5feaa4` |

Hashes identify the local technical JSON extracts, not the complete archives. Counts are declarations, not proof that every asset is used. The existing module decoder intentionally returns rules/triggers but omits module lorebook duplicates; the audit also inspected the full decoded payload. Neither card nor module lorebook contained `getvar` reads in these samples. That does **not** mean either card is independent of model-visible state.

## Family A: dependency map

| Feature | Evidence / inputs | Dependencies and disposition |
| --- | --- | --- |
| Main scene and time | Rules 5–6: optional scene label plus background, sky, effect, time | Existing parser keeps background/time. Add label, sky/effect and reviewed period styling in stage 3. Sky and effect are separate layers; the source's page-spanning decoration needs an explicit scene-local approximation or separately reviewed page-background mode. |
| Recency | Rules 5–16 compare message index with last message index minus `remove`; default `remove=3` | This is a message-index window, not “last three scenes.” Preserve as explicit visibility policy; do not use it to erase message data or recompute story state. Greeting/index offsets need source-side acceptance. |
| Cast 0–4 | Rules 8, 11–14: normal/hover image pairs and four `ct` values | `ct[0]` is CSS `top`; remaining three are tooltip text. They are **not** speaker names or numerical stats. Existing parser discards all `ct` fields. Stage 3 needs bounded offsets and text tooltips. |
| Specialized one-portrait forms | Rules 9–10 precede generic cast rules | Separate clipped/single-image presentation and a dynamic trigger target. Do not silently classify as a normal hover pair. Generic neutral fixtures preserve this structural distinction; automatic support remains unresolved until stage 3/6. |
| Dialogue | Rules 15–17: numbered controls, collapse state, text wrappers | Plaintext currently works. Add bounded rich-text runs, scoped IDs and explicit widget state. `textcheck` is reset by start trigger 10; it is not a durable story variable. |
| Information drawer | Rule 1 on `&&&`; duplicate disabled rule 2; rule 55 removes remaining marker | Sixteen configured cards read per-entity score (`_p`), location (`_loc`), relationship (`_r`), badge class (`_ap`) and icon suffix (`_as`). Drawer opening uses a checkbox; it does not write story values. Stage 4 must consume a snapshot and finite badge/icon lookup tables. |
| Drawer updates | Rules 25, 27–30, 33–34; triggers 14–28 | Relationship assignment, score increments/decrements, location assignment; 15 output triggers derive badge/icon from five relationship categories. Rule 26/31/32 reads score for display. Source defaults exist; absent or invalid values stay unknown. Never substitute zero. |
| Music | Rules 19–21 set track; manual trigger 13 toggles `bgm_on`; background HTML gates audio macros | Thirteen fixed music choices in the template, three additional sound choices and one dynamic voice expression; 83 MP3 declarations include more than BGM. The music toggle removes the audio branch, so disabling must stop playback, not leave invisible sound playing. Track selection and playback permission are separate. Stage 5. |
| Additional sound interactions | Dynamic handler in rule 10 reaches manual triggers 2–9 for matching entities | Conditional variable writes, random choices and wait. These are reachable, not dead code. They are outside the basic BGM/display milestone; classify as unsupported interaction until separately mapped. Do not import arbitrary dynamic handler names. |
| Greeting / prompt context | Greeting and alternatives read `fm`; defaults contain `fm`, `Ta`, `Tb`; start trigger 11 and output trigger 12 | Trigger 11 reads messages, removes/replaces old marked wrappers, and wraps the current user text with a marker and current roster summary. Output trigger 12 tracks message count/user text and clears initial marker state. This changes model-visible context even though the lorebook lacks `getvar`. Stage 6 must reproduce the required context explicitly, without destructively copying the original history-edit loop. |
| Normalization | Rules 4, 7, 38–53, 60–69 | Background aliases, count correction, named offset tokens and image-name spelling substitutions. These are source-specific mappings, not universal rules. Resolve against the imported registry and report ambiguity; never guess a different picture. |
| Cleanup / non-runtime entries | 3, 18, 24, 36, 54, 59, 72, 74 disabled separators; other disabled entries 2, 22–23, 37, 70–71; empty input 75–76; trigger 1 empty header | Retain provenance; no execution needed. Rules 55–58 hide display markers; rule 73 removes the drawer marker from processed context. Do not hide dependency-bearing markers until their behavior is handled. |

Most flags default to global; rule 34 explicitly enables case-insensitive global matching. Disabled rule 37 does too. Recognition must inspect effective flags, not just the regex text.

### Source inconsistencies to preserve/report

- The roster covers sixteen entries but badge derivation has fifteen trigger groups. Do not invent a missing update trigger; a configured fallback can preserve a declared initial icon while reporting incomplete derivation.
- Track-setting rules accept some codes with no corresponding BGM branch in the inspected background template. Resolve only declared track bindings; report unsupported/missing track rather than selecting a nearby number.
- Initial `???` locations are unknown, not a literal destination. Some defaults and alias lists are not perfectly symmetric. Exact imported identity mapping is required.
- Dynamic handler names prevent a complete call graph from literal-name matching alone. The basic music toggle is one literal handler; the specialized portrait is a separate dynamic family.

## Family B: what prevents a family-A-only design

| Feature | Evidence | Consequence |
| --- | --- | --- |
| Five-field header | Rule 4: label, background, period, date, time, location | Its second field is a period enum, not a sky asset. Never infer meaning from tuple length alone. |
| Two-field cast metadata | Rules 6–9: offset plus one tooltip | Same image-pair behavior, different metadata arity. Stage 3 needs explicit field-role mappings. |
| Per-message effects | Rule 4 reads three arrays of message indexes; triggers 47–50 handle weather history | Store effects on the committed message revision. A current global weather flag must not repaint historical scenes. Repeated output events must not append duplicate entries. |
| Startup settings | Rules 12–13 and triggers 2–44 | Start marker expands settings for season/day/time/place/participants/scenario; default/reset/random choice and input dialogs feed stored variables. Forty-seven literal UI handler names resolve to manual trigger groups. Trigger 4 also calls other triggers. |
| Prompt dependence | Description reads twelve setup variables; process rules 14–16 filter/wrap context | A fully functional setup screen requires stage-6 context binding; simply rendering the selected labels is insufficient. |
| Start/choice buttons | Triggers 2 and 45–49 include message insertion, selections, message reads and array updates | Not presentation-only. Explicit actions must identify whether they change conversation/model state. No automatic conversion to arbitrary ST commands. |
| Loops | Trigger 41 includes three loops to arrange participant slots | Convert the reviewed behavior into a bounded operation if needed; no generic loop evaluator in the scene contract. |
| Choice formatting / other rules | Rule 2 writes choice variables during display; rule 3 supplies a system panel; 17–23 do cleanup/normalization | Render must remain pure. Capture choices once from an identified source revision, or report unsupported; never run imported display-side writes during redraw. |

Neither sample demonstrates that a generic Lua runtime is needed for the basic scene family. Both demonstrate that **clean import requires more than CSS**. Bounded assignments, deltas, finite derivations and message-owned effects are suitable candidates; arbitrary history edits, nested dynamic macros, message insertion and model-context reconstruction remain stage-6 work.

## Semantics verified and remaining questions

Primary Risu source inspected on the audit date: [trigger implementation](https://github.com/kwaroran/RisuAI/blob/main/src/ts/process/triggers.ts), [rule processing](https://github.com/kwaroran/RisuAI/blob/main/src/ts/process/scripts.ts), [generation flow](https://github.com/kwaroran/RisuAI/blob/main/src/ts/process/index.svelte.ts). These are moving upstream references, not a pinned copy of the user's Risu version.

The source distinguishes named/manual triggers from event triggers; `start` runs during request preparation, not merely when a card opens. `v2ModifyChat` writes message data. Output triggers run after response processing. Rules are processed by mode, with optional ordering directives and macro parsing. The Bridge must not treat redraw or a generation-ended notification alone as proof of a successful output transaction.

Still required before claiming source equivalence: verify the user's Risu version's greeting/index convention; match normalization/macro ordering on saved and streamed output; establish intended fallback for the source inconsistencies above; compare specialized poses/tooltip placement against a source render; verify audio macro playback defaults and the selected ST request hook. These are named acceptance gates, not reasons to block scene presentation work.

## Deliverables and next implementation boundary

- [Scene/state contract](SCENE-STATE-CONTRACT.md): design version 1, separate from the existing portable profile schema.
- `tests/fixtures/scene-contract-fixtures.js`: neutral four-/five-field source cases, metadata expectations, drawer and track inputs, special/unknown cases.
- `tests/support/scene-state-reference.js` and `tests/scene-state-contract.test.js`: test-only transaction model and lifecycle cases. They do not load cards, run imported scripts, save ST data or implement the future renderer.

Stage 3 can now implement typed scene labels/layers/periods, offset and tooltip mappings, and rich dialogue. Stage 4 must use revision-owned state; stage 5 needs typed audio assets; stage 6 owns updates and prompt integration. No production profile version, runtime behavior or release version changes in stages 1–2.
