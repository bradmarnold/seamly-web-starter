'use client';
import { type ToolMode } from './DraftingCanvas';

type Props = {
  // modal openers for other tools
  openPOL: () => void;
  openPerpFoot: () => void;
  openPar: () => void;
  openPerpThrough: () => void;
  openFLA: () => void;
  openMid: () => void;
  openDiv: () => void;
  openArcCSE: () => void;
  openLxA: () => void;
  openAxA: () => void;
  openSpline: () => void;

  mode: ToolMode;
  setMode: (m:ToolMode)=>void;
};

import { useState } from 'react';

export default function Toolbox(props: Props){
  const [openPoint, setOpenPoint] = useState(true);
  const [openLine, setOpenLine]   = useState(true);
  const [openCurve, setOpenCurve] = useState(false);
  const [openInter, setOpenInter] = useState(false);

  const Section: React.FC<{title:string; open:boolean; setOpen:(v:boolean)=>void; children:any}> =
    ({title, open, setOpen, children}) => (
    <div style={{borderBottom:'1px solid var(--border)', padding:'4px 0 10px 0'}}>
      <div
        onClick={()=>setOpen(!open)}
        style={{display:'flex', justifyContent:'space-between', alignItems:'center', cursor:'pointer', fontWeight:600, color:'var(--text)', padding:'6px 2px'}}
      >
        <span>{title}</span><span style={{opacity:0.7, fontSize:12}}>{open?'▾':'▸'}</span>
      </div>
      {open && <div style={{paddingLeft:2}}>{children}</div>}
    </div>
  );

  const Btn: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement>> = ({children, ...btn}) => (
    <button {...btn} style={{display:'block', width:'100%', textAlign:'left', margin:'4px 0', padding:'6px 8px', background:'var(--card)', color:'var(--text)', border:'1px solid var(--border)'}}>{children}</button>
  );

  const mark = (m:ToolMode) => props.mode===m ? '● ' : '  ';

  return (
    <aside style={{
      width:260, background:'var(--panel-bg)', borderRight:'1px solid var(--border)',
      padding:'10px 10px 80px', overflow:'auto'
    }}>
      <h3 style={{margin:'2px 2px 8px', color:'var(--text)'}}>Toolbox</h3>

      <Section title="Point" open={openPoint} setOpen={setOpenPoint}>
        <Btn onClick={()=>props.setMode('pointLA')}>{mark('pointLA')}Point: Length & Angle</Btn>
        <Btn onClick={props.openPOL}>Point: Along Line</Btn>
        <Btn onClick={props.openPerpFoot}>Point: Perpendicular Foot</Btn>
        <Btn onClick={props.openPar}>Point: Parallel Through Point</Btn>
        <Btn onClick={props.openPerpThrough}>Point: Perpendicular Through Point</Btn>
        <Btn onClick={props.openFLA}>Point: From Line & Angle</Btn>
        <Btn onClick={props.openMid}>Point: Midpoint of Segment</Btn>
        <Btn onClick={props.openDiv}>Point: Divide Segment</Btn>
      </Section>

      <Section title="Line" open={openLine} setOpen={setOpenLine}>
        <Btn onClick={()=>props.setMode('lineBetween')}>{mark('lineBetween')}Line: Between Points</Btn>
        <Btn onClick={()=>props.setMode('move')}>{mark('move')}Edit: Move Point</Btn>
        <Btn onClick={()=>props.setMode('measure')}>{mark('measure')}Tools: Measure</Btn>
        <Btn onClick={()=>props.setMode('pan')}>{mark('pan')}View: Pan</Btn>
      </Section>

      <Section title="Arc / Curve" open={openCurve} setOpen={setOpenCurve}>
        <Btn onClick={props.openArcCSE}>Arc: Center–Start–End</Btn>
        <Btn onClick={props.openSpline}>Curve: Spline Path</Btn>
      </Section>

      <Section title="Intersections" open={openInter} setOpen={setOpenInter}>
        <Btn onClick={props.openLxA}>Intersection: Line × Arc</Btn>
        <Btn onClick={props.openAxA}>Intersection: Arc × Arc</Btn>
      </Section>
    </aside>
  );
}
