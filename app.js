"use strict";
/* ============================================================ *
 *  ISO STUDIO — Isometric Sketch Trainer
 *  Grade 7–8 · Common Core 7.G.1/7.G.2 · adaptive sketching
 * ============================================================ */

/* ---------- Storage (persist progress; graceful fallback) ---------- */
const Store = (() => {
  const mem = {};
  const ok = typeof window !== 'undefined' && window.storage;
  return {
    async get(k){ try{ if(!ok) return mem[k]??null;
      const r = await window.storage.get(k); return r? JSON.parse(r.value): null; }
      catch(e){ return mem[k]??null; } },
    async set(k,v){ try{ mem[k]=v; if(ok) await window.storage.set(k, JSON.stringify(v)); }
      catch(e){ mem[k]=v; } }
  };
})();

/* ---------- Iso geometry ---------- */
// 3D cube lattice (i,j,k=z up) -> 2D triangular lattice (A=i-k, B=j-k)
// Screen basis: eX=(+UX,+UY)  eY=(-UX,+UY)  eZ=(0,-S) ; eX+eY = -eZ
const COS30 = Math.cos(Math.PI/6), SIN30 = 0.5;
const toAB = (i,j,k)=>[i-k, j-k];
const ekey = (p,q)=>{ const a=p[0]+","+p[1], b=q[0]+","+q[1]; return a<b? a+"|"+b : b+"|"+a; };
function screenOf(A,B,o){ // o = {S, ox, oy}
  return { x:o.ox + (A-B)*COS30*o.S, y:o.oy + (A+B)*SIN30*o.S };
}
// All visible faces (back-face cull: normals +x,+y,+z). Returns {edges:Set, faces:[...]}
function buildTarget(cubes){
  const set=new Set(cubes.map(c=>c.join(',')));
  const has=(i,j,k)=>set.has(i+","+j+","+k);
  const edges=new Set(), faces=[];
  const reg=(corners,shade)=>{
    const ab=corners.map(c=>toAB(c[0],c[1],c[2]));
    for(let n=0;n<4;n++) edges.add(ekey(ab[n],ab[(n+1)%4]));
    // depth: closer to viewer (larger i+j+k) drawn later
    const d=corners.reduce((s,c)=>s+c[0]+c[1]+c[2],0);
    faces.push({ab,shade,d});
  };
  for(const [i,j,k] of cubes){
    if(!has(i,j,k+1)) reg([[i,j,k+1],[i+1,j,k+1],[i+1,j+1,k+1],[i,j+1,k+1]],'top');
    if(!has(i+1,j,k)) reg([[i+1,j,k],[i+1,j+1,k],[i+1,j+1,k+1],[i+1,j,k+1]],'right');
    if(!has(i,j+1,k)) reg([[i,j+1,k],[i,j+1,k+1],[i+1,j+1,k+1],[i+1,j+1,k]],'left');
  }
  faces.sort((a,b)=>a.d-b.d);
  return {edges,faces};
}
function fitView(cubes, W, H, pad){
  // gather all AB corner coords, choose S+offset to fit
  let mnX=1e9,mxX=-1e9,mnY=1e9,mxY=-1e9;
  const pts=[];
  for(const [i,j,k] of cubes)
    for(let di=0;di<2;di++)for(let dj=0;dj<2;dj++)for(let dk=0;dk<2;dk++)
      pts.push(toAB(i+di,j+dj,k+dk));
  for(const [A,B] of pts){
    const ux=(A-B)*COS30, uy=(A+B)*SIN30;
    mnX=Math.min(mnX,ux);mxX=Math.max(mxX,ux);mnY=Math.min(mnY,uy);mxY=Math.max(mxY,uy);
  }
  const spanX=(mxX-mnX)||1, spanY=(mxY-mnY)||1;
  const S=Math.min((W-2*pad)/spanX,(H-2*pad)/spanY);
  const ox=W/2 - ((mnX+mxX)/2)*S, oy=H/2 - ((mnY+mxY)/2)*S;
  return {S,ox,oy};
}
const SHADE={top:'#efe7d4', right:'#d8cbac', left:'#c4b58f'};

/* ---------- Task generator (procedural + curated families) ---------- *
 * "Combine parts at different edges and multiple sizes" baked into L5+.
 * Shapes kept viewer-monotone so back-face cull = correct iso line art. */
function R(seed){ let s=seed>>>0||1; return ()=>{ s^=s<<13;s^=s>>>17;s^=s<<5;return (s>>>0)/4294967296; }; }
const pick=(rnd,arr)=>arr[Math.floor(rnd()*arr.length)];

function box(ox,oy,oz,a,b,c){ const o=[]; for(let i=0;i<a;i++)for(let j=0;j<b;j++)for(let k=0;k<c;k++)o.push([ox+i,oy+j,oz+k]); return o; }
function dedupe(c){ const s=new Set(),o=[]; for(const x of c){const k=x.join(',');if(!s.has(k)){s.add(k);o.push(x);}} return o; }

