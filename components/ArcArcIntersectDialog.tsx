'use client';
import { useState } from 'react';
import { Modal } from './Modal';
import { useDraftStore } from '@/lib/store';

export default function ArcArcIntersectDialog({ open, onClose }:{ open:boolean; onClose:()=>void }){
  const { points, segs, addIntersectionArcArc } = useDraftStore(s=>s);
  const arcs = segs.filter(s=>s.kind==='arc');
  const [name, setName] = useState('Y');
  const [a1, setA1] = useState<number|undefined>();
  const [a2, setA2] = useState<number|undefined>();
  const [pick, setPick] = useState<0|1>(0);

  const submit = () => {
    if(a1==null || a2==null) return;
    addIntersectionArcArc(a1, a2, pick, name.trim());
    onClose();
  };

  return (
    <Modal open={open} title="Intersection: Arc × Arc" onClose={onClose}>
      <label>Name</label><input value={name} onChange={e=>setName(e.target.value)} />
      <label>Arc 1</label>
      <select value={String(a1 ?? '')} onChange={e=>setA1(Number(e.target.value))}>
        <option value="">Select arc</option>
        {arcs.map(a=>{
          const c=points.find(p=>p.id===a.center)!; const s=points.find(p=>p.id===a.start)!; const e=points.find(p=>p.id===a.end)!;
          return <option key={a.id} value={a.id}>C:{c.name} S:{s.name} E:{e.name} {a.ccw?'CCW':'CW'}</option>;
        })}
      </select>
      <label>Arc 2</label>
      <select value={String(a2 ?? '')} onChange={e=>setA2(Number(e.target.value))}>
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
