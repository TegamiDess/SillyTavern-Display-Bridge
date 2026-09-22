# Portrait source recognition — Display Bridge 0.9.0 / V3 0.6.1

Import can now construct the portrait/dialogue preset from a supported rule family without a prewritten UI profile. The rule is inspected as data; its regex, replacement HTML and scripts are never executed by recognition.

## What can be recognized

A bracketed or brace-delimited, named block with exactly three pipe-separated `key:value` captures. Source keys may differ and appear in any order. Each capture must be a negated character class excluding exactly the pipe and closing delimiter; `*`, `+` and their lazy forms are supported. Numbered bindings `$1`–`$3` determine which field is speaker, dialogue and portrait.

Supported replacement structures:

- `figure → img + figcaption → b/strong + p`.
- `div.portrait-dialogue → img + div.dialogue-box → span.speaker + div.dialogue`.
- The corresponding caption/name/text alternatives can be combined. Whitespace, HTML tag case, single/double quotes, class names and attribute order may vary within the supported structure.
- Image `src` may be a single numbered capture or `{{asset::$N}}`. Optional `alt` is empty or the speaker capture. Class attributes are accepted as labels, not imported CSS.

The recognized contract becomes a normal portable profile with named field mappings. Images continue to resolve through the local asset provider. The preset supplies its own layout and display controls; it does not infer clothing choices, source styling, world settings or Lua behaviour. Explicit profiles still take precedence.

## Deliberate boundaries

This release does not recognize arbitrary `.*?` captures, named captures, lookarounds, anchors, regex operators outside the supported field grammar, custom flags, positional formats, wrapped JSON regexes, extra metadata captures or extra controls. Additional macros, arbitrary CSS, event handlers, remote image expressions and extra markup are declined with a per-rule reason. Explicit preset setup remains available for supported data formats that discovery cannot prove.

Source-only recognition is all-or-nothing across candidate portrait rules. Equivalent duplicate rules coalesce. If candidates imply different configurations, or one candidate contains unsupported behaviour, no portrait preset is automatically chosen. Other independently supported adapters remain available.

This is a tested pattern family, not an author detector or a claim that similar-looking real cards are compatible. The new fixtures are independently authored neutral examples. Real-world coverage remains to be established from appropriate technical fixtures.

## Importer metadata and recovery

V3 0.6.1 preserves bounded `ableFlag`, `flag` and `flags` metadata in each rule's `matchOptions`, with `ruleOptionsVersion: 1` on the captured envelope. Malformed non-scalar options are represented as invalid markers, not copied wholesale. Discovery accepts only boolean flag switches and absent/empty/global-only flag strings for this family.

Older retained envelopes lack this assurance. Broader recognition asks for the original card to be attached again through the updated importer. **Rescan local images** cannot recover missing source metadata. The prior exact reference pattern and existing explicit profiles remain compatible.

Review results under **Display Bridge → Compatibility and recovery → Imported rules and effects**. A successful rule explains that its bindings were recognized. A declined rule gives the missing requirement instead of claiming the card is fully supported.

## Validation

Three neutral CHARX fixtures contain source rules and embedded images, with no explicit profile: figure bindings in changed order, a div/brace variant, and unsupported case-insensitive flags. Unit/browser tests cover these paths, ambiguous multi-rule configurations, malformed metadata, source privacy, explicit-profile precedence and complete import handoff. The native test install additionally exercises actual CHARX import and image loading.