function genTask(level, cx, seed){
  const rnd=R(seed);
  let cubes=[], name='', desc='', parts=[];
  const sz=()=>1+Math.floor(rnd()*Math.min(cx+1,4));
  if(level===1){
    cubes=[[0,0,0]];
    name='Single Unit Cube';
    desc='Sketch one cube. Start at a dot, draw the three edges from that corner, then close each face — 9 lines in total.';
    parts=['1 cube','9 edges'];
  } else if(level===2){
    const len=2+Math.floor(rnd()*Math.min(cx+1,3)); // 2..4
    const dir=pick(rnd,['x','y']);
    cubes = dir==='x'? box(0,0,0,len,1,1) : box(0,0,0,1,len,1);
    name=`Row of ${len} Cubes`;
    desc=`A straight bar of ${len} cubes laid along the ${dir==='x'?'right-going':'left-going'} axis. Keep every cube the same size.`;
    parts=[`${len} cubes`,'1 part','row'];
  } else if(level===3){
    const a=2+Math.floor(rnd()*2), b=2+Math.floor(rnd()*2);
    cubes=box(0,0,0,a,b,1); // remove a corner -> L
    cubes=cubes.filter(c=>!(c[0]===a-1 && c[1]===b-1));
    name='Flat L-Shape';
    desc=`A flat layer ${a}×${b} with one corner cube removed, forming an L. All on the ground level.`;
    parts=[`${a*b-1} cubes`,'L footprint','flat'];
  } else if(level===4){
    const a=2+Math.floor(rnd()*Math.min(cx,3)), b=1+Math.floor(rnd()*Math.min(cx,2)), c=1+Math.floor(rnd()*2);
    cubes=box(0,0,0,a,b,c);
    name=`Solid Box ${a}×${b}×${c}`;
    desc=`A full rectangular box, ${a} wide · ${b} deep · ${c} tall. Notice the three visible faces meet at the front corner.`;
    parts=[`${a*b*c} cubes`,'box',`${a}×${b}×${c}`];
  } else if(level===5){
    // base slab + tower at an edge — TWO PARTS, different SIZES
    const a=2+Math.floor(rnd()*2), b=2+Math.floor(rnd()*2);
    const base=box(0,0,0,a,b,1);
    const tw=1+Math.floor(rnd()*Math.min(cx,2)), th=1+Math.floor(rnd()*Math.min(cx+1,3));
    const where=pick(rnd,[['right',a-tw,0],['left',0,b-tw],['back',0,0]]);
    const tower=box(where[1],where[2],1,tw,tw,th);
    cubes=dedupe(base.concat(tower));
    name='Base + Tower';
    desc=`Part A: a ${a}×${b} base slab. Part B: a ${tw}×${tw}×${th} tower joined on top of the ${where[0]} edge. Two parts, different sizes — combine them cleanly.`;
    parts=[`Part A ${a}×${b}×1`,`Part B ${tw}×${tw}×${th}`,`join: ${where[0]} edge`];
  } else if(level===6){
    // staircase ascending toward the viewer (viewer-monotone & safe)
    const steps=2+Math.floor(rnd()*Math.min(cx+1,4)); // 2..5
    const wide=1+Math.floor(rnd()*Math.min(cx,2));
    cubes=[];
    for(let s=0;s<steps;s++) cubes=cubes.concat(box(s,0,0, 1, wide, steps-s));
    cubes=dedupe(cubes);
    name=`${steps}-Step Staircase`;
    desc=`A staircase of ${steps} steps, each ${wide} deep, climbing upward. Each step is one cube taller than the one in front of it.`;
    parts=[`${steps} steps`,`${cubes.length} cubes`,'increasing height'];
  } else { // level 7 — composite: base + tower + wing, asymmetric, larger
    const a=3+Math.floor(rnd()*2), b=2+Math.floor(rnd()*2);
    const base=box(0,0,0,a,b,1);
    const tw=1+Math.floor(rnd()*2), th=2+Math.floor(rnd()*Math.min(cx,3));
    const tower=box(a-tw,0,1,tw,tw,th);
    const wh=1+Math.floor(rnd()*2);
    const wing=box(0,b,0,2,1,wh);
    cubes=dedupe(base.concat(tower,wing));
    name='Composite Structure';
    desc=`Three parts: a ${a}×${b} base, a ${tw}×${tw}×${th} tower on the right-front, and a ${2}×1×${wh} wing extending off the left edge. Sketch each part, then merge them.`;
    parts=[`${cubes.length} cubes`,'3 parts','asymmetric'];
  }
  // normalise to non-negative coords
  let mi=1e9,mj=1e9,mk=1e9;
  for(const [i,j,k] of cubes){mi=Math.min(mi,i);mj=Math.min(mj,j);mk=Math.min(mk,k);}
  cubes=cubes.map(([i,j,k])=>[i-mi,j-mj,k-mk]);
  const T=buildTarget(cubes);
  return {level,cx,seed,cubes,name,desc,parts,edgeCount:T.edges.size,target:T};
}

const LEVEL_NAMES=['','Single Cube','Cube Rows','Flat L-Shapes','Solid Boxes',
  'Base + Tower','Staircases','Composites'];
const MAX_CX={1:1,2:3,3:2,4:3,5:3,6:4,7:3};

/* ---------- Curated Textbook Practice Tasks ----------
 * Hand-designed shapes that match common grade 7-8 textbook
 * figures (vertical L, step, plus, U, chair, T-block, etc).
 * Practice tasks DO NOT affect adaptive progression. */
const TEXTBOOK_TASKS = [
  { name:'Vertical L', cubes:[[0,0,0],[1,0,0],[0,0,1]],
    desc:'A horizontal row of 2 cubes with one more standing on top of the left cube — like a small L lying on its side.' },
  { name:'Pillar', cubes:[[0,0,0],[0,0,1],[0,0,2]],
    desc:'Three cubes stacked straight up — a simple vertical column.' },
  { name:'Corner', cubes:[[0,0,0],[1,0,0],[0,1,0]],
    desc:'Three cubes forming a flat L on the ground.' },
  { name:'Tall Corner', cubes:[[0,0,0],[1,0,0],[0,1,0],[0,1,1]],
    desc:'A ground L with one more cube standing up at the back corner.' },
  { name:'Small Step', cubes:[[0,0,0],[1,0,0],[1,0,1]],
    desc:'Two cubes at the front, with one more standing on top of the right cube.' },
  { name:'Chair', cubes:[[0,0,0],[1,0,0],[0,1,0],[1,1,0],[0,1,1],[1,1,1]],
    desc:'A 2×2 seat with a 2×1 backrest standing along the back edge.' },
  { name:'T-Block', cubes:[[0,1,0],[1,1,0],[2,1,0],[1,0,0]],
    desc:'A row of 3 cubes with one extra cube attached to the middle — a flat T.' },
  { name:'Plus Sign', cubes:[[1,0,0],[0,1,0],[1,1,0],[2,1,0],[1,2,0]],
    desc:'Five cubes arranged in a + shape (cross), all on the ground.' },
  { name:'U-Shape', cubes:[[0,0,0],[0,1,0],[0,2,0],[1,2,0],[2,2,0],[2,1,0],[2,0,0]],
    desc:'A flat U opening toward the front — seven cubes around three sides of a square.' },
  { name:'Twin Pillars', cubes:[[0,0,0],[0,0,1],[2,0,0],[2,0,1],[1,0,0]],
    desc:'Two 2-tall columns connected by a single cube at the base — like the letter Π.' },
];
function genTextbookTask(idx){
  const t=TEXTBOOK_TASKS[idx];
  // normalise coords (already non-negative by design, but be safe)
  let mi=1e9,mj=1e9,mk=1e9;
  for(const [i,j,k] of t.cubes){mi=Math.min(mi,i);mj=Math.min(mj,j);mk=Math.min(mk,k);}
  const cubes=t.cubes.map(([i,j,k])=>[i-mi,j-mj,k-mk]);
  const T=buildTarget(cubes);
  return { level:'TB', cx:idx+1, seed:idx,
    cubes, name:t.name, desc:t.desc,
    parts:[`${cubes.length} cubes`,'textbook shape'],
    edgeCount:T.edges.size, target:T, isTextbook:true };
}

