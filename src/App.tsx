import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { HexBoard } from './components/HexBoard';
import { ToolPanel } from './components/ToolPanel';
import { StatsPanel } from './components/StatsPanel';
import { ControlPanel } from './components/ControlPanel';
import { DEFAULT_CONFIG, GridStats, HexCoord, PlacementTool, PlayerResources } from './engine/types';
import {
  DEFAULT_RESOURCES,
  EcosystemEngine,
  EcosystemSnapshot,
} from './engine/engine';

function toolConsumesResource(tool: PlacementTool): keyof PlayerResources | null {
  switch (tool) {
    case 'water': return 'water';
    case 'seed': return 'seed';
    case 'herbivoreEgg': return 'herbivoreEgg';
    case 'carnivoreEgg': return 'carnivoreEgg';
    default: return null;
  }
}

const App: React.FC = () => {
  const engineRef = useRef<EcosystemEngine | null>(null);
  if (engineRef.current == null) {
    engineRef.current = new EcosystemEngine(DEFAULT_CONFIG, 20250619);
  }
  const engine = engineRef.current;

  const [snapshot, setSnapshot] = useState<EcosystemSnapshot>(() => engine.snapshot);
  const [resources, setResources] = useState<PlayerResources>({ ...DEFAULT_RESOURCES });
  const [tool, setTool] = useState<PlacementTool | null>(null);
  const [paused, setPaused] = useState(true);
  const [speed, setSpeed] = useState<number>(4);
  const [, forceTick] = useState(0);
  const [, setStats] = useState<GridStats>(snapshot.stats);

  const syncSnapshot = useCallback(() => {
    const snap = engine.snapshot;
    setSnapshot(snap);
    setStats(snap.stats);
  }, [engine]);

  useEffect(() => {
    syncSnapshot();
  }, [syncSnapshot]);

  const advanceOne = useCallback(() => {
    const s = engine.step();
    setStats(s);
    setSnapshot(engine.snapshot);
  }, [engine]);

  useEffect(() => {
    if (!snapshot.started || snapshot.finished || paused) return;
    const ms = Math.max(20, Math.floor(800 / speed));
    const id = window.setInterval(() => {
      advanceOne();
      forceTick((x) => x + 1);
    }, ms);
    return () => window.clearInterval(id);
  }, [snapshot.started, snapshot.finished, paused, speed, advanceOne]);

  const handleStart = useCallback(() => {
    if (snapshot.started) return;
    engine.start();
    setPaused(false);
    syncSnapshot();
  }, [engine, snapshot.started, syncSnapshot]);

  const handlePauseToggle = useCallback(() => {
    setPaused((p) => !p);
  }, []);

  const handleStepOnce = useCallback(() => {
    if (!snapshot.started) return;
    advanceOne();
  }, [advanceOne, snapshot.started]);

  const handleFastForward = useCallback(() => {
    if (!snapshot.started) return;
    const wasPaused = paused;
    setPaused(true);
    let safety = 0;
    while (safety++ < 10 && !engine.snapshot.finished) {
      advanceOne();
    }
    if (!wasPaused && !engine.snapshot.finished) {
      setPaused(false);
    }
  }, [advanceOne, engine, paused, snapshot.started]);

  const handleReset = useCallback(() => {
    engine.reset();
    setResources({ ...DEFAULT_RESOURCES });
    setTool(null);
    setPaused(true);
    syncSnapshot();
  }, [engine, syncSnapshot]);

  const handleCellClick = useCallback(
    (coord: HexCoord) => {
      if (snapshot.started) return;
      if (tool == null) return;
      const before = resources;
      const rKey = toolConsumesResource(tool);
      if (rKey != null && before[rKey] <= 0) return;
      const ok = engine.place(tool, coord);
      if (!ok) return;
      if (rKey != null) {
        setResources({ ...before, [rKey]: before[rKey] - 1 });
      }
      syncSnapshot();
    },
    [engine, resources, snapshot.started, syncSnapshot, tool],
  );

  const stats = snapshot.stats;
  const titleStatus = useMemo(() => {
    if (stats.won) return 'won';
    if (stats.lost) return 'lost';
    if (snapshot.started && !paused) return 'running';
    return 'idle';
  }, [stats.lost, stats.won, snapshot.started, paused]);

  const titleText = useMemo(() => {
    if (stats.won) return '生态平衡 · 挑战成功';
    if (stats.collapsed) return '生态崩溃 · 过度拥挤';
    if (stats.plantExtinct) return '植物灭绝 · 生态断裂';
    if (stats.herbivoreExtinct) return '草食虫灭绝 · 食物链断裂';
    if (stats.carnivoreExtinct) return '肉食虫灭绝 · 种群失控';
    if (!snapshot.started) return '布置资源，建立你的生态瓶';
    if (paused) return '已暂停 · 可单步调试';
    return '演化进行中…';
  }, [stats, snapshot.started, paused]);

  return (
    <div className="app">
      <header className="app-header">
        <div className="app-title">
          <span className={`title-dot ${titleStatus}`} />
          <span>六边形生态瓶 · Hex Ecosystem</span>
          <span className={`badge ${
            stats.won ? 'ok' : stats.lost ? 'danger' : snapshot.started ? 'info' : 'warn'
          }`} style={{ marginLeft: 12 }}>
            {titleText}
          </span>
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>
          目标：撑满 {DEFAULT_CONFIG.maxSteps} 步，植物 / 草食 / 肉食 三者均不灭绝且不过度拥挤
        </div>
      </header>

      <aside className="panel left">
        <ToolPanel
          resources={resources}
          tool={tool}
          setTool={setTool}
          started={snapshot.started}
        />
        <ControlPanel
          started={snapshot.started}
          finished={snapshot.finished}
          paused={paused}
          speed={speed}
          onStart={handleStart}
          onPauseToggle={handlePauseToggle}
          onStepOnce={handleStepOnce}
          onReset={handleReset}
          onFastForward={handleFastForward}
          onSpeedChange={setSpeed}
        />
      </aside>

      <div className="board-wrapper">
        <div className="board-scroll-wrap">
          <HexBoard
            coords={snapshot.coords}
            cells={snapshot.cells}
            radius={DEFAULT_CONFIG.radius}
            onCellClick={handleCellClick}
            hoveredTool={tool}
            started={snapshot.started}
          />
          {(stats.won || stats.lost) && (
            <div className="result-overlay">
              <div className="result-card">
                <h2 className={stats.won ? 'win' : 'lose'}>
                  {stats.won ? '🌱 生态平衡 · 挑战成功' : '💥 生态崩溃'}
                </h2>
                <p>
                  {stats.won
                    ? `在第 ${stats.step} 步，植物(${stats.plant})、草食虫(${stats.herbivore})、肉食虫(${stats.carnivore}) 三者和谐共存。完美的生态闭环！`
                    : stats.collapsed
                      ? `在第 ${stats.step} 步，种群密度过高引发生态崩溃。生物占比超过了 ${Math.round(DEFAULT_CONFIG.collapseOvercrowdThreshold * 100)}%。`
                      : `在第 ${stats.step} 步物种灭绝：
                         ${stats.plantExtinct ? '植物 ' : ''}
                         ${stats.herbivoreExtinct ? '草食虫 ' : ''}
                         ${stats.carnivoreExtinct ? '肉食虫 ' : ''}
                         生态链已断裂。`}
                </p>
                <button className="btn primary" style={{ padding: '10px 22px', fontSize: 14 }} onClick={handleReset}>
                  再来一局
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <aside className="panel right">
        <StatsPanel stats={stats} maxSteps={DEFAULT_CONFIG.maxSteps} />

        <div className="section">
          <h3>规则速览</h3>
          <div className="status-card">
            <h4>💧 水 & 土</h4>
            水流向相邻土格扩散；周围的土壤会被浸润增加湿度。湿度不足的植物会衰败成腐殖质。
          </div>
          <div className="status-card">
            <h4>🌿 植物</h4>
            在湿润且邻居植物不拥挤的土格蔓延；肥沃土壤加速扩散。死亡后转化为腐殖质。
          </div>
          <div className="status-card">
            <h4>🐛 草食虫</h4>
            捕食相邻植物充饥，饱腹且有同类则产卵；饥饿超过阈值死亡 → 腐殖质。
          </div>
          <div className="status-card">
            <h4>🐞 肉食虫</h4>
            捕食相邻草食虫；吃饱且有同类时产卵；饥饿死亡 → 腐殖质。
          </div>
          <div className="status-card">
            <h4>♻️ 闭环</h4>
            腐殖质经过 {DEFAULT_CONFIG.humusToDirtSteps} 步分解为肥沃土壤，加速下一轮植物生长。
          </div>
        </div>
      </aside>
    </div>
  );
};

export default App;
