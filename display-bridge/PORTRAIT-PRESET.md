# Portrait and dialogue preset — 0.8.0

This reusable PC-first component draws a local portrait behind a dialogue box. Card profiles supply field names, literal message delimiters, image choices and theme values. No character names or clothing lists are built into the renderer.

## Import and setup

An author can embed a portable profile under `data.extensions.display_bridge_profile` in the CHARX `card.json`. Import through **Import card with images and supported UI**. A fresh valid profile applies automatically unless review is required by a conflicting display rule. Existing selections are preserved for review.

For an existing card, choose **Display Bridge → Set up portrait and dialogue**. Enter the message format, map fields, supply appearance mappings and try a sample message. Preview is local and does not edit chat. Save stages a profile; **Apply imported UI profile** activates it. Export the result for reuse. The examples directory contains observatory and workshop profiles with different grammars and image options.

## Source contract

Add `{ "id": "portrait-dialogue", "version": 1, "source": { ... } }` to the portable profile's adapters array.

- `format.kind`: `fields` for pipe-separated `key:value` pairs, or `json` for a flat JSON object between literal markers.
- `format.open` / `format.close`: distinct literal markers, each 1–40 characters. These are not regular expressions.
- `format.fields`: map required `speaker`, `dialogue`, `portrait` and optional `time`, `day`, `date`, `location` to distinct source keys. Keys are case-sensitive.
- `variantLabel`: optional selector label, default Appearance.
- `variants`: up to 32 `{id, label, images}` options. `images` maps the original asset name to a replacement asset name. Unmapped portraits retain their original image. As written is always available.
- `theme`: optional six-digit hex `accent`, `background`, `text`; `pattern` plain/gingham; `position` left/center/right. Imported arbitrary CSS is not accepted here.

Fields example: `[Scene|speaker:Alex|text:Welcome to the observatory.|image:alex|place:Observatory]`.

JSON example: `<scene>{"person":"Robin","line":"Welcome to the workshop.","sprite":"robin"}</scene>`, with the corresponding field mapping.

Complete blocks render during streaming. Unknown/duplicate fields, incomplete blocks and code examples remain native text. Use JSON for dialogue containing pipes or closing markers. Captured text is not executed as HTML, macros, Lua or STscript. The preset configuration is limited to 100,000 serialized characters; a message block to 20,000.

## Included controls

Portrait and speaker label, patterned/plain dialogue, visual-layout toggle, independent portrait/dialogue toggles, scene-settings collapse, appearance selector, time/day/date/location display, reset and one-step undo. Named chats save choices independently by character identity, chat name and exact preset configuration. A changed configuration starts fresh; existing recovery snapshots retain the earlier configuration and its preferences. Unnamed temporary chats keep choices only in memory. Controls do not edit story text or model prompts.

As of 0.9.0, [source recognition](PORTRAIT-RECOGNITION.md) derives profiles for a bounded figure/div field grammar, including renamed/reordered captures. Explicit profiles cover more configurable formats. A similar-looking Risu card is not automatically compatible; author identity is not a recognition signal. Wider recognition still needs representative neutral technical fixtures.

## Compact ordinary image trial

Enable **Compact ordinary images: hover preview and click to expand (trial)** in Display Bridge settings. This is a global, optional display preference, off by default.

- Ordinary V3 provider images become small thumbnails.
- Mouse hover shows only a floating image: no window, border, backdrop or controls. Moving away, scrolling or Escape closes the preview.
- Clicking expands the same image in its existing chat position, bounded by chat width. Clicking again collapses it. Several images can stay expanded at once.
- Enter/Space use the same button action. Escape on a focused expanded image collapses that image.
- Expansion is temporary: switching chats, changing the image source or rebuilding native message DOM resets it. It is not saved in messages.
- Custom shadow-root panels, linked/button images, figure/details containers and `[data-db-image-behavior="card"]` keep their own behaviour. This initial trial handles ordinary `.v3as-result > img.v3as-image` output; it does not infer every possible third-party CSS interaction.
- Disabling the option unwraps the original image nodes. Card files, image bytes and message text are unchanged.

## Deliberately deferred

Story-variable tracking, world-settings effects, automatic prompt changes, arbitrary Risu Lua, STscript integration, generic greeting replacement, audio and full-scene visual novel layouts. Ordinary ST drag/drop still requires separate importer integration.
