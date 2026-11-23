/* sheet-video scene library: timing from narration, sheet viewer with camera and overlay, side column, captions.
   Part of Oasis-Blueprints (MIT). Scenes files use these; see references/player.md. */
/* ---------- timing helpers from the narration ---------- */
function TM(i){
  const s=TIMING.scenes[i];
  return {
    c:k=>s.lead+s.cues[k],
    w:(k,ph)=>{ const st=s.sents[k], ix=st.indexOf(ph); if(ix<0) console.warn('phrase not found',i,k,ph); return s.lead+s.cues[k]+s.sdur[k]*Math.max(0,ix)/st.length; },
    end:s.lead+s.n, dur:s.dur
  };
}
const NS='http://www.w3.org/2000/svg';
function svgEl(tag,attrs,parent){ const e=document.createElementNS(NS,tag); for(const k in attrs) e.setAttribute(k,attrs[k]); if(parent) parent.appendChild(e); return e; }
const ptsStr=p=>p.map(q=>q.join(',')).join(' ');

/* ---------- viewer: a sheet crop with camera, overlay in image pixels ---------- */
function makeViewer(parent,box,name,label){
  const d=document.createElement('div'); d.className='viewer';
  Object.assign(d.style,{left:box[0]+'px',top:box[1]+'px',width:box[2]+'px',height:box[3]+'px'});
  const [iw,ih]=SIZE[name];
  const img=new Image(); img.alt=label||name; img.src=IMG[name]; img.draggable=false; img.style.width=iw+'px'; img.style.height=ih+'px'; d.appendChild(img);
  const svg=svgEl('svg',{class:'ov',width:iw,height:ih,viewBox:`0 0 ${iw} ${ih}`}); d.appendChild(svg);
  if(label){ const l=document.createElement('div'); l.className='vlabel'; l.textContent=label; d.appendChild(l); }
  parent.appendChild(d);
  const v={el:d,img,svg,W:box[2]-4,H:box[3]-4,iw,ih,s:1,tx:0,ty:0,box};
  v.fitW=Math.max(1,ih*v.W/(iw*v.H));
  v.setCam=c=>{
    const w=c.w||v.fitW, s=v.W/(w*iw), vw=v.W/s, vh=v.H/s;
    let cx=c.x*iw, cy=c.y*ih;
    cx = vw>=iw? iw/2 : clamp(cx,vw/2,iw-vw/2);
    cy = vh>=ih? ih/2 : clamp(cy,vh/2,ih-vh/2);
    v.s=s; v.tx=v.W/2-cx*s; v.ty=v.H/2-cy*s;
    const tf=`translate(${v.tx.toFixed(2)}px,${v.ty.toFixed(2)}px) scale(${s.toFixed(5)})`;
    img.style.transform=tf; svg.style.transform=tf; svg.style.setProperty('--k',(1/s).toFixed(5));
  };
  v.cam=(keys,lt)=>{
    const W=c=>({x:c.x,y:c.y,w:c.w||v.fitW});
    let cur=W(keys[0].cam);
    for(let k=1;k<keys.length;k++){
      const K=keys[k]; if(lt<=K.t && !(REDUCED&&lt>=K.t)) break;
      const p=prog(lt,K.t,K.d), n=W(K.cam);
      cur={x:cur.x+(n.x-cur.x)*p,y:cur.y+(n.y-cur.y)*p,w:Math.exp(Math.log(cur.w)+(Math.log(n.w)-Math.log(cur.w))*p)};
    }
    v.setCam(cur);
  };
  /* ring + tag around an image-pixel rectangle */
  v.ring=(label,opt={})=>{
    const r=document.createElement('div'); r.className='ring '+(opt.cls||'');
    const t=document.createElement('div'); t.className='tag '+(opt.tcls||opt.cls||''); t.textContent=label||'';
    d.appendChild(r); if(label) d.appendChild(t);
    const pad=opt.pad??10;
    return {set(rect,p,lp=p){
      const L=v.tx+rect[0]*v.s-pad, T=v.ty+rect[1]*v.s-pad, R=v.tx+rect[2]*v.s+pad, B=v.ty+rect[3]*v.s+pad;
      Object.assign(r.style,{left:L+'px',top:T+'px',width:(R-L)+'px',height:(B-T)+'px',opacity:p,visibility:p>.001?'visible':'hidden',transform:REDUCED?'none':`scale(${1.12-.12*p})`});
      if(!label) return;
      t.style.opacity=lp; t.style.visibility=lp>.001?'visible':'hidden';
      const tw=t.offsetWidth, th=t.offsetHeight, side=opt.side||'top'; let x,y;
      if(side==='top'){x=opt.align==='r'?R-tw:L; y=T-th-12;}
      else if(side==='bottom'){x=opt.align==='r'?R-tw:L; y=B+12;}
      else if(side==='right'){x=R+14; y=opt.align==='b'?B-th:T;}
      else if(side==='center'){x=(L+R-tw)/2; y=(T+B-th)/2;}
      else {x=L-tw-14; y=opt.align==='b'?B-th:T;}
      t.style.left=clamp(x,10,v.W-tw-10)+'px'; t.style.top=clamp(y,10,v.H-th-10)+'px';
    }};
  };
  return v;
}
const vshow=(v,lt,a,d=.6,outAt=null,dx=0)=>{let p=prog(lt,a,d); if(outAt!=null)p*=1-prog(lt,outAt,.6); v.el.style.opacity=p; v.el.style.visibility=p>.001?'visible':'hidden'; v.el.style.transform=(dx&&!REDUCED)?`translateX(${(1-p)*dx}px)`:'none'; return p;};
/* overlay primitives */
function drawLine(svg,pts,cls){ cls=cls||''; if(cls.includes('dash')) return svgEl('polyline',{points:ptsStr(pts),class:'ln '+cls},svg); const e=svgEl('polyline',{points:ptsStr(pts),class:'ln '+cls,pathLength:100},svg); e.style.strokeDasharray='100 100'; return e; }
function setDraw(e,p,op=1){ e.style.strokeDashoffset=String(100*(1-p)); e.style.opacity=p>0?op:0; }
function setOp(e,p){ e.style.opacity=p; }
function chevrons(svg,cols,n=6){ /* cols: [[x,y0,y1],...]; returns updater */
  const g=svgEl('g',{},svg), items=[];
  for(const c of cols) for(let i=0;i<n;i++) items.push({c,i,e:svgEl('polyline',{class:'chev'},g)});
  return (lt,op)=>{ g.style.opacity=op; if(op<=0) return; const k=+getComputedStyle(svg).getPropertyValue('--k')||1;
    for(const it of items){ const [x,y0,y1]=it.c, L=y1-y0, sp=REDUCED?0:L/6; let y=y0+((lt*sp+it.i*L/n)%L); const a=24*k;
      it.e.setAttribute('points',`${x-a},${y-a} ${x},${y} ${x+a},${y-a}`);
      it.e.style.opacity=REDUCED?1:Math.min(1,(y-y0)/(L*.15),(y1-y)/(L*.15)); } };
}

