# Start here: import a card and see its pictures

For Display Bridge **0.14.2** and V3 Asset Sprites **0.6.4**. This is a PC-first testing release.

You do not need to write code or edit JSON for a supported import. Use your original **.charx** file. It is a card file that can also contain pictures and other files.

**Pick your route:**
- [Pictures only](#pictures-only): ordinary chat with pictures.
- [Witchcure, streamer or Afternoon-style UI](#cards-with-special-ui): pictures plus custom panels or dialogue boxes.
- [Something went wrong](#something-went-wrong): quick fixes.

## Install once

1. Download and unzip this release.
2. Find your SillyTavern installation folder. Inside it, open `data`, then `default-user`, then `extensions`. If you use another ST user or data location, use that user's extensions folder instead.
3. Copy **both** folders, `display-bridge` and `v3-asset-sprites`, into that `extensions` folder. Each copied folder must contain its own `manifest.json` file. Do not copy only the ZIP or put an extra folder around the two extensions.
4. Refresh the SillyTavern page. Check that both extensions are enabled in ST's extension manager.

Already installed? Replace the files inside those same two folders, then refresh. You do not need to delete your cards or chats.

**Do not paste this combined repository's URL into ST's Install Extension box.** This package contains two extensions; use the folder-copy steps above.

## Find the two menus

- The chat's **Extensions menu** has **Import card with images and supported UI**. Use this to pick a file.
- The **Extensions settings panel → Display Bridge** has the on/off switches and compatibility report. Use this to check the selected card.

Menu icons and translated labels can vary with your ST version/theme. The bold labels here are the English labels.

## Pictures only

Use this when you want a normal character card with images in its messages.

1. Open the chat's **Extensions menu**.
2. Click **Import card with images and supported UI** and choose the original `.charx` file. **Yes, use this same button for pictures-only cards.** Ordinary ST import/drag-and-drop does not perform this complete image import.
3. Wait for the import to finish. Read any duplicate-card prompt before choosing whether to create or replace a character.
4. If asked **Install/update … image-display rules**, check that it names the card you just imported and choose **OK** to install its image rules.
5. Open the imported character. If ST asks whether to allow its embedded regex, review and allow the rules for that card. If you declined earlier, open **Regex** from the chat's Extensions menu; the character/scoped rules have an **Allow using scoped regex** toggle in the tested ST version. Keep the required image rules enabled.
6. Look at a message containing one of the card's image references. Its picture should appear.

**Two approvals:** installing image rules and allowing ST to use them are separate steps. “Rules were saved but not enabled” means step 5 is still needed. Here, “regex” means a text-matching rule that lets the image system recognize an image name in a message.

For ordinary pictures, **Enable Display Bridge for this character** can stay off. You do not need Witchcure, Stream window or Portrait and dialogue switches. A “UI import: unsupported” result can be normal for a card with no special UI; check whether its images work separately.

Images appear when a message refers to them. Importing a card does not put every picture it contains into the chat. Existing messages can be checked without an API connection; generating new replies still needs your usual model connection. This importer handles supported image references, not every possible script, audio or video asset.

### Optional: small images that expand

In **Extensions settings → Display Bridge**, turn on **Compact ordinary images: hover preview and click to expand (trial)**.

- Hover over a thumbnail for a floating preview.
- Click to expand it in the chat. Click again to shrink it.
- Several images can stay expanded at once.

This switch is global. It does not replace the special image behaviour inside supported custom panels. Click expansion is temporary and may reset when the message is rebuilt or the page reloads.

## Cards with special UI

Use this for Witchcure, the supported streamer project, or a supported Afternoon Tea Time / Afternoon School Time layout.

1. Follow the **Pictures only** import steps above, including the image-rule approvals.
2. Select the imported character, then open **Extensions settings → Display Bridge**.
3. Read that card's import result. A fresh recognized import may already have enabled the right panels.
4. If a profile is waiting for review, inspect it and click **Apply imported UI profile**. A “profile” is simply the saved description of which panels and image mappings to use. **Keep current panels** keeps your previous setup instead.
5. Check **Enable Display Bridge for this character** and the matching option below. Leave unrelated panel options off.

| Your card | Matching option |
| --- | --- |
| Witchcure | **Witchcure panels (roster, report, status, map)** |
| Supported streamer project | **Stream window** and **Streamer gallery** |
| Supported Afternoon-style card | **Portrait and dialogue preset** |

**A checkbox cannot supply a missing template.** If the report says the UI is unsupported or its templates are missing, go to the fixes below. Sharing a card name or a similar visual style does not guarantee that its particular version is supported.

### Witchcure: what to try

- Open the roster and a character's detail page; try the roster/report switch.
- When a message includes status data, check its status panel.
- When a message includes map data, open the map and browse a region. Browsing the map does not start an expedition or change the story.

The roster/map use recent messages; status can remain visible farther back. Older messages may deliberately omit these panels. Switching views does not run the original Lua or change story statistics.

### Streamer project: what to try

- A message with supported stream data should show the stream window.
- A message with gallery data should show the gallery. Open a post and check its contents/comments.

The two switches are independent. No gallery data in a message means no gallery in that message. The adapter supplies the supported display controls; it does not reproduce every original script or posting action.

### Afternoon Tea Time / Afternoon School Time style: what to try

- A supported tagged dialogue line should become a speaker label and dialogue box with a portrait behind it.
- Look **below the latest assistant message** for the shared controls. There is not a separate control bar for every character portrait.
- **Visual layout** switches the custom layout on/off. **Portrait** and **Dialogue** hide/show those parts separately.
- **Scene settings** opens the appearance options, when the profile contains them. Choose an outfit there; the list might be called Appearance, Outfit, or a card-specific label.
- **Reset display** restores display defaults. **Undo display change** reverses the previous display change. Neither undoes story events.

An outfit list needs image mappings. If no list appears, that import may not contain recognized outfit mappings yet. It does not mean all pictures failed. Use a matching supplied profile or the [mapping editor](display-bridge/MAPPING-EDITOR.md) if you want to configure them; the [outfit guide](display-bridge/OUTFITS.md) explains how.

For supported tagged speech with a trailing translation, English in `(parentheses)` or `「these brackets」` appears first. Hover over the dialogue box to see the original. A line without a translation displays normally.

These controls change how the chat looks. They do not tell the model which outfit to write about, change world settings, or execute the original card's Lua.

## Want an LLM to finish the outfit options?

Export the partly working UI profile, give the LLM that file plus exact image names, save its complete JSON reply as a new file, then **Load UI profile → Apply imported UI profile** on the same card. Keep the original export as a backup.

Use the [copy-paste LLM prompt and worked example](display-bridge/LLM-PROFILE-GUIDE.md). It explains how to make one outfit choice change all characters together without changing the working dialogue layout.

## Something went wrong

| What you see | What to do next |
| --- | --- |
| No import button | Check that both extension folders are installed correctly and enabled, then refresh ST. |
| “Rules were saved but not enabled” | Allow this character's regex in ST's Regex menu. Installing the rules alone is not enough. |
| Images work but UI does not | Select the card, open Display Bridge, check its import result, apply any pending profile, and check the matching panel switch. |
| “HTML other than a simple image element is unsupported” | This can be an expected **image-rule** exclusion: Display Bridge handles supported UI separately. Check its compatibility report before treating the whole import as failed. |
| “UI import: unsupported” on a UI card | Open **Compatibility and recovery**. If the original source was not retained, attach the original CHARX using the steps below. If the format is still unsupported, export the report for a bug/compatibility request. Turning every checkbox on will not fix an unsupported format. |
| Image name, missing-picture placeholder, or broken image | Check **Compatibility and recovery → Images and image rules** for missing images or denied regex permission. Missing embedded files need the original CHARX; a rescan cannot invent them. |
| Panels worked, but one new reply is plain text | That reply may be incomplete or use a different format. Complete supported blocks can render during streaming. Include the smallest affected text example in your report. |

### Already imported through the ordinary ST importer?

You usually do not need to delete and recreate the character.

1. Select the existing character.
2. From the chat's **Extensions menu**, choose **Attach original card images and UI to current character**.
3. Pick the original `.charx`. Check the destination character in the confirmation, then finish the image-rule approvals.
4. Open Display Bridge and apply the recovered profile if one is waiting for review.

This attaches images/UI source to the selected card without creating another character. **Enable / rescan current card images** is useful for retained metadata/local files, but cannot recover archive contents that were never imported. **Attach Witchcure JSON** is an advanced UI-template attachment; it is not the normal CHARX image-import step.

## Send useful feedback

Send the extension versions, your ST version, what you clicked, what you expected, and what appeared instead. A small screenshot and a neutral example message help. **Export compatibility report** is available under Display Bridge's **Compatibility and recovery**; review its labels before posting it publicly. Do not post API keys or private chat logs.

The original Witchcure, streamer and Afternoon cards are **not bundled** with this release. Use your own originals. The GitHub package also includes neutral `examples/assembled-scene-four.charx` and `assembled-scene-five.charx` for a separate composed-scene test; those are not copies of the three cards above.

For more detail: [technical README](display-bridge/README.md), [compatibility/recovery](display-bridge/COMPATIBILITY.md), [bilingual dialogue](display-bridge/BILINGUAL-DIALOGUE.md).
