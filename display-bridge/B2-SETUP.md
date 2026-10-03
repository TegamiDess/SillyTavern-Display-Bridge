# Conversation setup and native prompt variables

Available in Display Bridge 0.22.0 / V3 Asset Sprites 0.10.0. It does not make arbitrary Risu programs executable or complete Raen's interactive features.

## What works

- The importer handoff now identifies `actionSourceVersion: 1` and preserves bounded action names plus variable/literal, input, message-role and regex-extraction metadata. This remains inert data. Older saved handoffs need reattachment before preparing setup from source actions.
- Required greeting/prompt macros are reported even without a recognized scene adapter, and when an unrelated explicit profile is supplied.
- Reviewed scene profiles can declare a setup form with typed defaults, finite choices, bounded text, required/unset policies, uniqueness groups and per-field reset behavior.
- Initialization saves the selected values in the existing chat-owned journal. Fields marked `native` also populate explicitly named ST chat-local variables, allowing native `{{getvar::key}}` reads in descriptions, system prompts and activated lorebook entries. This happens before native prompt assembly. The description, lorebook and saved message text are not rewritten.
- Existing native variable names are not overwritten on first initialization. Subsequent external changes to owned values are detected and reject generation/rebuild. Prompt interception supplies a second abort check if the host catches an earlier event error.
- Reload and rebuild use the committed selection. Changing it requires a fresh chat; ordinary redraw, a failed swipe or cancellation cannot choose new setup values.
- Profile export carries definitions/defaults, not selected values or chat history. The mapping editor preserves the setup definition in its JSON draft.

Native bindings are deliberately saved chat data. Disabling the extension does not delete those values. They remain readable by ST in that chat. The bridge does not write global variables. Resolve a variable conflict deliberately rather than expecting the extension to replace another script's data.

## Using a reviewed profile

1. Import and apply a profile containing the setup definition, using the current release. Older releases reject adapter version 12.
2. Open **Display Bridge → Conversation state** in a fresh saved single-character chat.
3. Fill the setup fields. **Reset setup fields** changes the form draft only and respects each field's reset policy.
4. Click **Initialize / rebuild scene state**. This saves the selection; it does not send a message. Then begin the conversation normally.
5. Rebuild later to replay accepted messages with the same selection. Use a fresh chat for a different setup.

Original startup buttons, reply choices, randomization, historical weather and other source actions remain separate work. A setup form is not evidence that those actions were translated.

## Profile contract

The outer profile remains schema version 1. These fields require portrait-dialogue **adapter version 12** and `sceneState.version: 4`. Older scene-state/profile versions retain their existing behavior. Setup cannot be combined with legacy startup branches, the legacy source-request wrapper or the legacy context declaration; use `setup.context` for its template.

Example `sceneState` for an existing scene-fragments profile:

```json
{
  "version": 4,
  "variables": {
    "season": {"type": "enum", "initial": "unselected", "values": ["unselected", "spring", "winter"]},
    "player_name": {"type": "string", "initial": "Visitor", "maxLength": 100}
  },
  "rules": [],
  "setup": {
    "version": 1,
    "title": "Conversation setup",
    "fields": [
      {"key": "season", "label": "Season", "required": true, "unset": ["unselected"], "reset": true, "native": true},
      {"key": "player_name", "label": "Player name", "required": true, "unset": [], "reset": false, "native": true}
    ],
    "unique": [],
    "context": [
      "Welcome, {{user}}. ",
      {"read": "player_name"},
      {"when": [{"key": "season", "equals": "winter"}], "then": [" Bring a coat."], "else": [" Enjoy your visit."]}
    ]
  }
}
```

`native: true` explicitly reserves that key in the current chat's native variable table. Strings that ST would silently change through numeric coercion (for example `001`) are rejected for native binding. Values cannot contain macro delimiters. A literal value such as `{{user}}` belongs in a context template, not a setup input; ST resolves the permitted `{{user}}` and `{{char}}` template placeholders.

Use `unique: [["participant_1", "participant_2", "participant_3", "participant_4"]]` for declared participant fields. Their explicitly unset values do not count as duplicates. Setup values cannot also be targets of model-output rules, literal updates or derived writes.

Context conditions are explicit JSON, not evaluated source expressions. `when` contains one or more typed equality tests combined with AND. Each branch is an array of strings, variable reads or further conditions. An unset condition is an error, not an implicit false branch. Only the selected branch enters the generated extension context.

Limits: 32 fields; existing variable limits apply; text fields may declare `maxLength` up to 4,096; at most eight uniqueness groups of up to eight fields. Context templates allow eight nesting levels, 256 nodes and 12,000 literal characters; rendered context is capped at 30,000 characters. Unknown fields, variables, operations and wrong types reject the definition.

## Preparing a source-based candidate

An optional reviewed `setup.screen` now places these fields in the first greeting and saves only the selected greeting on Start. See [Startup screens](STARTUP-SCREEN.md) for the schema, deliberate save-then-send workflow, recovery behavior and current native validation.

The development helper `buildSetupCandidate(source, options)` in [scene-setup-candidate.js](adapters/scene-setup-candidate.js) collects declared prompt reads, literal defaults, literal assignment choices and explicit text-input targets. It requires the new handoff metadata and returns `requiresReview: true`.

This helper does not infer conditional action semantics or execute loops. Review `unset`, `required`, `unique`, `preserveOnReset` and `labels` explicitly before importing its state definition into a profile. Fresh ordinary discovery still reports an unsupported startup until a reviewed profile supplies the binding. Unsupported source `#if`/`#if_pure` blocks remain reported; the JSON conditional contract above does not claim automatic translation of arbitrary conditional lorebook content.

## Verification and remaining acceptance

- **199 unit tests passed**, including setup type/bounds validation, equality/AND selection, unset handling, uniqueness, transport metadata, collision detection, native coercion, save rollback, failed swipe, reload and profile round-trip tests.
- **154 browser integration checks passed** in an isolated headless Edge process against the neutral harness, including form draft/reset behavior, initialization through the settings button and configured CHARX export/reimport through the provider transport. The neutral setup family retains its profile defaults and exact media bytes without exporting the live selection.
- The original private technical source produced a validated 12-field candidate. All 12 original description reads resolved through ST's local variable getter in an isolated test. No original narrative was sent to a model.
- A fresh ST 1.15.0 data directory imported a neutral card using those same 12 field declarations. Actual chat-completion prompt assembly in dry-run mode included all values and an activated neutral lorebook entry. Native `{{user}}` remained ST-owned. Saving, reloading and reopening the chat preserved the setup.
- No remote generation, live-installation deployment or GitHub publication occurred. The normal shared test data and installed extensions were unchanged; the native test used a separate disposable data directory.