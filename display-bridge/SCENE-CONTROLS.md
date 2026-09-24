# Scene information and local audio — provider 0.8.1

This page describes snapshot-only v7 profiles and the reusable drawer/media components. Explicit state profiles and reviewed automatic source assembly are also available; see [automatic import](SCENE-AUTO-IMPORT.md). Unknown values remain unavailable rather than invented zeroes.

In 0.21.0, layered scenes with stored state (`format.details.layers` and `sceneState`) have one Character information drawer outside message history. It shows the active branch's committed values and remains open during generation and swipes. Switching chats closes it; refreshing starts it closed. Snapshot-only profiles retain their per-scene drawers. The chat drawer does not depend on the portrait/dialogue visibility choices.

## Quick trial

Update both extensions, reload ST, then use **Import card with images and supported UI** to import `examples/scene-information-audio.charx`. It contains neutral geometric artwork, two guides and a quiet twelve-second original musical phrase. No API connection is needed.

1. Open **Guide information** below the scene. Alex has a recorded score, location, relationship and badge; River deliberately has unknown values. Close it with the button or Escape. Keyboard focus returns to its opener.
2. Use the browser audio player to play/pause, seek or adjust volume. Loop starts on; uncheck Loop to play once. Hide music hides the controls without interrupting playback; Show music restores them. Pause before hiding if you want silence.
3. Refresh and reopen the card. Drawer and playback start closed/stopped. Volume is saved with chat presentation preferences; the bar's Hide and Loop choices are session controls. The currently playing track/position is not saved or exported.
4. Switching cards stops playback. Generation and pending swipes keep the previous track; the completed scene selects the next one. Historical drawers keep their recorded data and cannot take over music.

In 0.19.0 there is one native browser audio player per Bridge instance, in a Chat music bar outside the messages. It requires an initial Play click, keeps the current track during generation, and selects the latest completed scene's track (or current committed state). Same-track updates keep playback position. Both v7 snapshots and state profiles can continue playback after Play. Pause prevents automatic resumption; an explicit no-track selection stops playback. Switching chats, disabling the extension or refreshing stops music. Hide leaves playback running. Loop is on by default and can be unchecked in the bar; this session choice overrides the older profile loop setting. Separate browser tabs have separate players. No full soundtrack is preloaded.

Automatic source assembly is available for the reviewed subset in [0.19.0](SCENE-AUTO-IMPORT.md).

## Profile configuration

Use portrait adapter **version 7**. Add `sceneControls` beside `format`, `variants` and `theme` in its `source`. This is supported only with `format.kind: "scene-fragments"`. The mapping editor preserves these fields and lists roster/badge images; configure the controls using Advanced preset JSON or profile import. A complete working export is `examples/scene-information-audio-profile.json`.

```json
"sceneControls": {
  "version": 1,
  "roster": {
    "title": "Character information",
    "labels": {"score": "Affection", "location": "Location", "relationship": "Relationship"},
    "entities": [
      {"id": "alex", "label": "Alex", "portrait": "guide",
       "badges": [{"id": "friend", "label": "Friend", "image": "guide-smile"}]}
    ]
  },
  "music": {
    "title": "Music", "volume": 0.3, "loop": true,
    "tracks": [{"id": "evening", "label": "Evening chime", "asset": "evening-chime"}]
  }
}
```

Either `roster` or `music` may be omitted. IDs must be distinct, stable ASCII identifiers starting with a letter. Up to 32 entities, 16 badge choices per entity and 128 tracks are supported. Labels are plain text, at most 80 characters. Asset names are exact registered names, at most 256 characters; they are not URLs or paths. Roster and badge portraits use the normal image mappings and appearance overrides. Audio references have a separate typed resolver and cannot become image rules. Volume defaults are 0–1; user volume has eleven steps. A gauge clamps visually to 0–100 while retaining the supplied score text.

## Explicit per-scene snapshot

Immediately after a complete scene's closing `</div>` wrappers, supply this optional annotation:

```html
<scene-state>{"roster":[{"id":"alex","score":57,"location":"Observatory","relationship":"Colleague","badge":"friend"}],"track":"evening"}</scene-state>
```

This is a declarative Bridge format for fixtures/manual profiles and the future state adapter, not a claim that existing Risu cards already emit it. It is recognized only when the profile opts into scene controls. Each scene owns its own snapshot; values never carry over from another message or later scene. A missing/null score, location or relationship is unavailable. Missing/null track selects no track; no player is shown. Scores are finite numbers bounded to ±1,000,000. Unknown entities, badges, tracks, extra fields and malformed/unfinished annotations are rejected; their original text remains native and a scene note explains the problem. Annotation scanning is bounded to 16,000 characters.

No counters are incremented and no story variables are saved during rendering. Displayed snapshots remain in the original message text, including any explicitly authored greeting; ordinary exports never copy the active chat into the card. Stage 6 must convert required source updates into correct revision-owned snapshots and connect model-visible dependencies. This milestone has no Lua or STscript execution.

## Audio files, recovery and export

The provider recognizes declared `.mp3`, `.wav` and `.ogg` assets and checks their embedded bytes before upload (MP3 frames, WAVE container, or Ogg Vorbis/Opus identification). Each file is limited to 32 MB. Decoder support still depends on the browser; header recognition is not a full decoder. Embedded archive/data-URI bytes only: no remote asset download, arbitrary path, playlist or guessed shared-gallery audio.

Audio is uploaded under unique `v3audio-…` names in a card-specific folder beneath ST's local `user/images` storage (provider 0.8.1) and shares the provider's existing character ownership and recovery transaction. Reattach an original archive to repair missing audio bytes. The existing 64 MB recovery-backup limit includes audio as well as images; large cards may still require a manual backup. Original files are retained; there is no automatic orphan cleanup.

Configured CHARX export includes local audio plus images and the v7 profile, with exact logical names and bytes. Older `user/files` mappings remain supported. Audio files use `assets/other/audio/` and `x-risu-asset`, keeping one archived copy per mapped path. Combined export is limited to 256 MB. Unsupported/missing assets are reported before a deliberately incomplete export. No current playback, live story state, permission grants or chat history is packaged. Video, models, fonts and arbitrary codecs remain unsupported.

Compatibility reports list declared/unresolved audio; the music control reports missing tracks and playback failures. Risu-source behavior is still reported as unconverted where appropriate. A working local player does not certify the original card's music-selection scripts or state logic.
