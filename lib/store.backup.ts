import { create } from 'zustand';
import { angleOf, arcContainsAngle, deg, dist, normDeg, rad, intersectLineCircle, intersectCircles } from '@/lib/geometry';

export type Units = 'centimeters'|'millimeters'|'inches';

/** Existing constraints */
export type ConstrLA  = { kind:'LA'; base:number; length:number; angle:number };
export type ConstrPOL = { kind:'POL'; a:number; b:number; dist:number };

/** Phase D constraints */
export type ConstrPAR  = { kind:'PAR'; through:number; refA:number; refB:number; length:number }; // parallel to AB
export type ConstrPERP = { kind:'PERP'; through:number; refA:number; refB:number; length:number }; // perp to AB
export type ConstrFLA  = { kind:'FLA'; base:number; refA:number; refB:number; length:number; offset:number }; // angle relative to AB
export type ConstrMID  = { kind:'MID'; a:number; b:number };
export type ConstrDIV  = { kind:'DIV'; a:number; b:number; t:number }; // 0..1
export type ConstrILArc= { kind:'INT_LA'; lineSegId:number; arcSegId:number; pick:0|1 };
export type ConstrIArc = { kind:'INT_AA'; arc1Id:number; arc2Id:number; pick:0|1 };

export type Constraint =
  ConstrLA | ConstrPOL | ConstrPAR | ConstrPERP | ConstrFLA |
  ConstrMID | ConstrDIV | ConstrILArc | ConstrIArc;

export type Pt = { id:number; name:string; x:number; y:number; constraint?: Constraint };
export type Ln = { a:number; b:number }; // legacy

export type SegLine = { id:number; kind:'line'; a:number; b:number };
export type SegArc  = { id:number; kind:'arc'; center:number; start:number; end:number; ccw:boolean };
export type SegSpline = { id:number; kind:'spline'; anchors:number[] }; // ordered point ids
export type Seg = SegLine | SegArc | SegSpline;

export type Block = { id:string; name:string; units:Units; pointIds:number[] };

type DraftState = {
  currentBlockId: string | null;
  blocks: Block[];
  points: Pt[];
  lines: Ln[];
  segs: Seg[];

  // blocks
  createBlock: (name:string, units:Units) => string;

  // create points
  addPointXY: (name:string, x:number, y:number) => number;
  addPointLA: (baseId:number, name:string, length:number, angleDeg:number) => number;
  addPointOnLineDistance: (aId:number, bId:number, name:string, dist:number) => number;

  // Phase D: creations
  addPointParallelThrough: (through:number, refA:number, refB:number, name:string, length:number)=>number;
  addPointPerpThrough: (through:number, refA:number, refB:number, name:string, length:number)=>number;
  addPointFromLineAngle: (base:number, refA:number, refB:number, name:string, length:number, offset:number)=>number;
  addMidpoint: (a:number, b:number, name:string)=>number;
  addDivideSegment: (a:number, b:number, t:number, name:string)=>number;
  addIntersectionLineArc: (segLineId:number, segArcId:number, pick:0|1, name:string)=>number;
  addIntersectionArcArc: (arc1Id:number, arc2Id:number, pick:0|1, name:string)=>number;

  addPerpFootFromPointToLine: (pId:number, aId:number, bId:number, name:string) => number; // existing
  addIntersectionOfLines: (segLineId1:number, segLineId2:number, name:string) => number;  // existing

  // segments
  addLineBetween: (aId:number, bId:number) => number;
  addArcCSE: (centerId:number, startId:number, endId:number, ccw:boolean) => number;
  addSplineFromAnchors: (anchors:number[]) => number;

  // edit constructions (existing + new)
  editPointLA: (id:number, o:{length?:number; angle?:number; base?:number})=>void;
  editPointPOL: (id:number, o:{dist?:number; a?:number; b?:number})=>void;
  editPointPAR: (id:number, o:{length?:number; through?:number; refA?:number; refB?:number})=>void;
  editPointPERP:(id:number, o:{length?:number; through?:number; refA?:number; refB?:number})=>void;
  editPointFLA: (id:number, o:{length?:number; offset?:number; base?:number; refA?:number; refB?:number})=>void;
  editPointMID: (id:number, o:{a?:number; b?:number})=>void;
  editPointDIV: (id:number, o:{a?:number; b?:number; t?:number})=>void;
  editPointILArc:(id:number, o:{lineSegId?:number; arcSegId?:number; pick?:0|1})=>void;
  editPointIArc: (id:number, o:{arc1Id?:number; arc2Id?:number; pick?:0|1})=>void;

  // edit/general
  updatePoint: (id:number, p:{x:number;y:number}) => void;
  setPointName: (id:number, name:string) => void;
  deletePoint: (id:number) => void;

  // util
  findPointByName: (name:string) => Pt | undefined;

  // persistence
  dumpJSON: () => any;
  loadJSON: (data:any) => void;

  reset: () => void;
};

