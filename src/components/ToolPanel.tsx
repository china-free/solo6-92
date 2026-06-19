import React from 'react';
import { PlacementTool, PlayerResources } from '../engine/types';

interface Props {
  resources: PlayerResources;
  tool: PlacementTool | null;
  setTool: (t: PlacementTool | null) => void;
  started: boolean;
}

const TOOLS: { id: PlacementTool; label: string; color: string; key: keyof PlayerResources | null; desc: string }[] = [
  { id: 'water', label: '水滴', color: '#3d8bff', key: 'water', desc: '扩散润土，滋润植物' },
  { id: 'seed', label: '种子', color: '#5dc36a', key: 'seed', desc: '在湿润土壤上蔓延成林' },
  { id: 'herbivoreEgg', label: '草食虫卵', color: '#f7d560', key: 'herbivoreEgg', desc: '孵化后吃植物，饱则繁殖' },
  { id: 'carnivoreEgg', label: '肉食虫卵', color: '#ff725c', key: 'carnivoreEgg', desc: '捕食草食虫，调控种群' },
  { id: 'erase', label: '擦除', color: '#888', key: null, desc: '把格子变回干土' },
];

export const ToolPanel: React.FC<Props> = ({ resources, tool, setTool, started }) => {
  return (
    <div className="section">
      <h3>布置工具</h3>
      <div className="btn-group-3">
        {TOOLS.slice(0, 3).map((t) => {
          const count = t.key ? resources[t.key] : null;
          const disabled = started || (t.key != null && count != null && count <= 0);
          return (
            <button
              key={t.id}
              className={`tool-btn ${tool === t.id ? 'active' : ''}`}
              onClick={() => setTool(tool === t.id ? null : t.id)}
              disabled={disabled}
              title={t.desc}
            >
              <span className="tool-icon" style={{ background: t.color, boxShadow: `0 0 10px ${t.color}55` }} />
              <span>{t.label}</span>
              <span className="tool-count">{count != null ? count : '∞'}</span>
            </button>
          );
        })}
      </div>
      <div className="btn-group-3">
        {TOOLS.slice(3).map((t) => {
          const count = t.key ? resources[t.key] : null;
          const disabled = started || (t.key != null && count != null && count <= 0);
          return (
            <button
              key={t.id}
              className={`tool-btn ${tool === t.id ? 'active' : ''}`}
              onClick={() => setTool(tool === t.id ? null : t.id)}
              disabled={disabled}
              title={t.desc}
            >
              <span className="tool-icon" style={{ background: t.color, boxShadow: `0 0 10px ${t.color}55` }} />
              <span>{t.label}</span>
              <span className="tool-count">{count != null ? count : '∞'}</span>
            </button>
          );
        })}
      </div>
      {!started && (
        <div className="tip">
          点击选择工具，再点击六角格布置。准备好后点击「开始演化」。
        </div>
      )}
      {started && (
        <div className="tip" style={{ borderLeftColor: 'var(--warn)' }}>
          演化进行中，无法再布置资源。如需重新布置请点击「重置」。
        </div>
      )}
    </div>
  );
};
