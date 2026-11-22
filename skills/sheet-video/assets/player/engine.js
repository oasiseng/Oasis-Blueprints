/* sheet-video player engine: deterministic render(t), controls, audio clock. Part of Oasis-Blueprints (MIT). */
/* ---------- engine ---------- */
const root=document.getElementById('scenes');
S.forEach((s,i)=>{s.dur=TIMING.scenes[i].dur;});
let acc=0; for(const s of S){s.start=acc; acc+=s.dur;}
const TOTAL=acc;
for(const s of S){
  const e=document.createElement('div'); e.className='scene'; e.innerHTML=s.html; root.appendChild(e); s.el=e;
  s.k={}; e.querySelectorAll('[data-k]').forEach(n=>{s.k[n.dataset.k]=n;});
  if(s.init) s.init(e,s.k);
}
const corner=document.getElementById('corner'), cnum=document.getElementById('cnum'), cname=document.getElementById('cname');
let t=0, playing=false, cur=-1, last=null;
const idxAt=tt=>{for(let i=S.length-1;i>=0;i--) if(tt>=S[i].start) return i; return 0;};
function render(){
  const i=idxAt(Math.min(t,TOTAL-1e-6)), s=S[i], lt=t-s.start;
  if(i!==cur){ S.forEach((x,j)=>x.el.style.display=j===i?'block':'none'); cur=i;
    cnum.textContent=String(i+1).padStart(2,'0'); cname.textContent=s.name; document.getElementById('sname').textContent=`${i+1}/${S.length} · ${s.name}`; }
  let op=prog(lt,0,.4); if(!REDUCED && i<S.length-1) op*=1-prog(lt,s.dur-.35,.35);
  if(i===0 && lt<.05) op=REDUCED?1:op;
  s.el.style.opacity=op;
  s.update(lt,s.k); updCaption(i,lt);
  const f=t/TOTAL*100; fill.style.width=f+'%'; knob.style.left=f+'%';
  timeEl.textContent=fmt(t)+' / '+fmt(TOTAL);
}
const fmt=x=>{x=Math.max(0,Math.round(x)); return Math.floor(x/60)+':'+String(x%60).padStart(2,'0');};
/* sound: narration + beat, one pre-mixed track, played from the same clock */
const AC=window.AudioContext||window.webkitAudioContext;
const AU={ctx:null,buf:null,src:null,gain:null,on:false,muted:false,t0:0,c0:0,err:false};
const hint=document.getElementById('hint'), bSound=document.getElementById('bSound');
const ICON_SND='<svg viewBox="0 0 24 24"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3a4.5 4.5 0 0 0-2.5-4v8a4.5 4.5 0 0 0 2.5-4zM14 3.2v2.1a7 7 0 0 1 0 13.4v2.1a9 9 0 0 0 0-17.6z"/></svg>';
const ICON_MUTE='<svg viewBox="0 0 24 24"><path d="M3 9v6h4l5 5V4L7 9H3zm13.6 3 2.7-2.7-1.4-1.4-2.7 2.7-2.7-2.7-1.4 1.4 2.7 2.7-2.7 2.7 1.4 1.4 2.7-2.7 2.7 2.7 1.4-1.4z"/></svg>';
function updSound(){ const live=AU.on&&!AU.muted; bSound.innerHTML=live?ICON_SND:ICON_MUTE; bSound.classList.toggle('need',!AU.on); hint.style.display=(AU.on||EXPORT||!MIX)?'none':'flex'; bSound.style.display=MIX?'flex':'none'; }
function b64ToAB(uri){const b=atob(uri.slice(uri.indexOf(',')+1)), u=new Uint8Array(b.length); for(let i=0;i<b.length;i++)u[i]=b.charCodeAt(i); return u.buffer;}
function stopAudio(){ if(AU.src){ try{AU.src.stop();}catch(e){} AU.src.disconnect(); AU.src=null; } }
function startAudio(){
  stopAudio(); if(!AU.on||!AU.buf||!playing) return;
  const s=AU.ctx.createBufferSource(); s.buffer=AU.buf; s.connect(AU.gain);
  s.start(0,clamp(t,0,AU.buf.duration-.01)); AU.src=s; AU.c0=AU.ctx.currentTime; AU.t0=t;
}
function soundOn(){
  if(!AC||!MIX){ AU.err=true; return; }
  AU.on=true;
  if(!AU.ctx){ AU.ctx=new AC(); AU.gain=AU.ctx.createGain(); AU.gain.connect(AU.ctx.destination);
    new Promise((res,rej)=>{const p=AU.ctx.decodeAudioData(b64ToAB(MIX),res,rej); if(p&&p.then)p.then(res,rej);})
      .then(b=>{AU.buf=b; startAudio();}).catch(()=>{AU.err=true;}); }
  AU.ctx.resume&&AU.ctx.resume();
  if(t<15) t=0;
  if(!playing) play(); else startAudio();
  updSound();
}
function soundBtn(){ if(!AU.on) soundOn(); else { AU.muted=!AU.muted; AU.gain.gain.value=AU.muted?0:1; updSound(); } }
bSound.onclick=soundBtn;
const bCC=document.getElementById('bCC'); bCC.onclick=()=>{CC=!CC; bCC.style.opacity=CC?1:.45; render();}; hint.onclick=e=>{e.stopPropagation(); soundOn();};
function frame(ts){
  if(playing){
    if(AU.src && AU.ctx.state==='running') t=AU.t0+(AU.ctx.currentTime-AU.c0);
    else if(last!=null) t+=Math.min(.1,(ts-last)/1000);
    last=ts;
    if(t>=TOTAL){t=TOTAL; playing=false; stopAudio(); updBtn();} render(); }
  requestAnimationFrame(frame);
}
/* ui */
const fill=document.getElementById('fill'), knob=document.getElementById('knob'), timeEl=document.getElementById('time'), prog_=document.getElementById('prog'), track=document.getElementById('track');
S.forEach((s,i)=>{ if(i){const m=document.createElement('div'); m.className='tickm'; m.style.left=(s.start/TOTAL*100)+'%'; track.appendChild(m);} });
const bPlay=document.getElementById('bPlay');
const ICON_PLAY='<svg viewBox="0 0 24 24"><path d="M7 4v16l13-8z"/></svg>', ICON_PAUSE='<svg viewBox="0 0 24 24"><path d="M6 4h4v16H6zm8 0h4v16h-4z"/></svg>';
function updBtn(){bPlay.innerHTML=playing?ICON_PAUSE:ICON_PLAY;}
function play(){ if(t>=TOTAL) t=0; playing=true; last=null; updBtn(); startAudio(); }
function pause(){ playing=false; stopAudio(); updBtn(); render(); }
function toggle(){ playing?pause():play(); }
function seek(x){ t=clamp(x,0,TOTAL); last=null; if(playing) startAudio(); render(); }
function step(d){ const i=clamp(idxAt(Math.min(t,TOTAL-1e-6))+d,0,S.length-1); const s=S[i]; seek(playing?s.start:s.start+s.dur-(i<S.length-1?.5:0.01)); }
bPlay.onclick=toggle; document.getElementById('bRestart').onclick=()=>{seek(0);play();};
document.getElementById('bPrev').onclick=()=>step(-1); document.getElementById('bNext').onclick=()=>step(1);
document.getElementById('bFull').onclick=()=>{ if(document.fullscreenElement) document.exitFullscreen(); else document.documentElement.requestFullscreen?.(); };
let drag=false;
const seekFromEvent=e=>{const r=track.getBoundingClientRect(); seek((e.clientX-r.left)/r.width*TOTAL);};
prog_.addEventListener('pointerdown',e=>{drag=true; prog_.setPointerCapture(e.pointerId); seekFromEvent(e);});
prog_.addEventListener('pointermove',e=>{if(drag) seekFromEvent(e);});
prog_.addEventListener('pointerup',()=>{drag=false;});
addEventListener('keydown',e=>{
  if(e.key===' '||e.key==='k'){e.preventDefault(); toggle();}
  else if(e.key==='ArrowRight'){e.preventDefault(); step(1);}
  else if(e.key==='ArrowLeft'){e.preventDefault(); step(-1);}
  else if(e.key==='Home'||e.key==='r'){seek(0); play();}
  else if(e.key==='f'){document.getElementById('bFull').click();}
  else if(e.key==='m'){soundBtn();}
  else if(e.key==='c'){bCC.click();}
});
document.getElementById('stage').addEventListener('click',()=>{ if(!AU.on) soundOn(); else toggle(); });
/* scale */
const wrap=document.getElementById('wrap'), stage=document.getElementById('stage'), bar=document.getElementById('bar');
function fit(){
  const W=innerWidth, H=innerHeight, BH=56;
  const sc=Math.min(W/1920,(H-BH)/1080), sw=1920*sc, sh=1080*sc;
  const x=(W-sw)/2, y=Math.max(0,(H-BH-sh)/2);
  stage.style.transform=`scale(${sc})`; wrap.style.left=x+'px'; wrap.style.top=y+'px';
  bar.style.top=sh+'px'; bar.style.left='0px'; bar.style.width=Math.max(sw,320)+'px';
}
addEventListener('resize',fit); fit();
window.__player={seek,play,pause,total:TOTAL,audio:()=>({on:AU.on,buf:!!AU.buf,dur:AU.buf&&AU.buf.duration,err:AU.err,src:!!AU.src,state:AU.ctx&&AU.ctx.state,t}),scenes:S.map(s=>({name:s.name,start:s.start,dur:s.dur}))};
const t0=parseFloat(qs.get('t'));
updSound();
if(!isNaN(t0)){ seek(t0); updBtn(); } else { render(); play(); }
requestAnimationFrame(frame);
})();
