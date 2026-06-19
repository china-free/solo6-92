import React from 'react';
import { Cell, HexCoord, PlacementTool, TerrainKind } from '../engine/types';
import { coordKey, hexCornerPoints, hexToPixel } from '../engine/hex';

interface Props {
  coords: readonly HexCoord[];
  cells: ReadonlyMap<string, Cell>;
  radius: number;
  onCellClick: (coord: HexCoord) => void;
  hoveredTool: PlacementTool | null;
  started: boolean;
}

function cellFill(cell: Cell): string {
  switch (cell.terrain) {
    case TerrainKind.DIRT: {
      const fert = cell.fertility;
      const moist = cell.moisture;
      const r = Math.round(138 - fert * 20 + moist * 8);
      const g = Math.round(106 - fert * 15 + moist * 10);
      const b = Math.round(67 - fert * 10 + moist * 20);
      return `rgb(${r},${g},${b})`;
    }
    case TerrainKind.WATER:
      return `rgb(${61 - Math.round(cell.age * 1.5) % 10},${
        139 - Math.round(cell.age * 2) % 15
      },${255})`;
    case TerrainKind.PLANT: {
      const s = Math.min(1, cell.moisture + cell.fertility * 0.3);
      const r = Math.round(93 - s * 30);
      const g = Math.round(195 - s * 10);
      const b = Math.round(106 - s * 30);
      return `rgb(${r},${g},${b})`;
    }
    case TerrainKind.HERBIVORE:
      return '#f7d560';
    case TerrainKind.CARNIVORE:
      return '#ff725c';
    case TerrainKind.HUMUS:
      return '#6b4a2b';
  }
}

function cellOverlay(cell: Cell): JSX.Element | null {
  if (cell.terrain === TerrainKind.HERBIVORE) {
    const hungerRatio = Math.max(
      0,
      1 - cell.hunger / Math.max(1, 6),
    );
    return (
      <g>
        <circle
          cx="0"
          cy="-1"
          r={10 + cell.age * 0.3}
          fill="#f7d560"
          stroke="#c9a944"
          strokeWidth="1.2"
        />
        <circle cx={-3} cy={-3} r={1.8} fill="#1a1400" />
        <circle cx={3} cy={-3} r={1.8} fill="#1a1400" />
        <path
          d={`M -6 2 Q 0 ${2 + 2 * hungerRatio} 6 2`}
          fill="none"
          stroke="#1a1400"
          strokeWidth="1.2"
        />
      </g>
    );
  }
  if (cell.terrain === TerrainKind.CARNIVORE) {
    return (
      <g>
        <polygon
          points="-11,-2 0,-13 11,-2 8,9 -8,9"
          fill="#ff725c"
          stroke="#c54d3c"
          strokeWidth="1.2"
        />
        <circle cx={-3} cy={-3} r={2} fill="#2a0a06" />
        <circle cx={3} cy={-3} r={2} fill="#2a0a06" />
        <polygon points="-3,3 0,6 3,3" fill="#2a0a06" />
      </g>
    );
  }
  if (cell.terrain === TerrainKind.PLANT) {
    const h = 10 + Math.min(14, cell.age * 1.2);
    return (
      <g>
        <path
          d={`M 0 10 Q ${-4 - cell.age * 0.2} ${10 - h * 0.5} 0 ${10 - h} Q ${
            4 + cell.age * 0.2
          } ${10 - h * 0.5} 0 10 Z`}
          fill="#2d8f40"
        />
        <path
          d={`M 0 ${10 - h * 0.6} q -${4 + cell.age * 0.3} -${h * 0.15} -${
            6 + cell.age * 0.3
          } -${h * 0.05}`}
          stroke="#5dc36a"
          strokeWidth="2"
          fill="none"
          strokeLinecap="round"
        />
        <path
          d={`M 0 ${10 - h * 0.5} q ${4 + cell.age * 0.3} -${h * 0.15} ${
            6 + cell.age * 0.3
          } -${h * 0.05}`}
          stroke="#5dc36a"
          strokeWidth="2"
          fill="none"
          strokeLinecap="round"
        />
      </g>
    );
  }
  if (cell.terrain === TerrainKind.WATER) {
    return (
      <g opacity="0.75">
        <path
          d={`M -12 ${Math.sin(cell.age * 0.4) * 1.5} Q 0 ${
            -6 + Math.cos(cell.age * 0.3) * 2
          } 12 ${Math.sin(cell.age * 0.4 + 1.2) * 1.5}`}
          fill="none"
          stroke="#b9dcff"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
        <path
          d={`M -10 ${4 + Math.cos(cell.age * 0.5) * 1} Q 0 ${
            2 + Math.sin(cell.age * 0.3) * 1.5
          } 10 ${4 + Math.sin(cell.age * 0.5 + 1) * 1}`}
          fill="none"
          stroke="#9fcfff"
          strokeWidth="1.2"
          strokeLinecap="round"
        />
      </g>
    );
  }
  if (cell.terrain === TerrainKind.HUMUS) {
    return (
      <g opacity="0.7">
        <circle cx={-5} cy={-4} r={2} fill="#3a2714" />
        <circle cx={4} cy={-2} r={1.6} fill="#3a2714" />
        <circle cx={-2} cy={5} r={1.8} fill="#3a2714" />
        <circle cx={6} cy={4} r={1.4} fill="#3a2714" />
      </g>
    );
  }
  return null;
}

export const HexBoard: React.FC<Props> = ({
  coords,
  cells,
  radius,
  onCellClick,
  hoveredTool,
  started,
}) => {
  const size = 26;
  const padding = 40;
  const span = (radius + 1) * size * Math.sqrt(3);
  const view = span * 2 + padding * 2;
  const center = view / 2;

  return (
    <svg
      className="svg-board"
      viewBox={`0 0 ${view} ${view}`}
      width={Math.min(900, view)}
      height={Math.min(900, view)}
    >
      <defs>
        <radialGradient id="bgGlow" cx="50%" cy="45%" r="60%">
          <stop offset="0%" stopColor="rgba(94,194,255,0.05)" />
          <stop offset="100%" stopColor="rgba(0,0,0,0)" />
        </radialGradient>
      </defs>
      <rect width={view} height={view} fill="url(#bgGlow)" />
      {coords.map((c) => {
        const key = coordKey(c);
        const cell = cells.get(key)!;
        const { x, y } = hexToPixel(c, size);
        const cx = center + x;
        const cy = center + y;
        const points = hexCornerPoints(0, 0, size - 1);
        const fill = cellFill(cell);
        const hi = !started && hoveredTool != null;
        return (
          <g
            key={key}
            className="hex-cell"
            transform={`translate(${cx},${cy})`}
            onClick={() => onCellClick(c)}
          >
            <polygon
              className={`hex-shape ${hi ? 'hex-hi' : ''}`}
              points={points}
              fill={fill}
            />
            {cellOverlay(cell)}
          </g>
        );
      })}
    </svg>
  );
};
