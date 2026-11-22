/* お釣りピッタリ — 画面制御 */
(function () {
  'use strict';
  const C = window.OtsuriCore;
  const $ = (id) => document.getElementById(id);
  const S = window.OtsuriSound;
  const ART = window.OtsuriArt;
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
    if (!box.children.length) box.innerHTML = '<span class="none">なし</span>';
    return box;
  }

  function describe(cur, counts) {
    const parts = [];
    for (let i = cur.denoms.length - 1; i >= 0; i--) {
      if (counts[i]) parts.push(cur.denoms[i].name + '×' + counts[i]);
    }
    return parts.join('、') || 'なし';
  }

  // ---------- 画面切り替え ----------
  function show(id) {
    ['screenStart', 'screenGame', 'screenEnd'].forEach((s) => ($(s).hidden = s !== id));
    $('hud').hidden = id !== 'screenGame';
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

  function startRound() {
    const r = state.rounds[state.index];
    state.wallet = r.wallet.slice();
    state.tray = C.zeros(state.cur);
    $('price').textContent = state.cur.format(r.price);
    $('price').classList.remove('pop');
    void $('price').offsetWidth;
    $('price').classList.add('pop');
    render();
  }

  function render() {
    const cur = state.cur;
    const r = state.rounds[state.index];
    $('hudRound').textContent = state.index + 1 + '/' + C.ROUNDS;
    $('hudScore').textContent = state.score;
    $('hudPerfect').textContent = state.perfect;

    // 財布（額面ごとにまとめて表示）
    const wallet = $('wallet');
    wallet.innerHTML = '';
    for (let i = cur.denoms.length - 1; i >= 0; i--) {
      const remain = state.wallet[i] - state.tray[i];
      if (state.wallet[i] === 0) continue;
      const group = document.createElement('div');
      group.className = 'group' + (remain === 0 ? ' empty' : '');
      const stack = document.createElement('div');
      stack.className = 'stack';
      for (let k = 0; k < remain; k++) {
        const el = moneyEl(cur, i, { tag: 'button' });
        el.type = 'button';
        el.addEventListener('click', () => move(i, +1));
        stack.appendChild(el);
      }
      if (remain === 0) stack.innerHTML = '<span class="ghost-slot">全部トレーへ</span>';
      const cnt = document.createElement('div');
      cnt.className = 'cnt';
      cnt.innerHTML = '<small>' + (cur.code === 'JPY' ? cur.format(cur.denoms[i].v) : cur.denoms[i].label) + '</small>×' + remain;
      group.appendChild(stack);
      group.appendChild(cnt);
      wallet.appendChild(group);
    }
    const remainCounts = state.wallet.map((c, i) => c - state.tray[i]);
    $('walletCoins').textContent = C.coinCount(state.wallet, cur);
    $('walletSum').textContent = cur.format(C.total(remainCounts, cur));

    // トレー
    const tray = $('tray');
    tray.innerHTML = '';
    for (let i = cur.denoms.length - 1; i >= 0; i--) {
      for (let k = 0; k < state.tray[i]; k++) {
        const el = moneyEl(cur, i, { tag: 'button' });
        el.type = 'button';
        el.addEventListener('click', () => move(i, -1));
        tray.appendChild(el);
      }
    }
    if (!tray.children.length) tray.innerHTML = '<p class="placeholder">財布のお金をタップして出そう</p>';

    const paid = C.total(state.tray, cur);
    $('traySum').textContent = cur.format(paid);
    const st = $('status');
    if (paid === 0) {
      st.textContent = '';
      st.className = 'status';
    } else if (paid < r.price) {
      st.textContent = 'あと ' + cur.format(r.price - paid) + ' 足りません';
      st.className = 'status short';
    } else if (paid === r.price) {
      st.textContent = 'ピッタリ！';
      st.className = 'status ok';
    } else {
      st.textContent = 'お釣り ' + cur.format(paid - r.price);
      st.className = 'status ok';
    }
    $('btnPay').disabled = paid < r.price;
    $('btnClear').disabled = paid === 0;
  }

  function move(i, dir) {
    const v = state.cur.denoms[i].v;
    if (dir > 0 && state.tray[i] < state.wallet[i]) { state.tray[i]++; S.money(state.code, v, 0); }
    if (dir < 0 && state.tray[i] > 0) { state.tray[i]--; S.money(state.code, v, 0, true); }
    render();
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
    state.history.push({ price: r.price, before: res.coinsBefore, after: res.coinsAfter, best: best.coinsAfter, perfect: isPerfect });

    const red = $('mReduced');
    if (gained > 0) {
      red.innerHTML = '<span class="num">' + gained + '</span><span class="unit">枚 減った！</span>';
      red.className = 'reduced up';
    } else if (gained === 0) {
      red.innerHTML = '<span class="num">±0</span><span class="unit">枚（変わらず）</span>';
      red.className = 'reduced same';
    } else {
      red.innerHTML = '<span class="num">' + -gained + '</span><span class="unit">枚 増えた…</span>';
      red.className = 'reduced down';
    }
    const v = $('verdict');
    if (isPerfect) {
      v.innerHTML = '<span class="big">パーフェクト！</span><span>これ以上は減らせない最少枚数です</span>';
      v.className = 'verdict perfect';
    } else if (gained > 0) {
      v.innerHTML = '<span class="big">おしい！</span><span>あと ' + (res.coinsAfter - best.coinsAfter) + ' 枚減らせました</span>';
      v.className = 'verdict good';
    } else {
      v.innerHTML = '<span class="big">ざんねん</span><span>最少は ' + best.coinsAfter + ' 枚でした</span>';
      v.className = 'verdict bad';
    }
    $('mPaid').textContent = cur.format(res.paid);
    $('mChange').textContent = cur.format(res.changeAmount);
    $('mChangeItems').replaceWith(Object.assign(moneyLine(cur, res.change), { id: 'mChangeItems' }));
    $('mBefore').textContent = res.coinsBefore + '枚';
    $('mAfter').textContent = res.coinsAfter + '枚';
    $('mBest').textContent = best.coinsAfter + '枚';
    $('mBestWay').innerHTML = isPerfect
      ? ''
      : '<small>最少になる出し方の例：</small><div>' + cur.format(best.paid) + '（' + describe(cur, best.pay) + '）→ お釣り ' + cur.format(best.changeAmount) + '</div>';
    const last = state.index + 1 >= C.ROUNDS;
    $('nextLabel').textContent = last ? '最終結果を見る ▶' : '次の会計へ ▶（' + (state.index + 2) + '/' + C.ROUNDS + '）';
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
    $('autoNote').textContent = '自動で次の会計に進みます（タップで一時停止）';
    autoTimer = setTimeout(next, ms);
  }
  function stopAuto() {
    if (autoTimer) {
      clearTimeout(autoTimer);
      autoTimer = null;
      const bar = $('nextBar');
      bar.style.transition = 'none';
      bar.style.width = '0%';
      $('autoNote').textContent = '一時停止中 — ボタンで次の会計へ';
    }
  }

  function next() {
    stopAuto();
    $('modal').hidden = true;
    state.index++;
    if (state.index >= C.ROUNDS) return finish();
    startRound();
  }

  function finish() {
    const maxScore = state.rounds.reduce((s, r) => s + (C.coinCount(r.wallet, state.cur) - r.best.coinsAfter), 0);
    $('endScore').textContent = state.score;
    $('endSub').textContent = '最大 ' + maxScore + ' 枚中 ／ パーフェクト ' + state.perfect + ' / ' + C.ROUNDS;
    const ratio = maxScore ? state.score / maxScore : 0;
    const rank = ratio >= 1 ? ['S', 'レジの達人！完璧です'] : ratio >= 0.85 ? ['A', '小銭マスター！'] : ratio >= 0.65 ? ['B', 'なかなかの腕前'] : ratio >= 0.4 ? ['C', 'もう少し工夫できそう'] : ['D', '財布が重いままかも…'];
    $('endRank').innerHTML = '<span class="rank-badge r' + rank[0] + '">' + rank[0] + '</span>' + rank[1];
    $('endCode').textContent = state.seed;
    $('endCur').textContent = state.cur.label + 'バージョン';

    const key = 'otsuri-best-' + state.code;
    const prev = load(key);
    if (!prev || state.score > prev.score) save(key, { score: state.score, perfect: state.perfect, max: maxScore });

    const tbl = $('history');
    tbl.innerHTML = '<tr><th>#</th><th>値段</th><th>前</th><th>後</th><th>最少</th><th></th></tr>' +
      state.history.map((h, i) => '<tr class="' + (h.perfect ? 'p' : '') + '"><td>' + (i + 1) + '</td><td>' + state.cur.format(h.price) + '</td><td>' + h.before + '</td><td>' + h.after + '</td><td>' + h.best + '</td><td>' + (h.perfect ? '★' : '') + '</td></tr>').join('');
    show('screenEnd');
  }

  function renderRecords() {
    const parts = ['JPY', 'USD'].map((code) => {
      const r = load('otsuri-best-' + code);
      return r ? C.CURRENCIES[code].label + 'の自己ベスト：<b>' + r.score + '</b>枚（パーフェクト ' + r.perfect + '）' : null;
    }).filter(Boolean);
    $('records').innerHTML = parts.join('<br>');
  }

  function shareText() {
    const marks = state.history.map((h) => (h.perfect ? '🟩' : h.after < h.before ? '🟨' : '⬜')).join('');
    let url = location.href;
    return 'お釣りピッタリ（' + state.cur.label + '）コード ' + state.seed + '\n' +
      '硬貨を ' + state.score + ' 枚減らした！パーフェクト ' + state.perfect + '/' + C.ROUNDS + '\n' +
      marks.slice(0, 10) + '\n' + marks.slice(10) + '\n' + url;
  }

  // ---------- イベント ----------
  document.querySelectorAll('[data-cur]').forEach((b) =>
    b.addEventListener('click', () => { S.unlock(); startGame(b.dataset.cur, $('seedInput').value.trim().toUpperCase()); })
  );
  $('btnPay').addEventListener('click', pay);
  $('btnClear').addEventListener('click', () => { state.tray = C.zeros(state.cur); render(); });
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
  $('btnRetry').addEventListener('click', () => startGame(state.code, state.seed));
  $('btnHome').addEventListener('click', () => { renderRecords(); show('screenStart'); });
  $('btnShare').addEventListener('click', () => {
    const text = shareText();
    const done = () => { $('btnShare').textContent = 'コピーしました！'; setTimeout(() => ($('btnShare').textContent = '結果をコピー'), 1500); };
    if (navigator.clipboard) navigator.clipboard.writeText(text).then(done, () => prompt('コピーしてください', text));
    else prompt('コピーしてください', text);
  });

  // URL の ?code= でチャレンジコードを受け取る
  const params = new URLSearchParams(location.search);
  if (params.get('code')) {
    $('seedInput').value = params.get('code').toUpperCase().slice(0, 16);
    document.querySelector('.seedbox').open = true;
  }
  renderRecords();
})();
