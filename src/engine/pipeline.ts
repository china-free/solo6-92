import { Cell, EcosystemConfig, HexCoord } from './types';
import {
  MutableCell,
  MutationCommand,
  cloneCells,
  resolveAndApply,
} from './commands';

export interface PipelineContext {
  readonly cells: ReadonlyMap<string, Cell>;
  readonly coords: readonly HexCoord[];
  readonly config: EcosystemConfig;
  readonly rng: () => number;
  readonly boundedNeighbors: (c: HexCoord) => HexCoord[];
}

export interface PipelinePhase {
  readonly name: string;
  readonly systems: PipelineSystem[];
}

export interface SystemOutput {
  readonly commands: MutationCommand[];
}

export interface PipelineSystem {
  readonly name: string;
  collect(ctx: PipelineContext): SystemOutput;
}

export class EcosystemPipeline {
  private readonly phases: PipelinePhase[];
  private readonly config: EcosystemConfig;
  private readonly coords: HexCoord[];
  private readonly boundedNeighbors: (c: HexCoord) => HexCoord[];
  private rng: () => number;
  private cells: Map<string, MutableCell>;

  constructor(
    config: EcosystemConfig,
    coords: HexCoord[],
    phases: PipelinePhase[],
    rng: () => number,
    boundedNeighbors: (c: HexCoord) => HexCoord[],
    initialCells: Map<string, MutableCell>,
  ) {
    this.config = config;
    this.coords = coords;
    this.phases = phases;
    this.rng = rng;
    this.boundedNeighbors = boundedNeighbors;
    this.cells = initialCells;
  }

  setRng(rng: () => number): void {
    this.rng = rng;
  }

  step(prev: ReadonlyMap<string, Cell>): ReadonlyMap<string, Cell> {
    this.cells = cloneCells(prev);

    for (const phase of this.phases) {
      const ctx: PipelineContext = {
        cells: this.cells as ReadonlyMap<string, Cell>,
        coords: this.coords,
        config: this.config,
        rng: this.rng,
        boundedNeighbors: this.boundedNeighbors,
      };

      const allCommands: MutationCommand[] = [];
      for (const sys of phase.systems) {
        const output = sys.collect(ctx);
        allCommands.push(...output.commands);
      }

      resolveAndApply(this.cells, allCommands);
    }

    return this.cells as ReadonlyMap<string, Cell>;
  }

  getCells(): ReadonlyMap<string, Cell> {
    return this.cells as ReadonlyMap<string, Cell>;
  }

  setCells(cells: Map<string, MutableCell>): void {
    this.cells = cells;
  }

  cloneCurrent(): Map<string, MutableCell> {
    return cloneCells(this.cells as ReadonlyMap<string, Cell>);
  }
}
