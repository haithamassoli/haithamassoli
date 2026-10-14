/* --------------------------------------------------------------------------
   Draws the README's static artwork: hero, tape, headings, buttons and the
   signature, each in a dark and a light version.

   All type is outlined to paths, so the images look the same on every machine
   and no font file ships in this repo. Acorn and the logo are read from the
   portfolio repo, expected next to this one:

     PORTFOLIO=../frontend-tribe-portofolio-main npm run assets

   Also writes scripts/glyphs.json, the outlines stats.mjs needs to redraw the
   stats card every day without a font or a dependency.
   -------------------------------------------------------------------------- */

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import * as fontkit from "fontkit";

import { themes } from "./theme.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const out = join(root, "assets");
mkdirSync(out, { recursive: true });

const portfolio = resolve(root, process.env.PORTFOLIO ?? "../frontend-tribe-portofolio-main");
const fontDir = join(portfolio, "src/fonts");
const require = createRequire(import.meta.url);
const interFile = (weight) =>
  require.resolve(`@fontsource/inter/files/inter-latin-${weight}-normal.woff2`);

const fonts = {
  acorn: fontkit.openSync(join(fontDir, "Acorn-Bold.woff2")),
  inter: fontkit.openSync(interFile(500)),
  interBold: fontkit.openSync(interFile(700)),
};

/* ── Type ────────────────────────────────────────────────────────────────── */

const round = (d) =>
  d.replace(/-?\d*\.\d+/g, (n) => String(Math.round(Number(n) * 10) / 10));

/** Lays out a line and returns one outlined path per glyph, plus its width. */
function shape(font, text, size, tracking = 0) {
  const run = font.layout(text);
  const scale = size / font.unitsPerEm;
  const glyphs = [];
  let x = 0;
  run.glyphs.forEach((glyph, i) => {
    const pos = run.positions[i];
    const gx = x + pos.xOffset * scale;
    const d = glyph.path.scale(scale, -scale).translate(gx, -pos.yOffset * scale).toSVG();
    if (d) glyphs.push({ d: round(d), x: gx, width: pos.xAdvance * scale });
    x += pos.xAdvance * scale + tracking;
  });
  return { glyphs, width: x - tracking };
}

/** One path for a whole line, starting at (x, baseline). */
function line(font, text, size, x, baseline, tracking = 0) {
  const { glyphs, width } = shape(font, text, size, tracking);
  const d = glyphs.map((g) => g.d).join("");
  return { d, width, transform: `translate(${x.toFixed(1)} ${baseline})` };
}

/* ── Shared pieces ───────────────────────────────────────────────────────── */

const STAR =
  "M12 1C12 1 12 8 10 10C8 12 1 12 1 12C1 12 8 12 10 14C12 16 12 23 12 23C12 23 12 16 14 14C16 12 23 12 23 12C23 12 16 12 14 10C12 8 12 1 12 1Z";
const SPARKLE = "M1 12L10.1667 10.1667L12 1L13.8333 10.1667L23 12L13.8333 13.8333L12 23L10.1667 13.8333L1 12Z";

/** A 24-unit icon centred on the origin at `size` pixels. */
const icon = (d, size, fill, extra = "") =>
  `<path d="${d}" fill="${fill}" transform="scale(${size / 24}) translate(-12 -12)" ${extra}/>`;

