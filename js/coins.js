/*
 * 硬貨・紙幣の SVG 描画（金属のグラデーション・縁・刻印をそれっぽく再現）
 * <img src="data:image/svg+xml,..."> として使うので ID の衝突を気にしなくてよい。
 */
(function () {
  'use strict';

  // 金属の色: [ハイライト, 中間, 影, 刻印の影]
  const METAL = {
    aluminium: ['#ffffff', '#d9dcdf', '#9fa5ab', '#7d848b'],
    brass: ['#fff3b8', '#e2bd55', '#a87d1f', '#7a5710'],
    bronze: ['#ffd2ad', '#cc7a45', '#8a4320', '#5e2b12'],
    cupro: ['#ffffff', '#cfd3d6', '#8f969c', '#6c737a'],
    nickelBrass: ['#fff6cf', '#d9c37a', '#9e8638', '#6f5c20'],
    copper: ['#ffcfa8', '#c9733f', '#7f3a18', '#56240c'],
    silver: ['#ffffff', '#c8ced3', '#868d94', '#62696f'],
  };

  function grad(id, m) {
    const c = METAL[m];
    return (
      '<radialGradient id="' + id + '" cx="35%" cy="28%" r="80%">' +
      '<stop offset="0" stop-color="' + c[0] + '"/>' +
      '<stop offset=".45" stop-color="' + c[1] + '"/>' +
      '<stop offset="1" stop-color="' + c[2] + '"/></radialGradient>' +
      '<linearGradient id="' + id + 'r" x1="0" y1="0" x2="1" y2="1">' +
      '<stop offset="0" stop-color="' + c[0] + '"/>' +
      '<stop offset=".5" stop-color="' + c[2] + '"/>' +
      '<stop offset="1" stop-color="' + c[3] + '"/></linearGradient>'
    );
  }

  // 刻印（浮き出し）: ハイライト + 影 + 本体を重ねる
  function emboss(svg, m) {
    const c = METAL[m];
    return (
      '<g transform="translate(.7 .9)" fill="' + c[3] + '" stroke="' + c[3] + '" opacity=".55">' + svg + '</g>' +
      '<g transform="translate(-.5 -.6)" fill="#fff" stroke="#fff" opacity=".7">' + svg + '</g>' +
      '<g fill="' + c[1] + '" stroke="' + c[1] + '">' + svg + '</g>'
    );
  }

  function arcText(id, text, r, top, size, font, spacing) {
    if (top) r -= size * 0.75; // 上側は文字が外へ伸びるので内側に寄せる
    // top=true なら上側に沿って、false なら下側に沿って文字を置く
    const d = top
      ? 'M ' + (50 - r) + ' 50 A ' + r + ' ' + r + ' 0 0 1 ' + (50 + r) + ' 50'
      : 'M ' + (50 - r) + ' 50 A ' + r + ' ' + r + ' 0 0 0 ' + (50 + r) + ' 50';
    return {
      def: '<path id="' + id + '" d="' + d + '"/>',
      use:
        '<text font-family="' + font + '" font-size="' + size + '" font-weight="700" letter-spacing="' + (spacing || 0) + '" stroke-width="0">' +
        '<textPath href="#' + id + '" startOffset="50%" text-anchor="middle">' + text + '</textPath></text>',
    };
  }

  function txt(x, y, s, size, font, extra) {
    return '<text x="' + x + '" y="' + y + '" font-family="' + font + '" font-size="' + size + '" font-weight="800" text-anchor="middle" stroke-width="0" ' + (extra || '') + '>' + s + '</text>';
  }

  const JP = "'Hiragino Mincho ProN','Yu Mincho','Noto Serif JP','Noto Serif CJK JP',serif";
  const NUM = "'Times New Roman','Noto Serif',Georgia,serif";
  const US = "'Times New Roman','Noto Serif',Georgia,serif";

  // ---- モチーフ ----
  function leaf(cx, cy, rx, ry, rot) {
    return '<ellipse cx="' + cx + '" cy="' + cy + '" rx="' + rx + '" ry="' + ry + '" transform="rotate(' + rot + ' ' + cx + ' ' + cy + ')" stroke-width="0"/>';
  }
  function sakura(cx, cy, r) {
    let s = '';
    for (let i = 0; i < 5; i++) {
      const a = (i * 72 - 90) * Math.PI / 180;
      const x = cx + Math.cos(a) * r * 0.55, y = cy + Math.sin(a) * r * 0.55;
      s += '<ellipse cx="' + x.toFixed(2) + '" cy="' + y.toFixed(2) + '" rx="' + (r * 0.32).toFixed(2) + '" ry="' + (r * 0.5).toFixed(2) + '" transform="rotate(' + (i * 72) + ' ' + x.toFixed(2) + ' ' + y.toFixed(2) + ')" stroke-width="0"/>';
    }
    return s;
  }
  function laurel(r, count, from, to) {
    let s = '';
    for (let i = 0; i < count; i++) {
      const t = from + (to - from) * (i / (count - 1));
      const a = t * Math.PI / 180;
      s += leaf((50 + Math.cos(a) * r).toFixed(2), (50 + Math.sin(a) * r).toFixed(2), 2, 4.6, t + 90 + 25);
    }
    return s;
  }

  // ---- 円 ----
  const JPY = {
    1: { metal: 'aluminium', rim: 'plain', art: (m) => {
      const t = arcText('t', '日本国', 36, true, 9, JP, 3), b = arcText('b', '一円', 36, false, 9, JP, 4);
      return { defs: t.def + b.def, body: emboss(
        t.use + b.use +
        '<path d="M50 70 L50 46" stroke-width="2.2" fill="none"/>' +
        leaf(43, 44, 5, 9, -40) + leaf(57, 44, 5, 9, 40) + leaf(50, 36, 3.6, 7, 0) +
        txt(50, 80, '', 1, JP), m) };
    } },
    5: { metal: 'brass', hole: 9.5, rim: 'plain', art: (m) => {
      // 稲穂: 穴の左右から上へ弧を描く茎に、籾を並べる
      let ear = '<path d="M36 62 Q28 40 44 16" fill="none" stroke-width="1.4"/><path d="M64 62 Q72 40 56 16" fill="none" stroke-width="1.4"/>';
      for (let i = 0; i < 9; i++) {
        const t = 0.2 + i * 0.09;
        const x = (1 - t) * (1 - t) * 36 + 2 * (1 - t) * t * 28 + t * t * 44;
        const y = (1 - t) * (1 - t) * 62 + 2 * (1 - t) * t * 40 + t * t * 16;
        ear += leaf((x - 2.6).toFixed(2), y.toFixed(2), 1.5, 3.2, -35) + leaf((x + 2.6).toFixed(2), (y - 1).toFixed(2), 1.5, 3.2, 35);
        ear += leaf((100 - x - 2.6).toFixed(2), (y - 1).toFixed(2), 1.5, 3.2, -35) + leaf((100 - x + 2.6).toFixed(2), y.toFixed(2), 1.5, 3.2, 35);
      }
      let gear = '';
      for (let i = 0; i < 16; i++) {
        const a = i * 22.5 * Math.PI / 180;
        gear += '<rect x="-1.6" y="-17" width="3.2" height="4" transform="translate(50 50) rotate(' + i * 22.5 + ')" stroke-width="0"/>';
      }
      const water = '<path d="M26 72 q6 -3 12 0 t12 0 t12 0 t12 0" fill="none" stroke-width="1.6"/><path d="M30 78 q5 -3 10 0 t10 0 t10 0 t10 0" fill="none" stroke-width="1.6"/>';
      return { defs: '', body: emboss(gear + '<circle cx="50" cy="50" r="13.5" fill="none" stroke-width="1.6"/>' + ear + water +
        txt(50, 92, '五円', 10, JP, 'letter-spacing="3"'), m) };
    } },
    10: { metal: 'bronze', rim: 'plain', art: (m) => {
      const t = arcText('t', '日本国', 37, true, 8.5, JP, 3);
      return { defs: t.def, body: emboss(t.use + laurel(34, 9, 110, 230) + laurel(34, 9, 70, -50) +
        txt(50, 60, '10', 30, NUM, 'letter-spacing="-1"') + txt(50, 73, '令和七年', 5.5, JP), m) };
    } },
    50: { metal: 'cupro', hole: 9, rim: 'reeded', art: (m) => {
      let petals = '';
      for (let i = 0; i < 24; i++) petals += '<ellipse cx="50" cy="33" rx="2.4" ry="5.5" transform="rotate(' + i * 15 + ' 50 50)" stroke-width="0"/>';
      const t = arcText('t', '日本国', 39, true, 7.5, JP, 3), b = arcText('b', '五十円', 39, false, 7.5, JP, 3);
      return { defs: t.def + b.def, body: emboss(petals + t.use + b.use, m) };
    } },
    100: { metal: 'cupro', rim: 'reeded', art: (m) => {
      const t = arcText('t', '日本国', 37, true, 8, JP, 3), b = arcText('b', '百円', 37, false, 8.5, JP, 4);
      return { defs: t.def + b.def, body: emboss(t.use + b.use + sakura(50, 38, 13) + sakura(36, 59, 10) + sakura(64, 59, 10) +
        '<circle cx="50" cy="38" r="2.2" fill="#000" opacity=".15" stroke-width="0"/>', m) };
    } },
    500: { metal: 'nickelBrass', rim: 'reeded', bicolor: true, art: (m) => {
      const t = arcText('t', 'NIPPON', 33, true, 6, US, 2), b = arcText('b', 'JAPAN', 33, false, 6, US, 2);
      return { defs: t.def + b.def, body: emboss(t.use + b.use + txt(50, 62, '500', 27, NUM, 'letter-spacing="-1.5"') +
        '<path d="M30 70 h40" stroke-width="1" fill="none"/>', m) };
    } },
  };

  // ---- セント ----
  const USD = {
    1: { metal: 'copper', rim: 'plain', art: (m) => {
      const t = arcText('t', 'UNITED STATES OF AMERICA', 38, true, 5.9, US, .2), b = arcText('b', 'ONE CENT', 37, false, 9, US, 1.5);
      const shield = '<path d="M36 30 h28 v6 h-28 z" stroke-width="0"/><path d="M36 37 h28 v16 q0 14 -14 18 q-14 -4 -14 -18 z" fill="none" stroke-width="1.6"/>';
      let bars = '';
      for (let i = 0; i < 6; i++) bars += '<rect x="' + (38.5 + i * 4) + '" y="38" width="2" height="' + (24 - Math.abs(i - 2.5) * 2) + '" stroke-width="0"/>';
      return { defs: t.def + b.def, body: emboss(t.use + b.use + shield + bars, m) };
    } },
    5: { metal: 'silver', rim: 'plain', art: (m) => {
      const t = arcText('t', 'E PLURIBUS UNUM', 37, true, 6.5, US, .8), b = arcText('b', 'FIVE CENTS', 37, false, 8, US, 1.2);
      let cols = '';
      for (let i = 0; i < 6; i++) cols += '<rect x="' + (35 + i * 6) + '" y="46" width="2.4" height="14" stroke-width="0"/>';
      const house = '<path d="M30 46 L50 33 L70 46 Z" stroke-width="0"/><path d="M42 33 q8 -10 16 0" stroke-width="0"/><rect x="26" y="60" width="48" height="3" stroke-width="0"/>' + cols +
        txt(50, 71, 'MONTICELLO', 5.8, US, 'letter-spacing=".6"');
      return { defs: t.def + b.def, body: emboss(t.use + b.use + house, m) };
    } },
    10: { metal: 'silver', rim: 'reeded', art: (m) => {
      const t = arcText('t', 'UNITED STATES OF AMERICA', 38, true, 6.6, US, .2), b = arcText('b', 'ONE DIME', 37, false, 9, US, 1.5);
      const torch = '<rect x="47.8" y="34" width="4.4" height="32" stroke-width="0"/><path d="M45 34 h10 l-1.5 -4 h-7 z" stroke-width="0"/><path d="M50 18 q6 6 2 12 h-4 q-4 -6 2 -12" stroke-width="0"/>';
      const branches = laurel(18, 5, 120, 200).replace(/rotate\(/g, 'rotate(') + laurel(18, 5, 60, -20);
      return { defs: t.def + b.def, body: emboss(t.use + b.use + torch + branches, m) };
    } },
    25: { metal: 'silver', rim: 'reeded', art: (m) => {
      const t = arcText('t', 'UNITED STATES OF AMERICA', 38, true, 6.4, US, .3), b = arcText('b', 'QUARTER DOLLAR', 38, false, 7.2, US, .8);
      const eagle =
        '<path d="M50 34 c-3 0 -4 3 -3.5 5 l-1.5 2 l3 .2 c0 3 -1 6 -1 10 l-3 12 h12 l-3 -12 c0 -4 -1 -7 -1 -10 c2 -1 2 -3 1.5 -5 c-.5 -2 -1.5 -2.2 -3.5 -2.2z" stroke-width="0"/>' +
        '<path d="M46 46 C38 40 28 36 20 40 C26 44 30 46 33 48 C28 49 25 51 23 53 C30 53 36 53 46 52 Z" stroke-width="0"/>' +
        '<path d="M54 46 C62 40 72 36 80 40 C74 44 70 46 67 48 C72 49 75 51 77 53 C70 53 64 53 54 52 Z" stroke-width="0"/>' +
        '<path d="M40 66 q10 4 20 0" fill="none" stroke-width="1.4"/>';
      return { defs: t.def + b.def, body: emboss(t.use + b.use + eagle, m) };
    } },
  };

  function coinSVG(spec) {
    const m = spec.metal;
    const c = METAL[m];
    const art = spec.art(m);
    let defs = grad('g', m) + art.defs;
    if (spec.bicolor) defs += grad('g2', 'cupro');
    let mask = '';
    if (spec.hole) {
      defs += '<mask id="h"><rect width="100" height="100" fill="#fff"/><circle cx="50" cy="50" r="' + spec.hole + '" fill="#000"/></mask>';
      mask = ' mask="url(#h)"';
    }
    let rimDeco = '';
    if (spec.rim === 'reeded') {
      // 縁のギザギザ（面からも見える細かな刻み）
      for (let i = 0; i < 90; i++) rimDeco += '<rect x="49.6" y="1.2" width=".8" height="3" transform="rotate(' + i * 4 + ' 50 50)"/>';
      rimDeco = '<g fill="' + c[3] + '" opacity=".45">' + rimDeco + '</g>';
    }
    let body =
      '<circle cx="50" cy="50" r="49" fill="url(#gr)"/>' +
      '<circle cx="50" cy="50" r="46.5" fill="url(#g)"/>' +
      rimDeco +
      '<circle cx="50" cy="50" r="43" fill="none" stroke="' + c[2] + '" stroke-opacity=".6" stroke-width="1"/>' +
      '<circle cx="50" cy="50" r="42.3" fill="none" stroke="#fff" stroke-opacity=".5" stroke-width=".7"/>';
    if (spec.bicolor) {
      // 500円: 外周は黄色、中間リングは白銅、中心は黄色のバイカラー・クラッド
      body += '<circle cx="50" cy="50" r="31" fill="url(#g2)"/><circle cx="50" cy="50" r="22" fill="url(#g)"/>' +
        '<circle cx="50" cy="50" r="31" fill="none" stroke="' + c[3] + '" stroke-opacity=".5" stroke-width=".8"/>' +
        '<circle cx="50" cy="50" r="22" fill="none" stroke="' + c[3] + '" stroke-opacity=".5" stroke-width=".8"/>';
    }
    if (spec.hole) {
      body += '<circle cx="50" cy="50" r="' + (spec.hole + 1.6) + '" fill="none" stroke="' + c[3] + '" stroke-opacity=".6" stroke-width="1.6"/>' +
        '<circle cx="50" cy="50" r="' + (spec.hole + 0.5) + '" fill="none" stroke="#fff" stroke-opacity=".6" stroke-width=".7"/>';
    }
    body += art.body;
    // 光の反射
    body += '<ellipse cx="36" cy="28" rx="22" ry="12" fill="#fff" opacity=".18" transform="rotate(-30 36 28)"/>';
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs>' + defs.replace('id="gr"', 'id="gr"') +
      '<linearGradient id="gr" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="' + c[0] + '"/><stop offset=".55" stop-color="' + c[2] + '"/><stop offset="1" stop-color="' + c[3] + '"/></linearGradient>' +
      '</defs><g' + mask + '>' + body + '</g></svg>';
  }

  // ---- 紙幣 ----
  const BILLS = {
    'JPY-1000': { base: '#6f8fc4', dark: '#2f4c80', light: '#dbe6f6', text: '1000', sub: '千円', unit: '日本銀行券' },
    'JPY-5000': { base: '#a184bf', dark: '#5b3e7c', light: '#ece2f6', text: '5000', sub: '五千円', unit: '日本銀行券' },
    'JPY-10000': { base: '#b39a6c', dark: '#6a5530', light: '#f3ead7', text: '10000', sub: '壱万円', unit: '日本銀行券' },
    'USD-100': { base: '#8aa286', dark: '#3e5a3d', light: '#eef3e6', text: '1', sub: 'ONE', unit: 'FEDERAL RESERVE NOTE' },
    'USD-500': { base: '#9fae9a', dark: '#4b5f50', light: '#f0f2ea', text: '5', sub: 'FIVE', unit: 'FEDERAL RESERVE NOTE' },
    'USD-1000': { base: '#c4b07c', dark: '#6e5c2d', light: '#f5efdb', text: '10', sub: 'TEN', unit: 'FEDERAL RESERVE NOTE' },
    'USD-2000': { base: '#86ae9e', dark: '#356152', light: '#e8f2ec', text: '20', sub: 'TWENTY', unit: 'FEDERAL RESERVE NOTE' },
  };
  function billSVG(key) {
    const b = BILLS[key];
    const us = key.startsWith('USD');
    const f = us ? US : JP;
    let guil = '';
    for (let i = 0; i < 12; i++) guil += '<ellipse cx="' + (us ? 100 : 40) + '" cy="50" rx="' + (6 + i * 2.2) + '" ry="' + (14 + i * 1.6) + '" fill="none" stroke="' + b.dark + '" stroke-opacity=".12" stroke-width=".6"/>';
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 100">' +
      '<defs><linearGradient id="p" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="' + b.light + '"/><stop offset=".5" stop-color="' + b.base + '"/><stop offset="1" stop-color="' + b.light + '"/></linearGradient></defs>' +
      '<rect x="1" y="1" width="198" height="98" rx="4" fill="url(#p)" stroke="' + b.dark + '" stroke-width="1.5"/>' +
      '<rect x="7" y="7" width="186" height="86" rx="2" fill="none" stroke="' + b.dark + '" stroke-opacity=".6" stroke-width="1.5" stroke-dasharray="2 1.2"/>' +
      guil +
      (us
        ? '<ellipse cx="100" cy="50" rx="24" ry="30" fill="' + b.light + '" stroke="' + b.dark + '" stroke-width="1.5"/>' +
          '<path d="M90 70 q0 -14 10 -16 q-8 -4 -7 -14 q2 -10 9 -10 q8 0 9 10 q1 10 -7 14 q10 2 10 16 z" fill="' + b.dark + '" fill-opacity=".45"/>' +
          txt(22, 26, b.text, 18, f, 'fill="' + b.dark + '"') + txt(178, 90, b.text, 18, f, 'fill="' + b.dark + '"') +
          txt(100, 17, 'THE UNITED STATES OF AMERICA', 8, f, 'fill="' + b.dark + '" letter-spacing=".5"') +
          txt(100, 92, b.sub + ' DOLLAR' + (b.text === '1' ? '' : 'S'), 8, f, 'fill="' + b.dark + '" letter-spacing="1"')
        : '<circle cx="150" cy="48" r="26" fill="' + b.light + '" fill-opacity=".8" stroke="' + b.dark + '" stroke-opacity=".5"/>' +
          '<path d="M140 70 q0 -12 10 -14 q-7 -4 -6 -13 q2 -9 8 -9 q7 0 8 9 q1 9 -6 13 q10 2 10 14 z" fill="' + b.dark + '" fill-opacity=".35"/>' +
          txt(58, 62, b.text, 30, NUM, 'fill="' + b.dark + '" letter-spacing="-1"') +
          txt(58, 84, b.sub, 13, f, 'fill="' + b.dark + '" letter-spacing="4"') +
          txt(58, 24, b.unit, 9, f, 'fill="' + b.dark + '" letter-spacing="3"')) +
      '</svg>';
  }

  const cache = {};
  function uri(svg) {
    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  }
  /** 額面の画像 URL を返す */
  function moneyImage(code, v) {
    const key = code + '-' + v;
    if (cache[key]) return cache[key];
    const spec = (code === 'JPY' ? JPY : USD)[v];
    cache[key] = uri(spec ? coinSVG(spec) : billSVG(key));
    return cache[key];
  }

  window.OtsuriArt = { moneyImage };
})();
