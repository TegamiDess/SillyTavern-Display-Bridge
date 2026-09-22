# Declarative presentation actions — schema 1

Implemented in Display Bridge 0.3.0. This is a reusable display-state engine, not a Lua interpreter or a general Risu trigger translator.

## Supported contract

Definitions contain `schemaVersion: 1`, a namespace, named variables, named actions and optional control bindings. Variable names are identifiers, never object-property paths. Unknown declaration fields, unresolved bindings and unsupported operations fail validation.

Types: boolean; finite number with required min/max bounds; enum string from an explicit list; plain string with an explicit maximum length (up to 4,096 characters). The engine validates defaults and every assigned result.

Operations: `set`, `toggle`, `increment`, `reset`. Incrementing past a bound fails; it does not silently clamp. Actions contain at most 256 steps. A multi-step action builds a private candidate state and commits once only if every step succeeds. A failed action cannot partially update the UI.

Expressions are typed JSON trees, not executable text. A primitive value is a literal; `{"var":"count"}` reads a declared variable. Operator nodes contain `op` and `args`: `not`, `and`, `or`, `eq`, `ne`, `lt`, `lte`, `gt`, `gte`, `add`, `subtract`, `multiply`, `divide`. Compilation checks arity and operand types and collects variable dependencies. Division by zero, non-finite results and out-of-bounds assignments fail. Expression depth is limited to 24. No loops, function calls, DOM access, network access or JavaScript/Lua evaluation.

```json
{
  "schemaVersion": 1,
  "namespace": "example-panel",
  "variables": {
    "expanded": { "type": "boolean", "default": false }
  },
  "actions": {
    "togglePanel": [{ "op": "toggle", "variable": "expanded" }]
  },
  "bindings": {
    "expand-button": { "event": "activate", "action": "togglePanel" }
  }
}
```

The reviewed adapter binds a declared activation to a real control. Imported strings are not DOM event handlers. Shared checkbox bindings supply mouse/touch activation, Enter/Space, aria-expanded, and synchronization from the state store. The map and gallery provide Escape behaviour for their own navigation.

## State ownership

The bridge chooses the scope explicitly when binding an action definition:

- Chat view: avatar + stable chat ID + namespace. Used for Witchcure roster/report mode.
- Widget view: chat scope + message identity/source revision + adapter type + occurrence. Used for gallery post expansion and map navigation.
- Character options: existing extension settings retain the enabled adapters and attached source templates. These are configuration, separate from action variables.

If no stable chat ID is available, chat-array identity is the fallback. Reused arrays with a stable ID remain isolated by that ID. Edits/swipes reset widget state by changing the message/source identity. Repeated widgets do not share checkbox IDs across their shadow roots or state scopes.

Every live dispatch verifies the selected avatar, chat identity, current message/source, render ownership and attached control. Old or detached controls cannot write to a newly selected chat. One committed state change schedules one batched bridge refresh. Scoped records are capped at 300; evicted records return to defaults if revisited.

From 0.6.0, the roster/report enum is a saved presentation preference per character identity and stable chat ID. It survives reload and extension teardown. Other action values remain session-only. Nothing is saved into chat metadata, character prompts, messages or imported Risu variables. See PERSISTENCE.md for reset/export and lifecycle rules. Definitions cannot request persistence through an ignored field; unsupported fields fail compilation.

## Current card integrations

- Witchcure roster/report switch uses a shared enum with `auto`, `roster`, and `report` values. Direct report markers retain their initial report view until a user choice exists.
- Gallery controls toggle one boolean per post within each gallery instance. The source's fixed/semi-fixed commenter badges and counts are preserved.
- Witchcure map controls toggle the panel, full map and region detail views. Region actions close peer detail views atomically.
- Status scores and exploration progress are read-only typed captures from the message. Display controls never invent scores, start an expedition or select a character in the story.

The original roster's portrait/detail checkboxes and the stream's hover interaction remain local component controls. They do not require persistent variables. Future adapters can use the same compiled action engine and control binding helper.

## Validation

The pure action suite covers defaults, bounds, expression dependencies, reset, invalid schemas, missing controls, division by zero, enum/string limits, atomic failure, rapid changes, scope sharing/isolation and stale dispatches. Browser tests exercise the reducer through the actual panel controls and verify stored-source preservation.

Not implemented: generic Risu macro parsing, automatic conversion of arbitrary `v2SetVar` effects, script-level conditions, imported Lua, chat edits, model generation, arbitrary persistent story variables, or arbitrary user-installed action profiles. These require explicit compatibility work; they are not silently simulated.
