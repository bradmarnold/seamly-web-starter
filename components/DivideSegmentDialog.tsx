'use client';
import { useState } from 'react';
import { useDraftStore } from '@/lib/store';
import { Modal } from './Modal';

export default function DivideSegmentDialog({ open, onClose }:{ open:boolean; onClose:()=>void }) {
  const { points, addDivideSegment } = useDraftStore(s=>s);
  const [name, setName] = useState('D');
  const [a, setA] = useState<number|undefined>();
  const [b, setB] = useState<number|undefined>();
  const [k, setK] = useState('1');
  const [n, setN] = useState('2');

  const submit = () => {
    if (a==null || b==null) return;
    const kk = Number(k), nn = Number(n);
    if (!Number.isFinite(kk) || !Number.isFinite(nn) || nn===0) { alert('Enter k and n (n≠0)'); return; }
    addDivideSegment(a, b, kk, nn, name.trim() || 'D');
    onClose();
  };

  return (
    <Modal open={open} title="Point — Divide Segment (k/n)" onClose={onClose}>
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
      <div className="field"><label>k</label><input value={k} onChange={e=>setK(e.target.value)} /></div>
      <div className="field"><label>n</label><input value={n} onChange={e=>setN(e.target.value)} /></div>
      <div style={{display:'flex', gap:8, marginTop:8}}>
        <button onClick={onClose}>Cancel</button>
        <button onClick={submit}>OK</button>
      </div>
    </Modal>
  );
}
