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
    aluminium: ['#ffffff', '#f1f2f2', '#cfd2d4', '#a3a8ac'],
    brass: ['#fff1b0', '#dcb64e', '#a57a1d', '#6e500c'],
    bronze: ['#f7c09a', '#bf6e3e', '#86411f', '#55270f'],
    cupro: ['#f7f9fb', '#c3c9ce', '#7f878f', '#4f575e'],
    nickelBrass: ['#fff4c4', '#d8bd6a', '#a08533', '#6a5418'],
    whiteClad: ['#fffdf2', '#e3dcc6', '#b2a888', '#7a705a'],
    nickel500: ['#ffffff', '#d9d8cf', '#a4a397', '#6c6b61'],
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
    // 刻印の形をそのまま「高さ」として扱い、左上からの光で陰影と金属の反射をつける（#emb フィルター）
    const f = fill || c[1];
    return '<g filter="url(#emb)" fill="' + f + '" stroke="' + f + '">' + svg + '</g>';
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
  // 透明度を高さとして使う: 低い層（顔全体）に高い層（髪・耳・頬・鼻筋）を重ねる
  function portrait(kind) {
    const lay = (d, o) => '<path d="' + d + '" stroke-width="0" fill-opacity="' + o + '"/>';
    let shape = lay(HEAD + BUST, 0.72);
    // 頬と額のふくらみ、鼻筋、耳
    shape += '<ellipse cx="45" cy="51" rx="10" ry="9" stroke-width="0" fill="url(#soft)"/>' +
      '<ellipse cx="45" cy="33" rx="10" ry="7" stroke-width="0" fill="url(#soft)"/>' +
      '<path d="M35 41 L30.5 50.5" fill="none" stroke-width="1.6" stroke-opacity=".5" stroke-linecap="round"/>' +
      '<path d="M58 42 C63.5 42 65 51 58.6 54 C60 50 60 46 58 42Z" stroke-width="0" fill-opacity=".9"/>';
    let lines = '<path d="M37 40.8 L41 40.4"/><path d="M33.6 56.2 L36 56.4"/><path d="M41 69 C46 70 52 68 56 63"/>';
    if (kind === 'lincoln') {
      shape += lay('M60 46 C63 62 57 76 43 76 C36 76 32 71 32.2 63.5 L34.2 62 C37 68 44 68 50 62 C54 58 56 52 56 46Z', 0.95) +
        lay('M47 21 C58 15 72 19 76 31 C79 40 76 49 71 54 C69 46 66 40 60 35 C56 31 51 28 47 21Z', 1);
      lines += '<path d="M40 70 C45 73 52 72 57 66"/><path d="M60 26 C66 29 70 35 71 42"/><path d="M53 24 C60 25 66 30 68 37"/>';
    } else if (kind === 'washington') {
      shape += lay('M50 21 C61 19 72 25 74 37 C75 46 73 55 69 62 C66 56 64 50 60 44 C56 38 52 33 50 21Z', 0.9) +
        lay('M66 62 C74 63 79 71 75 82 C72 77 68 74 64 72Z', 1) +
        lay('M70 65 C76 59 81 63 78 68 C81 70 78 76 72 71Z', 0.9) +
        '<circle cx="64" cy="44" r="3.4" stroke-width="0"/><circle cx="64" cy="51" r="3.2" stroke-width="0"/>';
      lines += '<path d="M56 28 C62 27 68 31 70 38"/><path d="M58 33 C63 33 67 36 68 42"/>';
    } else if (kind === 'jefferson') {
      shape += lay('M48 21 C60 18 71 24 73 36 C74 44 72 52 68 58 C66 50 62 44 58 39 C54 34 50 30 48 21Z', 0.9) +
        lay('M67 61 C73 62 76 70 72 78 C70 73 67 71 64 70Z', 1) + lay('M40 84.5 L46 93 L53 84.5Z', 0.9);
      lines += '<path d="M55 26 C62 27 67 32 69 39"/>';
    } else if (kind === 'roosevelt') {
      shape += lay('M54 22 C64 23 71 30 72 40 C73 47 71 53 68 58 C66 50 63 43 60 37 C58 31 56 27 54 22Z', 0.95);
      lines += '<path d="M60 28 C65 31 68 36 69 43"/>';
    }
    return { shape, lines: lines.replace(/<path /g, '<path stroke-width=".55" ') };
  }

  // 肖像レリーフ: 不透明な下地 + 光源フィルター（反転などの変形はフィルターの内側でかける）
  function cameo(tf, p, m) {
    const c = METAL[m];
    return '<g transform="' + tf + '"><path d="' + HEAD + BUST + '" fill="' + c[1] + '"/></g>' +
      emboss('<g transform="' + tf + '">' + p.shape + '</g>', m) +
      '<g transform="' + tf + '">' + engrave(p.lines, m) + '</g>';
  }

  // ---- 円 ----
  const JPY = {
    // 1円 裏: 大きな「1」と年号（アルミ: 白くてツヤがない）
    1: { metal: 'aluminium', matte: true, art(m) {
      const one = '<path d="M46.8 22 H56 V67 H46.8 V32.5 L39.5 35.8 V30 Z" stroke-width="0" fill-opacity=".8"/>' +
        '<path d="M51.4 24.5 V64.5 M41.5 32.8 L48.5 28.4" fill="none" stroke-width="1.6" stroke-linecap="round"/>';
      const year = txt(50, 82, '令和七年', 7.8, JP, 'letter-spacing="3.5"');
      return { defs: '', body: emboss(one + year, m) };
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
    // 100円 裏: 背の高い「100」（面取りしたような立体）と年号
    100: { metal: 'cupro', reeded: true, art(m) {
      const rr = (x, y, w, h, r) => 'M' + (x + r) + ' ' + y + ' H' + (x + w - r) + ' A' + r + ' ' + r + ' 0 0 1 ' + (x + w) + ' ' + (y + r) +
        ' V' + (y + h - r) + ' A' + r + ' ' + r + ' 0 0 1 ' + (x + w - r) + ' ' + (y + h) + ' H' + (x + r) + ' A' + r + ' ' + r + ' 0 0 1 ' + x + ' ' + (y + h - r) +
        ' V' + (y + r) + ' A' + r + ' ' + r + ' 0 0 1 ' + (x + r) + ' ' + y + 'Z';
      const zero = (x) => rr(x, 21, 18, 47, 8.6) + rr(x + 6.3, 28.5, 5.9, 32, 2.9);
      const one = 'M32.5 21 H40.5 V62.6 L43.5 63.6 V68 H24.5 V63.6 L29.5 62.6 V31.2 L22.5 34.4 V29 Z';
      // 低い層（字全体）＋高い層（字画の中央の稜線）で面取りの陰影を出す
      const digits =
        '<path d="' + one + zero(43.5) + zero(63) + '" fill-rule="evenodd" stroke-width="0" fill-opacity=".72"/>' +
        '<path d="M36.5 24 V64.5 M27 65.8 H41.5 M24.5 31.5 L32 27.5" fill="none" stroke-width="1.8" stroke-linecap="round"/>' +
        '<path d="' + rr(46.5, 24.4, 12, 40.2, 6) + rr(66, 24.4, 12, 40.2, 6) + '" fill="none" stroke-width="1.8"/>';
      const year = txt(50, 82.5, '令和7年', 8, JP, 'letter-spacing="4.5"');
      return { defs: '', body: emboss(digits + year, m) };
    } },
    // 500円 裏（2021年〜）: 全体は淡い銀色。「500」（0 の中に潜像の縦線）、上に竹、左右に橘、外周に点の輪
    500: { metal: 'nickel500', reeded: true, bicolor: true, art(m) {
      let beads = '';
      for (let i = 0; i < 72; i++) {
        const a = i * 5 * Math.PI / 180;
        beads += '<circle cx="' + f2(50 + Math.cos(a) * 42) + '" cy="' + f2(50 + Math.sin(a) * 42) + '" r=".8" stroke-width="0"/>';
      }
      // 数字「500」: 5 は文字、0 は楕円の輪で形を揃える
      const nums = '<text x="30.5" y="64.5" font-family="' + NUM + '" font-size="40" font-weight="900" text-anchor="middle" stroke-width="1.1" stroke-linejoin="round">5</text>' +
        '<ellipse cx="51" cy="50" rx="8" ry="13.6" fill="none" stroke-width="5"/>' +
        '<ellipse cx="71" cy="50" rx="8" ry="13.6" fill="none" stroke-width="5"/>';
      let latent = '';
      [51, 71].forEach((cx) => [-3.3, -1.1, 1.1, 3.3].forEach((dx) => {
        const h = Math.sqrt(1 - (dx / 5.7) ** 2) * 10.4;
        latent += '<path d="M' + f2(cx + dx) + ' ' + f2(50 - h) + ' V' + f2(50 + h) + '"/>';
      }));
      // 竹（上）
      const bamboo = leafPath(50, 28, 12, 2.8, -78) + leafPath(50, 28, 12, 2.8, 78) + leafPath(50, 28, 10, 2.5, -40) + leafPath(50, 28, 10, 2.5, 40) +
        leafPath(50, 28, 8, 2.2, 0);
      // 橘（左右）: 縦の小枝に葉と実
      const tachibana = (x, flip) => {
        const s = flip ? -1 : 1;
        return '<path d="M' + x + ' 60 C' + (x + s) + ' 54 ' + (x - s) + ' 46 ' + x + ' 40" fill="none" stroke-width=".9"/>' +
          leafPath(x, 58, 7, 2.2, -38 * s) + leafPath(x, 54, 7, 2.2, 38 * s) + leafPath(x, 50, 6.5, 2, -38 * s) +
          leafPath(x, 46, 6.5, 2, 38 * s) + leafPath(x, 42, 6, 1.9, -30 * s) + leafPath(x, 40, 5, 1.7, 0) +
          '<circle cx="' + (x + 1.2 * s) + '" cy="62.5" r="2.3" stroke-width="0"/>';
      };
      const year = txt(50, 81, '令和七年', 7.2, JP, 'letter-spacing="3.2"');
      return { defs: '', body: emboss(beads + nums + bamboo + tachibana(15.5, false) + tachibana(84.5, true) + year, m) + engrave(latent, m) };
    } },
  };

  // ---- セント（表: 肖像） ----
  const USD = {
    // 1¢ リンカーン（右向き）
    1: { metal: 'copper', art(m) {
      const t = top('IN GOD WE TRUST', 6.8, US, 1, 43);
      const p = portrait('lincoln');
      return { defs: t.def, body: emboss(t.use + txt(17, 67, 'LIBERTY', 5, US, 'letter-spacing=".3"') + txt(79, 72, '2025', 6.4, US), m) +
        cameo('translate(100 0) scale(-1 1) translate(3 2) scale(.94)', p, m) };
    } },
    // 5¢ ジェファーソン（左向き）
    5: { metal: 'silver', art(m) {
      const l = arc('IN GOD WE TRUST', 42, 115, 235, true, 6, US, .8), r = arc('LIBERTY ★ 2025', 42, 300, 395, true, 6, US, .8);
      const p = portrait('jefferson');
      return { defs: l.def + r.def, body: emboss(l.use + r.use, m) + cameo('translate(4 2) scale(.92)', p, m) };
    } },
    // 10¢ ルーズベルト（左向き）
    10: { metal: 'silver', reeded: true, art(m) {
      const l = arc('LIBERTY', 42, 140, 250, true, 8, US, 1.5);
      const p = portrait('roosevelt');
      return { defs: l.def, body: emboss(l.use + txt(25, 69, 'IN GOD', 4.4, US) + txt(25, 74, 'WE TRUST', 4.4, US) + txt(70, 84, '2025', 6, US), m) +
        cameo('translate(6 0) scale(.92)', p, m) };
    } },
    // 25¢ ワシントン（左向き）
    25: { metal: 'silver', reeded: true, art(m) {
      const t = top('LIBERTY', 9, US, 3, 43), b = bottom('2025', 7, US, 2, 43);
      const p = portrait('washington');
      return { defs: t.def + b.def, body: emboss(t.use + b.use + txt(21, 71, 'IN GOD', 4.4, US) + txt(21, 76, 'WE TRUST', 4.4, US), m) +
        cameo('translate(5 3) scale(.88)', p, m) };
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
    defs +=
      '<filter id="emb" x="-10%" y="-10%" width="120%" height="120%" color-interpolation-filters="sRGB">' +
      '<feGaussianBlur in="SourceAlpha" stdDeviation=".6" result="b"/>' +
      '<feDiffuseLighting in="b" surfaceScale="2.6" diffuseConstant="1.3" lighting-color="#fff" result="d"><feDistantLight azimuth="225" elevation="50"/></feDiffuseLighting>' +
      '<feComposite in="SourceGraphic" in2="d" operator="arithmetic" k1="1" result="lit"/>' +
      '<feSpecularLighting in="b" surfaceScale="2.6" specularConstant="' + (spec.matte ? 0.15 : 0.75) + '" specularExponent="' + (spec.matte ? 12 : 34) + '" lighting-color="#fff" result="s"><feDistantLight azimuth="225" elevation="50"/></feSpecularLighting>' +
      '<feComposite in="s" in2="SourceAlpha" operator="in" result="s2"/>' +
      '<feComposite in="lit" in2="s2" operator="arithmetic" k2="1" k3="1" result="o"/>' +
      '<feComposite in="o" in2="SourceAlpha" operator="in" result="relief"/>' +
      '<feOffset in="SourceAlpha" dx=".5" dy=".7" result="off"/><feGaussianBlur in="off" stdDeviation=".45" result="ob"/>' +
      '<feFlood flood-color="#000" flood-opacity=".3"/><feComposite in2="ob" operator="in" result="sh"/>' +
      '<feMerge><feMergeNode in="sh"/><feMergeNode in="relief"/></feMerge></filter>';
    defs += '<radialGradient id="soft"><stop offset="0" stop-color="' + c[1] + '" stop-opacity=".45"/><stop offset="1" stop-color="' + c[1] + '" stop-opacity="0"/></radialGradient>';
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
    body += '<g filter="url(#emb)"><circle cx="50" cy="50" r="46.4" fill="none" stroke="' + c[1] + '" stroke-width="2.6"/></g>';
    if (spec.bicolor) {
      // バイカラー・クラッド: 中心部がわずかに温かみのある色（見た目の差はごく小さい）
      body += '<circle cx="50" cy="50" r="33" fill="#d8cfb0" fill-opacity=".18"/>' +
        '<circle cx="50" cy="50" r="33" fill="none" stroke="#8a826a" stroke-opacity=".18" stroke-width=".4"/>';
    }
    if (spec.hole) {
      body += '<g filter="url(#emb)"><circle cx="50" cy="50" r="' + (spec.hole + 1.4) + '" fill="none" stroke="' + c[1] + '" stroke-width="2.6"/></g>';
    }
    body += '<circle cx="50" cy="50" r="47.6" fill="#fff" filter="url(#n)"/>';
    if (spec.patina) body += '<circle cx="50" cy="50" r="47.6" fill="url(#pt)"/>';
    body += art.body;
    // 光の反射
    body += '<ellipse cx="35" cy="27" rx="24" ry="12" fill="#fff" opacity="' + (spec.matte ? 0.05 : 0.22) + '" transform="rotate(-32 35 27)"/>';
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
