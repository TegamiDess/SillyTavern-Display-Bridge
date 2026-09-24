## 0.8.1 — card media folders

New raster image and audio uploads use ST's media endpoint with `V3 - Card name - unique identity` folders under `user/images/`. Exact asset mappings and unique filenames remain; same-named cards do not share folders. Legacy loose mappings remain valid. Repair/rollback use folder uploads. AVIF retains the file endpoint because ST's media allowlist excludes it. Recovery journals remain in `user/files/`. No automatic move/delete is performed.

**For step-by-step setup, use the [beginner import guide](../START-HERE.md).** These notes contain technical details and release history.

## Audit patch 0.6.2

Recovery completion now compares against the last verified revision instead of accepting later edits. Replacement and restoration recheck after journal persistence. Removed redundant full-card File copies; PNG avatar fallback and isolated native import remain supported. Pair with Display Bridge 0.10.4; see the bundle audit report.

# V3 0.6.0 — isolated imports and replacement recovery

Pair with Display Bridge 0.7.0 and include recovery.js. New native imports receive an avatar-only archive; auxiliary images use separate provider files, including backgrounds. Selected-card replacement saves a verified local recovery point with old mapped image bytes. Restore refuses later edits and unverified writes; Export and Keep-current provide a manual recovery path. See the companion REPLACEMENT-RECOVERY.md for scope, storage, the 64 MB backup limit and native-import-route boundaries.

# V3 0.5.1 live acceptance fixes

Pair with Display Bridge 0.6.1. Renaming back to the original avatar preserves ownership instead of retiring the current identity. Native image replacements inside code examples are restored as literal source, including syntax-highlighted markers, and cannot consume captures intended for images outside the code block. No settings/profile schema changes. See the companion LIVE-ACCEPTANCE.md.

# V3 0.5.0 lifecycle update

Use with Display Bridge 0.6.0. Include the new `character-lifecycle.js` file. Native create-date identity prevents a replaced/deleted avatar filename from borrowing an older card’s enrollment, mapped images, reports or pending delivery. Live ST rename events transfer those records without moving files. Interrupted mapping resumes with an explicit incomplete-image result; reattach the original archive for lost bytes. Unassigned sources can be reviewed and attached to the selected card, without native reimport. No automatic character-wide file/rule rollback or asset deletion is performed. See the companion PERSISTENCE.md for boundaries and acceptance checks.

# Compatibility reporting — V3 0.4.0 / Display Bridge 0.5.0

The paired release adds an exact-avatar, read-only compatibility report at `api.getCompatibility({avatar})` (`compatibilityApiVersion: 1`). It reports retained source origin, declared/mapped/missing image counts and names, installed/disabled/modified image rules, ST permission, the last rule-install outcome and UI delivery status. It does not probe URLs or change permissions. Older imports report missing provenance as unknown.

`recovery` version 1 supplies explicit selected-avatar `attach`, `rescan`, `resync` and `retry` operations. The source picker captures its target; rescan and rule installation keep existing confirmations. A selected-card retry does not deliver other queued imports. Original source is needed to recover missing archive bytes.

Image-rule rejection is not a whole-card compatibility failure: larger Witchcure templates belong to Display Bridge. The paired report correlates matching rule numbers with the delivered UI discovery result, when both belong to the same import.

# V3 Asset Sprites 0.3.1

## Fixed CHARX source discovery

Risu can store regex and triggers in root `module.risum` rather than `card.json`. This release decodes the legacy magic-111/version-0 format and combines its regex/trigger source with inline metadata for our technical import pass. Duplicate identical entries are removed; inline entries are kept first. The original archive passed to SillyTavern is unchanged. Lua/code is never executed, and duplicated lorebook content/module binary assets are not imported by this reader.

The reader checks headers, UTF-8/JSON, lengths, rule counts, asset framing and end markers. It limits module files to 4,000,000 bytes and their JSON payload to 2,000,000 bytes. Unsupported or malformed modules produce a visible source error while image import can continue. Do not treat an unsupported result as a panel-toggle problem.

