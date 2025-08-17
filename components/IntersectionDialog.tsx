'use client';
import { useState } from 'react';
import { Modal } from './Modal';
import { useDraftStore } from '@/lib/store';

export default function IntersectionDialog({ open, onClose }:{ open:boolean; onClose:()=>void }){
  const { segs, points, addIntersectionOfLines } = useDraftStore(s=>s);
  const lines = segs.filter(s=>s.kind==='line');
  const [name, setName] = useState('X');
  const [id1, setId1] = useState<number|undefined>();
  const [id2, setId2] = useState<number|undefined>();

  const submit = () => {
    if(id1==null || id2==null) return;
    try { addIntersectionOfLines(id1, id2, name.trim()); onClose(); }
    catch(e:any){ alert(e.message || 'Cannot intersect'); }
  };

  return (
    <Modal open={open} title="Intersection of two lines" onClose={onClose}>
      <label>Name</label>
      <input value={name} onChange={e=>setName(e.target.value)} />
      <label>Line 1</label>
      <select value={String(id1 ?? '')} onChange={e=>setId1(Number(e.target.value))}>
        <option value="">Pick a line</option>
        {lines.map(l=>{
          const a = points.find(p=>p.id===l.a)!; const b = points.find(p=>p.id===l.b)!;
          return <option key={l.id} value={l.id}>{a.name}–{b.name}</option>;
        })}
      </select>
      <label>Line 2</label>
      <select value={String(id2 ?? '')} onChange={e=>setId2(Number(e.target.value))}>
        <option value="">Pick a line</option>
        {lines.map(l=>{
          const a = points.find(p=>p.id===l.a)!; const b = points.find(p=>p.id===l.b)!;
          return <option key={l.id} value={l.id}>{a.name}–{b.name}</option>;
        })}
      </select>
      <div className="actions">
        <button onClick={onClose}>Cancel</button>
        <button onClick={submit}>Create point</button>
      </div>
    </Modal>
  );
}
