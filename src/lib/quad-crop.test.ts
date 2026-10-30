import {describe,expect,it} from 'vitest';
import {detectQuad,FULL_QUAD,squareToQuad,type Quad} from './quad-crop';

function scene(w:number,h:number,inside:(x:number,y:number)=>boolean){const g=new Array(w*h);
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){let v=inside(x,y)?235:60; if(inside(x,y)&&y%9===0&&x%5<3)v=30; g[y*w+x]=v;} return g;}
const near=(a:number,b:number)=>Math.abs(a-b)<0.06;

describe('detectQuad',()=>{
 it('finds a tilted receipt with dark print lines as one sheet',()=>{
  const w=200,h=200,c=Math.cos(0.25),s=Math.sin(0.25);
  const g=scene(w,h,(x,y)=>{const dx=x-100,dy=y-100,u=dx*c+dy*s,v=-dx*s+dy*c;return Math.abs(u)<40&&Math.abs(v)<70;});
  const q=detectQuad(g,w,h); const area=Math.abs((q[1].x-q[3].x)*(q[2].y-q[0].y)-(q[2].x-q[0].x)*(q[1].y-q[3].y))/2;
  expect(area).toBeGreaterThan(0.25); // whole 80x140 sheet ≈ 0.28, not half
  expect(q).not.toEqual(FULL_QUAD);
 });
 it('falls back to the full photo on a flat image',()=>{expect(detectQuad(new Array(400).fill(120),20,20)).toEqual(FULL_QUAD);});
});
describe('squareToQuad',()=>{
 it('maps unit corners to the quad corners',()=>{const q:Quad=[{x:10,y:5},{x:90,y:20},{x:80,y:95},{x:5,y:70}];const m=squareToQuad(q);
  for(const [u,v,p] of [[0,0,q[0]],[1,0,q[1]],[1,1,q[2]],[0,1,q[3]]] as const){const r=m(u,v);expect(near(r.x,p.x)&&near(r.y,p.y)).toBe(true);}});
});
