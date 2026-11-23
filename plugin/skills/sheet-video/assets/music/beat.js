/* Tropical Tech Funk: original synth beat, 108 BPM, A minor. Pure Web Audio, no samples.
   makeMusic(ctx, dest, {len, flourishAt, mode:'video'|'solo', duck:[[t0,t1],...], level, duckLevel}) */
function makeMusic(ctx, dest, o) {
  const SPB = 60 / 108, S16 = SPB / 4, BAR = SPB * 4;
  const mtof = m => 440 * Math.pow(2, (m - 69) / 12);
  let seed = 7;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  const nb = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
  { const d = nb.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = rnd() * 2 - 1; }

  /* ---- buses and effects ---- */
  const master = ctx.createGain(); master.connect(dest);
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -16; comp.ratio.value = 3; comp.attack.value = 0.006; comp.release.value = 0.18; comp.knee.value = 8;
  comp.connect(master);
  const bus = ctx.createGain(); bus.connect(comp);
  function makeIR(sec) {
    const n = Math.floor(ctx.sampleRate * sec), b = ctx.createBuffer(2, n, ctx.sampleRate);
    for (let c = 0; c < 2; c++) { const d = b.getChannelData(c); for (let i = 0; i < n; i++) d[i] = (rnd() * 2 - 1) * Math.pow(1 - i / n, 3.2); }
    return b;
  }
  const rev = ctx.createConvolver(); rev.buffer = makeIR(2.6);
  const revIn = ctx.createGain(); const revLP = ctx.createBiquadFilter(); revLP.type = 'lowpass'; revLP.frequency.value = 6500;
  const revOut = ctx.createGain(); revOut.gain.value = 0.32;
  revIn.connect(revLP); revLP.connect(rev); rev.connect(revOut); revOut.connect(bus);
  const dIn = ctx.createGain(), dl = ctx.createDelay(2), dr = ctx.createDelay(2), fb = ctx.createGain(), dlp = ctx.createBiquadFilter();
  dl.delayTime.value = S16 * 3; dr.delayTime.value = S16 * 3; fb.gain.value = 0.32; dlp.type = 'lowpass'; dlp.frequency.value = 3200;
  const mg = ctx.createChannelMerger(2), dOut = ctx.createGain(); dOut.gain.value = 0.3;
  dIn.connect(dl); dl.connect(dlp); dlp.connect(dr); dr.connect(fb); fb.connect(dl);
  dl.connect(mg, 0, 0); dr.connect(mg, 0, 1); mg.connect(dOut); dOut.connect(bus);

  const panNode = (p, to) => { const n = ctx.createStereoPanner(); n.pan.value = p; n.connect(to); return n; };
  const G = (v, to) => { const g = ctx.createGain(); g.gain.value = v; if (to) g.connect(to); return g; };
  const drums = G(1.6, bus), bassBus = G(0.22, bus), padBus = G(0.39, bus), keys = G(1.12, bus), fx = G(1.0, bus);
  for (const [k, n] of Object.entries({drums, bassBus, padBus, keys, fx})) if ((o.mute || []).includes(k)) n.gain.value = 0;
  const sendKeysD = G(0.55, dIn), sendKeysR = G(0.35, revIn); keys.connect(sendKeysD); keys.connect(sendKeysR);
  const sendPadR = G(0.6, revIn); padBus.connect(sendPadR);
  const sendFxR = G(0.9, revIn); fx.connect(sendFxR);
  const sendDrumR = G(0.08, revIn); drums.connect(sendDrumR);

  const osc = (type, f, t, t1, to) => { const x = ctx.createOscillator(); x.type = type; x.frequency.setValueAtTime(f, t); x.connect(to); x.start(t); x.stop(t1); return x; };
  const noise = (t, dur, to) => { const s = ctx.createBufferSource(); s.buffer = nb; s.connect(to); s.start(t, rnd() * 1.5, dur); return s; };
  const perc = (to, t, v, a, d) => { const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + d); g.connect(to); return g; };

  /* ---- instruments ---- */
  function kick(t, v) {
    const g = perc(drums, t, v, 0.003, 0.34);
    const x = osc('sine', 130, t, t + 0.4, g); x.frequency.exponentialRampToValueAtTime(46, t + 0.11);
    const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 2500; hp.connect(perc(drums, t, v * 0.25, 0.001, 0.008));
    noise(t, 0.02, hp);
  }
  function clap(t, v) {
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1500; bp.Q.value = 0.9;
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t);
    for (let k = 0; k < 3; k++) { g.gain.setValueAtTime(v, t + k * 0.011); g.gain.exponentialRampToValueAtTime(v * 0.15, t + k * 0.011 + 0.009); }
    g.gain.setValueAtTime(v, t + 0.033); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
    bp.connect(g); g.connect(panNode(0.05, drums)); noise(t, 0.25, bp);
  }
  function rim(t, v) {
    const g = perc(panNode(-0.15, drums), t, v, 0.001, 0.035);
    osc('triangle', 1720, t, t + 0.05, g);
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 3200; bp.Q.value = 2; bp.connect(g); noise(t, 0.03, bp);
  }
  function hat(t, v, open, p = 0.25) {
    const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 7800;
    hp.connect(perc(panNode(p, drums), t, v, 0.001, open ? 0.22 : 0.035)); noise(t, open ? 0.3 : 0.06, hp);
  }
  function shaker(t, v) {
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 5600; bp.Q.value = 1.1;
    bp.connect(perc(panNode(-0.35, drums), t, v, 0.012, 0.05)); noise(t, 0.08, bp);
  }
  function clave(t, v) { const g = perc(panNode(0.4, drums), t, v, 0.001, 0.06); osc('sine', 2150, t, t + 0.08, g); osc('sine', 3080, t, t + 0.05, G(0.3, g)); }
  function conga(t, v, f) { const g = perc(panNode(-0.3, drums), t, v, 0.002, 0.17); const x = osc('sine', f, t, t + 0.2, g); x.frequency.exponentialRampToValueAtTime(f * 0.86, t + 0.06); }
  function blip(t, v, f) { const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 4200; lp.connect(perc(fx, t, v, 0.001, 0.03)); osc('square', f, t, t + 0.05, lp); }
  function bass(t, m, len, v) {
    const f = mtof(m), lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 6;
    lp.frequency.setValueAtTime(1200, t); lp.frequency.exponentialRampToValueAtTime(240, t + 0.2);
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + 0.006);
    g.gain.setValueAtTime(v * 0.8, t + len - 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + len + 0.06);
    lp.connect(g); g.connect(bassBus);
    osc('sawtooth', f, t, t + len + 0.1, lp); osc('sine', f, t, t + len + 0.1, G(0.9, g));
  }
  function pad(t, notes, len, v) {
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1500; lp.Q.value = 0.4;
    const g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + 0.55);
    g.gain.setValueAtTime(v, t + len); g.gain.linearRampToValueAtTime(0, t + len + 0.9); lp.connect(g); g.connect(padBus);
    notes.forEach((m, i) => {
      const p = panNode(i % 2 ? 0.45 : -0.45, lp);
      for (const dt of [-8, 8]) { const x = osc('sawtooth', mtof(m), t, t + len + 1, G(0.18, p)); x.detune.value = dt; }
    });
  }
  function steel(t, m, v, p = 0.15) {
    const f = mtof(m), out = panNode(p, keys);
    [[1, 1, 0.9], [2, 0.42, 0.42], [3, 0.16, 0.24], [4.18, 0.06, 0.12]].forEach(([r, a, d]) => {
      const x = osc('sine', f * r, t, t + d + 0.1, perc(out, t, v * a, 0.003, d));
      if (r === 1) { x.detune.setValueAtTime(7, t); x.detune.exponentialRampToValueAtTime(0.01, t + 0.06); }
    });
  }
  function chime(t, m, v) {
    const f = mtof(m), out = panNode(0, fx);
    [[1, 1, 2.4], [2, 0.35, 1.4], [2.76, 0.22, 1.0], [5.4, 0.08, 0.5]].forEach(([r, a, d]) => osc('sine', f * r, t, t + d + 0.1, perc(out, t, v * a, 0.004, d)));
  }
  function swell(t, dur, v) {
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 0.6;
    bp.frequency.setValueAtTime(1800, t); bp.frequency.exponentialRampToValueAtTime(7000, t + dur);
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + dur); g.gain.linearRampToValueAtTime(0, t + dur + 0.05);
    bp.connect(g); g.connect(fx); noise(t, dur + 0.1, bp);
  }

  /* ---- harmony ---- */
  const CH = [
    { root: 33, pad: [57, 60, 64, 67, 71] },          // Am9
    { root: 29, pad: [53, 57, 60, 64, 67] },          // Fmaj9
    { root: 36, pad: [60, 64, 67, 71, 74] },          // Cmaj9
    { root: 31, pad: [55, 59, 62, 64, 69] },          // G6/9
  ];
  const MEL = [
    [[0, 76], [3, 79], [6, 81], [10, 83], [12, 81]],
    [[2, 79], [4, 76], [7, 72], [10, 76]],
    [[0, 79], [3, 83], [6, 84], [10, 83], [12, 79]],
    [[2, 76], [4, 74], [7, 71], [12, 74], [14, 76]],
  ];
  const SPARSE = [[[6, 76], [10, 79]], [[6, 72]], [[6, 79], [10, 83]], [[6, 74]]];

  const end = o.flourishAt, video = o.mode === 'video';
  const mel = video ? 0.17 : 0.22;
  for (let b = 0; b * BAR < end; b++) {
    const t0 = b * BAR, c = CH[b % 4], at = s => t0 + s * S16;
    const padLen = Math.min(BAR, end - t0);
    pad(t0, c.pad, padLen - 0.05, b === 0 ? 0.5 : 0.36);
    if (b === 0) { [[0.04, 88], [0.3, 93], [0.56, 95], [0.9, 100]].forEach(([dt, m], i) => chime(dt, m, 0.22 - i * 0.03)); swell(BAR - 0.9, 0.9, 0.05); continue; }
    for (let s = 0; s < 16; s++) {
      const t = at(s); if (t >= end) break;
      // bass
      const R = c.root, nxt = CH[(b + 1) % 4].root;
      const bp = { 0: [R, 2.6], 3: [R + 12, 1], 6: [R, 1.6], 10: [R + 7, 1], 12: [R, 1], 14: [nxt + (nxt > R ? -1 : 2), 1] }[s];
      if (bp) bass(t, bp[0], bp[1] * S16, s === 0 ? 0.55 : 0.42);
      // hats
      const off = s % 4 === 2;
      if (b === 1) { if (off) hat(t, 0.12, false); continue; }
      hat(t, off ? 0.2 : 0.07, s === 14 && b % 2 === 1, s % 2 ? 0.3 : 0.15);
      shaker(t, s % 2 ? 0.05 : 0.08);
      if (s === 0 || s === 8) kick(t, 0.85); if (s === 11) kick(t, 0.35);
      if (s === 4 || s === 12) clap(t, 0.42);
      if ((s === 3 || s === 10) && b % 2) rim(t, 0.18);
      const cl = b % 2 ? [4, 8] : [0, 6, 12]; if (cl.includes(s)) clave(t, 0.08);
      if (s === 7 || s === 15) conga(t, 0.16, s === 7 ? 240 : 196);
    }
    if (b < 2) continue;
    const ph = Math.floor((b - 2) / 4);
    const full = video ? ph % 3 === 0 : true;
    (full ? MEL : SPARSE)[b % 4].forEach(([s, m]) => { const t = at(s); if (t < end) steel(t, m, mel, s % 4 === 2 ? 0.25 : -0.05); });
    if ((b - 2) % 4 === 0) { blip(at(0), 0.05, 1760); blip(at(2), 0.04, 2637); }
    if (video && (b + 1) % 8 === 0) swell(t0 + BAR * 0.5, BAR * 0.5 - 0.02, 0.035);
  }
  /* ---- flourish and final accent ---- */
  const F = end;
  [81, 83, 84, 88, 91, 93].forEach((m, k) => steel(F + k * S16, m, 0.2 - k * 0.01, -0.3 + k * 0.12));
  hat(F + 2 * S16, 0.12, false); hat(F + 4 * S16, 0.12, false);
  swell(F, 6 * S16 - 0.01, 0.05);
  const A = F + 6 * S16;
  kick(A, 0.95); clap(A, 0.35); bass(A, 33, 0.55, 0.6);
  [69, 72, 76, 79, 83].forEach((m, i) => steel(A + i * 0.012, m, 0.16, -0.4 + i * 0.2));
  chime(A + 0.02, 93, 0.18); chime(A + 0.05, 100, 0.08);
  pad(A, [57, 64, 67, 71], 0.5, 0.3);

  /* ---- level, ducking, clean ending ---- */
  const L = o.level ?? 0.9, D = o.duckLevel ?? L;
  const gm = master.gain; gm.setValueAtTime(L, 0);
  for (const [a, b] of (o.duck || [])) {
    gm.setValueAtTime(L, Math.max(0, a - 0.35)); gm.linearRampToValueAtTime(D, Math.max(0.01, a - 0.05));
    gm.setValueAtTime(D, b + 0.05); gm.linearRampToValueAtTime(L, b + 0.45);
  }
  gm.setValueAtTime(L, o.len - 0.35); gm.linearRampToValueAtTime(0, o.len - 0.02);
}