/* ---------- Adaptive engine ---------- */
const Eng = {
  prof:{ level:1, cx:1, xp:0, streak:0, best:0, hist:[], mastery:{}, seedN:1, failAttempts:0 },
  _justReset:false,
  async load(){
    const p=await Store.get('iso_profile_v1');
    if(p){
      this.prof=Object.assign(this.prof,p);
      if(this.prof.failAttempts==null) this.prof.failAttempts=0;
    }
  },
  async save(){ await Store.set('iso_profile_v1', this.prof); },
  rollingAcc(n=8){
    const h=this.prof.hist.slice(-n); if(!h.length) return null;
    return h.reduce((s,r)=>s+r.score,0)/h.length;
  },
  record(score, passed, usedHint){
    const p=this.prof, key=p.level+'.'+p.cx;
    p.hist.push({l:p.level,c:p.cx,score:+score.toFixed(3),passed,hint:usedHint,t:Date.now()});
    if(p.hist.length>60) p.hist=p.hist.slice(-60);
    p.mastery[key]=p.mastery[key]||{tries:0,pass:0,best:0};
    const m=p.mastery[key]; m.tries++; if(passed)m.pass++; m.best=Math.max(m.best,score);
    if(passed){
      p.failAttempts=0;
      p.streak++; p.xp += Math.round(40*p.level + 20*p.cx + 30*score + (usedHint?0:15));
      p.best=Math.max(p.best,p.streak);
      // advance one step after every successful completion
      if(p.cx < MAX_CX[p.level]) {
        p.cx++;
        this._evt='Stage up — next shape is a bit harder.';
      } else if(p.level < 7) {
        p.level++;
        p.cx = 1;
        this._evt=`Level up → ${LEVEL_NAMES[p.level]}!`;
      } else {
        this._evt='You topped the ladder — press Continue for more practice.';
      }
    } else {
      p.streak=0;
      p.failAttempts=(p.failAttempts||0)+1;
      // 1 fail → alternate; 2–4 → similar practice; 5th fail → restart at Level 1
      if(p.failAttempts>=5){
        p.level=1; p.cx=1; p.failAttempts=0;
        this._justReset=true;
        this._evt='Starting fresh from Level 1 — back to the original shapes.';
      } else if(p.failAttempts===1){
        this._evt='Try an alternate shape at the same level.';
      } else {
        this._evt='Similar shape — same level, new figure to practice.';
      }
    }
    return this._evt;
  },
  nextSeed(){ return (this.prof.seedN=(this.prof.seedN*1664525+1013904223)>>>0); }
};

function remedialSeed(level,cx,attempt){
  const p=Eng.prof;
  return ((level*131 + cx*8191 + attempt*2654435761 + p.seedN)>>>0)||1;
}

/* ---------- Verification (translation-invariant) ----------
 * The learner's figure is graded on SHAPE, not where on the dots
 * they placed it. We slide their drawing over every integer offset
 * and keep the alignment that matches the most target edges. */
function parseEdge(e){ // -> [[A,B],[A,B]]
  const [p,q]=e.split('|'); const a=p.split(',').map(Number), b=q.split(',').map(Number);
  return [a,b];
}
function edgeBounds(edges){
  let mnA=1e9,mxA=-1e9,mnB=1e9,mxB=-1e9;
  for(const e of edges){ const [a,b]=parseEdge(e);
    for(const [A,B] of [a,b]){ mnA=Math.min(mnA,A);mxA=Math.max(mxA,A);
      mnB=Math.min(mnB,B);mxB=Math.max(mxB,B); } }
  return {mnA,mxA,mnB,mxB};
}
function shiftKey(a,b,dA,dB){
  const p=[a[0]+dA,a[1]+dB], q=[b[0]+dA,b[1]+dB];
  const k1=p[0]+','+p[1], k2=q[0]+','+q[1];
  return k1<k2 ? k1+'|'+k2 : k2+'|'+k1;
}
function scoreAt(userEdges, targetEdges, dA, dB){
  let matched=0, extra=0;
  for(const e of userEdges){
    const [a,b]=parseEdge(e);
    if(targetEdges.has(shiftKey(a,b,dA,dB))) matched++; else extra++;
  }
  return {matched,extra};
}
function grade(userEdges, targetEdges){
  const T=targetEdges.size||1;
  if(userEdges.size===0)
    return {matched:0,extra:0,missing:T,score:0,passed:false,total:T,offset:[0,0]};
  const U=edgeBounds(userEdges), G=edgeBounds(targetEdges);
  // offsets that keep the two bounding boxes overlapping (small search space)
  const loA=G.mnA-U.mxA-1, hiA=G.mxA-U.mnA+1;
  const loB=G.mnB-U.mxB-1, hiB=G.mxB-U.mnB+1;
  let best={matched:-1,extra:0,dA:0,dB:0};
  for(let dA=loA;dA<=hiA;dA++) for(let dB=loB;dB<=hiB;dB++){
    const r=scoreAt(userEdges,targetEdges,dA,dB);
    // prefer most matches, then fewest stray lines
    if(r.matched>best.matched || (r.matched===best.matched && r.extra<best.extra))
      best={matched:r.matched,extra:r.extra,dA,dB};
  }
  const matched=best.matched, extra=best.extra;
  const missing=targetEdges.size-matched;
  const score=Math.min(1, Math.max(0,(matched-0.6*extra)/T));
  const passed=(matched/T>=0.85) && (extra<=Math.max(1,Math.round(0.10*T)));
  return {matched,extra,missing,score,passed,total:T,offset:[best.dA,best.dB]};
}

