import './globals.css';
import Link from 'next/link';
import { TUTORIALS } from '@/lib/tutorials';

export const metadata = { title: 'Seamly Web Starter', description: 'Parametric drafting tutorials in the browser' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <header className="header">
          <Link href="/" className="brand">Seamly Web</Link>
          <nav className="menu">
            <div className="dropdown">
              <details>
                <summary style={{cursor:'pointer'}}>Tutorials</summary>
                <ul>
                  {TUTORIALS.map(t => (
                    <li key={t.id}>
                      <Link href={`/draft?t=${t.id}`}>{t.title}</Link>
                      <div className="mono" style={{color:'#a1a1aa', fontSize:12}}>{t.summary}</div>
                    </li>
                  ))}
                </ul>
              </details>
            </div>
            <Link href="/draft">Draft</Link>
            <Link href="/about">About</Link>
          </nav>
          <div className="spacer" />
          <LoginButton />
        </header>
        {children}
      </body>
    </html>
  );
}

function LoginButton() {
  const onClick = () => alert('Auth placeholder. Wire to GitHub or email later.');
  return <button onClick={onClick}>Sign in</button>;
}
