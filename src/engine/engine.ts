import {
  Cell,
  DEFAULT_CONFIG,
  EcosystemConfig,
  GridStats,
  HexCoord,
  PlacementTool,
  PlayerResources,
  TerrainKind,
} from './types';
import {
  coordKey,
  generateHexRing,
  hexDistance,
  hexEquals,
  hexNeighbors,
} from './hex';

export interface EcosystemSnapshot {
  readonly cells: ReadonlyMap<string, Cell>;
  readonly coords: readonly HexCoord[];
  readonly config: EcosystemConfig;
  readonly step: number;
  readonly started: boolean;
  readonly finished: boolean;
  readonly stats: GridStats;
}

function makeDirt(fertility = 0, moisture = 0): Cell {
  return {
    terrain: TerrainKind.DIRT,
    moisture,
    fertility,
    age: 0,
    hunger: 0,
  };
}

function makeWater(): Cell {
  return {
    terrain: TerrainKind.WATER,
    moisture: 1,
    fertility: 0,
    age: 0,
    hunger: 0,
  };
}

function makePlant(fertility = 0): Cell {
  return {
    terrain: TerrainKind.PLANT,
    moisture: 0.6,
    fertility,
    age: 0,
    hunger: 0,
  };
}

function makeHerbivore(birthHunger: number): Cell {
  return {
    terrain: TerrainKind.HERBIVORE,
    moisture: 0,
    fertility: 0,
    age: 0,
    hunger: birthHunger,
  };
}

function makeCarnivore(birthHunger: number): Cell {
  return {
    terrain: TerrainKind.CARNIVORE,
    moisture: 0,
    fertility: 0,
    age: 0,
    hunger: birthHunger,
  };
}

function makeHumus(fertility = 0.5): Cell {
  return {
    terrain: TerrainKind.HUMUS,
    moisture: 0.4,
    fertility,
    age: 0,
    hunger: 0,
  };
}

type MutableCell = { -readonly [K in keyof Cell]: Cell[K] };

function cloneCell(c: Cell): MutableCell {
  return { ...c };
}

function cloneCells(
  src: ReadonlyMap<string, Cell>,
): Map<string, MutableCell> {
  const out = new Map<string, MutableCell>();
  for (const [k, v] of src) out.set(k, cloneCell(v));
  return out;
}

export class EcosystemEngine {
  private readonly config: EcosystemConfig;
  private readonly coordsList: HexCoord[];
  private readonly coordSet: Set<string>;
  private cells: Map<string, MutableCell>;
  private stepCount: number;
  private hasStarted: boolean;
  private rng: () => number;

  constructor(config: EcosystemConfig = DEFAULT_CONFIG, seed = 1234567) {
    this.config = config;
    this.coordsList = generateHexRing(config.radius);
    this.coordSet = new Set(this.coordsList.map(coordKey));
    this.cells = new Map();
    this.stepCount = 0;
    this.hasStarted = false;
    this.rng = this.makeRng(seed);
    for (const c of this.coordsList) {
      const dist = hexDistance(c, { q: 0, r: 0 });
      const moistureBase = Math.max(
        0,
        0.05 * (config.radius - dist) / Math.max(1, config.radius),
      );
      this.cells.set(coordKey(c), makeDirt(0, moistureBase));
    }
  }

  private makeRng(seed: number): () => number {
    let s = seed >>> 0;
    return () => {
      s = (s * 1664525 + 1013904223) >>> 0;
      return s / 0xffffffff;
    };
  }

  reseed(seed: number): void {
    this.rng = this.makeRng(seed);
  }

  get coords(): readonly HexCoord[] {
    return this.coordsList;
  }

  get snapshot(): EcosystemSnapshot {
    return {
      cells: new Map(this.cells),
      coords: this.coordsList,
      config: this.config,
      step: this.stepCount,
      started: this.hasStarted,
      finished: this.isFinished(),
      stats: this.computeStats(),
    };
  }

  start(): void {
    this.hasStarted = true;
  }

  reset(): void {
    this.stepCount = 0;
    this.hasStarted = false;
    for (const c of this.coordsList) {
      const dist = hexDistance(c, { q: 0, r: 0 });
      const moistureBase = Math.max(
        0,
        0.05 * (this.config.radius - dist) / Math.max(1, this.config.radius),
      );
      this.cells.set(coordKey(c), makeDirt(0, moistureBase));
    }
  }

