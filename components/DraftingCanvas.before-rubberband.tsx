'use client';
import { useEffect, useRef, useState } from 'react';
import { useDraftStore } from '@/lib/store';

export type ToolMode = 'pan'|'move'|'lineBetween'|'measure';

type Props = {
  mode: ToolMode;
  zoomSignal?: { version:number; dir: number };
  onRequestEdit?: (id:number)=>void;
};

export function DraftingCanvas({ mode, zoomSignal, onRequestEdit }: Props) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const { points, lines, segs, updatePoint, addLineBetween } = useDraftStore(s => s);

  const [viewBox, setViewBox] = useState({ x: -100, y: -100, w: 1000, h: 700 });
  const [dragId, setDragId] = useState<number | null>(null);
  const dragStartRef = useRef<{x:number;y:number} | null>(null);
  const vbStartRef = useRef<{x:number;y:number;w:number;h:number} | null>(null);
  const [pickA, setPickA] = useState<number | null>(null);
  const lastZoomVersion = useRef(0);

  // snapping + measure
  const [cursor, setCursor] = useState<{x:number;y:number}>({x:0,y:0});
  const [snap, setSnap] = useState<{x:number;y:number; id?:number} | null>(null);
  const [measureA, setMeasureA] = useState<{x:number;y:number; id?:number} | null>(null);
  const [measureB, setMeasureB] = useState<{x:number;y:number; id?:number} | null>(null);

  const toCanvas = (e: React.MouseEvent<SVGSVGElement> | React.MouseEvent) => {
    const svg = svgRef.current!;
    const pt = svg.createSVGPoint();
    // @ts-ignore
    pt.x = e.clientX; pt.y = e.clientY;
    const ctm = svg.getScreenCTM();
    if (!ctm) return { x: 0, y: 0 };
    const inv = ctm.inverse();
    const p = pt.matrixTransform(inv);
    return { x: p.x, y: p.y };
  };

  /** Convert a pixel radius to world units based on current SVG size/viewBox */
  const pxToWorld = (px:number) => {
    const svg = svgRef.current;
    if (!svg) return px; // fallback
    const rect = svg.getBoundingClientRect();
    const ux = viewBox.w / Math.max(1, rect.width);
    // use average (close enough) for isotropic feel
    const uy = viewBox.h / Math.max(1, rect.height);
    return px * (ux+uy)/2;
  };

  /** Find nearest point in world units within a pixel threshold */
  const findClosestPointPx = (p:{x:number;y:number}, pixelThresh=12) => {
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
    const id = findClosestPointPx(p, 12);
    if (id !== -1) {
      const sp = points.find(q=>q.id===id)!;
      return { x: sp.x, y: sp.y, id };
    }
    return null;
  };

  if (zoomSignal && zoomSignal.version !== lastZoomVersion.current) {
    lastZoomVersion.current = zoomSignal.version;
    const factor = zoomSignal.dir === 1 ? 0.9 : 1.1;
    setViewBox(v => ({ x: v.x + v.w*(1-factor)/2, y: v.y + v.h*(1-factor)/2, w: v.w*factor, h: v.h*factor }));
  }

  const onMouseDown = (e: React.MouseEvent<SVGSVGElement>) => {
    const p = toCanvas(e);
    const s = applySnap(p);
    const P = s ?? p;

    if (mode === 'move') {
      const hit = findClosestPointPx(p, 12);
      if (hit !== -1) setDragId(hit);
      return;
    }

    if (mode === 'pan') {
      dragStartRef.current = p;
      vbStartRef.current = { ...viewBox };
      return;
    }

    if (mode === 'lineBetween') {
      const hit = findClosestPointPx(p, 12);
      if (hit !== -1) {
        if (pickA == null) setPickA(hit);
        else if (pickA !== hit) {
          addLineBetween(pickA, hit);
          setPickA(null);
        }
      }
      return;
    }

    if (mode === 'measure') {
      if (!measureA) {
        setMeasureA(P);
        setMeasureB(null);
      } else if (!measureB) {
        setMeasureB(P);
      } else {
        // start a new measurement
        setMeasureA(P);
        setMeasureB(null);
      }
      return;
    }
  };

  const onMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const p = toCanvas(e);
    setCursor(p);
    const s = applySnap(p);
    setSnap(s);

    if (mode === 'move' && dragId !== null) {
      updatePoint(dragId, s ?? p);
    } else if (mode === 'pan' && dragStartRef.current && vbStartRef.current) {
      const dx = p.x - dragStartRef.current.x;
      const dy = p.y - dragStartRef.current.y;
      const vb0 = vbStartRef.current;
      setViewBox({ x: vb0.x - dx, y: vb0.y - dy, w: vb0.w, h: vb0.h });
    }
  };

  const onMouseUp = () => {
    setDragId(null);
    dragStartRef.current = null;
    vbStartRef.current = null;
  };

  const onWheel: React.WheelEventHandler<SVGSVGElement> = (e) => {
    const factor = e.deltaY < 0 ? 0.9 : 1.1;
    setViewBox(v => ({ x: v.x + v.w*(1-factor)/2, y: v.y + v.h*(1-factor)/2, w: v.w*factor, h: v.h*factor }));
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { setDragId(null); setPickA(null); setMeasureA(null); setMeasureB(null); }
    if (e.key === '+') setViewBox(v => ({ x: v.x + v.w*(1-0.9)/2, y: v.y + v.h*(1-0.9)/2, w: v.w*0.9, h: v.h*0.9 }));
    if (e.key === '-') setViewBox(v => ({ x: v.x + v.w*(1-1.1)/2, y: v.y + v.h*(1-1.1)/2, w: v.w*1.1, h: v.h*1.1 }));
  };

  // measurement helpers
  const dist = (a:{x:number;y:number}, b:{x:number;y:number}) => Math.hypot(b.x-a.x, b.y-a.y);
  const angleDeg = (a:{x:number;y:number}, b:{x:number;y:number}) => {
    const ang = Math.atan2(b.y-a.y, b.x-a.x) * 180/Math.PI;
    return (ang<0?ang+360:ang);
  };

  // render
  return (
    <svg
      ref={svgRef}
      tabIndex={0}
      onKeyDown={onKeyDown}
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onWheel={onWheel}
      viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.w} ${viewBox.h}`}
      style={{ width: '100%', height: '100%', display: 'block', background:'#0c1018', cursor: mode === 'pan' ? 'grab' : 'crosshair' }}
    >
      {/* Segments */}
      {segs.map((s) => {
        if (s.kind === 'line') {
          const a = points.find(p=>p.id===s.a)!; const b = points.find(p=>p.id===s.b)!;
          return <line key={`seg-${s.id}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#9aa6ff" strokeWidth={2} />;
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
          return <path key={`seg-${s.id}`} d={d} fill="none" stroke="#ffb86b" strokeWidth={2}/>;
        } else {
          // spline path: draw through anchors as polyline for now (keeps it simple until handle editing)
          const ids = s.anchors as number[];
          const pts = ids.map(id => points.find(p=>p.id===id)!).filter(Boolean);
          const d = pts.map((p,i)=> (i?`L ${p.x} ${p.y}`:`M ${p.x} ${p.y}`)).join(' ');
          return <path key={`seg-${s.id}`} d={d} fill="none" stroke="#6ee7b7" strokeWidth={2}/>;
        }
      })}

      {/* Legacy lines */}
      {lines.map((ln, i) => {
        const a = points.find(p=>p.id===ln.a)!; const b = points.find(p=>p.id===ln.b)!;
        return <line key={`legacy-${i}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#6372ff" strokeWidth={1} opacity={0.5} />;
      })}

      {/* Points */}
      {points.map((p) => (
        <g key={p.id} onContextMenu={(e)=>{ e.preventDefault(); onRequestEdit?.(p.id); }}>
          <circle cx={p.x} cy={p.y} r={3} fill="#e8e8ea" />
          <text className="point-label" x={p.x+6} y={p.y-6}>{p.name}</text>
        </g>
      ))}

      {/* Snap indicator */}
      {snap ? (
        <g>
          <circle cx={snap.x} cy={snap.y} r={6} fill="none" stroke="#22d3ee" strokeWidth={1.5}/>
          <circle cx={snap.x} cy={snap.y} r={2.5} fill="#22d3ee"/>
        </g>
      ) : null}

      {/* Measure overlay */}
      {(mode==='measure' && (measureA || snap)) ? (() => {
        const A = measureA ?? snap ?? cursor;
        const B = measureB ?? (snap ?? cursor);
        const d = dist(A,B);
        const ang = angleDeg(A,B);
        return (
          <g>
            <line x1={A.x} y1={A.y} x2={B.x} y2={B.y} stroke="#fcd34d" strokeDasharray="4 4" strokeWidth={1.5}/>
            <circle cx={A.x} cy={A.y} r={3} fill="#fcd34d"/>
            <circle cx={B.x} cy={B.y} r={3} fill="#fcd34d"/>
            <text x={B.x+8} y={B.y-8} fill="#fcd34d" fontSize="12" paintOrder="stroke" stroke="#0c1018" strokeWidth="2">
              {d.toFixed(2)} · {ang.toFixed(1)}°
            </text>
          </g>
        );
      })() : null}
    </svg>
  );
}
