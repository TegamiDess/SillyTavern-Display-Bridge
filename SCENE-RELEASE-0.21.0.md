# Scene comparison fixes — 0.21.0 / provider 0.9.1

Live comparison exposed clouds painted over the room, undersized portraits, redundant message controls and a score-caption collision that prevented a completed reply from receiving stored state.

- Reviewed layered scenes now place sky/cloud images behind an opaque inset room. The scene uses available chat width, places its clock inside the frame and omits generic Visual layout/reset controls.
- Percentage aliases retain their source vertical positions. Portrait height is 90% of the scene container; alpha-aware hover and individual dialogue expand/hide controls remain.
- Layered stored-state scenes share one Character information drawer outside history. It follows the current branch, retains its open state during generation and stays independent of portrait/dialogue visibility. Snapshot-only scenes retain historical drawers.
- Exact source setup/roster deletion rules convert into optional v11 display cleanup. Source messages, code examples and model request text are preserved.
- Colon score captions in the third tooltip field no longer collide with quoted score-update prefixes. Actual deltas and malformed updates remain validated; no automatic acceptance of old failed replies is introduced.

Validation: 178 unit tests and 149 browser checks passed. The browser suite uses the native ST formatter/regex engine with a simulated host. A live MiMo streaming swipe in the isolated ST instance rendered two portraits, committed state, and survived page reload. Risu supplied the comparison scene and layout evidence. No production installation was changed and no commit or push was made.

This is closer visual and state parity, not full Risu compatibility. Missing assets, unsupported specialized interactions and model-generated malformed tags still require review. The model emitted `<@BGM_01_DayStart>` once; the source expects `<BGM=@BGM_01_DayStart>`, so the unknown tag correctly remains visible. Keep the lorebook attached and its format instructions within the context/World Info budget. Stage 8's combined acceptance remains separate.

Update Display Bridge and refresh ST. Existing layered profiles receive the renderer/state fixes immediately. Reattach/review the source to add the optional note-cleanup rules. For an older reply rejected by the caption bug, regenerate it or explicitly rebuild the reviewed branch using Conversation state; upgrading does not rewrite chat history.
