# Scene playability work — 0.20.0 / provider 0.9.1

The source scene family could render a neutral conversation, but the original card still depended on a context-rewriting trigger and output corrections. This update translates the reviewed context-wrapper structure into a request prompt filled from committed state. It leaves saved chat text intact. No Lua runtime or imported trigger interpreter is added.

## Changes

- The importer preserves the additional typed trigger fields and macro-reference locations needed to distinguish supported greeting state from unresolved prompt dependencies.
- Full matching of the known start/output wrapper pair enables a bounded context template. Unknown or modified instructions keep the source under review. Explicit exported profiles retain this capability on reimport.
- Source-declared cast-count and image-name corrections act only on parsed scene fields. A four-portrait correction cannot swallow a fifth portrait or ordinary prose. Missing background destinations stay visible in coverage.
- Native generation receives the committed roster template; swipes use their parent state. The request interceptor removes the greeting drawer marker from disposable assistant-message copies. It neither changes user messages nor writes chat history.
- A declared zero-cast closure permits a background-only greeting. Following narration stays outside the scene; no empty dialogue controls are shown.
- Finite music labels accept apostrophes. Single-image/offset tuples fall back instead of being mistaken for hover pairs.
- New source-only neutral fixture: `examples/scene-context-import.charx`, with its generated v10 profile alongside it.

## Validation and boundaries

Unit, browser, schema and native loopback-generation checks are recorded in the accompanying verification file. Tests cover changed instructions, unknown macros, request-copy isolation, failed swipes, finite corrections, missing assets, context/state persistence and continued music playback. No external model or production installation was used.

The original source's greeting now parses and its required roster-context wrapper converts. Remaining gaps include source asset-name mismatches, two absent background destinations, one missing badge derivation and unsupported specialized interactions. This is not a claim that every original-card feature is playable. Stage 8 acceptance has not begun.

Update both extension folders, refresh ST, and reattach/review the source to regenerate an older profile. Rebuild Conversation state after applying a changed state definition. Back up an ongoing chat before rebuilding; this recomputes supported updates in its saved messages from the declared starting values.
