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

  // POL fields
  const [distStr, setDistStr] = useState('0');

  useEffect(()=>{
    if(!pt) return;
    if(pt.constraint?.kind === 'LA'){
      setLenStr(String(pt.constraint.length));
      setAngStr(String(pt.constraint.angle));
    } else if (pt.constraint?.kind === 'POL'){
      setDistStr(String(pt.constraint.dist));
    }
  }, [pt]);

  const save = () => {
    if(!pt) return;
    setPointName(pt.id, name.trim() || pt.name);

    if (pt.constraint?.kind === 'LA') {
      // evaluate formulas
      const L = Number(evalExpr(lenStr, vars));
      const A = Number(evalExpr(angStr, vars));
      if (!Number.isFinite(L) || !Number.isFinite(A)) { alert('Invalid length/angle'); return; }
      editPointLA(pt.id, { length: L, angle: A });
      onClose();
      return;
    }

    if (pt.constraint?.kind === 'POL') {
      const D = Number(evalExpr(distStr, vars));
      if (!Number.isFinite(D)) { alert('Invalid distance'); return; }
      editPointPOL(pt.id, { dist: D });
      onClose();
      return;
    }

    // unconstrained point: nothing else to do here (name already set)
    onClose();
  };

  const c = pt?.constraint;

  return (
    <Modal open={open} title={pt ? `Edit point ${pt.name}` : 'Edit point'} onClose={onClose}>
      {!pt ? null : (
        <>
          <label>Name</label>
          <input value={name} onChange={e=>setName(e.target.value)} />

          {c?.kind === 'LA' && (
            <>
              <p style={{color:'#a1a1aa', marginTop:6}}>Defined by <b>Length &amp; Angle</b> from base point <code>{points.find(p=>p.id===c.base)?.name ?? c.base}</code>.</p>
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
              <p style={{color:'#a1a1aa', marginTop:6}}>
                Defined as <b>Point on Line</b> <code>{points.find(p=>p.id===c.a)?.name ?? c.a}</code>–<code>{points.find(p=>p.id===c.b)?.name ?? c.b}</code>.
              </p>
              <label>Distance from first point (formula ok)</label>
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
