'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { TUTORIALS, getTutorialById } from '@/lib/tutorials';
import { useDraftStore } from '@/lib/store';
import { DraftingCanvas, type ToolMode } from '@/components/DraftingCanvas';
import { TutorialPanel } from '@/components/TutorialPanel';
import NewBlockModal from '@/components/NewBlockModal';
import PointLADialog from '@/components/PointLADialog';
import PointOnLineDialog from '@/components/PointOnLineDialog';
import PerpFootDialog from '@/components/PerpFootDialog';
import MeasurementsPanel from '@/components/MeasurementsPanel';

export default function DraftPage() {
  const sp = useSearchParams();
  const tutorialId = sp.get('t') ?? undefined;
  const tutorial = useMemo(() => (tutorialId ? getTutorialById(tutorialId) : null), [tutorialId]);
  const [showTutorial, setShowTutorial] = useState(Boolean(tutorial));
  const reset = useDraftStore(s => s.reset);

  const [mode, setMode] = useState<ToolMode>('pan');
  const [zoomVersion, setZoomVersion] = useState(0);
  const [zoomDir, setZoomDir] = useState(1); // 1=in, -1=out
  const [showNewBlock, setShowNewBlock] = useState(false);
  const [showPointLA, setShowPointLA] = useState(false);
  const [showPOL, setShowPOL] = useState(false);
  const [showPerp, setShowPerp] = useState(false);
  const currentBlockId = useDraftStore(s=>s.currentBlockId);

  const dumpJSON = useDraftStore(s=>s.dumpJSON);
  const loadJSON = useDraftStore(s=>s.loadJSON);
  const fileRef = useRef<HTMLInputElement|null>(null);

  useEffect(() => { reset(); }, [reset]);

  const zoom = (dir: number) => { setZoomDir(dir); setZoomVersion(v => v + 1); };

  const saveJSON = () => {
    const data = dumpJSON();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'pattern.json'; a.click();
    URL.revokeObjectURL(url);
  };

  const loadFromFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      try { const obj = JSON.parse(String(reader.result)); loadJSON(obj); }
      catch (e) { alert('Invalid JSON'); }
    };
    reader.readAsText(file);
  };

  const exportSVG = () => {
    const state = dumpJSON();
    const pts = state.points as {id:number;name:string;x:number;y:number}[];
    const lns = state.lines as {a:number;b:number}[];
    const minX = Math.min(...pts.map(p=>p.x), 0);
    const minY = Math.min(...pts.map(p=>p.y), 0);
    const maxX = Math.max(...pts.map(p=>p.x), 1000);
    const maxY = Math.max(...pts.map(p=>p.y), 700);
    const w = maxX - minX + 100, h = maxY - minY + 100;
    const to = (x:number,y:number)=>`${x-minX+50},${y-minY+50}`;
    const lines = lns.map(ln=>{
      const a = pts.find(p=>p.id===ln.a)!; const b = pts.find(p=>p.id===ln.b)!;
      return `<line x1="${a.x-minX+50}" y1="${a.y-minY+50}" x2="${b.x-minX+50}" y2="${b.y-minY+50}" stroke="black" stroke-width="1"/>`;
    }).join('');
    const points = pts.map(p=>`<circle cx="${p.x-minX+50}" cy="${p.y-minY+50}" r="2" fill="black"/><text x="${p.x-minX+56}" y="${p.y-minY+46}" font-size="10" fill="#555">${p.name}</text>`).join('');
    const svg = `<?xml version="1.0" encoding="UTF-8"?><svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" style="background:white">${lines}${points}</svg>`;
    const blob = new Blob([svg], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'pattern.svg'; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <main className="container">
      <div className="grid">
        <div className="canvasWrap" style={{position:'relative'}}>
          <div className="toolbar" style={{zIndex:5}} onClick={(e)=>e.stopPropagation()}>
            <button onClick={() => setShowNewBlock(true)}>New block</button>
            <span className="badge">{currentBlockId ? 'Block active' : 'No block'}</span>
            <button onClick={() => setShowTutorial(s => !s)}>{showTutorial ? 'Hide tutorial' : 'Show tutorial'}</button>

            <span className="badge">Construct</span>
            <button onClick={() => setShowPointLA(true)} disabled={!currentBlockId}>Point L∠</button>
            <button onClick={() => setShowPOL(true)} disabled={!currentBlockId}>Point on line</button>
            <button onClick={() => setShowPerp(true)} disabled={!currentBlockId}>Perpendicular foot</button>

            <span className="badge">Edit</span>
            <button onClick={() => setMode('move')} disabled={!currentBlockId}>Move</button>
            <button onClick={() => setMode('pan')}>Pan</button>

            <span className="badge">View</span>
            <button onClick={() => { setMode('lineBetween'); }}>Line tool</button>
            <button onClick={() => zoom(1)}>Zoom in</button>
            <button onClick={() => zoom(-1)}>Zoom out</button>

            <span className="badge">File</span>
            <button onClick={saveJSON}>Save</button>
            <button onClick={() => fileRef.current?.click()}>Load</button>
            <button onClick={exportSVG}>Export SVG</button>
            <input ref={fileRef} type="file" accept="application/json" style={{display:'none'}}
                   onChange={e=>{ const f=e.target.files?.[0]; if(f) loadFromFile(f); e.currentTarget.value=''; }} />
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
                if (t) { location.href = `/draft?t=${t.id}`; }
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
            <MeasurementsPanel />
          </div>
        </div>
      </div>

      <NewBlockModal open={showNewBlock} onClose={()=>setShowNewBlock(false)} />
      <PointLADialog open={showPointLA} onClose={()=>setShowPointLA(false)} />
      <PointOnLineDialog open={showPOL} onClose={()=>setShowPOL(false)} />
      <PerpFootDialog open={showPerp} onClose={()=>setShowPerp(false)} />
    </main>
  );
}