/* ============================================================ *
 *  UI / Canvas
 * ============================================================ */
const board=document.getElementById('board'), bctx=board.getContext('2d');
const studio=document.getElementById('studio');
const ref=document.getElementById('refCanvas'), rctx=ref.getContext('2d');
let DPR=Math.min(window.devicePixelRatio||1,2);
const COARSE=typeof matchMedia!=='undefined' && matchMedia('(pointer:coarse)').matches;
function dotHitSlop(){ return view ? view.S*(COARSE?0.78:0.5) : 24; }
function edgeHitSlop(){ return view ? view.S*(COARSE?0.32:0.22) : 12; }

let TASK=null;          // current task
let userEdges=new Set();// committed unit edges (A,B|A,B)
let undoStack=[];       // arrays of edge keys (one stroke)
let mode='draw';        // draw | erase
let anchor=null;        // {A,B} for in-progress segment
let hover=null;         // pointer screen pos for rubber band
let view=null;          // {S,ox,oy} for board
let startDot=null;      // suggested first dot {A,B}
let dots=[];            // visible lattice dots [{A,B,x,y}]
let feedback=null;      // {grade} after Check
let revealed=false, usedHint=false, locked=false;

/* dot field: a generous parallelogram of (A,B) that always covers tasks */
function computeField(){
  // bounds from current task corners + margin
  let mnA=1e9,mxA=-1e9,mnB=1e9,mxB=-1e9;
  for(const [i,j,k] of TASK.cubes)
    for(let di=0;di<2;di++)for(let dj=0;dj<2;dj++)for(let dk=0;dk<2;dk++){
      const [A,B]=toAB(i+di,j+dj,k+dk);
      mnA=Math.min(mnA,A);mxA=Math.max(mxA,A);mnB=Math.min(mnB,B);mxB=Math.max(mxB,B);
    }
  const M=4; mnA-=M;mxA+=M;mnB-=M;mxB+=M;
  return {mnA,mxA,mnB,mxB};
}
function layout(){
  let r=board.getBoundingClientRect();
  if(r.width<2||r.height<2) r=studio.getBoundingClientRect();
  board.width=Math.max(1,Math.floor(r.width*DPR));
  board.height=Math.max(1,Math.floor(r.height*DPR));
  board.style.width=Math.floor(r.width)+'px';
  board.style.height=Math.floor(r.height)+'px';
  bctx.setTransform(DPR,0,0,DPR,0,0);
  const f=computeField();
  // fit field span to canvas
  const cs=[[f.mnA,f.mnB],[f.mxA,f.mnB],[f.mnA,f.mxB],[f.mxA,f.mxB]];
  let mnX=1e9,mxX=-1e9,mnY=1e9,mxY=-1e9;
  for(const [A,B] of cs){ const ux=(A-B)*COS30, uy=(A+B)*SIN30;
    mnX=Math.min(mnX,ux);mxX=Math.max(mxX,ux);mnY=Math.min(mnY,uy);mxY=Math.max(mxY,uy); }
  const pad=46;
  const S=Math.min((r.width-2*pad)/((mxX-mnX)||1),(r.height-2*pad)/((mxY-mnY)||1));
  view={S, ox:r.width/2-((mnX+mxX)/2)*S, oy:r.height/2-((mnY+mxY)/2)*S};
  dots=[];
  for(let A=f.mnA;A<=f.mxA;A++)for(let B=f.mnB;B<=f.mxB;B++){
    const s=screenOf(A,B,view); dots.push({A,B,x:s.x,y:s.y});
  }
  // START anchor: the lowest-front corner of the figure (i=0,j=0,k=0 area).
  // Grading ignores position, so this is just a friendly place to begin.
  let sA=1e9,sB=1e9;
  for(const [i,j,k] of TASK.cubes){ const [A,B]=toAB(i,j,k);
    if(A<sA||(A===sA&&B<sB)){ sA=A; sB=B; } }
  startDot={A:sA,B:sB};
  draw();
}
function nearestDot(x,y){
  let best=null,bd=1e9;
  for(const d of dots){ const dx=d.x-x,dy=d.y-y,dd=dx*dx+dy*dy;
    if(dd<bd){bd=dd;best=d;} }
  const sl=dotHitSlop();
  return (bd <= sl*sl) ? best : null;
}
// decompose A->B into unit edges if aligned to (1,0)/(0,1)/(1,1)
function segmentEdges(a,b){
  const dA=b.A-a.A, dB=b.B-a.B;
  if(dA===0&&dB===0) return null;
  let ua,ub,n;
  if(dB===0){ n=Math.abs(dA); ua=Math.sign(dA); ub=0; }
  else if(dA===0){ n=Math.abs(dB); ua=0; ub=Math.sign(dB); }
  else if(dA===dB){ n=Math.abs(dA); ua=Math.sign(dA); ub=Math.sign(dB); }
  else return null; // not an isometric direction
  const out=[]; let cA=a.A,cB=a.B;
  for(let s=0;s<n;s++){ out.push(ekey([cA,cB],[cA+ua,cB+ub])); cA+=ua;cB+=ub; }
  return out;
}

