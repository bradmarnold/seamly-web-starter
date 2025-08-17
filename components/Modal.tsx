'use client';
export function Modal({ open, title, children, onClose }:{ open:boolean; title:string; children:React.ReactNode; onClose:()=>void }){
  if(!open) return null;
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={e=>e.stopPropagation()}>
        <h3>{title}</h3>
        {children}
      </div>
    </div>
  );
}
