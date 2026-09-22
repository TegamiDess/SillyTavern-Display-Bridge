# Witchcure live acceptance

Use the imported card and a disposable test chat. You do not need to delete it. Install Display Bridge 0.4.2 and V3 0.3.1, then reload the page.

**0.4.2 update:** use V3 **0.3.1** for real Risu CHARX module discovery. If the earlier import reported unsupported, select that card, use V3's **Attach original card images and UI to current character**, choose its original CHARX, and apply the recovered profile in Display Bridge. For native bare-name image requests, accept the new named-image rule and allow character regex in SillyTavern before reopening the chat.

## 1. Import settings

Open Extensions → Display Bridge with Witchcure selected. The import result should identify `witchcure`, include image mapping information and show `applied`, or explain why it is waiting for review. If the review is the expected Witchcure profile, apply it. Witchcure and the master checkbox should be enabled; Stream window and Streamer gallery should normally remain off. You should not have to attach another JSON to obtain templates.

Deleting a character does not yet remove its extension settings. SillyTavern can reuse an avatar filename on reimport, so the new card may inherit an existing-settings review instead of the fresh-import automatic activation path. This is a known lifecycle limitation, not a reason to delete the card again.

## 2. Deterministic panel test

Edit an assistant reply in the test chat and paste the following as ordinary text (without code fences). User messages and code examples intentionally do not activate panels. This tests rendering independently of whether the model produces the expected syntax.

```text
[명부]
<MAP>탐험 상태 아님|0|0|현재 진행 중인 탐험이 없습니다</MAP>
[마녀 선택 안함|0|0|0|0|트리거 없음|교착 없음|조수 선택 안함|0|0|조수 없음|시너지 없음|2023-10-27|06:45 AM|기숙사 로비|목표 없음|0]
```

- Roster: ten portraits/names, each opens the matching detail. Back and Escape return to the list. Roster/report switch changes the view repeatedly without duplicated panels. A missing portrait should be reported, not silently mistaken for another character.
- Map: inactive summary opens the whole map. Each of nine region controls opens its own detail; Back and Escape close/return appropriately. These controls browse the map; they do not start a story exploration or change message values.
- Status: appears above the message prose and shows the supplied fields/numbers. Change a score to 12 and the final progress to 150: text should preserve 12/10 and 150%, while bars stop at full width. Restore the values afterward if desired.
- Presentation only: opening details, changing views and toggling panels must not alter the saved assistant text or send a message.

## 3. Integration behaviour

- Disable/re-enable Witchcure, then the master checkbox. Native display should return when off, supported panels when on. No growing stacks of duplicate widgets or requests on each click.
- Refresh the page. Panel selections and imported templates should survive. Open detail/map selections may reset: persistent presentation variables are not part of this release.
- Switch to another card and back. Witchcure settings and portraits must not appear on the other card unless separately configured there.
- Edit or swipe the assistant reply. The displayed values must follow the visible reply, without stale values from the previous one.
- Roster/report and map use the newest two chat-message positions; status uses the newest six. Older supported blocks becoming hidden is intentional. These windows count chat messages, not just assistant replies.
- Test at a narrow width: names and controls should remain reachable without text clipping.

## 4. Profiles and retry

Export the UI profile, then load that exported file back on this test card. Loading should offer review without immediately changing active choices. Keep current should dismiss it; applying should restore the exported panel selections. Retrying pending imports after a completed handoff should not add another card, duplicate panels or restore a toggle you manually disabled.

## 5. Useful failure evidence

After page load settles, clear the console, perform one action, and note only the new errors. Share the clicked control, the displayed import/diagnostic result, whether any portrait/image is actually missing, and the relevant message block or screenshot. For `Lerevan Peinard`, distinguish a single request during initial native rendering from a new request every time a Display Bridge control is clicked. Missing extension manifests, a missing plugin endpoint and an unresolved external hostname are separate issues.
