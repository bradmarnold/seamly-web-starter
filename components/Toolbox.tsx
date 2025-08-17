'use client';
import { type ToolMode } from './DraftingCanvas';

type Props = {
  mode: ToolMode;
  setMode: (m:ToolMode)=>void;
};

export default function Toolbox({mode, setMode}: Props){
  const Section: React.FC<{title:string; children:any}> =
    ({title, children}) => (
    <div style={{borderBottom:'1px solid var(--border)', padding:'4px 0 10px 0'}}>
      <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', fontWeight:600, color:'var(--text)', padding:'6px 2px'}}>
        <span>{title}</span>
      </div>
      <div style={{paddingLeft:2}}>{children}</div>
    </div>
  );
  const Btn: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement>> = ({children, ...btn}) => (
    <button {...btn} style={{display:'block', width:'100%', textAlign:'left', margin:'4px 0', padding:'6px 8px', background:'var(--card)', color:'var(--text)', border:'1px solid var(--border)'}}>{children}</button>
  );
  const mark = (m:ToolMode) => mode===m ? '● ' : '  ';

  return (
    <aside style={{ width:260, background:'var(--panel-bg)', borderRight:'1px solid var(--border)', padding:'10px 10px 80px', overflow:'auto' }}>
      <h3 style={{margin:'2px 2px 8px', color:'var(--text)'}}>Toolbox</h3>

      <Section title="Point">
        <Btn onClick={()=>setMode('pointLA')}>{mark('pointLA')}Point: Length & Angle</Btn>
        <Btn onClick={()=>setMode('pointOnLine')}>{mark('pointOnLine')}Point: Along Line</Btn>
        <Btn onClick={()=>setMode('perpFoot')}>{mark('perpFoot')}Point: Perpendicular Foot</Btn>
        <Btn onClick={()=>setMode('fromLineAngle')}>{mark('fromLineAngle')}Point: From Line & Angle</Btn>
        <Btn onClick={()=>setMode('midpoint')}>{mark('midpoint')}Point: Midpoint of Segment</Btn>
        <Btn onClick={()=>setMode('divideSegment')}>{mark('divideSegment')}Point: Divide Segment</Btn>
      </Section>

      <Section title="Line">
        <Btn onClick={()=>setMode('lineBetween')}>{mark('lineBetween')}Line: Between Points</Btn>
        <Btn onClick={()=>setMode('move')}>{mark('move')}Edit: Move Point</Btn>
        <Btn onClick={()=>setMode('measure')}>{mark('measure')}Tools: Measure</Btn>
        <Btn onClick={()=>setMode('pan')}>{mark('pan')}View: Pan</Btn>
      </Section>

      <Section title="Arc / Curve">
        <Btn onClick={()=>setMode('splinePath')}>{mark('splinePath')}Curve: Spline Path (Catmull–Rom)</Btn>
        <Btn onClick={()=>setMode('editPath')}>{mark('editPath')}Edit: Path Anchors</Btn>
      </Section>
    </aside>
  );
}
