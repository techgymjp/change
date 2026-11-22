/*
 * 硬貨・紙幣の SVG 描画
 * 実物の図柄（1円の若木、5円の稲穂・歯車・水、10円の平等院鳳凰堂、50円の穴と「50」、
 * 100円の桜、500円のバイカラー・クラッドと桐、米硬貨の肖像）を簡略化して再現する。
* 硬貨のみ（お札は使わない）。
 * <img src="data:image/svg+xml,..."> として使うので ID の衝突を気にしなくてよい。
 */
(function () {
  'use strict';

  // 金属の色: [ハイライト, 中間, 影, 刻印の影]
  const METAL = {
    aluminium: ['#ffffff', '#dfe2e4', '#a9afb4', '#7f868c'],
    brass: ['#fff1b0', '#dcb64e', '#a57a1d', '#6e500c'],
    bronze: ['#f7c09a', '#bf6e3e', '#86411f', '#55270f'],
    cupro: ['#ffffff', '#d3d7da', '#959ca2', '#666d73'],
    nickelBrass: ['#fff4c4', '#d8bd6a', '#a08533', '#6a5418'],
    whiteClad: ['#fffdf2', '#e3dcc6', '#b2a888', '#7a705a'],
    copper: ['#ffc9a0', '#cf7743', '#8a3f1a', '#58250c'],
    silver: ['#ffffff', '#cdd2d6', '#8c9399', '#5f666c'],
  };

  const JP = "'Hiragino Mincho ProN','Yu Mincho','Noto Serif JP','Noto Serif CJK JP',serif";
  const NUM = "'Times New Roman','Noto Serif',Georgia,serif";
  const US = "'Times New Roman','Noto Serif',Georgia,serif";

  function grad(id, m) {
    const c = METAL[m];
    return (
      '<radialGradient id="' + id + '" cx="34%" cy="28%" r="85%">' +
      '<stop offset="0" stop-color="' + c[0] + '"/>' +
      '<stop offset=".5" stop-color="' + c[1] + '"/>' +
      '<stop offset="1" stop-color="' + c[2] + '"/></radialGradient>'
    );
  }

  /** 刻印（浮き出し）: 影 → ハイライト → 本体 の順に重ねる */
  function emboss(svg, m, fill) {
    const c = METAL[m];
    return (
      '<g transform="translate(.6 .8)" fill="' + c[3] + '" stroke="' + c[3] + '" opacity=".6">' + svg + '</g>' +
      '<g transform="translate(-.45 -.55)" fill="#fff" stroke="#fff" opacity=".75">' + svg + '</g>' +
      '<g fill="' + (fill || c[1]) + '" stroke="' + (fill || c[1]) + '">' + svg + '</g>'
    );
  }
  // 細い線の彫り（耳・目・葉脈など）
  function engrave(svg, m) {
    const c = METAL[m];
    return '<g fill="none" stroke="' + c[3] + '" stroke-opacity=".7" stroke-linecap="round">' + svg + '</g>';
  }

  let arcId = 0;
  /**
   * 円弧に沿った文字。角度は度（0=右, 90=下）。
   * cw=true: 時計回り（文字の頭が外側。上側や左右の縁に使う）
   * cw=false: 反時計回り（文字の頭が内側。下側の縁に使う）
   */
  function arc(text, r, a1, a2, cw, size, font, spacing) {
    if (cw) r -= size * 0.72;
    else r -= size * 0.05;
    const id = 'a' + arcId++;
    const p = (a) => [(50 + r * Math.cos(a * Math.PI / 180)).toFixed(2), (50 + r * Math.sin(a * Math.PI / 180)).toFixed(2)];
    const [x1, y1] = p(a1), [x2, y2] = p(a2);
    const large = Math.abs(a2 - a1) > 180 ? 1 : 0;
    return {
      def: '<path id="' + id + '" d="M' + x1 + ' ' + y1 + ' A' + r + ' ' + r + ' 0 ' + large + ' ' + (cw ? 1 : 0) + ' ' + x2 + ' ' + y2 + '"/>',
      use: '<text font-family="' + font + '" font-size="' + size + '" font-weight="700" letter-spacing="' + (spacing || 0) + '" stroke-width="0">' +
        '<textPath href="#' + id + '" startOffset="50%" text-anchor="middle">' + text + '</textPath></text>',
    };
  }
  const top = (t, size, font, sp, r) => arc(t, r || 42, 205, 335, true, size, font, sp);
  const bottom = (t, size, font, sp, r) => arc(t, r || 42, 155, 25, false, size, font, sp);

  function txt(x, y, s, size, font, extra) {
    return '<text x="' + x + '" y="' + y + '" font-family="' + font + '" font-size="' + size + '" font-weight="800" text-anchor="middle" stroke-width="0" ' + (extra || '') + '>' + s + '</text>';
  }
  const f2 = (n) => n.toFixed(2);

  // 先のとがった葉（基部 x,y から角度 rot 方向へ長さ len）
  function leafPath(x, y, len, w, rot) {
    return '<path d="M0 0 C' + f2(w) + ' ' + f2(-len * 0.3) + ' ' + f2(w * 0.7) + ' ' + f2(-len * 0.8) + ' 0 ' + f2(-len) +
      ' C' + f2(-w * 0.7) + ' ' + f2(-len * 0.8) + ' ' + f2(-w) + ' ' + f2(-len * 0.3) + ' 0 0Z" transform="translate(' + f2(x) + ' ' + f2(y) + ') rotate(' + rot + ')" stroke-width="0"/>';
  }
  function grain(x, y, rx, ry, rot) {
    return '<ellipse cx="' + f2(x) + '" cy="' + f2(y) + '" rx="' + rx + '" ry="' + ry + '" transform="rotate(' + f2(rot) + ' ' + f2(x) + ' ' + f2(y) + ')" stroke-width="0"/>';
  }
  // 切れ込みのある桜の花びら 5 枚
  function sakura(cx, cy, r, rot) {
    const petal = 'M0 0 C' + f2(-r * .55) + ' ' + f2(-r * .25) + ' ' + f2(-r * .6) + ' ' + f2(-r * .95) + ' ' + f2(-r * .16) + ' ' + f2(-r) +
      ' L0 ' + f2(-r * .84) + ' L' + f2(r * .16) + ' ' + f2(-r) + ' C' + f2(r * .6) + ' ' + f2(-r * .95) + ' ' + f2(r * .55) + ' ' + f2(-r * .25) + ' 0 0Z';
    let s = '';
    for (let i = 0; i < 5; i++) s += '<path d="' + petal + '" transform="translate(' + cx + ' ' + cy + ') rotate(' + (rot + i * 72) + ')" stroke-width="0"/>';
    return s;
  }

  // ---- 肖像（左向きの横顔。右向きは反転） ----
  const HEAD =
    'M63 86 C64 78 66 70 68 64 C73 58 75 47 73 38 C71 28 63 21 52 21 C42 21 36 27 35 35 L34 41 ' +
    'C33.5 43 32.5 45 30 48.5 L28.6 51.6 C28.4 52.8 29.6 53.6 32.6 54 L32.6 56 C31.6 57 31.8 58.2 33 59 ' +
    'C32 60.4 32.8 62.2 34 63 C34.2 66 36.4 68.2 40 68.4 C42 70 42.4 76 41.4 86 Z';
  const BUST = 'M24 96 C30 88 38 85 41.4 84.5 L63 84.5 C70 85 78 89 82 96 Z';
  function portrait(kind) {
    let shape = HEAD + BUST;
    let lines = 'M58 42 C63 42 64.5 51 58.6 53.5" /><path d="M37 40.6 L41 40.2" /><path d="M36 35 C42 30 50 30 56 34';
    if (kind === 'lincoln') {
      // あごひげと豊かな髪
      shape += 'M60 48 C62 62 56 75 43 75 C36 75 32.5 70 32.4 63 L34 61 C37 67 44 67 50 62 Z' +
        'M50 20 C60 16 72 20 76 32 C78 40 76 48 72 52 L68 40 Z';
      lines = 'M58 41 C62 41 63.5 48 59 50" /><path d="M37 40.6 L41 40.2" /><path d="M44 66 C47 70 52 70 56 64" /><path d="M54 24 C62 23 70 28 72 36';
    } else if (kind === 'washington') {
      // 後ろで結んだ髪（リボン）と巻き毛
      shape += 'M66 64 C74 64 78 72 74 82 C71 77 68 74 64 72 Z M70 66 C76 60 80 64 77 68 C80 70 77 75 72 71 Z';
      lines = 'M58 42 C63 42 64.5 51 58.6 53.5" /><path d="M37 40.6 L41 40.2" /><path d="M60 34 C64 32 68 35 67 39" /><path d="M61 40 C65 38 69 41 68 45';
    } else if (kind === 'jefferson') {
      shape += 'M67 62 C73 63 75 70 72 77 C70 73 67 71 64 70 Z M41 84.5 L46 92 L52 84.5 Z';
      lines = 'M58 42 C63 42 64.5 51 58.6 53.5" /><path d="M37 40.6 L41 40.2" /><path d="M48 24 C56 22 64 26 68 34';
    } else if (kind === 'roosevelt') {
      lines = 'M58 42 C63 42 64.5 51 58.6 53.5" /><path d="M37 40.6 L41 40.2" /><path d="M58 26 C64 30 68 36 69 44';
    }
    return { shape: '<path d="' + shape + '" stroke-width="0"/>', lines: '<path d="' + lines + '" stroke-width=".7"/>' };
  }

  // ---- 円 ----
  const JPY = {
    // 1円 表: 若木
    1: { metal: 'aluminium', matte: true, art(m) {
      const t = top('日本国', 9, JP, 4), b = bottom('一円', 9.5, JP, 6);
      let tree = '<path d="M50 74 C49 64 51.5 52 50 30" fill="none" stroke-width="2"/>' +
        '<path d="M50 60 C45 56 41 50 40 44" fill="none" stroke-width="1.3"/><path d="M50 56 C55 52 59 47 60 41" fill="none" stroke-width="1.3"/>';
      tree += leafPath(50, 64, 15, 6, -62) + leafPath(50, 64, 15, 6, 62) + leafPath(40, 45, 10, 4.2, -20) + leafPath(41, 50, 9, 3.8, -78) +
        leafPath(60, 42, 10, 4.2, 22) + leafPath(59, 47, 9, 3.8, 80) + leafPath(50, 40, 9, 3.6, -30) + leafPath(50, 38, 9, 3.6, 30) + leafPath(50, 32, 8, 3.4, 0);
      return { defs: t.def + b.def, body: emboss(t.use + b.use + tree, m) +
        engrave('<path d="M50 64 L38 58" stroke-width=".4"/><path d="M50 64 L62 58" stroke-width=".4"/>', m) };
    } },
    // 5円 表: 稲穂・歯車・水、「五円」
    5: { metal: 'brass', hole: 11, art(m) {
      let gear = '<circle cx="50" cy="50" r="15" fill="none" stroke-width="3"/>';
      for (let i = 0; i < 18; i++) gear += '<rect x="-1.7" y="-19.6" width="3.4" height="4.4" transform="translate(50 50) rotate(' + i * 20 + ')" stroke-width="0"/>';
      // 稲穂: 左下から左側を上り、上で右へ垂れ下がる
      let ear = '<path d="M30 70 C22 52 26 30 42 22 C54 16 66 20 72 32" fill="none" stroke-width="1.6"/>';
      const bez = (t) => {
        const P = [[30, 70], [22, 52], [26, 30], [42, 22]], Q = [[42, 22], [54, 16], [66, 20], [72, 32]];
        const pts = t < 1 ? P : Q, u = t < 1 ? t : t - 1;
        const k = [(1 - u) ** 3, 3 * (1 - u) ** 2 * u, 3 * (1 - u) * u * u, u ** 3];
        return [0, 1].map((d) => k.reduce((s, kk, i) => s + kk * pts[i][d], 0));
      };
      for (let i = 0; i < 16; i++) {
        const t = 0.55 + i * 0.09;
        const [x, y] = bez(t), [x2, y2] = bez(Math.min(1.999, t + 0.02));
        const ang = Math.atan2(y2 - y, x2 - x) * 180 / Math.PI;
        ear += grain(x + Math.cos((ang - 90) * Math.PI / 180) * 3, y + Math.sin((ang - 90) * Math.PI / 180) * 3, 1.7, 3.2, ang + 60);
        ear += grain(x + Math.cos((ang + 90) * Math.PI / 180) * 3, y + Math.sin((ang + 90) * Math.PI / 180) * 3, 1.7, 3.2, ang + 120);
      }
      ear += leafPath(30, 70, 22, 3.5, -8) + leafPath(31, 69, 18, 3, 20);
      const water = '<path d="M34 70 H66" stroke-width="2.2"/><path d="M38 75 H62" stroke-width="2.2"/><path d="M42 80 H58" stroke-width="2.2"/>';
      return { defs: '', body: emboss(gear + ear + water + txt(50, 92, '五　円', 9, JP), m) };
    } },
    // 10円 表: 平等院鳳凰堂
    10: { metal: 'bronze', patina: true, art(m) {
      const t = top('日本国', 9, JP, 4), b = bottom('十円', 9.5, JP, 6);
      let hall =
        // 中堂の上の屋根と鳳凰
        '<path d="M36 38 Q50 33 64 38 L61 34.5 Q50 30.5 39 34.5 Z" stroke-width="0"/>' +
        '<path d="M47.5 30.8 h5 v1.5 h-5z M48.6 28 l1.4 -2.4 l1.4 2.4z" stroke-width="0"/>' +
        '<rect x="42" y="38" width="16" height="5" stroke-width="0"/>' +
        // 中堂の下の屋根
        '<path d="M28 48 Q50 42.5 72 48 L68 44 Q50 40 32 44 Z" stroke-width="0"/>' +
        '<rect x="36" y="48" width="28" height="7" stroke-width="0"/>' +
        // 翼廊と隅楼
        '<path d="M14 54 Q24 51.5 36 52.5 L36 50.5 Q24 50 16 51.5 Z M64 52.5 Q76 51.5 86 54 L84 51.5 Q76 50 64 50.5 Z" stroke-width="0"/>' +
        '<rect x="16" y="54" width="20" height="4" stroke-width="0"/><rect x="64" y="54" width="20" height="4" stroke-width="0"/>' +
        '<path d="M14 50 Q19 47 24 50 L22.5 47.5 Q19 46 15.5 47.5Z M76 50 Q81 47 86 50 L84.5 47.5 Q81 46 77.5 47.5Z" stroke-width="0"/>' +
        '<rect x="17" y="50" width="6" height="4" stroke-width="0"/><rect x="77" y="50" width="6" height="4" stroke-width="0"/>' +
        // 池
        '<path d="M22 63 H78" stroke-width="1.2"/><path d="M30 67.5 H70" stroke-width="1.2"/>';
      const cols = '<path d="M40 49 V55 M44 49 V55 M48 49 V55 M52 49 V55 M56 49 V55 M60 49 V55 M20 55 V58 M25 55 V58 M30 55 V58 M70 55 V58 M75 55 V58 M80 55 V58 M46 38.5 V43 M50 38.5 V43 M54 38.5 V43" stroke-width=".5"/>';
      return { defs: t.def + b.def, body: emboss(t.use + b.use + hall, m) + engrave(cols, m) };
    } },
    // 50円 裏: 穴・「50」・年号
    50: { metal: 'cupro', hole: 9.5, reeded: true, art(m) {
      return { defs: '', body: emboss(txt(50, 86, '50', 26, NUM, 'letter-spacing="-1"') + txt(50, 30, '令和七年', 7.5, JP, 'letter-spacing="1"'), m) };
    } },
    // 100円 表: 桜
    100: { metal: 'cupro', reeded: true, art(m) {
      const t = top('日本国', 8.5, JP, 4), b = bottom('百円', 9.5, JP, 7);
      const flowers = sakura(57, 40, 13, 8) + sakura(37, 55, 11, -14) + sakura(60, 64, 9.5, 30);
      const centers = [[57, 40, 3], [37, 55, 2.6], [60, 64, 2.2]].map(([x, y, r]) => '<circle cx="' + x + '" cy="' + y + '" r="' + r + '"/>').join('');
      let stamens = '';
      [[57, 40, 6], [37, 55, 5], [60, 64, 4.3]].forEach(([x, y, r]) => {
        for (let i = 0; i < 10; i++) {
          const a = i * 36 * Math.PI / 180;
          stamens += '<path d="M' + x + ' ' + y + ' L' + f2(x + Math.cos(a) * r) + ' ' + f2(y + Math.sin(a) * r) + '" stroke-width=".35"/>';
        }
      });
      return { defs: t.def + b.def, body: emboss(t.use + b.use + flowers, m) + engrave(stamens + centers.replace(/<circle/g, '<circle stroke-width=".5"'), m) };
    } },
    // 500円 表（2021年〜）: バイカラー・クラッド、桐
    500: { metal: 'nickelBrass', reeded: true, bicolor: true, art(m) {
      const t = top('日本国', 7.5, JP, 3.5, 44.5), b = bottom('五百円', 7.5, JP, 4, 44.5);
      const fill = METAL.whiteClad[1];
      let kiri =
        '<path d="M50 52 C41 51 37 58 42 63 L50 71 L58 63 C63 58 59 51 50 52Z" stroke-width="0"/>' +
        '<path d="M48 54 C40 50 32 53 32 60 L33 68 L40 63 C44 60 47 57 48 54Z" stroke-width="0"/>' +
        '<path d="M52 54 C60 50 68 53 68 60 L67 68 L60 63 C56 60 53 57 52 54Z" stroke-width="0"/>' +
        '<path d="M50 52 V27 M46 52 C44 44 41 38 37 33 M54 52 C56 44 59 38 63 33" fill="none" stroke-width="1"/>';
      // 花: 中央 7・左右 5
      [[50, 28], [47.5, 32.5], [52.5, 32.5], [47, 38], [53, 38], [46.5, 43.5], [53.5, 43.5]].forEach(([x, y]) => (kiri += '<circle cx="' + x + '" cy="' + y + '" r="2.1" stroke-width="0"/>'));
      [[37, 33], [36.5, 38.5], [40.5, 36.5], [40.5, 42], [44, 40.5]].forEach(([x, y]) => (kiri += '<circle cx="' + x + '" cy="' + y + '" r="1.9" stroke-width="0"/>' + '<circle cx="' + (100 - x) + '" cy="' + y + '" r="1.9" stroke-width="0"/>'));
      const veins = '<path d="M50 54 V69 M48 55 L36 64 M52 55 L64 64" stroke-width=".4"/>';
      return { defs: t.def + b.def, body: emboss(t.use + b.use, m) + emboss(kiri, 'whiteClad', fill) + engrave(veins, 'whiteClad') };
    } },
  };

  // ---- セント（表: 肖像） ----
  const USD = {
    // 1¢ リンカーン（右向き）
    1: { metal: 'copper', art(m) {
      const t = top('IN GOD WE TRUST', 6.8, US, 1, 43);
      const p = portrait('lincoln');
      return { defs: t.def, body: emboss(t.use + txt(17, 67, 'LIBERTY', 5, US, 'letter-spacing=".3"') + txt(79, 72, '2025', 6.4, US), m) +
        '<g transform="translate(100 0) scale(-1 1) translate(3 2) scale(.94)">' + emboss(p.shape, m, 'url(#pg)') + engrave(p.lines, m) + '</g>' };
    } },
    // 5¢ ジェファーソン（左向き）
    5: { metal: 'silver', art(m) {
      const l = arc('IN GOD WE TRUST', 42, 115, 235, true, 6, US, .8), r = arc('LIBERTY ★ 2025', 42, 300, 395, true, 6, US, .8);
      const p = portrait('jefferson');
      return { defs: l.def + r.def, body: emboss(l.use + r.use, m) + '<g transform="translate(4 2) scale(.92)">' + emboss(p.shape, m, 'url(#pg)') + engrave(p.lines, m) + '</g>' };
    } },
    // 10¢ ルーズベルト（左向き）
    10: { metal: 'silver', reeded: true, art(m) {
      const l = arc('LIBERTY', 42, 140, 250, true, 8, US, 1.5);
      const p = portrait('roosevelt');
      return { defs: l.def, body: emboss(l.use + txt(25, 69, 'IN GOD', 4.4, US) + txt(25, 74, 'WE TRUST', 4.4, US) + txt(70, 84, '2025', 6, US), m) +
        '<g transform="translate(6 0) scale(.92)">' + emboss(p.shape, m, 'url(#pg)') + engrave(p.lines, m) + '</g>' };
    } },
    // 25¢ ワシントン（左向き）
    25: { metal: 'silver', reeded: true, art(m) {
      const t = top('LIBERTY', 9, US, 3, 43), b = bottom('2025', 7, US, 2, 43);
      const p = portrait('washington');
      return { defs: t.def + b.def, body: emboss(t.use + b.use + txt(21, 71, 'IN GOD', 4.4, US) + txt(21, 76, 'WE TRUST', 4.4, US), m) +
        '<g transform="translate(5 3) scale(.88)">' + emboss(p.shape, m, 'url(#pg)') + engrave(p.lines, m) + '</g>' };
    } },
  };

  function coinSVG(spec) {
    arcId = 0;
    const m = spec.metal;
    const c = METAL[m];
    const art = spec.art(m);
    let defs = grad('g', m) + art.defs +
      '<linearGradient id="rim" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="' + c[0] + '"/><stop offset=".55" stop-color="' + c[2] + '"/><stop offset="1" stop-color="' + c[3] + '"/></linearGradient>' +
      // 金属の地肌のザラつき
      '<filter id="n" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="' + (spec.matte ? 1.9 : 1.3) + '" numOctaves="2" seed="7"/>' +
      '<feColorMatrix values="1 0 0 0 0  1 0 0 0 0  1 0 0 0 0  0 0 0 0 ' + (spec.matte ? 0.22 : 0.12) + '"/><feComposite in2="SourceGraphic" operator="in"/></filter>';
    defs += '<linearGradient id="pg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="' + c[0] + '"/><stop offset=".6" stop-color="' + c[1] + '"/><stop offset="1" stop-color="' + c[2] + '"/></linearGradient>';
    if (spec.bicolor) defs += grad('g2', 'whiteClad');
    if (spec.patina) defs += '<radialGradient id="pt" cx="70%" cy="75%" r="60%"><stop offset="0" stop-color="#4a2410" stop-opacity=".35"/><stop offset="1" stop-color="#4a2410" stop-opacity="0"/></radialGradient>';
    let mask = '';
    if (spec.hole) {
      defs += '<mask id="h"><rect width="100" height="100" fill="#fff"/><circle cx="50" cy="50" r="' + spec.hole + '" fill="#000"/></mask>';
      mask = ' mask="url(#h)"';
    }
    let body =
      '<circle cx="50" cy="50" r="49.5" fill="url(#rim)"/>' +
      '<circle cx="50" cy="50" r="47.6" fill="url(#g)"/>';
    if (spec.reeded) {
      let r = '';
      for (let i = 0; i < 120; i++) r += '<rect x="49.7" y=".6" width=".6" height="1.6" transform="rotate(' + i * 3 + ' 50 50)"/>';
      body += '<g fill="' + c[3] + '" opacity=".5">' + r + '</g>';
    }
    // 縁（盛り上がったリム）
    body += '<circle cx="50" cy="50" r="45.2" fill="none" stroke="' + c[3] + '" stroke-opacity=".55" stroke-width="1"/>' +
      '<circle cx="50" cy="50" r="44.6" fill="none" stroke="#fff" stroke-opacity=".55" stroke-width=".6"/>';
    if (spec.bicolor) {
      // 外周: ニッケル黄銅（金色） / 内側: 白銅・銅・白銅の 3 層（境目に銅色の線）
      body += '<circle cx="50" cy="50" r="33.5" fill="' + METAL.copper[1] + '"/>' +
        '<circle cx="50" cy="50" r="32.8" fill="url(#g2)"/>' +
        '<circle cx="50" cy="50" r="32.8" fill="none" stroke="' + METAL.whiteClad[3] + '" stroke-opacity=".5" stroke-width=".5"/>';
    }
    if (spec.hole) {
      body += '<circle cx="50" cy="50" r="' + (spec.hole + 1.8) + '" fill="none" stroke="' + c[3] + '" stroke-opacity=".6" stroke-width="1.8"/>' +
        '<circle cx="50" cy="50" r="' + (spec.hole + 0.6) + '" fill="none" stroke="#fff" stroke-opacity=".7" stroke-width=".8"/>';
    }
    body += '<circle cx="50" cy="50" r="47.6" fill="#fff" filter="url(#n)"/>';
    if (spec.patina) body += '<circle cx="50" cy="50" r="47.6" fill="url(#pt)"/>';
    body += art.body;
    // 光の反射
    body += '<ellipse cx="35" cy="27" rx="24" ry="12" fill="#fff" opacity=".16" transform="rotate(-32 35 27)"/>';
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs>' + defs + '</defs><g' + mask + '>' + body + '</g></svg>';
  }

  const cache = {};
  function uri(svg) {
    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  }
  /** 額面の画像 URL を返す */
  function moneyImage(code, v) {
    const key = code + '-' + v;
    if (cache[key]) return cache[key];
    cache[key] = uri(coinSVG((code === 'JPY' ? JPY : USD)[v]));
    return cache[key];
  }

  window.OtsuriArt = { moneyImage };
})();
