# Automatic scene import — 0.20.0

Use Display Bridge **0.20.0** with V3 Asset Sprites **0.9.1**. Recognized scene layout, roster, local music, state operations and a reviewed request-context wrapper assemble into one portable profile. It does not interpret arbitrary Risu scripts.

## Try it without editing JSON

1. Import `examples/scene-context-import.charx` with **Import card with images and supported UI**. This neutral card contains source rules and assets, with no embedded Display Bridge profile. The older `scene-auto-import.charx` remains a simpler v9 example.
2. Review the normal image-rule prompt. In Display Bridge, inspect **Compatibility and recovery → Scene import coverage**. A partial result stays pending until you choose **Apply imported UI profile**.
3. In a saved chat, open **Conversation state** and initialize/rebuild the reviewed state. This explicit step establishes the chat's starting values; importing a profile does not overwrite existing conversation history.
4. The character drawer shows the imported defaults. The model receives the declared current facts. Supported annotations in completed responses update those facts once. Rendering and incomplete streaming do not commit them.
5. Press Play on the native **Chat music** bar below the chat. It stays outside message history, continues during generation, and changes tracks when the completed response selects another track. Loop starts on; uncheck it for one-shot playback. Hide only hides the controls. Pause, switching chats, disabling the extension or refreshing stops playback. Refresh requires Play again.
6. Use **Export configured card (CHARX)** to share the applied profile, local assets and generated image rules. The recipient uses the same extension import command. Current scores, chat history, playback position and permission grants are not exported.

The fixture's state annotations include `<❤guide+3>`, `<MOVE_guide_Library>`, `<관계=guide=Friend>` and `<BGM=@BGM_02_Morning>`. These are examples from its declared source grammar, not universal commands. Merely giving a model current scores does not teach it the rules for changing those scores; the card's instructions must describe when to emit its supported annotations.

## Recognized source subset

Recognition uses structural signatures, not card titles or author names:

- Existing four-/five-field scene fragments provide backgrounds, hover portraits and dialogue.
- A `character-card` / `heart-percent` roster with matching `_p`, `_loc`, `_r` and dynamic `_as` image bindings provides declared entities and defaults.
- Exact supported location/relationship assignments and numeric score deltas become typed operations. Finite relationship alternatives and integer delta syntax remain constrained.
- Reviewed finite structured triggers become relationship-to-badge/image lookup tables. Unknown trigger groups are not executed.
- Literal conditional `bgm` branches bind declared local audio names. Supported BGM annotations become finite track selections and explicit stops. Background-to-track associations are not guessed.
- One reviewed `fm`/`Ta`/`Tb` context-wrapper program is recognized by its complete typed instruction sequence. Its roster template is filled from committed state in the request prompt. The bridge does not execute the original loops or rewrite earlier user messages. Greeting drawer markers are omitted only from display/request copies; user-authored messages and code examples are retained. This is a functional replacement for the wrapper, not a general macro engine or an old-Risu-chat migration tool.
- Declared cast-count corrections, literal image spelling substitutions and background aliases apply to scene fields only. Narration and saved output are unchanged. Missing background destinations remain unresolved and are reported. A source zero-cast closing rule allows a background-only greeting with ordinary prose following it.

Missing defaults stay unavailable. A score delta cannot operate on an unknown base. Missing declared assets, duplicate/ambiguous bindings, unsupported input/output rules, prompt macros and other triggers appear in coverage and require review. A rejected assembly leaves the existing layout intact and reports no successful state conversion.

The provider retains bounded default-variable and structured-trigger metadata for this inspection. It carries asset names/types/extensions, not file bytes or paths in the UI handoff. Original card text is preserved; macro names are inspected for unresolved dependencies. Default-variable values may themselves contain source template text, so retained source metadata should be treated as private card data.

## Versions and recovery

Display Bridge 0.21.0 also recognizes exact source rules that hide setup and roster notes. Their bounded display cleanup uses adapter v11. Existing layered profiles receive the layout, portrait sizing and chat-level state drawer fixes without reimport. Source percentage aliases set vertical position, not scale: the reviewed renderer uses 90% portrait height within the scene container.

Keep the card's lorebook attached and allow enough World Info/context budget for its output-format instructions. In live testing, missing/excluded instructions and a 300-token reply limit produced invalid or truncated scene markup. Increasing budgets is not a guarantee of correct model output. Unknown tags remain visible; for example, `<@BGM_01_DayStart>` does not match a source rule requiring `<BGM=@BGM_01_DayStart>`.

Completed tooltip captions such as `<ct="@guide"_"Happy"_"❤guide:5"_"Ready">` are display values, not score updates. Quoted `+`/`-` updates remain checked and committed. Previously rejected replies are not silently accepted by upgrading; regenerate the reply, or review the saved branch and explicitly rebuild Conversation state.

Profiles with request-context conversion or normalization use portrait adapter **v10**; request templates require `sceneState.version: 3`. Simpler state assembly still uses v9/state-v2. Earlier profiles continue to load; older extensions reject v10 rather than silently losing behavior. Update both extensions and reattach the original source to regenerate a previously imported profile. Initialize/rebuild Conversation state after reviewing the changed state definition.

State v2 adds bounded exact `literals`, `strictPrefixes`, and optional rule `values`, `insensitive` and `valueFormat: "unsigned-integer"`. These fields are declarative; they do not accept executable code or imported regular expressions. See the published JSON schema and `examples/scene-auto-import-profile.json`.

State v3 adds `request: {version: 1, greetingVariable: "fm", marker: "&&&", template: "...{declared_variable}..."}`. Only declared variable placeholders are allowed. Scene `format.normalization` contains finite count aliases, ordered literal asset-name substitutions and exact background aliases; optional `emptyZero` permits a source-declared background-only scene. See `examples/scene-context-import-profile.json`. Do not lower an adapter version to bypass validation.

An explicit embedded profile takes precedence. Reattachment stages changes when character options already exist; the normal keep-mappings option preserves image mappings and appearance choices. Repairing asset bytes alone does not replace the profile.

## Original-card limits

The inspected To Love Ru source yields 16 roster entries, 13 tracks, seven update patterns and 15 finite badge lookups. Its reviewed greeting/context dependency now converts, and its background-only greeting parses. Ten source normalization/closure rules are recognized. Two declared background-alias destinations are absent, one badge group is missing, and eleven other trigger groups plus three input/output rules remain outside support. Some original asset references also contain punctuation/encoding mismatches; use exact image mappings rather than assuming a different asset.

This remains a **partial import requiring review**. Ordinary scene/state/music functionality is testable; specialized poses and dynamic sound interactions are not fully ported. A single-image/offset tuple is no longer misread as a normal hover pair. Random initialization, destructive source-history rewriting, general Lua/STscript and arbitrary conditional greetings remain unsupported. Stage 8's combined release acceptance remains separate.
