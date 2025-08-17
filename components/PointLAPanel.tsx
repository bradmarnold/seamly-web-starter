'use client';
import { useState } from 'react';
import { useDraftStore } from '@/lib/store';
import { useMeasurements } from '@/lib/measurements';
import { evalExpr } from '@/lib/formula';

export default function PointLAPanel({ onDone }:{ onDone?:()=>void }) {
  const { points, addPointLA } = useDraftStore(s=>s);
  const vars = useMeasurements(s=>s.vars);

  const [name, setName]   = useState('A1');
  const [base, setBase]   = useState<number|undefined>();
  const [len, setLen]     = useState('5');   // formula ok
  const [ang, setAng]     = useState('0');   // formula ok

  const submit = () => {
    if (base==null) return;
    const L = Number(evalExpr(len, vars));
    const A = Number(evalExpr(ang, vars));
    if (!Number.isFinite(L) || !Number.isFinite(A)) { alert('Enter valid numbers/formulas'); return; }
    addPointLA(base, name.trim(), L, A);
    onDone?.();
  };

  return (
    <div style={{padding:'8px 0 0 0'}}>
      <div className="field"><label>Name</label><input value={name} onChange={e=>setName(e.target.value)} /></div>

      <div className="field">
        <label>Base point</label>
        <select value={String(base ?? '')} onChange={e=>setBase(Number(e.target.value))}>
          <option value="">Select point</option>
          {points.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </div>

      <div className="field"><label>Length (formula ok)</label><input value={len} onChange={e=>setLen(e.target.value)} /></div>
      <div className="field"><label>Angle° (formula ok)</label><input value={ang} onChange={e=>setAng(e.target.value)} /></div>

      <div style={{display:'flex', gap:8, marginTop:8}}>
        <button onClick={onDone}>Cancel</button>
        <button onClick={submit}>OK</button>
      </div>
    </div>
  );
}
