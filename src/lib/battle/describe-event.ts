import type { Dictionary } from "@/lib/i18n/dictionary";
import type { BattleEvent } from "./types";

/**
 * Maps one BattleEvent to its localized battle-log line(s), using the
 * dictionary's `battle.log` phrase builders. Pure and side-effect free.
 */
export function describeEvent(event: BattleEvent, d: Dictionary): string[] {
  const log = d.battle.log;

  switch (event.type) {
    case "move":
      return [log.used(event.pokemon, event.move)];

    case "damage": {
      if (event.effectiveness === "immune") return [log.immune(event.pokemon)];
      const lines: string[] = [];
      if (event.crit) lines.push(log.crit);
      if (event.effectiveness === "super") lines.push(log.superEffective);
      if (event.effectiveness === "notvery") lines.push(log.notVery);
      return lines;
    }

    case "miss":
      return [log.miss(event.pokemon)];

    case "status":
      return [log.statusInflict(event.pokemon, d.battle.status[event.status])];

    case "statusDamage":
      return [log.statusHurt(event.pokemon, d.battle.status[event.status])];

    case "statusPrevent":
      return [log.cantMove(event.pokemon, d.battle.status[event.status])];

    case "wake":
      return [log.wake(event.pokemon)];

    case "faint":
      return [log.faint(event.pokemon)];

    case "switch":
      return [log.switch(event.to)];

    case "forcedSwitch":
      return [];

    case "win":
      return [];
  }
}
