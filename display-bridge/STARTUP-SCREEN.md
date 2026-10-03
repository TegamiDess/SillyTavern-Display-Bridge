# Reviewed startup screens

Available in Display Bridge 0.22.0. Uses the adapter-12 / scene-state-4 [setup contract](B2-SETUP.md).

A reviewed profile can put its setup form directly in a fresh chat's greeting. Users choose their settings and press **Start conversation**. This saves the chat-local variables and replaces the menu greeting with the selected text. The user then sends a message through SillyTavern normally. Start does not call a model, add a user message or change the composer.

The form uses local accessible controls and the current theme. It supports declared text, number, boolean and finite-choice fields, required values, participant uniqueness and reset policies. It adapts to the available message width. Drafts survive ordinary redraws; switching chats or reopening an unsaved menu starts from the profile defaults.

## Profile declaration

Add `screen` to `adapters[0].source.sceneState.setup`. For example, with declared setup fields `player_name` and `season`:

```json
"screen": {
  "marker": "<start>\n\nChoose your starting settings.",
  "description": "Choose your name and the season for your visit.",
  "greeting": [
    "Visitor: ", {"read": "player_name"}, "\n\n",
    {
      "when": [{"key": "season", "equals": "winter"}],
      "then": ["Snow covers the observatory garden."],
      "else": ["The observatory garden is in bloom."]
    }
  ]
}
```

- `marker` is the **entire saved first-message text**, up to 4,096 characters. Include any text following the menu token. LF and Windows CRLF are equivalent; extra words, spaces or different capitalization do not match.
- `description` is plain text, up to 512 characters; an empty string is allowed.
- `greeting` uses the bounded strings/reads/equality-AND templates described in B2. It can read only declared setup fields. Reads and conditions on unset values reject the start. Use a declared concrete value when a branch needs to represent “none.”
- Greeting templates cannot contain executable macros or native placeholders. Read the declared player-name field instead. The selected greeting must be nonempty and different from the marker.

Only the selected greeting is written to chat history; unused branches remain in the profile. Declared native variables still resolve through SillyTavern's normal prompt processing. This does not automatically translate other conditional text in an imported lorebook.

## Save and recovery behavior

The screen appears only for a single assistant greeting containing its marker, with Display Bridge and the reviewed portrait/scene adapter enabled. Group chats, independently overridden display text, pending swipes and established chats are excluded.

Start validates before writing, prevents duplicate clicks and saves the greeting, selected values and scene journal together. A failed save restores them and retains the visible draft for retry. A chat/profile switch invalidates queued actions. Requests are blocked while the state save is pending. Disabling the extension before Start restores the original native greeting DOM.

After Start, reload restores the selected greeting and values without reopening the form. **Conversation state** in extension settings remains available for deliberate rebuilds. Changing setup is allowed only in a fresh one-message chat whose generated greeting is unchanged; once conversation has begun, create a new chat to choose a different setup. Profile exports retain definitions and defaults, not the current player's selections.

## Raen trial and limits

The private Raen profile supplies all 12 reviewed fields and replaces its original `<start>` greeting with a summary of the chosen name, season, weekday, time, location and scenario. The source's additional note is included in the exact marker. All 12 fields, including participants and extra instructions, remain bound to the original prompt reads.

The Risu Start trigger also initializes effect arrays and inserts a user-role start message. Those source effects are not executed here; the explicit save-then-send workflow is the supported behavior. Original book/phone artwork, arbitrary buttons/HTML, random setup, reply choices and weather actions are not inferred from their appearance. Card authors can describe a startup using this shared contract without a card-title-specific implementation.

This supplies a reusable foundation for the planned `서큐딸` selector: finite fields and selected greeting text shared by display and model history. Automatic extraction of that card's branches, its 39-combination matrix and its conditional lorebook content are still B3 work.

## Validation

- 206 unit tests and 158 browser integration checks pass, including branch isolation, bounds, rollback, stale actions, duplicate submits, narrow layout, native DOM restoration and configured neutral CHARX export/reimport with a functioning startup screen.
- Eight original-card checks pass in a disposable ST 1.15.0 data directory: 12-field menu, incomplete-selection rejection, narrow controls, deliberate start, preservation of existing composer text, 12 resolved native prompt reads, reload persistence and definitions-only export.
- SFW settings and local requests only; no model generation was needed. The live installation and user's existing browser session were unchanged.

### Visible review follow-up, 2026-09-30

The original menu and the reviewed form were exercised in the visible in-app browser with matching SFW choices. Native ST rejected incomplete and duplicate-participant choices; keyboard Start saved only the selected greeting, preserved composer text, and survived reload. Risu retained its original book-style controls; its Start trigger was not executed.

Reset previously left obsolete validation feedback visible after clearing the relevant choices. The shared form now notifies its parent of the draft edit, clearing that feedback without committing state or changing fields configured to survive reset. The updated visible browser harness passed 158/158 checks, including the reset regression, and all 17 focused setup unit tests passed. The corrected reset behavior was also checked in the disposable native installation.

Native mouse activation remains unverified in this pass because browser DOM coordinates and displayed screenshots did not align reliably. Equal-width scene geometry, the reusable frame/header contract, original artwork themes, full-card round-trip and generated-output acceptance remain open. These checks used no headless browser or model generation.
