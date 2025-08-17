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
  updatePoint: (id:number, p:{x:number;y:number}) => void;
  findPointByName: (name:string) => Pt | undefined;
  reset: () => void;
};

let nextPointId = 0;

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

  updatePoint: (id, p) => set(state => {
    const idx = state.points.findIndex(q => q.id === id);
    if (idx === -1) return state as any;
    const next = state.points.slice();
    next[idx] = { ...next[idx], ...p };
    return { points: next };
  }),

  findPointByName: (name) => get().points.find(p => p.name === name),

  reset: () => set({ currentBlockId: null, blocks: [], points: [], lines: [] })
}));
