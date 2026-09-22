# Mapping editor — 0.12.0

Updated in 0.14.0: appearance options now list known portraits by character label, retain original image references in read-only details, and support a required default outfit without As written. See [OUTFITS.md](OUTFITS.md) for the current workflow and v5 fields. The scene assembly milestone in 0.13.0 also added reviewed source-fragment profiles; those can use this editor.

Open **Extensions → Display Bridge → Set up portrait and dialogue** on the selected character. Recognized tagged layouts, field/JSON layouts, Community profiles and explicit scenes can be edited without rebuilding their profile JSON.

## Review workflow

1. Add exact **Source image name → Use image** replacements. Suggestions come from this character's enrolled assets; **Check image** shows a local preview. A resolved name is not proof that the image file decodes: inspect its preview when repairing a broken file.
2. For portrait/dialogue layouts, add named appearance options and their exact image pairs. Existing option IDs survive label changes. Source references are matched once: the selected option takes precedence over the default replacement. Replacements are not chained or inferred from filename patterns.
3. Adjust supported speaker/metadata labels, field bindings, initial visibility and the global palette. Imported per-speaker styles keep their own palettes. Community profiles expose image replacement only because they have no shared appearance controls.
4. Enter a sample, then **Preview**. Preview actions do not change the live profile, saved choices or messages.
5. **Review preset for this character** stages the draft. **Apply imported UI profile** activates it. Reopen the editor after applying; stale editors cannot overwrite a profile or review candidate changed elsewhere.

Unresolved replacement names block staging unless **Allow unresolved replacement images when staging** is checked. Advanced JSON is available for bindings beyond the form. It is separately validated and staged; it does not silently replace the form's fields.

## Persistence and recovery

Applying a changed portrait preset migrates compatible visibility and appearance choices for that character's saved chats. Stable option IDs retain selections even if their labels change. Removing the selected option falls back to **As written**, preserving other choices. Existing choices take precedence over new initial defaults; Reset display uses the new defaults. Undo state is sanitized in the same way.

When a source reimport or repair offers another portrait preset of the same format family, **Keep existing portrait mappings and appearance choices** is checked by default. It preserves local mappings, options, labels and initial defaults while accepting new source styles/bindings. Uncheck it to use the incoming declarations instead. Manual profile loads and editor drafts are explicit replacements; they are not silently merged. Restoring previous panel settings also migrates compatible choices. Saved settings use ST's normal persistence and are not a crash-proof transaction.

## Portable contract

Portrait adapter v3 adds optional `imageMappings` (up to 200 exact name pairs), `metadataLabels` (time/day/date/location, up to 40 characters each), and boolean `defaults` (visual/image/dialogue/console). Names are at most 256 characters; empty names, control characters and unsafe object keys are rejected. Existing v1/v2 profiles remain supported. An older extension rejects v3 instead of silently dropping these fields.

The provider's read-only `listImages({avatar})` API returns at most 2,000 valid names and mapping statuses for one explicitly enrolled character. It neither exports paths nor imports or guesses assets. Manual entry remains possible with an older provider.

## Trial fixture and boundaries

`mapping-editor-0.12.0/styled-afternoon-options.charx` combines the neutral Afternoon styles with distinct Uniform/Casual artwork and one shared latest-message control bar. Its options are deliberately declared in an explicit portable profile. The earlier source-only Afternoon fixture remains available separately.

This editor does not translate arbitrary outfit scripts, execute Lua/STscript, set story variables, select embedded conditional greetings, or assemble independent scene rules. Source recognition still requires a supported structure. Export a reviewed UI profile to share its configuration; the editor does not rewrite the original CHARX or attach image bytes to a profile export.

## Fresh-card reload fix — 0.12.1

ST can generate a different chat name on each read when the imported card has no stored native chat reference. Saving a display choice now initializes that reference after checking the selected character and chat. Existing references are never overwritten. This fixes existing imports after their next display choice; it does not change prompt or message content. As written and Uniform deliberately share the original artwork in the fixture.
