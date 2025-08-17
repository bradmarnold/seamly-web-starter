import { create } from 'zustand';

export type Units = 'centimeters'|'millimeters'|'inches';

export type Pt = { id:number; name:string; x:number; y:number };
export type Ln = { a:number; b:number }; // legacy compatibility

export type SegLine = { id:number; kind:'line'; a:number; b:number };
export type SegArc  = { id:number; kind:'arc'; center:number; start:number; end:number; ccw:boolean };
export type Seg = SegLine | SegArc;

export type Block = { id:string; name:string; units:Units; pointIds:number[] };

type DraftState = {
  currentBlockId: string | null;
  blocks: Block[];
  points: Pt[];
  lines: Ln[];      // legacy (kept so older JSONs still work)
  segs: Seg[];      // new: unified segments

  // blocks
  createBlock: (name:string, units:Units) => string;

  // points
  addPointXY: (name:string, x:number, y:number) => number;
  addPointLA: (baseId:number, name:string, length:number, angleDeg:number) => number;
  addPointOnLineDistance: (aId:number, bId:number, name:string, dist:number) => number;
  addPerpFootFromPointToLine: (pId:number, aId:number, bId:number, name:string) => number;
  addIntersectionOfLines: (segLineId1:number, segLineId2:number, name:string) => number;

  // segments
  addLineBetween: (aId:number, bId:number) => number;
  addArcCSE: (centerId:number, startId:number, endId:number, ccw:boolean) => number;

  // edit
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

function distance(ax:number, ay:number, bx:number, by:number){
  const dx = bx-ax, dy = by-ay; return Math.hypot(dx,dy);
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
    if(!base) throw new Error('Base point not found');
    const rad = angleDeg * Math.PI / 180;
    const x = base.x + length * Math.cos(rad);
    const y = base.y + length * Math.sin(rad);
    const pt: Pt = { id: nextPointId++, name, x, y };
    set(state => ({
      points: [...state.points, pt],
      blocks: state.blocks.map(b => b.id === state.currentBlockId ? { ...b, pointIds: [...b.pointIds, pt.id] } : b)
    }));
    return pt.id;
  },

  addPointOnLineDistance: (aId, bId, name, dist) => {
    const { points } = get();
    const A = points.find(p=>p.id===aId); const B = points.find(p=>p.id===bId);
    if(!A || !B) throw new Error('Line endpoints not found');
    const d = distance(A.x,A.y,B.x,B.y);
    const t = d === 0 ? 0 : (dist / d);
    const x = A.x + (B.x - A.x) * t;
    const y = A.y + (B.y - A.y) * t;
    const pt: Pt = { id: nextPointId++, name, x, y };
    set(state => ({
      points: [...state.points, pt],
      blocks: state.blocks.map(b => b.id === state.currentBlockId ? { ...b, pointIds: [...b.pointIds, pt.id] } : b)
    }));
    return pt.id;
  },

  addPerpFootFromPointToLine: (pId, aId, bId, name) => {
    const { points } = get();
    const P = points.find(p=>p.id===pId);
    const A = points.find(p=>p.id===aId);
    const B = points.find(p=>p.id===bId);
    if(!P || !A || !B) throw new Error('Points not found');
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

  addLineBetween: (aId, bId) => {
    const seg: SegLine = { id: nextSegId++, kind:'line', a:aId, b:bId };
    set(state => ({
      segs: [...state.segs, seg],
      // keep legacy line for compatibility with older views/exports
      lines: [...state.lines, { a:aId, b:bId }]
    }));
    return seg.id;
  },

  addArcCSE: (centerId, startId, endId, ccw) => {
    const seg: SegArc = { id: nextSegId++, kind:'arc', center:centerId, start:startId, end:endId, ccw };
    set(state => ({ segs: [...state.segs, seg] }));
    return seg.id;
  },

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
      return s.center!==id && s.start!==id && s.end!==id;
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
    // if segs are missing, derive from legacy lines
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
