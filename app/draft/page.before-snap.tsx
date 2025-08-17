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
import ArcCSEDialog from '@/components/ArcCSEDialog';
import IntersectionDialog from '@/components/IntersectionDialog';
import MeasurementsPanel from '@/components/MeasurementsPanel';
import PointEditDialog from '@/components/PointEditDialog';

// Phase D dialogs
import ParallelThroughDialog from '@/components/ParallelThroughDialog';
import PerpThroughDialog from '@/components/PerpThroughDialog';
import FromLineAngleDialog from '@/components/FromLineAngleDialog';
import MidpointDialog from '@/components/MidpointDialog';
import DivideSegmentDialog from '@/components/DivideSegmentDialog';
import LineArcIntersectDialog from '@/components/LineArcIntersectDialog';
import ArcArcIntersectDialog from '@/components/ArcArcIntersectDialog';
import SplineDialog from '@/components/SplineDialog';

export default function DraftPage() {
  const sp = useSearchParams();
  const tutorialId = sp.get('t') ?? undefined;
  const tutorial = useMemo(() => (tutorialId ? getTutorialById(tutorialId) : null), [tutorialId]);
  const [showTutorial, setShowTutorial] = useState(Boolean(tutorial));
  const reset = useDraftStore(s => s.reset);

  const [mode, setMode] = useState<ToolMode>('pan');
  const [zoomVersion, setZoomVersion] = useState(0);
  const [zoomDir, setZoomDir] = useState(1);
  const [showNewBlock, setShowNewBlock] = useState(false);
  const [showPointLA, setShowPointLA] = useState(false);
  const [showPOL, setShowPOL] = useState(false);
  const [showPerp, setShowPerp] = useState(false);
  const [showArcCSE, setShowArcCSE] = useState(false);
  const [showIntersect, setShowIntersect] = useState(false);
  const [editId, setEditId] = useState<number|null>(null);
  const currentBlockId = useDraftStore(s=>s.currentBlockId);

  // Phase D modal state
  const [showPar, setShowPar] = useState(false);
  const [showPerpThrough, setShowPerpThrough] = useState(false);
  const [showFLA, setShowFLA] = useState(false);
  const [showMid, setShowMid] = useState(false);
  const [showDiv, setShowDiv] = useState(false);
  const [showLxA, setShowLxA] = useState(false);
  const [showAxA, setShowAxA] = useState(false);
  const [showSpline, setShowSpline] = useState(false);

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
    const lns = (state.lines as {a:number;b:number}[]) || [];
    const segs = (state.segs as any[]) || [];
    const minX = Math.min(...pts.map(p=>p.x), 0);
    const minY = Math.min(...pts.map(p=>p.y), 0);
    const maxX = Math.max(...pts.map(p=>p.x), 1000);
    const maxY = Math.max(...pts.map(p=>p.y), 700);
    const w = maxX - minX + 100, h = maxY - minY + 100;
    const toX = (x:number)=> (x-minX+50);
    const toY = (y:number)=> (y-minY+50);

    const segSVG = segs.map((s:any)=>{
      if (s.kind==='line') {
        const a = pts.find(p=>p.id===s.a)!; const b = pts.find(p=>p.id===s.b)!;
        return `<line x1="${toX(a.x)}" y1="${toY(a.y)}" x2="${toX(b.x)}" y2="${toY(b.y)}" stroke="black" stroke-width="1"/>`;
      } else if (s.kind==='arc') {
        const c = pts.find(p=>p.id===s.center)!;
        const a = pts.find(p=>p.id===s.start)!;
        const b = pts.find(p=>p.id===s.end)!;
        const r = Math.hypot(a.x-c.x, a.y-c.y) || 0.0001;
        const a1 = Math.atan2(a.y-c.y, a.x-c.x);
        const a2 = Math.atan2(b.y-c.y, b.x-c.x);
        let delta = a2 - a1; if (s.ccw) { if (delta < 0) delta += Math.PI*2; } else { if (delta > 0) delta -= Math.PI*2; }
        const large = Math.abs(delta) > Math.PI ? 1 : 0;
        const sweep = s.ccw ? 1 : 0;
        return `<path d="M ${toX(a.x)} ${toY(a.y)} A ${r} ${r} 0 ${large} ${sweep} ${toX(b.x)} ${toY(b.y)}" fill="none" stroke="black" stroke-width="1"/>`;
      } else {
        // rough export for spline: sample to polyline
        const ids = s.anchors as number[];
        const p = (id:number)=> pts.find(pp=>pp.id===id)!;
        const S = ids.map(p).map(q=>`${toX(q.x)},${toY(q.y)}`).join(' ');
        return `<polyline points="${S}" fill="none" stroke="black" stroke-width="1"/>`;
      }
    }).join('');

    const legacy = lns.map((ln)=>{
      const a = pts.find(p=>p.id===ln.a)!; const b = pts.find(p=>p.id===ln.b)!;
      return `<line x1="${toX(a.x)}" y1="${toY(a.y)}" x2="${toX(b.x)}" y2="${toY(b.y)}" stroke="#999" stroke-width="0.5"/>`;
    }).join('');

    const points = pts.map(p=>`<circle cx="${toX(p.x)}" cy="${toY(p.y)}" r="2" fill="black"/><text x="${toX(p.x)+6}" y="${toY(p.y)-6}" font-size="10" fill="#555">${p.name}</text>`).join('');

    const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" style="background:white">${segSVG}${legacy}${points}</svg>`;
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
            <button onClick={() => setShowIntersect(true)} disabled={!currentBlockId}>L × L</button>

            <span className="badge">Lines & Angles</span>
            <button onClick={()=>setShowPar(true)} disabled={!currentBlockId}>Parallel ⟂</button>
            <button onClick={()=>setShowPerpThrough(true)} disabled={!currentBlockId}>Perp ⟂</button>
            <button onClick={()=>setShowFLA(true)} disabled={!currentBlockId}>From line + angle</button>
            <button onClick={()=>setShowMid(true)} disabled={!currentBlockId}>Midpoint</button>
            <button onClick={()=>setShowDiv(true)} disabled={!currentBlockId}>Divide segment</button>

            <span className="badge">Curves</span>
            <button onClick={() => setShowArcCSE(true)} disabled={!currentBlockId}>Arc C–S–E</button>
            <button onClick={()=>setShowLxA(true)} disabled={!currentBlockId}>L × Arc</button>
            <button onClick={()=>setShowAxA(true)} disabled={!currentBlockId}>Arc × Arc</button>
            <button onClick={()=>setShowSpline(true)} disabled={!currentBlockId}>Spline path</button>

            <span className="badge">Edit</span>
            <button onClick={() => setMode('lineBetween')} disabled={!currentBlockId}>Line</button>
            <button onClick={() => setMode('move')} disabled={!currentBlockId}>Move</button>
            <button onClick={() => setMode('pan')}>Pan</button>

            <span className="badge">View</span>
            <button onClick={() => zoom(1)}>Zoom in</button>
            <button onClick={() => zoom(-1)}>Zoom out</button>

            <span className="badge">File</span>
            <button onClick={saveJSON}>Save</button>
            <button onClick={() => fileRef.current?.click()}>Load</button>
            <button onClick={exportSVG}>Export SVG</button>
            <input ref={fileRef} type="file" accept="application/json" style={{display:'none'}}
                   onChange={e=>{ const f=e.target.files?.[0]; if(f) loadFromFile(f); e.currentTarget.value=''; }} />
          </div>

          <DraftingCanvas
            mode={mode}
            zoomSignal={{version: zoomVersion, dir: zoomDir}}
            onRequestEdit={(id)=> setEditId(id)}
          />
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

      {/* existing */}
      <NewBlockModal open={showNewBlock} onClose={()=>setShowNewBlock(false)} />
      <PointLADialog open={showPointLA} onClose={()=>setShowPointLA(false)} />
      <PointOnLineDialog open={showPOL} onClose={()=>setShowPOL(false)} />
      <PerpFootDialog open={showPerp} onClose={()=>setShowPerp(false)} />
      <ArcCSEDialog open={showArcCSE} onClose={()=>setShowArcCSE(false)} />
      <IntersectionDialog open={showIntersect} onClose={()=>setShowIntersect(false)} />
      <PointEditDialog open={editId!==null} pointId={editId ?? undefined} onClose={()=>setEditId(null)} />

      {/* Phase D */}
      <ParallelThroughDialog open={showPar} onClose={()=>setShowPar(false)} />
      <PerpThroughDialog open={showPerpThrough} onClose={()=>setShowPerpThrough(false)} />
      <FromLineAngleDialog open={showFLA} onClose={()=>setShowFLA(false)} />
      <MidpointDialog open={showMid} onClose={()=>setShowMid(false)} />
      <DivideSegmentDialog open={showDiv} onClose={()=>setShowDiv(false)} />
      <LineArcIntersectDialog open={showLxA} onClose={()=>setShowLxA(false)} />
      <ArcArcIntersectDialog open={showAxA} onClose={()=>setShowAxA(false)} />
      <SplineDialog open={showSpline} onClose={()=>setShowSpline(false)} />
    </main>
  );
}
