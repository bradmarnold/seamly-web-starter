'use client';
import { useState } from 'react';
import type { Tutorial } from '@/lib/tutorials';

export function TutorialPanel({ tutorial }: { tutorial: Tutorial }) {
  const [step, setStep] = useState(0);
  const s = tutorial.steps[step];

  return (
    <div>
      <h3 style={{marginTop:0}}>{tutorial.title}</h3>
      <p style={{color:'#a1a1aa'}}>{tutorial.summary}</p>
      <div className="badge">Step {step+1} of {tutorial.steps.length}</div>
      <p style={{whiteSpace:'pre-wrap'}}>{s.text}</p>
      <div className="menu" style={{marginTop:12}}>
        <button disabled={step===0} onClick={() => setStep(step-1)}>Back</button>
        <button disabled={step===tutorial.steps.length-1} onClick={() => setStep(step+1)}>Next</button>
      </div>
    </div>
  );
}
