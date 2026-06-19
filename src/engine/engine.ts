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
  MutableCell,
  cloneCells,
} from './commands';
import {
  coordKey,
  generateHexRing,
  hexDistance,
  hexNeighbors,
} from './hex';
import { EcosystemPipeline, PipelinePhase } from './pipeline';
import { WaterSystem } from './systems/water';
import { HumusSystem } from './systems/humus';
import { PlantSystem } from './systems/plant';
import { AnimalSystem } from './systems/animal';

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

function buildPhases(): PipelinePhase[] {
  return [
    {
      name: 'water',
      systems: [new WaterSystem()],
    },
    {
      name: 'humus',
      systems: [new HumusSystem()],
    },
    {
      name: 'plant',
      systems: [new PlantSystem()],
    },
    {
      name: 'animal',
      systems: [new AnimalSystem()],
    },
  ];
}

export class EcosystemEngine {
  private readonly config: EcosystemConfig;
  private readonly coordsList: HexCoord[];
  private readonly coordSet: Set<string>;
  private cells: Map<string, MutableCell>;
  private stepCount: number;
  private hasStarted: boolean;
  private rng: () => number;
  private readonly pipeline: EcosystemPipeline;

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
      this.cells.set(coordKey(c), makeDirt(0, moistureBase) as MutableCell);
    }

    this.pipeline = new EcosystemPipeline(
      config,
      this.coordsList,
      buildPhases(),
      this.rng,
      (c) => this.boundedNeighbors(c),
      this.cells,
    );
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
    this.pipeline.setRng(this.rng);
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
      this.cells.set(coordKey(c), makeDirt(0, moistureBase) as MutableCell);
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
        this.cells.set(key, makeWater() as MutableCell);
        return true;
      case 'seed':
        if (cur.terrain === TerrainKind.DIRT) {
          this.cells.set(key, makePlant(cur.fertility) as MutableCell);
          return true;
        }
        return false;
      case 'herbivoreEgg':
        if (
          cur.terrain === TerrainKind.DIRT ||
          cur.terrain === TerrainKind.PLANT
        ) {
          this.cells.set(
            key,
            makeHerbivore(this.config.herbivoreBirthHunger) as MutableCell,
          );
          return true;
        }
        return false;
      case 'carnivoreEgg':
        if (
          cur.terrain === TerrainKind.DIRT ||
          cur.terrain === TerrainKind.PLANT
        ) {
          this.cells.set(
            key,
            makeCarnivore(this.config.carnivoreBirthHunger) as MutableCell,
          );
          return true;
        }
        return false;
      case 'erase':
        this.cells.set(
          key,
          makeDirt(0, Math.max(0, cur.moisture * 0.5)) as MutableCell,
        );
        return true;
    }
  }

  private boundedNeighbors(c: HexCoord): HexCoord[] {
    return hexNeighbors(c).filter((n) => this.inBounds(n));
  }

  step(): GridStats {
    if (!this.hasStarted) return this.computeStats();
    if (this.isFinished()) return this.computeStats();

    const prev = this.cells as ReadonlyMap<string, Cell>;
    const next = this.pipeline.step(prev);

    this.cells = next as Map<string, MutableCell>;
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
