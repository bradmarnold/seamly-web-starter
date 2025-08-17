'use client';
import { useState } from 'react';
import { useDraftStore } from '@/lib/store';
import { Modal } from './Modal';

export default function PointOnLineDialog({ open, onClose }:{ open:boolean; onClose:()=>void }) {
  const { points, addPointOnLine } = useDraftStore(s=>s);
  const [name, setName] = useState('P1');
  const [a, setA] = useState<number|undefined>();
  const [b, setB] = useState<number|undefined>();
  const [dist, setDist] = useState('10');

  const submit = () => {
    if (a==null || b==null) return;
    const d = Number(dist);
    if (!Number.isFinite(d)) { alert('Enter a distance'); return; }
    addPointOnLine(a, b, name.trim() || 'P', d);
    onClose();
  };

  return (
    <Modal open={open} title="Point — Along Line" onClose={onClose}>
      <div className="field"><label>Name</label><input value={name} onChange={e=>setName(e.target.value)} /></div>
      <div className="field">
        <label>Line: A</label>
        <select value={String(a??'')} onChange={e=>setA(Number(e.target.value))}>
          <option value="">Select</option>
          {points.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </div>
      <div className="field">
        <label>Line: B</label>
        <select value={String(b??'')} onChange={e=>setB(Number(e.target.value))}>
          <option value="">Select</option>
          {points.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </div>
      <div className="field"><label>Distance from A</label><input value={dist} onChange={e=>setDist(e.target.value)} /></div>
      <div style={{display:'flex', gap:8, marginTop:8}}>
        <button onClick={onClose}>Cancel</button>
        <button onClick={submit}>OK</button>
      </div>
    </Modal>
  );
}
