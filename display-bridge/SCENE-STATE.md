# Reviewed conversation state — 0.18.0

Portrait adapter **v8** adds an explicit, declarative `source.sceneState` configuration to scene-fragment profiles. It provides the reviewed foundation for stage 6: typed updates, startup selection, chat persistence and model context. It does not automatically convert original Risu triggers. Automatic source assembly is stage 7; unrepresented source dependencies remain unsupported.

## Try the neutral card

1. Update Display Bridge to 0.18.0 and keep V3 Asset Sprites 0.8.1. Reload ST and import `examples/scene-state-startup.charx` using **Import card with images and supported UI**.
2. Open Display Bridge settings → **Conversation state**. Select a starting branch and click **Initialize / rebuild scene state**. The initial marker is replaced by only that greeting. The other greeting is neither saved in the chat nor sent as conversation history.
3. Open **Guide information**. Alex starts at score 10; location follows your starting choice. River is deliberately unbound and unavailable.
4. A completed assistant response containing `<❤alex+3><MOVE_alex_Library>` adds 3 and sets Alex's location. A new scene uses the same scene syntax as the other neutral scene fixtures. Accepted update annotations are hidden in the display; the stored response is retained.
5. Refresh, revisit an earlier swipe, or inspect an older message. Each accepted branch retains its own state. No API is needed for startup or viewing; response updates require completed output. The included profile also works through the Advanced preset JSON editor.

The development stub used for QA is not included or required. A real model must be instructed to emit the configured annotations; this extension does not decide story changes for it.

## Configuration

Use [the complete fixture profile](../examples/scene-state-profile.json) as a working example. Add this field beside `format` and `sceneControls`, with adapter version 8:

```json
"sceneState": {
  "version": 1,
  "variables": {
    "score": {"type": "number", "initial": 10, "min": 0, "max": 100},
    "place": {"type": "string", "initial": "Observatory"}
  },
  "rules": [
    {"template": "<❤{entity}+{value}>", "op": "add", "targets": {"alex": "score"}},
    {"template": "<❤{entity}-{value}>", "op": "subtract", "targets": {"alex": "score"}},
    {"template": "<MOVE_{entity}_{value}>", "op": "set", "targets": {"alex": "place"}}
  ],
  "roster": [{"id": "alex", "score": "score", "location": "place"}],
  "context": {
    "title": "Current scene facts",
    "fields": [{"key": "score", "label": "Alex score"}, {"key": "place", "label": "Alex location"}]
  }
}
```

`roster.id` refers to an entity in `sceneControls.roster.entities`. Names and images belong to the profile, not the extension code. Variable IDs use stable ASCII identifiers; source aliases can contain localized names. Templates are literal text with exactly one `{entity}` and one `{value}`, separated and enclosed by literal text. They are not imported regex or executable code. Malformed, overlapping or out-of-bounds updates reject the entire message's state update. A valid free-text location assignment for an untracked character is skipped individually when every rule target is a roster-bound string location. Other valid updates still apply. The skipped tag is hidden only in the rendered display; original text is preserved. A console warning is emitted once per unknown character in the active chat, without exposing its location value. Other unknown entities (including score and relationship updates) still require review.

Types are bounded `number`, `boolean`, `string` and finite `enum`. `null` means unavailable; arithmetic cannot invent a base for an unavailable number. Strings, labels and enum values cannot contain control characters or braces. Configuration limits include 256 variables, 64 rules, 64 targets per rule, 256 annotations per message and a 200,000-character message scan.

Optional fields:

- `derive`: ordered finite lookups, such as relationship category → badge ID. A missing mapping yields unavailable. No random values or expressions are evaluated.
- `track`: an enum variable bound to IDs in `sceneControls.music.tracks`.
- `backgroundTracks`: exact scene background name → track ID or `null` for silence. These assignments occur at scene boundaries, in source order. Requires a `track` variable to persist the selection.
- `context`: only the listed plain-text facts are inserted into ST's next model request as a system context block. It is not a `getvar`/`setvar` or lorebook-macro implementation. Review these facts before enabling a profile.
- `startup`: an exact fresh-chat marker and up to 16 explicit choices, each with `id`, `label`, `text` and typed initial `values`. Selecting a different branch requires a fresh chat. Raw conditional greetings must first be converted into reviewed choices; hiding conditional text is not conversion.

Do not combine stored state with a `<scene-state>` snapshot suffix in the same response. Snapshot-only v7 profiles remain supported separately. This avoids a drawer showing a different score from the one sent to the model.

## Timing and recovery

Rendering and streaming previews never commit updates. Completed assistant output does. A cancelled or malformed response stays unresolved; swipe to an accepted response, generate a replacement, or review the text and explicitly rebuild. A replacement swipe uses its parent's facts, not the discarded response's increment. Rerenders do not apply increments again. Multiple scenes within a message use their source-position state; the final scene shows the final accepted state.

Editing an accepted message invalidates its state and dependent later messages. **Initialize / rebuild scene state** deliberately replays the current active history from profile defaults and the saved startup choice. It does not merge abandoned swipes or undo narrative changes. Changed state configuration, copied chat ownership, corrupt saved metadata and journal limits also require review/rebuild. Unresolved state blocks ordinary generation through ST's stop-generation API; compatibility/settings identify the issue. No original Risu script runs as a fallback.

The journal is saved in ST chat metadata (`display_bridge_story`), with stable IDs on messages. It includes accepted source text and branch ancestry, bounded to 2,048 revisions and 8,000,000 serialized characters. It therefore increases chat-file size; it is private chat data, not telemetry. It is excluded from ordinary profile and configured-card exports. Exports carry profile defaults and startup choices, never the current chat's totals. View preference reset is separate from story-state rebuild.

Music needs an initial user Play action. Within a state-enabled chat, configured track changes can then continue playback on the latest completed scene. Pause cancels that intent; hiding controls does not. Card/chat changes, disabling the bridge and reload stop playback. If the browser refuses an automatic transition, use Play again. Audio is still one local native player; no soundtrack is preloaded.

## Explicit exclusions

This release does not translate arbitrary Risu conditions, `getvar`/`setvar`, lorebook macros, random/weather startup generation, recency expressions, context-copy/history-edit triggers, Lua or STscript. It supports the bounded operations above through an explicit profile. The source audit's second family's complex startup and history mutations remain unresolved; those cards must not be reported as clean working imports. Source recognition, conversion coverage and complete-card acceptance remain later gates.

## 0.19.0 update

[Automatic scene import](SCENE-AUTO-IMPORT.md) now generates v9/state-v2 profiles for recognized source structures. The v8 foundation described above remains supported. Music playback is chat-owned and continues during generation; source conversion limitations remain explicit.
