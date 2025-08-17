'use client';
import { useState } from 'react';
import { Modal } from './Modal';
import { useDraftStore } from '@/lib/store';

export default function SplineDialog({ open, onClose }:{ open:boolean; onClose:()=>void }){
  const { points, addSplineFromAnchors } = useDraftStore(s=>s);
  const [sel, setSel] = useState<number[]>([]);
  const [pick, setPick] = useState<number|undefined>();

  const add = () => { if(pick!=null && !sel.includes(pick)) setSel([...sel, pick]); };
  const removeLast = () => setSel(sel.slice(0,-1));
  const clear = () => setSel([]);
  const create = () => { if(sel.length>=2){ addSplineFromAnchors(sel); onClose(); } };

  return (
    <Modal open={open} title="Spline through points" onClose={onClose}>
      <p style={{color:'#a1a1aa'}}>Pick existing points in order; we’ll draw a smooth curve through them.</p>
      <label>Choose next anchor</label>
      <select value={String(pick ?? '')} onChange={e=>setPick(Number(e.target.value))}>
        <option value="">Select point</option>
        {points.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
      </select>
      <div style={{display:'flex', gap:8, margin:'8px 0'}}>
        <button onClick={add}>Add</button>
        <button onClick={removeLast} disabled={!sel.length}>Remove last</button>
        <button onClick={clear} disabled={!sel.length}>Clear</button>
      </div>
      <div>
        <strong>Anchors:</strong> {sel.map(id=> points.find(p=>p.id===id)?.name).join(' → ') || '(none)'}
      </div>
      <div className="actions">
        <button onClick={onClose}>Cancel</button>
        <button onClick={create} disabled={sel.length<2}>Create spline</button>
      </div>
    </Modal>
  );
}