/* ---------- drawing ---------- */
function drawScene(ctx,o,opts){
  const {edges,faces}=opts.target;
  // shaded faces (reference + on success)
  if(opts.fill){
    for(const fc of faces){
      ctx.beginPath();
      fc.ab.forEach((p,n)=>{ const s=screenOf(p[0],p[1],o); n?ctx.lineTo(s.x,s.y):ctx.moveTo(s.x,s.y); });
      ctx.closePath(); ctx.fillStyle=SHADE[fc.shade]; ctx.fill();
    }
  }
  ctx.lineCap='round'; ctx.lineJoin='round';
  ctx.lineWidth=Math.max(2, o.S*0.07);
  ctx.strokeStyle=opts.color||'#1c2b4a';
  for(const e of edges){
    const [p,q]=e.split('|').map(s=>s.split(',').map(Number));
    const s1=screenOf(p[0],p[1],o), s2=screenOf(q[0],q[1],o);
    ctx.beginPath(); ctx.moveTo(s1.x,s1.y); ctx.lineTo(s2.x,s2.y); ctx.stroke();
  }
}
function updateGhost(){
  const g=document.getElementById('ghost'); if(!g||!TASK) return;
  g.innerHTML = `<b style="color:var(--ink)">${userEdges.size}</b> lines drawn · target <b style="color:var(--ink)">${TASK.edgeCount}</b>` +
    (mode==='erase'?' · <span style="color:var(--bad)">erase mode</span>':'');
}
function draw(){
  if(!view||!TASK) return;
  const r=board.getBoundingClientRect();
  bctx.clearRect(0,0,r.width||board.width/DPR,r.height||board.height/DPR);
  // dot grid
  for(const d of dots){
    bctx.beginPath(); bctx.arc(d.x,d.y,Math.max(1.5,view.S*0.045),0,7);
    bctx.fillStyle='rgba(28,43,74,.32)'; bctx.fill();
  }
  // START anchor — shows where to begin (placement doesn't affect score)
  if(startDot && userEdges.size===0 && !feedback){
    const s=screenOf(startDot.A,startDot.B,view);
    const t=(Date.now()%1400)/1400, pr=view.S*(0.16+0.10*Math.sin(t*6.283));
    bctx.beginPath();bctx.arc(s.x,s.y,pr,0,7);
    bctx.strokeStyle='rgba(43,111,143,.55)';bctx.lineWidth=2;bctx.stroke();
    bctx.beginPath();bctx.arc(s.x,s.y,view.S*0.10,0,7);
    bctx.fillStyle='#2b6f8f';bctx.fill();
    bctx.font="700 11px 'JetBrains Mono'";bctx.fillStyle='#2b6f8f';
    bctx.textAlign='center';
    bctx.fillText('START HERE', s.x, s.y - view.S*0.30);
    if(!draw._raf){ draw._raf=requestAnimationFrame(()=>{draw._raf=0;draw();}); }
  }
  // success ghost fill
  if(feedback&&feedback.g.passed){
    bctx.globalAlpha=.5;
    for(const fc of TASK.target.faces){
      bctx.beginPath();
      fc.ab.forEach((p,n)=>{const s=screenOf(p[0],p[1],view);n?bctx.lineTo(s.x,s.y):bctx.moveTo(s.x,s.y);});
      bctx.closePath(); bctx.fillStyle=SHADE[fc.shade]; bctx.fill();
    }
    bctx.globalAlpha=1;
  }
  // hint / reveal: faint target
  if((usedHint||revealed) && !(feedback&&feedback.g.passed)){
    bctx.save(); bctx.globalAlpha=revealed?0.5:0.22;
    bctx.strokeStyle='#2b6f8f'; bctx.lineWidth=Math.max(2,view.S*0.06);
    bctx.lineCap='round';
    for(const e of TASK.target.edges){
      const [p,q]=e.split('|').map(s=>s.split(',').map(Number));
      const a=screenOf(p[0],p[1],view), b=screenOf(q[0],q[1],view);
      bctx.beginPath();bctx.moveTo(a.x,a.y);bctx.lineTo(b.x,b.y);bctx.stroke();
    }
    bctx.restore();
  }
  // committed user edges (colored by feedback using the matched alignment)
  bctx.lineCap='round'; bctx.lineWidth=Math.max(2.6,view.S*0.075);
  const off = feedback ? feedback.g.offset : [0,0];
  for(const e of userEdges){
    const [p,q]=e.split('|').map(s=>s.split(',').map(Number));
    const a=screenOf(p[0],p[1],view), b=screenOf(q[0],q[1],view);
    let col='#e07a36';
    if(feedback){
      const k=shiftKey(p,q,off[0],off[1]);
      col = TASK.target.edges.has(k)?'#2f9468':'#cf4b38';
    }
    bctx.strokeStyle=col;
    bctx.beginPath();bctx.moveTo(a.x,a.y);bctx.lineTo(b.x,b.y);bctx.stroke();
  }
  // missing edges after a check — drawn where the learner actually placed
  // their figure (target shifted back by the matched offset)
  if(feedback){
    bctx.save(); bctx.setLineDash([5,6]); bctx.strokeStyle='rgba(185,173,144,.9)';
    bctx.lineWidth=Math.max(2,view.S*0.05);
    const haveAligned=new Set([...userEdges].map(e=>{
      const [p,q]=e.split('|').map(s=>s.split(',').map(Number));
      return shiftKey(p,q,off[0],off[1]);
    }));
    for(const e of TASK.target.edges) if(!haveAligned.has(e)){
      const [p,q]=e.split('|').map(s=>s.split(',').map(Number));
      const a=screenOf(p[0]-off[0],p[1]-off[1],view), b=screenOf(q[0]-off[0],q[1]-off[1],view);
      bctx.beginPath();bctx.moveTo(a.x,a.y);bctx.lineTo(b.x,b.y);bctx.stroke();
    }
    bctx.restore();
  }
  // anchor + rubber band
  updateGhost();
  if(anchor){
    const s=screenOf(anchor.A,anchor.B,view);
    bctx.beginPath();bctx.arc(s.x,s.y,view.S*0.16,0,7);
    bctx.fillStyle='rgba(224,122,54,.25)';bctx.fill();
    bctx.beginPath();bctx.arc(s.x,s.y,view.S*0.075,0,7);
    bctx.fillStyle='#e07a36';bctx.fill();
    if(hover){
      const nd=nearestDot(hover.x,hover.y);
      let end = nd? screenOf(nd.A,nd.B,view) : hover;
      const valid = nd && segmentEdges(anchor,nd);
      bctx.save(); bctx.setLineDash([4,5]);
      bctx.strokeStyle = valid? 'rgba(224,122,54,.85)' : 'rgba(207,75,56,.7)';
      bctx.lineWidth=Math.max(2.4,view.S*0.07);
      bctx.beginPath();bctx.moveTo(s.x,s.y);bctx.lineTo(end.x,end.y);bctx.stroke();
      bctx.restore();
    }
  }
}

/* reference render — show simple FRONT / SIDE / TOP square views
 * (NOT the finished isometric drawing). The learner studies these
 * flat shapes and must construct the 3D isometric figure themselves. */