  inBounds(c: HexCoord): boolean {
    return this.coordSet.has(coordKey(c));
  }

  getCell(c: HexCoord): Cell | undefined {
    return this.cells.get(coordKey(c));
  }

  place(tool: PlacementTool, target: HexCoord): boolean {
    if (this.hasStarted) return false;
    if (!this.inBounds(target)) return false;
    const key = coordKey(target);
    const cur = this.cells.get(key);
    if (!cur) return false;
    switch (tool) {
      case 'water':
        this.cells.set(key, makeWater());
        return true;
      case 'seed':
        if (cur.terrain === TerrainKind.DIRT) {
          this.cells.set(key, makePlant(cur.fertility));
          return true;
        }
        return false;
      case 'herbivoreEgg':
        if (
          cur.terrain === TerrainKind.DIRT ||
          cur.terrain === TerrainKind.PLANT
        ) {
          this.cells.set(key, makeHerbivore(this.config.herbivoreBirthHunger));
          return true;
        }
        return false;
      case 'carnivoreEgg':
        if (
          cur.terrain === TerrainKind.DIRT ||
          cur.terrain === TerrainKind.PLANT
        ) {
          this.cells.set(key, makeCarnivore(this.config.carnivoreBirthHunger));
          return true;
        }
        return false;
      case 'erase':
        this.cells.set(key, makeDirt(0, Math.max(0, cur.moisture * 0.5)));
        return true;
    }
  }

  private boundedNeighbors(c: HexCoord): HexCoord[] {
    return hexNeighbors(c).filter((n) => this.inBounds(n));
  }

