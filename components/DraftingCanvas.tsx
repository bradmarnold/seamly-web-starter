'use client';
import { useRef, useState } from 'react';
import { useDraftStore } from '@/lib/store';

export function DraftingCanvas() {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const { points, addPoint, lines, addLine } = useDraftStore(s => s);
  const [lastPointIndex, setLastPointIndex] = useState<number | null>(null);
  const [viewBox, setViewBox] = useState({ x: -100, y: -100, w: 1000, h: 700 });

  const onClick = (e: React.MouseEvent<SVGSVGElement>) => {
    const svg = svgRef.current!;
    const pt = svg.createSVGPoint();
    pt.x = e.clientX; pt.y = e.clientY;
    const ctm = svg.getScreenCTM();
    if (!ctm) return;
    const inv = ctm.inverse();
    const p = pt.matrixTransform(inv);
    const idx = addPoint({ x: p.x, y: p.y });
    if (lastPointIndex !== null) addLine({ a: lastPointIndex, b: idx });
    setLastPointIndex(idx);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') setLastPointIndex(null);
  };

  const zoom = (factor: number) => {
    setViewBox(v => ({ x: v.x + v.w*(1-factor)/2, y: v.y + v.h*(1-factor)/2, w: v.w*factor, h: v.h*factor }));
  };

  return (
    <svg
      ref={svgRef}
      tabIndex={0}
      onKeyDown={onKeyDown}
      onClick={onClick}
      viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.w} ${viewBox.h}`}
      style={{ width: '100%', height: '100%', display: 'block', cursor:'crosshair' }}
    >
      <rect x={viewBox.x} y={viewBox.y} width={viewBox.w} height={viewBox.h} fill="#0c1018" />
      {Array.from({ length: 60 }).map((_, i) => (
        <line key={`v${i}`} x1={i*20} y1={-1000} x2={i*20} y2={2000} stroke="#141a28" strokeWidth={1}/>
      ))}
      {Array.from({ length: 60 }).map((_, i) => (
        <line key={`h${i}`} x1={-1000} y1={i*20} x2={2000} y2={i*20} stroke="#141a28" strokeWidth={1}/>
      ))}

      {lines.map((ln, i) => {
        const a = points[ln.a]; const b = points[ln.b];
        return <line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#9aa6ff" strokeWidth={2} />;
      })}

      {points.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r={3} fill="#e8e8ea" />
      ))}

      <foreignObject x={viewBox.x+8} y={viewBox.y+8} width="160" height="40">
        <div className="toolbar">
          <button onClick={() => zoom(0.9)}>Zoom in</button>
          <button onClick={() => zoom(1.1)}>Zoom out</button>
        </div>
      </foreignObject>
    </svg>
  );
}
