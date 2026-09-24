# Scene parsing fixes — 0.21.2 / provider 0.9.1

- Signed score captions such as `❤alex:-5` inside a scene's character-information tuple are recognized as displayed values. They no longer produce an unknown-entity error by being mistaken for a delta annotation. Explicit affection updates remain separate.
- A recognized music command with an extra leading `@`, such as `<@BGM=@BGM_02_Morning>`, selects the same track as its canonical spelling. Existing profiles gain this compatibility at runtime without reimport. Unknown tracks remain rejected; escaped and code-formatted examples remain ignored.
- Automatically assembled scene profiles default to 10% music volume, the current player's lowest saved non-muted step. Explicit imported profiles and previously saved chat volumes retain their own settings.

Update the `display-bridge` extension files and refresh SillyTavern. V3 Asset Sprites remains at 0.9.1. These changes do not rename card assets, rewrite greetings, or repair missing media. A previously rejected saved branch may still need the existing **Rebuild scene state** action after its input is corrected.

The prior published release is retained on `archive/0.21.1-0.9.1`. The older `archive/0.14.2-0.6.4` branch is unchanged.

This patch retains the existing architecture and feature scope. The full native/browser acceptance results in [RELEASE-ACCEPTANCE.md](RELEASE-ACCEPTANCE.md) describe the 0.21.1 baseline; they are not new browser-test results for this patch. Local unit validation and the repository contents review are recorded with the patch acceptance notes there.
