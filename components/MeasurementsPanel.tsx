'use client';
import Link from 'next/link';
import { useMeasurements } from '@/lib/measurements';

export default function MeasurementsPanel() {
  const { list, setVar } = useMeasurements();
  const activeName = (typeof window !== 'undefined') ? (JSON.parse(localStorage.getItem('ms_files_v1') || '{"activeId":null,"files":[]}')?.files?.find((f:any)=>f.id===JSON.parse(localStorage.getItem('ms_files_v1') || '{"activeId":null,"files":[]}')?.activeId)?.name ?? null) : null;

  return (
    <div style={{marginTop:12, borderTop:'1px solid #1f2330', paddingTop:12}}>
      <h3 style={{margin:'0 0 8px 0', fontSize:14}}>
        Measurements {activeName ? <span style={{color:'#a1a1aa'}}>— active: {activeName}</span> : null}
      </h3>
      <p style={{margin:'6px 0 10px 0', color:'#a1a1aa'}}>
        Manage files in <Link href="/measurements" style={{textDecoration:'underline'}}>Measurement Files</Link>.
      </p>
      <ul className="list" style={{marginTop:8}}>
        {list.map(m=>(
          <li key={m.key} style={{display:'flex', gap:8, alignItems:'center'}}>
            <div style={{width:140, color:'#a1a1aa'}}>{m.key}</div>
            <input
              value={String(m.value)}
              onChange={e=>setVar(m.key, Number(e.target.value))}
              style={{width:120}}
            />
          </li>
        ))}
      </ul>
      <p className="mono" style={{color:'#a1a1aa'}}>Use in formulas (e.g. <code>bust/4 + 1.5</code>).</p>
    </div>
  );
}
