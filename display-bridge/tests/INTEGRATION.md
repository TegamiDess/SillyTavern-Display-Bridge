# Browser integration suite

See the repository [testing guide](../../TESTING.md). From the repository root run:

```sh
node display-bridge/tests/integration-server.mjs /path/to/SillyTavern
```

An installed ST checkout with dependencies supplies its formatter, regex engine and browser libraries. The harness uses fake chats/characters/settings and local image fixtures. It binds only to loopback and prints its URL. Open that URL to run the suite; Ctrl+C stops it. No model credentials are needed.
