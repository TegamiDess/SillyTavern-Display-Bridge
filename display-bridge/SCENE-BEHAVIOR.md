# Scene history and motion

The scene-fragment preset supports a portable `sceneBehavior` object (portrait
adapter **18**, or **19** when an outgoing-cleanup choice is present). It is
independent of the optional portrait-audio experiment.

Open **Display Bridge → Set up portrait and dialogue → Scene history and
motion**. Review the edited preset, then apply the imported UI profile.

- **Maximum scene message depth:** number of later messages through which
  artwork remains visible. `3` shows a scene at depths 0, 1, 2 and 3; depth 4
  and beyond retains its dialogue, inline formatting and speaker colours.
  User and system messages count too. Blank keeps artwork throughout history;
  `0` limits artwork to the final message. The allowed range is 0–100.
- **Clean older scenes in outgoing prompts:** opt-in request cleanup using the
  same depth. Requires a finite depth; see [outgoing cleanup](SCENE-REQUEST-CLEANUP.md).
- **Cloud fading:** the scene's effect layer fades between 0.8 and 0.5 opacity
  over a 120-second cycle.
- **Portrait breathing:** a four-second cycle moves portraits up to three
  pixels and stretches height by up to one percent.
- **Portrait entrance:** a 0.7-second fade and 40-pixel rise. When both portrait
  effects are enabled, breathing begins after the entrance. The reviewed
  one-to-four portrait layouts use staggered delays of 0.7–1.3 seconds.

These choices export with the configured card. Existing explicit profiles keep
their choices; updating the extension does not rewrite them. Reopening the
editor lets older profiles opt in. Rescanning preserves explicit overrides,
including unlimited history and disabled motion.

History depth alone changes only the rendered scene. Outgoing content changes
only when the separate cleanup checkbox is enabled. Saved messages,
conversation state and chat-level information/music controls are unchanged.
Deleting later messages can restore artwork. Old text-only scenes allocate no
images, scene controls, audio or presentation-state bindings.

Motion pauses outside the viewport, in hidden documents and when scene images
are disabled. Portrait hover and keyboard preview pause breathing. The browser's
`prefers-reduced-motion: reduce` setting disables all three effects. There is no
animation polling loop; widget disposal disconnects its observer and listener.

## Source recognition

Automatic history discovery recognizes the reviewed shared outer guard:

```text
{{#if {{greater_equal::{{chat_index}}::{{? {{lastmessageid}}-{{getvar::remove}} }}}}}}
```

The same guard must wrap recognized background, cast and dialogue-container
rules. The variable can have another safe name but must have a bounded literal
default and no recognized write. Conflicting or dynamic guards require manual
review. Unguarded dialogue content remains readable outside the old scene.

Motion discovery requires the reviewed keyframe bodies, class bindings and
timing declarations. Merely naming an animation does not enable it. The bridge
implements its own bounded effects and never executes the imported stylesheet.
Layered scene frames also use distinct dusk and night border colours.

## Validation, 2026-10-03

- 222 unit tests passed, including inclusive depth boundaries, unknown source
  conditions, invalid settings, preserved overrides and portable adapter 18.
- Nine focused checks passed in the visible browser: all-role message counting,
  deletion, edits, swipes, history loading, no historical image allocation,
  hover, in-view/off-screen pausing, hidden-image pausing, frame colours and
  editor settings.
- A source-only SFW CHARX with seven neutral PNGs was imported into the isolated
  native SillyTavern instance. The depth-3/depth-4 boundary and reopening its
  saved chat passed. No model calls were made.
- The reduced-motion CSS rule is present. The native browser used its normal
  motion preference; an OS preference toggle was not exercised.
- Portable data round-trip was checked offline. Native configured-download
  round-trip was not repeated for this change.

This closes the ordinary history-window and selected-motion work. It does not
implement arbitrary source CSS, page-wide backgrounds, specialized source
portrait handlers or exact pixel geometry.

## Scrolling regression follow-up — 2026-10-03

Entrance is now limited to the newest assistant message at depth zero and
starts only if the widget's first visibility observation finds it on-screen.
Artwork defaults to fully visible before that observation. Initially off-screen
scenes skip entrance; leaving during entrance settles it immediately instead
of freezing transparent. Returning resumes cloud/breathing loops without
replaying the fade. Hiding artwork or the document also settles entrance.

This fixes disappearing portraits when new turns rebuild prior scenes and the
reader scrolls quickly. It changes no portable profile fields or saved story.
Three regression checks failed on the previous renderer and pass with the fix;
the complete focused visible suite is 28/28, with 234 unit tests passing.
