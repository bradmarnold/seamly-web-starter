'use client';
import { useState } from 'react';
import { useDraftStore } from '@/lib/store';
import { Modal } from './Modal';

export default function MidpointDialog({ open, onClose }:{ open:boolean; onClose:()=>void }) {
  const { points, addMidpoint } = useDraftStore(s=>s);
  const [name, setName] = useState('M');
  const [a, setA] = useState<number|undefined>();
  const [b, setB] = useState<number|undefined>();

  const submit = () => {
    if (a==null || b==null) return;
    addMidpoint(a, b, name.trim() || 'M');
    onClose();
  };

  return (
    <Modal open={open} title="Point — Midpoint of Segment" onClose={onClose}>
      <div className="field"><label>Name</label><input value={name} onChange={e=>setName(e.target.value)} /></div>
      <div className="field">
        <label>Segment: A</label>
        <select value={String(a??'')} onChange={e=>setA(Number(e.target.value))}>
          <option value="">Select</option>
          {points.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </div>
      <div className="field">
        <label>Segment: B</label>
        <select value={String(b??'')} onChange={e=>setB(Number(e.target.value))}>
          <option value="">Select</option>
          {points.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </div>
      <div style={{display:'flex', gap:8, marginTop:8}}>
        <button onClick={onClose}>Cancel</button>
        <button onClick={submit}>OK</button>
      </div>
    </Modal>
  );
}
