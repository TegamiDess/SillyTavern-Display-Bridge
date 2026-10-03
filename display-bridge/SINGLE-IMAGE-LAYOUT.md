# Single-image portrait layout

Portrait adapter **20** adds a bounded single-image layout to four-field scenes.
It represents the reviewed event portrait whose second image field is a vertical
offset, rather than a hover image. It is independent of the optional click/audio
experiment.

Open **Display Bridge → Set up portrait and dialogue → Single-image portrait
layout**, enable it, review and apply. The filename marker, extension and width/
height percentages are editable per card and export with its UI profile.

The reviewed source uses marker `_ev_lying_`, suffix `.png`, and a box measuring
74% of the scene width and height. A matching name must have text on both sides
of its marker, contain that marker exactly once, and end in the declared suffix.
No character names or asset-path guesses are built into the renderer.

For example, inside a normal scene:

```text
<1><img="guide_ev_lying_reading.png"_"60%"><ct="unused"_"A guide"_"Reading"_"Quiet">
```

This shows one image centered horizontally, with its center at 60% of the scene
height. `%` and bounded `px` offsets are supported. The image keeps its aspect
ratio within the declared box and clips at the scene boundary. There is no
hover image. The four trailing caption fields are consumed but not displayed,
matching this source layout; the ordinary portrait family still uses its own
offset and status-caption bindings.

The portable field is:

```json
"singleImage": {
  "version": 1,
  "marker": "_ev_lying_",
  "suffix": ".png",
  "width": 74,
  "height": 74
}
```

It belongs inside `source.format`, alongside `kind: "scene-fragments"`.
It requires four cast fields and an allowed cast count of one. Dimensions must
be 1–100%; suffixes are `.png`, `.webp`, `.jpg`, or `.jpeg`. The literal marker
is bounded to underscores, ASCII letters, digits and hyphens. Unknown tuples,
invalid offsets and attempts to mix this form into a multi-portrait scene stay
unsupported. Ordinary image pairs remain unchanged.

## Source import and boundaries

Automatic discovery recognizes the exact reviewed capture/template structure,
its geometry declarations and a compatible history condition. Imported regex,
CSS and handlers are not executed. Altered bindings, unknown clipper styling,
additional geometry declarations, conflicting rules or unsafe options require
review. The audited source gives `character-clipperEV` no CSS declaration; its
image is positioned relative to the surrounding scene. The bridge therefore
uses the scene frame as the positioning and clipping boundary.

Existing scene entrance/breathing options, reduced-motion preference, history
depth, image mappings and outgoing cleanup apply. Outgoing cleanup can now
strip this recognized form from older request copies while retaining dialogue.
Pointer checks ignore blank `object-fit: contain` margins.

The source's other special family combines variable-dependent image switching
with a named click/voice handler. It remains outside the mainline with the
parked optional interaction work. This feature does not imply support for that
program, arbitrary CSS, or exact page-wide Risu geometry.

## Verification, 2026-10-03

234 unit tests and 19 visible-browser checks passed, including the previous
history/motion/outgoing-cleanup regressions. New checks cover exact source
recognition, ambiguous tuples, adapter/version validation, portable profile
round-trip, offsets, clipping, missing images, pointer letterboxes, keyboard
focus, editor settings, old-history rendering and swipes. Settled geometry was
compared against independently rendered reviewed source CSS with neutral art.

A source-only SFW CHARX imported through the native V3 flow at the isolated
8102 instance and automatically acquired the single-image profile; all four
images resolved. No model calls or original specialized interactions were run.
This is a comparison against the reviewed CSS, not a new live Risu screenshot
comparison. Native configured CHARX export/reimport was not repeated here.