function orthoGrids(cubes){
  let mx=0,my=0,mz=0;
  for(const [i,j,k] of cubes){ mx=Math.max(mx,i+1); my=Math.max(my,j+1); mz=Math.max(mz,k+1); }
  const front=[], side=[], top=[];               // boolean grids
  for(let z=0;z<mz;z++){front[z]=[];side[z]=[];}
  for(let y=0;y<my;y++) top[y]=[];
  for(let z=0;z<mz;z++)for(let x=0;x<mx;x++) front[z][x]=false;
  for(let z=0;z<mz;z++)for(let y=0;y<my;y++) side[z][y]=false;
  for(let y=0;y<my;y++)for(let x=0;x<mx;x++) top[y][x]=false;
  for(const [i,j,k] of cubes){ front[k][i]=true; side[k][j]=true; top[j][i]=true; }
  return {front,side,top,mx,my,mz};
}
function renderRef(){
  rctx.setTransform(1,0,0,1,0,0);
  rctx.clearRect(0,0,ref.width,ref.height);
  const g=orthoGrids(TASK.cubes);
  const views=[
    {label:'FRONT', grid:g.front, cols:g.mx, rows:g.mz},
    {label:'SIDE',  grid:g.side,  cols:g.my, rows:g.mz},
    {label:'TOP',   grid:g.top,   cols:g.mx, rows:g.my},
  ];
  // lay out three panels left-to-right, scaled to fit
  const W=ref.width, H=ref.height, gap=26, padT=34, padB=18;
  const panelW=(W-gap*2 - 24)/3;
  const maxCols=Math.max(...views.map(v=>v.cols));
  const maxRows=Math.max(...views.map(v=>v.rows));
  const cell=Math.min((panelW-8)/maxCols, (H-padT-padB)/maxRows, 46);
  views.forEach((v,idx)=>{
    const gw=v.cols*cell, gh=v.rows*cell;
    const cx=12 + idx*(panelW+gap) + (panelW-gw)/2;
    const cy=padT + ( (H-padT-padB) - gh)/2;
    // label
    rctx.font="700 13px 'JetBrains Mono'";
    rctx.fillStyle="#46557a"; rctx.textAlign="center";
    rctx.fillText(v.label, 12+idx*(panelW+gap)+panelW/2, 24);
    // filled squares (rows drawn top-down so 'up' = higher z)
    for(let r=0;r<v.rows;r++)for(let c=0;c<v.cols;c++){
      const filled = v.grid[v.rows-1-r] && v.grid[v.rows-1-r][c];
      const x=cx+c*cell, y=cy+r*cell;
      rctx.beginPath(); rctx.rect(x,y,cell,cell);
      if(filled){ rctx.fillStyle="#d8cbac"; rctx.fill();
        rctx.strokeStyle="#1c2b4a"; rctx.lineWidth=2; rctx.stroke(); }
      else { rctx.strokeStyle="rgba(168,154,120,.45)"; rctx.lineWidth=1;
        rctx.setLineDash([3,4]); rctx.stroke(); rctx.setLineDash([]); }
    }
  });
}

/* ---------- task lifecycle ---------- */
function loadTask(t){
  TASK=t; userEdges=new Set(); undoStack=[]; anchor=null; hover=null;
  feedback=null; revealed=false; usedHint=false; locked=false;
  document.getElementById('tName').innerHTML = t.name +
    (t.isTextbook?' <span class="tbBadge">TEXTBOOK PRACTICE</span>':'') +
    (t.remedialKind==='alternate'?' <span class="tbBadge rem">ALTERNATE</span>':'') +
    (t.remedialKind==='similar'?' <span class="tbBadge rem">SIMILAR PRACTICE</span>':'');
  document.getElementById('tDesc').textContent=t.desc;
  const ch=document.getElementById('tChips');
  ch.innerHTML='';
  t.parts.forEach(p=>{const e=document.createElement('span');e.className='chip';e.innerHTML=p;ch.appendChild(e);});
  const ec=document.createElement('span');ec.className='chip';
  ec.innerHTML=`target: <b>${t.edgeCount} edges</b>`; ch.appendChild(ec);
  document.getElementById('howto').style.display = t.level===1?'block':'block';
  document.getElementById('howto').innerHTML = t.level===1
    ? `<b>Study the object</b> on the left, then build its 2D isometric drawing on the dots. Begin at the glowing <b style="color:var(--accent)">START HERE</b> dot: draw the three edges leaving that corner, then close each of the three faces (a cube is only 9 lines — the hidden back corner isn't drawn). <b>Where you place it on the grid doesn't matter — only the shape is scored.</b>`
    : `<b>Study the object</b> on the left, then reproduce it in 2D isometric. Start at the <b style="color:var(--accent)">START HERE</b> dot, tap dot-to-dot to draw each edge (drag works too), <b>Erase</b> to fix. Position on the grid is free — only the <b>shape</b> is checked. Then press <b>Check</b>.`;
  document.getElementById('verdict').className='verdict';
  document.getElementById('scoreWrap').style.display='none';
  setActionButtons({});
  document.getElementById('bHint').disabled=false;
  document.getElementById('bReveal').textContent='Reveal';
  renderRef(); layout(); setMode('draw'); renderHUD(); renderLadder();
}
function newAdaptiveTask(){
  loadTask(genTask(Eng.prof.level, Eng.prof.cx, Eng.nextSeed()));
}
function loadRemedialTask(){
  const p=Eng.prof, attempt=p.failAttempts;
  const t=genTask(p.level, p.cx, remedialSeed(p.level, p.cx, attempt));
  t.remedialKind = attempt===1 ? 'alternate' : 'similar';
  loadTask(t);
  const rb=document.getElementById('bRetry');
  if(rb) rb.textContent = attempt===1 ? 'Try alternate shape →' : 'Try similar shape →';
}

