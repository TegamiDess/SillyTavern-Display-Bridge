# Source-only scene assembly — 0.13.0

Display Bridge can recognize a supported group of separate Risu display rules and assemble it into a portable scene preset. No explicit profile is needed for the neutral scene fixtures. Recognition uses input grammar and capture roles, not card/author names.

## Included

- A main scene background, supplied by a numbered or unnumbered four-field background tag, or a numbered five-field tag.
- Zero to four portraits, each with an optional alternate image displayed by the existing desktop hover/keyboard implementation. The reviewed source cast formats contain two or four extra position/tooltip fields; those fields are parsed for structure but are not applied.
- A bounded dialogue area opened by `<div tn="id">` or `<div><div tn="id">`, with matching closing divs. Reviewed `<text="style">...</text>` wrappers become plain text. Supported paragraph/break wrappers become newlines; raw source classes/HTML are not installed.
- Time from the four-field background structure, or date/time/location from the five-field structure.
- The existing translucent scene layout, expand/collapse controls, native-text mode, visibility preferences and exact image mapping editor. One shared control bar appears at the bottom of the latest assistant message.
- Multiple scenes within a message, keeping their ranges and surrounding prose separate. A scene never borrows a cast or dialogue from a later scene or another message. Incomplete/unrecognized scenes stay in native display.

All image roles resolve through the selected character's provider mapping, including backgrounds and hover alternatives. Source image filenames may vary; no filenames are guessed. A scene lacking a reliable speaker binding has no invented speaker label.

## Recognized structures

Four-field background: optional scene number followed by `<img src="background"_"sky"_"effect"_"time">`. Only the main background and time are used. Five-field background: scene number followed by `<img src="background"_"period"_"date"_"time"_"location">`.

Cast: a declared count marker, followed by that many `<img="base"_"hover"><ct="..."_"...">` tuples (two or four ct fields according to the recognized source family). Complete corresponding source rules for background, cast and dialogue must exist together. Different field families, changed capture bindings, unsupported matching flags and executable template attributes require review instead of auto-enabling a guessed scene.

The initial implementation uses portable portrait adapter **v4**, with `format.kind: "scene-fragments"`. The format declares allowed background structures, cast field/count choices, dialogue openers and whether text wrappers are recognized. It contains no executable regex, HTML or scripts. Profiles v1–v3 remain compatible; older extensions reject v4. Schema and runtime limits include four portraits, 64 assembled scenes per message, 20,000 characters per candidate scene, and 12,000 dialogue characters.

## Explicit limitations

Source state/recency macros, dynamic tint and weather/effect layers, pixel offsets, tooltip content, arbitrary CSS, audio, information drawers, story actions, specialized alternate scene syntaxes and conditional greeting selection are not translated in this milestone. Markdown inside the scene dialogue is currently displayed as text. Ordinary prose outside it retains native ST formatting. Fixed local background art replaces global page-background effects.

An imported profile can be ready while the greeting does not contain a complete scene. For example, a conditional `<start>` greeting, a background-only preamble without dialogue, or a source greeting-selection macro will not create this scene. Compatibility reports which display rules were adapted and what remains excluded; recognition is not a claim of complete support for all behavior on a card.

## Trial and verification

Import `scene-assembly-0.13.0/assembled-scene-four.charx` or `assembled-scene-five.charx` with V3's **Import card with images and supported UI**. Each has neutral local artwork and separate background/cast/dialogue/text rules, with no embedded Display Bridge profile. Both should show two hover portraits over a background, dialogue, status and shared controls, with ordinary prose above/below. Refresh normally after changing a display choice to check persistence.

Technical-only inspection of the supplied To Love Ru and Raen source groups recognizes their core scene roles. Their original narrative/artwork and executable scripts were not used in native tests. The neutral fixtures test the supported structural contract. Full original-card behavior remains broader than this contract.