const svg = (w, h, body, title) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img" aria-label="${title}">
<title>${title}</title>
${body}
</svg>
`;

const write = (name, content) => {
  writeFileSync(join(out, name), content);
  console.log(`  assets/${name}  ${(content.length / 1024).toFixed(1)} KB`);
};

/* ── Hero ────────────────────────────────────────────────────────────────── */
/* The site's opening frame, held still enough to read: halo, a light-speed
   field kept off the type, two tilted orbits with stars riding them, and the
   name landing letter by letter before a light band rolls through it three
   times. */

function hero(t) {
  const W = 1200;
  const H = 540;
  const cx = W / 2;
  const cy = 282;

  const name = shape(fonts.acorn, "Haitham Assoli", 104, 2);
  const nameX = cx - name.width / 2;
  const nameBase = 258;

  const sub = shape(fonts.acorn, "I build web & mobile apps.", 58, 1);
  const subX = cx - sub.width / 2;
  const subBase = 348;

  const role = line(fonts.inter, "Full-stack engineer in Amman, Jordan", 21, 0, 0, 0.4);
  role.transform = `translate(${(cx - role.width / 2).toFixed(1)} 444)`;

  // The CSS animation owns each glyph's transform, so the placement sits on
  // the wrapping group; on the path itself it would be overwritten.
  const glyphs = (set, x0, base, fill, offset) =>
    `<g transform="translate(${x0.toFixed(1)} ${base})" fill="${fill}">\n${set.glyphs
      .map(
        (g, i) =>
          `<path class="g" style="animation-delay:${((i + offset) * 0.05 + 0.15).toFixed(2)}s" d="${g.d}"/>`,
      )
      .join("\n")}\n</g>`;

  const nameD = name.glyphs.map((g) => g.d).join("");

  // Light-speed rays: golden-angle spread, as on the site.
  const rays = Array.from({ length: 30 }, (_, i) => {
    const angle = (i * 137.508) % 360;
    const length = 110 + ((i * 11) % 30) * 6;
    const color = i % t.rays.length;
    const delay = -(((i * 7) % 30) * 0.2).toFixed(1);
    return `<g transform="translate(${cx} ${cy}) rotate(${angle.toFixed(1)})"><rect class="ray" width="${length}" height="${i % 3 === 0 ? 3 : 2}" y="-1" fill="url(#ray${color})" style="animation-delay:${delay}s"/></g>`;
  }).join("\n");

  const rayGradients = t.rays
    .map(
      (c, i) =>
        `<linearGradient id="ray${i}"><stop offset="0" stop-color="${c}" stop-opacity="0"/><stop offset=".8" stop-color="${c}"/><stop offset="1" stop-color="${t.rayTip}"/></linearGradient>`,
    )
    .join("");

  // An ellipse as a closed path, so a star can ride it with <mpath>.
  const orbit = (id, rx, ry) =>
    `<path id="${id}" d="M${cx + rx} ${cy}A${rx} ${ry} 0 1 1 ${cx - rx} ${cy}A${rx} ${ry} 0 1 1 ${cx + rx} ${cy}Z" fill="none" stroke="${t.orbit}" stroke-width="1.2"/>`;

  const rider = (path, dur, begin, size, fill, spin) =>
    `<g class="rider"><animateMotion dur="${dur}s" begin="${begin}s" repeatCount="indefinite"><mpath href="#${path}"/></animateMotion><g class="spin" style="animation-duration:${spin}s">${icon(STAR, size, fill, `filter="url(#glow)"`)}</g></g>`;

  const body = `<defs>
