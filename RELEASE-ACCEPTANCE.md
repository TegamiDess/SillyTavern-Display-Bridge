# Release acceptance — 0.21.1 / 0.9.1

Target: Display Bridge 0.21.1 and V3 Asset Sprites 0.9.1 together, on SillyTavern 1.15.0, desktop browser. This closes stage 8 for the documented experimental feature set, not for arbitrary Risu cards or complete To Love Ru equivalence.

## Fresh checks

| Area | Result | Scope |
| --- | --- | --- |
| Unit suite | 181 passed, zero failed | Parsers, typed state, branch journal, import/export, recovery and Snapshot patching |
| Browser integration | 151 passed | Actual ST formatter/regex engine with simulated host data, requests and lifecycle events |
| Clean user profile | Passed | New data directory on the existing ST checkout; only the two current extensions, neutral fixtures and private acceptance controls added. No copied API keys, settings or prior mappings |
| Native round trips | Seven families passed | Source import → render → configured CHARX export → new native import → re-export; applied profiles, logical asset roles and exact asset bytes compared |
| Native reload | Seven families passed | Saved chats reopened, profiles/mappings/message text retained |
| Native replacement/recovery | Passed | Same-name imports with colliding logical asset names remain isolated; selected replacement preserves chat, and saved undo restores original fields/bytes after page reload |
| Scene dock/rebuild | Passed | Fixed panel outside chat/composer flow, looping chat-owned audio, rebuild leaves source text unchanged, reload restores controls |
| Longer scene chat | Passed | Thirty neutral scene messages rendered, one dock and one music owner; native scrolling and character menu exercised |
| Large mapping editor | Passed | 1,111 names, four portraits, six outfits; one suggestion list, zero closed outfit rows, 1,258 elements |
| Snapshot renderer | Passed | Actual html2canvas: legacy differs by 15,005 pixels; patched copy differs by zero; live source unchanged |

Native round-trip families: image-only, Afternoon with outfits, Community profile, streamer/gallery, assembled scene, automatic source-only scene, and scene with state/request context and music. The source-only scene fixtures ship without a pre-applied Display Bridge profile. Mixed image/audio archive checks compare bytes after reimport; neither current playback nor chat state is packaged.

The first image-only acceptance helper incorrectly attempted to export a UI profile from a card without adapters. The helper was corrected to use the nullable configured-export API; that family then passed. The initial result is retained in private evidence and is not counted as a successful check. No runtime change was needed for it. A recovery helper also redundantly reopened the already active chat through ST, causing a native card-metadata rewrite. Restore correctly refused that changed revision; the corrected sequence tests reload/selection without rewriting the card. These helper failures are retained separately from passing results.

Editor timings after warm-up: 8.6, 14.0, 7.8, 7.2 and 7.7 ms; median **7.8 ms**, versus the historical 7.1 ms. These are editor construction/layout timings without image decoding, not a whole-app performance guarantee. The thirty-message exercise is a native smoke test, not a new performance trace of a 62 MB card.

## Earlier evidence carried forward

The immediately preceding 0.21.1 native session tested the imported To Love Ru test card with two new model responses, one successful generated swipe and two deliberately failed HTTP 400 swipes. Failed requests returned to accepted state without manual rebuild. Cancelled/saved edits, explicit rebuild, branch navigation and reload were checked. The drawer restored the same values after switching back. Untracked location updates were skipped with a console-only warning and hidden only from display; original messages remained unchanged. A missing portrait reference remained an acknowledged card/lorebook issue.

Earlier native checks cover Witchcure, image-only repair/undo, later-edit rollback refusal, audio transitions during generation and native streaming. The fresh unit/browser suites repeat their regression contracts. The [0.15.1 matrix](RELEASE-ACCEPTANCE-0.15.1.md) is historical, not a current result. Witchcure's ten alternate icons remain explicit incomplete-export omissions.

Snapshot 3.3.0 regular/grid capture and anonymization were tested natively previously. This pass repeats the capture-copy browser tests and actual renderer reproduction, not every third-party Snapshot menu. The user's successful Risu reimport and lack of visible slowdown after cleanup are user evidence, not new measurements here.

## Support envelope

- Use **Import card with images and supported UI**. Native ST drag/drop alone does not perform the complete handoff. Review compatibility and regex prompts.
- Recognized scene layout, roster/defaults, supported assignments, finite relationships, request-context mappings and local music can be assembled automatically. An explicit reviewed profile takes precedence. Partial or ambiguous recognition still requires review.
- General Lua/STscript, arbitrary conditional greetings, random/history-edit triggers and every original-card interaction are not implemented. Unknown roster location assignments can be skipped; malformed or unsupported state updates still need correction/review.
- Configured export includes supported local images and MP3/WAV/Ogg audio, profile and portable generated image rules. Missing assets, alternate avatars, video/models/fonts and unsupported audio remain explicit omissions. Keep the original archive.
- Group chats, other ST versions, mobile, arbitrary themes/third-party regex and different Snapshot source layouts are not certified. Recovery is not a server-wide transaction; old files remain, and other processes cannot be locked out. Native card rewrites can also block automatic restore even when caused by ST normalization rather than an intentional prompt edit; export the recovery backup for manual recovery instead of overriding that guard.
- Ordinary saved reload is covered. Power loss, extension downgrade and full uninstall/reinstall are not certified. No claim of universal clean import or exact pixel parity is made.

## Short user acceptance checklist

1. Back up your card/chat, update both extension folders and refresh ST.
2. Import a card with the extension command. Review partial/unsupported entries and missing assets before continuing; initialize reviewed scene state where required.
3. Check portraits/backgrounds, dialogue collapse/expand, character information, and music across two scenes. Music should continue through generation and loop until paused or changed.
4. Send a reply, swipe successfully, then test an API failure. Returning to an accepted swipe should restore its state. Save an intentional edit and use **Rebuild scene state** when required.
5. Refresh and reopen the saved chat. Export a configured CHARX and import it as a separate test card; check the profile/assets and any explicit omissions.
6. If using the optional Snapshot patch, capture a small range first. Report versions and a minimal neutral reproduction; do not post credentials or private chats.

Original-card prompts, missing assets and unsupported interactions still need this user-side check. Passing neutral equivalents establishes the supported mechanism, not every source card's behavior.

## Verdict and artifact

**Pass for the documented experimental desktop release scope.** No new runtime defect was found in this acceptance pass. Runtime versions remain 0.21.1 / 0.9.1; documentation was refreshed, including the supported-audio export wording and original-card checklist.

The acceptance bundle is verified against repository file bytes, ZIP CRC and a recorded SHA-256. Syntax and local Markdown-link checks pass; distributable text is checked for private workstation paths. Private fixtures, acceptance controls, model settings and chats are outside the bundle. Temporary acceptance servers/tabs are closed afterward. Production and the published GitHub repository are not changed by this local acceptance pass.
