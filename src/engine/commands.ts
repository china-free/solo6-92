import { Cell, TerrainKind } from './types';

export type MutableCell = { -readonly [K in keyof Cell]: Cell[K] };

export function cloneCell(c: Cell): MutableCell {
  return { ...c };
}

export function cloneCells(
  src: ReadonlyMap<string, Cell>,
): Map<string, MutableCell> {
  const out = new Map<string, MutableCell>();
  for (const [k, v] of src) out.set(k, cloneCell(v));
  return out;
}

export const Priority = {
  DECAY: 10,
  PROPERTY_ADD: 20,
  HUMUS_CONVERT: 30,
  WATER_SPREAD: 40,
  PLANT_DIE: 50,
  PLANT_SPREAD: 55,
  ANIMAL_STARVE: 60,
  PROPERTY_SET: 70,
  BIRTH: 80,
  PREY_KILLED: 90,
} as const;

export type MutationKind =
  | 'setTerrain'
  | 'setMoisture'
  | 'addMoisture'
  | 'setFertility'
  | 'addFertility'
  | 'setAge'
  | 'incrementAge'
  | 'setHunger'
  | 'incrementHunger'
  | 'resetHunger';

export interface SetTerrainCmd {
  readonly kind: 'setTerrain';
  readonly target: string;
  readonly priority: number;
  readonly terrain: TerrainKind;
  readonly preserveFertility?: boolean;
  readonly preserveMoisture?: boolean;
  readonly moistureValue?: number;
  readonly fertilityValue?: number;
}

export interface SetMoistureCmd {
  readonly kind: 'setMoisture';
  readonly target: string;
  readonly priority: number;
  readonly value: number;
}

export interface AddMoistureCmd {
  readonly kind: 'addMoisture';
  readonly target: string;
  readonly priority: number;
  readonly delta: number;
}

export interface SetFertilityCmd {
  readonly kind: 'setFertility';
  readonly target: string;
  readonly priority: number;
  readonly value: number;
}

export interface AddFertilityCmd {
  readonly kind: 'addFertility';
  readonly target: string;
  readonly priority: number;
  readonly delta: number;
}

export interface SetAgeCmd {
  readonly kind: 'setAge';
  readonly target: string;
  readonly priority: number;
  readonly value: number;
}

export interface IncrementAgeCmd {
  readonly kind: 'incrementAge';
  readonly target: string;
  readonly priority: number;
}

export interface SetHungerCmd {
  readonly kind: 'setHunger';
  readonly target: string;
  readonly priority: number;
  readonly value: number;
}

export interface IncrementHungerCmd {
  readonly kind: 'incrementHunger';
  readonly target: string;
  readonly priority: number;
}

export interface ResetHungerCmd {
  readonly kind: 'resetHunger';
  readonly target: string;
  readonly priority: number;
}

export type MutationCommand =
  | SetTerrainCmd
  | SetMoistureCmd
  | AddMoistureCmd
  | SetFertilityCmd
  | AddFertilityCmd
  | SetAgeCmd
  | IncrementAgeCmd
  | SetHungerCmd
  | IncrementHungerCmd
  | ResetHungerCmd;

export function applyMutation(cell: MutableCell, cmd: MutationCommand): void {
  switch (cmd.kind) {
    case 'setTerrain': {
      const fertility = cmd.preserveFertility
        ? cell.fertility
        : (cmd.fertilityValue ?? 0);
      const moisture = cmd.preserveMoisture
        ? cell.moisture
        : (cmd.moistureValue ?? 0);
      cell.terrain = cmd.terrain;
      cell.fertility = fertility;
      cell.moisture = moisture;
      cell.age = 0;
      cell.hunger = 0;
      break;
    }
    case 'setMoisture':
      cell.moisture = Math.max(0, Math.min(1, cmd.value));
      break;
    case 'addMoisture':
      cell.moisture = Math.max(0, Math.min(1, cell.moisture + cmd.delta));
      break;
    case 'setFertility':
      cell.fertility = Math.max(0, Math.min(1, cmd.value));
      break;
    case 'addFertility':
      cell.fertility = Math.max(0, Math.min(1, cell.fertility + cmd.delta));
      break;
    case 'setAge':
      cell.age = cmd.value;
      break;
    case 'incrementAge':
      cell.age += 1;
      break;
    case 'setHunger':
      cell.hunger = cmd.value;
      break;
    case 'incrementHunger':
      cell.hunger += 1;
      break;
    case 'resetHunger':
      cell.hunger = 0;
      break;
  }
}

export function resolveAndApply(
  cells: Map<string, MutableCell>,
  commands: readonly MutationCommand[],
): void {
  const sorted = [...commands].sort((a, b) => a.priority - b.priority);
  for (const cmd of sorted) {
    const cell = cells.get(cmd.target);
    if (!cell) continue;
    applyMutation(cell, cmd);
  }
}

export function cmdSetTerrain(
  target: string,
  terrain: TerrainKind,
  priority: number,
  opts: {
    preserveFertility?: boolean;
    preserveMoisture?: boolean;
    moistureValue?: number;
    fertilityValue?: number;
  } = {},
): SetTerrainCmd {
  return { kind: 'setTerrain', target, priority, terrain, ...opts };
}

export function cmdSetMoisture(
  target: string,
  value: number,
  priority: number,
): SetMoistureCmd {
  return { kind: 'setMoisture', target, priority, value };
}

export function cmdAddMoisture(
  target: string,
  delta: number,
  priority: number,
): AddMoistureCmd {
  return { kind: 'addMoisture', target, priority, delta };
}

export function cmdSetFertility(
  target: string,
  value: number,
  priority: number,
): SetFertilityCmd {
  return { kind: 'setFertility', target, priority, value };
}

export function cmdAddFertility(
  target: string,
  delta: number,
  priority: number,
): AddFertilityCmd {
  return { kind: 'addFertility', target, priority, delta };
}

export function cmdIncrementAge(
  target: string,
  priority: number,
): IncrementAgeCmd {
  return { kind: 'incrementAge', target, priority };
}

export function cmdSetAge(
  target: string,
  value: number,
  priority: number,
): SetAgeCmd {
  return { kind: 'setAge', target, priority, value };
}

export function cmdIncrementHunger(
  target: string,
  priority: number,
): IncrementHungerCmd {
  return { kind: 'incrementHunger', target, priority };
}

export function cmdSetHunger(
  target: string,
  value: number,
  priority: number,
): SetHungerCmd {
  return { kind: 'setHunger', target, priority, value };
}

export function cmdResetHunger(
  target: string,
  priority: number,
): ResetHungerCmd {
  return { kind: 'resetHunger', target, priority };
}

export type Rng = () => number;

export function shuffle<T>(arr: T[], rng: Rng): void {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}
