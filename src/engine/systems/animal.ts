import { TerrainKind } from '../types';
import {
  MutableCell,
  MutationCommand,
  Priority,
  Rng,
  cloneCells,
  cmdIncrementAge,
  cmdIncrementHunger,
  cmdResetHunger,
  cmdSetHunger,
  cmdSetTerrain,
  resolveAndApply,
  shuffle,
} from '../commands';
import { coordKey, hexEquals, parseKey } from '../hex';
import { PipelineContext, SystemOutput, PipelineSystem } from '../pipeline';

interface PredationOffer {
  predatorKey: string;
  preyKey: string;
}

interface BreedOffer {
  parent: string;
  target: string;
  kind: 'herbivore' | 'carnivore';
}

export class AnimalSystem implements PipelineSystem {
  readonly name = 'AnimalSystem';

  collect(ctx: PipelineContext): SystemOutput {
    const cfg = ctx.config;
    const rng = ctx.rng;
    const work = cloneCells(ctx.cells);

    const herbCmds = this.herbivorePhase(ctx, work, cfg, rng);
    resolveAndApply(work, herbCmds);

    const carnCmds = this.carnivorePhase(ctx, work, cfg, rng);
    resolveAndApply(work, carnCmds);

    const breedCmds = this.breedPhase(ctx, work, cfg, rng);
    resolveAndApply(work, breedCmds);

    return { commands: [...herbCmds, ...carnCmds, ...breedCmds] };
  }

  private herbivorePhase(
    ctx: PipelineContext,
    work: Map<string, MutableCell>,
    cfg: PipelineContext['config'],
    rng: Rng,
  ): MutationCommand[] {
    const commands: MutationCommand[] = [];

    const predation: PredationOffer[] = [];
    for (const c of ctx.coords) {
      const cell = work.get(coordKey(c))!;
      if (cell.terrain !== TerrainKind.HERBIVORE) continue;
      const key = coordKey(c);
      const neigh = ctx.boundedNeighbors(c);
      const plantNeigh = neigh.filter(
        (nb) => work.get(coordKey(nb))?.terrain === TerrainKind.PLANT,
      );
      if (plantNeigh.length > 0) {
        const t = plantNeigh[Math.floor(rng() * plantNeigh.length)];
        predation.push({ predatorKey: key, preyKey: coordKey(t) });
      }
    }

    const herbEating = new Set<string>();
    const plantEaten = new Set<string>();
    const shuffled = [...predation];
    shuffle(shuffled, rng);
    for (const offer of shuffled) {
      if (plantEaten.has(offer.preyKey)) continue;
      plantEaten.add(offer.preyKey);
      herbEating.add(offer.predatorKey);
    }

    for (const plantKey of plantEaten) {
      const oldPlant = work.get(plantKey)!;
      commands.push(
        cmdSetTerrain(plantKey, TerrainKind.DIRT, Priority.PREY_KILLED, {
          preserveFertility: true,
          moistureValue: oldPlant.moisture,
        }),
      );
    }

    const herbSurvived = new Set<string>();
    for (const c of ctx.coords) {
      const cell = work.get(coordKey(c))!;
      if (cell.terrain !== TerrainKind.HERBIVORE) continue;
      const key = coordKey(c);
      const ate = herbEating.has(key);
      const newHunger = ate ? 0 : cell.hunger + 1;

      if (newHunger > cfg.herbivoreMaxHunger) {
        commands.push(
          cmdSetTerrain(key, TerrainKind.HUMUS, Priority.ANIMAL_STARVE, {
            fertilityValue: 0.4,
          }),
        );
        continue;
      }

      if (ate) {
        commands.push(cmdResetHunger(key, Priority.PROPERTY_SET));
      } else {
        commands.push(cmdIncrementHunger(key, Priority.PROPERTY_SET));
      }
      commands.push(cmdIncrementAge(key, Priority.PROPERTY_SET));
      herbSurvived.add(key);
    }

    return commands;
  }

