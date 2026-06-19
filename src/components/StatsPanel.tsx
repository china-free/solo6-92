import React from 'react';
import { GridStats } from '../engine/types';

interface Props {
  stats: GridStats;
  maxSteps: number;
}

export const StatsPanel: React.FC<Props> = ({ stats, maxSteps }) => {
  const total =
    stats.dirt + stats.water + stats.plant + stats.herbivore + stats.carnivore + stats.humus;
  const rows = [
    { label: '土壤', key: 'dirt', color: '#8a6a43', val: stats.dirt },
    { label: '水域', key: 'water', color: '#3d8bff', val: stats.water },
    { label: '植物', key: 'plant', color: '#5dc36a', val: stats.plant, extinct: stats.plantExtinct },
    { label: '草食虫', key: 'herb', color: '#f7d560', val: stats.herbivore, extinct: stats.herbivoreExtinct },
    { label: '肉食虫', key: 'carn', color: '#ff725c', val: stats.carnivore, extinct: stats.carnivoreExtinct },
    { label: '腐殖质', key: 'hum', color: '#6b4a2b', val: stats.humus },
  ];

  return (
    <div className="section">
      <h3>种群统计</h3>
      <div className="step-banner">
        <div>
          <div className="cur">第 {stats.step} / {maxSteps} 步</div>
        </div>
        <div className="max">共 {total} 格</div>
      </div>
      {rows.map((r) => (
        <div key={r.key} className="stat-row">
          <div className="label">
            <span className="dot" style={{ background: r.color, boxShadow: `0 0 8px ${r.color}66` }} />
            {r.label}
            {r.extinct && <span className="badge danger" style={{ marginLeft: 6 }}>灭绝</span>}
          </div>
          <div className="val">{r.val}</div>
        </div>
      ))}
    </div>
  );
};
