# Scene information and audio testing build — 0.17.0

Display Bridge 0.17.0 / V3 Asset Sprites 0.8.0 implement stages 4–5 as reusable, explicitly configured components. This is not complete To Love Ru import support.

## Added

- Character-information drawer: configured portraits, score/affection, location, relationship and badges. Missing values remain unavailable. Each scene displays its own recorded snapshot. Close/Escape restores focus.
- Local MP3/WAV/Ogg assets: bounded header validation, isolated upload names, typed resolution, missing-file reporting, repair/undo and portable CHARX export.
- One user-started player per Bridge instance, with track selection, play/pause, loop, volume and visibility. No soundtrack preloading or autoplay. Hiding music or leaving its scene stops it; showing/reloading does not restart it.
- Version 7 profiles preserve these settings through the editor and export. Music visibility and volume use existing character/chat presentation persistence.
- ST token-count dry runs are excluded from generation gating; offline attempts do not leave playback stuck disabled.

## Try it

Update both extension folders using [the installation guide](START-HERE.md), then reload ST. Import `examples/scene-information-audio.charx` through **Import card with images and supported UI**. Open **Guide information**, try **Play music**, then Pause/volume/Hide. Refresh and reopen the same chat to check saved volume and stopped playback. The fixture includes only neutral artwork and a generated short chime; no API connection is needed.

[Configuration and limits](display-bridge/SCENE-CONTROLS.md) include the full profile shape and per-scene annotation. A matching profile export is provided beside the CHARX.

## Evidence

- 146/146 unit tests passed, including profile validation, snapshot bounds, audio headers/paths, preference isolation, player invalidation, rejected/late playback and archive deduplication. Fifteen older state-contract tests remain design-only.
- 136/136 browser checks passed. New coverage includes historical/unknown drawer values, keyboard dismissal, generation/dry-run gating, hidden/missing audio, and real provider import/export/reimport plus repair/undo against a mocked local transport. Audio bytes remain identical across these operations.
- Native isolated ST 1.15.0: imported the fixture through ordinary prompts, declined regex execution permission, opened/closed its drawer, played the actual local WAV, paused it, changed volume, hid/showed the player and reloaded/reopened the same chat. Volume remained at 2/10; playback remained stopped. An offline swipe stopped playback; returning to the completed swipe restored the enabled Play control.
- Only the isolated test installation was updated. No production installation changes or GitHub push were made.

Native decoder testing used WAV; MP3/Ogg signatures are covered technically, not an exhaustive codec/playback matrix. Automatic original-card state updates and music selection, conditional greetings, prompt/lorebook dependencies and complete source-based assembly remain stages 6–7. The historical full release acceptance matrix is not replaced by this focused milestone.
