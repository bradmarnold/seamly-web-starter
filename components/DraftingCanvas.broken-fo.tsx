'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useDraftStore } from '@/lib/store';

export type ToolMode = 'pan'|'move'|'lineBetween'|'measure'|'pointLA';

type Props = {
  mode: ToolMode;
  zoomSignal?: { version:number; dir: number };
  onRequestEdit?: (id:number)=>void;
  onPointLARequest?: (payload:{ baseId:number; len:number; ang:number }) => void;
};

type XY = {x:number;y:number};

export function DraftingCanvas({ mode, zoomSignal, onRequestEdit, onPointLARequest }: Props) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const { points, lines, segs, updatePoint, addLineBetween } = useDraftStore(s => s);

  const [viewBox, setViewBox] = useState({ x: -100, y: -100, w: 1000, h: 700 });
  const [dragId, setDragId] = useState<number | null>(null);
  const dragStartRef = useRef<XY | null>(null);
  const vbStartRef   = useRef<{x:number;y:number;w:number;h:number} | null>(null);
  const [pickA, setPickA]     = useState<number | null>(null);
  const [baseLA, setBaseLA]   = useState<number | null>(null);
  const lastZoomVersion = useRef(0);

  const [cursor, setCursor]   = useState<XY>({x:0,y:0});
  const [snap, setSnap]       = useState<(XY & { tag?:string }) | null>(null);
  const [measureA, setMeasureA] = useState<XY | null>(null);
  const [measureB, setMeasureB] = useState<XY | null>(null);
  const [shiftDown, setShiftDown] = useState(false);
  const [hint, setHint]       = useState<string>('');
  const [tempPan, setTempPan] = useState(false); // Space-to-pan

  // snap options
  const [snapPoints, setSnapPoints] = useState(true);
  const [snapMids,   setSnapMids]   = useState(true);
  const [snapInters, setSnapInters] = useState(true);

  useEffect(() => {
    if (mode === 'pointLA') setHint('Point: Length & Angle — click a base point to start');
    else if (mode === 'lineBetween') setHint('Line: Between Points — click first point');
    else if (mode === 'measure') setHint('Measure — click A then B (Shift = 45° snap)');
    else setHint('');
  }, [mode]);

  const toolLabel = (m:ToolMode) =>
    m==='pan' ? 'View: Pan' :
    m==='move' ? 'Edit: Move Point' :
    m==='lineBetween' ? 'Line: Between Points' :
    m==='measure' ? 'Tools: Measure' :
    'Point: Length & Angle';

  const effectiveMode = tempPan ? 'pan' : mode;

  const toCanvas = (clientX:number, clientY:number) => {
    const svg = svgRef.current!;
    const pt = svg.createSVGPoint();
    pt.x = clientX; pt.y = clientY;
    const ctm = svg.getScreenCTM();
    if (!ctm) return { x: 0, y: 0 };
    const inv = ctm.inverse();
    const p = pt.matrixTransform(inv);
    return { x: p.x, y: p.y };
  };

  const pxToWorld = (px:number) => {
    const svg = svgRef.current; if (!svg) return px;
    const rect = svg.getBoundingClientRect();
    const ux = viewBox.w / Math.max(1, rect.width);
    const uy = viewBox.h / Math.max(1, rect.height);
    return px * (ux+uy)/2;
  };

  // === helpers ===
  const dist = (a:XY, b:XY) => Math.hypot(b.x-a.x, b.y-a.y);
  const angleDeg = (a:XY, b:XY) => {
    const ang = Math.atan2(b.y-a.y, b.x-a.x) * 180/Math.PI;
    return (ang<0?ang+360:ang);
  };
  const snapAngle45 = (A:XY, B:XY) => {
    const r = dist(A,B); if (r===0) return B;
    const ang = angleDeg(A,B);
    const snapped = Math.round(ang/45)*45;
    const rad = snapped*Math.PI/180;
    return { x: A.x + r*Math.cos(rad), y: A.y + r*Math.sin(rad) };
  };
  const segLines = useMemo(()=> {
    // gather all concrete line segments we draw
    const L: {a:XY; b:XY}[] = [];
    for (const s of segs) {
      if (s.kind==='line') {
        const a = points.find(p=>p.id===s.a)!; const b = points.find(p=>p.id===s.b)!;
        L.push({a:{x:a.x,y:a.y}, b:{x:b.x,y:b.y}});
      }
    }
    // include "legacy" helper lines as faint targets too
    for (const ln of lines) {
      const a = points.find(p=>p.id===ln.a)!; const b = points.find(p=>p.id===ln.b)!;
      L.push({a:{x:a.x,y:a.y}, b:{x:b.x,y:b.y}});
    }
    return L;
  }, [segs, lines, points]);

  const midpoints = useMemo(()=> {
    return segLines.map(({a,b},i)=>({ x:(a.x+b.x)/2, y:(a.y+b.y)/2, tag:`MID` as const, key:`m${i}` }));
  }, [segLines]);

  // 2D line segment intersection
  function lineLineIntersection(a1:XY, a2:XY, b1:XY, b2:XY): XY | null {
    const dxa = a2.x - a1.x, dya = a2.y - a1.y;
    const dxb = b2.x - b1.x, dyb = b2.y - b1.y;
    const denom = dxa*dyb - dya*dxb;
    if (Math.abs(denom) < 1e-9) return null; // parallel
    const t = ((b1.x - a1.x)*dyb - (b1.y - a1.y)*dxb) / denom;
    const u = ((b1.x - a1.x)*dya - (b1.y - a1.y)*dxa) / denom;
    if (t < 0 || t > 1 || u < 0 || u > 1) return null; // not within segments
    return { x: a1.x + t*dxa, y: a1.y + t*dya };
  }

  const intersections = useMemo(()=> {
    const out: (XY & {tag:'INT'; key:string})[] = [];
    for (let i=0;i<segLines.length;i++){
      for (let j=i+1;j<segLines.length;j++){
        const p = lineLineIntersection(segLines[i].a, segLines[i].b, segLines[j].a, segLines[j].b);
        if (p) out.push({...p, tag:'INT', key:`i${i}_${j}`});
      }
    }
    return out;
  }, [segLines]);

  // === hit testing ===
  const findClosestPointPx = (p:XY, pixelThresh=28) => {
    const threshW = pxToWorld(pixelThresh);
    let bestId = -1, bestD2 = Infinity;
    for (const pt of points) {
      const dx = pt.x - p.x, dy = pt.y - p.y;
      const d2 = dx*dx + dy*dy;
      if (d2 < bestD2) { bestD2 = d2; bestId = pt.id; }
    }
    if (Math.sqrt(bestD2) <= threshW) return bestId;
    return -1;
  };

  const applyCompositeSnap = (p:XY) => {
    const threshW = pxToWorld(18);

    // priority: points → midpoints → intersections
    if (snapPoints) {
      const id = findClosestPointPx(p, 28);
      if (id !== -1) { const sp = points.find(q=>q.id===id)!; return { x: sp.x, y: sp.y, tag:'PT' as const }; }
    }
    if (snapMids) {
      let best: {x:number;y:number;tag:'MID'} | null = null, bestD2 = Infinity;
      for (const m of midpoints) {
        const d2 = (m.x-p.x)**2 + (m.y-p.y)**2;
        if (d2 < bestD2) { bestD2 = d2; best = {x:m.x,y:m.y,tag:'MID'}; }
      }
      if (best && Math.sqrt(bestD2) <= threshW) return best;
    }
    if (snapInters) {
      let best: {x:number;y:number;tag:'INT'} | null = null, bestD2 = Infinity;
      for (const q of intersections) {
        const d2 = (q.x-p.x)**2 + (q.y-p.y)**2;
        if (d2 < bestD2) { bestD2 = d2; best = {x:q.x,y:q.y,tag:'INT'}; }
      }
      if (best && Math.sqrt(bestD2) <= threshW) return best;
    }
    return null;
  };

  if (zoomSignal && zoomSignal.version !== lastZoomVersion.current) {
    lastZoomVersion.current = zoomSignal.version;
    const factor = zoomSignal.dir === 1 ? 0.9 : 1.1;
    setViewBox(v => ({ x: v.x + v.w*(1-factor)/2, y: v.y + v.h*(1-factor)/2, w: v.w*factor, h: v.h*factor }));
  }

  // --- Pointer events (mouse + touch) ---
  const onPointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    svgRef.current?.focus?.();
    const p = toCanvas(e.clientX, e.clientY);
    const s = applyCompositeSnap(p);
    const P = s ?? p;
    setShiftDown(!!e.shiftKey);
    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);

    if (effectiveMode === 'move') {
      const hit = findClosestPointPx(p, 28);
      if (hit !== -1) setDragId(hit);
      return;
    }

    if (effectiveMode === 'pan') {
      dragStartRef.current = p; vbStartRef.current = { ...viewBox };
      return;
    }

    if (effectiveMode === 'lineBetween') {
      // requires existing points; midpoint/intersection snaps are for preview only.
      const hit = findClosestPointPx(p, 28);
      if (hit !== -1) {
        if (pickA == null) { setPickA(hit); setHint('Click second point'); }
        else if (pickA !== hit) {
          addLineBetween(pickA, hit);
          // chained line: continue from the second point
          setPickA(hit);
          setHint('Click next point (Esc to finish)');
        }
      } else if (pickA != null) { setPickA(null); setHint('Cancelled'); }
      return;
    }

    if (effectiveMode === 'measure') {
      if (!measureA) { setMeasureA(P); setMeasureB(null); setHint('Click B'); }
      else if (!measureB) { setMeasureB(P); setHint('Measurement complete'); }
      else { setMeasureA(P); setMeasureB(null); setHint('Click B'); }
      return;
    }

    if (effectiveMode === 'pointLA') {
      const hit = findClosestPointPx(p, 28);
      if (baseLA == null) {
        if (hit !== -1) { setBaseLA(hit); setHint('Move cursor, then click to confirm length/angle'); }
        else { setHint('No point under cursor — zoom or click closer'); }
      } else {
        const A = points.find(pt=>pt.id===baseLA)!;
        const rawB = s ?? p;
        const B = shiftDown ? snapAngle45(A, rawB) : rawB;
        onPointLARequest?.({ baseId: baseLA, len: dist(A,B), ang: angleDeg(A,B) });
        setBaseLA(null);
        setHint('Length & Angle dialog opened');
      }
      return;
    }
  };

  const onPointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const p = toCanvas(e.clientX, e.clientY);
    setCursor(p);
    const s = applyCompositeSnap(p);
    setSnap(s);
    setShiftDown(!!e.shiftKey);

    if (effectiveMode === 'move' && dragId !== null) {
      updatePoint(dragId, (snapPoints && s?.tag==='PT') ? {x:s.x,y:s.y} : p);
    } else if (effectiveMode === 'pan' && dragStartRef.current && vbStartRef.current) {
      const dx = p.x - dragStartRef.current.x; const dy = p.y - dragStartRef.current.y;
      const vb0 = vbStartRef.current; setViewBox({ x: vb0.x - dx, y: vb0.y - dy, w: vb0.w, h: vb0.h });
    }
  };

  const onPointerUp = (e: React.PointerEvent<SVGSVGElement>) => {
    setDragId(null); dragStartRef.current = null; vbStartRef.current = null;
    (e.currentTarget as Element).releasePointerCapture?.(e.pointerId);
  };

  const onWheel: React.WheelEventHandler<SVGSVGElement> = (e) => {
    const factor = e.deltaY < 0 ? 0.9 : 1.1;
    setViewBox(v => ({ x: v.x + v.w*(1-factor)/2, y: v.y + v.h*(1-factor)/2, w: v.w*factor, h: v.h*factor }));
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.code === 'Space' && !tempPan) { setTempPan(true); setHint('Temporary Pan'); e.preventDefault(); }
    if (e.key === 'Escape') { setDragId(null); setPickA(null); setMeasureA(null); setMeasureB(null); setBaseLA(null); setHint(''); }
    if (e.key === '+') setViewBox(v => ({ x: v.x + v.w*(1-0.9)/2, y: v.y + v.h*(1-0.9)/2, w: v.w*0.9, h: v.h*0.9 }));
    if (e.key === '-') setViewBox(v => ({ x: v.x + v.w*(1-1.1)/2, y: v.y + v.h*(1-1.1)/2, w: v.w*1.1, h: v.h*1.1 }));
    // quick toggles
    if (e.key === '1') setSnapPoints(s=>!s);
    if (e.key === '2') setSnapMids(s=>!s);
    if (e.key === '3') setSnapInters(s=>!s);
  };
  const onKeyUp = (e: React.KeyboardEvent) => {
    if (e.code === 'Space') { setTempPan(false); setHint(''); }
  };

  const previewFromA = (A:XY) => {
    const rawB = snap ?? cursor;
    return shiftDown ? snapAngle45(A, rawB) : rawB;
  };

  // --- derive live preview for status bar ---
  const statusPreview = () => {
    if (effectiveMode==='lineBetween' && pickA!=null) {
      const A = points.find(p=>p.id===pickA)!; const B = previewFromA(A);
      return { d: dist(A,B), ang: angleDeg(A,B) };
    }
    if (effectiveMode==='measure' && (measureA || snap)) {
      const A = measureA ?? (snap ?? cursor);
      const rawB = measureB ?? (snap ?? cursor);
      const B = shiftDown ? snapAngle45(A, rawB) : rawB;
      return { d: dist(A,B), ang: angleDeg(A,B) };
    }
    if (effectiveMode==='pointLA' && baseLA!=null) {
      const A = points.find(p=>p.id===baseLA)!; const B = previewFromA(A);
      return { d: dist(A,B), ang: angleDeg(A,B) };
    }
    return null;
  };

  const pv = statusPreview();
  const cur = (snap ?? cursor);

  return (
    <svg
      ref={svgRef}
      tabIndex={0}
      onKeyDown={onKeyDown}
      onKeyUp={onKeyUp}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onWheel={onWheel}
      viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.w} ${viewBox.h}`}
      style={{ width: '100%', height: '100%', display: 'block', background:'#ffffff', cursor: (effectiveMode === 'pan' ? 'grab' : 'crosshair'), touchAction:'none', pointerEvents:'all' }}
    >
      {/* Segments */}
      {segs.map((s) => {
        if (s.kind === 'line') {
          const a = points.find(p=>p.id===s.a)!; const b = points.find(p=>p.id===s.b)!;
          return <line key={`seg-${s.id}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#2563eb" strokeWidth={2} />;
        } else if (s.kind === 'arc') {
          const c = points.find(p=>p.id===s.center)!;
          const a = points.find(p=>p.id===s.start)!;
          const b = points.find(p=>p.id===s.end)!;
          const r = Math.hypot(a.x-c.x, a.y-c.y) || 0.0001;
          const a1 = Math.atan2(a.y-c.y, a.x-c.x);
          const a2 = Math.atan2(b.y-c.y, b.x-c.x);
          let delta = a2 - a1;
          if (s.ccw) { if (delta < 0) delta += Math.PI*2; }
          else { if (delta > 0) delta -= Math.PI*2; }
          const large = Math.abs(delta) > Math.PI ? 1 : 0;
          const sweep = s.ccw ? 1 : 0;
          const d = `M ${a.x} ${a.y} A ${r} ${r} 0 ${large} ${sweep} ${b.x} ${b.y}`;
          return <path key={`seg-${s.id}`} d={d} fill="none" stroke="#f59e0b" strokeWidth={2}/>;
        } else {
          const ids = s.anchors as number[];
          const pts = ids.map(id => points.find(p=>p.id===id)!).filter(Boolean);
          const d = pts.map((p,i)=> (i?`L ${p.x} ${p.y}`:`M ${p.x} ${p.y}`)).join(' ');
          return <path key={`seg-${s.id}`} d={d} fill="none" stroke="#059669" strokeWidth={2}/>;
        }
      })}

      {/* Legacy lines */}
      {lines.map((ln, i) => {
        const a = points.find(p=>p.id===ln.a)!; const b = points.find(p=>p.id===ln.b)!;
        return <line key={`legacy-${i}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#94a3b8" strokeWidth={1} opacity={0.6} />;
      })}

      {/* Points */}
      {points.map((p) => (
        <g key={p.id} onContextMenu={(e)=>{ e.preventDefault(); onRequestEdit?.(p.id); }}>
          <circle cx={p.x} cy={p.y} r={5} fill="#111827" />
          <text className="point-label" x={p.x+7} y={p.y-7}>{p.name}</text>
        </g>
      ))}

      {/* Midpoint snap visuals */}
      {snapMids && midpoints.map(m => (
        <g key={m.key} opacity={0.25}>
          <circle cx={m.x} cy={m.y} r={3} fill="#0ea5e9" />
        </g>
      ))}

      {/* Intersection snap visuals */}
      {snapInters && intersections.map(q => (
        <g key={q.key} opacity={0.25}>
          <rect x={q.x-2.5} y={q.y-2.5} width={5} height={5} fill="#ef4444" />
        </g>
      ))}

      {/* Active snap indicator */}
      {snap ? (
        <g>
          <circle cx={snap.x} cy={snap.y} r={9} fill="none" stroke="#0ea5e9" strokeWidth={1.5}/>
          <circle cx={snap.x} cy={snap.y} r={3.2} fill="#0ea5e9"/>
        </g>
      ) : null}

      {/* Rubber-band previews */}
      {(effectiveMode==='lineBetween' && pickA!=null) ? (() => {
        const A = points.find(p=>p.id===pickA)!; const B = previewFromA(A);
        const d = dist(A,B), ang = angleDeg(A,B);
        return (
          <g>
            <line x1={A.x} y1={A.y} x2={B.x} y2={B.y} stroke="#60a5fa" strokeDasharray="6 4" strokeWidth={1.8}/>
            <circle cx={A.x} cy={A.y} r={3.2} fill="#60a5fa"/>
            <text x={B.x+8} y={B.y-8} fill="#334155" fontSize="12" paintOrder="stroke" stroke="#ffffff" strokeWidth="2">
              {d.toFixed(2)} · {ang.toFixed(1)}°
            </text>
          </g>
        );
      })() : null}

      {(effectiveMode==='pointLA' && baseLA!=null) ? (() => {
        const A = points.find(p=>p.id===baseLA)!; const B = previewFromA(A);
        const d = dist(A,B), ang = angleDeg(A,B);
        return (
          <g>
            <line x1={A.x} y1={A.y} x2={B.x} y2={B.y} stroke="#10b981" strokeDasharray="6 4" strokeWidth={1.8}/>
            <circle cx={A.x} cy={A.y} r={3.2} fill="#10b981"/>
            <text x={B.x+8} y={B.y-8} fill="#334155" fontSize="12" paintOrder="stroke" stroke="#ffffff" strokeWidth="2">
              {d.toFixed(2)} · {ang.toFixed(1)}°
            </text>
          </g>
        );
      })() : null}

      {(effectiveMode==='measure' && (measureA || snap)) ? (() => {
        const A = measureA ?? (snap ?? cursor);
        const rawB = measureB ?? (snap ?? cursor);
        const B = shiftDown ? snapAngle45(A, rawB) : rawB;
        const d = dist(A,B); const ang = angleDeg(A,B);
        return (
          <g>
            <line x1={A.x} y1={A.y} x2={B.x} y2={B.y} stroke="#f59e0b" strokeDasharray="4 4" strokeWidth={1.5}/>
            <circle cx={A.x} cy={A.y} r={3} fill="#f59e0b"/>
            <circle cx={B.x} cy={B.y} r={3} fill="#f59e0b"/>
            <text x={B.x+8} y={B.y-8} fill="#334155" fontSize="12" paintOrder="stroke" stroke="#ffffff" strokeWidth="2">
              {d.toFixed(2)} · {ang.toFixed(1)}°
            </text>
          </g>
        );
      })() : null}

      {/* Snap options pill */}
      <g>
        <rect x={viewBox.x+10} y={viewBox.y+44} width="320" height="24" rx="6" ry="6" fill="#ffffff" stroke="#cbd5e1"/>
        <foreignObject x={viewBox.x+16} y={viewBox.y+46} width="308" height="20">
          <div xmlns="http://www.w3.org/1999/xhtml" style="font:12px system-ui, sans-serif; color:#334155; display:flex; gap:10px; align-items:center;">
            <label style="display:flex; gap:4px; align-items:center;">
              <input type="checkbox" ${/* points */''} checked="${true}" onclick="return false;" />
              Points
            </label>
            <label style="display:flex; gap:4px; align-items:center;">
              <input type="checkbox" ${snapMids?'checked':''} onchange="this.getRootNode().host.__mids?.()" />
              Midpoints
            </label>
            <label style="display:flex; gap:4px; align-items:center;">
              <input type="checkbox" ${snapInters?'checked':''} onchange="this.getRootNode().host.__ints?.()" />
              Intersections
            </label>
            <span style="margin-left:auto;opacity:.6">Keys: 1 Pts, 2 Mid, 3 Int, Space Pan</span>
          </div>
        </foreignObject>
      </g>

      {/* Hint */}
      {hint && (
        <g>
          <rect x={viewBox.x+10} y={viewBox.y+10} width="520" height="26" rx="6" ry="6" fill="#ffffff" stroke="#cbd5e1"/>
          <text x={viewBox.x+24} y={viewBox.y+28} fill="#334155" fontSize="12">{hint}</text>
        </g>
      )}

      {/* Status bar */}
      <g>
        <rect x={viewBox.x+10} y={viewBox.y+viewBox.h-34} width="680" height="24" rx="6" ry="6" fill="#ffffff" stroke="#cbd5e1"/>
        <text x={viewBox.x+24} y={viewBox.y+viewBox.h-18} fill="#334155" fontSize="12">
          {toolLabel(effectiveMode as ToolMode)} · X {cur.x.toFixed(2)}  Y {cur.y.toFixed(2)}
          {pv ? ` · Len ${pv.d.toFixed(2)}  Ang ${pv.ang.toFixed(1)}°` : ''}
          {shiftDown ? ' · SNAP' : ''}
          {tempPan ? ' · (Space: Pan)' : ''}
          {snap?.tag ? ` · ${snap.tag}` : ''}
        </text>
      </g>
    </svg>
  );
}
