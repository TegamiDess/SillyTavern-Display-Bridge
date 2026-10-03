# Testing and feedback

Current release: Display Bridge 0.22.0 / V3 Asset Sprites 0.10.0. The [current audit](RELEASE-ACCEPTANCE.md) records scope and limitations. On 2026-10-03, **234 unit tests and 187 visible browser checks passed**.

## Automated checks

Use Node.js 24 or newer from the repository root:

```sh
npm ci --prefix display-bridge --ignore-scripts
node --test --test-isolation=none display-bridge/tests/*.test.js
node display-bridge/tests/integration-server.mjs /path/to/SillyTavern
```

Open the printed test URL in a visible browser. The loopback harness reads the installed ST formatter, regex engine and bundled libraries; it uses neutral fixtures and mocked host state and does not require model calls or real cards/settings. Unit checks use the locked development dependency. Browser coverage includes import/export and recovery, scene geometry, setup/startup, prompt cleanup, motion, preferences, snapshots and lifecycle handling. Passing mocks does not certify every real installation.

## Useful native checks

- Import a neutral fixture and inspect images, UI and compatibility diagnostics.
- Change outfits and labels, review/apply, refresh, switch chats and export/reimport.
- Verify hover portraits, status, dialogue controls and pointer hit testing; scripted clicks alone do not establish pointer layering.
- Check successful/failed swipes, streaming cancellation and edits, then rebuild state and refresh.
- Inspect the actual assembled outgoing request using a local stub. Dry-run prompt previews can skip native generation interceptors.
- Test missing assets and rollback refusal after subsequent card edits, using disposable cards.
- For Snapshot 3.3.0, verify regular/grid captures, anonymization and unchanged live chat. See [Snapshot support](SNAPSHOT.md).

## Performance and bug reports

The harness's `/fixtures/performance-benchmark.html` uses 1,111 neutral asset names, four portraits and six outfits. It measures editor construction/layout, not whole-app scrolling or image decoding. See [performance notes](PERFORMANCE.md).

Report extension/ST versions, browser, reproduction steps, expected/actual behaviour and a minimal neutral snippet/profile. Keep API keys, private chats, personal card files and identifying labels out of issues. Use backups and disposable test cards for replacement/recovery tests.
