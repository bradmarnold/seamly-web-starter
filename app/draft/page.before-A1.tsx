import MeasurementsPanel from '@/components/MeasurementsPanel';
'use client';
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { TUTORIALS, getTutorialById } from '@/lib/tutorials';
import { useDraftStore } from '@/lib/store';
import { DraftingCanvas, type ToolMode } from '@/components/DraftingCanvas';
import { TutorialPanel } from '@/components/TutorialPanel';
import NewBlockModal from '@/components/NewBlockModal';
import PointLADialog from '@/components/PointLADialog';

export default function DraftPage() {
  const sp = useSearchParams();
  const tutorialId = sp.get('t') ?? undefined;
  const tutorial = useMemo(() => (tutorialId ? getTutorialById(tutorialId) : null), [tutorialId]);
  const [showTutorial, setShowTutorial] = useState(Boolean(tutorial));
  const reset = useDraftStore(s => s.reset);

  const [mode, setMode] = useState<ToolMode>('pan');
  const [zoomVersion, setZoomVersion] = useState(0);
  const [zoomDir, setZoomDir] = useState<1|-1>(1);
  const [showNewBlock, setShowNewBlock] = useState(false);
  const [showPointLA, setShowPointLA] = useState(false);
  const currentBlockId = useDraftStore(s=>s.currentBlockId);

  useEffect(() => { reset(); }, [reset]);

  const zoom = (dir: 1|-1) => { setZoomDir(dir); setZoomVersion(v => v + 1); };

  return (
    <main className="container">
      <div className="grid">
        <div className="canvasWrap" style={{position:'relative'}}>
          <div className="toolbar" style={{zIndex:5}} onClick={(e)=>e.stopPropagation()}>
            <button onClick={() => setShowNewBlock(true)}>New block</button>
            <span className="badge">{currentBlockId ? 'Block active' : 'No block'}</span>
            <button onClick={() => setShowTutorial(s => !s)}>{showTutorial ? 'Hide tutorial' : 'Show tutorial'}</button>
            <span className="badge">Tools</span>
            <button onClick={() => setShowPointLA(true)} disabled={!currentBlockId}>Point L∠</button>
            <button onClick={() => setMode('lineBetween')} disabled={!currentBlockId}>Line: between points</button>
            <button onClick={() => setMode('move')} disabled={!currentBlockId}>Move</button>
            <button onClick={() => setMode('pan')}>Pan</button>
            <span className="badge">View</span>
            <button onClick={() => zoom(1)}>Zoom in</button>
            <button onClick={() => zoom(-1)}>Zoom out</button>
          </div>
          <DraftingCanvas mode={mode} zoomSignal={{version: zoomVersion, dir: zoomDir}} />
        </div>
        <div className="panel">
          <h2>Tutorials</h2>
          <div className="body">
            <select
              defaultValue={tutorial?.id ?? ''}
              onChange={(e) => {
                const id = e.target.value;
                const t = id ? getTutorialById(id) : null;
                if (t) { location.href = \`/draft?t=\${t.id}\`; }
              }}
              style={{ width: '100%', padding: 8, background:'#0b0c0f', color:'white', border:'1px solid #1f2330', borderRadius:8 }}
            >
              <option value="">Pick a tutorial</option>
              {TUTORIALS.map(t => <option key={t.id} value={t.id}>{t.title}</option>)}
            </select>
            {showTutorial && tutorial ? (
              <TutorialPanel tutorial={tutorial} />
            ) : (
              <p style={{color:'#a1a1aa'}}>Select a tutorial to see steps here.</p>
            )}
          </div>
        </div>
      </div>

      <NewBlockModal open={showNewBlock} onClose={()=>setShowNewBlock(false)} />
      <PointLADialog open={showPointLA} onClose={()=>setShowPointLA(false)} />
    </main>
  );
}
