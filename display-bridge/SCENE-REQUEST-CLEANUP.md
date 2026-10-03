# Outgoing scene cleanup

Enable **Display Bridge → Set up portrait and dialogue → Scene history and
motion → Clean older scenes in outgoing prompts**, review, then apply the
imported UI profile. This is an explicit per-card choice, exported with the
profile as portrait adapter **19**. Discovery never turns it on automatically.
Adapter versions 15–17 remain reserved for the separate optional audio work.

With maximum depth `3`, scenes at depths 0–3 retain their source format. When
four or more later messages exist, recognized assistant scenes are converted
to readable prose in the outgoing request copy. User and hidden system entries
count toward depth; they are not rewritten. A swipe's discarded target does
not count. Unlimited display history cannot be combined with outgoing cleanup.

Recognized scene wrappers, image references, cast-layout fields and dialogue
tags are removed. Dialogue, narration, plain-text inline content, Unicode and
speaker labels remain. Labels use the speaker palette's display name when
available, otherwise the original tag. Explicit date/day/time/location fields
become a compact `[Scene — …]` line. Background filenames are not guessed into
location names. Structured state snapshots and prose outside recognized scenes
remain verbatim; normal conversation-state processing remains separate.

Saved messages, swipe alternatives and display text are never rewritten.
Recent scene markup stays available as a formatting example. Existing
latest-user context append runs after cleanup, once per request. If its state
validation fails, generation aborts without partially committing the cleaned
request. Requests that cannot be matched reliably to saved history are left
unchanged.

This is bounded scene parsing, not general HTML stripping. Unrecognized special
portrait formats, malformed scenes, fenced/inline code, escaped examples and
unrelated markup remain unchanged. Thus the option does not promise to remove
every HTML-like tag anywhere in a prompt. Character instructions, world info,
examples and other extensions' later additions are outside its scope.

## Preview and verification

**Display Bridge → Outgoing scene cleanup preview → Preview older-scene
cleanup** shows counts and the first changed message before/after. It sends
nothing. Counts are characters, not model tokens. This preview simulates a
normal request's scene cleanup, excluding other prompt processing and context
append. Each sample is capped at 50,000 displayed characters; actual cleanup
does not use that display cap.

Validation on 2026-10-03: 228 unit tests and 14 visible-browser checks passed.
Coverage includes depth boundaries, filtered history, swipes, repeated passes,
speaker preservation, portable profiles, opt-in settings, live-history guards,
context append composition, atomic failures, and the read-only preview. The
native isolated To Love Ru preview cleaned three scenes in two older messages,
removing 1,018 characters with no unsupported/unmatched entries. No model or
provider request was sent. Native dry-run token counts skip generation
interceptors, so they are not proof of the final cleaned request's token cost.

The reviewed [single-image layout](SINGLE-IMAGE-LAYOUT.md) is also cleaned when
declared by the card. Other unrecognized specialized formats remain intact.
