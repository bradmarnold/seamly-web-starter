'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useDraftStore } from '@/lib/store';

export type ToolMode =
  | 'pan' | 'move' | 'measure'
  | 'lineBetween'
  | 'pointLA' | 'pointOnLine' | 'perpFoot' | 'fromLineAngle' | 'midpoint' | 'divideSegment'
  | 'splinePath' | 'editPath';

type Props = {
  mode: ToolMode;
  zoomSignal?: { version:number; dir: number };
  onRequestEdit?: (id:number)=>void;
  onPointLARequest?: (payload:{ baseId:number; len:number; ang:number }) => void;
};

type XY = {x:number;y:number};

export function DraftingCanvas({ mode, zoomSignal, onRequestEdit, onPointLARequest }: Props) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const store = useDraftStore();
  const { points, segs, lines } = store;

  const [viewBox, setViewBox] = useState({ x: -100, y: -100, w: 1000, h: 700 });
  const [dragId, setDragId] = useState<number | null>(null);
  const dragStartRef = useRef<XY | null>(null);
  const vbStartRef   = useRef<{x:number;y:number;w:number;h:number} | null>(null);
  const [pickA, setPickA]     = useState<number | null>(null);      // generic A
  const [pickB, setPickB]     = useState<number | null>(null);      // generic B
  const [baseLA, setBaseLA]   = useState<number | null>(null);      // for pointLA
  const [flaA, setFlaA]       = useState<number | null>(null);      // for fromLineAngle: A,B after base
  const [splineAnchors, setSplineAnchors] = useState<number[]>([]);
  const [editPathId, setEditPathId] = useState<number | null>(null);

  const [cursor, setCursor]   = useState<XY>({x:0,y:0});
  const [snap, setSnap]       = useState<(XY & { tag?:string; id?:number }) | null>(null);
  const [measureA, setMeasureA] = useState<XY | null>(null);
  const [measureB, setMeasureB] = useState<XY | null>(null);
  const [shiftDown, setShiftDown] = useState(false);
  const [hint, setHint]       = useState<string>('');
  const [tempPan, setTempPan] = useState(false);

  // snapping options
  const [snapPoints, setSnapPoints] = useState(true);
  const [snapMids,   setSnapMids]   = useState(true);
  const [snapInters, setSnapInters] = useState(true);

  useEffect(() => {
    const m = effectiveMode();
    if (m==='pointLA') setHint('Point: Length & Angle — click a base point');
    else if (m==='pointOnLine') setHint(pickA==null ? 'Point: Along Line — click A' : (pickB==null ? 'Click B (line AB)' : 'Move cursor (project onto AB), click to place'));
    else if (m==='perpFoot') setHint(pickA==null ? 'Perpendicular Foot — click point P' : (pickB==null ? 'Click A (line point 1)' : 'Move cursor to choose B, click to place foot'));
    else if (m==='fromLineAngle') setHint(baseLA==null ? 'From Line & Angle — click base point' : (flaA==null ? 'Click A (reference line)' : 'Click B (reference line) then move + click to place (opens editor)'));
    else if (m==='midpoint') setHint(pickA==null ? 'Midpoint — click A' : 'Click B (preview shows midpoint), click to place');
    else if (m==='divideSegment') setHint(pickA==null ? 'Divide Segment (k/n=1/2) — click A' : 'Click B (preview), click to place');
    else if (m==='lineBetween') setHint(pickA==null ? 'Line: Between Points — click first point' : 'Click next point (Esc to finish)');
    else if (m==='measure') setHint(measureA ? 'Click B (Shift=45°)' : 'Measure — click A');
    else if (m==='splinePath') setHint(splineAnchors.length ? 'Spline: click next anchor (Enter to finish, Esc cancel)' : 'Spline: click first anchor point');
    else if (m==='editPath') setHint(editPathId==null ? 'Edit Path: click a path to select (double-click to insert anchor)' : 'Drag anchor points (Move tool), double-click path to insert');
    else setHint('');
  }, [mode, pickA, pickB, baseLA, flaA, measureA, splineAnchors.length, editPathId]);

  const toolLabel = (m:ToolMode) =>
    m==='pan' ? 'View: Pan' :
    m==='move' ? 'Edit: Move Point' :
    m==='lineBetween' ? 'Line: Between Points' :
    m==='measure' ? 'Tools: Measure' :
    m==='pointOnLine' ? 'Point: Along Line' :
    m==='perpFoot' ? 'Point: Perpendicular Foot' :
    m==='fromLineAngle' ? 'Point: From Line & Angle' :
    m==='midpoint' ? 'Point: Midpoint' :
    m==='divideSegment' ? 'Point: Divide Segment' :
    m==='splinePath' ? 'Curve: Spline Path' :
    m==='editPath' ? 'Edit: Path Anchors' :
    'Point: Length & Angle';

  const effectiveMode = () => (tempPan ? 'pan' : mode);

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
  const angleDeg = (a:XY, b:XY) => { const ang = Math.atan2(b.y-a.y, b.x-a.x) * 180/Math.PI; return (ang<0?ang+360:ang); };
  const snapAngle45 = (A:XY, B:XY) => {
    const r = dist(A,B); if (r===0) return B;
    const ang = angleDeg(A,B);
    const snapped = Math.round(ang/45)*45;
    const rad = snapped*Math.PI/180;
    return { x: A.x + r*Math.cos(rad), y: A.y + r*Math.sin(rad) };
  };

  // projected point of P onto line AB
  const projectToLine = (A:XY,B:XY,P:XY) => {
    const vx=B.x-A.x, vy=B.y-A.y, L2=vx*vx+vy*vy||1e-9;
    const t=((P.x-A.x)*vx+(P.y-A.y)*vy)/L2;
    return { x:A.x+t*vx, y:A.y+t*vy, t };
  };

  // segments (as lines) for snapping assistance
  const segLines = useMemo(()=> {
    const L: {a:XY; b:XY}[] = [];
    for (const s of segs) if (s.kind==='line') {
      const a = points.find(p=>p.id===s.a)!; const b = points.find(p=>p.id===s.b)!;
      L.push({a:{x:a.x,y:a.y}, b:{x:b.x,y:b.y}});
    }
    for (const ln of lines) {
      const a = points.find(p=>p.id===ln.a)!; const b = points.find(p=>p.id===ln.b)!;
      L.push({a:{x:a.x,y:a.y}, b:{x:b.x,y:b.y}});
    }
    return L;
  }, [segs, lines, points]);

  const midpoints = useMemo(()=> segLines.map(({a,b},i)=>({ x:(a.x+b.x)/2, y:(a.y+b.y)/2, tag:'MID' as const, key:`m${i}` })), [segLines]);

  function lineLineIntersection(a1:XY, a2:XY, b1:XY, b2:XY): XY | null {
    const dxa = a2.x - a1.x, dya = a2.y - a1.y;
    const dxb = b2.x - b1.x, dyb = b2.y - b1.y;
    const denom = dxa*dyb - dya*dxb;
    if (Math.abs(denom) < 1e-9) return null;
    const t = ((b1.x - a1.x)*dyb - (b1.y - a1.y)*dxb) / denom;
    const u = ((b1.x - a1.x)*dya - (b1.y - a1.y)*dxa) / denom;
    if (t < 0 || t > 1 || u < 0 || u > 1) return null;
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

  // === hit testing / snapping ===
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
    // points (strong)
    const id = findClosestPointPx(p, 28);
    if (snapPoints && id !== -1) { const sp = points.find(q=>q.id===id)!; return { x: sp.x, y: sp.y, tag:'PT' as const, id }; }
    // midpoints
    if (snapMids) {
      let best: {x:number;y:number;tag:'MID'} | null = null, bestD2 = Infinity;
      for (const m of midpoints) {
        const d2 = (m.x-p.x)**2 + (m.y-p.y)**2;
        if (d2 < bestD2) { bestD2 = d2; best = {x:m.x,y:m.y,tag:'MID'}; }
      }
      if (best && Math.sqrt(bestD2) <= threshW) return best;
    }
    // intersections
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

  if (zoomSignal) {
    const { version, dir } = zoomSignal;
    const last = (svgRef.current as any)?._lastZoomVersion ?? 0;
    if (version !== last) {
      (svgRef.current as any)._lastZoomVersion = version;
      const factor = dir === 1 ? 0.9 : 1.1;
      setViewBox(v => ({ x: v.x + v.w*(1-factor)/2, y: v.y + v.h*(1-factor)/2, w: v.w*factor, h: v.h*factor }));
    }
  }

  // --- Pointer events ---
  const onPointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    svgRef.current?.focus?.();
    const p = toCanvas(e.clientX, e.clientY);
    const s = applyCompositeSnap(p);
    setShiftDown(!!e.shiftKey);
    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);

    const m = effectiveMode();

    if (m === 'move') {
      const hit = findClosestPointPx(p, 28);
      if (hit !== -1) setDragId(hit);
      return;
    }
    if (m === 'pan') {
      dragStartRef.current = p; vbStartRef.current = { ...viewBox };
      return;
    }
    if (m === 'lineBetween') {
      const hit = findClosestPointPx(p, 28);
      if (hit !== -1) {
        if (pickA == null) { setPickA(hit); }
        else if (pickA !== hit) { store.addLineBetween(pickA, hit); setPickA(hit); }
      } else if (pickA != null) { setPickA(null); }
      return;
    }
    if (m === 'measure') {
      if (!measureA) setMeasureA(s ?? p);
      else if (!measureB) setMeasureB(s ?? p);
      else { setMeasureA(s ?? p); setMeasureB(null); }
      return;
    }
    if (m === 'pointLA') {
      const hit = findClosestPointPx(p, 28);
      if (baseLA == null) {
        if (hit !== -1) setBaseLA(hit);
      } else {
        const A = points.find(pt=>pt.id===baseLA)!;
        const B = s ?? p;
        onPointLARequest?.({ baseId: baseLA, len: dist(A,B), ang: angleDeg(A,B) });
        setBaseLA(null);
      }
      return;
    }
    if (m === 'pointOnLine') {
      const hit = findClosestPointPx(p, 28);
      if (pickA==null) { if (hit !== -1) setPickA(hit); return; }
      if (pickB==null) { if (hit !== -1) setPickB(hit); return; }
      // A and B chosen; place projected point at current cursor
      const A = points.find(pt=>pt.id===pickA)!;
      const Bpt = points.find(pt=>pt.id===pickB)!;
      const proj = projectToLine(A, Bpt, s ?? p);
      store.addPointOnLine(pickA, pickB, 'P', dist(A, {x:proj.x,y:proj.y}));
      setPickA(null); setPickB(null);
      return;
    }
    if (m === 'perpFoot') {
      // pickA = P, pickB = A, then choose B with cursor (preview), click to commit
      const hit = findClosestPointPx(p, 28);
      if (pickA==null) { if (hit !== -1) setPickA(hit); return; }
      if (pickB==null) { if (hit !== -1) setPickB(hit); return; }
      const Ppt = points.find(pt=>pt.id===pickA)!;
      const Apt = points.find(pt=>pt.id===pickB)!;
      const Bcand = s?.id ? points.find(pt=>pt.id===s.id)! : null;
      const Bpt = Bcand ?? { x:(s?.x ?? p.x), y:(s?.y ?? p.y) };
      const proj = projectToLine(Apt, Bpt as XY, Ppt);
      store.addPoint('F', proj.x, proj.y);
      setPickA(null); setPickB(null);
      return;
    }
    if (m === 'fromLineAngle') {
      const hit = findClosestPointPx(p, 28);
      if (baseLA==null) { if (hit !== -1) setBaseLA(hit); return; }
      if (flaA==null)   { if (hit !== -1) setFlaA(hit); return; }
      if (pickB==null)  { if (hit !== -1) setPickB(hit); return; }
      // now click anywhere to open the dialog with prefilled length/angle
      const O = points.find(pt=>pt.id===baseLA)!;
      const A = points.find(pt=>pt.id===flaA)!;
      const B = points.find(pt=>pt.id===pickB)!;
      const raw = s ?? p;
      const L = dist(O, raw);
      const angAB = angleDeg(A,B);
      const angOR = angleDeg(O, raw);
      const off = angOR - angAB;
      onPointLARequest?.({ baseId: baseLA, len: L, ang: (angAB+off) }); // we pass absolute; dialog will compute offset
      setBaseLA(null); setFlaA(null); setPickB(null);
      return;
    }
    if (m === 'midpoint') {
      const hit = findClosestPointPx(p, 28);
      if (pickA==null) { if (hit !== -1) setPickA(hit); return; }
      if (pickB==null) { if (hit !== -1) setPickB(hit); return; }
      const A = points.find(pt=>pt.id===pickA)!;
      const B = points.find(pt=>pt.id===pickB)!;
      store.addMidpoint(pickA, pickB, 'M');
      setPickA(null); setPickB(null);
      return;
    }
    if (m === 'divideSegment') {
      const hit = findClosestPointPx(p, 28);
      if (pickA==null) { if (hit !== -1) setPickA(hit); return; }
      if (pickB==null) { if (hit !== -1) setPickB(hit); return; }
      // default k/n = 1/2 (we can add inline editor later)
      store.addDivideSegment(pickA, pickB, 1, 2, 'D');
      setPickA(null); setPickB(null);
      return;
    }
    if (m === 'splinePath') {
      const hit = findClosestPointPx(p, 28);
      if (hit !== -1) setSplineAnchors(prev => [...prev, hit]);
      return;
    }
    if (m === 'editPath') {
      // click selects nearest path
      const id = pickNearestPathId(s ?? p);
      setEditPathId(id);
      return;
    }
  };

  const onDoubleClick = (e: React.MouseEvent<SVGSVGElement>) => {
    const p = toCanvas(e.clientX, e.clientY);
    if (!['editPath','move'].includes(effectiveMode())) return;
    const pathInfo = nearestPathAndSegment(p);
    if (!pathInfo) return;
    const { pathId, segIndex, closest } = pathInfo;
    const pid = store.addPoint('P', closest.x, closest.y);
    store.insertPathAnchor(pathId, segIndex+1, pid);
    setEditPathId(pathId);
  };

  const onPointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const p = toCanvas(e.clientX, e.clientY);
    setCursor(p);
    const s = applyCompositeSnap(p);
    setSnap(s);
    setShiftDown(!!e.shiftKey);

    const m = effectiveMode();
    if (m === 'move' && dragId !== null) {
      store.updatePoint(dragId, (snapPoints && s?.id) ? {x:s.x,y:s.y} : p);
    } else if (m === 'pan' && dragStartRef.current && vbStartRef.current) {
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
    if (e.code === 'Space' && !tempPan) { setTempPan(true); e.preventDefault(); }
    if (e.key === 'Escape') {
      setDragId(null); setPickA(null); setPickB(null); setMeasureA(null); setMeasureB(null);
      setBaseLA(null); setFlaA(null);
      setSplineAnchors([]);
    }
    if (e.key === '+') setViewBox(v => ({ x: v.x + v.w*(1-0.9)/2, y: v.y + v.h*(1-0.9)/2, w: v.w*0.9, h: v.h*0.9 }));
    if (e.key === '-') setViewBox(v => ({ x: v.x + v.w*(1-1.1)/2, y: v.y + v.h*(1-1.1)/2, w: v.w*1.1, h: v.h*1.1 }));
    if (e.key === '1') setSnapPoints(s=>!s);
    if (e.key === '2') setSnapMids(s=>!s);
    if (e.key === '3') setSnapInters(s=>!s);
    if (effectiveMode()==='splinePath' && e.key==='Enter' && splineAnchors.length>=2) {
      store.addSpline(splineAnchors, false, 0.5);
      setSplineAnchors([]);
      e.preventDefault();
    }
  };
  const onKeyUp = (e: React.KeyboardEvent) => { if (e.code==='Space') setTempPan(false); };

  // === path math: Catmull–Rom to cubic Bezier ===
  function catmullRomToBezierD(pts:XY[], closed=false, tension=0.5) {
    if (pts.length<2) return '';
    const p = pts;
    const cr = 0.5 * (1 - tension); // inverse tension
    const wrap = (i:number, n:number) => (closed ? (i+n)%n : Math.max(0, Math.min(n-1, i)));
    let d = `M ${p[0].x} ${p[0].y}`;
    for (let i=0;i<p.length-1;i++){
      const p0 = p[wrap(i-1,p.length)], p1 = p[i], p2 = p[i+1], p3 = p[wrap(i+2,p.length)];
      const c1x = p1.x + (p2.x - p0.x) * cr;
      const c1y = p1.y + (p2.y - p0.y) * cr;
      const c2x = p2.x - (p3.x - p1.x) * cr;
      const c2y = p2.y - (p3.y - p1.y) * cr;
      d += ` C ${c1x} ${c1y} ${c2x} ${c2y} ${p2.x} ${p2.y}`;
    }
    if (closed) d += ' Z';
    return d;
  }

  // === nearest path + segment for editing ===
  function nearestPathAndSegment(P:XY): { pathId:number; segIndex:number; closest:XY } | null {
    let best:{pathId:number; segIndex:number; closest:XY; d2:number}|null=null;
    for (const s of segs) if (s.kind==='path') {
      const ids = s.anchors as number[];
      const pts = ids.map(id=>points.find(p=>p.id===id)!).filter(Boolean);
      for (let i=0;i<pts.length-1;i++){
        const A=pts[i], B=pts[i+1];
        const pr = projectToLine(A,B,P);
        const Q = {x:pr.x, y:pr.y};
        const d2 = (Q.x-P.x)**2 + (Q.y-P.y)**2;
        if (!best || d2<best.d2) best = { pathId:s.id, segIndex:i, closest:Q, d2 };
      }
    }
    return best;
  }
  const pickNearestPathId = (P:XY) => {
    const res = nearestPathAndSegment(P);
    return res ? res.pathId : null;
  };

  // --- derived previews ---
  const pvLineBetween = (() => {
    if (!(effectiveMode()==='lineBetween' && pickA!=null)) return null;
    const A = points.find(p=>p.id===pickA)!; const Braw = snap ?? cursor; const B = shiftDown ? snapAngle45(A,Braw) : Braw;
    return { A, B, d: dist(A,B), ang: angleDeg(A,B) };
  })();

  const pvPointOnLine = (() => {
    if (!(effectiveMode()==='pointOnLine' && pickA!=null && (pickB!=null || snap?.id))) return null;
    const A = points.find(p=>p.id===pickA)!;
    const Bid = pickB ?? snap?.id!;
    const B = points.find(p=>p.id===Bid)!;
    const pr = projectToLine(A,B,snap ?? cursor);
    return { A, B, P:{x:pr.x,y:pr.y}, t:pr.t, d: dist(A,{x:pr.x,y:pr.y}) };
  })();

  const pvPerpFoot = (() => {
    if (!(effectiveMode()==='perpFoot' && pickA!=null)) return null; // pickA=P
    const Ppt = points.find(p=>p.id===pickA)!;
    const A = pickB!=null ? points.find(p=>p.id===pickB)! : (snap?.id ? points.find(p=>p.id===snap!.id)! : null);
    const Bc = (snap?.id && pickB!=null) ? points.find(p=>p.id===snap!.id)! : null;
    const B = (pickB!=null && Bc) ? Bc : (snap ?? cursor);
    if (!A) return null;
    const pr = projectToLine(A, (B as any), Ppt);
    return { A, B: (B as any), F:{x:pr.x,y:pr.y} };
  })();

  const pvFromLineAngle = (() => {
    if (!(effectiveMode()==='fromLineAngle' && baseLA!=null && flaA!=null)) return null;
    const O = points.find(p=>p.id===baseLA)!;
    const A = points.find(p=>p.id===flaA)!;
    const B = pickB!=null ? points.find(p=>p.id===pickB)! : (snap?.id ? points.find(p=>p.id===snap!.id)! : null);
    if (!B) return null;
    const L = dist(O, snap ?? cursor);
    const angAB = angleDeg(A,B);
    const angOR = angleDeg(O, snap ?? cursor);
    const off = angOR - angAB;
    const rad = (angAB+off) * Math.PI/180;
    const P = { x: O.x + L*Math.cos(rad), y: O.y + L*Math.sin(rad) };
    return { O, A, B, P, len:L, ang:angAB+off, off };
  })();

  const pvMidpoint = (() => {
    if (!(effectiveMode()==='midpoint' && pickA!=null)) return null;
    const A = points.find(p=>p.id===pickA)!;
    const Bid = pickB ?? snap?.id!;
    if (!Bid) return null;
    const B = points.find(p=>p.id===Bid)!;
    const M = { x:(A.x+B.x)/2, y:(A.y+B.y)/2 };
    return { A,B,M };
  })();

  const pvDivide = (() => {
    if (!(effectiveMode()==='divideSegment' && pickA!=null)) return null;
    const A = points.find(p=>p.id===pickA)!;
    const Bid = pickB ?? snap?.id!;
    if (!Bid) return null;
    const B = points.find(p=>p.id===Bid)!;
    const t = 1/2; // default
    const D = { x: A.x + t*(B.x-A.x), y: A.y + t*(B.y-A.y) };
    return { A,B,D,t };
  })();

  // status numbers
  const cur = (snap ?? cursor);
  const pvStatus = pvLineBetween || (pvFromLineAngle && {d:pvFromLineAngle.len, ang:pvFromLineAngle.ang}) || null;

  // spline preview (anchors you’re collecting)
  const splinePreviewPath = useMemo(()=>{
    if (effectiveMode()!=='splinePath' || splineAnchors.length===0) return '';
    const pts = splineAnchors.map(id => points.find(p=>p.id===id)!).filter(Boolean);
    const ext = (snap?.id ? points.find(p=>p.id===snap!.id)! : null);
    const all = ext ? [...pts, ext] : pts;
    if (all.length<2) return '';
    return catmullRomToBezierD(all, false, 0.5);
  }, [mode, splineAnchors, points, snap?.id]);

  return (
    <svg
      ref={svgRef}
      tabIndex={0}
      onDoubleClick={onDoubleClick}
      onKeyDown={onKeyDown}
      onKeyUp={onKeyUp}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onWheel={onWheel}
      viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.w} ${viewBox.h}`}
      style={{ width: '100%', height: '100%', display: 'block', background:'#ffffff', cursor: (effectiveMode() === 'pan' ? 'grab' : 'crosshair'), touchAction:'none', pointerEvents:'all' }}
    >
      {/* Draw segments */}
      {segs.map((s) => {
        if (s.kind === 'line') {
          const a = points.find(p=>p.id===s.a)!; const b = points.find(p=>p.id===s.b)!;
          return <line key={`seg-${s.id}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#2563eb" strokeWidth={2} />;
        } else if (s.kind === 'arc') {
          // arcs placeholder
          return null;
        } else {
          const ids = (s as any).anchors as number[];
          const pts = ids.map(id => points.find(p=>p.id===id)!).filter(Boolean);
          if (pts.length<2) return null;
          const d = s.spline ? catmullRomToBezierD(pts, !!s.closed, s.tension ?? 0.5)
                             : pts.map((p,i)=> (i?`L ${p.x} ${p.y}`:`M ${p.x} ${p.y}`)).join(' ');
          return (
            <path
              key={`seg-${s.id}`}
              d={d}
              fill="none"
              stroke={editPathId===s.id ? '#16a34a' : '#059669'}
              strokeWidth={editPathId===s.id ? 2.4 : 2}
              onClick={(e)=>{ if (effectiveMode()==='editPath') { e.stopPropagation(); setEditPathId(s.id); } }}
            />
          );
        }
      })}

      {/* Legacy (helper) lines */}
      {lines.map((ln, i) => {
        const a = points.find(p=>p.id===ln.a)!; const b = points.find(p=>p.id===ln.b)!;
        return <line key={`legacy-${i}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#94a3b8" strokeWidth={1} opacity={0.5} />;
      })}

      {/* Points */}
      {points.map((p) => (
        <g key={p.id} onContextMenu={(e)=>{ e.preventDefault(); onRequestEdit?.(p.id); }}>
          <circle cx={p.x} cy={p.y} r={5} fill="#111827" />
          <text className="point-label" x={p.x+7} y={p.y-7}>{p.name}</text>
        </g>
      ))}

      {/* Mid/Int hints */}
      {snapMids && midpoints.map(m => (<g key={m.key} opacity={0.25}><circle cx={m.x} cy={m.y} r={3} fill="#0ea5e9" /></g>))}
      {snapInters && intersections.map(q => (<g key={q.key} opacity={0.25}><rect x={q.x-2.5} y={q.y-2.5} width={5} height={5} fill="#ef4444" /></g>))}

      {/* Active snap indicator */}
      {snap ? (<g><circle cx={snap.x} cy={snap.y} r={9} fill="none" stroke="#0ea5e9" strokeWidth={1.5}/><circle cx={snap.x} cy={snap.y} r={3.2} fill="#0ea5e9"/></g>) : null}

      {/* Rubber-band previews */}
      {pvLineBetween && (
        <g>
          <line x1={pvLineBetween.A.x} y1={pvLineBetween.A.y} x2={pvLineBetween.B.x} y2={pvLineBetween.B.y} stroke="#60a5fa" strokeDasharray="6 4" strokeWidth={1.6}/>
        </g>
      )}

      {pvPointOnLine && (
        <g>
          <line x1={pvPointOnLine.A.x} y1={pvPointOnLine.A.y} x2={pvPointOnLine.B.x} y2={pvPointOnLine.B.y} stroke="#94a3b8" strokeWidth={1} opacity={0.6}/>
          <circle cx={pvPointOnLine.P.x} cy={pvPointOnLine.P.y} r={3.2} fill="#0ea5e9"/>
        </g>
      )}

      {pvPerpFoot && (
        <g>
          <line x1={pvPerpFoot.A.x} y1={pvPerpFoot.A.y} x2={(pvPerpFoot.B as any).x} y2={(pvPerpFoot.B as any).y} stroke="#94a3b8" strokeWidth={1} opacity={0.6}/>
          <circle cx={pvPerpFoot.F.x} cy={pvPerpFoot.F.y} r={3.2} fill="#0ea5e9"/>
        </g>
      )}

      {pvFromLineAngle && (
        <g>
          <line x1={pvFromLineAngle.A.x} y1={pvFromLineAngle.A.y} x2={pvFromLineAngle.B.x} y2={pvFromLineAngle.B.y} stroke="#94a3b8" strokeWidth={1} opacity={0.6}/>
          <line x1={pvFromLineAngle.O.x} y1={pvFromLineAngle.O.y} x2={pvFromLineAngle.P.x} y2={pvFromLineAngle.P.y} stroke="#10b981" strokeDasharray="6 4" strokeWidth={1.6}/>
          <circle cx={pvFromLineAngle.P.x} cy={pvFromLineAngle.P.y} r={3.2} fill="#10b981"/>
        </g>
      )}

      {pvMidpoint && (
        <g>
          <line x1={pvMidpoint.A.x} y1={pvMidpoint.A.y} x2={pvMidpoint.B.x} y2={pvMidpoint.B.y} stroke="#94a3b8" strokeWidth={1} opacity={0.6}/>
          <circle cx={pvMidpoint.M.x} cy={pvMidpoint.M.y} r={3.2} fill="#0ea5e9"/>
        </g>
      )}

      {pvDivide && (
        <g>
          <line x1={pvDivide.A.x} y1={pvDivide.A.y} x2={pvDivide.B.x} y2={pvDivide.B.y} stroke="#94a3b8" strokeWidth={1} opacity={0.6}/>
          <circle cx={pvDivide.D.x} cy={pvDivide.D.y} r={3.2} fill="#0ea5e9"/>
        </g>
      )}

      {/* Spline preview */}
      {(effectiveMode()==='splinePath' && splinePreviewPath) ? (
        <path d={splinePreviewPath} fill="none" stroke="#059669" strokeDasharray="6 4" strokeWidth={1.6}/>
      ) : null}

      {/* Snap options pill */}
      <g>
        <rect x={viewBox.x+10} y={viewBox.y+44} width="380" height="28" rx="6" ry="6" fill="#ffffff" stroke="#cbd5e1"/>
        <foreignObject x={viewBox.x+16} y={viewBox.y+46} width="368" height="24">
          <div xmlns="http://www.w3.org/1999/xhtml"
               style={{fontFamily:'system-ui, -apple-system, Segoe UI, Roboto, sans-serif',fontSize:'12px', color:'#334155', display:'flex', gap:'10px', alignItems:'center'}}>
            <label style={{display:'flex', gap:'4px', alignItems:'center'}}><input type="checkbox" checked readOnly /><span>Points</span></label>
            <label style={{display:'flex', gap:'4px', alignItems:'center'}}><input type="checkbox" checked={snapMids} onChange={()=>setSnapMids(v=>!v)} /><span>Midpoints</span></label>
            <label style={{display:'flex', gap:'4px', alignItems:'center'}}><input type="checkbox" checked={snapInters} onChange={()=>setSnapInters(v=>!v)} /><span>Intersections</span></label>
            <span style={{marginLeft:'auto', opacity:.6}}>1 Pts, 2 Mid, 3 Int, Space Pan</span>
          </div>
        </foreignObject>
      </g>

      {/* Hint */}
      {hint && (
        <g>
          <rect x={viewBox.x+10} y={viewBox.y+10} width="620" height="26" rx="6" ry="6" fill="#ffffff" stroke="#cbd5e1"/>
          <text x={viewBox.x+24} y={viewBox.y+28} fill="#334155" fontSize="12">{toolLabel(effectiveMode() as ToolMode)} — {hint}</text>
        </g>
      )}

      {/* Status bar */}
      <g>
        <rect x={viewBox.x+10} y={viewBox.y+viewBox.h-34} width="740" height="24" rx="6" ry="6" fill="#ffffff" stroke="#cbd5e1"/>
        <text x={viewBox.x+24} y={viewBox.y+viewBox.h-18} fill="#334155" fontSize="12">
          X {cur.x.toFixed(2)}  Y {cur.y.toFixed(2)}
          {pvStatus ? ` · Len ${pvStatus.d.toFixed(2)}  Ang ${pvStatus.ang.toFixed(1)}°` : ''}
          {shiftDown ? ' · SNAP' : ''}
          {tempPan ? ' · (Space: Pan)' : ''}
        </text>
      </g>
    </svg>
  );
}
