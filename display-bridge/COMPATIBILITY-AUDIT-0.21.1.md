# Wider CHARX compatibility audit

Date: 2026-09-24. Baseline: Display Bridge 0.21.1 / V3 Asset Sprites 0.9.1.

This is a compatibility and dependency audit, not a security certification or a claim of live parity. Original files were read locally, embedded modules decoded as data, and discovery rerun with the current implementation and CSS parser. No imported scripts were executed, model requests sent, or cards/installations modified. Private narrative, images and full source templates are not included here.

## Conclusion

The existing cards are sufficient for the next development cycle. The strongest reusable target is **bounded startup selection, variables and conditional prompt content**, followed by **configurable startup forms and message-owned effects**. Another visual layout alone would not make these cards playable. Neither inspected card requires original Lua execution for these features.

Raen already produces a partial scene profile. The embedded-greeting card needs a startup/content compiler and a separate status-panel mapping. The typed state journal and fresh-chat startup workflow are useful foundations, but their current contracts do not directly represent either complete card.

## Current coverage

| Area | Raen | Embedded-greeting card (`서큐딸`) |
| --- | --- | --- |
| Source inventory | 23 rules; 51 trigger groups; 2,699 auxiliary images | 9 rules; 20 trigger groups; 731 auxiliary images and 2 icons |
| Automatic UI discovery | Portrait/dialogue adapter v10; partial profile requiring review | No UI profile recognized; import handoff reports unsupported |
| Scene display | Five-field background header, 0–4 portraits, normal/hover pairs, offsets, tooltip, text wrappers, date/time/location | Images can use the provider's ordinary image rules; original selector and status panels are not translated |
| Normalization | Two asset-name substitutions compiled | Two output aliases are not translated by Display Bridge |
| Startup | `<start>` menu remains unsupported | 39 conditional branches in the single first message remain unsupported |
| Prompt dependencies | Setup values read through `getvar`, plus process filters/wrappers | Greeting selection and conditional lorebook content share state |
| Ongoing actions | Choice buttons, user-message insertion, weather/effect state, random setup | Literal assignments behind named selection triggers |
| Original Lua | None found in inspected trigger effects | None found in inspected trigger effects |

The auxiliary-asset counts describe declarations, not a new full import/media-byte validation. No audio declarations were found in these two asset lists. The earlier [scene source audit](SCENE-SOURCE-AUDIT.md) remains useful historical detail; results here describe the current code.

## Embedded greetings: the actual structure

The JSON and CHARX inspected have the same first message and technical handoff. That first message is 70,182 characters: a selector marker followed by **13 scenario choices × 3 state choices = 39 distinct nonempty conditional branches**. Its conditions use equality comparisons joined by AND. The relevant manual triggers assign literal values to `shion_fm` and `shion_status`; the remaining mode triggers assign `shion_mode`.

These copies also contain 11 alternate-greeting entries: 10 nonempty and one empty. They do not replace or explain away the embedded selector; none exactly matches an extracted branch after trimming whitespace. The original observation about selection inside the first message is correct. The file copies simply also have a separate alternate-greeting list.

Selection must control both displayed text and the outgoing model context. Conditional content also occurs in the lorebook. Hiding unselected greetings with CSS would leave the prompt problem unresolved. A greeting-only conversion would likewise be incomplete.

Additional boundaries:

- Current `sceneState.startup` supports at most 16 flat choices. All 39 branches cannot be inserted unchanged. Prefer two bounded selectors with a branch lookup over a long flat menu; define limits explicitly.
- Current startup text rejects all `{{...}}`, including ordinary `{{user}}`. Supported native substitutions need an explicit policy, distinct from imported variable/condition syntax.
- Current startup initialization requires a fresh chat whose first message exactly equals the configured marker. The source first message includes every branch, so conversion needs a reviewed marker-replacement/import step and preservation of the original source for export.
- The source declares no default variables. Do not silently assume a selected scenario or state. The `shion_fm=0` free-start action has no matching conditional branch and needs a deliberate flow.
- Eleven button targets have no corresponding manual trigger in the inspected module. Several look like empty menu slots. Report them as unresolved/placeholder controls rather than inventing actions.
- Status templates with 25 and 15 named captures are a separate UI task. Successful greeting selection alone would not reproduce these panels.

## Raen: what remains

Current discovery recognizes rules 4–11 as scene presentation and rules 20/23 as bounded asset normalization. Neutral messages derived from that grammar parse with 0, 1, 2, 3 and 4 portraits. The source greeting itself contains the startup marker and does not parse as a scene.

The missing behavior is chiefly interaction and state:

- **Setup:** 24 defaults include season, weekday, time, place, participant slots, player name, scenario and custom instructions, plus runtime/effect variables. The menu has choices, reset, free-text inputs and randomization. A typed setup form is a better reusable representation than enumerating every combination as a greeting.
- **Model context:** setup values are read within prompt content. Current automatic state assembly requires a recognized roster/music source and returns early for this card. Its existing context compiler handles one reviewed wrapper family; it is not a general `getvar` implementation.
- **Reply choices:** one display rule assigns three variables while rendering, and a manual trigger extracts choices from the last character message and inserts a selected user message. Reproduce these as parsed choices and explicit user actions. Rendering must remain side-effect free.
- **Weather/effects:** source triggers maintain arrays of message indexes for rain, snow and another effect. The renderer reads those arrays per message. A single global weather flag would repaint history incorrectly. Use the branch journal with message-owned snapshots/events and defined swipe/edit/rebuild behavior.
- **Random setup:** the source calls other triggers and uses loops to avoid duplicate participants. Defer this until deterministic setup works; a bounded sampling action could reproduce the reviewed behavior without interpreting arbitrary loops.
- **Process rules:** setup/system markers and last-message wrapping affect model input. Their intended behavior needs an explicit request-time translation, not blind execution of original regex or history edits.

