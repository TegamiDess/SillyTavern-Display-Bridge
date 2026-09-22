# Compatibility and recovery — 0.5.0

Install Display Bridge 0.5.0 and V3 Asset Sprites 0.4.0 together, then reload SillyTavern. Select a single-character chat and open **Extensions → Display Bridge → Compatibility and recovery**.

## Reading the report

- **Last inspected source:** format, inline rule count and legacy module decoding/counts. Earlier releases did not retain all of this information; unknown means not recorded, not an import failure. Attach the original card to obtain a new report.
- **Saved UI profile result:** the last result retained by Display Bridge. Importer delivery is shown separately, since a new attachment can fail while existing working panels remain intact.
- **Panel readiness and actions:** current panel selections, bridge switch and Witchcure template availability. A ready adapter still needs matching text in the message. Status/map are optional template parts; missing parts are evident in the available-template list. Reviewed controls are presentation-only. Decorative gallery links for writing, settings and unrelated galleries are omitted; arbitrary source Lua and story/output actions are not run.
- **Images and image rules:** declared asset mapping counts and up to 100 missing names, plus unresolved references/load failures in mounted visible widgets. A mapping is not proof the file still loads. This version does not perform a network scan of every mapped image. Regex permission and extension enablement are separate from installed, disabled and modified/unapproved rules. Disabled/unapproved counts may overlap.
- **Imported rules and effects:** each retained source rule is adapted, disabled, not translated or not run. Macro names are listed without their arguments; only reviewed adapter behaviour is available. Effects are identified by type and never executed as imported scripts. When an explicit profile exists it supplies the definition; other source rules are not discovered into it.
- **Current display and potential conflicts:** live parse/render problems and native regex rules whose marker patterns may overlap. These are potential conflicts, not proof that a rule ran; inspect its placement and permission in ST. Import notes describe a historical attempt and can remain after a later image repair.

The image provider accepts only simple image-producing replacements. Thus “Card rule N: HTML other than a simple image element is unsupported” can coexist with a successful Witchcure port. Matching rule numbers in the report explicitly say when Display Bridge handles the panel. The correlation is suppressed if the most recent provider attempt has not delivered that discovery result.

## Recovery actions

| Action | Effect |
| --- | --- |
| Attach original card images and UI | Pick the original CHARX/JSON/PNG for this existing character. Mapping and discovery run again without native character reimport or prompt replacement. Existing panel choices stage the discovered definition for review. |
| Rescan local images | Revisit retained asset metadata and available local files. Cannot recreate missing CHARX bytes; attach the original file for those. |
| Review / reinstall image rules | Review V3's installation confirmation. Replaces only owned rules, preserves matching disabled states and unrelated rules. Does not grant character regex permission. |
| Retry this card’s UI delivery | Retry this avatar's pending handoff without uploading assets or reimporting the character. Shown only for pending delivery. |
| Rebuild current panels | Retry rendering and image loads using existing mappings and current message text; stored messages remain unchanged. |
| Restore previous panel settings | Undo the last profile application or manual Witchcure-template attachment. Restores one saved set of panel selections, enabled state and templates; consumes that undo point. Does not restore files, native rules or ST permissions. |
| Export compatibility report | Download diagnostic JSON with identity, labels and results, excluding prompt/chat fields, template/Lua source and mapped image paths. Labels/error text can contain card-specific information; review before sharing. |

Recovery controls capture the inspected avatar and reject a different selected card when clicked. The original-source file picker captures that avatar as well; its confirmation names the destination even if selection changes while choosing a file. Running mapping operations remain serialized by V3.

Turning the bridge or an individual panel off remains the simplest way to restore the native message display. Profile restore is a single undo point saved on future profile applications/attachments; updating to this version cannot retroactively create a backup of earlier settings.

For unfinished mapping or failed module decoding, use original-source attachment after any running operation finishes. This release does not automatically reconcile unbound imports, deleted/reused avatar filenames, or replacement-card ownership. Those belong to the lifecycle work order.

## Suggested live checks

1. Open an existing working Witchcure card. Its panel state should be correct even if source/discovery details say “not recorded.”
2. Attach its original CHARX using the recovery button. Confirm the correct destination and review image-rule installation. Expect decoded module counts, per-rule results and a pending UI profile where prior choices exist. No new character should appear.
3. Apply the UI profile, then use **Restore previous panel settings**. Confirm the earlier switches/templates return and chat text remains unchanged. Reattach/apply again if desired.
4. Check the image section: distinguish approved rules with denied ST permission from missing assets. For the expected Witchcure HTML exclusions, verify that recognized panel rules say “Panel handled by Witchcure.”
5. Switch cards and confirm each report and recovery action belongs to that card. Check stream/gallery and Witchcure rendering, swipe and streaming as usual.

Automated validation uses the pinned ST formatter/regex engine and neutral cards. Native character creation/upload endpoints are mocked; these checks do not replace acceptance in the live installation.
