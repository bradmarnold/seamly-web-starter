'use client';
import { useEffect, useMemo, useState } from 'react';
import { Modal } from './Modal';
import { useDraftStore } from '@/lib/store';
import { useMeasurements } from '@/lib/measurements';
import { evalExpr } from '@/lib/formula';

export default function PointEditDialog({ open, pointId, onClose }:{ open:boolean; pointId:number|undefined; onClose:()=>void }){
  const { points, setPointName, editPointLA, editPointPOL } = useDraftStore(s=>s);
  const vars = useMeasurements(s=>s.vars);
  const pt = useMemo(()=> points.find(p=>p.id===pointId), [points, pointId]);

  // common
  const [name, setName] = useState('');
  useEffect(()=>{ setName(pt?.name ?? ''); }, [pt]);

  // LA fields
  const [lenStr, setLenStr] = useState('0');
  const [angStr, setAngStr] = useState('0');
  const [baseId, setBaseId] = useState<number|undefined>(undefined);

  // POL fields
  const [distStr, setDistStr] = useState('0');
  const [aId, setAId] = useState<number|undefined>(undefined);
  const [bId, setBId] = useState<number|undefined>(undefined);

  useEffect(()=>{
    if(!pt) return;
    if(pt.constraint?.kind === 'LA'){
      setLenStr(String(pt.constraint.length));
      setAngStr(String(pt.constraint.angle));
      setBaseId(pt.constraint.base);
    } else if (pt.constraint?.kind === 'POL'){
      setDistStr(String(pt.constraint.dist));
      setAId(pt.constraint.a);
      setBId(pt.constraint.b);
    } else {
      setBaseId(undefined); setAId(undefined); setBId(undefined);
    }
  }, [pt]);

  const save = () => {
    if(!pt) return;
    setPointName(pt.id, name.trim() || pt.name);

    if (pt.constraint?.kind === 'LA') {
      const L = Number(evalExpr(lenStr, vars));
      const A = Number(evalExpr(angStr, vars));
      if (!Number.isFinite(L) || !Number.isFinite(A) || baseId==null) { alert('Enter length, angle, and base'); return; }
      if (baseId === pt.id) { alert('Base cannot be the same point.'); return; }
      editPointLA(pt.id, { length: L, angle: A, base: baseId });
      onClose();
      return;
    }

    if (pt.constraint?.kind === 'POL') {
      const D = Number(evalExpr(distStr, vars));
      if (!Number.isFinite(D) || aId==null || bId==null) { alert('Enter distance and choose A & B'); return; }
      if (aId === bId) { alert('Line endpoints must be different'); return; }
      editPointPOL(pt.id, { dist: D, a: aId, b: bId });
      onClose();
      return;
    }

    // unconstrained
    onClose();
  };

  const c = pt?.constraint;
  const pointOptions = points
    .filter(p => p.id !== pt?.id) // avoid self
    .map(p => <option key={p.id} value={p.id}>{p.name}</option>);

  return (
    <Modal open={open} title={pt ? `Edit point ${pt.name}` : 'Edit point'} onClose={onClose}>
      {!pt ? null : (
        <>
          <label>Name</label>
          <input value={name} onChange={e=>setName(e.target.value)} />

          {c?.kind === 'LA' && (
            <>
              <p style={{color:'#a1a1aa', marginTop:6}}>Defined by <b>Length &amp; Angle</b> from base point.</p>
              <label>Base point</label>
              <select value={String(baseId ?? '')} onChange={e=>setBaseId(Number(e.target.value))}>
                <option value="">Select base</option>
                {pointOptions}
              </select>
              <div className="row">
                <div>
                  <label>Length (formula ok)</label>
                  <input value={lenStr} onChange={e=>setLenStr(e.target.value)} />
                </div>
                <div>
                  <label>Angle ° (formula ok)</label>
                  <input value={angStr} onChange={e=>setAngStr(e.target.value)} />
                </div>
              </div>
            </>
          )}

          {c?.kind === 'POL' && (
            <>
              <p style={{color:'#a1a1aa', marginTop:6}}>Defined as <b>Point on Line</b> A→B.</p>
              <div className="row">
                <div>
                  <label>Line — First point (A)</label>
                  <select value={String(aId ?? '')} onChange={e=>setAId(Number(e.target.value))}>
                    <option value="">Select A</option>
                    {pointOptions}
                  </select>
                </div>
                <div>
                  <label>Line — Second point (B)</label>
                  <select value={String(bId ?? '')} onChange={e=>setBId(Number(e.target.value))}>
                    <option value="">Select B</option>
                    {pointOptions}
                  </select>
                </div>
              </div>
              <label>Distance from A (formula ok)</label>
              <input value={distStr} onChange={e=>setDistStr(e.target.value)} />
            </>
          )}

          {!c && (
            <p style={{color:'#a1a1aa', marginTop:6}}>
              This point has no construction. (You can move it with the Move tool.)
            </p>
          )}

          <div className="actions">
            <button onClick={onClose}>Cancel</button>
            <button onClick={save}>Save</button>
          </div>
        </>
      )}
    </Modal>
  );
}