Format sources: [RisuAI module reader/writer](https://github.com/kwaroran/RisuAI/blob/main/src/ts/process/modules.ts), [RisuAI RPack mapping](https://github.com/kwaroran/RisuAI/blob/main/src/ts/rpack/rpack_js.js), and the byte-permutation data in [rescuetycoon/risup](https://github.com/rescuetycoon/risup/blob/main/lib.js). The user-provided risup decoder was run independently against the real archive and its output compared with this reader. Only protocol data is carried into the bounded reader; the external CLI is not required at runtime.

## Recover an existing import

Select the intended card and use **Attach original card images and UI to current character** from V3's menu. Select the same original CHARX and confirm that the displayed source/target are correct. This retains the chosen avatar, uses the existing image-mapping/rule workflow, and sends recovered UI source for review. It does not run native character import or replace the prompt. Apply the recovered profile in Display Bridge when ready. Previously delivered unsupported receipts do not block this explicit new attachment operation.

## Literal named image HTML

The new **Declared bare-name HTML images** rule recognizes simple `<img src="Declared Name">` and single-quoted equivalents for exact declared local image names. It replaces those tags with V3's existing image markers before native HTML insertion. Ordinary URLs, unknown names and tags with additional attributes are left alone. The rule is offered through the existing install/update approval; it never silently enables character regex permission or changes global rules.

For an already enrolled card, **Enable / rescan current card images** or the attachment workflow offers the new rule. In SillyTavern's Regex extension, allow character regex for this card and leave the new rule enabled. Reload/open the chat afterward. Without that permission, native SillyTavern can still request a bare image URL before our later DOM repair. Display Bridge 0.4.1's inert rendering fix remains useful but cannot prevent the native first pass.

## 0.6.1: source recognition metadata

Paired with Display Bridge 0.9.0, captured UI envelopes now preserve bounded `ableFlag`, `flag` and `flags` values in `matchOptions` and identify this with `ruleOptionsVersion: 1`. This lets the bridge decline custom matching options instead of silently dropping them. Malformed nested payloads are not retained. Existing image mapping and recovery behaviour is unchanged. Reattach the original card to refresh older retained source; local image rescan cannot restore missing rule metadata.


## 0.6.3 — mapping editor asset inventory

`window.v3sprites.api.listImages({avatar})` is a read-only companion to `resolveImage`. It requires an exact uniquely existing, enrolled, active avatar and returns `{status, images: [{name, status}], truncated}`. Status is available/unavailable at the list level and resolved/missing per name. Names combine declarations and mapped keys, are unique, bounded to 256 characters, and capped at 2,000. It does not return local paths, enroll characters or alter files. Display Bridge 0.12.0 uses it for mapping suggestions and retains manual entry with older providers.

## 0.6.4 — image-rule exclusion clarity

Risu control/placement directives in rule flags are excluded before JavaScript regex construction. The import notice distinguishes image-only exclusions from Display Bridge panel support; a status rule using `<move_bottom>` is not sent to RegExp as a flag. Original source is retained for UI discovery.

## License

Licensed under AGPL-3.0-only. See [LICENSING.md](LICENSING.md), [LICENSE](LICENSE) and [third-party notices](THIRD-PARTY-NOTICES.md).

## 0.6.5 — repeated metadata reads

Reuses the most recently parsed serialized card during image/rule reads. Changed serialized data is reparsed and live metadata is read on every call. The cache holds one revision only. Install the complete folder, including the new `card-data.js` module. Import, recovery and permissions are unchanged.

## 0.7.0 — portable configured CHARX

Adds **Export configured card (CHARX)** and a versioned image-rule payload. Paired with Display Bridge 0.15.0, exports include the applied UI profile, mapped local images, avatar and portable rule definitions. Import validates definitions before native writes and rebuilds local markers through the existing reviewed rule workflow. Disabled/removed rules survive the round trip; permission grants do not. Image-only exports explicitly skip UI discovery. See [sharing and limitations](../EXPORT.md).

## 0.7.1 — Risu asset-library classification

Configured export labels generic named images `x-risu-asset`, so Risu imports them into its asset library. The same archive remains readable by this provider. Main avatar and explicit special/custom asset roles are preserved; image bytes are not duplicated. Re-export an older package to apply the fix. This does not convert Display Bridge profiles into Risu scripts.

## 0.8.0 — local audio assets

Declared MP3/WAV/Ogg assets are checked by their bytes and imported into unique local `user/files` paths (32 MB per track). No remote fetch or shared-gallery guessing. Audio shares character lifecycle, replacement backup/restore and configured CHARX export, while the image resolver remains image-only. `api.audioApiVersion: 1` adds exact-name `resolveAudio({avatar, reference})`. Image API version 1 is unchanged. The recovery backup limit includes all media. Playback is owned by Display Bridge; importing audio does not execute Risu music macros.

## 0.9.0 scene handoff

The bounded UI envelope now preserves asset descriptors, default-variable source and structured trigger fields for reviewed automatic scene assembly. Default values can contain template text; treat retained source as private card metadata. Explicit profiles retain precedence. No imported trigger code is executed. Use Display Bridge 0.19.0 for generated v9 profiles.
