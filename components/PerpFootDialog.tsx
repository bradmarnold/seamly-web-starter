'use client';
import { useState } from 'react';
import { useDraftStore } from '@/lib/store';
import { Modal } from './Modal';

export default function PerpFootDialog({ open, onClose }:{ open:boolean; onClose:()=>void }) {
  const { points, addPerpFoot } = useDraftStore(s=>s);
  const [name, setName] = useState('F');
  const [p, setP] = useState<number|undefined>();
  const [a, setA] = useState<number|undefined>();
  const [b, setB] = useState<number|undefined>();

  const submit = () => {
    if (p==null || a==null || b==null) return;
    addPerpFoot(p, a, b, name.trim() || 'F');
    onClose();
  };

  return (
    <Modal open={open} title="Point — Perpendicular Foot" onClose={onClose}>
      <div className="field"><label>Name</label><input value={name} onChange={e=>setName(e.target.value)} /></div>
      <div className="field">
        <label>From Point</label>
        <select value={String(p??'')} onChange={e=>setP(Number(e.target.value))}>
          <option value="">Select</option>
          {points.map(pt=><option key={pt.id} value={pt.id}>{pt.name}</option>)}
        </select>
      </div>
      <div className="field">
        <label>To Line: A</label>
        <select value={String(a??'')} onChange={e=>setA(Number(e.target.value))}>
          <option value="">Select</option>
          {points.map(pt=><option key={pt.id} value={pt.id}>{pt.name}</option>)}
        </select>
      </div>
      <div className="field">
        <label>To Line: B</label>
        <select value={String(b??'')} onChange={e=>setB(Number(e.target.value))}>
          <option value="">Select</option>
          {points.map(pt=><option key={pt.id} value={pt.id}>{pt.name}</option>)}
        </select>
      </div>
      <div style={{display:'flex', gap:8, marginTop:8}}>
        <button onClick={onClose}>Cancel</button>
        <button onClick={submit}>OK</button>
      </div>
    </Modal>
  );
}
