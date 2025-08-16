import Link from 'next/link';
import { TUTORIALS } from '@/lib/tutorials';

export default function Home() {
  return (
    <main className="container">
      <div className="panel">
        <h2>Welcome</h2>
        <div className="body">
          <p>Start a tutorial from the top bar or open the drafting area.</p>
          <div className="menu" style={{marginTop:12}}>
            <Link href="/draft"><button>Open Drafting Area</button></Link>
            <span className="badge">SVG canvas</span>
          </div>
          <h3 style={{marginTop:20}}>Quick picks</h3>
          <ul className="list">
            {TUTORIALS.map(t => (
              <li key={t.id}>
                <Link href={`/draft?t=${t.id}`}>{t.title}</Link>
                <div className="mono" style={{color:'#a1a1aa', fontSize:12}}>{t.summary}</div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </main>
  );
}
