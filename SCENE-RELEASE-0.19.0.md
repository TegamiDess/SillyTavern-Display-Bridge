# 0.19.0 / provider 0.9.0 — automatic scene assembly

Recognized scene sources can now produce one profile containing layout, roster/defaults, finite badge changes, reviewed state updates and local music. The neutral `examples/scene-auto-import.charx` contains source rules and artwork without an embedded profile. Import it through V3, inspect coverage, and initialize Conversation state in a saved chat. See [the guide](display-bridge/SCENE-AUTO-IMPORT.md).

The source handoff preserves the required technical metadata. Generated v9/state-v2 profiles retain finite lookup and integer/case constraints; older profiles remain supported. Explicit profiles take precedence, while unresolved source greeting/prompt macros still produce review warnings. Partial assemblies remain pending. Export/reimport, reattachment and asset repair preserve supported configuration and edited mappings.

Music now belongs to the chat. Its native player sits below the chat, outside message history, and continues while a response is generated. Completed scene/state selections change its track; same-track updates preserve position. Loop starts on, with a Loop checkbox. Hide does not stop music; Pause prevents automatic resumption. Chat switches, disable and reload stop playback, and reload requires Play again. No full soundtrack is preloaded.

## Validation

- Unit suite: 167 passing checks.
- Browser integration suite: 145 passing checks, including fresh partial-import review, source-only CHARX assembly, configured round trip, repair and mapping preservation.
- Seven example profiles validate against the published JSON schema.
- Native SillyTavern 1.15.0: source-only import, explicit initialization, drawer/state persistence, local audio mapping and configured export passed.
- Native generation against a loopback stub: compiled facts appeared in the actual request; audio advanced during the in-flight request; the completed response updated score and selected a new playing track; reload preserved state and left playback paused.
- Native Hide/Show, default looping and playback outside message history verified. Browser regressions retain image, Afternoon, Community, Witchcure, streamer, Snapshot and portable-card coverage.

Testing made no external model call. No API keys or private card artwork/text are included. The production ST install was not modified; the isolated test installation was updated. No commit or push was made for this milestone.

## Limits

The inspected original To Love Ru source produces a partial profile: 16 roster entries, 13 tracks, seven update patterns and 15 badge lookups. Unresolved startup/prompt macros, an unmatched badge group and other source triggers/input-output transformations remain visibly unsupported. A successful scene render is not proof of a cleanly playable original card. General Lua/STscript, random startup and arbitrary history rewriting remain outside this release. Stage 8's full acceptance matrix is still separate.
