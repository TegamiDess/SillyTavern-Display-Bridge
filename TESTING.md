# Testing and feedback

## Automated tests

Use Node.js 24 or newer. From the repository root:

```sh
npm ci --prefix display-bridge --ignore-scripts
node --test --test-isolation=none display-bridge/tests/*.test.js
node display-bridge/tests/integration-server.mjs /path/to/SillyTavern
```

The unit suite uses built-in Node modules, the sibling provider source and the pinned CSS-parser development dependency installed above. The browser suite needs an installed SillyTavern checkout with its dependencies (`npm install` in that checkout), and reads its actual formatter, regex engine and bundled libraries. Open the local URL printed by the command and wait for the results. Stop the server with Ctrl+C. The harness binds only to loopback; it does not require model access or read your real cards/chats/settings.

Latest checks: **105 unit tests and 111 browser checks passed**. The browser harness mocks parts of ST, so real installation testing remains necessary. Prior native checks cover import/reload, image mapping, appearance persistence and recovery; these are not a claim of universal compatibility.

## Useful manual checks

- Import a neutral fixture; confirm images, panels and compatibility report.
- Switch outfits, reset/undo, change chats and refresh.
- Edit a closed outfit's settings, preview, review/apply and export its profile.
- Try complete/incomplete tagged dialogue during streaming and swipes.
- Try `"Ohayou!" (Good morning!)`, the `「Good morning!」` suffix, and a line without a translation. Confirm English first, hover/focus reveal and return to translation when leaving/blurring.
- Disable a panel and confirm ordinary message display returns.
- Report ambiguous or unsupported source formats with a minimal neutral example.

Use a disposable test card for destructive replacement/recovery checks. Keep personal cards, API settings and chat logs out of issues. Share extension/ST versions, browser, reproduction steps, expected/actual results and the smallest neutral snippet/profile. Review compatibility reports and screenshots for identifying labels before posting.