/* ---------- HUD ---------- */
function renderHUD(){
  const p=Eng.prof;
  document.getElementById('sLevel').textContent=p.level;
  document.getElementById('sCx').textContent=p.cx;
  document.getElementById('sStreak').textContent=p.streak;
  document.getElementById('sXp').textContent=p.xp;
  const a=Eng.rollingAcc();
  document.getElementById('sAcc').textContent = a==null?'—':Math.round(a*100)+'%';
}
function renderLadder(){
  const L=document.getElementById('ladder'); L.innerHTML='';
  for(let lv=1;lv<=7;lv++){
    const done = lv<Eng.prof.level || (lv===Eng.prof.level&&false);
    const cur = lv===Eng.prof.level;
    const r=document.createElement('div');
    r.className='row'+(cur?' cur':'')+(lv<Eng.prof.level?' done':'');
    r.innerHTML=`<span class="dot"></span> L${lv} · ${LEVEL_NAMES[lv]}`;
    L.appendChild(r);
  }
}
function toast(msg){
  const t=document.getElementById('toast'); t.textContent=msg; t.classList.add('show');
  clearTimeout(t._h); t._h=setTimeout(()=>t.classList.remove('show'),2600);
}
function setActionButtons({passed=false, showRetry=false, showFreshStart=false}={}){
  document.getElementById('bCheck').style.display = (passed || showFreshStart) ? 'none' : '';
  document.getElementById('bNext').style.display = (passed || showFreshStart) ? '' : 'none';
  document.getElementById('bNext').textContent = showFreshStart ? 'Start Level 1 →' : 'Continue →';
  const retry=document.getElementById('bRetry');
  if(retry) retry.style.display = showRetry ? '' : 'none';
}

/* ---------- interaction ---------- */
function setMode(m){
  mode=m; anchor=null;
  document.getElementById('tDraw').classList.toggle('on',m==='draw');
  document.getElementById('tErase').classList.toggle('on',m==='erase');
  board.style.cursor = m==='erase'?'pointer':'crosshair';
  draw();
}
function evtPos(e){
  const r=board.getBoundingClientRect();
  const t=e.touches?e.touches[0]:e;
  return {x:t.clientX-r.left, y:t.clientY-r.top};
}
function edgeHit(x,y){ // nearest committed edge within tolerance
  let best=null,bd=1e9;
  for(const e of userEdges){
    const [p,q]=e.split('|').map(s=>s.split(',').map(Number));
    const a=screenOf(p[0],p[1],view), b=screenOf(q[0],q[1],view);
    const dx=b.x-a.x,dy=b.y-a.y, L=dx*dx+dy*dy;
    let t=L? ((x-a.x)*dx+(y-a.y)*dy)/L : 0; t=Math.max(0,Math.min(1,t));
    const px=a.x+t*dx, py=a.y+t*dy, d=(x-px)**2+(y-py)**2;
    if(d<bd){bd=d;best=e;}
  }
  const sl=edgeHitSlop();
  return bd <= sl*sl ? best : null;
}
let dragStarted=false;
function onDown(e){
  if(locked) return; e.preventDefault();
  const p=evtPos(e);
  if(mode==='erase'){
    const hit=edgeHit(p.x,p.y);
    if(hit){ userEdges.delete(hit); undoStack.push({type:'erase',keys:[hit]}); draw(); }
    return;
  }
  const d=nearestDot(p.x,p.y);
  if(d){ anchor={A:d.A,B:d.B}; hover=p; dragStarted=true; draw(); }
}
function onMove(e){
  if(!anchor) return; e.preventDefault();
  hover=evtPos(e); draw();
}
function onUp(e){
  if(!anchor){ return; }
  e.preventDefault();
  const p = e.changedTouches? {x:e.changedTouches[0].clientX-board.getBoundingClientRect().left,
                               y:e.changedTouches[0].clientY-board.getBoundingClientRect().top}
                            : evtPos(e);
  const d=nearestDot(p.x,p.y);
  if(d && !(d.A===anchor.A&&d.B===anchor.B)){
    const segs=segmentEdges(anchor,d);
    if(segs){
      const added=[];
      for(const s of segs) if(!userEdges.has(s)){ userEdges.add(s); added.push(s); }
      if(added.length) undoStack.push({type:'draw',keys:added});
      // clear any stale feedback once the learner edits again
      if(feedback){ feedback=null; document.getElementById('verdict').className='verdict';
        document.getElementById('scoreWrap').style.display='none'; setActionButtons({}); }
    } else toast('Lines must follow an isometric direction.');
  }
  anchor=null; hover=null; draw();
}
board.addEventListener('mousedown',onDown);
window.addEventListener('mousemove',onMove);
window.addEventListener('mouseup',onUp);
board.addEventListener('touchstart',onDown,{passive:false});
board.addEventListener('touchmove',onMove,{passive:false});
board.addEventListener('touchend',onUp,{passive:false});

/* ---------- buttons ---------- */
document.getElementById('tDraw').onclick=()=>setMode('draw');
document.getElementById('tErase').onclick=()=>setMode('erase');
document.getElementById('tUndo').onclick=()=>{
  const last=undoStack.pop(); if(!last) return;
  if(last.type==='draw') last.keys.forEach(k=>userEdges.delete(k));
  else last.keys.forEach(k=>userEdges.add(k));
  feedback=null; document.getElementById('verdict').className='verdict';
  document.getElementById('scoreWrap').style.display='none';
  setActionButtons({});
  draw();
};
document.getElementById('tClear').onclick=()=>{
  if(!userEdges.size) return;
  undoStack.push({type:'erase',keys:[...userEdges]}); userEdges.clear();
  feedback=null; draw();
};
document.getElementById('bHint').onclick=()=>{ usedHint=true;
  document.getElementById('bHint').disabled=true; toast('Faint guide shown — counts as assisted.'); draw(); };