/* ---------- side column ---------- */
const side=(kick,items)=>`<div class="side"><div class="kick" data-k="kick">${kick}</div>${items.map((h,i)=>`<div class="item ${h[1]||''}" data-k="i${i}">${h[0]}</div>`).join('')}</div><img class="logo-s" data-k="logo" alt="logo">`;
const D=v=>`<span class="data">${v}</span>`;
function sideInit(k){ if(k.logo){ if(LOGO) k.logo.src=LOGO; else k.logo.style.display='none'; } }


const R2=r=>[[r[0],r[1]],[r[2],r[1]],[r[2],r[3]],[r[0],r[3]],[r[0],r[1]]];
const easeOut=p=>1-Math.pow(1-p,3);
/* explainer helpers: typed prompt bubbles, reply rows, count-ups */
const esc=s=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;');
function bub(k,who,text,cls='',tag='prompt'){
  return `<div class="bubble ${cls}" data-k="${k}"><div class="who">${who}${tag?` <i>${tag}</i>`:''}</div><div class="msg" data-text="${esc(text)}"><span class="t"></span><span class="c"></span><span class="r">${esc(text)}</span></div></div>`;
}
const reply=(k,text,cls='',ic='✓')=>`<div class="reply ${cls}" data-k="${k}"><div class="ic">${ic}</div><div>${text}</div></div>`;
function typeMsg(el,lt,start,cps=40){
  const m=el.querySelector('.msg'), t=m.querySelector('.t'), r=m.querySelector('.r'), c=m.querySelector('.c'), text=m.dataset.text;
  const n=REDUCED?(lt>=start?text.length:0):Math.floor(clamp((lt-start)*cps,0,text.length));
  if(t.textContent.length!==n){ t.textContent=text.slice(0,n); r.textContent=text.slice(n); }
  c.style.opacity=(!REDUCED && lt>=start-.3 && lt<start+text.length/cps+.5)?1:0;
}
function countTo(el,lt,a,d,target,dec=1){ const p=REDUCED?(lt>=a?1:0):easeOut(clamp((lt-a)/d)); el.textContent=(target*p).toFixed(dec); }
/* brand close card: logo, company, tagline, CTA */
const closeCard=()=>`<div class="side" style="top:140px"><img data-k="logo" alt="${esc(BRAND.company)}" style="max-height:150px;max-width:520px;mix-blend-mode:multiply;display:block;margin-bottom:34px"><div class="big" data-k="b1" style="position:static;font-size:64px">${esc(BRAND.company)}</div><div class="big" data-k="b2" style="position:static;font-size:46px;color:var(--blue);margin-top:14px">${esc(BRAND.tagline||'')}</div><div data-k="b3" style="font-size:30px;margin-top:26px;color:var(--ink)">${esc(BRAND.cta||'')}</div></div><div class="foot" data-k="ft">${esc(BRAND.footer||'')}</div>`;

/* captions: the narration, burned in */
const capEl=document.getElementById('cap'), capT=document.getElementById('capt');
let CC=true;
function updCaption(i,lt){
  const s=TIMING.scenes[i]; let txt='';
  if(CC && lt<s.lead+s.n+.5) for(const [t,c] of s.caps) if(lt>=t-.05) txt=c;
  if(capT.textContent!==txt) capT.textContent=txt;
  capEl.classList.toggle('off',!txt);
}
