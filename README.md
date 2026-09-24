# Display Bridge and V3 Asset Sprites

Experimental, PC-first SillyTavern extensions for importing CHARX images and recognized Risu-style UI. **Display Bridge 0.21.2 / V3 Asset Sprites 0.9.1**.

Supported families include common portrait/dialogue layouts, reviewed composed scenes, Community-style profile panels, and streamer/Witchcure panels. Matching is based on supported source structure or an explicit profile, not author identity. General Lua/STscript and arbitrary conditional greetings remain unsupported. Reviewed declarative state and startup profiles are supported; automatic source conversion is limited to recognized structures.

**New to this? [Start here: beginner import guide](START-HERE.md).** Separate steps for pictures-only cards, Witchcure, streamer and Afternoon-style UI.

## Install

1. Download this repository or its release archive.
2. Copy the complete `display-bridge` and `v3-asset-sprites` folders into your SillyTavern user's extensions directory, normally `data/default-user/extensions/` inside the ST installation. For another user/data directory, use its corresponding extensions folder. Keep both folder names unchanged.
3. Refresh SillyTavern. Use V3's **Import card with images and supported UI** command, then inspect **Extensions → Display Bridge** for the compatibility result. If prompted, review the character's regex permissions. Ordinary native import/drag-and-drop does not yet provide this full handoff.
4. To update, replace the two extension folders' files and refresh. Back up your own data before beta testing.

This repository holds two extension roots. Pointing ST's Git install button at the combined repository root is not supported; use the folder installation above. Each extension directory contains its own manifest.

## Quick trial

**0.21.2:** signed affection captions no longer become malformed state updates, music commands with an extra leading `@` are accepted for recognized tracks, and newly assembled scene profiles default to 10% music volume. Existing profiles and saved chat volumes are preserved. [Patch details](SCENE-RELEASE-0.21.2.md).

**0.21.1:** failed swipes restore accepted scene state automatically. Untracked location updates are skipped with a console-only warning. Music, character information and a rebuild shortcut now share a collapsible side panel. Try `examples/scene-context-import.charx` for source-only scene, roster, state, music and request-context conversion. Initialize Conversation state before generating. [Automatic import setup and limits](display-bridge/SCENE-AUTO-IMPORT.md). The original To Love Ru source still requires review for missing assets and unsupported interactions. [Release details](SCENE-RELEASE-0.21.1.md); [explicit state/startup](display-bridge/SCENE-STATE.md).

Import `examples/assembled-scene-four.charx` or `assembled-scene-five.charx`. These neutral cards contain source display rules and embedded artwork; the importer derives their UI profile. Expect a background, two hover portraits, dialogue, status and shared layout controls. Profile-only outfit examples can then be loaded on the matching card.

Use **Set up portrait and dialogue** to edit mappings. Existing outfits are collapsible sections. **Review preset for this character → Apply imported UI profile** saves the edit; **Export UI profile** downloads it. **Advanced preset JSON** accepts only the `source` object.

Tagged bilingual speech supports `"Ohayou!" (Good morning!)` and `"Ohayou!" 「Good morning!」`: translation first, hover/focus for the original. Untranslated lines remain normal.

## Performance patch

0.14.3 / 0.6.5 reduces mapping-editor DOM size, defers closed outfit controls, skips reports while Display Bridge settings are collapsed, and avoids repeated parsing of unchanged card metadata. See [measurements and limits](PERFORMANCE.md).

## Snapshot compatibility

0.14.5 includes a capture-only helper and an optional patch for existing Snapshot 3.3.0 installs. It preserves local images and rendered panels, and prevents collapsed reasoning from appearing as stray text in the temporary snapshot copy. See [setup and limits](SNAPSHOT.md).

## Configured card export

**Export configured card (CHARX)** bundles local images and supported audio, the applied UI profile and portable generated image rules into one file. Recipients use the extension import command; permission grants and chat choices are not copied. In 0.15.1 / 0.7.1, generic named images also use Risu's asset-library classification without duplicating image files. [Sharing guide and limits](EXPORT.md).

## Documentation

- [Share a configured card (CHARX export)](EXPORT.md)
- [Profiles and schema](display-bridge/PROFILES.md)
- [Mapping editor](display-bridge/MAPPING-EDITOR.md)
- [Outfits and character labels](display-bridge/OUTFITS.md)
- [Ask an LLM to finish a profile](display-bridge/LLM-PROFILE-GUIDE.md)
- [Bilingual dialogue](display-bridge/BILINGUAL-DIALOGUE.md)
- [Scene assembly and exclusions](display-bridge/SCENE-ASSEMBLY.md)
- [Compatibility and recovery](display-bridge/COMPATIBILITY.md)
- [Testing and QA](TESTING.md)
- [Current release acceptance matrix](RELEASE-ACCEPTANCE.md)
- [Importer details and format provenance](v3-asset-sprites/IMPORT-NOTES.md)

Validated against ST 1.15.0 staging, commit `23ba3e5bb2e7aad59d0912b2b026a14052936f1b`. Other versions need testing. A ready profile does not imply every script or greeting on a card is supported.

Licensed under **AGPL-3.0-only**. See [LICENSE](LICENSE), [licensing details](LICENSING.md) and [third-party notices](THIRD-PARTY-NOTICES.md). Original authorship notices are preserved; imported cards and external assets retain their own rights. Commercial use is permitted under the license conditions.
