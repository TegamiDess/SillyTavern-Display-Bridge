# Path to clean CHARX imports

Goal: import a CHARX into SillyTavern and bring along its supported images and UI, with a clear explanation of incompatible behaviour.

Current accepted testing build is 0.21.1 / V3 Asset Sprites 0.9.1; see [release acceptance](../RELEASE-ACCEPTANCE.md). The next proposed cycle is the [wider compatibility audit](COMPATIBILITY-AUDIT-0.21.1.md): import/reporting prerequisites, bounded startup and conditional prompt content, the embedded-greeting pilot, then Raen setup and message-owned effects. That audit does not implement or certify those features. The [To Love Ru scene plan](SCENE-IMPORT-PLAN.md) and older checkpoints below record the preceding development sequence.

The completed scene cycle covers [scene assembly](SCENE-ASSEMBLY.md), [controls](SCENE-CONTROLS.md), [typed state](SCENE-STATE.md), [reviewed automatic import](SCENE-AUTO-IMPORT.md), and the scoped release acceptance above. It does not provide general source conditions, random/history-edit effects, or arbitrary macro conversion.

## Checkpoint — Display Bridge 0.9.0 / V3 Asset Sprites 0.6.1

The profile format, importer handoff, compatibility reporting and targeted recovery are implemented. This release adds the remaining supplied Witchcure display rules and the first persistence/lifecycle implementation: per-chat roster/report preferences, reset/export/load, native character identity, rename/deletion/replacement handling, interrupted mapping reconciliation and reviewed attachment of unassigned sources. Group chats remain unsupported. Existing stream/gallery/status/map and swipe fixes remain included.

The supplied Witchcure source has 16 adapted rules, two disabled separators and one empty input separator. Its Lua switch is reproduced by the reviewed presentation action, with no original Lua execution. Automatic roster placement changes the display only. This does not imply general Risu rule translation.

The isolated live acceptance pass for the current feature set is complete. Real native imports, local images, rename round trips, duplicate/delete, recovery, persistence and streaming/non-streaming generation were exercised. The earlier live matrix is in LIVE-ACCEPTANCE.md; this release adds the targeted checks in RECOVERY-ACCEPTANCE.md.

Our explicit replacement route now has durable backups, image-byte recovery and guarded rollback. Imports isolate assets from native shared folders. Cross-route/server-wide transactions and automatic orphan cleanup remain outside this implementation; see REPLACEMENT-RECOVERY.md.

PC comes first. A reusable portrait/dialogue preset now supports two independently authored neutral CHARX fixtures through explicit profiles and manual setup. It has configurable formats, image variants, themes and saved presentation choices. The optional ordinary-image trial adds borderless hover and independent in-chat expansion. See PORTRAIT-PRESET.md.

## Ordered remaining work

1. **Reviewed source-pattern recognition.** Collect neutral technical examples of real portrait/dialogue message formats and replacement rules. Translate recognized contracts into the existing preset and test changed/ambiguous variants; reject uncertain matches with a useful report. Shared authorship or similar HTML alone is insufficient. A bounded figure/div field recognizer now derives renamed/reordered bindings, checks captured regex options and declines ambiguous combinations. It is validated with independent neutral source-only CHARX fixtures; real-world coverage and further format families still need representative examples. See PORTRAIT-RECOGNITION.md.
2. **Additional presentation presets.** Build on the format and image contract for scene backgrounds, multi-portrait layouts, audio and richer panel composition. Greeting replacement and story-changing settings require separately specified native actions. Lua and STscript are deferred; current saved values are presentation preferences only.
3. **Broaden import entry points.** Integrate ordinary ST drag/drop and other native import routes while retaining original source reliably. Build on the existing handoff and replacement policy. Do not introduce two handlers that import the same file twice or replay stale source onto a reused avatar.
4. **Expand the release acceptance matrix.** Run repeated/replacement imports, duplicate names, collisions, missing assets, Korean names, unsupported effects, interrupted operations, extension updates/uninstalls, large cards and other regex extensions. Run relevant parts with each preceding change, then the full set as a release gate.

Full arbitrary Lua execution and universal Risu compatibility are outside the current design. No ST core files have been changed.
