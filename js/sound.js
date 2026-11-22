/*
 * 効果音（Web Audio で合成。音声ファイル不要）
 * 硬貨の音は金属円板の非整数倍音 + 短いアタックノイズで「チャリン」を作る。
 */
(function () {
  'use strict';
  let ctx = null;
  let master = null;
  let muted = false;
  try { muted = localStorage.getItem('otsuri-muted') === '1'; } catch (e) { /* ignore */ }

  function ac() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.55;
      // 少しだけ残響（金属の響き）
      const comp = ctx.createDynamicsCompressor();
      master.connect(comp);
      comp.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  let noiseBuf = null;
  function noise() {
    if (!noiseBuf) {
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 0.5, ctx.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    const s = ctx.createBufferSource();
    s.buffer = noiseBuf;
    return s;
  }

  // 金属円板のモード比（おおよそ）
  const RATIOS = [1, 1.594, 2.136, 2.653, 3.156, 3.652, 4.06];

  /**
   * 硬貨 1 枚がぶつかる音
   * @param {number} f 基音（小さく薄い硬貨ほど高い）
   * @param {number} ring 響きの長さ（秒）
   * @param {number} vol 音量
   * @param {number} t 開始時刻のオフセット
   */
  function clink(f, ring, vol, t) {
    if (muted || !ac()) return;
    const now = ctx.currentTime + (t || 0);
    const out = ctx.createGain();
    out.gain.value = vol;
    out.connect(master);
    const detune = 1 + (Math.random() - 0.5) * 0.04;
    RATIOS.forEach((r, i) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'sine';
      o.frequency.value = f * r * detune * (1 + (Math.random() - 0.5) * 0.006);
      const a = (1 / (i + 1.4)) * (0.6 + Math.random() * 0.5);
      const dur = ring * (1.2 - i * 0.12);
      g.gain.setValueAtTime(0, now);
      g.gain.linearRampToValueAtTime(a, now + 0.002);
      g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
      o.connect(g);
      g.connect(out);
      o.start(now);
      o.stop(now + dur + 0.05);
    });
    // 当たった瞬間の「カチッ」
    const n = noise();
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = Math.min(9000, f * 3);
    bp.Q.value = 1.2;
    const ng = ctx.createGain();
    ng.gain.setValueAtTime(vol * 0.9, now);
    ng.gain.exponentialRampToValueAtTime(0.0001, now + 0.03);
    n.connect(bp);
    bp.connect(ng);
    ng.connect(master);
    n.start(now, Math.random() * 0.4);
    n.stop(now + 0.04);
  }

  // 紙幣の「パサッ」
  function paper(t) {
    if (muted || !ac()) return;
    const now = ctx.currentTime + (t || 0);
    const n = noise();
    const hp = ctx.createBiquadFilter();
    hp.type = 'bandpass';
    hp.frequency.value = 2600;
    hp.Q.value = 0.6;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, now);
    for (let i = 0; i < 5; i++) {
      g.gain.linearRampToValueAtTime(0.25 + Math.random() * 0.25, now + 0.015 + i * 0.03);
      g.gain.linearRampToValueAtTime(0.05, now + 0.03 + i * 0.03);
    }
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.22);
    n.connect(hp);
    hp.connect(g);
    g.connect(master);
    n.start(now, Math.random() * 0.2);
    n.stop(now + 0.25);
  }

  // 額面ごとの音色（基音Hz, 響き秒, 音量）
  const TONE = {
    JPY: { 1: [3900, 0.12, 0.35], 5: [2500, 0.45, 0.5], 10: [2250, 0.35, 0.5], 50: [2900, 0.55, 0.5], 100: [2650, 0.6, 0.55], 500: [1900, 0.8, 0.6] },
    USD: { 1: [2700, 0.3, 0.5], 5: [2300, 0.5, 0.55], 10: [3300, 0.55, 0.45], 25: [2000, 0.7, 0.6] },
  };

  function money(code, v, t, soft) {
    const tone = TONE[code] && TONE[code][v];
    if (!tone) return paper(t);
    clink(tone[0], tone[1], tone[2] * (soft ? 0.55 : 1), t);
  }

  // レジの「チーン」
  function register() {
    if (muted || !ac()) return;
    const now = ctx.currentTime;
    [[2093, 0], [2637, 0.09]].forEach(([f, dt]) => {
      [1, 2.76, 5.4].forEach((r, i) => {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.frequency.value = f * r;
        g.gain.setValueAtTime(0, now + dt);
        g.gain.linearRampToValueAtTime(0.22 / (i + 1), now + dt + 0.004);
        g.gain.exponentialRampToValueAtTime(0.0001, now + dt + 1.2 / (i + 1));
        o.connect(g);
        g.connect(master);
        o.start(now + dt);
        o.stop(now + dt + 1.3);
      });
    });
    // ドロワーが開く「ガシャ」
    const n = noise();
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 900;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, now + 0.18);
    g.gain.linearRampToValueAtTime(0.5, now + 0.2);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.38);
    n.connect(lp);
    lp.connect(g);
    g.connect(master);
    n.start(now + 0.18);
    n.stop(now + 0.4);
  }

  // お釣りを手のひらに: 1 枚ずつジャラジャラ
  function changeShower(code, counts, denoms) {
    let t = 0.45;
    for (let i = denoms.length - 1; i >= 0; i--) {
      for (let k = 0; k < counts[i]; k++) {
        money(code, denoms[i].v, t);
        t += 0.07 + Math.random() * 0.06;
      }
    }
    return t;
  }

  // パーフェクトのファンファーレ（ベル）
  function fanfare(delay) {
    if (muted || !ac()) return;
    [1568, 1976, 2349, 3136].forEach((f, i) => clink(f, 0.9, 0.35, (delay || 0) + i * 0.09));
  }
  function thud(delay) {
    if (muted || !ac()) return;
    clink(700, 0.25, 0.4, delay || 0);
  }

  // 小銭入れから硬貨をつまみ上げる（周りの硬貨とこすれる音）
  function pickup(code, v) {
    if (muted || !ac()) return;
    money(code, v, 0, true);
    scrape(0.01, 0.12, 0.18);
  }
  // 小銭入れの山に置く（ほかの硬貨に当たって 2 回鳴る）
  function drop(code, v) {
    money(code, v, 0);
    money(code, v, 0.06 + Math.random() * 0.04, true);
  }
  // 金属どうしがこすれる「シャリッ」
  function scrape(t, dur, vol) {
    if (muted || !ac()) return;
    const now = ctx.currentTime + (t || 0);
    const n = noise();
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 5200;
    bp.Q.value = 2.5;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, now);
    g.gain.linearRampToValueAtTime(vol, now + dur * 0.3);
    g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
    n.connect(bp);
    bp.connect(g);
    g.connect(master);
    n.start(now, Math.random() * 0.2);
    n.stop(now + dur + 0.02);
  }
  // 硬貨投入口へ: チャリン → 機械の中を転がって選別される「カラカラ」
  function insert(code, v) {
    if (muted || !ac()) return;
    money(code, v, 0);
    for (let i = 0; i < 5; i++) {
      const t = 0.12 + i * (0.05 + i * 0.012);
      const tone = TONE[code] && TONE[code][v];
      clink((tone ? tone[0] : 2500) * (0.7 + Math.random() * 0.15), 0.07, 0.18 * (1 - i * 0.15), t);
    }
    // 選別機のモーター
    const now = ctx.currentTime + 0.1;
    const o = ctx.createOscillator();
    const lp = ctx.createBiquadFilter();
    const g = ctx.createGain();
    o.type = 'sawtooth';
    o.frequency.value = 95;
    lp.type = 'lowpass';
    lp.frequency.value = 420;
    g.gain.setValueAtTime(0.0001, now);
    g.gain.linearRampToValueAtTime(0.06, now + 0.05);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.45);
    o.connect(lp);
    lp.connect(g);
    g.connect(master);
    o.start(now);
    o.stop(now + 0.5);
  }
  // 返却口から戻ってくる
  function returnCoins() {
    if (muted || !ac()) return;
    scrape(0, 0.25, 0.12);
  }
  // 小銭入れを振る: ジャラジャラ
  function shake(code, values) {
    if (muted || !ac()) return;
    const n = Math.min(24, values.length * 2);
    for (let i = 0; i < n; i++) money(code, values[i % values.length], Math.random() * 0.45, Math.random() < 0.6);
    scrape(0, 0.45, 0.16);
  }
  function reject() {
    if (muted || !ac()) return;
    const now = ctx.currentTime;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'square';
    o.frequency.value = 330;
    g.gain.setValueAtTime(0.06, now);
    g.gain.setValueAtTime(0.0001, now + 0.12);
    g.gain.setValueAtTime(0.06, now + 0.17);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.3);
    o.connect(g);
    g.connect(master);
    o.start(now);
    o.stop(now + 0.32);
  }

  function setMuted(m) {
    muted = m;
    try { localStorage.setItem('otsuri-muted', m ? '1' : '0'); } catch (e) { /* ignore */ }
    if (!m) { ac(); clink(2650, 0.5, 0.5, 0); }
  }

  window.OtsuriSound = { context: ac, money, pickup, drop, insert, returnCoins, shake, reject, register, changeShower, fanfare, thud, setMuted, isMuted: () => muted, unlock: ac };
})();