  private carnivorePhase(
    ctx: PipelineContext,
    work: Map<string, MutableCell>,
    cfg: PipelineContext['config'],
    rng: Rng,
  ): MutationCommand[] {
    const commands: MutationCommand[] = [];

    const herbSurvived = new Set<string>();
    for (const c of ctx.coords) {
      if (work.get(coordKey(c))?.terrain === TerrainKind.HERBIVORE) {
        herbSurvived.add(coordKey(c));
      }
    }

    const predation: PredationOffer[] = [];
    for (const c of ctx.coords) {
      const cell = work.get(coordKey(c))!;
      if (cell.terrain !== TerrainKind.CARNIVORE) continue;
      const key = coordKey(c);
      const neigh = ctx.boundedNeighbors(c);
      const preyNeigh = neigh.filter((nb) => herbSurvived.has(coordKey(nb)));
      if (preyNeigh.length > 0) {
        const t = preyNeigh[Math.floor(rng() * preyNeigh.length)];
        predation.push({ predatorKey: key, preyKey: coordKey(t) });
      }
    }

    const carnEating = new Set<string>();
    const herbEaten = new Set<string>();
    const shuffled = [...predation];
    shuffle(shuffled, rng);
    for (const offer of shuffled) {
      if (herbEaten.has(offer.preyKey)) continue;
      if (!herbSurvived.has(offer.preyKey)) continue;
      herbEaten.add(offer.preyKey);
      carnEating.add(offer.predatorKey);
    }

    for (const preyKey of herbEaten) {
      const oldPrey = work.get(preyKey)!;
      commands.push(
        cmdSetTerrain(preyKey, TerrainKind.HUMUS, Priority.PREY_KILLED, {
          fertilityValue: 0.35 + oldPrey.fertility * 0.3,
        }),
      );
      herbSurvived.delete(preyKey);
    }

    for (const c of ctx.coords) {
      const cell = work.get(coordKey(c))!;
      if (cell.terrain !== TerrainKind.CARNIVORE) continue;
      const key = coordKey(c);
      const ate = carnEating.has(key);
      const newHunger = ate ? 0 : cell.hunger + 1;

      if (newHunger > cfg.carnivoreMaxHunger) {
        commands.push(
          cmdSetTerrain(key, TerrainKind.HUMUS, Priority.ANIMAL_STARVE, {
            fertilityValue: 0.45,
          }),
        );
        continue;
      }

      if (ate) {
        commands.push(cmdResetHunger(key, Priority.PROPERTY_SET));
      } else {
        commands.push(cmdIncrementHunger(key, Priority.PROPERTY_SET));
      }
      commands.push(cmdIncrementAge(key, Priority.PROPERTY_SET));
    }

    return commands;
  }

  private breedPhase(
    ctx: PipelineContext,
    work: Map<string, MutableCell>,
    cfg: PipelineContext['config'],
    rng: Rng,
  ): MutationCommand[] {
    const commands: MutationCommand[] = [];

    const herbSurvived = new Set<string>();
    const carnSurvived = new Set<string>();
    for (const c of ctx.coords) {
      const t = work.get(coordKey(c))?.terrain;
      if (t === TerrainKind.HERBIVORE) herbSurvived.add(coordKey(c));
      if (t === TerrainKind.CARNIVORE) carnSurvived.add(coordKey(c));
    }

    const herbOffers: BreedOffer[] = [];
    const carnOffers: BreedOffer[] = [];

    for (const key of herbSurvived) {
      const c = parseKey(key);
      const cell = work.get(key)!;
      if (cell.hunger > cfg.herbivoreBreedHungerThreshold) continue;
      if (cell.age < 2) continue;
      const neigh = ctx.boundedNeighbors(c);
      const sameKindCount = neigh.filter(
        (nb) => work.get(coordKey(nb))?.terrain === TerrainKind.HERBIVORE,
      ).length;
      if (sameKindCount < cfg.herbivoreBreedMateMin) continue;
      const empty = neigh.filter((nb) => {
        const t = work.get(coordKey(nb))!.terrain;
        return t === TerrainKind.DIRT || t === TerrainKind.PLANT;
      });
      if (empty.length === 0) continue;
      const t = empty[Math.floor(rng() * empty.length)];
      herbOffers.push({ parent: key, target: coordKey(t), kind: 'herbivore' });
    }

    for (const key of carnSurvived) {
      const c = parseKey(key);
      const cell = work.get(key)!;
      if (cell.hunger > cfg.carnivoreBreedHungerThreshold) continue;
      if (cell.age < 3) continue;
      const neigh = ctx.boundedNeighbors(c);
      const sameKindCount = neigh.filter(
        (nb) => !hexEquals(nb, c) && work.get(coordKey(nb))?.terrain === TerrainKind.CARNIVORE,
      ).length;
      if (sameKindCount < cfg.carnivoreBreedMateMin) continue;
      const empty = neigh.filter((nb) => {
        const t = work.get(coordKey(nb))!.terrain;
        return t === TerrainKind.DIRT || t === TerrainKind.PLANT;
      });
      if (empty.length === 0) continue;
      const t = empty[Math.floor(rng() * empty.length)];
      carnOffers.push({ parent: key, target: coordKey(t), kind: 'carnivore' });
    }

    herbOffers.sort((a, b) => a.parent.localeCompare(b.parent));
    for (const offer of herbOffers) {
      const targetCell = work.get(offer.target)!;
      if (targetCell.terrain === TerrainKind.DIRT || targetCell.terrain === TerrainKind.PLANT) {
        commands.push(
          cmdSetTerrain(offer.target, TerrainKind.HERBIVORE, Priority.BIRTH, {
            fertilityValue: 0,
            moistureValue: 0,
          }),
        );
        commands.push(
          cmdSetHunger(offer.target, cfg.herbivoreBirthHunger, Priority.BIRTH + 1),
        );
      }
    }

    carnOffers.sort((a, b) => a.parent.localeCompare(b.parent));
    for (const offer of carnOffers) {
      const targetCell = work.get(offer.target)!;
      if (
        targetCell.terrain === TerrainKind.DIRT ||
        targetCell.terrain === TerrainKind.PLANT ||
        targetCell.terrain === TerrainKind.HERBIVORE
      ) {
        commands.push(
          cmdSetTerrain(offer.target, TerrainKind.CARNIVORE, Priority.BIRTH + 2, {
            fertilityValue: 0,
            moistureValue: 0,
          }),
        );
        commands.push(
          cmdSetHunger(offer.target, cfg.carnivoreBirthHunger, Priority.BIRTH + 3),
        );
      }
    }

    return commands;
  }
}
