# Turn timer + turn feedback (simultaneous model)

**Date:** 2026-07-08
**Status:** Approved

## Problem

The battle uses a *simultaneous* selection model (both players choose each turn,
then `resolveTurn` executes both ordered by speed/priority). Two real gaps:

1. **No timer.** If a player never submits an action, `resolveIfReady` never
   fires and the battle hangs forever.
2. **Weak turn feedback.** After submitting you see a generic "opponent turn"
   message; there is no countdown and no clear "you chose, waiting for the rival"
   state.

## Decisions (confirmed with user)

- **Keep the simultaneous model** (correct Pokémon mechanics; speed/priority
  preserved). Do NOT switch to strict alternating turns.
- **15 seconds** per decision point.
- On timeout, the player who did not choose **does nothing**, but the opponent
  who chose in time **still executes** their move.
- The timer is **server-authoritative**; the client only displays an
  approximate countdown.

## Design by layer

### Engine — `types.ts`, `order.ts`, `engine.ts`
- `resolveTurn` accepts `[TurnAction | null, TurnAction | null]`. `null` means
  "this side did nothing this turn" (a timeout pass). Clients never send `null`;
  only the server injects it. In the resolution loop, a `null` action is
  skipped (that side neither moves nor switches). The other side resolves
  normally.
- `orderActions` accepts `TurnAction | null`; a `null` action gets the lowest
  priority (its position is irrelevant since it does nothing).
- New `BattleEvent`: `{ type: "timeout"; side: SideIndex }`.

### Room — `room.ts`
- `resolveIfReady(room, rng)` unchanged: the fast path when both awaited slots
  submitted before the deadline.
- New `resolveOnTimeout(room, rng)`: resolves the current decision point
  immediately. For each awaited slot with no `pendingAction`:
  - normal turn → contributes `null` (pass) and a `{type:"timeout", side}` event.
  - forced-switch → auto-switch to the first living team member (via the
    existing `chooseReplacement` fallback) and a `{type:"timeout", side}` event.
  Slots that submitted resolve normally. Returns `{ room, events }` or `null`
  when there is nothing to resolve.
- `RoomView` gains `turnDeadline: number | null` (epoch ms; `null` outside an
  active decision point).

### Server — `server-core.ts`
- `ServerDeps` gains injectable timers: `setTimer(fn, ms) => handle`,
  `clearTimer(handle)`, `now() => number`. Defaults: `setTimeout`,
  `clearTimeout`, `Date.now`. Tests inject fakes so no real time passes.
- Per-room `Entry` tracks `timer: handle | null` and `deadline: number | null`.
- `armTimer(roomId)`: sets `deadline = now() + 15000`, schedules `onTimeout`.
  Called when a battle starts, after a turn resolves (if the battle continues),
  and when a forced-switch sub-phase begins.
- On `action`: after `advance`, if the turn resolved → re-arm; if still waiting
  for the other side → leave the running timer with the **same** deadline.
- `onTimeout(roomId)`: run `resolveOnTimeout`, send events + state, re-arm if the
  battle continues.
- Clear the timer (and `deadline = null`) on win/forfeit/finished, or when no
  player is connected (pause).
- Side benefit: a disconnected player no longer hangs the room — they time out
  each turn.

### Client — `use-battle-socket.ts`, `action-menu.tsx`, new `turn-timer.tsx`
- `RoomView.turnDeadline` flows to the client.
- New `TurnTimer` component: remaining = `max(0, turnDeadline - Date.now())`,
  refreshed ~every 250ms, rendered as a bar + seconds, turning red in the last
  5s.
- `ActionMenu`: your open window (not yet submitted) → menu + "¡Tu turno! Elige"
  + timer. Already submitted → "Esperando al rival…" + timer (locked; the lock
  already exists today). Outside your window → locked (already the case).
- The timeout event renders in the log: "¡Se acabó el tiempo! Beartic perdió su
  turno."

### i18n — `es` and `en`
- New keys: `battle.yourTurnHint`; reuse `battle.opponentTurn` for
  "Esperando al rival…"; `battle.log.timeout(mon)`.

## Tests
- `engine.test`: `resolveTurn` with one `null` (opponent acts, passer does
  nothing) and both `null` (nobody acts, end-of-turn still runs).
- `order.test`: `orderActions` with a `null` action.
- `room.test`: `resolveOnTimeout` — one missing action, forced-switch timeout
  (auto-switch), both timeout.
- `server-core.test`: with fake timers — arms on battle start; fires `onTimeout`
  after 15s → resolves; does NOT fire if both submit first; re-arms next turn;
  clears on finish.
- `describe-event.test`: timeout event → localized line(s).
- `dictionary.test`: new keys present in both locales.

## Edge cases
- Both submit before 15s → resolves instantly (current path); timer cleared/re-armed.
- Forced switch uses the same timer; timeout forces the mandatory switch.
- Reconnect: the reconnecting client receives state with the live `turnDeadline`
  and re-syncs its countdown.
- Server/client clock skew: acceptable at 15s; the server is authoritative
  (it resolves), the client display is approximate.
- Nobody connected → timer paused.
