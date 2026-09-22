# Portable profiles and importer handoff — version 1

Portrait adapter v5 (Display Bridge 0.14.0) adds optional `appearance: {allowOriginal, defaultVariant}` and `portraitLabels` source fields. Required outfits use a valid named default; labels identify original portrait references in the editor without renaming assets. Older profiles retain As written. See [OUTFITS.md](OUTFITS.md) for validation, persistence and examples.

Display Bridge 0.4.0 and V3 Asset Sprites 0.3.0 implement a portable definition for the three existing reviewed adapters. This is the format foundation, not a general Risu script translator.

## Portable definition

```json
{
  "kind": "display-bridge-profile",
  "schemaVersion": 1,
  "adapters": [
    { "id": "media-panel", "version": 1 },
    { "id": "gallery", "version": 1 }
  ]
}
```

See `profile.schema.json` for structural validation and `examples/streamer-profile.json` for a ready-to-load example. The runtime validator is authoritative: it additionally compiles Witchcure's accepted HTML/CSS grammar before saving anything.

- `schemaVersion` versions the portable format. Each adapter has its own `version`. Unknown versions, unknown fields, repeated adapters, empty lists and unknown adapter IDs are rejected before activation.
- `media-panel` and `gallery` v1 refer to their reviewed built-in definitions: matchers, typed captures, templates, actions, bindings and asset lookup rules. They do not accept imported layout or code overrides.
- `witchcure` v1 additionally requires `source: {roster, report, styles}` and permits `map` and `status`. These are the supported original template strings and shared CSS. Each string is limited to 500,000 characters; the serialized definition is limited to 1,500,000 characters. Existing template, CSS, macro and local-asset validation applies. Arbitrary event handlers and resource URLs are rejected.
- `witchcure` v2 adds optional `portraits` (at most 50 exact name/template pairs), `autoRoster` and `cleanMoveTop` booleans. It retains v1 validation and requires the reviewed portrait grammar. Discovery only sets these options for the exact supplied rules; original Lua and output-edit scripts are never executed. v1 profiles continue to load unchanged.
- Definitions contain configuration only. The exporter omits character identity, enabled/disabled choices, runtime variables, selected posts/regions, chat state and provider image paths. Witchcure templates can contain card-authored text; exports are not anonymous or redacted copies of that text. Images are referenced by names and supplied separately by the card/provider.
- A standalone profile can be loaded and exported in Display Bridge settings. Loading stages it for review; applying replaces panel selections for that character. A card author can place the same object under `data.extensions.display_bridge_profile` in a V3 `card.json`. This release does not rewrite or repack the user's original CHARX.
- An explicit embedded profile takes precedence over discovery. An invalid explicit profile is rejected rather than silently replaced by a guess.

## Discovery from current Risu cards

As of V3 0.3.1 / Display Bridge 0.4.2, the provider also reads legacy `module.risum` from CHARX and combines its regex/trigger source with inline metadata before capture. The prior card.json-only discovery missed real Risu exports that store all their rules in that module. **Attach original card images and UI to current character** performs a new handoff for an existing card and offers recovered panels for review. Module lorebook duplicates and embedded module asset payloads are not imported by this reader.

When no explicit profile exists, the importer captures shared `backgroundHTML`, technical `customScripts` fields and trigger effect types/Lua source. It does not capture prompt fields, greetings, story state or images in this UI envelope. The envelope has `sourceVersion: 1`, a 2,000,000-character serialized limit, at most 500 custom rules and at most 100 trigger groups.

Discovery recognizes the original stream regex exactly; recognizes the supplied gallery Lua by its parser signatures (`extractAllDcBlocks`, `processDcBlock`, `PNUM`, `PCONT`); and uses the existing Witchcure roster/report rule identities plus map/status template markers. It compiles Witchcure templates before accepting them. Signature recognition selects our reviewed components; it never evaluates imported Lua. Other display rules and trigger effects are counted in the result, not translated or run. Equivalent cards with changed signatures may need an explicit profile.

## Handoff contract

`window.displayBridge.api.importApiVersion === 1` exposes synchronous `receiveImport(envelope)`:

```js
{
  handoffVersion: 1,
  avatar: 'the-exact-native-import-avatar.png',
  importId: 'unique-import-id',
  source: {sourceVersion: 1, risuai: {/* captured technical fields */}},
  images: {status: 'mapped', mapped: 12, issues: []}
}
```

