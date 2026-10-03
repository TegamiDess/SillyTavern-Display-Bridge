# Interactive example source

`docs/index.html` is the self-contained, curated SFW replay deployed to GitHub Pages. It embeds ten exchanges, twenty scenes and 54 images. No server/API configuration, complete card, lorebook or raw chat log is included.

The readable entry point is `viewer.js`, the page shell is `shell.html`, and the renderer/control components are imported from `display-bridge/`. To rebuild with the current renderer, use an installed SillyTavern checkout containing webpack:

```sh
node tools/showcase/build.mjs /path/to/SillyTavern
```

The builder reads only the already-public display data in `docs/index.html`. It never reads the host's cards, settings or chats. Open the result in a browser and verify scene navigation, hover/focus portraits, Scene controls and dialogue expansion. The page's CSP blocks network requests from its code.

Original viewer/extension code is AGPL-3.0-only. The embedded card artwork and characters retain their respective creators' rights and are not relicensed by this project.
