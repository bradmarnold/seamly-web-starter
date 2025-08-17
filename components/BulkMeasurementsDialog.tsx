'use client';
import { useEffect, useMemo, useState } from 'react';
import { Modal } from './Modal';

type Props = {
  open: boolean;
  onClose: () => void;
  onApply: (entries: Record<string, number>) => void;
};

type ParsedLine = { key: string; value: number } | { error: string };

function parseLine(line: string): ParsedLine | null {
  const raw = line.trim();
  if (!raw) return null;

  // Try split by = or : or comma
  let m = raw.match(/^([^=:\,]+)[=:\,]\s*([-+]?\d+(\.\d+)?)\s*$/);
  if (m) return { key: m[1].trim().replace(/\s+/g, '_'), value: Number(m[2]) };

  // Try "name number"
  m = raw.match(/^([A-Za-z0-9_\-\s]+)\s+([-+]?\d+(\.\d+)?)\s*$/);
  if (m) return { key: m[1].trim().replace(/\s+/g, '_'), value: Number(m[2]) };

  // CSV row with two columns (name,value)
  const csv = raw.split(',').map(s => s.trim());
  if (csv.length === 2 && /^[-+]?\d+(\.\d+)?$/.test(csv[1])) {
    return { key: csv[0].replace(/\s+/g, '_'), value: Number(csv[1]) };
  }

  return { error: `Unrecognized format: "${raw}"` };
}

export default function BulkMeasurementsDialog({ open, onClose, onApply }: Props) {
  const [text, setText] = useState('');
  const parsed = useMemo(() => {
    const lines = text.split(/\r?\n/);
    const entries: Record<string, number> = {};
    const errors: string[] = [];
    let count = 0;
    for (const ln of lines) {
      const r = parseLine(ln);
      if (!r) continue;
      if ('error' in r) { errors.push(r.error); continue; }
      if (!r.key) { errors.push('Missing name'); continue; }
      if (!Number.isFinite(r.value)) { errors.push(`Non-numeric value for ${r.key}`); continue; }
      entries[r.key] = r.value; // overwrite duplicates
      count++;
    }
    return { entries, errors, count, keys: Object.keys(entries) };
  }, [text]);

  const apply = () => {
    if (!parsed.keys.length) return;
    onApply(parsed.entries);
  };

  useEffect(() => { if (!open) setText(''); }, [open]);

  return (
    <Modal open={open} title="Bulk add measurements" onClose={onClose}>
      <p style={{color:'#6b7280', marginTop:0}}>
        Paste one per line. Accepted examples:
      </p>
      <ul style={{marginTop:6, color:'#6b7280'}}>
        <li><code>bust=92</code></li>
        <li><code>waist: 76</code></li>
        <li><code>hip 99</code></li>
        <li><code>back_length, 40</code></li>
      </ul>

      <textarea
        value={text}
        onChange={e=>setText(e.target.value)}
        rows={10}
        style={{width:'100%', fontFamily:'monospace'}}
        placeholder="bust=92\nwaist: 76\nhip 99\nback_length, 40"
      />

      <div style={{marginTop:8}}>
        <strong>Preview:</strong>{' '}
        <span className="mono">
          {parsed.keys.length} to add
          {parsed.errors.length ? ` — ${parsed.errors.length} errors` : ''}
        </span>
        {parsed.keys.length ? (
          <ul className="list" style={{marginTop:6, maxHeight:140, overflow:'auto'}}>
            {parsed.keys.slice(0,10).map(k => (
              <li key={k} style={{display:'flex', gap:8}}>
                <span style={{width:180, color:'#6b7280'}}>{k}</span>
                <span>{parsed.entries[k]}</span>
              </li>
            ))}
            {parsed.keys.length > 10 ? <li>…and {parsed.keys.length - 10} more</li> : null}
          </ul>
        ) : null}

        {parsed.errors.length ? (
          <details style={{marginTop:6}}>
            <summary style={{cursor:'pointer'}}>Show errors</summary>
            <ul className="list" style={{marginTop:6, color:'#ef4444'}}>
              {parsed.errors.map((e,i)=><li key={i}>{e}</li>)}
            </ul>
          </details>
        ) : null}
      </div>

      <div className="actions">
        <button onClick={onClose}>Cancel</button>
        <button disabled={!parsed.keys.length} onClick={apply}>
          Add {parsed.keys.length} measurements
        </button>
      </div>
    </Modal>
  );
}
