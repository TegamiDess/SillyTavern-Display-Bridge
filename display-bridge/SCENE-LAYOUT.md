# Reviewed scene frame

Available in Display Bridge 0.22.0. Portable profile schema version 1 is unchanged; a portrait-dialogue source with `sceneLayout` requires adapter version 13.

Non-layered `scene-fragments` presets can opt into a bounded frame:

```json
"sceneLayout": {
  "version": 1,
  "aspectRatio": [16, 8.5],
  "maxWidth": 1200,
  "metadataPosition": "top"
}
```

The preset editor exposes these fields under **Scene frame**. Preview and review use the same validator as profile import. Disabling the custom frame restores the legacy layout. Profiles without this declaration and the separate layered-scene layout keep their existing behavior.

Each aspect component must be a finite number from 1 to 100, with a resulting ratio between 1:2 and 4:1. Maximum width is an integer from 320 to 2400 pixels. Metadata position is `top` or `below`. Arbitrary CSS and unknown properties are rejected. Runtime validation additionally checks the cross-field ratio bound, which the JSON Schema cannot express.

The image viewport retains its ratio when dialogue expands or collapses. Expanded dialogue sits below it. At an available width of 480 pixels or less, ordinary dialogue also moves below the image. The top bar displays available date/day, period icon, time and location; the same metadata is not repeated below. Text is inserted as text, and accessible field names remain present. Profile export, settings restoration and neutral configured card export/reimport retain the declaration.

Portrait hover captions sit above the fitted portrait when dialogue overlays the image, with clearance below the scene header. Expanded, narrow, collapsed and dialogue-hidden views retain the previous caption position. The caption still requires an opaque portrait hover or keyboard focus; hovering transparent image corners does not reveal it. Position measurements run during preview only, without idle observers. This behavior applies to reviewed frames; the separate layered-scene layout is unchanged.

## Verification

## Remaining differences

This implements the reviewed frame and header contract, not complete source styling. At equal frame width, Risu still uses larger portraits, different vertical geometry, a background border/inset, per-speaker dialogue colors and different dialogue controls. Those require separate reviewed presentation work. Source Start triggers, reply choices, random setup, weather history, catalog limits and full original-card generated/export acceptance remain outside this milestone.

## Layered-scene status trial

The subsequent To Love Ru trial keeps status captions in their existing position but paints them above dialogue. The cast container no longer creates a stacking context in layered scenes; its images retain layer 3, dialogue layer 4, and captions layer 7. Portraits therefore remain behind dialogue, and captions remain pointer-transparent and hover/focus-only. Background opacity is unchanged. The reviewed Raen frame's above-head behavior is independent of this change.

The chat-owned Scene controls tray now includes **Appearance**, with **Dialogue background** and **Status background** sliders (0–100%), percentage readouts and **Reset appearance**. Values preview immediately without rebuilding scenes or saving on every pointer movement; committing an adjustment saves it as a character/chat-specific display preference. Text remains fully opaque. Reset restores the layout defaults (layered dialogue 80%, reviewed/generic scene dialogue 78%, status 92%) without resetting other display choices or story state.

Opacity preferences survive reload and chat switching, participate in explicit preference backup/recovery, and stay outside normal card/profile exports and model context. Preference exports containing these fields use preference schema version 3; legacy versions 1 and 2 remain readable. The portable UI profile schema and adapter version do not change. The controls appear for named chats using the scene-fragments renderer, including both reviewed and layered frames.

## Reusable speaker colours

Reviewed scene-fragment presets with detailed text-tag support can declare `speakerColors` (version 1), requiring portrait-dialogue adapter version 14. The declaration contains up to 64 exact tag keys in `speakers`, each with a display `label` and six-digit hex `color`, and up to 16 distinct `narrationTags`. Narration and speaker keys cannot overlap. Unknown properties and CSS expressions are rejected. Unmapped speech stays in the normal text colour; no identity is guessed from prose.

The later [layered scene fidelity pass](SCENE-FIDELITY.md) adds stable artwork
geometry and source portrait spacing to layered scenes. The separate reviewed
frame and its above-head captions keep their existing behavior.

The preset editor exposes **Character colours → Edit speaker palette** with add/remove controls, speaker tags, names and colour pickers. Palette definitions survive UI profile and configured card export/reimport. Tagged speech retains inline formatting and separate speaker identity even when adjacent runs otherwise have identical formatting. Very dark colours receive a light halo for contrast.