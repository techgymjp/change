/*
 * 日本語 / 英語の切り替え
 *  - HTML: data-i18n（テキスト）, data-i18n-html（HTML）, data-i18n-ph（placeholder）, data-i18n-aria（aria-label）
 *  - JS:   OtsuriI18n.t('key', { n: 3 })
 *  初期値: URL の ?lang= → 保存した設定 → ブラウザの言語
 */
(function () {
  'use strict';
  const DICT = {
    ja: {
      appTitle: 'お釣りピッタリ',
      logo: 'お釣り<span>ピッタリ</span>',
      description: 'がま口から硬貨を探して自動釣銭機へ。支払い後の小銭を一番少なくするゲーム。円とドル、全20チャレンジ。',
      bgm: 'BGMのオン/オフ', sfx: '効果音のオン/オフ', lang: 'English',
      hudRound: '問題', hudSaved: '減', hudTime: '時間',
      tagline: '財布の小銭、<b>減らせる？</b>',
      total: 'お会計', heroPrice: '65円', burst: '−3<small>枚</small>',
      playJPY: '円で遊ぶ', playUSD: 'ドルで遊ぶ', howto: '遊び方', code: 'チャレンジコード', codePh: '空欄ならランダム',
      howtoTitle: '遊び方',
      step1t: '1. お会計を確認', step1p: '毎回、値段と小銭入れの中身が変わります。全20問。',
      step2t: '2. 小銭入れから探す', step2p: '硬貨は重なっています。下に埋もれた硬貨は、上の硬貨をどかして探り当てよう。',
      step3t: '3. 投入口へドラッグ', step3p: 'つかんだ硬貨を自動釣銭機の投入口まで運び、そろったら「精算」。',
      step4t: '4. お釣りで小銭を減らす', step4p: '65円に115円出すと、お釣りは50円玉1枚。ピッタリ払えないときこそ工夫しよう。',
      howtoScore: '支払い前より<b>減らした硬貨の枚数</b>・<b>パーフェクト</b>の数・<b>かかった時間</b>で、1000点満点の総合評価がつきます。',
      back: 'もどる',
      machine: '自動釣銭機', inserted: '投入金額', coinSlot: '硬貨投入口', insertedNote: '投入したお金（タップで1枚返却）', insertedEmpty: '投入したお金',
      btnReturn: '返却', btnPay: '精算',
      purse: '小銭入れ', coins: '硬貨', coinsUnit: '枚',
      hint: '硬貨をつかんで投入口へ運ぼう。下に埋もれた硬貨は、上の硬貨をどかして探そう。', shake: '振る',
      memo: '中身：', empty: 'からっぽ', none: 'なし',
      stInsert: 'お金を入れてください', stShort: '不足 {v}', stExact: 'ピッタリ — 精算を押してください', stChange: 'お釣り {v}',
      returnOne: '{name}を返却', dragHint: 'つかんだまま投入口へ運ぼう',
      paid: '支払い', change: 'お釣り', before: '支払い前', you: 'あなた', best: '最少', coinsN: '{n}枚',
      redUp: '枚 減った！', redSame: '枚（変わらず）', redDown: '枚 増えた…',
      vPerfect: 'パーフェクト！', vPerfectSub: 'これ以上は減らせない最少枚数です',
      vGood: 'おしい！', vGoodSub: 'あと {n} 枚減らせました',
      vBad: 'ざんねん', vBadSub: '最少は {n} 枚でした',
      bestWay: '最少になる出し方の例：', bestWayLine: '{paid}（{list}）→ お釣り {change}',
      nextLast: '最終結果を見る ▶', next: '次の会計へ ▶（{n}/{total}）',
      autoNote: '自動で次の会計に進みます（タップで一時停止）', paused: '一時停止中 — ボタンで次の会計へ',
      results: '結果発表', pts: '点 / 1000', bdCoins: '硬貨', bdPerfect: 'パーフェクト', bdSpeed: 'スピード',
      bdCoinsSub: '{n} / {max}枚', bdPerfectSub: '{n} / {total}問', bdSpeedSub: '{time}（平均{avg}秒）',
      endSub: '硬貨を {n} 枚減らしました',
      rankS: 'レジの達人！', rankA: '小銭マスター！', rankB: 'なかなかの腕前', rankC: 'もう少し工夫できそう', rankD: '財布が重いままかも…',
      codeLabel: 'チャレンジコード', version: '{cur}バージョン', curJPY: '円', curUSD: 'ドル',
      share: 'シェア', shareX: 'X', shareLine: 'LINE', copy: 'コピー', copied: 'コピーしました！', copyPrompt: 'コピーしてください',
      retry: '同じ問題で再挑戦', home: 'トップへ',
      thNo: '#', thPrice: '値段', thBefore: '前', thAfter: '後', thBest: '最少', thTime: '時間', sec: '{n}秒',
      record: '{cur}の自己ベスト：<b>{total}</b>点（{n}枚・★{p}・{time}）', recordOld: '{cur}の自己ベスト：<b>{n}</b>枚',
      shareText: 'お釣りピッタリ（{cur}）で {total}点！\n硬貨 {n}枚減・パーフェクト {p}/{rounds}・{time}\nチャレンジコード {code}',
      footer: '© お釣りピッタリ',
    },
    en: {
      appTitle: 'Perfect Change',
      logo: 'Perfect <span>Change</span>',
      description: 'Dig coins out of a coin purse and feed the auto cashier. Pay so you are left with as few coins as possible. Yen and dollars, 20 challenges.',
      bgm: 'Music on/off', sfx: 'Sound effects on/off', lang: '日本語',
      hudRound: 'Round', hudSaved: 'Saved', hudTime: 'Time',
      tagline: 'Can you <b>lighten</b> your coin purse?',
      total: 'Total', heroPrice: '¥65', burst: '−3<small>coins</small>',
      playJPY: 'Play in Yen', playUSD: 'Play in Dollars', howto: 'How to play', code: 'Challenge code', codePh: 'Blank = random',
      howtoTitle: 'How to play',
      step1t: '1. Check the total', step1p: 'Each round has a new price and new coins in your purse. 20 rounds.',
      step2t: '2. Dig through the purse', step2p: 'Coins pile up on each other. Move the top ones aside to find the coin you need.',
      step3t: '3. Drag to the slot', step3p: 'Carry each coin to the auto cashier’s coin slot, then press “Pay”.',
      step4t: '4. Use the change to save coins', step4p: 'Pay ¥115 for ¥65 and you get back a single ¥50 coin. Think hardest when you can’t pay exactly!',
      howtoScore: 'You are rated out of 1000 points for <b>coins saved</b>, <b>perfect rounds</b> and <b>time taken</b>.',
      back: 'Back',
      machine: 'Auto Cashier', inserted: 'Inserted', coinSlot: 'Coin slot', insertedNote: 'Inserted coins (tap one to get it back)', insertedEmpty: 'Inserted coins',
      btnReturn: 'Return', btnPay: 'Pay',
      purse: 'Coin purse', coins: 'Coins', coinsUnit: '',
      hint: 'Grab a coin and drop it in the slot. Coins at the bottom are hidden — move the ones on top.', shake: 'Shake',
      memo: 'Inside:', empty: 'empty', none: 'none',
      stInsert: 'Insert coins', stShort: 'Short {v}', stExact: 'Exact — press Pay', stChange: 'Change {v}',
      returnOne: 'Return the {name}', dragHint: 'Hold it and carry it to the slot',
      paid: 'Paid', change: 'Change', before: 'Before', you: 'You', best: 'Best', coinsN: '{n}',
      redUp: ' fewer coins!', redSame: ' (no change)', redDown: ' more coins…',
      vPerfect: 'Perfect!', vPerfectSub: 'You can’t get fewer coins than this',
      vGood: 'Close!', vGoodSub: 'You could have saved {n} more',
      vBad: 'Too bad', vBadSub: 'The best was {n} coins',
      bestWay: 'One best way to pay:', bestWayLine: '{paid} ({list}) → change {change}',
      nextLast: 'See final results ▶', next: 'Next customer ▶ ({n}/{total})',
      autoNote: 'Moving on automatically (tap to pause)', paused: 'Paused — press the button to continue',
      results: 'Results', pts: 'pts / 1000', bdCoins: 'Coins', bdPerfect: 'Perfect', bdSpeed: 'Speed',
      bdCoinsSub: '{n} / {max} coins', bdPerfectSub: '{n} / {total} rounds', bdSpeedSub: '{time} (avg {avg}s)',
      endSub: 'You got rid of {n} coins',
      rankS: 'Cashier legend!', rankA: 'Coin master!', rankB: 'Nicely done', rankC: 'Room to improve', rankD: 'Your purse is still heavy…',
      codeLabel: 'Challenge code', version: '{cur} version', curJPY: 'Yen', curUSD: 'Dollar',
      share: 'Share', shareX: 'X', shareLine: 'LINE', copy: 'Copy', copied: 'Copied!', copyPrompt: 'Copy this',
      retry: 'Retry same set', home: 'Home',
      thNo: '#', thPrice: 'Price', thBefore: 'Before', thAfter: 'After', thBest: 'Best', thTime: 'Time', sec: '{n}s',
      record: '{cur} best: <b>{total}</b> pts ({n} coins · ★{p} · {time})', recordOld: '{cur} best: <b>{n}</b> coins',
      shareText: 'I scored {total} pts in Perfect Change ({cur})!\nSaved {n} coins · Perfect {p}/{rounds} · {time}\nChallenge code {code}',
      footer: '© Perfect Change',
    },
  };
  // 硬貨の名前（英語）
  const COIN_EN = {
    JPY: { 1: '¥1 coin', 5: '¥5 coin', 10: '¥10 coin', 50: '¥50 coin', 100: '¥100 coin', 500: '¥500 coin' },
    USD: { 1: 'penny', 5: 'nickel', 10: 'dime', 25: 'quarter' },
  };

  let lang = 'ja';
  try {
    const q = new URLSearchParams(location.search).get('lang');
    const saved = localStorage.getItem('otsuri-lang');
    lang = q === 'en' || q === 'ja' ? q : saved === 'en' || saved === 'ja' ? saved : /^ja/i.test(navigator.language || '') ? 'ja' : 'en';
  } catch (e) { /* ignore */ }

  function t(key, params) {
    let s = (DICT[lang] && DICT[lang][key]) != null ? DICT[lang][key] : DICT.ja[key] != null ? DICT.ja[key] : key;
    if (params) s = s.replace(/\{(\w+)\}/g, (m, k) => (params[k] != null ? params[k] : m));
    return s;
  }

  function apply() {
    document.documentElement.lang = lang;
    document.title = t('appTitle');
    const meta = document.querySelector('meta[name="description"]');
    if (meta) meta.setAttribute('content', t('description'));
    document.querySelectorAll('[data-i18n]').forEach((el) => (el.textContent = t(el.dataset.i18n)));
    document.querySelectorAll('[data-i18n-html]').forEach((el) => (el.innerHTML = t(el.dataset.i18nHtml)));
    document.querySelectorAll('[data-i18n-ph]').forEach((el) => el.setAttribute('placeholder', t(el.dataset.i18nPh)));
    document.querySelectorAll('[data-i18n-aria]').forEach((el) => {
      el.setAttribute('aria-label', t(el.dataset.i18nAria));
      el.setAttribute('title', t(el.dataset.i18nAria));
    });
  }

  function setLang(l) {
    lang = l;
    try { localStorage.setItem('otsuri-lang', l); } catch (e) { /* ignore */ }
    apply();
  }

  /** 金額の表示（英語の円は ¥ 表記） */
  function money(cur, v) {
    if (lang === 'en' && cur.code === 'JPY') return '¥' + v.toLocaleString('en-US');
    return cur.format(v);
  }
  function coinName(cur, v, fallback) {
    return lang === 'en' ? COIN_EN[cur.code][v] : fallback;
  }

  window.OtsuriI18n = { t, apply, setLang, money, coinName, lang: () => lang };
})();