## Cross-cutting findings

### 1. Source handoff is insufficient for named actions

`v3-asset-sprites/display-handoff.js` preserves trigger type, conditions and selected effect fields, but omits the trigger's `comment` identifier used by these named buttons. Raen also loses fields including `sourceType`, insertion `role`, and extraction `regex`/`flags`/`result`.

Before adding action recognition, version the transport and preserve the narrowly required data under size limits. Validate complete known structures; never infer missing fields. Preserving data is not permission to execute it. Existing envelopes should request reattachment when required information is absent.

### 2. Macro reporting depends too heavily on finding a scene adapter

For the greeting card, `requiredMacros` includes `#if_pure`, but discovery returns `profile: null`, `requiresReview: false`, and no scene coverage report. The bridge still classifies the handoff as unsupported, so this is **not** an automatic successful-import claim. However, the report lacks the important reason: unresolved greeting/prompt branching.

Macro dependency reporting should run independently of the visual adapter. Report dependencies at import/setup time and in diagnostics; do not add repeated chat warnings for every skipped condition.

### 3. State is currently coupled to the portrait adapter

The bridge activates story state through an enabled `portrait-dialogue` profile. A card with ordinary images and a conditional greeting should not require an artificial VN layout just to get startup state. Specify a reusable state/startup capability and migrate existing profiles compatibly.

### 4. Large asset catalogs have two separate 2,000-name limits

Raen has 2,699 eligible auxiliary image declarations. `namedImageRule()` rejects the complete list above 2,000 names; its caller records the issue and continues. Separately, `listImages()` returns only the first 2,000 names and marks the result truncated.

These limits do **not** prove the card's other image paths fail: exact `resolveImage()` lookup does not use the truncated suggestions, scene images resolve separately, and other built-in image rules remain available. They do mean incomplete editor suggestions and loss of the extra bare-name `<img src="name">` rule. Add paged/searchable inventory and a bounded alternative for that rule; avoid creating thousands of always-mounted editor options or an unbounded regex.

## Recommended implementation order

1. **Import/reporting prerequisites.** Preserve named action identities and required fields in a versioned envelope; report greeting/prompt dependencies without a scene; address the asset-catalog limits. Acceptance: no invented action links, no false complete coverage, old imports receive useful reattachment advice, and a 2,699-name neutral catalog stays responsive.
2. **Reusable bounded startup/content support.** Define independent typed startup state and explicit finite choices, equality/AND conditions, supported native placeholders and scoped variable reads. Compile only a documented subset; reject unknown or ambiguous syntax. Apply it consistently to greetings and applicable prompt/lorebook content. Acceptance: only the selected branch enters the outbound prompt, selection persists, reset is deliberate, and reload/swipe/edit/failure paths do not change it accidentally.
3. **Embedded-greeting pilot.** Map the 13×3 selector onto that contract using neutral fixtures first. Handle missing defaults, free-start and unresolved buttons explicitly. Test prompt isolation across all 39 combinations. Treat its status panel as a separate mapping milestone; do not claim full-card parity from selector success.
4. **Raen deterministic setup and actions.** Add typed startup fields, participants and reviewed reply-choice actions; supply declared setup facts to model context. Validate the existing five-field scene renderer against the real card. Add reset and bounded randomization only after deterministic behavior is accepted.
5. **Raen message-owned effects and wider acceptance.** Add reviewed weather/effect snapshots with branch-safe history behavior. Exercise export/reimport, missing assets, ambiguous source, failed generations and large catalogs. Then request 2–3 independently authored cards that stress these new contracts.

This sequence can be released in smaller checkpoints. Full Lua, arbitrary HTML/CSS, arbitrary trigger interpretation and universal Risu parity remain separate decisions.

## Evidence and limits

Fourteen focused checks passed: matching JSON/CHARX greeting source; five neutral scene cast sizes; unsupported Raen startup; complete 39-branch extraction; 16-choice acceptance and 39-choice rejection; native-placeholder rejection; missing named-trigger identity; the no-adapter macro-reporting gap; and the large bare-name image-rule limit. Expected rejection tests confirm current boundaries, not newly implemented support. One probe initially used the wrong asset-type filter; it was corrected to include the source's `x-risu-asset` PNG/WebP declarations and rerun.

Source SHA-256 identifiers:

| Input | SHA-256 |
| --- | --- |
| Raen CHARX | `3297c0213bb4661ed7669314d841d9612bd9905beb84ec18b151072bba2e0ad9` |
| Embedded-greeting JSON | `f5075eac442de4e4dd6a05de6d907fb7319413054730eb992d779284bb162e70` |
| Embedded-greeting CHARX | `a97bf4e7835e1c11c94a0a04cacc633dc24db8fddec8d842a0a0ad73feed36f0` |

No fresh Risu/SillyTavern visual comparison, generation, full asset import or archive round trip was performed for these cards in this audit. The [0.21.1 release acceptance](../RELEASE-ACCEPTANCE.md) covers the previously supported feature set and must not be read as acceptance of these missing features.