The provider retains the source before native import. After the native importer yields exactly one new avatar, it queues the handoff for that avatar, maps images, then delivers. Changing the selected character during these operations does not retarget the import. Ambiguous/no-new-avatar results remain unbound and are not guessed onto another character.

Fresh recognized profiles activate automatically unless active global/character regex rules appear to render the same panels. Existing panel settings are preserved and receive a review candidate instead. This rule also preserves a previously disabled master checkbox. Invalid/unsupported definitions produce a report and do not enable new panels. Validation does not disable or edit the user's native regex rules.

Terminal acknowledgements are `applied`, `review`, `unsupported`, or `rejected`. Reports include selected adapter IDs, explanatory notes and image mapping counts/issues. The basic conflict scan checks known panel markers in active native rules; it is not a complete regex equivalence or compatibility analysis. Existing render-time placeholder checks continue to detect destructive conflicts.

Pending deliveries survive saved-settings reloads while Display Bridge is absent, older or temporarily unavailable. Delivery retries on provider/bridge readiness, APP_READY and the settings button. Successful delivery releases the queued raw source; accepted Witchcure templates and the result remain in Display Bridge settings. Keep the original card for diagnosis or future retranslation. A failed image-mapping step can still deliver the UI with an incomplete-image result. Retrying UI delivery does not re-import the character or upload images again.

Receipts are keyed by exact avatar and import ID, persisted in settings and capped at the last 100 deliveries. Repeating the same delivery within that window returns its original receipt without restoring old panel choices. Provider records retain only the latest handoff per avatar after delivery. Events announce readiness only; they carry no source payload. `window.v3sprites.displayImportStatus(avatar)` exposes delivery/result/error without raw source.

## Boundaries and recovery

- Use V3's **Import card with images and supported UI** command. Ordinary native drag/drop and other extensions' import paths are not intercepted.
- Replacing an existing avatar through native import is not supported by the existing exact-new-avatar association. Duplicate names still use V3's native collision warning. No update is guessed by name.
- A browser/process interruption before image mapping finishes leaves a `mapping` record or an unbound source record for diagnosis. Automatic native-import rollback, resuming interrupted uploads and manual reassociation are future lifecycle work. Pending deliveries after mapping can retry normally.
- Settings use SillyTavern's existing debounced save, not a crash-proof transaction. Character deletion/rename, group-chat ownership, schema migration and persistent UI preferences remain separate work.
- This version does not import arbitrary matchers/actions/bindings, run Lua, apply story-variable effects, insert missing roster markers into messages, or ensure all Risu features are translated. Adapter version 1 references the reviewed presentation definitions described in `ACTIONS.md`.

## Portrait/dialogue adapter added in 0.8.0

`portrait-dialogue` v1 is the fourth adapter; up to four distinct adapters may coexist. Its `source` configures literal fields or wrapped JSON, image-name mappings, appearance options and a constrained theme. See [PORTRAIT-PRESET.md](PORTRAIT-PRESET.md). Explicit embedded profiles remain preferred. Since 0.9.0, a bounded field/figure/div recognizer also accepts supported variations and derives field mappings; see PORTRAIT-RECOGNITION.md. It does not identify arbitrary cards by author or visual similarity.

V3 0.6.1 adds optional `ruleOptionsVersion: 1` and bounded per-rule `matchOptions` to captured source envelopes. Broader portrait recognition requires this metadata; old explicit profiles and exact legacy recognition remain supported.


## Portrait adapter versions

`portrait-dialogue` v1 supplies the fields/JSON, tagged, community and explicit scene formats. v2 additionally permits bounded per-tag style tokens and bottom placement for status blocks. Discovery and export choose v2 when these fields are present; older v1 profiles retain their existing appearance. See `PRESENTATION-STYLES.md`.


Portrait adapter v3 adds optional exact `imageMappings`, `metadataLabels` and boolean initial `defaults`. Discovery/export select the minimum required adapter version; v1/v2 remain supported and reject v3-only fields. See [MAPPING-EDITOR.md](MAPPING-EDITOR.md) for limits, precedence and reviewed merge behavior. The historical lifecycle limitations above are superseded by `PERSISTENCE.md` and `REPLACEMENT-RECOVERY.md`.


Portrait adapter v4 adds the bounded `scene-fragments` format. Its declarations describe reviewed input structures without embedded matchers or scripts. See `SCENE-ASSEMBLY.md`. v1–v3 remain supported; fragments require v4.
