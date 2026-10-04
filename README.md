# Display Bridge and V3 Asset Sprites

Experimental, PC-first SillyTavern extensions for importing CHARX assets and supported Risu-style UI. **Display Bridge 0.22.1 / V3 Asset Sprites 0.10.0**.

**[Try the interactive To Love Ru example](https://tegamidess.github.io/SillyTavern-Display-Bridge/)** — ten recorded SFW exchanges, twenty illustrated scenes, hover portraits, Scene controls and expandable dialogue. Opens directly in your browser; no SillyTavern, card import or API key required.

**[New users: start with the import guide](START-HERE.md).**

## Install or update

1. Download this repository or its release archive.
2. Copy the complete `display-bridge` and `v3-asset-sprites` folders into your SillyTavern user's extensions directory, normally `data/default-user/extensions/`. Keep both folder names unchanged. Back up your data before updating.
3. Refresh SillyTavern. Use **Import card with images and supported UI**, then inspect **Extensions → Display Bridge** and review any native regex permission prompt.
4. For updates, replace both extension folders' files and refresh.

This repository has two extension roots. ST's Git install button cannot install the combined repository root; use the folder installation above. Ordinary native import/drag-and-drop does not perform the complete asset/UI handoff.

## What this release adds

- Faster long-chat state parsing and reuse of unchanged scene rendering plans.
- Accepted affection/location state survives summarizer-hidden history, with source and branch validation retained.
- Summarized assistant scenes keep their normal display-depth rules instead of exposing old inline backgrounds.
- English labels for extension-owned gallery and exploration-map controls.

An [optional Summaryception compatibility build](optional/Extension-Summaryception/README.md)
adds UI optimisations, source-freshness review and integration fixes. Install it
separately only if wanted; the standard two-folder installation above is unchanged.

Portrait audio and the click-image experiment are not included. Chat-owned background music remains supported. See [current validation and limits](RELEASE-ACCEPTANCE.md).

## Try a card

Import `examples/assembled-scene-four.charx` or `examples/assembled-scene-five.charx` for neutral scene demonstrations. `examples/scene-context-import.charx` also demonstrates recognized state, roster, music and request context; initialize **Conversation state** before generating.

Use **Set up portrait and dialogue** to edit mappings and grouped outfits. **Review preset for this character → Apply imported UI profile** saves the edit. **Export configured card (CHARX)** bundles supported local assets, the profile and portable image rules; chat choices and permission grants are excluded.

## Guides

- [Configured card export](EXPORT.md) · [Profiles and schema](display-bridge/PROFILES.md)
- [Mapping editor](display-bridge/MAPPING-EDITOR.md) · [Outfits and labels](display-bridge/OUTFITS.md) · [Bilingual dialogue](display-bridge/BILINGUAL-DIALOGUE.md)
- [Automatic scene import](display-bridge/SCENE-AUTO-IMPORT.md) · [Conversation setup](display-bridge/B2-SETUP.md) · [Startup screens](display-bridge/STARTUP-SCREEN.md)
- [Scene layout, opacity and colours](display-bridge/SCENE-LAYOUT.md) · [History and motion](display-bridge/SCENE-BEHAVIOR.md) · [Outgoing cleanup](display-bridge/SCENE-REQUEST-CLEANUP.md)
- [Compatibility](display-bridge/COMPATIBILITY.md) · [Snapshot support](SNAPSHOT.md) · [Performance](PERFORMANCE.md)
- [Testing](TESTING.md) · [Current audit](RELEASE-ACCEPTANCE.md) · [Remaining work](display-bridge/ROADMAP.md)

Tested with ST 1.15.0 staging. Other versions, mobile, group chats and arbitrary third-party scripts/themes require testing. Matching uses supported source structure or a reviewed profile, not card names. General Lua/STscript and arbitrary conditional source programs are unsupported; a rendered scene does not imply full Risu feature parity.

Licensed under **AGPL-3.0-only**: [LICENSE](LICENSE), [licensing](LICENSING.md), [third-party notices](THIRD-PARTY-NOTICES.md). Imported cards and external artwork retain their respective rights. Historical release notes remain available in Git history.
