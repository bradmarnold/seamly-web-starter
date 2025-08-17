'use client';
import { useState } from 'react';
import { Modal } from './Modal';
import { useDraftStore } from '@/lib/store';

export default function ArcCSEDialog({ open, onClose }:{ open:boolean; onClose:()=>void }){
  const { points, addArcCSE } = useDraftStore(s=>s);
  const [centerId, setCenterId] = useState<number|undefined>();
  const [startId, setStartId] = useState<number|undefined>();
  const [endId, setEndId] = useState<number|undefined>();
  const [ccw, setCcw] = useState(true);

  const submit = () => {
    if(centerId==null || startId==null || endId==null) return;
    if(centerId===startId || centerId===endId || startId===endId) { alert('Pick three distinct points'); return; }
    addArcCSE(centerId, startId, endId, ccw);
    onClose();
  };

  const opts = points.map(p=> <option key={p.id} value={p.id}>{p.name}</option>);
  return (
    <Modal open={open} title="Arc — Center, Start, End" onClose={onClose}>
      <label>Center</label>
      <select value={String(centerId ?? '')} onChange={e=>setCenterId(Number(e.target.value))}>
        <option value="">Select</option>{opts}
      </select>
      <label>Start</label>
      <select value={String(startId ?? '')} onChange={e=>setStartId(Number(e.target.value))}>
        <option value="">Select</option>{opts}
      </select>
      <label>End</label>
      <select value={String(endId ?? '')} onChange={e=>setEndId(Number(e.target.value))}>
        <option value="">Select</option>{opts}
      </select>
      <label>Direction</label>
      <select value={ccw ? 'ccw' : 'cw'} onChange={e=>setCcw(e.target.value==='ccw')}>
        <option value="ccw">Counter-clockwise</option>
        <option value="cw">Clockwise</option>
      </select>
      <div className="actions">
        <button onClick={onClose}>Cancel</button>
        <button onClick={submit}>Create arc</button>
      </div>
    </Modal>
  );
}
