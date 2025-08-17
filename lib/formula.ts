import { Parser } from 'expr-eval';
export type Vars = Record<string, number>;
export function evalExpr(expr: string, vars: Vars) {
  const p = new Parser({ operators: { logical:false, comparison:false, assignment:false } });
  const toRad = (x:number)=> x*Math.PI/180;
  (p as any).functions.deg = (x:number)=> toRad(x);
  (p as any).functions.sind = (x:number)=> Math.sin(toRad(x));
  (p as any).functions.cosd = (x:number)=> Math.cos(toRad(x));
  (p as any).functions.tand = (x:number)=> Math.tan(toRad(x));
  return p.parse(expr).evaluate(vars);
}
