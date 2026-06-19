import { TerrainKind } from '../types';
import {
  MutationCommand,
  Priority,
  cmdAddMoisture,
  cmdSetMoisture,
  cmdSetTerrain,
} from '../commands';
import { coordKey, parseKey } from '../hex';
import { PipelineContext, SystemOutput, PipelineSystem } from '../pipeline';

export class WaterSystem implements PipelineSystem {
  readonly name = 'WaterSystem';

  collect(ctx: PipelineContext): SystemOutput {
    const commands: MutationCommand[] = [];
    const cfg = ctx.config;
    const rng = ctx.rng;

    for (const c of ctx.coords) {
      const key = coordKey(c);
      const cell = ctx.cells.get(key)!;
      const newMoisture = Math.max(
        0,
        Math.min(1, cell.moisture - cfg.moistureDecayPerStep),
      );
      commands.push(cmdSetMoisture(key, newMoisture, Priority.DECAY));
    }

    const spreadTargets: string[] = [];
    for (const c of ctx.coords) {
      const cell = ctx.cells.get(coordKey(c))!;
      if (cell.terrain !== TerrainKind.WATER) continue;
      const neigh = ctx.boundedNeighbors(c);
      const dirtNeigh = neigh.filter(
        (nb) => ctx.cells.get(coordKey(nb))?.terrain === TerrainKind.DIRT,
      );
      if (dirtNeigh.length > 0 && rng() < cfg.waterSpreadChance) {
        const t = dirtNeigh[Math.floor(rng() * dirtNeigh.length)];
        spreadTargets.push(coordKey(t));
      }
    }

    for (const k of spreadTargets) {
      commands.push(
        cmdSetTerrain(k, TerrainKind.WATER, Priority.WATER_SPREAD, {
          preserveFertility: true,
          moistureValue: 1,
        }),
      );
    }

    const waterCells = new Set<string>();
    for (const c of ctx.coords) {
      const key = coordKey(c);
      if (ctx.cells.get(key)!.terrain === TerrainKind.WATER) {
        waterCells.add(key);
      }
    }
    for (const k of spreadTargets) {
      waterCells.add(k);
    }

    for (const key of waterCells) {
      commands.push(cmdSetMoisture(key, 1, Priority.PROPERTY_SET));
      const c = parseKey(key);
      const neigh = ctx.boundedNeighbors(c);
      for (const nb of neigh) {
        const nbKey = coordKey(nb);
        if (waterCells.has(nbKey)) continue;
        commands.push(cmdAddMoisture(nbKey, 0.08, Priority.PROPERTY_ADD));
      }
    }

    return { commands };
  }
}
