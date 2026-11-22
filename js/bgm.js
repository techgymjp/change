/*
 * スーパーマーケット風 BGM（オリジナル曲。Web Audio でその場で演奏する）
 * ゆったりしたボサノバ風: エレピのコード + ウッドベース + ブラシ系ドラム + ビブラフォンのメロディ
 * F メジャー、I–vi–ii–V を中心にした 8 小節ループ。
 */
(function () {
  'use strict';
  const BPM = 108;
  const STEP = 60 / BPM / 4; // 16 分音符の長さ
  const LOOKAHEAD = 0.25;

  let ctx = null, out = null, verb = null;
  let timer = null, nextTime = 0, step = 0;
  let on = true;
  try { on = localStorage.getItem('otsuri-bgm') !== '0'; } catch (e) { /* ignore */ }

  const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

  // ---- 楽譜 ----
  // コード（エレピのボイシング）とベースのルート
  const CHORDS = [
    { v: [53, 57, 60, 64], root: 41 }, // Fmaj7
    { v: [50, 53, 57, 60], root: 38 }, // Dm7
    { v: [55, 58, 62, 65], root: 43 }, // Gm7
    { v: [48, 52, 55, 58], root: 36 }, // C7
    { v: [52, 55, 57, 60], root: 45 }, // Am7
    { v: [54, 57, 60, 62], root: 38 }, // D7
    { v: [55, 58, 62, 65], root: 43 }, // Gm7
    { v: [48, 52, 55, 58], root: 36 }, // C7
  ];
  // メロディ: [小節内の 16 分位置, 音, 長さ(16分)]
  const MELODY = [
    [[0, 69, 3], [4, 72, 2], [6, 76, 4], [10, 74, 2], [12, 72, 4]],
    [[0, 74, 3], [4, 69, 4], [8, 65, 2], [10, 69, 2], [12, 72, 4]],
    [[0, 70, 3], [4, 74, 2], [6, 77, 4], [10, 76, 2], [12, 74, 4]],
    [[0, 72, 6], [6, 70, 2], [8, 67, 6]],
    [[0, 76, 3], [4, 72, 2], [6, 69, 2], [8, 72, 2], [10, 76, 2], [12, 79, 4]],
    [[0, 78, 4], [4, 76, 2], [6, 74, 2], [8, 72, 4], [12, 69, 4]],
    [[0, 70, 2], [2, 72, 2], [4, 74, 4], [8, 77, 2], [10, 76, 2], [12, 74, 4]],
    [[0, 72, 4], [4, 74, 2], [6, 76, 2], [8, 77, 8]],
  ];
  const COMP = [[0, 3], [6, 2], [10, 3]]; // ボサノバ風のコードの刻み

  function setup() {
    if (ctx) return true;
    ctx = window.OtsuriSound && window.OtsuriSound.context();
    if (!ctx) return false;
    out = ctx.createGain();
    out.gain.value = 0;
    out.connect(ctx.destination);
    // 店内の響き（簡易リバーブ）
    verb = ctx.createConvolver();
    const len = ctx.sampleRate * 2;
    const ir = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = ir.getChannelData(ch);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
    }
    verb.buffer = ir;
    const wet = ctx.createGain();
    wet.gain.value = 0.28;
    verb.connect(wet);
    wet.connect(out);
    return true;
  }

  function dest(gain, wetSend) {
    const g = ctx.createGain();
    g.gain.value = gain;
    g.connect(out);
    if (wetSend) {
      const s = ctx.createGain();
      s.gain.value = wetSend;
      g.connect(s);
      s.connect(verb);
    }
    return g;
  }

  // エレピ（FM でベルっぽいアタック）
  function epiano(m, t, dur, vel) {
    const f = mtof(m);
    const car = ctx.createOscillator(), mod = ctx.createOscillator();
    const mg = ctx.createGain(), g = ctx.createGain();
    car.frequency.value = f;
    mod.frequency.value = f * 7;
    mg.gain.setValueAtTime(f * 1.2, t);
    mg.gain.exponentialRampToValueAtTime(f * 0.05, t + 0.25);
    mod.connect(mg);
    mg.connect(car.frequency);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vel, t + 0.008);
    g.gain.exponentialRampToValueAtTime(vel * 0.35, t + 0.5);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.35);
    car.connect(g);
    g.connect(dest(1, 0.5));
    [car, mod].forEach((o) => { o.start(t); o.stop(t + dur + 0.4); });
  }

  // ビブラフォン（トレモロ付き）
  function vibe(m, t, dur) {
    const f = mtof(m);
    const o1 = ctx.createOscillator(), o2 = ctx.createOscillator();
    const g = ctx.createGain(), trem = ctx.createGain(), lfo = ctx.createOscillator(), lg = ctx.createGain();
    o1.frequency.value = f;
    o2.frequency.value = f * 4;
    const g2 = ctx.createGain();
    g2.gain.value = 0.12;
    o2.connect(g2);
    g2.connect(g);
    o1.connect(g);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.16, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.9);
    lfo.frequency.value = 5.2;
    lg.gain.value = 0.35;
    lfo.connect(lg);
    lg.connect(trem.gain);
    trem.gain.value = 0.75;
    g.connect(trem);
    trem.connect(dest(1, 0.7));
    [o1, o2, lfo].forEach((o) => { o.start(t); o.stop(t + dur + 1); });
  }

  // ウッドベース
  function bass(m, t, dur) {
    const o = ctx.createOscillator(), lp = ctx.createBiquadFilter(), g = ctx.createGain();
    o.type = 'triangle';
    o.frequency.value = mtof(m);
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(900, t);
    lp.frequency.exponentialRampToValueAtTime(300, t + 0.2);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.5, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.15, t + dur * 0.7);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.05);
    o.connect(lp);
    lp.connect(g);
    g.connect(dest(1, 0.1));
    o.start(t);
    o.stop(t + dur + 0.1);
  }

  let noiseBuf = null;
  function noiseHit(t, freq, type, len, vol, wet) {
    if (!noiseBuf) {
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 0.3, ctx.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    const n = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    n.buffer = noiseBuf;
    f.type = type;
    f.frequency.value = freq;
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + len);
    n.connect(f);
    f.connect(g);
    g.connect(dest(1, wet || 0));
    n.start(t);
    n.stop(t + len + 0.02);
  }
  function kick(t) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.frequency.setValueAtTime(110, t);
    o.frequency.exponentialRampToValueAtTime(45, t + 0.12);
    g.gain.setValueAtTime(0.45, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.25);
    o.connect(g);
    g.connect(dest(1));
    o.start(t);
    o.stop(t + 0.3);
  }

  function playStep(s, t) {
    const bar = Math.floor(s / 16) % 8, pos = s % 16;
    const ch = CHORDS[bar];
    COMP.forEach(([p, d]) => {
      if (p === pos) ch.v.forEach((m, i) => epiano(m, t + i * 0.006, d * STEP, 0.07));
    });
    MELODY[bar].forEach(([p, m, d]) => { if (p === pos) vibe(m, t, d * STEP); });
    const next = CHORDS[(bar + 1) % 8].root;
    if (pos === 0) bass(ch.root, t, 5 * STEP);
    if (pos === 6) bass(ch.root + 7, t, 2 * STEP);
    if (pos === 8) bass(ch.root + 7, t, 5 * STEP);
    if (pos === 14) bass(next - 1, t, 2 * STEP);
    // ドラム（控えめ）
    if (pos % 2 === 0) noiseHit(t, 8000, 'highpass', 0.04, pos % 4 === 0 ? 0.05 : 0.08);
    else noiseHit(t, 6000, 'highpass', 0.02, 0.025); // シェイカー
    if (pos === 0 || pos === 8) kick(t);
    if (pos === 4 || pos === 12 || (pos === 10 && bar % 2)) noiseHit(t, 1700, 'bandpass', 0.03, 0.18, 0.2); // リムショット
  }

  function tick() {
    while (nextTime < ctx.currentTime + LOOKAHEAD) {
      // 16 分の後ろを少し遅らせてスウィング
      const swing = step % 2 ? STEP * 0.12 : 0;
      playStep(step, nextTime + swing);
      nextTime += STEP;
      step++;
    }
  }

  function start() {
    if (!on || timer || !setup()) return;
    if (ctx.state === 'suspended') ctx.resume();
    nextTime = ctx.currentTime + 0.1;
    out.gain.cancelScheduledValues(ctx.currentTime);
    out.gain.setValueAtTime(out.gain.value, ctx.currentTime);
    out.gain.linearRampToValueAtTime(0.32, ctx.currentTime + 1.5);
    timer = setInterval(tick, 50);
    tick();
  }
  function stop() {
    if (!timer) return;
    clearInterval(timer);
    timer = null;
    out.gain.cancelScheduledValues(ctx.currentTime);
    out.gain.setValueAtTime(out.gain.value, ctx.currentTime);
    out.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.4);
  }
  function setOn(v) {
    on = v;
    try { localStorage.setItem('otsuri-bgm', v ? '1' : '0'); } catch (e) { /* ignore */ }
    if (v) start();
    else stop();
  }
  // タブが裏に回ったら止める
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stop();
    else if (on && ctx) start();
  });

  window.OtsuriBGM = { start, stop, setOn, isOn: () => on };
})();