<radialGradient id="halo" cx="50%" cy="48%" r="60%"><stop offset="0" stop-color="${t.halo}" stop-opacity=".13"/><stop offset=".3" stop-color="${t.halo}" stop-opacity=".03"/><stop offset=".6" stop-color="${t.halo}" stop-opacity="0"/></radialGradient>
<radialGradient id="rayMaskGrad" cx="50%" cy="48%" r="50%" gradientTransform="translate(.5 .48) scale(1 .62) translate(-.5 -.48)"><stop offset=".42" stop-color="#000"/><stop offset=".95" stop-color="#fff"/></radialGradient>
<mask id="rayMask"><rect width="${W}" height="${H}" fill="url(#rayMaskGrad)"/></mask>
${rayGradients}
<linearGradient id="nameFill" gradientUnits="userSpaceOnUse" x1="${nameX}" x2="${nameX + name.width}"><stop offset="0" stop-color="${t.primary}"/><stop offset=".55" stop-color="${t.primary}"/><stop offset=".8" stop-color="${t.secondary}"/><stop offset="1" stop-color="${t.primary}"/></linearGradient>
<linearGradient id="shine"><stop offset="0" stop-color="${t.shine}" stop-opacity="0"/><stop offset=".5" stop-color="${t.shine}" stop-opacity="${t.shineOpacity}"/><stop offset="1" stop-color="${t.shine}" stop-opacity="0"/></linearGradient>
<mask id="nameMask"><path transform="translate(${nameX.toFixed(1)} ${nameBase})" d="${nameD}" fill="#fff"/></mask>
<linearGradient id="rule"><stop offset="0" stop-color="${t.secondary}" stop-opacity="0"/><stop offset=".5" stop-color="${t.secondary}"/><stop offset="1" stop-color="${t.secondary}" stop-opacity="0"/></linearGradient>
<filter id="glow" x="-1" y="-1" width="3" height="3"><feGaussianBlur stdDeviation="1.6" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
<clipPath id="card"><rect width="${W}" height="${H}" rx="24"/></clipPath>
</defs>
<style>
.g{transform-box:fill-box;transform-origin:50% 100%;animation:land 1s cubic-bezier(.16,1,.3,1) both}
.after{animation:land 1s cubic-bezier(.16,1,.3,1) 1.2s both}
.ray{transform-box:view-box;opacity:0;animation:ray 6s cubic-bezier(.45,0,.85,.5) infinite}
.sweep{animation:sweep 4s ease-in-out 2.2s 3 both}
.spin{transform-box:fill-box;transform-origin:center;animation:spin 6s linear infinite}
.drift{transform-box:view-box;transform-origin:${cx}px ${cy}px;animation:drift 120s linear infinite}
.still{display:none}
@keyframes land{from{opacity:0;transform:translateY(.3em) scale(.85)}to{opacity:1;transform:none}}
@keyframes ray{0%{opacity:0;transform:translateX(40px) scaleX(.02)}15%{opacity:.35}50%{opacity:.85}100%{opacity:0;transform:translateX(780px) scaleX(2)}}
@keyframes sweep{0%,40%{transform:translateX(-320px) skewX(-20deg)}75%,100%{transform:translateX(${W + 40}px) skewX(-20deg)}}
@keyframes spin{to{transform:rotate(360deg)}}
@keyframes drift{to{transform:rotate(360deg)}}
@media (prefers-reduced-motion:reduce){*{animation:none!important}.ray,.rider,.sweep{display:none}.still{display:inline}}
</style>
<g clip-path="url(#card)">
<rect width="${W}" height="${H}" fill="${t.ground}"/>
<rect width="${W}" height="${H}" fill="url(#halo)"/>
<g mask="url(#rayMask)" opacity="${t.rayOpacity}">
${rays}
</g>
<g class="drift">
${orbit("o1", 560, 168)}
${rider("o1", 46, -8, 30, t.star, 6)}
${rider("o1", 46, -31, 18, t.starSoft, 4)}
</g>
<g transform="rotate(-22 ${cx} ${cy})">
${orbit("o2", 470, 228)}
${rider("o2", 38, -4, 22, t.star, 6)}
${rider("o2", 38, -24, 12, t.starSoft, 3)}
</g>
<g class="still">
<g transform="translate(1046 150)">${icon(STAR, 26, t.star, `filter="url(#glow)"`)}</g>
<g transform="translate(178 424)">${icon(STAR, 18, t.starSoft, `filter="url(#glow)"`)}</g>
</g>
<g transform="translate(136 290)">${icon(STAR, 54, t.star, `filter="url(#glow)"`)}</g>
<g transform="translate(1088 472)" opacity=".7">${icon(SPARKLE, 26, t.sparkle)}</g>
<g transform="translate(1012 232)">${icon(STAR, 16, t.starSoft, `filter="url(#glow)"`)}</g>
${glyphs(name, nameX, nameBase, "url(#nameFill)", 0)}
<g mask="url(#nameMask)"><rect class="sweep" x="0" y="120" width="220" height="160" fill="url(#shine)"/></g>
${glyphs(sub, subX, subBase, t.ink, 6)}
<g class="after">
<rect x="${cx - 32}" y="388" width="64" height="1.5" fill="url(#rule)"/>
<path transform="${role.transform}" d="${role.d}" fill="${t.role}"/>
</g>
<rect x=".5" y=".5" width="${W - 1}" height="${H - 1}" rx="23.5" fill="none" stroke="${t.edge}"/>
</g>`;

  return svg(W, H, body, "Haitham Assoli. I build web and mobile apps. Full-stack engineer in Amman, Jordan.");
}

/* ── Tape ────────────────────────────────────────────────────────────────── */
/* The tilted mint band from the site, words and stars running along it. */

const TAPE_WORDS = [
  "Fast",
  "Accessible",
  "Secure",
  "Interactive",
  "Scalable",
  "User friendly",
  "Responsive",
  "Maintainable",
  "Search optimised",
  "Bilingual",
  "Works offline",
  "Reliable",
];

function tape(t) {
  const W = 1200;
  const H = 150;
  const bandH = 58;
  const size = 25;
  const gap = 22;
  const starSize = 22;

  let x = 0;
  const items = [];
  for (const word of TAPE_WORDS) {
    const l = line(fonts.acorn, word, size, x, 9, 0.3);
    items.push(`<path transform="translate(${x.toFixed(1)} 9)" d="${l.d}"/>`);
    x += l.width + gap;
    items.push(`<g transform="translate(${(x + starSize / 2).toFixed(1)} 0) rotate(-12)">${icon(STAR, starSize, "currentColor")}</g>`);
    x += starSize + gap;
  }
  const setWidth = x;
  const copies = Math.ceil((W + 80) / setWidth) + 1;
  const row = Array.from(
    { length: copies },
    (_, i) => (i === 0 ? `<g id="set">${items.join("")}</g>` : `<use href="#set" x="${(i * setWidth).toFixed(1)}"/>`),
  ).join("");

  const body = `<defs>
