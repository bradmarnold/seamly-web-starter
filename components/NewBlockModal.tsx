'use client';
import { useState } from 'react';
import { Modal } from './Modal';
import { useDraftStore } from '@/lib/store';

export default function NewBlockModal({ open, onClose }:{ open:boolean; onClose:()=>void }) {
  const createBlock = useDraftStore(s => s.createBlock);
  const [name, setName] = useState('Draft block 1');
  const [units, setUnits] = useState<'centimeters'|'millimeters'|'inches'>('centimeters');

  const submit = () => {
    createBlock(name, units);
    onClose();
  };

  return (
    <Modal open={open} title="New pattern" onClose={onClose}>
      <label>Draft block name</label>
      <input value={name} onChange={e=>setName(e.target.value)} />
      <label>Units</label>
      <select value={units} onChange={e=>setUnits(e.target.value as any)}>
        <option value="centimeters">Centimeters</option>
        <option value="millimeters">Millimeters</option>
        <option value="inches">Inches</option>
      </select>
      <div className="actions">
        <button onClick={onClose}>Cancel</button>
        <button onClick={submit}>OK</button>
      </div>
    </Modal>
  );
}
