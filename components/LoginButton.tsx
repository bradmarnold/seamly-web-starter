'use client';

export default function LoginButton() {
  const onClick = () => alert('Auth placeholder. We will wire real login later.');
  return <button onClick={onClick}>Sign in</button>;
}
