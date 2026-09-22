# Character labels and default outfits — 0.14.0

Open **Display Bridge → Set up portrait and dialogue** on the selected card. Each appearance option is a complete set of image replacements: put all characters' Casual images inside one Casual option.

Since 0.14.1, saved options start collapsed under their names. Click a name to edit its mappings; new options start open. Collapse an option when finished to reduce scrolling. Collapsing keeps the draft values; Review and Apply are still required to save them.

1. Under **Character labels and original references**, review the names. Fixed-character templates use their speaker names automatically; scene references can be given friendly names here. Separate hover images have separate rows. Labels are editor identities, not asset filenames or story variables.
2. Add an appearance option, name it, and choose an image for each character row. All known portrait references appear in each option. A blank row uses the usual image mapping. Use **Original image reference** only when checking the underlying exact asset name; it is read-only in these rows. Unknown references can still be added manually.
3. Enable **Always use an outfit (hide As written)** and choose **Default appearance**. At least one named option is required. Leave the checkbox off for general image-replacement profiles that should retain As written. A named default can also coexist with As written.
4. Preview, choose **Review preset for this character**, then **Apply imported UI profile**. Existing valid selections survive. An old As written selection or a removed option switches to the configured default while retaining other display choices. Reset display uses that default; undo stays within valid choices. Saved choices remain chat/character-specific.

There is one shared appearance selector, not independent outfit selectors per character. The default does not depend on the order of the options. Stable IDs retain saved selections even when their labels change.

## Profile JSON

These optional fields belong inside the portrait adapter's `source` object and require **portrait adapter version 5**. Keep the existing `format`, `theme` and other source settings. Top-level `schemaVersion` remains 1.

```json
"portraitLabels": {
  "guide": "Alex",
  "guide-smile": "Alex (hover)",
  "curator": "Robin",
  "curator-smile": "Robin (hover)"
},
"appearance": {
  "allowOriginal": false,
  "defaultVariant": "normal"
},
"variants": [
  { "id": "normal", "label": "Normal", "images": {} },
  {
    "id": "swapped",
    "label": "Swap guides",
    "images": {
      "guide": "curator",
      "guide-smile": "curator-smile",
      "curator": "guide",
      "curator-smile": "guide-smile"
    }
  }
]
```

This example uses assets already in the assembled-scene-four/five fixtures. The Normal option intentionally uses the original artwork. Required outfit mode does not require every option to replace every image; unlisted references fall back to `imageMappings`, then to the original asset. A named replacement that fails to resolve still reports a missing image rather than silently selecting different artwork.

`portraitLabels` maps original references to labels (up to 200, each label 1–80 characters). It never renames or imports files. `appearance.defaultVariant` must equal a declared variant ID, or `original` only when `allowOriginal` is true. IDs remain case-sensitive, unique, letter-first identifiers of at most 60 characters, using letters, digits, underscores and hyphens. `original` is reserved. Up to 32 named variants and 200 image pairs per variant are allowed.
Old v1–v4 profiles keep their existing behaviour. Adding these fields requires v5 so older extensions reject the profile clearly. Source reimports with **Keep existing portrait mappings and appearance choices** enabled retain the local labels and outfit policy.

**Advanced preset JSON** expects the source object only. Full profile files belong in profile import; a bare variants array belongs inside the source object's `variants`. The form and advanced JSON are separate drafts: use **Copy form draft to JSON** before editing the JSON, and **Review advanced JSON** to stage it.

For help editing an exported profile with an LLM, use the [copy-paste prompt](LLM-PROFILE-GUIDE.md).
