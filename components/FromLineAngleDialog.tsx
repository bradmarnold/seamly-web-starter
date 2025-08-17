'use client';
import { useState } from 'react';
import { useDraftStore } from '@/lib/store';
import { Modal } from './Modal';

export default function FromLineAngleDialog({ open, onClose }:{ open:boolean; onClose:()=>void }) {
  const { points, addPointFromLineAngle } = useDraftStore(s=>s);
  const [name, setName] = useState('R');
  const [base, setBase] = useState<number|undefined>();
  const [refA, setRefA] = useState<number|undefined>();
  const [refB, setRefB] = useState<number|undefined>();
  const [len, setLen] = useState('10');
  const [offset, setOffset] = useState('0'); // degrees, added to AB direction

  const submit = () => {
    if (base==null || refA==null || refB==null) return;
    const L = Number(len), off = Number(offset);
    if (!Number.isFinite(L) || !Number.isFinite(off)) { alert('Enter numbers'); return; }
    addPointFromLineAngle(base, refA, refB, name.trim() || 'R', L, off);
    onClose();
  };

  return (
    <Modal open={open} title="Point — From Line & Angle" onClose={onClose}>
      <div className="field"><label>Name</label><input value={name} onChange={e=>setName(e.target.value)} /></div>
      <div className="field">
        <label>Base point</label>
        <select value={String(base??'')} onChange={e=>setBase(Number(e.target.value))}>
          <option value="">Select</option>
          {points.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </div>
      <div className="field">
        <label>Reference line: A</label>
        <select value={String(refA??'')} onChange={e=>setRefA(Number(e.target.value))}>
          <option value="">Select</option>
          {points.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </div>
      <div className="field">
        <label>Reference line: B</label>
        <select value={String(refB??'')} onChange={e=>setRefB(Number(e.target.value))}>
          <option value="">Select</option>
          {points.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </div>
      <div className="field"><label>Length</label><input value={len} onChange={e=>setLen(e.target.value)} /></div>
      <div className="field"><label>Angle offset (°)</label><input value={offset} onChange={e=>setOffset(e.target.value)} /></div>
      <div style={{display:'flex', gap:8, marginTop:8}}>
        <button onClick={onClose}>Cancel</button>
        <button onClick={submit}>OK</button>
      </div>
    </Modal>
  );
}