  step(): GridStats {
    if (!this.hasStarted) return this.computeStats();
    if (this.isFinished()) return this.computeStats();

    const cfg = this.config;
    const rng = this.rng;
    const prev = this.cells;
    const next = cloneCells(prev);

    const terrainOf = (c: HexCoord) => prev.get(coordKey(c))?.terrain;
    const cellOf = (c: HexCoord) => prev.get(coordKey(c));

    for (const c of this.coordsList) {
      const key = coordKey(c);
      const p = prev.get(key)!;
      const n = next.get(key)!;
      n.moisture = Math.max(0, Math.min(1, p.moisture - cfg.moistureDecayPerStep));
    }

    const waterTargets: Map<string, number> = new Map();
    for (const c of this.coordsList) {
      if (terrainOf(c) !== TerrainKind.WATER) continue;
      const neigh = this.boundedNeighbors(c);
      const dirtNeigh = neigh.filter(
        (nb) => terrainOf(nb) === TerrainKind.DIRT,
      );
      if (dirtNeigh.length && rng() < cfg.waterSpreadChance) {
        const t = dirtNeigh[Math.floor(rng() * dirtNeigh.length)];
        const tk = coordKey(t);
        waterTargets.set(tk, (waterTargets.get(tk) ?? 0) + 1);
      }
    }
    for (const [k, votes] of waterTargets) {
      if (votes > 0) {
        const p = prev.get(k)!;
        next.set(k, makeWater());
        next.get(k)!.fertility = p.fertility;
      }
    }

    for (const c of this.coordsList) {
      const key = coordKey(c);
      const n = next.get(key)!;
      if (n.terrain === TerrainKind.WATER) {
        n.moisture = 1;
        const neigh = this.boundedNeighbors(c);
        for (const nb of neigh) {
          const nk = coordKey(nb);
          const nn = next.get(nk)!;
          if (nn.terrain !== TerrainKind.WATER) {
            nn.moisture = Math.min(1, nn.moisture + 0.08);
          }
        }
      }
    }

    for (const c of this.coordsList) {
      const key = coordKey(c);
      const p = prev.get(key)!;
      const n = next.get(key)!;
      if (p.terrain === TerrainKind.HUMUS) {
        const newAge = p.age + 1;
        if (newAge >= cfg.humusToDirtSteps) {
          next.set(
            key,
            makeDirt(Math.min(1, p.fertility + 0.4), Math.max(p.moisture, 0.25)),
          );
        } else {
          n.age = newAge;
        }
      }
    }

    const plantSpread: Map<string, number> = new Map();
    for (const c of this.coordsList) {
      const p = cellOf(c)!;
      if (p.terrain !== TerrainKind.PLANT) continue;
      const key = coordKey(c);
      const n = next.get(key)!;
      const neigh = this.boundedNeighbors(c);
      const waterAdj = neigh.some(
        (nb) => cellOf(nb)?.terrain === TerrainKind.WATER,
      );
      const moistureNow = Math.max(
        p.moisture - cfg.moistureDecayPerStep,
        waterAdj ? 0.5 : 0,
      );
      if (moistureNow < cfg.plantGrowMoistureMin * 0.6 && !waterAdj) {
        next.set(key, makeHumus(Math.min(1, 0.3 + p.fertility * 0.5)));
        continue;
      }
      n.age = p.age + 1;
      n.moisture = Math.min(1, moistureNow + 0.05);

      if (
        n.moisture >= cfg.plantSpreadMoistureMin &&
        rng() < 0.35 + cfg.plantFertileBonus * p.fertility
      ) {
        const dirtNeigh = neigh.filter(
          (nb) => cellOf(nb)?.terrain === TerrainKind.DIRT,
        );
        for (const t of dirtNeigh) {
          const tk = coordKey(t);
          const plantNeighborCount = this.boundedNeighbors(t).filter(
            (nb) =>
              hexEquals(nb, c)
                ? true
                : cellOf(nb)?.terrain === TerrainKind.PLANT,
          ).length;
          if (plantNeighborCount <= cfg.plantSpreadNeighborLimit) {
            plantSpread.set(tk, (plantSpread.get(tk) ?? 0) + 1);
          }
        }
      }
    }
    for (const [k] of plantSpread) {
      const p = prev.get(k)!;
      if (p.terrain === TerrainKind.DIRT && next.get(k)!.terrain === TerrainKind.DIRT) {
        const fertility = Math.min(1, p.fertility + 0.05);
        next.set(k, makePlant(fertility));
      }
    }

    type BreedOffer = { parent: string; target: string };
    const herbBreedOffers: BreedOffer[] = [];
    const carnBreedOffers: BreedOffer[] = [];

    for (const c of this.coordsList) {
      const p = cellOf(c)!;
      if (p.terrain !== TerrainKind.HERBIVORE) continue;
      const key = coordKey(c);
      const n = next.get(key)!;
      const neigh = this.boundedNeighbors(c);
      const plantNeigh = neigh.filter(
        (nb) => cellOf(nb)?.terrain === TerrainKind.PLANT,
      );
      let hunger = p.hunger;
      if (plantNeigh.length > 0) {
        const t = plantNeigh[Math.floor(rng() * plantNeigh.length)];
        const tk = coordKey(t);
        if (next.get(tk)!.terrain === TerrainKind.PLANT) {
          const oldPlant = cellOf(t)!;
          next.set(
            tk,
            makeDirt(Math.min(1, oldPlant.fertility), oldPlant.moisture),
          );
          hunger = 0;
        } else {
          hunger = p.hunger + 1;
        }
      } else {
        hunger = p.hunger + 1;
      }

      if (hunger > cfg.herbivoreMaxHunger) {
        next.set(key, makeHumus(0.4));
        continue;
      }

      n.hunger = hunger;
      n.age = p.age + 1;

      if (
        hunger <= cfg.herbivoreBreedHungerThreshold &&
        n.age >= 2
      ) {
        const sameKind = neigh.filter(
          (nb) => cellOf(nb)?.terrain === TerrainKind.HERBIVORE,
        ).length;
        if (sameKind >= cfg.herbivoreBreedMateMin) {
          const empty = neigh.filter(
            (nb) =>
              cellOf(nb)?.terrain === TerrainKind.DIRT ||
              cellOf(nb)?.terrain === TerrainKind.PLANT,
          );
          if (empty.length > 0) {
            const t = empty[Math.floor(rng() * empty.length)];
            herbBreedOffers.push({ parent: key, target: coordKey(t) });
          }
        }
      }
    }

    for (const c of this.coordsList) {
      const p = cellOf(c)!;
      if (p.terrain !== TerrainKind.CARNIVORE) continue;
      const key = coordKey(c);
      const n = next.get(key)!;
      const neigh = this.boundedNeighbors(c);
      const preyNeigh = neigh.filter(
        (nb) => next.get(coordKey(nb))!.terrain === TerrainKind.HERBIVORE,
      );
      let hunger = p.hunger;
      if (preyNeigh.length > 0) {
        const t = preyNeigh[Math.floor(rng() * preyNeigh.length)];
        const tk = coordKey(t);
        const oldPrey = cellOf(t)!;
        next.set(tk, makeHumus(0.35 + oldPrey.fertility * 0.3));
        hunger = 0;
      } else {
        const prevPrey = neigh.filter(
          (nb) => cellOf(nb)?.terrain === TerrainKind.HERBIVORE,
        );
        if (prevPrey.length === 0) {
          hunger = p.hunger + 1;
        } else {
          hunger = p.hunger + 1;
        }
      }

      if (hunger > cfg.carnivoreMaxHunger) {
        next.set(key, makeHumus(0.45));
        continue;
      }

      n.hunger = hunger;
      n.age = p.age + 1;

      if (
        hunger <= cfg.carnivoreBreedHungerThreshold &&
        n.age >= 3
      ) {
        const sameKind = neigh.filter(
          (nb) =>
            hexEquals(nb, c)
              ? false
              : next.get(coordKey(nb))!.terrain === TerrainKind.CARNIVORE,
        ).length;
        if (sameKind >= cfg.carnivoreBreedMateMin) {
          const empty = neigh.filter(
            (nb) => {
              const t = next.get(coordKey(nb))!.terrain;
              return t === TerrainKind.DIRT || t === TerrainKind.PLANT;
            },
          );
          if (empty.length > 0) {
            const t = empty[Math.floor(rng() * empty.length)];
            carnBreedOffers.push({ parent: key, target: coordKey(t) });
          }
        }
      }
    }

    const herbTargetTaken = new Set<string>();
    herbBreedOffers.sort((a, b) => a.parent.localeCompare(b.parent));
    for (const offer of herbBreedOffers) {
      if (herbTargetTaken.has(offer.target)) continue;
      const tt = next.get(offer.target)!;
      if (tt.terrain === TerrainKind.DIRT || tt.terrain === TerrainKind.PLANT) {
        next.set(offer.target, makeHerbivore(cfg.herbivoreBirthHunger));
        herbTargetTaken.add(offer.target);
      }
    }
    const carnTargetTaken = new Set<string>();
    carnBreedOffers.sort((a, b) => a.parent.localeCompare(b.parent));
    for (const offer of carnBreedOffers) {
      if (carnTargetTaken.has(offer.target)) continue;
      const tt = next.get(offer.target)!;
      if (tt.terrain === TerrainKind.DIRT || tt.terrain === TerrainKind.PLANT) {
        next.set(offer.target, makeCarnivore(cfg.carnivoreBirthHunger));
        carnTargetTaken.add(offer.target);
      }
    }

    this.cells = next;
    this.stepCount += 1;
    return this.computeStats();
  }

