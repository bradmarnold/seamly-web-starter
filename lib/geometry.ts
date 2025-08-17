export type P = { x:number; y:number };

export const EPS = 1e-9;

export function dist(a:P,b:P){ return Math.hypot(b.x-a.x, b.y-a.y); }
export function angleOf(a:P,b:P){ return Math.atan2(b.y-a.y, b.x-a.x) * 180/Math.PI; }
export function rad(deg:number){ return deg*Math.PI/180; }
export function deg(rad:number){ return rad*180/Math.PI; }

export function normDeg(a:number){ let d=a%360; if(d<0) d+=360; return d; }

export function lerp(a:number,b:number,t:number){ return a+(b-a)*t; }
export function lerpP(a:P,b:P,t:number):P{ return { x: lerp(a.x,b.x,t), y: lerp(a.y,b.y,t) }; }

/** True if angle theta at C lies within arc (start->end, ccw?). */
export function arcContainsAngle(C:P, A:P, B:P, ccw:boolean, theta:number){
  const a1 = Math.atan2(A.y-C.y, A.x-C.x);
  const a2 = Math.atan2(B.y-C.y, B.x-C.x);
  let d = a2 - a1;
  if (ccw) { if (d < 0) d += Math.PI*2; }
  else     { if (d > 0) d -= Math.PI*2; }
  const t = theta - a1;
  const tt = ccw ? (t<0?t+Math.PI*2:t) : (t>0?t-Math.PI*2:t);
  return ccw ? (tt>=-EPS && tt<=d+EPS) : (tt<=EPS && tt>=d-EPS);
}

/** Intersections of infinite line AB with circle (center C, radius r). Returns 0–2 points. */
export function intersectLineCircle(A:P,B:P,C:P,r:number):P[]{
  const dx=B.x-A.x, dy=B.y-A.y;
  const fx=A.x-C.x, fy=A.y-C.y;
  const a=dx*dx+dy*dy;
  const b=2*(fx*dx+fy*dy);
  const c=fx*fx+fy*fy-r*r;
  const disc=b*b-4*a*c;
  if(disc<-EPS) return [];
  if(Math.abs(disc)<EPS){ const t=-b/(2*a); return [{x:A.x+dx*t, y:A.y+dy*t}]; }
  const s=Math.sqrt(disc);
  const t1=(-b+s)/(2*a), t2=(-b-s)/(2*a);
  return [
    {x:A.x+dx*t1, y:A.y+dy*t1},
    {x:A.x+dx*t2, y:A.y+dy*t2}
  ];
}

/** Intersections of circles C1(r1) and C2(r2). Returns 0–2 points. */
export function intersectCircles(C1:P,r1:number,C2:P,r2:number):P[]{
  const d=dist(C1,C2);
  if(d>r1+r2+EPS || d<Math.abs(r1-r2)-EPS || d<EPS) return [];
  const a=(r1*r1 - r2*r2 + d*d)/(2*d);
  const h2=r1*r1 - a*a; if(h2<-EPS) return [];
  const h=Math.sqrt(Math.max(0,h2));
  const xm=C1.x + a*(C2.x-C1.x)/d;
  const ym=C1.y + a*(C2.y-C1.y)/d;
  const rx=-(C2.y-C1.y)*(h/d);
  const ry= (C2.x-C1.x)*(h/d);
  const p1={x:xm+rx,y:ym+ry};
  const p2={x:xm-rx,y:ym-ry};
  return (h<EPS)?[p1]:[p1,p2];
}
