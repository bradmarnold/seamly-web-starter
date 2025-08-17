import { create } from 'zustand';

export type Pt = { x:number; y:number };
export type Ln = { a:number; b:number };

type DraftState = {
  points: Pt[];
  lines: Ln[];
  addPoint: (p: Pt) => number;
  addLine: (l: Ln) => void;
  updatePoint: (id:number, p: Pt) => void;
  reset: () => void;
};

export const useDraftStore = create<DraftState>((set) => ({
  points: [],
  lines: [],
  addPoint: (p) => {
    let idx = -1;
    set(state => { idx = state.points.length; return { points: [...state.points, p] }; });
    return idx;
  },
  addLine: (l) => set(state => ({ lines: [...state.lines, l] })),
  updatePoint: (id, p) => set(state => {
    const next = state.points.slice();
    next[id] = p;
    return { points: next };
  }),
  reset: () => set({ points: [], lines: [] })
}));
