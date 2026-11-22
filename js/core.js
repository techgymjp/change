/*
 * お釣りピッタリ — ゲームロジック（UI に依存しない純粋な関数群）
 * ブラウザでは window.OtsuriCore、Node では module.exports として使えます。
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.OtsuriCore = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // ---- 通貨定義（金額は最小単位: 円 / セント） ----------------------------
  const CURRENCIES = {
    JPY: {
      code: 'JPY',
      label: '円',
      // 昇順。coin=true のものが「硬貨」としてカウントされる
      denoms: [
        { v: 1, coin: true, label: '1', name: '1円玉' },
        { v: 5, coin: true, label: '5', name: '5円玉', hole: true },
        { v: 10, coin: true, label: '10', name: '10円玉' },
        { v: 50, coin: true, label: '50', name: '50円玉', hole: true },
        { v: 100, coin: true, label: '100', name: '100円玉' },
        { v: 500, coin: true, label: '500', name: '500円玉' },
      ],
      format(v) {
        return v.toLocaleString('ja-JP') + '円';
      },
      // 難易度ごとの財布・値段の生成パラメータ
      // 難易度ごとの財布・値段の生成パラメータ（硬貨のみ。お札は使わない）
      levels: [
        { coinMax: [4, 2, 4, 2, 4, 2], priceMin: 30, priceMax: 700 },
        { coinMax: [5, 2, 5, 2, 5, 2], priceMin: 50, priceMax: 1200 },
        { coinMax: [6, 3, 6, 3, 6, 3], priceMin: 80, priceMax: 2000 },
      ],
    },
    USD: {
      code: 'USD',
      label: 'ドル',
      denoms: [
        { v: 1, coin: true, label: '1¢', name: 'ペニー (1¢)' },
        { v: 5, coin: true, label: '5¢', name: 'ニッケル (5¢)' },
        { v: 10, coin: true, label: '10¢', name: 'ダイム (10¢)' },
        { v: 25, coin: true, label: '25¢', name: 'クォーター (25¢)' },
      ],
      format(v) {
        const neg = v < 0;
        const s = '$' + (Math.abs(v) / 100).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
        return neg ? '-' + s : s;
      },
      levels: [
        { coinMax: [4, 2, 4, 4], priceMin: 20, priceMax: 150 },
        { coinMax: [5, 3, 5, 6], priceMin: 40, priceMax: 250 },
        { coinMax: [6, 3, 6, 8], priceMin: 60, priceMax: 350 },
      ],
    },
  };

  const ROUNDS = 20;
  const EXACT_RATIO = 0.3; // 財布でピッタリ払える回の割合（残りはピッタリ払えない）

  // ---- 乱数（シード付き。チャレンジコードで同じ問題を再現できる） ------------
  function hashSeed(str) {
    let h = 1779033703 ^ str.length;
    for (let i = 0; i < str.length; i++) {
      h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
      h = (h << 13) | (h >>> 19);
    }
    return h >>> 0;
  }
  function mulberry32(a) {
    return function () {
      a |= 0;
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function makeRng(seed) {
    return mulberry32(hashSeed(String(seed)));
  }
  function randInt(rng, lo, hi) {
    return lo + Math.floor(rng() * (hi - lo + 1));
  }

  // ---- 基本計算 ------------------------------------------------------------
  function zeros(cur) {
    return cur.denoms.map(() => 0);
  }
  function total(counts, cur) {
    return counts.reduce((s, c, i) => s + c * cur.denoms[i].v, 0);
  }
  function coinCount(counts, cur) {
    return counts.reduce((s, c, i) => s + (cur.denoms[i].coin ? c : 0), 0);
  }
  function pieceCount(counts) {
    return counts.reduce((s, c) => s + c, 0);
  }

  /** レジが返すお釣り（枚数が最少になる貪欲法。円・ドルとも貪欲法で最適） */
  function makeChange(amount, cur) {
    const out = zeros(cur);
    let rest = amount;
    for (let i = cur.denoms.length - 1; i >= 0; i--) {
      const v = cur.denoms[i].v;
      out[i] = Math.floor(rest / v);
      rest -= out[i] * v;
    }
    return out;
  }

  /**
   * 払い方のルール違反を調べる
   *  'all'   … 財布の硬貨を全部出した（即アウト）
   *  'waste' … 出した硬貨と同じ種類がお釣りに入っている（ムダ払い）
   *  null    … 問題なし
   */
  function violation(wallet, pay, change) {
    if (pay.every((c, i) => c === wallet[i])) return 'all';
    if (change && pay.some((c, i) => c > 0 && change[i] > 0)) return 'waste';
    return null;
  }

  /** 支払い結果: 支払い後の財布・お釣り・硬貨枚数 */
  function settle(wallet, pay, price, cur) {
    const paid = total(pay, cur);
    if (paid < price) return null;
    const change = makeChange(paid - price, cur);
    const after = wallet.map((c, i) => c - pay[i] + change[i]);
    return {
      paid,
      change,
      changeAmount: paid - price,
      after,
      coinsBefore: coinCount(wallet, cur),
      coinsAfter: coinCount(after, cur),
    };
  }

  /**
   * 硬貨が最も少なくなる支払い方を全探索で求める。
   * 同点なら「出す枚数が少ない」→「財布の総枚数が少ない」方を優先。
   */
  function bestPayment(wallet, price, cur) {
    const n = cur.denoms.length;
    const pay = zeros(cur);
    let best = null;
    let bestKey = null;

    (function rec(i, paid) {
      if (i < 0) {
        if (paid < price) return;
        const r = settle(wallet, pay, price, cur);
        if (violation(wallet, pay, r.change)) return; // ルールを守った払い方だけを候補にする
        const key = [r.coinsAfter, pieceCount(pay), pieceCount(r.after)];
        if (!bestKey || key[0] < bestKey[0] || (key[0] === bestKey[0] && (key[1] < bestKey[1] || (key[1] === bestKey[1] && key[2] < bestKey[2])))) {
          bestKey = key;
          best = Object.assign({ pay: pay.slice() }, r);
        }
        return;
      }
      const v = cur.denoms[i].v;
      for (let k = 0; k <= wallet[i]; k++) {
        pay[i] = k;
        rec(i - 1, paid + k * v);
      }
      pay[i] = 0;
    })(n - 1, 0);

    return best;
  }

  /** 財布の中身で作れる金額の集合 */
  function reachableSums(wallet, cur) {
    const max = total(wallet, cur);
    let can = new Uint8Array(max + 1);
    can[0] = 1;
    cur.denoms.forEach((d, i) => {
      for (let k = 0; k < wallet[i]; k++) {
        for (let s = max - d.v; s >= 0; s--) if (can[s]) can[s + d.v] = 1;
      }
    });
    return can;
  }

  function levelFor(round) {
    return round < 5 ? 0 : round < 12 ? 1 : 2;
  }

  function randomWallet(rng, cur, lv) {
    const w = zeros(cur);
    let ci = 0;
    cur.denoms.forEach((d, i) => {
      if (d.coin) {
        // 少し偏らせる: 0 枚になりやすい硬貨と多めに入る硬貨を作る
        const max = lv.coinMax[ci++];
        w[i] = rng() < 0.2 ? 0 : randInt(rng, 0, max);
      }
    });
    return w;
  }

  /** 1 ラウンド分の問題を生成 */
  function generateRound(rng, cur, round, wantExact) {
    const lv = cur.levels[levelFor(round)];
    for (let attempt = 0; attempt < 500; attempt++) {
      const wallet = randomWallet(rng, cur, lv);
      const coins = coinCount(wallet, cur);
      if (coins < 4) continue;
      const sum = total(wallet, cur);
      // 財布には必ず値段より多いお金を入れる（全部出さなくても払えるように）
      const hi = Math.min(sum - 1, lv.priceMax);
      if (hi < lv.priceMin) continue;
      const can = reachableSums(wallet, cur);

      // 条件に合う値段を探す
      let price = -1;
      for (let t = 0; t < 60; t++) {
        const p = randInt(rng, lv.priceMin, hi);
        if (!!can[p] === wantExact) {
          price = p;
          break;
        }
      }
      if (price < 0) continue;

      const best = bestPayment(wallet, price, cur);
      if (!best || best.coinsAfter >= coins) continue; // 減らしようがない問題は除外
      return { wallet, price, exact: !!can[price], best };
    }
    // まずあり得ないが、念のための保険
    return generateRound(rng, cur, round, !wantExact);
  }

  /** 20 チャレンジ分を生成（ピッタリ払える回は約 3 割、シャッフル） */
  function generateGame(currencyCode, seed) {
    const cur = CURRENCIES[currencyCode];
    const rng = makeRng(currencyCode + ':' + seed);
    const exactCount = Math.round(ROUNDS * EXACT_RATIO);
    const flags = Array.from({ length: ROUNDS }, (_, i) => i < exactCount);
    for (let i = flags.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [flags[i], flags[j]] = [flags[j], flags[i]];
    }
    return flags.map((exact, r) => generateRound(rng, cur, r, exact));
  }

  return {
    CURRENCIES,
    ROUNDS,
    makeRng,
    total,
    coinCount,
    pieceCount,
    makeChange,
    settle,
    violation,
    bestPayment,
    reachableSums,
    generateRound,
    generateGame,
    zeros,
  };
});