document.getElementById('bReveal').onclick=()=>{
  revealed=!revealed; usedHint=true;
  document.getElementById('bReveal').textContent=revealed?'Hide':'Reveal'; draw();
};
document.getElementById('bCheck').onclick=async()=>{
  if(locked) return;
  const g=grade(userEdges,TASK.target.edges);
  feedback={g};
  let evt=null;
  if(!TASK.isTextbook){           // practice mode: don't touch adaptive state
    evt=Eng.record(g.score,g.passed,usedHint);
    await Eng.save();
  }
  const v=document.getElementById('verdict');
  v.className='verdict show '+(g.passed?'pass':'fail');
  let failMsg='Not quite — keep refining, or try an alternate shape.';
  if(!g.passed && !TASK.isTextbook){
    const fa=Eng.prof.failAttempts;
    if(Eng._justReset) failMsg='Let\'s rebuild from <b>Level 1</b> with the original lesson shapes.';
    else if(fa===1) failMsg='Not quite — press <b>Try alternate shape</b> for a fresh figure at this level.';
    else if(fa>=2 && fa<=4) failMsg='Keep going — press <b>Try similar shape</b> or keep refining on the dots.';
    else if(fa>=1) failMsg='Not quite — try an alternate or similar shape, or keep refining.';
  }
  v.innerHTML = (g.passed
    ? (TASK.isTextbook
      ? '✓ Correct sketch! Press <b>Continue</b> for the next textbook shape.'
      : '✓ Correct sketch! Press <b>Continue</b> for the next challenge.')
    : failMsg)+
    `<small>${g.matched}/${g.total} edges right`+
    (g.extra?` · ${g.extra} extra`:'')+(g.missing?` · ${g.missing} missing`:'')+
    ` · ${Math.round(g.score*100)}%</small>`;
  document.getElementById('scoreWrap').style.display='';
  document.getElementById('scoreFill').style.width=Math.round(g.score*100)+'%';
  document.getElementById('scoreFill').style.background=g.passed?'#2f9468':'#cf4b38';
  const freshStart=!g.passed && !TASK.isTextbook && Eng._justReset;
  const showRetry=!g.passed && !TASK.isTextbook && !freshStart &&
    Eng.prof.failAttempts>0 && Eng.prof.failAttempts<5;
  setActionButtons({passed:g.passed, showRetry, showFreshStart:freshStart});
  if(showRetry){
    const rb=document.getElementById('bRetry');
    if(rb) rb.textContent = Eng.prof.failAttempts===1
      ? 'Try alternate shape →' : 'Try similar shape →';
  }
  if(freshStart) Eng._justReset=false;
  if(g.passed && evt) toast(evt);
  else if(!g.passed && evt) toast(evt);
  locked=false;
  renderHUD(); renderLadder(); draw();
};
document.getElementById('bRetry').onclick=()=>loadRemedialTask();
document.getElementById('bNext').onclick=()=>{
  if(TASK && TASK.isTextbook){
    const next = (TASK.seed + 1) % TEXTBOOK_TASKS.length;
    loadTask(genTextbookTask(next));
  } else {
    newAdaptiveTask();
  }
};

/* ---------- task bank modal ---------- */
const scrim=document.getElementById('scrim');
document.getElementById('tBank').onclick=()=>{ buildBank(); scrim.classList.add('show'); };
document.getElementById('bankClose').onclick=()=>scrim.classList.remove('show');
scrim.onclick=e=>{ if(e.target===scrim) scrim.classList.remove('show'); };
function buildBank(){
  const g=document.getElementById('bankGrid'); g.innerHTML='';

  // --- Textbook Practice section ---
  const tbHead=document.createElement('div');
  tbHead.className='bsec';
  tbHead.innerHTML='TEXTBOOK PRACTICE <span>· grade 7–8 shapes · does not affect your level</span>';
  g.appendChild(tbHead);
  for(let i=0;i<TEXTBOOK_TASKS.length;i++){
    const sample=genTextbookTask(i);
    const card=document.createElement('div');
    card.className='bcard tb';
    const cv=document.createElement('canvas'); cv.width=260; cv.height=180;
    card.appendChild(cv);
    const o=fitView(sample.cubes,cv.width,cv.height,26);
    drawScene(cv.getContext('2d'),o,{target:sample.target,fill:true,color:'#1c2b4a'});
    const meta=document.createElement('div');
    meta.innerHTML=`<div class="bl">${sample.name}</div>
      <div class="bs">${sample.cubes.length} cubes · ${sample.edgeCount} edges</div>`;
    card.appendChild(meta);
    card.onclick=()=>{ scrim.classList.remove('show'); loadTask(sample); };
    g.appendChild(card);
  }

  // --- Adaptive levels section ---
  const adHead=document.createElement('div');
  adHead.className='bsec';
  adHead.innerHTML='ADAPTIVE LEVELS <span>· difficulty rises as you improve</span>';
  g.appendChild(adHead);
  for(let lv=1;lv<=7;lv++){
    const sample=genTask(lv,1, 7777+lv*131);
    const unlocked = lv<=Eng.prof.level;
    const card=document.createElement('div');
    card.className='bcard'+(unlocked?'':' locked');
    const cv=document.createElement('canvas'); cv.width=260; cv.height=180;
    card.appendChild(cv);
    const o=fitView(sample.cubes,cv.width,cv.height,26);
    const c=cv.getContext('2d');
    drawScene(c,o,{target:sample.target,fill:true,color: unlocked?'#1c2b4a':'#8c8268'});
    const key=lv+'.1', m=Eng.prof.mastery, tries=Object.keys(m).filter(k=>k.startsWith(lv+'.')).reduce((s,k)=>s+m[k].tries,0);
    const pass=Object.keys(m).filter(k=>k.startsWith(lv+'.')).reduce((s,k)=>s+m[k].pass,0);
    const pct = tries? Math.round(pass/tries*100):0;
    const meta=document.createElement('div');
    meta.innerHTML=`<div class="bl">L${lv} · ${LEVEL_NAMES[lv]}</div>
      <div class="bs">${unlocked?(tries?pass+'/'+tries+' solved':'unlocked'):'locked — reach level '+lv}</div>
      <div class="bp"><i style="width:${pct}%"></i></div>`;
    card.appendChild(meta);
    if(unlocked) card.onclick=()=>{ scrim.classList.remove('show');
      Eng.prof.level=lv; Eng.prof.cx=1; renderHUD(); renderLadder(); newAdaptiveTask(); };
    g.appendChild(card);
  }
}

/* ---------- boot ---------- */
function scheduleLayout(){
  if(!TASK) return;
  requestAnimationFrame(()=>requestAnimationFrame(()=>layout()));
}
window.addEventListener('resize',scheduleLayout);
if(window.visualViewport){
  visualViewport.addEventListener('resize',scheduleLayout);
}
if(typeof ResizeObserver!=='undefined'){
  const ro=new ResizeObserver(scheduleLayout);
  ro.observe(studio);
  ro.observe(board);
}
(async function(){
  await Eng.load();
  newAdaptiveTask();
  renderHUD(); renderLadder();
})();
