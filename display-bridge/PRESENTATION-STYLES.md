# Common Afternoon style import — 0.11.0

Matching fixed-speaker/tagged layouts can now carry their own colours and dimensions into the reusable preset. No author or character names are built into the recognizer. Ordinary prose stays in ST's native formatting; display controls remain shared at the bottom of the latest assistant message.

## Import and upgrade

- New source-only CHARX imports through **Load assets and UI** discover these values automatically when the supported template and stylesheet roles match.
- Existing applied profiles are not silently restyled. Use **Attach original card images and UI** in Display Bridge, review the result, then **Apply imported UI profile**. A local-image rescan alone does not rediscover UI styling. Existing explicit profiles take precedence over inferred styling; edit those profiles deliberately.
- Updating the extension does not rewrite original card archives, stored messages or story variables. Applying a changed preset can reset the presentation choices bound to its old configuration.
- Portable `portrait-dialogue` profiles use adapter `version: 2` if an entry has `style` or status `placement`. Version 1 profiles still load. Older extension builds cannot load version 2.

## Supported stylesheet input

Discovery reads plain `<style>` elements from retained `backgroundHTML`, capped at 100,000 characters and 2,000 supported selectors. It inspects ordinary class selectors, tag-plus-class selectors and descendant combinations (up to six parts / 512 characters). Grouped selectors, source order, specificity and `!important` are accounted for within this subset. Custom properties inherited through the recognized template tree can supply bounded scalar values; direct `var(--name)` chains stop after eight references.

The extractor maps recognized container, portrait, dialogue box, dialogue text and nameplate roles. It reads a supported two-colour gradient and detects the common crossed repeating-gradient pattern, rendering the preset's own gradient/gingham implementation. It does not copy selector strings or CSS declarations into the page.

Conditional/media rules, pseudo-element decorations, fonts, animations, filters, arbitrary transforms, scripts, resource URLs and unsupported CSS values remain omitted. `::before` is inspected only to identify the common gingham pattern. Malformed or oversized shared styles fall back to the built-in appearance with a compatibility note. This is a bounded reconstruction, not pixel-for-pixel CSS conversion.

The anchor-free tagged grammar also accepts the inert `m` regex flag (including `gm`). Recognized status rules can retain a single `<move_bottom>` directive before or after their supported flags; other directive/flag combinations still need review.

## Portable style fields

An optional `style` object belongs to each dialogue, dynamic or narration entry in `format.entries`. Unspecified fields use preset defaults. Status entries cannot have styles.

| Fields | Accepted values |
| --- | --- |
| accent, background, backgroundEnd, text, nameBackground, nameText | Six-digit hex colours |
| pattern | plain or gingham |
| borderWidth / radius | 0–8 / 0–40 px |
| padX / padY | 8–48 / 8–36 px |
| fontSize / nameFontSize | 12–24 / 11–22 px |
| lineHeight / fontWeight | 1.2–2 / 400–800 |
| nameTilt | −5 to 5 degrees |
| width | 50–100 percent of the preset article |
| stageHeight | 200–720px or 25–80vh |
| portraitHeight | 120–720px or 20–70vh |
| portraitWidth | 100–900px, 20–90vw or 20–100% |

Numbers carry the units listed above. The three dimension fields use strings such as `"50vh"`. Portraits are additionally constrained by the local stage width. Only a status entry may specify `placement: "bottom"`; this relocates its rendered panel, never the stored reply.

Per-entry styles are display data, separate from the shared action configuration. Different speaker colours therefore do not create separate visibility settings. Source appearance selectors, world settings, Lua, STscript and greeting selection are unchanged and remain outside this milestone.

Since 0.12.0, declared image/appearance mappings can be edited through the mapping editor alongside these styles. Compatible chat choices survive applying a changed preset; a removed selected option falls back to As written. Source appearance scripts themselves remain outside the supported runtime.
