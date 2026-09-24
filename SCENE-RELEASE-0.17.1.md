# Scene controls and card folders — 0.17.1 / 0.8.1

Follow-up: [0.17.2](SCENE-RELEASE-0.17.2.md) fixes mouse interception of the dialogue controls and documents the audio automation crash reproduction without SillyTavern or extension code.

- Collapse dialogue hides the complete speech surface, including its nameplate. Show dialogue remains outside the surface. Expanding restores dialogue; collapsing exits expanded layout.
- Scene music uses browser-native play/pause, seeking and volume controls, plus Hide/Show. Hiding the object leaves playback intact; Pause stops it. No manual track dropdown remains. The explicit scene snapshot supplies its track. Automatic source background-to-track selection and continuous transitions remain state-adapter work.
- The neutral music fixture now contains a quiet, original twelve-second plucked-chord phrase, with looping disabled. Reimport the updated CHARX to obtain the new bytes/defaults; updating the extension alone does not replace an existing card's soundtrack.
- New image/audio uploads use card-named, identity-separated folders under `user/images/`. Legacy paths remain supported. AVIF and recovery journals retain the file endpoint. See the storage section in [the beginner guide](START-HERE.md).

146 unit tests and 136 browser checks passed, including native player mounting, generation gating, hidden controls, complete dialogue hiding and mixed-media import/export/repair/undo. Same-named cards receive distinct directories. Native ST 1.15.0 imported all eight fixture assets into one card folder. Its verification button exercised full dialogue hiding/restoration, decoded twelve-second non-looping WAV playback, Hide/Show without pausing, and final Pause. One earlier in-app tab crashed during UI automation; a fresh tab completed these checks. Original-card state/script translation is still deferred; this does not claim complete To Love Ru compatibility.
