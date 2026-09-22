# Replacement and asset-collision recovery

Paired release: **Display Bridge 0.7.0 + V3 Asset Sprites 0.6.0**. PC is the primary target; desktop hover and pointer behaviour remain the baseline for future adapters.

## Import without shared asset overwrites

Use **Import card with images and supported UI**. The native importer receives an isolated CHARX containing only the avatar image. Original embedded auxiliary paths cannot cause native extraction into shared expression, background or image directories. Supported image bytes, including backgrounds, are uploaded under independent UUID filenames and resolved through the provider. Display names and names that normalize to the same native filename cannot collide in that storage.

Duplicate logical image names are rejected rather than guessed. Embedded bytes take precedence over unrelated gallery files. Missing archive bytes are reported; an isolated import does not borrow a same-named image from another card. Non-image media are not imported by this version, including audio; their source metadata can remain available for future support. Original files are needed for later media translation.

This isolation applies to the extension's import/replacement routes. Ordinary ST imports and drag/drop have not yet been intercepted. Existing shared native assets are not moved or deleted. Images supplied through the provider do not automatically populate ST's native expression picker/background manager.

## Repair images without replacing the card

Choose **Repair images from original source** to replace ambiguous or damaged mappings with fresh embedded bytes. It keeps the current prompt, native rules and UI choices. It uses the same verified recovery journal. Undo for an image-only repair restores mappings/bytes without rewriting the native card. Choose the matching original source; the confirmation names both source and target.

## Replace a selected card

In Display Bridge's Recovery section, choose **Replace selected card with recovery backup** (also available in the extensions menu). Select the source card and review the named source and destination.

Before replacement, the extension captures the native card and avatar, mapped image bytes, provider mappings/metadata/approvals, native character regex permission, Display Bridge profile/receipts and saved view preferences. A local backup and active operation journal are written and read back before any card changes. Supported source images are staged in new files; incomplete staging stops the operation before replacing the card.

The replacement keeps the exact selected avatar filename and chat files. It replaces the card's prompt, avatar and native rules using ST's import endpoint. Old regex permission is revoked; review the new image rules and use ST's normal permission controls when ready. UI delivery uses the existing versioned handoff. Source-defined Lua is never executed.

Web Locks prevent two replacement operations for the same character in the same browser profile. Character/setting/image revisions are checked around review and before each write phase. This is a recoverable sequence of native requests, not a server-side atomic transaction: other browsers, plugins or external file edits cannot be locked by this extension.

## Restore or keep

**Restore card from recovery point** first verifies that the native card, mappings, settings and image bytes still match the operation's verified result. It refuses to overwrite later edits. It restores the saved card/rules/settings and uploads backup image bytes under new filenames, leaving current and shared files intact. Saved chat text is not rolled back. The active chat selection can remain current.

After an interrupted/unverified native write, automatic restoration is blocked. Use **Export recovery backup** for manual inspection, then either recover manually or choose **Keep current card; close recovery point**. Keep does not edit the character or remove its backup. A write failure is never automatically retried against a potentially replaced identity.

The exported ZIP includes the original PNG, individual image copies, an image-path manifest and the recovery journal. It contains character prompts/rules and local paths, so review it before sharing. It contains no API credentials or chat messages.

## Storage and limits

- Recovery is stored in the active ST user's local `user/files` directory, independent of browser reloads. The active journal uses a hashed avatar name (`v3recovery-*.json`); original backup snapshots use UUIDs (`v3backup-*.json`). They are not stored in an external service.
- One recovery point is active per avatar filename. A subsequent reviewed operation replaces the active point but leaves the older original backup file on disk. Older points are available as local files, not through an automatic history/merge UI.
- Old assets, restored copies and unsuccessful staging uploads are retained. No automatic file deletion or garbage collection is attempted because other cards may reference them.
- The initial backup currently permits up to 64 MB of mapped image/avatar bytes. Larger backups or server upload limits stop replacement before native mutation. Already-missing mapped files are recorded by their missing-state hash; their absent bytes cannot be included in a backup. Other read failures stop the operation. Repair missing bytes from the original source.
- Card/settings/image edits after completion intentionally prevent one-click restoration. Export and inspect the backup instead. Chat-file changes, world-info files, global regex, tags shared through ST settings and other extensions' state are outside the rollback scope and are not overwritten.
- Online/offline renames and externally renamed chat files are not guessed. A recovery point stays attached to its original avatar filename; keep/export it before renaming. Normal existing lifecycle handling still transfers live display preferences on supported rename events.
- The backup is not a complete ST data-directory backup. Use normal backups for cross-device moves, unrelated import routes and concurrent external edits.

## Verification

The paired unit suite includes journal ordering, cancellation, later edits, image-byte changes, failed backup writes, interrupted native writes, reviewed Keep and native asset isolation. The existing browser suite remains a regression gate. Native acceptance uses disposable same-name CHARX cards with different image bytes and names that collide under ST normalization; pre-existing image/expression/background sentinels are checked by hash. Live checks also cover replacement, browser-reload recovery, later-edit refusal and preserving chat text. See the release notes for final counts.
