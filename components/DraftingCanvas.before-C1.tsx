'use client';
import { useRef, useState } from 'react';
import { useDraftStore } from '@/lib/store';

export type ToolMode = 'pan'|'move'|'lineBetween';

type Props = {
  mode: ToolMode;
  zoomSignal?: { version:number; dir: number };
  onRequestEdit?: (id:number)=>void;  // NEW
};

export function DraftingCanvas({ mode, zoomSignal, onRequestEdit }: Props) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const { points, lines, updatePoint, addLineBetween } = useDraftStore(s => s);

  const [viewBox, setViewBox] = useState({ x: -100, y: -100, w: 1000, h: 700 });
  const [dragId, setDragId] = useState<number | null>(null);
  const dragStartRef = useRef<{x:number;y:number} | null>(null);
  const vbStartRef = useRef<{x:number;y:number;w:number;h:number} | null>(null);
  const [pickA, setPickA] = useState<number | null>(null);
  const lastZoomVersion = useRef(0);

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

  const findClosestPoint = (p:{x:number;y:number}, thresh=10) => {
    let best = -1, bestD = Infinity;
    for (let i=0;i<points.length;i++) {
      const dx = points[i].x - p.x;
      const dy = points[i].y - p.y;
      const d2 = dx*dx + dy*dy;
      if (d2 < bestD) { bestD = d2; best = i; }
    }
    return (Math.sqrt(bestD) <= thresh) ? points[best].id : -1;
  };

  if (zoomSignal && zoomSignal.version !== lastZoomVersion.current) {
    lastZoomVersion.current = zoomSignal.version;
    const factor = zoomSignal.dir === 1 ? 0.9 : 1.1;
    setViewBox(v => ({ x: v.x + v.w*(1-factor)/2, y: v.y + v.h*(1-factor)/2, w: v.w*factor, h: v.h*factor }));
  }

  const onMouseDown = (e: React.MouseEvent<SVGSVGElement>) => {
    const p = toCanvas(e);

    if (mode === 'move') {
      const hit = findClosestPoint(p, 12);
      if (hit !== -1) setDragId(hit);
      return;
    }

    if (mode === 'pan') {
      dragStartRef.current = p;
      vbStartRef.current = { ...viewBox };
      return;
    }

    if (mode === 'lineBetween') {
      const hit = findClosestPoint(p, 12);
      if (hit !== -1) {
        if (pickA == null) setPickA(hit);
        else if (pickA !== hit) {
          addLineBetween(pickA, hit);
          setPickA(null);
        }
      }
    }
  };

  const onMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const p = toCanvas(e);
    if (mode === 'move' && dragId !== null) {
      updatePoint(dragId, p);
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
    if (e.key === 'Escape') {
      setDragId(null);
      setPickA(null);
    }
    if (e.key === '+') setViewBox(v => ({ x: v.x + v.w*(1-0.9)/2, y: v.y + v.h*(1-0.9)/2, w: v.w*0.9, h: v.h*0.9 }));
    if (e.key === '-') setViewBox(v => ({ x: v.x + v.w*(1-1.1)/2, y: v.y + v.h*(1-1.1)/2, w: v.w*1.1, h: v.h*1.1 }));
  };

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
      {lines.map((ln, i) => {
        const a = points.find(p=>p.id===ln.a)!; const b = points.find(p=>p.id===ln.b)!;
        return <line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#9aa6ff" strokeWidth={2} />;
      })}
      {points.map((p) => (
        <g key={p.id}
           onContextMenu={(e)=>{ e.preventDefault(); onRequestEdit?.(p.id); }}>
          <circle cx={p.x} cy={p.y} r={3} fill="#e8e8ea" />
          <text className="point-label" x={p.x+6} y={p.y-6}>{p.name}</text>
          {mode === 'lineBetween' ? <circle cx={p.x} cy={p.y} r={8} fill="none" stroke="transparent" /> : null}
        </g>
      ))}
    </svg>
  );
}
