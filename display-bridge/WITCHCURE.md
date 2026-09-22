# Witchcure panels — Display Bridge 0.3.1

Supported views: roster `[명부]`, evaluation report `[평가 보고서]`, the 17-field counselling status block, and `<MAP>location|danger|progress|log</MAP>`. The adapter preserves the supplied templates, relevant styles, text and named image references.

## Update and enable

1. Replace the installed `display-bridge` folder with the current package and reload SillyTavern. Keep V3 Asset Sprites 0.2.1; no provider update is needed for this release.
2. Select Witchcure. Enable Display Bridge and **Witchcure panels (roster, report, status, map)**.
3. If the saved attachment came from 0.2.x, attach the original Witchcure JSON again once. Earlier attachments saved only roster/report and styles. A full card export can include all four templates. Diagnostics list the available panels.
4. If the card itself retains those templates and shared styles in its Risu extension metadata, an attachment is unnecessary. An attachment stores only the supported templates and styles, never prompts, greetings, Lua or image bytes.
5. Images still use V3 Asset Sprites' existing enrollment/mapping. Attaching JSON to Display Bridge attaches UI templates only; it does not import images.

## Behaviour and source fidelity

Roster/report behaviour from 0.2.x remains, now with mode state supplied by the shared action engine. Portrait detail pages stay within the message panel; keyboard activation and Escape remain available.

Status binds all 17 fields: witch name; stability, trust, risk and affection; trigger and deadlock descriptions; assistant name, stability, cooperation, status and synergy; date, time, location, goal and goal progress. Gauges normally use 0–10 and progress 0–100. Finite numeric values beyond those ranges still render: the original number remains visible, while the fill is clamped to 0–100% of the bar. Text is inserted as text nodes after template validation, and numeric captures alone may populate bar widths. The status panel follows the source's `@@move_top` request within its own message.

The map shows location, danger (0–10), exploration progress (0–100), and log. It has a collapsible summary, full-map view and all nine original region detail views with return controls. The inactive sample correctly shows no exploration underway; browsing a region does not start exploration. Fixed-position overlays are adapted into contained, scrollable message panels, including at narrow widths. Checkboxes are hidden implementation details; labels/buttons are the accessible controls.

Roster/report and map render in the latest two message positions. Status renders in the latest six. Older matching blocks are hidden in the temporary display copy; stored text is untouched. Non-numeric and non-finite fields remain in their ordinary display; finite out-of-range values no longer reject the panel.

## Assets

Images resolve through the read-only V3 provider with explicit avatar identity. The supplied full JSON includes assets that were absent from the earlier export. Exact source mismatches have explicit Witchcure-only aliases: unselected witch/assistant, inactive exploration icon, the starlight-region icon, floating-island icon/banner, and Vivian's Korean name punctuation. Exact references always take priority. Missing images show labeled placeholders.

The map's original embedded 8×8 PNG border is explicitly permitted as one reviewed literal. This does not permit arbitrary CSS URLs or remote resources. Other unsupported template elements, event handlers, macros and resource expressions fail compilation and leave ordinary display available.

## Boundaries

This adapter does not execute the original Lua. It implements the known presentation switch declaratively. Adapter v2 reproduces the exact automatic-roster rule in the display, without adding markers to stored messages or executing `editoutput` source. Status/map still require matching message text. It also decorates the ten recognized portrait tags and removes the display-only `@@move_top` directive. It does not change the character's story selections or scores.

Roster/report choice is saved per chat from 0.6.0; temporary detail/map controls reset after a browser reload. See PERSISTENCE.md. Disable a panel adapter to restore its native display, or disable Display Bridge to restore all owned displays. The streamer window and gallery remain independent options.

The browser suite uses the pinned SillyTavern formatter/regex engine with a mock chat and neutral detail prose. Actual imported-card behaviour with other installed extensions still needs a live smoke test. The offline preview includes supplied artwork and neutral detail prose; it is not a replacement character card.
