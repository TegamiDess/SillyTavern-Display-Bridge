# Scene recovery and desktop controls — 0.21.1 / provider 0.9.1

Failed native swipes could return to the original accepted reply while leaving a cached “no accepted state” warning. The state reader now notices the restored tail revision without requiring another host swipe event. It reuses the saved accepted state; it does not accept failed output or rebuild the journal automatically.

- Valid free-text location updates for characters outside the profile's tracked roster are skipped individually. Other valid updates in the reply still apply. A bounded console warning identifies the skipped character once per active chat, without logging the location or message. The skipped tag is hidden in the rendered display; stored source text remains intact. Malformed, overlapping, arithmetic and relationship updates retain strict validation.
- Music, current character information and **Rebuild scene state** share a collapsible **Scene controls** panel on the right. It lives outside the chat/composer layout and opens by default when the desktop layout has enough margin. Rebuild is disabled during generation. Startup profiles that require a choice still use Conversation state settings for that choice.
- Rebuild explicitly replays the current saved branch from profile defaults. Saved edits still need review/rebuild; failed swipes that restore an accepted revision do not.

Update Display Bridge and refresh ST. No profile reimport is required. A reply previously rejected for an untracked location can be recovered with the rebuild shortcut. Do not rebuild just to recover from an API error: normal rollback should restore the accepted state.

Validation results and live-test limitations are recorded in the accompanying verification report. Stage 8 is now recorded in the [combined release acceptance matrix](RELEASE-ACCEPTANCE.md), with fresh and carried-forward evidence separated. No production installation or GitHub repository is changed by this local test build.
