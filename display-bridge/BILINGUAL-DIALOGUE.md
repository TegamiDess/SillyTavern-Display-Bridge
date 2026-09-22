# Bilingual tagged dialogue — 0.14.2

Supported fixed-character and dynamic portrait dialogue tags accept a trailing translation in ordinary parentheses or kagikakko. No profile edit is required for existing supported tagged layouts.

```text
<guide>"Ohayou!" (Good morning!)</guide>
<guide>"Ohayou!" 「Good morning!」</guide>
```

The translation appears first. Hover over the dialogue box or focus its text with the keyboard to reveal the original; moving away or removing focus restores the translation. Clicking the focusable text may keep the original visible until focus moves elsewhere. Both versions reserve the same layout space to prevent hover-induced jumping. This is a per-box interaction, not a global language setting.

A plain line such as `<guide>"Mmph—! Nn... nnh..."</guide>` displays normally. The entire dialogue can also be quoted, as in `"Ohayou! (Good morning!)"`. Balanced parentheses inside the translation are supported. Empty, incomplete or ambiguous pairs remain visible as unsplit text. A missing closing tag still waits for completion during streaming.

This follows the card's text convention; it does not translate text or detect its language. Ordinary trailing parenthetical asides matching the same structure are treated as translations too. Narration and composed-scene text do not use this feature. Normal chat display retains both texts, and saved messages/prompts are never rewritten.

Previously, a quoted-dialogue entry required the final character before the closing tag to be a quote. A translation after that quote caused the panel to fall back to ordinary text. The parser now accepts a completed quoted line with the translation suffix while retaining text/markup bounds.