<linearGradient id="band"><stop offset="0" stop-color="${t.accent1}"/><stop offset="1" stop-color="${t.accent2}"/></linearGradient>
<linearGradient id="fadeGrad"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".08" stop-color="#fff"/><stop offset=".92" stop-color="#fff"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
<mask id="fade"><rect width="${W}" height="${H}" fill="url(#fadeGrad)"/></mask>
<clipPath id="bandClip"><rect x="-40" y="${(H - bandH) / 2}" width="${W + 80}" height="${bandH}"/></clipPath>
</defs>
<style>
.run{animation:run ${Math.round(setWidth / 52)}s linear infinite}
@keyframes run{to{transform:translateX(-${setWidth.toFixed(1)}px)}}
@media (prefers-reduced-motion:reduce){.run{animation:none}}
</style>
<g mask="url(#fade)">
<g transform="rotate(-3 ${W / 2} ${H / 2})">
<rect x="-40" y="${(H - bandH) / 2}" width="${W + 80}" height="${bandH}" fill="url(#band)"/>
<g clip-path="url(#bandClip)">
<g transform="translate(0 ${H / 2})" fill="${t.onAccent}" color="${t.onAccent}">
<g class="run">${row}</g>
</g>
</g>
</g>
</g>`;

  return svg(W, H, body, TAPE_WORDS.join(", "));
}

/* ── Headings ────────────────────────────────────────────────────────────── */

function heading(t, text) {
  const size = 46;
  const l = line(fonts.acorn, text, size, 0, 0, 0);
  const W = Math.ceil(l.width) + 8;
  const H = 64;
  const body = `<path transform="translate(4 48)" d="${l.d}" fill="${t.primary}"/>`;
  return svg(W, H, body, text);
}

/* ── Buttons ─────────────────────────────────────────────────────────────── */
/* The hero's two calls to action, solid and outlined. */

function button(t, text, solid) {
  const size = 17;
  const l = line(fonts.interBold, text, size, 0, 0, 0);
  const padX = 26;
  const H = 52;
  const W = Math.ceil(l.width + padX * 2);
  const fill = solid ? t.btnSolid : "none";
  const ink = solid ? t.btnSolidInk : t.ink;
  const stroke = solid ? t.btnSolid : t.btnEdge;
  const body = `<rect x=".75" y=".75" width="${W - 1.5}" height="${H - 1.5}" rx="12" fill="${fill}" stroke="${stroke}" stroke-width="1.5"/>
<path transform="translate(${padX} 32.5)" d="${l.d}" fill="${ink}"/>`;
  return svg(W, H, body, text);
}

/* ── Signature ───────────────────────────────────────────────────────────── */

function signature(t) {
  const logo = readFileSync(join(portfolio, "src/assets/icons/logo.svg"), "utf8");
  const [first, last] = [...logo.matchAll(/d="([^"]+)"/g)].map((m) => m[1]);
  const W = 320;
  const scale = W / 7752;
  const H = Math.ceil(1847 * scale);
  const body = `<g transform="scale(${scale.toFixed(5)}) translate(-21 1774)"><path d="${first}" fill="${t.ink}"/><path d="${last}" fill="${t.secondary}"/></g>`;
  return svg(W, H, body, "Haitham");
}

/* ── Glyphs for the daily stats card ─────────────────────────────────────── */

function glyphTable(font, chars) {
  const table = {};
  for (const ch of chars) {
    const glyph = font.glyphForCodePoint(ch.codePointAt(0));
    table[ch] = { d: round(glyph.path.scale(1, -1).toSVG()), a: glyph.advanceWidth };
  }
  return { upm: font.unitsPerEm, glyphs: table };
}

/* ── Write ───────────────────────────────────────────────────────────────── */

const HEADINGS = {
  now: "Building now",
  work: "Selected work",
  toolbox: "Toolbox",
  hours: "Where the hours go",
};

for (const [mode, t] of Object.entries(themes)) {
  write(`hero-${mode}.svg`, hero(t));
  write(`tape-${mode}.svg`, tape(t));
  for (const [slug, text] of Object.entries(HEADINGS)) write(`h-${slug}-${mode}.svg`, heading(t, text));
  write(`btn-work-${mode}.svg`, button(t, "See my work", true));
  write(`btn-hire-${mode}.svg`, button(t, "Start a project", false));
  write(`signature-${mode}.svg`, signature(t));
}

const ascii = Array.from({ length: 95 }, (_, i) => String.fromCharCode(32 + i)).join("");
writeFileSync(
  join(root, "scripts/glyphs.json"),
  JSON.stringify({
    acorn: glyphTable(fonts.acorn, "0123456789,"),
    inter: glyphTable(fonts.inter, ascii),
  }),
);
console.log("  scripts/glyphs.json");
