import { create } from 'zustand';

export type Units = 'centimeters'|'millimeters'|'inches';
export type Pt = { id:number; name:string; x:number; y:number };
export type Ln = { a:number; b:number };
export type Block = { id:string; name:string; units:Units; pointIds:number[] };

type DraftState = {
  currentBlockId: string | null;
  blocks: Block[];
  points: Pt[];
  lines: Ln[];

  createBlock: (name:string, units:Units) => string;
  addPointLA: (baseId:number, name:string, length:number, angleDeg:number) => number;
  addLineBetween: (aId:number, bId:number) => void;

  addPointOnLineDistance: (aId:number, bId:number, name:string, dist:number) => number;
  addPerpFootFromPointToLine: (pId:number, aId:number, bId:number, name:string) => number;

  updatePoint: (id:number, p:{x:number;y:number}) => void;
  setPointName: (id:number, name:string) => void;
  findPointByName: (name:string) => Pt | undefined;

  dumpJSON: () => any;
  loadJSON: (data:any) => void;

  reset: () => void;
};

let nextPointId = 0;

function distance(ax:number, ay:number, bx:number, by:number){
  const dx = bx-ax, dy = by-ay; return Math.hypot(dx,dy);
}

export const useDraftStore = create<DraftState>((set, get) => ({
  currentBlockId: null,
  blocks: [],
  points: [],
  lines: [],

  createBlock: (name, units) => {
    const id = Math.random().toString(36).slice(2);
    const A: Pt = { id: nextPointId++, name: 'A', x: 0, y: 0 };
    set(state => ({
      currentBlockId: id,
      blocks: [...state.blocks, { id, name, units, pointIds: [A.id] }],
      points: [...state.points, A],
      lines: state.lines
    }));
    return id;
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

  addLineBetween: (aId, bId) => set(state => ({ lines: [...state.lines, { a:aId, b:bId }] })),

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

  findPointByName: (name) => get().points.find(p => p.name === name),

  dumpJSON: () => {
    const s = get();
    return {
      currentBlockId: s.currentBlockId,
      blocks: s.blocks,
      points: s.points,
      lines: s.lines,
      nextPointId
    };
  },
  loadJSON: (data:any) => {
    nextPointId = data?.nextPointId ?? 0;
    set({
      currentBlockId: data.currentBlockId ?? null,
      blocks: data.blocks ?? [],
      points: data.points ?? [],
      lines: data.lines ?? []
    });
  },

  reset: () => { nextPointId = 0; set({ currentBlockId: null, blocks: [], points: [], lines: [] }); }
}));
