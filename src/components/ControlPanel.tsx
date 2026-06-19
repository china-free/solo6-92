import React from 'react';

interface Props {
  started: boolean;
  finished: boolean;
  paused: boolean;
  speed: number;
  onStart: () => void;
  onPauseToggle: () => void;
  onStepOnce: () => void;
  onReset: () => void;
  onFastForward: () => void;
  onSpeedChange: (v: number) => void;
}

export const ControlPanel: React.FC<Props> = ({
  started,
  finished,
  paused,
  speed,
  onStart,
  onPauseToggle,
  onStepOnce,
  onReset,
  onFastForward,
  onSpeedChange,
}) => {
  return (
    <div className="section">
      <h3>调度控制</h3>
      {!started && (
        <button className="btn primary" style={{ width: '100%', padding: '12px', fontSize: 14, marginBottom: 10 }} onClick={onStart}>
          ▶ 开始演化
        </button>
      )}
      {started && !finished && (
        <div className="btn-group">
          <button className="btn" onClick={onPauseToggle} disabled={finished}>
            {paused ? '▶ 继续' : '❚❚ 暂停'}
          </button>
          <button className="btn" onClick={onStepOnce} disabled={!paused}>
            ⏭ 单步
          </button>
        </div>
      )}
      {started && (
        <>
          <div className="btn-group">
            <button className="btn" onClick={onFastForward} disabled={finished}>
              ⏩ 快进 10 步
            </button>
            <button className="btn danger ghost" onClick={onReset}>
              ↻ 重置
            </button>
          </div>
          <div className="speed-slider">
            <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>速度</span>
            <input
              type="range"
              min={1}
              max={20}
              step={1}
              value={speed}
              onChange={(e) => onSpeedChange(Number(e.target.value))}
            />
            <span className="speed-val">{speed}×</span>
          </div>
        </>
      )}
      {!started && (
        <button className="btn ghost" style={{ width: '100%', marginTop: 8 }} onClick={onReset}>
          ↻ 清空重布
        </button>
      )}
    </div>
  );
};
