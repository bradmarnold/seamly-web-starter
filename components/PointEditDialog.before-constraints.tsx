'use client';
import { useEffect, useMemo, useState } from 'react';
import { Modal } from './Modal';
import { useDraftStore } from '@/lib/store';

export default function PointEditDialog({ open, pointId, onClose }:{ open:boolean; pointId:number|undefined; onClose:()=>void }){
  const { points, updatePoint, setPointName } = useDraftStore(s=>s);
  const pt = useMemo(()=> points.find(p=>p.id===pointId), [points, pointId]);

  const [name, setName] = useState('');
  const [x, setX] = useState<string>('0');
  const [y, setY] = useState<string>('0');

  useEffect(()=>{
    if(pt){
      setName(pt.name);
      setX(String(pt.x));
      setY(String(pt.y));
    }
  }, [pt]);

  const submit = () => {
    if(!pt) return;
    const nx = Number(x), ny = Number(y);
    if(!Number.isFinite(nx) || !Number.isFinite(ny)) { alert('Enter numeric X/Y.'); return; }
    setPointName(pt.id, name.trim() || pt.name);
    updatePoint(pt.id, { x: nx, y: ny });
    onClose();
  };

  return (
    <Modal open={open} title={pt ? `Edit point ${pt.name}` : 'Edit point'} onClose={onClose}>
      <label>Name</label>
      <input value={name} onChange={e=>setName(e.target.value)} />
      <div className="row">
        <div>
          <label>X</label>
          <input value={x} onChange={e=>setX(e.target.value)} />
        </div>
        <div>
          <label>Y</label>
          <input value={y} onChange={e=>setY(e.target.value)} />
        </div>
      </div>
      <div className="actions">
        <button onClick={onClose}>Cancel</button>
        <button onClick={submit}>Save</button>
      </div>
    </Modal>
  );
}
