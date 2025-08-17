'use client';
import create from 'zustand';

export type Point = { id:number; name:string; x:number; y:number };
export type SegLine = { id:number; kind:'line'; a:number; b:number };
export type SegArc = { id:number; kind:'arc'; center:number; start:number; end:number; ccw:boolean };
export type SegPath = { id:number; kind:'path'; anchors:number[]; closed?:boolean };
export type Segment = SegLine | SegArc | SegPath;
export type LegacyLine = { a:number; b:number };

export type DraftState = {
  points: Point[];
  segs: Segment[];
  lines: LegacyLine[]; // faint helper lines
  currentBlockId: string | null;

  // id counters
  _pid: number;
  _sid: number;

  reset: () => void;
  addPoint: (name:string, x:number, y:number) => number;
  updatePoint: (id:number, p:{x:number;y:number}) => void;

  addLineBetween: (a:number, b:number) => void;

  addPointLA: (baseId:number, name:string, len:number, angDeg:number) => number; // Point: Length & Angle
  addPointOnLine: (a:number, b:number, name:string, dist:number) => number;     // Point: Along Line (from A toward B by dist)
  addPerpFoot: (pId:number, a:number, b:number, name:string) => number;         // Perpendicular foot of P onto AB
  addPointFromLineAngle: (base:number, refA:number, refB:number, name:string, len:number, offsetDeg:number) => number; // from AB direction

  addMidpoint: (a:number, b:number, name:string) => number;                      // midpoint of AB
  addDivideSegment: (a:number, b:number, k:number, n:number, name:string) => number; // k/n along AB from A

  addSpline: (anchors:number[], closed?:boolean) => number;

  dumpJSON: () => any;
  loadJSON: (obj:any) => void;
};

function rad(d:number){ return d * Math.PI/180; }
function deg(r:number){ let d = r*180/Math.PI; if (d<0) d+=360; return d; }

export const useDraftStore = create<DraftState>((set, get) => ({
  points: [],
  segs: [],
  lines: [],
  currentBlockId: null,
  _pid: 1,
  _sid: 1,

  reset: () => set({
    points: [{ id:1, name:'A', x:100, y:100 }],
    segs: [],
    lines: [],
    _pid: 2,
    _sid: 1,
  }),

  addPoint: (name, x, y) => {
    const id = get()._pid;
    set(s => ({ points: [...s.points, { id, name, x, y }], _pid: id+1 }));
    return id;
  },

  updatePoint: (id, p) => set(s => ({
    points: s.points.map(pt => pt.id===id ? ({ ...pt, ...p }) : pt)
  })),

  addLineBetween: (a, b) => set(s => ({
    segs: [...s.segs, { id:s._sid, kind:'line', a, b } as SegLine],
    _sid: s._sid + 1
  })),

  addPointLA: (baseId, name, len, angDeg) => {
    const A = get().points.find(p=>p.id===baseId)!;
    const x = A.x + len * Math.cos(rad(angDeg));
    const y = A.y + len * Math.sin(rad(angDeg));
    return get().addPoint(name, x, y);
  },

  addPointOnLine: (a, b, name, dist) => {
    const A = get().points.find(p=>p.id===a)!;
    const B = get().points.find(p=>p.id===b)!;
    const vx = B.x - A.x, vy = B.y - A.y;
    const L = Math.hypot(vx, vy) || 1e-9;
    const x = A.x + (dist/L) * vx;
    const y = A.y + (dist/L) * vy;
    return get().addPoint(name, x, y);
  },

  addPerpFoot: (pId, a, b, name) => {
    const P = get().points.find(p=>p.id===pId)!;
    const A = get().points.find(p=>p.id===a)!;
    const B = get().points.find(p=>p.id===b)!;
    const vx = B.x - A.x, vy = B.y - A.y;
    const L2 = vx*vx + vy*vy || 1e-9;
    const t = ((P.x - A.x)*vx + (P.y - A.y)*vy) / L2; // projection scalar (unclamped)
    const x = A.x + t*vx, y = A.y + t*vy;
    return get().addPoint(name, x, y);
  },

  addPointFromLineAngle: (base, refA, refB, name, len, offsetDeg) => {
    const O = get().points.find(p=>p.id===base)!;
    const A = get().points.find(p=>p.id===refA)!;
    const B = get().points.find(p=>p.id===refB)!;
    const angAB = deg(Math.atan2(B.y-A.y, B.x-A.x));
    const ang = angAB + offsetDeg;
    const x = O.x + len * Math.cos(rad(ang));
    const y = O.y + len * Math.sin(rad(ang));
    return get().addPoint(name, x, y);
  },

  addMidpoint: (a, b, name) => {
    const A = get().points.find(p=>p.id===a)!;
    const B = get().points.find(p=>p.id===b)!;
    const x = (A.x + B.x)/2, y = (A.y + B.y)/2;
    return get().addPoint(name, x, y);
  },

  addDivideSegment: (a, b, k, n, name) => {
    const A = get().points.find(p=>p.id===a)!;
    const B = get().points.find(p=>p.id===b)!;
    const t = (n===0) ? 0 : (k/n);
    const x = A.x + t*(B.x - A.x);
    const y = A.y + t*(B.y - A.y);
    return get().addPoint(name, x, y);
  },

  addSpline: (anchors, closed=false) => {
    const id = get()._sid;
    set(s => ({ segs: [...s.segs, { id, kind:'path', anchors, closed } as SegPath], _sid: s._sid+1 }));
    return id;
  },

  dumpJSON: () => {
    const s = get();
    return { points: s.points, segs: s.segs, lines: s.lines };
  },

  loadJSON: (obj:any) => {
    try{
      const pts = Array.isArray(obj.points) ? obj.points : [];
      const segs = Array.isArray(obj.segs) ? obj.segs : [];
      set({
        points: pts, segs,
        lines: Array.isArray(obj.lines) ? obj.lines : [],
        _pid: (pts.reduce((m:any,p:any)=>Math.max(m,p.id||0),0) || 0) + 1,
        _sid: (segs.reduce((m:any,s:any)=>Math.max(m,s.id||0),0) || 0) + 1
      });
    }catch(e){ console.error(e); }
  },
}));
