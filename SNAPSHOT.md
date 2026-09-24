# Snapshot compatibility (testing release)

Display Bridge 0.14.4 adds capture-only support for the **Snapshot 3.3.0** source layout (TheZennou version). Keep your existing Snapshot installation; it needs a small, optional patch to call the helper. Installing Display Bridge alone does not patch another extension.

## Install the compatibility patch

1. Update the complete `display-bridge` folder. When installing a current paired release, also update `v3-asset-sprites` from that same bundle; the helper does not require a separate Snapshot-specific provider version.
2. Open a terminal in this downloaded repository's folder. Run the command below, replacing the example path with your existing Snapshot extension's `index.js`:

   ```sh
   node tools/patch-snapshot.mjs "/path/to/SillyTavern/data/default-user/extensions/STExtension-Snapshot/index.js"
   ```

   Windows accepts a quoted path such as `"D:\SillyTavern\data\default-user\extensions\STExtension-Snapshot\index.js"` as well. Node is the same runtime used to start SillyTavern. To check compatibility without changing anything, add `--check` before the path.

3. The patcher checks the expected source blocks before editing, saves the original as `index.js.before-display-bridge`, and changes only `index.js`. It refuses unknown layouts or an existing backup, rather than guessing or overwriting your backup. Running it again on an already-patched file does nothing.
4. Refresh SillyTavern, open the chat, then use Snapshot as usual. Try a short message range first. Regular/grid modes and user-name anonymization still go through Snapshot's own code.

To undo: restore `index.js.before-display-bridge` as `index.js`, then refresh. Updating Snapshot can replace the patch; check compatibility again before reapplying. If a backup already exists, keep it somewhere safe before patching a newly updated file. This patch is not a promise of compatibility with other Snapshot forks or versions.

## What is captured

- Ordinary local images, including compact thumbnails and images expanded by clicking.
- Rendered Display Bridge panels, including their selected appearance and visible/hidden sections.
- The current displayed translation/original text state, colors and layout.
- Nested panel contents and current scroll positions, subject to the canvas renderer's layout support.

The helper flattens our shadow-root content into a **temporary static copy**, preserves its computed styling, and embeds visible local images into that copy. Hidden alternate portraits are omitted. It runs before Snapshot anonymizes the copy, so panel text is included in name replacement. This retains Snapshot's existing anonymization semantics; it is not a general privacy scrubber. Appearance labels, images and other identifying information may still need review before sharing.

There are **no added background observers, polling, network services, or changes to saved messages/cards/preferences**. No prototype hooks or automatic edits to another extension. Extra style-copying and image decoding/encoding happen only during capture. Long chats and large images can make capture temporarily expensive; use Snapshot's range selection to reduce memory and output size.

## Limits and troubleshooting

- A failed or slow visible local image aborts preparation after a bounded wait (10 seconds by default). Snapshot may show its generic error toast; the console gives the specific image-preparation error. Fix missing assets or wait for loading, then retry.
- Only existing same-origin `/user/images/`, `/user/files/`, and `/characters/` images are embedded. Remote images remain subject to Snapshot's existing CORS/network behavior. The helper introduces no new CDN dependency; Snapshot itself already imports html2canvas from its external CDN.
- Snapshot captures the currently loaded messages selected by its own range handling. It does not load older chat history.
- Floating hover previews are outside the message and are omitted. Video/audio playback and interaction do not survive a PNG. This is a static capture, not an interactive export.
- Closed reasoning/details sections contribute only their visible summary. Their hidden contents are removed from the capture copy to prevent old html2canvas versions painting stray text over messages. Open sections remain visible; the live chat and saved reasoning are unchanged. Updating Display Bridge to 0.14.5 supplies this fix without rerunning an already installed Snapshot compatibility patch.
- Computed styling freezes the current panel dimensions. Anonymized themes or Snapshot's forced 800px/mobile width may leave different spacing; they do not redesign a frozen panel. Complex browser effects (blur, gradients, fonts) depend on html2canvas support; the old renderer still approximates some patterned/gingham backgrounds. Very tall captures can exceed the browser's canvas limits.

## Integration API

Other capture tools can opt in without installing the patch:

```js
const helper = window.displayBridge?.api?.snapshot;
const supported = helper?.apiVersion === 1;
const clone = supported ? helper.cloneMessage(liveMessage) : liveMessage.cloneNode(true);
// Apply the capture tool's normal anonymization to the clone here.
captureContainer.append(clone);
document.body.append(captureContainer);
try {
    if (supported) await helper.prepare(captureContainer);
    // Measure grid/height only now, then call the canvas renderer.
} finally {
    captureContainer.remove();
}
```

`cloneMessage` expects a connected message element. `prepare` expects the attached copy outside `#chat`; it refuses live-chat containers. `prepare` returns `{ images, uniqueImages }` or throws. Nothing is retained after the caller discards the copy. The API never evaluates imported scripts or reruns message formatting.

## Verification

The normal browser suite covers flattening, anonymization, thumbnail/expanded sizing, image embedding, missing images, lazy loading, nested widgets, scroll position and unchanged live state. `/fixtures/snapshot-render.html` is an optional renderer check using neutral portraits and the same external html2canvas import as Snapshot 3.3.0; click **Capture neutral panels** and inspect the resulting PNG. It is separate from the offline regression suite.

The suite also checks closed/open/nested details in native messages and flattened widgets. `/fixtures/snapshot-details.html` reproduces the collapsed-reasoning artifact with three neutral images and compares the old capture, a visible-only reference and the fixed helper. With reasoning closed, the old capture differed by 15,005 pixels and the fixed capture matched the reference exactly in the tested browser.

Native acceptance also exercised the patched Snapshot 3.3.0 capture function in isolated ST 1.15.0: Afternoon-style outfit panels and an assembled scene, each in regular/grid mode with range `0` and user-name anonymization enabled (4 checks passed). Test-only instrumentation saved the PNGs locally instead of opening download dialogs. Images, outfit selection and panel spacing were visually inspected; chat messages and saved preferences stayed unchanged.
