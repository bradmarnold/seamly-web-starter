'use client';
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { TUTORIALS, getTutorialById } from '@/lib/tutorials';
import { useDraftStore } from '@/lib/store';
import { DraftingCanvas } from '@/components/DraftingCanvas';
import { TutorialPanel } from '@/components/TutorialPanel';

export default function DraftPage() {
  const sp = useSearchParams();
  const tutorialId = sp.get('t') ?? undefined;
  const tutorial = useMemo(() => (tutorialId ? getTutorialById(tutorialId) : null), [tutorialId]);
  const [showTutorial, setShowTutorial] = useState(Boolean(tutorial));
  const reset = useDraftStore(s => s.reset);

  useEffect(() => { reset(); }, [reset]);

  return (
    <main className="container">
      <div className="grid">
        <div className="canvasWrap">
          <div className="toolbar">
            <button onClick={() => reset()}>Reset</button>
            <button onClick={() => setShowTutorial(s => !s)}>{showTutorial ? 'Hide tutorial' : 'Show tutorial'}</button>
          </div>
          <DraftingCanvas />
        </div>
        <div className="panel">
          <h2>Tutorials</h2>
          <div className="body">
            <select
              defaultValue={tutorial?.id ?? ''}
              onChange={(e) => {
                const id = e.target.value;
                const t = id ? getTutorialById(id) : null;
                if (t) { location.href = `/draft?t=${t.id}`; }
              }}
              style={{ width: '100%', padding: 8, background:'#0b0c0f', color:'white', border:'1px solid #1f2330', borderRadius:8 }}
            >
              <option value="">Pick a tutorial</option>
              {TUTORIALS.map(t => <option key={t.id} value={t.id}>{t.title}</option>)}
            </select>
            {showTutorial && tutorial ? (
              <TutorialPanel tutorial={tutorial} />
            ) : (
              <p style={{color:'#a1a1aa'}}>Select a tutorial to see steps here.</p>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
