'use client';
import { useEffect, useState } from 'react';
import { useDraftStore } from '@/lib/store';
import { useMeasurements } from '@/lib/measurements';
import { evalExpr } from '@/lib/formula';
import { Modal } from './Modal';

export default function PointLADialog({
  open, onClose,
  baseId, defaultLen, defaultAng
}:{ open:boolean; onClose:()=>void; baseId:number|undefined; defaultLen:number; defaultAng:number; }){
  const { points, addPointLA } = useDraftStore(s=>s);
  const vars = useMeasurements(s=>s.vars);
  const [name, setName] = useState('A1');
  const [base, setBase] = useState<number|undefined>(baseId);
  const [len, setLen] = useState(String(defaultLen.toFixed(2)));
  const [ang, setAng] = useState(String(defaultAng.toFixed(1)));

  useEffect(()=>{ setBase(baseId); setLen(String(defaultLen.toFixed(2))); setAng(String(defaultAng.toFixed(1))); }, [baseId, defaultLen, defaultAng]);

  const submit = () => {
    if (base==null) return;
    const L = Number(evalExpr(len, vars));
    const A = Number(evalExpr(ang, vars));
    if (!Number.isFinite(L) || !Number.isFinite(A)) { alert('Enter valid numbers/formulas'); return; }
    addPointLA(base, name.trim(), L, A);
    onClose();
  };

  return (
    <Modal open={open} title="Point — Length & Angle" onClose={onClose}>
      <div className="field"><label>Name</label><input value={name} onChange={e=>setName(e.target.value)} /></div>

      <div className="field">
        <label>Base point</label>
        <select value={String(base ?? '')} onChange={e=>setBase(Number(e.target.value))}>
          <option value="">Select point</option>
          {points.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </div>

      <div className="field"><label>Length (formula ok)</label><input value={len} onChange={e=>setLen(e.target.value)} /></div>
      <div className="field"><label>Angle ° (formula ok)</label><input value={ang} onChange={e=>setAng(e.target.value)} /></div>

      <div style={{display:'flex', gap:8, marginTop:8}}>
        <button onClick={onClose}>Cancel</button>
        <button onClick={submit}>OK</button>
      </div>
    </Modal>
  );
}
