# Presentation presets in 0.11.0

The primary new source family is the common portrait-behind-dialogue layout: separate quoted character tags, fixed speaker/portrait bindings, narration tags and optional time/day/date/location blocks. Recognition uses bounded grammar and template roles, not author or character names. Several speakers combine into one portable preset and share one control bar at the bottom of the latest assistant message. Imported HTML, CSS and scripts are never installed or executed by this preset.

## Source recognition

- Quoted literal tags such as `<guide>"Hello"</guide>`, with a single dialogue capture and fixed speaker/portrait bindings in the reviewed nested template structure.
- Portrait-name tags such as `<Smile.1>Hello</Smile.1>`, using a fixed speaker. The closing tag must match; the source's permissive mismatched closing behavior is deliberately unsupported.
- Narration tags with reviewed text-only nesting, including the whitespace-tolerant tag grammar.
- Four ordered status captures (time, day, date, location) using the reviewed status-field class structure.
- The explicit twelve-capture Community profile input. Double straight quotes are required around its image name; the eleven text fields are rendered in a native-theme notice layout.
- Reviewed last-message recency wrappers on tagged blocks. Code examples, escaped starts and overlapping panels are not claimed.

Unknown flags, executable attributes in dialogue templates, extra nesting/behaviors, conflicting bindings and mixed source families remain unsupported. Compatibility describes each translated rule and each excluded rule/effect. An explicit profile takes precedence over source recognition.

## Portable formats

Existing `fields` and `json` portrait presets are unchanged. New formats use the existing `portrait-dialogue` adapter with these `format` values:

```json
{"kind":"tagged","entries":[
  {"kind":"dialogue","tag":"guide","quoted":true,"speaker":"Alex","portrait":"guide","recent":11},
  {"kind":"narration","tag":"narration"},
  {"kind":"status","tag":"Status","recent":6}
]}
```

A dynamic entry is `{"kind":"dynamic","speaker":"Robin"}`. Its tag grammar is ASCII letters/spaces followed by a dot and 1–3. Fixed tags must not overlap dynamic tags. Explicit profile edits are validated before staging.

Community uses `{"kind":"community"}` with the exact image, ID/Name/Age/Class, Loc/Attire/Equipment/Interests, Mood/Allocation and Personality input contract. No arbitrary labels, regex or HTML are executed.

The experimental full scene uses `{"kind":"scene","open":"<scene>","close":"</scene>"}`. Its enclosed JSON contains `speaker`, `dialogue`, one to four `portraits` (`image`, optional `hover` and `label`), optional `background`, and optional time/day/date/location. Every image reference goes through the current character's mapped-asset provider. Missing assets are reported. Desktop hover and keyboard focus show alternate portraits; expand/collapse controls affect dialogue display only.

## Actions and persistence

Visual layout, portrait visibility, dialogue visibility, console visibility and explicit appearance choices reuse the typed action system. Their state is isolated by character/chat, survives reload, and supports reset plus one undo step. Appearance options must be declared in a profile as exact named-image mappings; arbitrary Lua outfit logic is not inferred. Scene dialogue expansion/collapse is temporary widget state.

The settings editor exposes validated JSON for these structured formats rather than silently converting them into the older named-field format. Profile import/export and recovery retain the format and choices.

## Boundaries

This milestone does not run Lua, STscript or general Risu V2 actions. World/story settings, message impersonation/sending, lorebook switches, arbitrary undo, audio, affection drawers and source-driven multi-fragment scene assembly remain future work. The scene fixture tests reusable presentation mechanics; it is not an automatic port of a complete Raen or To Love Ru card. Imported source CSS and fonts are not reproduced pixel-for-pixel.

Source-only cards can now import matching common/tagged/profile layouts. Explicit profiles additionally supply appearance mappings and the composed scene grammar. These are distinct levels of support and should not be reported as universal card compatibility.


## Styled tagged entries (0.11.0)

Portrait adapter version 2 adds optional per-entry `style` tokens and status-only `placement: "bottom"`. Version 1 profiles remain supported unchanged. See `PRESENTATION-STYLES.md` for limits, recognition and migration. The public JSON schema now includes tagged, community and scene formats as well as named-field formats.


## Source-only scene assembly (0.13.0)

The explicit scene format remains supported. A separate v4 `scene-fragments` format now combines recognized background, cast/hover, dialogue and status rules. See `SCENE-ASSEMBLY.md`; this supersedes the earlier multi-fragment limitation for the reviewed structures only. The mapping editor supports exact image replacements and preserves this grammar.
