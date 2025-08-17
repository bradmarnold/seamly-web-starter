'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useMeasurements } from '@/lib/measurements';

type MsFile = {
  id: string;
  name: string;
  units: 'centimeters'|'millimeters'|'inches';
  vars: Record<string, number>;
};

type MsDB = { activeId: string|null; files: MsFile[] };

const loadDB = (): MsDB => {
  if (typeof window === 'undefined') return { activeId:null, files:[] };
  try { return JSON.parse(localStorage.getItem('ms_files_v1') || '{"activeId":null,"files":[]}') as MsDB; }
  catch { return { activeId:null, files:[] }; }
};

const saveDB = (db: MsDB) => {
  localStorage.setItem('ms_files_v1', JSON.stringify(db));
};

export default function MeasurementsPage(){
  const [db, setDb] = useState<MsDB>({ activeId:null, files:[] });
  const [selId, setSelId] = useState<string|undefined>(undefined);
  const [newKey, setNewKey] = useState('');
  const [newVal, setNewVal] = useState('');

  const setActiveInDraft = useMeasurements(s=>s.loadJSON);

  useEffect(()=>{ setDb(loadDB()); }, []);

  const selected = useMemo(()=> db.files.find(f=>f.id===selId), [db, selId]);

  const createFile = () => {
    const name = prompt('Measurement file name?', 'My measurements');
    if(!name) return;
    const units: MsFile['units'] = 'centimeters';
    const file: MsFile = { id: Math.random().toString(36).slice(2), name, units, vars: {} };
    const next = { ...db, files: [...db.files, file] };
    setDb(next); saveDB(next); setSelId(file.id);
  };

  const renameFile = () => {
    if(!selected) return;
    const name = prompt('New name', selected.name) ?? selected.name;
    const next = { ...db, files: db.files.map(f=> f.id===selected.id ? { ...f, name } : f) };
    setDb(next); saveDB(next);
  };

  const deleteFile = () => {
    if(!selected) return;
    if(!confirm(`Delete "${selected.name}"?`)) return;
    const nextFiles = db.files.filter(f=>f.id!==selected.id);
    const nextActive = db.activeId === selected.id ? null : db.activeId;
    const next = { activeId: nextActive, files: nextFiles };
    setDb(next); saveDB(next); setSelId(undefined);
  };

  const setActive = () => {
    if(!selected) return;
    const next = { ...db, activeId: selected.id };
    setDb(next); saveDB(next);
    // push into Draft measurement store
    setActiveInDraft(selected.vars);
    alert(`Active measurements set to "${selected.name}"`);
  };

  const addVar = () => {
    if(!selected) return;
    if(!newKey) return;
    const v = Number(newVal);
    if(!Number.isFinite(v)) { alert('Enter a number'); return; }
    const file = { ...selected, vars: { ...selected.vars, [newKey]: v } };
    const next = { ...db, files: db.files.map(f=> f.id===file.id ? file : f) };
    setDb(next); saveDB(next);
    setNewKey(''); setNewVal('');
  };

  const updateVar = (k: string, v: string) => {
    if(!selected) return;
    const num = Number(v);
    if(!Number.isFinite(num)) return;
    const file = { ...selected, vars: { ...selected.vars, [k]: num } };
    const next = { ...db, files: db.files.map(f=> f.id===file.id ? file : f) };
    setDb(next); saveDB(next);
  };

  const delVar = (k: string) => {
    if(!selected) return;
    const { [k]:_, ...rest } = selected.vars;
    const file = { ...selected, vars: rest };
    const next = { ...db, files: db.files.map(f=> f.id===file.id ? file : f) };
    setDb(next); saveDB(next);
  };

  const exportFile = () => {
    if(!selected) return;
    const blob = new Blob([JSON.stringify(selected, null, 2)], { type:'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href=url; a.download=`${selected.name}.ms.json`; a.click(); URL.revokeObjectURL(url);
  };

  const importFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const obj = JSON.parse(String(reader.result)) as MsFile;
        if(!obj.id) obj.id = Math.random().toString(36).slice(2);
        const next = { ...db, files: [...db.files, obj] };
        setDb(next); saveDB(next); setSelId(obj.id);
      } catch(e:any) {
        alert('Invalid JSON');
      }
    };
    reader.readAsText(file);
  };
  const fileInputRef = useRef<HTMLInputElement|null>(null);

  return (
    <main className="container">
      <div className="header" style={{marginBottom:12}}>
        <div className="brand">Measurement Files</div>
        <div className="spacer" />
        <Link href="/" style={{textDecoration:'underline'}}>Home</Link>
        <Link href="/draft" style={{marginLeft:12, textDecoration:'underline'}}>Draft</Link>
      </div>

      <div className="grid">
        <div className="panel">
          <h2>Files</h2>
          <div className="body">
            <div style={{display:'flex', gap:8, marginBottom:8}}>
              <button onClick={createFile}>New file</button>
              <button onClick={()=>fileInputRef.current?.click()}>Import JSON</button>
              <input ref={fileInputRef} type="file" accept="application/json" style={{display:'none'}}
                     onChange={e=>{ const f=e.target.files?.[0]; if(f) importFile(f); e.currentTarget.value=''; }} />
            </div>
            <ul className="list">
              {db.files.map(f=>(
                <li key={f.id} style={{display:'flex', justifyContent:'space-between', alignItems:'center', cursor:'pointer'}}
                    onClick={()=>setSelId(f.id)}>
                  <span>{f.name} {db.activeId===f.id ? <em style={{color:'#a1a1aa'}}>(active)</em> : null}</span>
                  <span className="mono" style={{color:'#a1a1aa'}}>{f.units}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="panel">
          <h2>Editor</h2>
          <div className="body">
            {!selected ? (
              <p style={{color:'#a1a1aa'}}>Select or create a file.</p>
            ) : (
              <>
                <div style={{display:'flex', gap:8, flexWrap:'wrap', marginBottom:8}}>
                  <button onClick={renameFile}>Rename</button>
                  <button onClick={setActive}>Use in Draft</button>
                  <button onClick={exportFile}>Export JSON</button>
                  <button onClick={deleteFile} style={{background:'#f43f5e'}}>Delete</button>
                </div>
                <div style={{display:'flex', gap:8, alignItems:'center', marginBottom:8}}>
                  <span style={{color:'#a1a1aa'}}>Name:</span> <span>{selected.name}</span>
                  <span style={{width:16}} />
                  <span style={{color:'#a1a1aa'}}>Units:</span>
                  <select
                    value={selected.units}
                    onChange={e=>{
                      const u = e.target.value as MsFile['units'];
                      const next = { ...db, files: db.files.map(f=> f.id===selected.id ? { ...f, units:u } : f) };
                      setDb(next); saveDB(next);
                    }}
                  >
                    <option value="centimeters">Centimeters</option>
                    <option value="millimeters">Millimeters</option>
                    <option value="inches">Inches</option>
                  </select>
                </div>

                <div style={{display:'flex', gap:8, marginBottom:8}}>
                  <input placeholder="measure name (e.g. bust)" value={newKey} onChange={e=>setNewKey(e.target.value)} />
                  <input placeholder="value (e.g. 92)" value={newVal} onChange={e=>setNewVal(e.target.value)} />
                  <button onClick={addVar}>Add</button>
                </div>

                <ul className="list">
                  {Object.entries(selected.vars).map(([k,v])=>(
                    <li key={k} style={{display:'flex', gap:8, alignItems:'center'}}>
                      <div style={{width:160, color:'#a1a1aa'}}>{k}</div>
                      <input style={{width:120}} value={String(v)} onChange={e=>updateVar(k, e.target.value)} />
                      <button onClick={()=>delVar(k)} style={{background:'#f59e0b'}}>Remove</button>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
