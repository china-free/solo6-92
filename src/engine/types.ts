export enum TerrainKind {
  DIRT = 'dirt',
  WATER = 'water',
  PLANT = 'plant',
  HERBIVORE = 'herbivore',
  CARNIVORE = 'carnivore',
  HUMUS = 'humus',
}

export interface HexCoord {
  readonly q: number;
  readonly r: number;
}

export interface Cell {
  readonly terrain: TerrainKind;
  readonly moisture: number;
  readonly fertility: number;
  readonly age: number;
  readonly hunger: number;
}

export interface GridStats {
  readonly step: number;
  readonly dirt: number;
  readonly water: number;
  readonly plant: number;
  readonly herbivore: number;
  readonly carnivore: number;
  readonly humus: number;
  readonly plantExtinct: boolean;
  readonly herbivoreExtinct: boolean;
  readonly carnivoreExtinct: boolean;
  readonly collapsed: boolean;
  readonly won: boolean;
  readonly lost: boolean;
}

export interface EcosystemConfig {
  readonly radius: number;
  readonly maxSteps: number;
  readonly moistureDecayPerStep: number;
  readonly waterSpreadChance: number;
  readonly plantGrowMoistureMin: number;
  readonly plantSpreadMoistureMin: number;
  readonly plantSpreadNeighborLimit: number;
  readonly plantFertileBonus: number;
  readonly herbivoreMaxHunger: number;
  readonly herbivoreBreedHungerThreshold: number;
  readonly herbivoreBreedMateMin: number;
  readonly herbivoreBirthHunger: number;
  readonly carnivoreMaxHunger: number;
  readonly carnivoreBreedHungerThreshold: number;
  readonly carnivoreBreedMateMin: number;
  readonly carnivoreBirthHunger: number;
  readonly humusToDirtSteps: number;
  readonly collapseOvercrowdThreshold: number;
}

export const DEFAULT_CONFIG: EcosystemConfig = {
  radius: 6,
  maxSteps: 100,
  moistureDecayPerStep: 0.08,
  waterSpreadChance: 0.55,
  plantGrowMoistureMin: 0.35,
  plantSpreadMoistureMin: 0.45,
  plantSpreadNeighborLimit: 3,
  plantFertileBonus: 0.35,
  herbivoreMaxHunger: 6,
  herbivoreBreedHungerThreshold: 1,
  herbivoreBreedMateMin: 1,
  herbivoreBirthHunger: 3,
  carnivoreMaxHunger: 7,
  carnivoreBreedHungerThreshold: 1,
  carnivoreBreedMateMin: 1,
  carnivoreBirthHunger: 3,
  humusToDirtSteps: 4,
  collapseOvercrowdThreshold: 0.78,
};

export interface PlayerResources {
  water: number;
  seed: number;
  herbivoreEgg: number;
  carnivoreEgg: number;
}

export type PlacementTool =
  | 'water'
  | 'seed'
  | 'herbivoreEgg'
  | 'carnivoreEgg'
  | 'erase';
