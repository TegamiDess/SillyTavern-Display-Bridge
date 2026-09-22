# Saved preferences and character lifecycle — 0.7.0

Pair with V3 Asset Sprites 0.6.0. Existing adapter choices and attached templates are preserved. The bridge settings migrate from version 1 to 2; portable profile schema remains version 1. Witchcure adapter version 2 adds the reviewed remaining display rules. Older v1 definitions remain valid.

## What is saved

- Witchcure roster/report choice: per native character identity and stable chat ID. A different chat or branch starts with the source's default. New-chat events clear a reused chat ID. Character renames observed while the extensions are loaded preserve the choice.
- Gallery posts, stream expansion, map navigation and portrait details: temporary, as before. They reset on reload or when their message/scope changes.
- Master/panel choices, profile source, prior panel configuration and importer receipts: retained in extension settings. Group chats remain unsupported, so no identity is guessed for them. Without a stable chat ID, view choice stays session-only.

The Saved view preferences section resets the current chat or every chat for this character and exports/loads a small versioned preference JSON. Exports include chat names and view modes, but no messages, images, prompts or credentials. Import replaces this character's saved view choices after validating the entire file; invalid files leave current choices intact. At most 200 chat preferences are retained across characters. Older records are evicted first.

No chat files or card prompt fields are rewritten by these preferences. The automatic roster rule is reproduced at the bottom of the display, including existing replies, rather than inserting a marker into saved text. Code examples and incomplete/pending swipe displays remain protected. Recent-message visibility is unchanged.

## Ownership and recovery

Each extension records ST's native `create_date` against the exact avatar filename. The first upgrade binds existing records without resetting them. Subsequent native stamp changes retire old records before they can be reused. Live character-renamed events move settings, receipts, enrollment and image mappings; local image URLs are retained. Character deletion removes active ownership. Late delete events cannot retire a newer identity.

Retired configuration is kept in a bounded internal history (last eight entries per extension) for diagnosis. It is not automatically applied to a replacement. Existing one-step **Restore previous panel settings** remains the supported UI rollback. Asset files, native regex scripts and original card/chat files are not deleted or restored by lifecycle handling. The explicit replacement and image-repair routes now have separate durable recovery points; see REPLACEMENT-RECOVERY.md. They do not provide server-wide transactions or roll back unrelated import routes.

Interrupted image mapping is reconciled on startup without repeating native imports or uploads. Its image result is marked incomplete, supported UI can be delivered, and the report directs the user to reattach the original archive. Pending source whose imported avatar was ambiguous remains unassigned until the user reviews a specific destination. Cancelling leaves the source available. Archive bytes are not persisted; retained metadata cannot recover missing embedded bytes.

If a card was replaced before this version ever observed its original native stamp, the extension cannot prove the old ownership. Likewise, offline renames and external chat-file renames lack events that identify the old path. Reattach the original source/review the profile in those cases; a renamed chat starts with its default until preferences are loaded for the appropriate chat name. No disk scanning or prompt-based identity guessing occurs. Native ST operations are not a cross-file transaction; this extension cannot undo native importer asset overwrites.

## Remaining Witchcure rules

The supplied 19-rule source now has 16 adapted rules, two disabled separators and one empty input separator. New handling covers ten decorated portrait templates, removal of `@@move_top`, and bottom-of-message roster placement. The source's Charlotte checkbox has no action or checked-state styling; the port preserves its visible decoration and omits that unused control. The existing roster/report action supplies the provided Lua switch's presentation behaviour. Original Lua remains unexecuted, and modified or unrelated effects are not inferred from that switch name.

## Live acceptance

1. Update both extension folders and reload. On the existing Witchcure card, use **Attach original card images and UI** with the original CHARX, then **Apply imported UI profile**. Local-image rescan alone does not upgrade the retained panel definition. Existing choices remain unchanged until applying.
2. Check decorated named portraits, a reply without a roster marker, roster/report switching, and existing status/map panels. Verify saved reply text still matches the original.
3. Choose report mode, reload, and revisit the same chat. It should remain report mode. Open another chat/branch: it should use its own default. Test reset and export/load under Saved view preferences.
4. On disposable test characters, check a rename and a delete/reimport with a reused filename. Rename should preserve configuration; replacement should require fresh import/review. Avoid using real cards for destructive acceptance testing.
5. Check streaming and non-streaming swipes and the streamer gallery. Temporary open states should reset on reload while panel selection remains saved.

Automated fixtures exercise the real pinned ST formatter/regex engine, but mock native import/upload services. The separate pinned live ST acceptance pass now covers real imports, rename round trips, duplicate/delete, saved preferences, recovery and native generation. See LIVE-ACCEPTANCE.md for results and remaining boundaries.

## Portrait preset preferences — 0.8.0

Portrait layout, image/dialogue visibility, scene-settings visibility and appearance selection are saved per character/chat/configuration, including one-step display undo. Preference exports use schemaVersion 2 when these are present; v1 files remain supported. Configuration signatures contain field names, theme values and asset names, so review them before sharing. They exclude message text. Up to 200 records are retained. Import limits account for large signatures and UTF-8 files so a valid maximum-size export can be loaded again. Ordinary-image expansion remains transient; its global opt-in setting is saved separately.
