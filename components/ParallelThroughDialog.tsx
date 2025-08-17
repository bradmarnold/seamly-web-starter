'use client';
import { useState } from 'react';
import { Modal } from './Modal';
import { useDraftStore } from '@/lib/store';
import { useMeasurements } from '@/lib/measurements';
import { evalExpr } from '@/lib/formula';

export default function ParallelThroughDialog({ open, onClose }:{ open:boolean; onClose:()=>void }){
  const { points, addPointParallelThrough } = useDraftStore(s=>s);
  const vars = useMeasurements(s=>s.vars);
  const [name, setName] = useState('P');
  const [through, setThrough] = useState<number|undefined>();
  const [refA, setRefA] = useState<number|undefined>();
  const [refB, setRefB] = useState<number|undefined>();
  const [len, setLen] = useState('10');

  const submit = () => {
    if(through==null || refA==null || refB==null) return;
    const L = Number(evalExpr(len, vars)); if(!Number.isFinite(L)) { alert('Length'); return; }
    addPointParallelThrough(through, refA, refB, name.trim(), L);
    onClose();
  };

  return (
    <Modal open={open} title="Parallel through point" onClose={onClose}>
      <label>Name</label><input value={name} onChange={e=>setName(e.target.value)} />
      <label>Through point</label>
      <select value={String(through ?? '')} onChange={e=>setThrough(Number(e.target.value))}>
        <option value="">Select point</option>
        {points.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
      </select>
      <label>Reference line A–B</label>
      <div style={{display:'flex', gap:8}}>
        <select value={String(refA ?? '')} onChange={e=>setRefA(Number(e.target.value))}>
          <option value="">A</option>{points.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <select value={String(refB ?? '')} onChange={e=>setRefB(Number(e.target.value))}>
          <option value="">B</option>{points.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </div>
      <label>Length (formula ok)</label><input value={len} onChange={e=>setLen(e.target.value)} />
      <div className="actions"><button onClick={onClose}>Cancel</button><button onClick={submit}>OK</button></div>
    </Modal>
  );
}
