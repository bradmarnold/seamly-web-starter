'use client';
import { useEffect, useRef, useState } from 'react';
import { useDraftStore } from '@/lib/store';

export type ToolMode = 'pan'|'move'|'lineBetween'|'measure'|'pointLA';

type Props = {
  mode: ToolMode;
  zoomSignal?: { version:number; dir: number };
  onRequestEdit?: (id:number)=>void;
  onPointLARequest?: (payload:{ baseId:number; len:number; ang:number }) => void;
};

export function DraftingCanvas({ mode, zoomSignal, onRequestEdit, onPointLARequest }: Props) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const { points, lines, segs, updatePoint, addLineBetween } = useDraftStore(s => s);

  const [viewBox, setViewBox] = useState({ x: -100, y: -100, w: 1000, h: 700 });
  const [dragId, setDragId] = useState<number | null>(null);
  const dragStartRef = useRef<{x:number;y:number} | null>(null);
  const vbStartRef = useRef<{x:number;y:number;w:number;h:number} | null>(null);
  const [pickA, setPickA] = useState<number | null>(null);
  const [baseLA, setBaseLA] = useState<number | null>(null);
  const lastZoomVersion = useRef(0);

  const [cursor, setCursor] = useState<{x:number;y:number}>({x:0,y:0});
  const [snap, setSnap] = useState<{x:number;y:number; id?:number} | null>(null);
  const [measureA, setMeasureA] = useState<{x:number;y:number; id?:number} | null>(null);
  const [measureB, setMeasureB] = useState<{x:number;y:number; id?:number} | null>(null);
  const [shiftDown, setShiftDown] = useState(false);
  const [hint, setHint] = useState<string>('');

  useEffect(() => {
    if (mode === 'pointLA') setHint('Point: Length & Angle — click a base point to start');
    else if (mode === 'lineBetween') setHint('Line: Between Points — click first point');
    else if (mode === 'measure') setHint('Measure — click A then B (Shift = 45° snap)');
    else setHint('');
  }, [mode]);

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

  // bigger, easier hit radius (28 px)
  const findClosestPointPx = (p:{x:number;y:number}, pixelThresh=28) => {
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

  const applySnap = (p:{x:number;y:number}) => {
    const id = findClosestPointPx(p, 28);
    if (id !== -1) { const sp = points.find(q=>q.id===id)!; return { x: sp.x, y: sp.y, id }; }
    return null;
  };

  const dist = (a:{x:number;y:number}, b:{x:number;y:number}) => Math.hypot(b.x-a.x, b.y-a.y);
  const angleDeg = (a:{x:number;y:number}, b:{x:number;y:number}) => {
    const ang = Math.atan2(b.y-a.y, b.x-a.x) * 180/Math.PI;
    return (ang<0?ang+360:ang);
  };
  const snapAngle45 = (A:{x:number;y:number}, B:{x:number;y:number}) => {
    const r = dist(A,B); if (r===0) return B;
    const ang = angleDeg(A,B);
    const snapped = Math.round(ang/45)*45;
    const rad = snapped*Math.PI/180;
    return { x: A.x + r*Math.cos(rad), y: A.y + r*Math.sin(rad) };
  };

  if (zoomSignal && zoomSignal.version !== lastZoomVersion.current) {
    lastZoomVersion.current = zoomSignal.version;
    const factor = zoomSignal.dir === 1 ? 0.9 : 1.1;
    setViewBox(v => ({ x: v.x + v.w*(1-factor)/2, y: v.y + v.h*(1-factor)/2, w: v.w*factor, h: v.h*factor }));
  }

  // --- Pointer events (mouse + touch) ---
  const onPointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    const p = toCanvas(e.clientX, e.clientY);
    const s = applySnap(p);
    const P = s ?? p;
    setShiftDown(!!e.shiftKey);

    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);

    if (mode === 'move') {
      const hit = findClosestPointPx(p, 28);
      if (hit !== -1) setDragId(hit);
      return;
    }

    if (mode === 'pan') {
      dragStartRef.current = p; vbStartRef.current = { ...viewBox };
      return;
    }

    if (mode === 'lineBetween') {
      const hit = findClosestPointPx(p, 28);
      if (hit !== -1) {
        if (pickA == null) { setPickA(hit); setHint('Click second point'); }
        else if (pickA !== hit) { addLineBetween(pickA, hit); setPickA(null); setHint('Line placed'); }
      } else if (pickA != null) { setPickA(null); setHint('Cancelled'); }
      return;
    }

    if (mode === 'measure') {
      if (!measureA) { setMeasureA(P); setMeasureB(null); setHint('Click B'); }
      else if (!measureB) { setMeasureB(P); setHint('Measurement complete'); }
      else { setMeasureA(P); setMeasureB(null); setHint('Click B'); }
      return;
    }

    if (mode === 'pointLA') {
      const hit = findClosestPointPx(p, 28);
      if (baseLA == null) {
        if (hit !== -1) { setBaseLA(hit); setHint('Move cursor, then click to confirm length/angle'); }
        else { setHint('No point under cursor — zoom or tap closer to a point'); }
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
    const s = applySnap(p);
    setSnap(s);
    setShiftDown(!!e.shiftKey);

    if (mode === 'move' && dragId !== null) {
      updatePoint(dragId, s ?? p);
    } else if (mode === 'pan' && dragStartRef.current && vbStartRef.current) {
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
    if (e.key === 'Escape') { setDragId(null); setPickA(null); setMeasureA(null); setMeasureB(null); setBaseLA(null); setHint(''); }
    if (e.key === '+') setViewBox(v => ({ x: v.x + v.w*(1-0.9)/2, y: v.y + v.h*(1-0.9)/2, w: v.w*0.9, h: v.h*0.9 }));
    if (e.key === '-') setViewBox(v => ({ x: v.x + v.w*(1-1.1)/2, y: v.y + v.h*(1-1.1)/2, w: v.w*1.1, h: v.h*1.1 }));
  };

  const previewFromA = (A:{x:number;y:number}) => {
    const rawB = snap ?? cursor;
    return shiftDown ? snapAngle45(A, rawB) : rawB;
  };

  return (
    <svg
      ref={svgRef}
      tabIndex={0}
      onKeyDown={onKeyDown}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onWheel={onWheel}
      viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.w} ${viewBox.h}`}
      style={{ width: '100%', height: '100%', display: 'block', background:'#ffffff', cursor: mode === 'pan' ? 'grab' : 'crosshair', touchAction:'none', pointerEvents:'all' }}
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

      {/* Snap indicator */}
      {snap ? (
        <g>
          <circle cx={snap.x} cy={snap.y} r={8} fill="none" stroke="#0ea5e9" strokeWidth={1.5}/>
          <circle cx={snap.x} cy={snap.y} r={3} fill="#0ea5e9"/>
        </g>
      ) : null}

      {/* Rubber-band preview for Line between */}
      {(mode==='lineBetween' && pickA!=null) ? (() => {
        const A = points.find(p=>p.id===pickA)!;
        const B = previewFromA(A);
        const d = dist(A,B), ang = angleDeg(A,B);
        return (
          <g>
            <line x1={A.x} y1={A.y} x2={B.x} y2={B.y} stroke="#60a5fa" strokeDasharray="6 4" strokeWidth={1.8}/>
            <circle cx={A.x} cy={A.y} r={3.2} fill="#60a5fa"/>
            <text x={B.x+8} y={B.y-8} fill="#334155" fontSize="12" paintOrder="stroke" stroke="#ffffff" strokeWidth="2">
              {d.toFixed(2)} · {ang.toFixed(1)}°{shiftDown?' (snap)':''}
            </text>
          </g>
        );
      })() : null}

      {/* Rubber-band preview for Point: Length & Angle */}
      {(mode==='pointLA' && baseLA!=null) ? (() => {
        const A = points.find(p=>p.id===baseLA)!;
        const B = previewFromA(A);
        const d = dist(A,B), ang = angleDeg(A,B);
        return (
          <g>
            <line x1={A.x} y1={A.y} x2={B.x} y2={B.y} stroke="#10b981" strokeDasharray="6 4" strokeWidth={1.8}/>
            <circle cx={A.x} cy={A.y} r={3.2} fill="#10b981"/>
            <text x={B.x+8} y={B.y-8} fill="#334155" fontSize="12" paintOrder="stroke" stroke="#ffffff" strokeWidth="2">
              {d.toFixed(2)} · {ang.toFixed(1)}°{shiftDown?' (snap)':''}
            </text>
          </g>
        );
      })() : null}

      {/* Measure overlay */}
      {(mode==='measure' && (measureA || snap)) ? (() => {
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
              {d.toFixed(2)} · {ang.toFixed(1)}°{shiftDown?' (snap)':''}
            </text>
          </g>
        );
      })() : null}

      {/* Hint overlay */}
      {hint && (
        <g>
          <rect x={viewBox.x+10} y={viewBox.y+10} width="520" height="26" rx="6" ry="6" fill="#ffffff" stroke="#cbd5e1"/>
          <text x={viewBox.x+24} y={viewBox.y+28} fill="#334155" fontSize="12">{hint}</text>
        </g>
      )}
    </svg>
  );
}
