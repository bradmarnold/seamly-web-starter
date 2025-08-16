import { create } from 'zustand';

export type Pt = { x:number; y:number };
export type Ln = { a:number; b:number };

type DraftState = {
  points: Pt[];
  lines: Ln[];
  addPoint: (p: Pt) => number;
  addLine: (l: Ln) => void;
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
  reset: () => set({ points: [], lines: [] })
}));
