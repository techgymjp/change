/* お釣りピッタリ — 画面制御 */
(function () {
  'use strict';
  const C = window.OtsuriCore;
  const $ = (id) => document.getElementById(id);
  const S = window.OtsuriSound;
  const ART = window.OtsuriArt;
  const BGM = window.OtsuriBGM;
  const I = window.OtsuriI18n;
  const t = I.t;
  const money = (v) => I.money(state.cur, v);
  const AUTO_MS = 6000; // 結果表示から自動で次の会計に進むまでの時間
  let autoTimer = null;

  const state = {
    cur: null,
    code: '',
    seed: '',
    rounds: [],
    index: 0,
    wallet: [],
    tray: [],
    score: 0,
    perfect: 0,
    history: [],
    pieces: [],
  };

  // ---------- 保存（使えない環境でも動くように） ----------
  function load(key) {
    try { return JSON.parse(localStorage.getItem(key)); } catch (e) { return null; }
  }
  function save(key, v) {
    try { localStorage.setItem(key, JSON.stringify(v)); } catch (e) { /* ignore */ }
  }

  // ---------- お金の見た目 ----------
  function moneyEl(cur, i, extra) {
    const d = cur.denoms[i];
    const el = document.createElement(extra && extra.tag ? extra.tag : 'div');
    el.className = (d.coin ? 'coin' : 'bill') + ' ' + cur.code.toLowerCase() + '-' + d.v + (d.hole ? ' hole' : '');
    el.innerHTML = '<img src="' + ART.moneyImage(cur.code, d.v) + '" alt="" draggable="false">';
    el.title = d.name;
    el.setAttribute('aria-label', d.name);
    return el;
  }

  function moneyLine(cur, counts) {
    const box = document.createElement('div');
    box.className = 'money-line';
    for (let i = cur.denoms.length - 1; i >= 0; i--) {
      for (let k = 0; k < counts[i]; k++) box.appendChild(moneyEl(cur, i));
    }
    if (!box.children.length) box.innerHTML = '<span class="none">' + t('none') + '</span>';
    return box;
  }

  function describe(cur, counts) {
    const parts = [];
    for (let i = cur.denoms.length - 1; i >= 0; i--) {
      if (counts[i]) parts.push(I.coinName(cur, cur.denoms[i].v, cur.denoms[i].name) + '×' + counts[i]);
    }
    return parts.join(I.lang() === 'en' ? ', ' : '、') || t('none');
  }

  // ---------- 画面切り替え ----------
  function show(id) {
    ['screenStart', 'screenHowto', 'screenGame', 'screenEnd'].forEach((s) => ($(s).hidden = s !== id));
    $('hud').hidden = id !== 'screenGame';
    document.body.classList.toggle('playing', id === 'screenGame');
    window.scrollTo(0, 0);
  }

  function randomSeed() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let s = '';
    for (let i = 0; i < 6; i++) s += chars[Math.floor(Math.random() * chars.length)];
    return s;
  }

  // ---------- ゲーム進行 ----------
  function startGame(code, seed) {
    state.code = code;
    state.cur = C.CURRENCIES[code];
    state.seed = seed || randomSeed();
    state.rounds = C.generateGame(code, state.seed);
    state.index = 0;
    state.score = 0;
    state.perfect = 0;
    state.history = [];
    state.elapsed = 0;
    state.roundStart = null;
    document.body.dataset.cur = code.toLowerCase();
    try {
      const url = new URL(location.href);
      url.searchParams.set('cur', code);
      url.searchParams.set('code', state.seed);
      history.replaceState(null, '', url);
    } catch (e) { /* ignore */ }
    show('screenGame');
    startRound();
  }

  // ---------- 小銭入れ（硬貨の山）と自動釣銭機 ----------
  // 硬貨の直径（mm）。表示サイズは小銭入れの幅に合わせて拡大縮小する
  const DIAMETER_MM = {
    JPY: { 1: 20, 5: 22, 10: 23.5, 50: 21, 100: 22.6, 500: 26.5 },
    USD: { 1: 19.05, 5: 21.21, 10: 17.91, 25: 24.26 },
  };
  // 厚さ（mm）。影の落ち方に使う
  const THICK_MM = {
    JPY: { 1: 1.5, 5: 1.5, 10: 1.5, 50: 1.7, 100: 1.7, 500: 1.8 },
    USD: { 1: 1.52, 5: 1.95, 10: 1.35, 25: 1.75 },
  };
  let pieceSeq = 0;
  let zTop = 1;
  let drag = null;

  function gauss() {
    let u = 0, v = 0;
    while (!u) u = Math.random();
    while (!v) v = Math.random();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

  function pxPerMm() {
    const box = $('purse');
    const w = Math.min(box.clientWidth || 340, (box.clientHeight || 280) * 1.25);
    return clamp((w / 360) * 2.75, 2.3, 3.4);
  }
  function diameter(p) {
    return DIAMETER_MM[state.code][state.cur.denoms[p.i].v] * pxPerMm();
  }
  function isCoin(p) {
    return state.cur.denoms[p.i].coin;
  }

  function createPieceEl(p) {
    const cur = state.cur;
    const d = cur.denoms[p.i];
    const el = document.createElement('div');
    el.className = 'pcoin';
    el.dataset.v = d.v;
    el.innerHTML = '<img src="' + ART.moneyImage(cur.code, d.v, p.face) + '" alt="" draggable="false">';
    el.title = d.name;
    el.setAttribute('role', 'button');
    el.setAttribute('aria-label', d.name);
    el.addEventListener('pointerdown', (e) => onDown(e, p));
    p.el = el;
    return el;
  }

  // 山の中心付近に正規分布で散らす（重なりやすい）
  function scatter(p, spread) {
    p.x = clamp(0.5 + gauss() * (spread || 0.13), 0.1, 0.9);
    p.y = clamp(0.58 + gauss() * (spread || 0.13) * 1.1, 0.12, 0.88);
    p.rot = Math.floor(Math.random() * 360);
  }

  function startRound() {
    const r = state.rounds[state.index];
    state.wallet = r.wallet.slice();
    state.tray = C.zeros(state.cur);
    state.pieces = [];
    $('purse').innerHTML = '';
    // 硬貨はシャッフルしてから順に積む（後から積んだものほど上）
    const coins = [];
    state.wallet.forEach((n, i) => {
      // 表と裏はランダム
      for (let k = 0; k < n; k++) coins.push({ id: ++pieceSeq, i, where: 'purse', face: Math.random() < 0.5 ? 'a' : 'b' });
    });
    for (let k = coins.length - 1; k > 0; k--) {
      const j = Math.floor(Math.random() * (k + 1));
      [coins[k], coins[j]] = [coins[j], coins[k]];
    }
    zTop = 1;
    coins.forEach((p) => {
      scatter(p);
      p.z = zTop++;
      state.pieces.push(p);
    });
    state.pieces.forEach((p) => {
      createPieceEl(p);
      $('purse').appendChild(p.el);
    });
    $('price').textContent = money(r.price);
    $('price').classList.remove('pop');
    void $('price').offsetWidth;
    $('price').classList.add('pop');
    $('purseOuter').classList.remove('shake');
    state.roundStart = performance.now();
    render();
  }

  function layoutPurse() {
    const box = $('purse');
    const W = box.clientWidth, H = box.clientHeight;
    const list = state.pieces.filter((p) => p.where === 'purse' && isCoin(p) && p !== (drag && drag.lifted && drag.p));
    list.forEach((p) => {
      const d = diameter(p);
      p._d = d;
      p._cx = clamp(p.x * W, d / 2, W - d / 2);
      p._cy = clamp(p.y * H, d / 2, H - d / 2);
    });
    list.forEach((p) => {
      // 上に重なっている硬貨の数だけ暗く（下にあるほど見えにくい）
      let over = 0;
      list.forEach((q) => {
        if (q.z > p.z && Math.hypot(q._cx - p._cx, q._cy - p._cy) < (q._d + p._d) * 0.46) over++;
      });
      const el = p.el;
      el.style.width = el.style.height = p._d + 'px';
      el.style.left = p._cx - p._d / 2 + 'px';
      el.style.top = p._cy - p._d / 2 + 'px';
      el.style.zIndex = p.z;
      el.style.setProperty('--rot', p.rot + 'deg');
      el.style.setProperty('--shade', Math.max(0.55, 1 - over * 0.13));
      el.style.setProperty('--t', (THICK_MM[state.code][state.cur.denoms[p.i].v] * pxPerMm()).toFixed(1) + 'px');
    });
  }

  function render() {
    const cur = state.cur;
    const r = state.rounds[state.index];
    $('hudRound').textContent = state.index + 1 + '/' + C.ROUNDS;
    $('hudScore').textContent = state.score;
    $('hudPerfect').textContent = state.perfect;

    state.tray = C.zeros(cur);
    const remain = C.zeros(cur);
    state.pieces.forEach((p) => (p.where === 'machine' ? state.tray : remain)[p.i]++);

    layoutPurse();
    $('walletCoins').textContent = C.coinCount(remain, cur);
    $('walletSum').textContent = money(C.total(remain, cur));
    // 中身メモ
    const memo = [];
    for (let i = cur.denoms.length - 1; i >= 0; i--) {
      if (remain[i]) memo.push('<span class="chip"><img src="' + ART.moneyImage(cur.code, cur.denoms[i].v) + '" alt="">' + (cur.code === 'JPY' ? money(cur.denoms[i].v) : cur.denoms[i].label) + ' ×' + remain[i] + '</span>');
    }
    $('memo').innerHTML = '<small>' + t('memo') + '</small>' + (memo.join('') || t('empty'));

    // 投入したお金
    const ins = $('inserted');
    ins.innerHTML = '';
    state.pieces.filter((p) => p.where === 'machine').forEach((p) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'ins-coin';
      b.innerHTML = '<img src="' + ART.moneyImage(cur.code, cur.denoms[p.i].v, p.face) + '" alt="">';
      b.title = t('returnOne', { name: I.coinName(cur, cur.denoms[p.i].v, cur.denoms[p.i].name) });
      b.addEventListener('click', () => returnPieces([p]));
      ins.appendChild(b);
    });

    const paid = C.total(state.tray, cur);
    $('paidSum').textContent = money(paid);
    const st = $('status');
    if (paid === 0) {
      st.textContent = t('stInsert');
      st.className = 'lcd-row msg';
    } else if (paid < r.price) {
      st.textContent = t('stShort', { v: money(r.price - paid) });
      st.className = 'lcd-row msg short';
    } else if (paid === r.price) {
      st.textContent = t('stExact');
      st.className = 'lcd-row msg ok';
    } else {
      st.textContent = t('stChange', { v: money(paid - r.price) });
      st.className = 'lcd-row msg ok';
    }
    $('btnPay').disabled = paid < r.price;
    $('btnReturn').disabled = paid === 0;
  }

  // ---- ドラッグ操作 ----
  function onDown(e, p) {
    if (drag || e.button > 0) return;
    e.preventDefault();
    const rect = p.el.getBoundingClientRect();
    drag = { p, startX: e.clientX, startY: e.clientY, offX: e.clientX - rect.left, offY: e.clientY - rect.top, w: rect.width, h: rect.height, lifted: false, pid: e.pointerId };
    // 要素を body へ移すとポインターキャプチャが外れるので window で追跡する
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
  }

  function lift() {
    const p = drag.p;
    drag.lifted = true;
    document.body.appendChild(p.el);
    p.el.classList.add('dragging');
    p.el.style.width = drag.w + 'px';
    p.el.style.height = drag.h + 'px';
    p.el.style.zIndex = 1000;
    S.pickup(state.code, state.cur.denoms[p.i].v);
    layoutPurse(); // 持ち上げたことで下の硬貨が見えるように陰を更新
  }

  function overSlot(x, y, el) {
    const r = el.getBoundingClientRect();
    const pad = 22;
    return x > r.left - pad && x < r.right + pad && y > r.top - pad && y < r.bottom + pad;
  }

  function onMove(e) {
    if (!drag || e.pointerId !== drag.pid) return;
    if (!drag.lifted) {
      if (Math.hypot(e.clientX - drag.startX, e.clientY - drag.startY) < 5) return;
      lift();
    }
    const el = drag.p.el;
    el.style.left = e.clientX - drag.offX + 'px';
    el.style.top = e.clientY - drag.offY + 'px';
    $('coinSlot').classList.toggle('hot', overSlot(e.clientX, e.clientY, $('coinSlot')));
  }

  function onUp(e) {
    if (!drag || e.pointerId !== drag.pid) return;
    const { p } = drag;
    const el = p.el;
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', onUp);
    window.removeEventListener('pointercancel', onUp);
    $('coinSlot').classList.remove('hot');
    const wasLifted = drag.lifted;
    drag = null;
    if (!wasLifted) {
      // タップだけ: 少し揺らしてヒント
      el.classList.remove('nudge');
      void el.offsetWidth;
      el.classList.add('nudge');
      S.money(state.code, state.cur.denoms[p.i].v, 0, true);
      toast(t('dragHint'));
      return;
    }
    el.classList.remove('dragging');
    const x = e.clientX, y = e.clientY;
    if (overSlot(x, y, $('coinSlot'))) return insert(p, $('coinSlot'));
    {
      const box = $('purse').getBoundingClientRect();
      if (x > box.left && x < box.right && y > box.top && y < box.bottom) {
        // 小銭入れの中に置き直す（いちばん上に乗る）
        const er = el.getBoundingClientRect();
        p.x = (er.left + er.width / 2 - box.left) / box.width;
        p.y = (er.top + er.height / 2 - box.top) / box.height;
        p.x = clamp(p.x, 0, 1);
        p.y = clamp(p.y, 0, 1);
        p.z = ++zTop;
        el.style.left = el.style.top = '';
        $('purse').appendChild(el);
        S.drop(state.code, state.cur.denoms[p.i].v);
        render();
        return;
      }
    }
    flyBack(p);
  }
  // 元の場所へ戻す
  function flyBack(p) {
    const el = p.el;
    el.style.left = el.style.top = el.style.width = el.style.height = '';
    $('purse').appendChild(el);
    S.drop(state.code, state.cur.denoms[p.i].v);
    render();
  }

  function insert(p, slot) {
    const el = p.el;
    const r = slot.querySelector('.slit').getBoundingClientRect();
    const er = el.getBoundingClientRect();
    el.classList.add('inserting');
    el.style.left = r.left + r.width / 2 - er.width / 2 + 'px';
    el.style.top = r.top + r.height / 2 - er.height / 2 + 'px';
    slot.classList.add('eat');
    setTimeout(() => slot.classList.remove('eat'), 400);
    p.where = 'machine';
    S.insert(state.code, state.cur.denoms[p.i].v);
    setTimeout(() => {
      el.remove();
      el.classList.remove('inserting');
      el.style.left = el.style.top = el.style.width = el.style.height = '';
    }, 260);
    render();
  }

  // 投入したお金を財布に戻す（硬貨は山の上に落ちる）
  function returnPieces(list) {
    list.forEach((p, k) => {
      p.where = 'purse';
      scatter(p, 0.2);
      p.z = ++zTop;
      setFace(p, Math.random() < 0.5 ? 'a' : 'b');
      $('purse').appendChild(p.el);
      p.el.classList.remove('fall');
      void p.el.offsetWidth;
      p.el.classList.add('fall');
      S.money(state.code, state.cur.denoms[p.i].v, 0.15 + k * 0.07);
    });
    if (list.length) S.returnCoins();
    render();
  }

  function shakePurse() {
    const coins = state.pieces.filter((p) => p.where === 'purse' && isCoin(p));
    const order = coins.map((p) => ({ p, k: Math.random() })).sort((a, b) => a.k - b.k);
    order.forEach(({ p }) => {
      scatter(p);
      p.z = ++zTop;
      // 振ると裏返る硬貨もある
      if (Math.random() < 0.5) setFace(p, p.face === 'a' ? 'b' : 'a');
    });
    const outer = $('purseOuter');
    outer.classList.remove('shake');
    void outer.offsetWidth;
    outer.classList.add('shake');
    $('purse').classList.add('moving');
    setTimeout(() => $('purse').classList.remove('moving'), 500);
    S.shake(state.code, coins.map((p) => state.cur.denoms[p.i].v));
    render();
  }

  function setFace(p, face) {
    p.face = face;
    p.el.querySelector('img').src = ART.moneyImage(state.code, state.cur.denoms[p.i].v, face);
  }

  let toastTimer = null;
  function toast(msg) {
    const t = $('toast');
    t.textContent = msg;
    t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => (t.hidden = true), 1600);
  }

  function pay() {
    const cur = state.cur;
    const r = state.rounds[state.index];
    const res = C.settle(state.wallet, state.tray, r.price, cur);
    if (!res) return;
    const best = r.best;
    const gained = res.coinsBefore - res.coinsAfter;
    const isPerfect = res.coinsAfter <= best.coinsAfter;
    state.score += gained;
    if (isPerfect) state.perfect++;
    // この会計にかかった時間（結果表示中は数えない）
    const sec = state.roundStart ? (performance.now() - state.roundStart) / 1000 : 0;
    state.elapsed += sec;
    state.roundStart = null;
    updateClock();
    state.history.push({ price: r.price, before: res.coinsBefore, after: res.coinsAfter, best: best.coinsAfter, perfect: isPerfect, sec });

    const red = $('mReduced');
    if (gained > 0) {
      red.innerHTML = '<span class="num">' + gained + '</span><span class="unit">' + t('redUp') + '</span>';
      red.className = 'reduced up';
    } else if (gained === 0) {
      red.innerHTML = '<span class="num">±0</span><span class="unit">' + t('redSame') + '</span>';
      red.className = 'reduced same';
    } else {
      red.innerHTML = '<span class="num">' + -gained + '</span><span class="unit">' + t('redDown') + '</span>';
      red.className = 'reduced down';
    }
    const v = $('verdict');
    if (isPerfect) {
      v.innerHTML = '<span class="big">' + t('vPerfect') + '</span><span>' + t('vPerfectSub') + '</span>';
      v.className = 'verdict perfect';
    } else if (gained > 0) {
      v.innerHTML = '<span class="big">' + t('vGood') + '</span><span>' + t('vGoodSub', { n: res.coinsAfter - best.coinsAfter }) + '</span>';
      v.className = 'verdict good';
    } else {
      v.innerHTML = '<span class="big">' + t('vBad') + '</span><span>' + t('vBadSub', { n: best.coinsAfter }) + '</span>';
      v.className = 'verdict bad';
    }
    $('mPaid').textContent = money(res.paid);
    $('mChange').textContent = money(res.changeAmount);
    $('mChangeItems').replaceWith(Object.assign(moneyLine(cur, res.change), { id: 'mChangeItems' }));
    $('mBefore').textContent = t('coinsN', { n: res.coinsBefore });
    $('mAfter').textContent = t('coinsN', { n: res.coinsAfter });
    $('mBest').textContent = t('coinsN', { n: best.coinsAfter });
    $('mBestWay').innerHTML = isPerfect
      ? ''
      : '<small>' + t('bestWay') + '</small><div>' + t('bestWayLine', { paid: money(best.paid), list: describe(cur, best.pay), change: money(best.changeAmount) }) + '</div>';
    const last = state.index + 1 >= C.ROUNDS;
    $('nextLabel').textContent = last ? t('nextLast') : t('next', { n: state.index + 2, total: C.ROUNDS });
    $('modal').hidden = false;
    $('btnNext').focus();

    // 効果音: レジ → お釣りがジャラジャラ → 判定
    S.register();
    const end = S.changeShower(state.code, res.change, cur.denoms);
    if (isPerfect) S.fanfare(end + 0.1);
    else if (gained <= 0) S.thud(end + 0.1);

    startAuto(AUTO_MS + Math.max(0, end - 0.5) * 1000);
  }

  function startAuto(ms) {
    stopAuto();
    const bar = $('nextBar');
    bar.style.transition = 'none';
    bar.style.width = '0%';
    void bar.offsetWidth;
    bar.style.transition = 'width ' + ms + 'ms linear';
    bar.style.width = '100%';
    $('autoNote').textContent = t('autoNote');
    autoTimer = setTimeout(next, ms);
  }
  function stopAuto() {
    if (autoTimer) {
      clearTimeout(autoTimer);
      autoTimer = null;
      const bar = $('nextBar');
      bar.style.transition = 'none';
      bar.style.width = '0%';
      $('autoNote').textContent = t('paused');
    }
  }

  function next() {
    stopAuto();
    $('modal').hidden = true;
    state.index++;
    if (state.index >= C.ROUNDS) return finish();
    startRound();
  }

  // ---------- 時間 ----------
  function fmtTime(sec) {
    sec = Math.floor(sec);
    const m = Math.floor(sec / 60), s = sec % 60;
    return m + ':' + String(s).padStart(2, '0');
  }
  function currentElapsed() {
    return state.elapsed + (state.roundStart ? (performance.now() - state.roundStart) / 1000 : 0);
  }
  function updateClock() {
    $('hudTime').textContent = fmtTime(currentElapsed());
  }
  setInterval(() => { if (state.cur && !$('screenGame').hidden) updateClock(); }, 250);

  /**
   * 総合評価（1000 点満点）
   *  硬貨 600: 減らした枚数 ÷ 最大で減らせた枚数
   *  パーフェクト 200: 1 問 10 点
   *  スピード 200: 1 問平均 10 秒以内で満点、60 秒で 0 点。適当に急いでも稼げないよう硬貨の達成率を掛ける
   */
  function evaluate(maxScore) {
    const ratio = maxScore ? Math.max(0, state.score) / maxScore : 0;
    const coins = Math.round(600 * Math.min(1, ratio));
    const perfect = state.perfect * 10;
    const avg = state.elapsed / C.ROUNDS;
    const speedFactor = Math.max(0, Math.min(1, (60 - avg) / 50));
    const speed = Math.round(200 * speedFactor * Math.min(1, ratio));
    return { coins, perfect, speed, total: coins + perfect + speed, ratio, avg };
  }

  function finish() {
    const maxScore = state.rounds.reduce((s, r) => s + (C.coinCount(r.wallet, state.cur) - r.best.coinsAfter), 0);
    const ev = evaluate(maxScore);
    state.eval = ev;
    $('endTotal').textContent = ev.total;
    $('bdCoins').textContent = ev.coins;
    $('bdCoinsSub').textContent = t('bdCoinsSub', { n: state.score, max: maxScore });
    $('bdPerfect').textContent = ev.perfect;
    $('bdPerfectSub').textContent = t('bdPerfectSub', { n: state.perfect, total: C.ROUNDS });
    $('bdSpeed').textContent = ev.speed;
    $('bdSpeedSub').textContent = t('bdSpeedSub', { time: fmtTime(state.elapsed), avg: ev.avg.toFixed(1) });
    $('endSub').textContent = t('endSub', { n: state.score });
    const tot = ev.total;
    const r = tot >= 900 ? 'S' : tot >= 750 ? 'A' : tot >= 600 ? 'B' : tot >= 400 ? 'C' : 'D';
    const rank = [r, t('rank' + r)];
    state.rankLetter = r;
    $('endRank').innerHTML = '<span class="rank-badge r' + rank[0] + '">' + rank[0] + '</span>' + rank[1];
    $('endCode').textContent = state.seed;
    $('endCur').textContent = t('version', { cur: t('cur' + state.code) });
    updateShareLinks();

    const key = 'otsuri-best-' + state.code;
    const prev = load(key);
    if (!prev || !prev.total || ev.total > prev.total) save(key, { total: ev.total, score: state.score, perfect: state.perfect, time: Math.round(state.elapsed) });

    const tbl = $('history');
    tbl.innerHTML = '<tr><th>' + ['thNo', 'thPrice', 'thBefore', 'thAfter', 'thBest', 'thTime'].map((k) => t(k)).join('</th><th>') + '</th><th></th></tr>' +
      state.history.map((h, i) => '<tr class="' + (h.perfect ? 'p' : '') + '"><td>' + (i + 1) + '</td><td>' + money(h.price) + '</td><td>' + h.before + '</td><td>' + h.after + '</td><td>' + h.best + '</td><td>' + t('sec', { n: h.sec.toFixed(1) }) + '</td><td>' + (h.perfect ? '★' : '') + '</td></tr>').join('');
    show('screenEnd');
  }

  function renderRecords() {
    const parts = ['JPY', 'USD'].map((code) => {
      const r = load('otsuri-best-' + code);
      if (!r) return null;
      const cur = t('cur' + code);
      return r.total != null
        ? t('record', { cur, total: r.total, n: r.score, p: r.perfect, time: fmtTime(r.time || 0) })
        : t('recordOld', { cur, n: r.score });
    }).filter(Boolean);
    $('records').innerHTML = parts.join('<br>');
  }

  // ---------- シェア ----------
  function shareUrl() {
    const u = new URL(location.href);
    u.search = '';
    u.hash = '';
    u.searchParams.set('cur', state.code);
    u.searchParams.set('code', state.seed);
    if (I.lang() === 'en') u.searchParams.set('lang', 'en');
    return u.toString();
  }
  function shareText() {
    const marks = state.history.map((h) => (h.perfect ? '🟩' : h.after < h.before ? '🟨' : '⬜')).join('');
    return t('shareText', { cur: t('cur' + state.code), total: state.eval.total, n: state.score, p: state.perfect, rounds: C.ROUNDS, time: fmtTime(state.elapsed), code: state.seed }) +
      '\n' + marks.slice(0, 10) + '\n' + marks.slice(10);
  }
  function updateShareLinks() {
    const text = shareText(), url = shareUrl();
    $('btnShareX').href = 'https://twitter.com/intent/tweet?text=' + encodeURIComponent(text) + '&url=' + encodeURIComponent(url);
    $('btnShareLine').href = 'https://line.me/R/msg/text/?' + encodeURIComponent(text + '\n' + url);
    $('btnShareNative').hidden = !navigator.share;
  }

  // ---------- イベント ----------
  document.querySelectorAll('[data-cur]').forEach((b) =>
    b.addEventListener('click', () => { S.unlock(); BGM.start(); startGame(b.dataset.cur, $('seedInput').value.trim().toUpperCase()); })
  );
  $('btnPay').addEventListener('click', pay);
  $('btnReturn').addEventListener('click', () => returnPieces(state.pieces.filter((p) => p.where === 'machine')));
  $('btnShake').addEventListener('click', shakePurse);
  window.addEventListener('resize', () => { if (state.cur && !$('screenGame').hidden) layoutPurse(); });
  $('btnNext').addEventListener('click', (e) => { e.stopPropagation(); next(); });
  document.querySelector('.modal-box').addEventListener('pointerdown', (e) => { if (!e.target.closest('#btnNext')) stopAuto(); });
  document.addEventListener('keydown', (e) => {
    if ($('modal').hidden) return;
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); next(); }
  });
  const soundBtn = $('btnSound');
  const syncSound = () => { soundBtn.textContent = S.isMuted() ? '🔇' : '🔊'; soundBtn.classList.toggle('off', S.isMuted()); };
  soundBtn.addEventListener('click', () => { S.setMuted(!S.isMuted()); syncSound(); });
  syncSound();
  const bgmBtn = $('btnBgm');
  const syncBgm = () => bgmBtn.classList.toggle('off', !BGM.isOn());
  bgmBtn.addEventListener('click', () => { S.unlock(); BGM.setOn(!BGM.isOn()); syncBgm(); });
  syncBgm();
  $('btnHowto').addEventListener('click', () => { show('screenHowto'); });
  $('btnHowtoBack').addEventListener('click', () => show('screenStart'));

  // トップと遊び方の絵: 本物の硬貨画像で小銭の山を作る
  document.querySelectorAll('img[data-coin]').forEach((img) => {
    const [code, v] = img.dataset.coin.split('-');
    img.src = ART.moneyImage(code, +v);
  });
  function decoPile(box, list, spread) {
    list.forEach(([code, v, x, y, size, rot]) => {
      const img = document.createElement('img');
      img.src = ART.moneyImage(code, v);
      img.alt = '';
      img.style.cssText = 'left:' + x + '%;top:' + y + '%;width:' + size + '%;transform:translate(-50%,-50%) rotate(' + rot + 'deg)';
      box.appendChild(img);
    });
  }
  decoPile($('heroPile'), [
    ['JPY', 100, 30, 62, 29.4, 20], ['JPY', 1, 52, 70, 26, 80], ['JPY', 10, 70, 58, 30.6, -30], ['JPY', 5, 44, 48, 28.6, 140],
    ['JPY', 50, 24, 38, 27.3, 200], ['JPY', 1, 62, 34, 26, 10], ['JPY', 500, 50, 60, 34.5, -12], ['JPY', 10, 34, 74, 30.6, 60], ['JPY', 1, 76, 76, 26, 300],
  ]);
  decoPile($('howPile'), [['JPY', 10, 36, 56, 45.9, 30], ['JPY', 1, 62, 46, 39.0, 100], ['JPY', 100, 48, 40, 44.1, -20], ['JPY', 50, 66, 66, 41.0, 10]]);
  $('btnRetry').addEventListener('click', () => startGame(state.code, state.seed));
  $('btnHome').addEventListener('click', () => { renderRecords(); show('screenStart'); });
  $('btnShare').addEventListener('click', () => {
    const text = shareText() + '\n' + shareUrl();
    const done = () => { $('copyLabel').textContent = t('copied'); setTimeout(() => ($('copyLabel').textContent = t('copy')), 1500); };
    if (navigator.clipboard) navigator.clipboard.writeText(text).then(done, () => prompt(t('copyPrompt'), text));
    else prompt(t('copyPrompt'), text);
  });
  $('btnShareNative').addEventListener('click', () => {
    if (!navigator.share) return;
    navigator.share({ title: t('appTitle'), text: shareText(), url: shareUrl() }).catch(() => {});
  });
  // 言語切り替え
  const langBtn = $('btnLang');
  const syncLang = () => (langBtn.textContent = I.lang() === 'ja' ? 'EN' : 'JA');
  langBtn.addEventListener('click', () => {
    I.setLang(I.lang() === 'ja' ? 'en' : 'ja');
    syncLang();
    try {
      const u = new URL(location.href);
      u.searchParams.set('lang', I.lang());
      history.replaceState(null, '', u);
    } catch (e) { /* ignore */ }
    renderRecords();
    $('inserted').dataset.empty = t('insertedEmpty');
    if (state.cur && !$('screenGame').hidden) { $('price').textContent = money(state.rounds[state.index].price); render(); }
    if (!$('screenEnd').hidden) finish();
  });
  I.apply();
  syncLang();
  $('inserted').dataset.empty = t('insertedEmpty');

  // URL の ?code= でチャレンジコードを受け取る
  const params = new URLSearchParams(location.search);
  if (params.get('code')) {
    $('seedInput').value = params.get('code').toUpperCase().slice(0, 16);
    document.querySelector('.seedbox').open = true;
  }
  renderRecords();
})();