  isFinished(): boolean {
    const s = this.computeStats();
    return s.won || s.lost || this.stepCount >= this.config.maxSteps;
  }

  computeStats(): GridStats {
    let dirt = 0, water = 0, plant = 0, herbivore = 0, carnivore = 0, humus = 0;
    for (const c of this.cells.values()) {
      switch (c.terrain) {
        case TerrainKind.DIRT: dirt++; break;
        case TerrainKind.WATER: water++; break;
        case TerrainKind.PLANT: plant++; break;
        case TerrainKind.HERBIVORE: herbivore++; break;
        case TerrainKind.CARNIVORE: carnivore++; break;
        case TerrainKind.HUMUS: humus++; break;
      }
    }
    const total = this.coordsList.length;
    const plantExtinct = plant === 0 && this.hasStarted;
    const herbivoreExtinct = herbivore === 0 && this.hasStarted;
    const carnivoreExtinct = carnivore === 0 && this.hasStarted;
    const occupied = plant + herbivore + carnivore;
    const overcrowd = total > 0 ? occupied / total : 0;
    const collapsed = overcrowd >= this.config.collapseOvercrowdThreshold;
    const lost =
      this.hasStarted &&
      (plantExtinct || herbivoreExtinct || carnivoreExtinct || collapsed);
    const won =
      this.hasStarted &&
      !lost &&
      this.stepCount >= this.config.maxSteps &&
      plant > 0 && herbivore > 0 && carnivore > 0;
    return {
      step: this.stepCount,
      dirt,
      water,
      plant,
      herbivore,
      carnivore,
      humus,
      plantExtinct,
      herbivoreExtinct,
      carnivoreExtinct,
      collapsed,
      won,
      lost,
    };
  }
}

export const DEFAULT_RESOURCES: PlayerResources = {
  water: 10,
  seed: 10,
  herbivoreEgg: 4,
  carnivoreEgg: 2,
};
