'use client';
import { useState } from 'react';
import { Modal } from './Modal';
import { useDraftStore } from '@/lib/store';

export default function LineArcIntersectDialog({ open, onClose }:{ open:boolean; onClose:()=>void }){
  const { points, segs, addIntersectionLineArc } = useDraftStore(s=>s);
  const lines = segs.filter(s=>s.kind==='line');
  const arcs = segs.filter(s=>s.kind==='arc');
  const [name, setName] = useState('X');
  const [lineId, setLineId] = useState<number|undefined>();
  const [arcId, setArcId] = useState<number|undefined>();
  const [pick, setPick] = useState<0|1>(0);

  const submit = () => {
    if(lineId==null || arcId==null) return;
    addIntersectionLineArc(lineId, arcId, pick, name.trim());
    onClose();
  };

  return (
    <Modal open={open} title="Intersection: Line × Arc" onClose={onClose}>
      <label>Name</label><input value={name} onChange={e=>setName(e.target.value)} />
      <label>Line</label>
      <select value={String(lineId ?? '')} onChange={e=>setLineId(Number(e.target.value))}>
        <option value="">Select line</option>
        {lines.map(l=>{
          const a = points.find(p=>p.id===l.a)!; const b=points.find(p=>p.id===l.b)!;
          return <option key={l.id} value={l.id}>{a.name}–{b.name}</option>;
        })}
      </select>
      <label>Arc</label>
      <select value={String(arcId ?? '')} onChange={e=>setArcId(Number(e.target.value))}>
        <option value="">Select arc</option>
        {arcs.map(a=>{
          const c=points.find(p=>p.id===a.center)!; const s=points.find(p=>p.id===a.start)!; const e=points.find(p=>p.id===a.end)!;
          return <option key={a.id} value={a.id}>C:{c.name} S:{s.name} E:{e.name} {a.ccw?'CCW':'CW'}</option>;
        })}
      </select>
      <label>Pick solution</label>
      <select value={String(pick)} onChange={e=>setPick(Number(e.target.value) as 0|1)}>
        <option value="0">#1</option><option value="1">#2</option>
      </select>
      <div className="actions"><button onClick={onClose}>Cancel</button><button onClick={submit}>Create</button></div>
    </Modal>
  );
}
