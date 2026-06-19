import { TerrainKind } from '../types';
import {
  MutationCommand,
  Priority,
  Rng,
  cmdSetAge,
  cmdSetMoisture,
  cmdSetTerrain,
  shuffle,
} from '../commands';
import { coordKey, hexEquals, hexNeighbors } from '../hex';
import { PipelineContext, SystemOutput, PipelineSystem } from '../pipeline';

export class PlantSystem implements PipelineSystem {
  readonly name = 'PlantSystem';

  collect(ctx: PipelineContext): SystemOutput {
    const commands: MutationCommand[] = [];
    const cfg = ctx.config;
    const rng = ctx.rng;

    const spreadTargets = new Map<string, number>();

    for (const c of ctx.coords) {
      const key = coordKey(c);
      const cell = ctx.cells.get(key)!;
      if (cell.terrain !== TerrainKind.PLANT) continue;

      const neigh = ctx.boundedNeighbors(c);
      const waterAdj = neigh.some(
        (nb) => ctx.cells.get(coordKey(nb))?.terrain === TerrainKind.WATER,
      );
      const moistureNow = Math.max(
        cell.moisture - cfg.moistureDecayPerStep,
        waterAdj ? 0.5 : 0,
      );
      const died = moistureNow < cfg.plantGrowMoistureMin * 0.6 && !waterAdj;

      if (died) {
        commands.push(
          cmdSetTerrain(key, TerrainKind.HUMUS, Priority.PLANT_DIE, {
            fertilityValue: Math.min(1, 0.3 + cell.fertility * 0.5),
            moistureValue: moistureNow,
          }),
        );
      } else {
        const newMoisture = Math.min(1, moistureNow + 0.05);
        const newAge = cell.age + 1;
        commands.push(cmdSetMoisture(key, newMoisture, Priority.PROPERTY_SET));
        commands.push(cmdSetAge(key, newAge, Priority.PROPERTY_SET));

        if (
          newMoisture >= cfg.plantSpreadMoistureMin &&
          rng() < 0.35 + cfg.plantFertileBonus * cell.fertility
        ) {
          const dirtNeigh = neigh.filter(
            (nb) => ctx.cells.get(coordKey(nb))?.terrain === TerrainKind.DIRT,
          );
          for (const t of dirtNeigh) {
            const tk = coordKey(t);
            const plantNeighborCount = ctx.boundedNeighbors(t).filter(
              (nb) =>
                hexEquals(nb, c)
                  ? true
                  : ctx.cells.get(coordKey(nb))?.terrain === TerrainKind.PLANT,
            ).length;
            if (plantNeighborCount <= cfg.plantSpreadNeighborLimit) {
              const count = spreadTargets.get(tk) ?? 0;
              spreadTargets.set(tk, count + 1);
            }
          }
        }
      }
    }

    for (const [k] of spreadTargets) {
      const prevCell = ctx.cells.get(k)!;
      if (prevCell.terrain === TerrainKind.DIRT) {
        const fertility = Math.min(1, prevCell.fertility + 0.05);
        commands.push(
          cmdSetTerrain(k, TerrainKind.PLANT, Priority.PLANT_SPREAD, {
            fertilityValue: fertility,
            moistureValue: 0.6,
          }),
        );
      }
    }

    return { commands };
  }
}
