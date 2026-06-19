import {
  TerrainKind,
} from '../types';
import {
  MutationCommand,
  Priority,
  cmdSetAge,
  cmdSetTerrain,
} from '../commands';
import { coordKey } from '../hex';
import { PipelineContext, SystemOutput, PipelineSystem } from '../pipeline';

export class HumusSystem implements PipelineSystem {
  readonly name = 'HumusSystem';

  collect(ctx: PipelineContext): SystemOutput {
    const commands: MutationCommand[] = [];
    const cfg = ctx.config;

    for (const c of ctx.coords) {
      const key = coordKey(c);
      const cell = ctx.cells.get(key)!;
      if (cell.terrain !== TerrainKind.HUMUS) continue;

      const newAge = cell.age + 1;
      if (newAge >= cfg.humusToDirtSteps) {
        commands.push(
          cmdSetTerrain(key, TerrainKind.DIRT, Priority.HUMUS_CONVERT, {
            fertilityValue: Math.min(1, cell.fertility + 0.4),
            moistureValue: Math.max(cell.moisture, 0.25),
          }),
        );
      } else {
        commands.push(cmdSetAge(key, newAge, Priority.PROPERTY_SET));
      }
    }

    return { commands };
  }
}
