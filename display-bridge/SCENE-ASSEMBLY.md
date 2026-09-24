# Source-only scene assembly — 0.16.0

Display Bridge can recognize a supported group of separate Risu display rules and assemble it into a portable scene preset. No explicit profile is needed for the neutral scene fixtures. Recognition uses input grammar and capture roles, not card/author names.

## Included

- A main scene background, supplied by a numbered or unnumbered four-field background tag, or a numbered five-field tag.
- Zero to four portraits, each with an optional alternate image displayed by the existing desktop hover/keyboard implementation. Reviewed `ct` bindings supply a bounded vertical position and one or three plain-text tooltip fields. A tooltip appears only on an opaque portrait hit or keyboard focus; it cannot widen the hover target.
- A bounded dialogue area opened by `<div tn="id">` or `<div><div tn="id">`, with matching closing divs. Reviewed text/paragraph/break wrappers preserve paragraphs. New detailed scenes accept basic bold/italic/underline/strikethrough tags and simple Markdown emphasis, and distinguish narration. Text is rendered through DOM text nodes; source classes, handlers and HTML are not installed.
- Time from the four-field background structure, or date/time/location from the five-field structure.
- The existing translucent scene layout, expand/collapse controls, native-text mode, visibility preferences and exact image mapping editor. One shared control bar appears at the bottom of the latest assistant message.
- Multiple scenes within a message, keeping their ranges and surrounding prose separate. A scene never borrows a cast or dialogue from a later scene or another message. Incomplete/unrecognized scenes stay in native display.

All image roles resolve through the selected character's provider mapping, including backgrounds and hover alternatives. Source image filenames may vary; no filenames are guessed. A scene lacking a reliable speaker binding has no invented speaker label.

## Recognized structures

Four-field background: optional scene number followed by `<img src="background"_"sky"_"effect"_"time">`. Reviewed bindings can add sky/effect layers and a finite sky-to-period lookup. Five-field background: scene number followed by `<img src="background"_"period"_"date"_"time"_"location">`. Its period field is not an image. Scene labels are displayed, but are not used as widget IDs.

Cast: a declared count marker, followed by that many `<img="base"_"hover"><ct="..."_"...">` tuples (two or four ct fields according to the recognized source family). Complete corresponding source rules for background, cast and dialogue must exist together. Different field families, changed capture bindings, unsupported matching flags and executable template attributes require review instead of auto-enabling a guessed scene.

The initial implementation used portable portrait adapter **v4**, with `format.kind: "scene-fragments"`. New discoveries use adapter **v6** and add `format.details`. Existing v1–v5 profiles keep their previous behavior; they are not silently rewritten. Older extensions reject v6. Schema and runtime limits include four portraits, 64 assembled scenes per message, 20,000 characters per candidate scene, and 12,000 dialogue characters.

```json
"details": {
  "version": 1,
  "castMetadata": true,
  "layers": true,
  "periodAssets": {"sky-night": "night"},
  "offsetAliases": {"@guide": "20%"}
}
```

This object belongs inside an otherwise valid `scene-fragments` format. `castMetadata` means the first `ct` field is a position and the rest are tooltips. `layers` applies only to the four-field background structure. Both dictionaries allow at most 64 entries. Periods are `daytime`, `dusk`, `night`, `midnight`; positions are complete finite `px` (±1000) or `%` (±100) tokens. Import compiles reviewed literal offset aliases into this lookup instead of running their regex against chat text. Missing/invalid positions leave the candidate native. Layer images use the same mappings, diagnostics, recovery and CHARX packaging as other images.

The renderer uses fixed, scene-local geometry: a 60% portrait band, family-specific origin and 40px settling offset; percentages refer to that band. These are reviewed layout approximations, not arbitrary source CSS reproduction. Images remain fitted for alpha hit testing. Sky/effect decoration stays inside the scene; period brightness is a built-in approximation. Source-wide page effects, animation timing and individual author layout overrides are not copied.

To upgrade an older imported card, reattach its original source and review/apply the newly discovered profile, retaining or reapplying mapping edits as needed. An explicitly embedded older profile retains precedence; exporting/reimporting that old profile alone does not enable v6 details.

## Added scene controls

Version 0.17.0 adds an opt-in information drawer and local audio through explicit v7 profiles and per-scene snapshots. See [scene controls](SCENE-CONTROLS.md). The exclusions below still describe automatic translation of original Risu behavior.

## Explicit limitations

Source state/recency macros, message-history weather arrays, arbitrary CSS, audio, information drawers, story actions, specialized alternate scene handlers and conditional greeting selection are not translated in this milestone. Directly captured layers work; state-driven weather does not. Specialized poses may still display through the generic image-pair grammar, but their distinct clipping, animations and interactions are not reproduced and must not be advertised as equivalent. Unknown markup/macros remain native rather than being discarded. Rich dialogue is deliberately smaller than full Markdown/HTML: no links, images, scripts or arbitrary attributes. Ordinary prose outside scenes retains native ST formatting.

An imported profile can be ready while the greeting does not contain a complete scene. For example, a conditional `<start>` greeting, a background-only preamble without dialogue, or a source greeting-selection macro will not create this scene. Compatibility reports which display rules were adapted and what remains excluded; recognition is not a claim of complete support for all behavior on a card.

## Trial and verification

Import `examples/assembled-scene-four.charx` or `examples/assembled-scene-five.charx` from the repository root with V3's **Import card with images and supported UI**. Each has neutral local artwork and separate background/cast/dialogue/text rules, with no embedded Display Bridge profile. Both should show two hover portraits over a background, dialogue, status and shared controls, with ordinary prose above/below. Refresh normally after changing a display choice to check persistence.

For the new details, import `examples/scene-details-four.charx` or `examples/scene-details-five.charx`. These add reviewed offset/tooltip bindings and formatted dialogue. The four-field fixture includes two small generated layer assets; neither includes private source artwork or narrative. The browser harness also serves `/fixtures/scene-preview.html` for a quick visual comparison.

Technical-only inspection of the supplied To Love Ru and Raen source groups recognizes their core scene roles. Their original narrative/artwork and executable scripts were not used in native tests. The neutral fixtures test the supported structural contract. Full original-card behavior remains broader than this contract.