let nextPointId = 0;
let nextSegId = 0;

function placeLA(base:{x:number;y:number}, length:number, angleDeg:number){ 
  const r=rad(angleDeg);
  return { x: base.x + length*Math.cos(r), y: base.y + length*Math.sin(r) };
}

export const useDraftStore = create<DraftState>((set, get) => ({
  currentBlockId: null,
  blocks: [],
  points: [],
  lines: [],
  segs: [],

  createBlock: (name, units) => {
    const id = Math.random().toString(36).slice(2);
    const A: Pt = { id: nextPointId++, name: 'A', x: 0, y: 0 };
    set(state => ({
      currentBlockId: id,
      blocks: [...state.blocks, { id, name, units, pointIds: [A.id] }],
      points: [...state.points, A],
      lines: state.lines,
      segs: state.segs
    }));
    return id;
  },

  addPointXY: (name, x, y) => {
    const pt: Pt = { id: nextPointId++, name, x, y };
    set(state => ({
      points: [...state.points, pt],
      blocks: state.blocks.map(b => b.id === state.currentBlockId ? { ...b, pointIds: [...b.pointIds, pt.id] } : b)
    }));
    return pt.id;
  },

  addPointLA: (baseId, name, length, angleDeg) => {
    const { points } = get();
    const base = points.find(p => p.id === baseId);
    if(!base) throw new Error('Base not found');
    const {x,y} = placeLA(base, length, angleDeg);
    const pt: Pt = { id: nextPointId++, name, x, y, constraint: { kind:'LA', base: baseId, length, angle: angleDeg } };
    set(state => ({
      points: [...state.points, pt],
      blocks: state.blocks.map(b => b.id === state.currentBlockId ? { ...b, pointIds: [...b.pointIds, pt.id] } : b)
    }));
    return pt.id;
  },

  addPointOnLineDistance: (aId, bId, name, distAB) => {
    const { points } = get();
    const A = points.find(p=>p.id===aId); const B = points.find(p=>p.id===bId);
    if(!A || !B) throw new Error('Line endpoints not found');
    const d = dist(A,B) || 1e-9;
    const t = distAB / d;
    const x = A.x + (B.x - A.x) * t;
    const y = A.y + (B.y - A.y) * t;
    const pt: Pt = { id: nextPointId++, name, x, y, constraint: { kind:'POL', a:aId, b:bId, dist: distAB } };
    set(state => ({
      points: [...state.points, pt],
      blocks: state.blocks.map(b => b.id === state.currentBlockId ? { ...b, pointIds: [...b.pointIds, pt.id] } : b)
    }));
    return pt.id;
  },

  // ==== Phase D creations ====
  addPointParallelThrough: (through, refA, refB, name, length) => {
    const { points } = get();
    const P = points.find(p=>p.id===through);
    const A = points.find(p=>p.id===refA); const B = points.find(p=>p.id===refB);
    if(!P||!A||!B) throw new Error('Points not found');
    const ang = angleOf(A,B);
    const {x,y} = placeLA(P, length, ang);
    const pt: Pt = { id: nextPointId++, name, x, y, constraint: { kind:'PAR', through, refA, refB, length } };
    set(s=>({ points:[...s.points, pt], blocks: s.blocks.map(b=>b.id===s.currentBlockId?{...b,pointIds:[...b.pointIds,pt.id]}:b) }));
    return pt.id;
  },

  addPointPerpThrough: (through, refA, refB, name, length) => {
    const { points } = get();
    const P = points.find(p=>p.id===through);
    const A = points.find(p=>p.id===refA); const B = points.find(p=>p.id===refB);
    if(!P||!A||!B) throw new Error('Points not found');
    const ang = angleOf(A,B) + 90;
    const {x,y} = placeLA(P, length, ang);
    const pt: Pt = { id: nextPointId++, name, x, y, constraint: { kind:'PERP', through, refA, refB, length } };
    set(s=>({ points:[...s.points, pt], blocks: s.blocks.map(b=>b.id===s.currentBlockId?{...b,pointIds:[...b.pointIds,pt.id]}:b) }));
    return pt.id;
  },

  addPointFromLineAngle: (base, refA, refB, name, length, offset) => {
    const { points } = get();
    const P = points.find(p=>p.id===base);
    const A = points.find(p=>p.id===refA); const B = points.find(p=>p.id===refB);
    if(!P||!A||!B) throw new Error('Points not found');
    const ang = angleOf(A,B) + offset;
    const {x,y} = placeLA(P, length, ang);
    const pt: Pt = { id: nextPointId++, name, x, y, constraint: { kind:'FLA', base, refA, refB, length, offset } };
    set(s=>({ points:[...s.points, pt], blocks: s.blocks.map(b=>b.id===s.currentBlockId?{...b,pointIds:[...b.pointIds,pt.id]}:b) }));
    return pt.id;
  },

  addMidpoint: (a,b,name) => {
    const { points } = get();
    const A = points.find(p=>p.id===a); const B = points.find(p=>p.id===b);
    if(!A||!B) throw new Error('Points not found');
    const x=(A.x+B.x)/2, y=(A.y+B.y)/2;
    const pt: Pt = { id: nextPointId++, name, x, y, constraint: { kind:'MID', a, b } };
    set(s=>({ points:[...s.points, pt], blocks:s.blocks.map(bb=>bb.id===s.currentBlockId?{...bb,pointIds:[...bb.pointIds,pt.id]}:bb) }));
    return pt.id;
  },

  addDivideSegment: (a,b,t,name) => {
    const { points } = get();
    const A = points.find(p=>p.id===a); const B = points.find(p=>p.id===b);
    if(!A||!B) throw new Error('Points not found');
    const x = A.x + (B.x-A.x)*t;
    const y = A.y + (B.y-A.y)*t;
    const pt: Pt = { id: nextPointId++, name, x, y, constraint: { kind:'DIV', a, b, t } };
    set(s=>({ points:[...s.points, pt], blocks:s.blocks.map(bb=>bb.id===s.currentBlockId?{...bb,pointIds:[...bb.pointIds,pt.id]}:bb) }));
    return pt.id;
  },

  addIntersectionLineArc: (segLineId, segArcId, pick, name) => {
    const { points, segs } = get();
    const L = segs.find(s=>s.id===segLineId && s.kind==='line') as SegLine|undefined;
    const A = segs.find(s=>s.id===segArcId  && s.kind==='arc')  as SegArc|undefined;
    if(!L||!A) throw new Error('Need a line seg and an arc seg');
    const pA = points.find(p=>p.id===L.a)!; const pB = points.find(p=>p.id===L.b)!;
    const C  = points.find(p=>p.id===A.center)!;
    const S  = points.find(p=>p.id===A.start)!; const E = points.find(p=>p.id===A.end)!;
    const r = dist(C,S);
    const cand = intersectLineCircle(pA,pB,C,r).filter(P => {
      const th = Math.atan2(P.y-C.y, P.x-C.x);
      return arcContainsAngle(C,S,E,A.ccw, th);
    });
    if(!cand.length) throw new Error('No intersection on arc span');
    const pickIdx = Math.min(pick, cand.length-1);
    const P = cand[pickIdx];
    const pt: Pt = { id: nextPointId++, name, x: P.x, y: P.y, constraint: { kind:'INT_LA', lineSegId: segLineId, arcSegId: segArcId, pick: pickIdx as 0|1 } };
    set(s=>({ points:[...s.points, pt], blocks:s.blocks.map(bb=>bb.id===s.currentBlockId?{...bb,pointIds:[...bb.pointIds,pt.id]}:bb) }));
    return pt.id;
  },

  addIntersectionArcArc: (arc1Id, arc2Id, pick, name) => {
    const { points, segs } = get();
    const A1 = segs.find(s=>s.id===arc1Id && s.kind==='arc') as SegArc|undefined;
    const A2 = segs.find(s=>s.id===arc2Id && s.kind==='arc') as SegArc|undefined;
    if(!A1||!A2) throw new Error('Need two arcs');
    const C1=points.find(p=>p.id===A1.center)!; const S1=points.find(p=>p.id===A1.start)!; const E1=points.find(p=>p.id===A1.end)!;
    const C2=points.find(p=>p.id===A2.center)!; const S2=points.find(p=>p.id===A2.start)!; const E2=points.find(p=>p.id===A2.end)!;
    const r1=dist(C1,S1), r2=dist(C2,S2);
    const cand = intersectCircles(C1,r1,C2,r2).filter(P=>{
      const th1=Math.atan2(P.y-C1.y,P.x-C1.x);
      const th2=Math.atan2(P.y-C2.y,P.x-C2.x);
      return arcContainsAngle(C1,S1,E1,A1.ccw,th1) && arcContainsAngle(C2,S2,E2,A2.ccw,th2);
    });
    if(!cand.length) throw new Error('No intersection on arc spans');
    const pickIdx = Math.min(pick, cand.length-1);
    const P = cand[pickIdx];
    const pt: Pt = { id: nextPointId++, name, x:P.x, y:P.y, constraint: { kind:'INT_AA', arc1Id, arc2Id, pick: pickIdx as 0|1 } };
    set(s=>({ points:[...s.points, pt], blocks:s.blocks.map(bb=>bb.id===s.currentBlockId?{...bb,pointIds:[...bb.pointIds,pt.id]}:bb) }));
    return pt.id;
  },

  addPerpFootFromPointToLine: (pId, aId, bId, name) => {
    const { points } = get();
    const P = points.find(p=>p.id===pId), A = points.find(p=>p.id===aId), B = points.find(p=>p.id===bId);
    if(!P||!A||!B) throw new Error('Points not found');
    const ax=A.x, ay=A.y, bx=B.x, by=B.y, px=P.x, py=P.y;
    const abx=bx-ax, aby=by-ay;
    const ab2 = abx*abx + aby*aby || 1;
    const t = ((px-ax)*abx + (py-ay)*aby) / ab2;
    const x = ax + t*abx, y = ay + t*aby;
    const pt: Pt = { id: nextPointId++, name, x, y };
    set(state => ({
      points: [...state.points, pt],
      blocks: state.blocks.map(b => b.id === state.currentBlockId ? { ...b, pointIds: [...b.pointIds, pt.id] } : b)
    }));
    return pt.id;
  },

  addIntersectionOfLines: (segLineId1, segLineId2, name) => {
    const { points, segs } = get();
    const s1 = segs.find(s=>s.id===segLineId1 && s.kind==='line') as SegLine | undefined;
    const s2 = segs.find(s=>s.id===segLineId2 && s.kind==='line') as SegLine | undefined;
    if(!s1 || !s2) throw new Error('Both segments must be lines');
    const A = points.find(p=>p.id===s1.a)!; const B = points.find(p=>p.id===s1.b)!;
    const C = points.find(p=>p.id===s2.a)!; const D = points.find(p=>p.id===s2.b)!;
    const x1=A.x,y1=A.y,x2=B.x,y2=B.y,x3=C.x,y3=C.y,x4=D.x,y4=D.y;
    const den = (x1-x2)*(y3-y4)-(y1-y2)*(x3-x4);
    if (Math.abs(den) < 1e-9) throw new Error('Lines are parallel');
    const xi = ((x1*y2 - y1*x2)*(x3-x4) - (x1-x2)*(x3*y4 - y3*x4)) / den;
    const yi = ((x1*y2 - y1*x2)*(y3-y4) - (y1-y2)*(x3*y4 - y3*x4)) / den;
    const pt: Pt = { id: nextPointId++, name, x: xi, y: yi };
    set(state => ({
      points: [...state.points, pt],
      blocks: state.blocks.map(b => b.id === state.currentBlockId ? { ...b, pointIds: [...b.pointIds, pt.id] } : b)
    }));
    return pt.id;
  },

  // segments
  addLineBetween: (aId, bId) => {
    const seg: SegLine = { id: nextSegId++, kind:'line', a:aId, b:bId };
    set(state => ({
      segs: [...state.segs, seg],
      lines: [...state.lines, { a:aId, b:bId }]
    }));
    return seg.id;
  },

  addArcCSE: (centerId, startId, endId, ccw) => {
    const seg: SegArc = { id: nextSegId++, kind:'arc', center:centerId, start:startId, end:endId, ccw };
    set(state => ({ segs: [...state.segs, seg] }));
    return seg.id;
  },

  addSplineFromAnchors: (anchors) => {
    if(anchors.length<2) throw new Error('Need at least two anchors');
    const seg: SegSpline = { id: nextSegId++, kind:'spline', anchors: anchors.slice() };
    set(s=>({ segs:[...s.segs, seg] }));
    return seg.id;
  },

  // === edits ===
  editPointLA: (id, o) => set(state => {
    const i=state.points.findIndex(p=>p.id===id); if(i<0) return state as any;
    const pt=state.points[i], c=pt.constraint; if(!c||c.kind!=='LA') return state as any;
    const base = state.points.find(p=>p.id===(o.base ?? c.base)); if(!base) return state as any;
    const length = o.length ?? c.length, angle = o.angle ?? c.angle;
    const pos = placeLA(base, length, angle);
    const next=state.points.slice(); next[i]={...pt, ...pos, constraint:{kind:'LA', base:base.id, length, angle}};
    return { points: next };
  }),

  editPointPOL: (id, o) => set(state => {
    const i=state.points.findIndex(p=>p.id===id); if(i<0) return state as any;
    const pt=state.points[i], c=pt.constraint; if(!c||c.kind!=='POL') return state as any;
    const A=state.points.find(p=>p.id===(o.a ?? c.a)), B=state.points.find(p=>p.id===(o.b ?? c.b));
    if(!A||!B) return state as any;
    const distAB = o.dist ?? c.dist;
    const d = Math.hypot(B.x-A.x, B.y-A.y) || 1e-9;
    const t = distAB/d;
    const pos = { x: A.x + (B.x-A.x)*t, y: A.y + (B.y-A.y)*t };
    const next=state.points.slice(); next[i]={...pt, ...pos, constraint:{kind:'POL', a:A.id, b:B.id, dist:distAB}};
    return { points: next };
  }),

  editPointPAR: (id,o)=> set(s=>{
    const i=s.points.findIndex(p=>p.id===id); if(i<0) return s as any;
    const pt=s.points[i], c=pt.constraint; if(!c||c.kind!=='PAR') return s as any;
    const through=s.points.find(p=>p.id===(o.through ?? c.through));
    const A=s.points.find(p=>p.id===(o.refA ?? c.refA));
    const B=s.points.find(p=>p.id===(o.refB ?? c.refB));
    if(!through||!A||!B) return s as any;
    const length=o.length ?? c.length;
    const pos=placeLA(through, length, angleOf(A,B));
    const next=s.points.slice(); next[i]={...pt,...pos,constraint:{kind:'PAR',through:through.id,refA:A.id,refB:B.id,length}};
    return { points: next };
  }),

  editPointPERP: (id,o)=> set(s=>{
    const i=s.points.findIndex(p=>p.id===id); if(i<0) return s as any;
    const pt=s.points[i], c=pt.constraint; if(!c||c.kind!=='PERP') return s as any;
    const through=s.points.find(p=>p.id===(o.through ?? c.through));
    const A=s.points.find(p=>p.id===(o.refA ?? c.refA));
    const B=s.points.find(p=>p.id===(o.refB ?? c.refB));
    if(!through||!A||!B) return s as any;
    const length=o.length ?? c.length;
    const pos=placeLA(through, length, angleOf(A,B)+90);
    const next=s.points.slice(); next[i]={...pt,...pos,constraint:{kind:'PERP',through:through.id,refA:A.id,refB:B.id,length}};
    return { points: next };
  }),

  editPointFLA: (id,o)=> set(s=>{
    const i=s.points.findIndex(p=>p.id===id); if(i<0) return s as any;
    const pt=s.points[i], c=pt.constraint; if(!c||c.kind!=='FLA') return s as any;
    const base=s.points.find(p=>p.id===(o.base ?? c.base));
    const A=s.points.find(p=>p.id===(o.refA ?? c.refA));
    const B=s.points.find(p=>p.id===(o.refB ?? c.refB));
    if(!base||!A||!B) return s as any;
    const length=o.length ?? c.length, offset=o.offset ?? c.offset;
    const pos=placeLA(base, length, angleOf(A,B)+offset);
    const next=s.points.slice(); next[i]={...pt,...pos,constraint:{kind:'FLA',base:base.id,refA:A.id,refB:B.id,length,offset}};
    return { points: next };
  }),

  editPointMID: (id,o)=> set(s=>{
    const i=s.points.findIndex(p=>p.id===id); if(i<0) return s as any;
    const pt=s.points[i], c=pt.constraint; if(!c||c.kind!=='MID') return s as any;
    const A=s.points.find(p=>p.id===(o.a ?? c.a)); const B=s.points.find(p=>p.id===(o.b ?? c.b));
    if(!A||!B) return s as any;
    const pos={ x:(A.x+B.x)/2, y:(A.y+B.y)/2 };
    const next=s.points.slice(); next[i]={...pt,...pos,constraint:{kind:'MID', a:A.id, b:B.id}};
    return { points: next };
  }),

  editPointDIV: (id,o)=> set(s=>{
    const i=s.points.findIndex(p=>p.id===id); if(i<0) return s as any;
    const pt=s.points[i], c=pt.constraint; if(!c||c.kind!=='DIV') return s as any;
    const A=s.points.find(p=>p.id===(o.a ?? c.a)); const B=s.points.find(p=>p.id===(o.b ?? c.b));
    if(!A||!B) return s as any;
    const t=o.t ?? c.t;
    const pos={ x:A.x+(B.x-A.x)*t, y:A.y+(B.y-A.y)*t };
    const next=s.points.slice(); next[i]={...pt,...pos,constraint:{kind:'DIV', a:A.id, b:B.id, t}};
    return { points: next };
  }),

  editPointILArc: (id,o)=> set(s=>{
    const i=s.points.findIndex(p=>p.id===id); if(i<0) return s as any;
    const pt=s.points[i], c=pt.constraint; if(!c||c.kind!=='INT_LA') return s as any;
    const lineSegId = o.lineSegId ?? c.lineSegId;
    const arcSegId  = o.arcSegId  ?? c.arcSegId;
    const pick      = (o.pick ?? c.pick) as 0|1;
    // recompute via creation util:
    const tmpStore = { ...s, points:[...s.points], segs:[...s.segs] };
    // reuse creation: compute position
    const L = s.segs.find(ss=>ss.id===lineSegId && ss.kind==='line') as any;
    const A = s.segs.find(ss=>ss.id===arcSegId  && ss.kind==='arc')  as any;
    if(!L||!A) return s as any;
    const pA=s.points.find(p=>p.id===L.a)!; const pB=s.points.find(p=>p.id===L.b)!;
    const C=s.points.find(p=>p.id===A.center)!; const S=s.points.find(p=>p.id===A.start)!; const E=s.points.find(p=>p.id===A.end)!;
    const r=dist(C,S);
    const cand = intersectLineCircle(pA,pB,C,r).filter(P => arcContainsAngle(C,S,E,A.ccw, Math.atan2(P.y-C.y,P.x-C.x)));
    if(!cand.length) return s as any;
    const P = cand[Math.min(pick, cand.length-1)];
    const next=s.points.slice(); next[i]={...pt, x:P.x, y:P.y, constraint:{kind:'INT_LA', lineSegId, arcSegId, pick}};
    return { points: next };
  }),

  editPointIArc: (id,o)=> set(s=>{
    const i=s.points.findIndex(p=>p.id===id); if(i<0) return s as any;
    const pt=s.points[i], c=pt.constraint; if(!c||c.kind!=='INT_AA') return s as any;
    const arc1Id=o.arc1Id ?? c.arc1Id, arc2Id=o.arc2Id ?? c.arc2Id, pick=(o.pick ?? c.pick) as 0|1;
    const A1=s.segs.find(ss=>ss.id===arc1Id && ss.kind==='arc') as any;
    const A2=s.segs.find(ss=>ss.id===arc2Id && ss.kind==='arc') as any;
    if(!A1||!A2) return s as any;
    const C1=s.points.find(p=>p.id===A1.center)!; const S1=s.points.find(p=>p.id===A1.start)!; const E1=s.points.find(p=>p.id===A1.end)!;
    const C2=s.points.find(p=>p.id===A2.center)!; const S2=s.points.find(p=>p.id===A2.start)!; const E2=s.points.find(p=>p.id===A2.end)!;
    const r1=dist(C1,S1), r2=dist(C2,S2);
    const cand = intersectCircles(C1,r1,C2,r2).filter(P=>{
      const th1=Math.atan2(P.y-C1.y,P.x-C1.x);
      const th2=Math.atan2(P.y-C2.y,P.x-C2.x);
      return arcContainsAngle(C1,S1,E1,A1.ccw,th1) && arcContainsAngle(C2,S2,E2,A2.ccw,th2);
    });
    if(!cand.length) return s as any;
    const P=cand[Math.min(pick,cand.length-1)];
    const next=s.points.slice(); next[i]={...pt,x:P.x,y:P.y,constraint:{kind:'INT_AA', arc1Id, arc2Id, pick}};
    return { points: next };
  }),

  updatePoint: (id, p) => set(state => {
    const idx = state.points.findIndex(q => q.id === id);
    if (idx === -1) return state as any;
    const next = state.points.slice();
    next[idx] = { ...next[idx], ...p };
    return { points: next };
  }),

  setPointName: (id, name) => set(state => {
    const idx = state.points.findIndex(q => q.id === id);
    if (idx === -1) return state as any;
    const next = state.points.slice();
    next[idx] = { ...next[idx], name };
    return { points: next };
  }),

  deletePoint: (id) => set(state => {
    const points = state.points.filter(p=>p.id!==id);
    const lines = state.lines.filter(ln=> ln.a!==id && ln.b!==id);
    const segs = state.segs.filter(s=> {
      if (s.kind==='line') return s.a!==id && s.b!==id;
      if (s.kind==='arc')  return s.center!==id && s.start!==id && s.end!==id;
      if (s.kind==='spline') return !s.anchors.includes(id);
      return true;
    });
    const blocks = state.blocks.map(b => ({ ...b, pointIds: b.pointIds.filter(pid=>pid!==id) }));
    return { points, lines, segs, blocks };
  }),

  findPointByName: (name) => get().points.find(p => p.name === name),

  dumpJSON: () => {
    const s = get();
    return {
      currentBlockId: s.currentBlockId,
      blocks: s.blocks,
      points: s.points,
      lines: s.lines,
      segs: s.segs,
      nextPointId,
      nextSegId
    };
  },

  loadJSON: (data:any) => {
    nextPointId = data?.nextPointId ?? 0;
    nextSegId   = data?.nextSegId ?? 0;
    const segs: Seg[] = Array.isArray(data?.segs) ? data.segs :
      Array.isArray(data?.lines) ? data.lines.map((ln:Ln, i:number)=>({ id:i, kind:'line', a:ln.a, b:ln.b } as SegLine)) : [];
    if (!data?.nextSegId) nextSegId = segs.length;
    set({
      currentBlockId: data.currentBlockId ?? null,
      blocks: data.blocks ?? [],
      points: data.points ?? [],
      lines: data.lines ?? [],
      segs
    });
  },

  reset: () => { nextPointId = 0; nextSegId = 0; set({ currentBlockId: null, blocks: [], points: [], lines: [], segs: [] }); }
}));
