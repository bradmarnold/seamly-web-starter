import { create } from 'zustand';
export type Measure = { key:string; value:number; label?:string };
type MState = {
  vars: Record<string, number>;
  list: Measure[];
  setVar: (k:string, v:number)=>void;
  loadJSON: (obj: Record<string, number>)=>void;
  loadVIT: (xml: string)=>void; // stub
  loadVST: (xml: string)=>void; // stub
};
export const useMeasurements = create<MState>((set) => ({
  vars: {},
  list: [],
  setVar: (k, v) => set(s => {
    const exists = s.list.find(m => m.key===k);
    const list = exists ? s.list.map(m => m.key===k ? {...m, value:v} : m) : [...s.list, {key:k, value:v}];
    return { list, vars: { ...s.vars, [k]: v } };
  }),
  loadJSON: (obj) => set({ vars: obj, list: Object.entries(obj).map(([k,v])=>({key:k, value:Number(v)})) }),
  loadVIT: (_xml) => {},
  loadVST: (_xml) => {},
}));
