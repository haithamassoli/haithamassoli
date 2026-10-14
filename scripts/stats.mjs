/* --------------------------------------------------------------------------
   Redraws assets/stats-{dark,light}.svg: hours from WakaTime, the past year of
   contributions from GitHub, in the portfolio's colours. Same sources and the
   same parsing as the portfolio's dev-stats section.

   No dependencies: type is drawn from the outlines in glyphs.json, which
   build-assets.mjs writes. If either source fails, the script exits non-zero
   and the last good card stays in place.
   -------------------------------------------------------------------------- */

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { themes } from "./theme.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const USER = "haithamassoli";
const WAKATIME = `https://wakatime.com/api/v1/users/${USER}/stats/all_time`;
const CONTRIBUTIONS = `https://github.com/users/${USER}/contributions`;

/* ── Data ────────────────────────────────────────────────────────────────── */

async function get(url) {
  const response = await fetch(url, { headers: { "x-requested-with": "XMLHttpRequest" } });
  if (!response.ok) throw new Error(`${url} responded ${response.status}`);
  return response.text();
}

/** Day cells from GitHub's calendar fragment, oldest first. */
function parseContributions(html) {
  const counts = new Map();
  const tooltips = /<tool-tip[^>]*\bfor="(contribution-day-component-[\d-]+)"[^>]*>([^<]*)<\/tool-tip>/g;
  for (const match of html.matchAll(tooltips)) {
    const written = /^(\d[\d,]*) contribution/.exec(match[2]);
    counts.set(match[1], written ? Number(written[1].replace(/,/g, "")) : 0);
  }
  const days = [];
  for (const [tag] of html.matchAll(/<td\b[^>]*class="ContributionCalendar-day"[^>]*>/g)) {
    const attr = (name) => new RegExp(`\\b${name}="([^"]+)"`).exec(tag)?.[1];
    const date = attr("data-date");
    const level = attr("data-level");
    if (date === undefined || level === undefined) continue;
    days.push({ date, level: Number(level), count: counts.get(attr("id") ?? "") ?? 0 });
  }
  if (days.length === 0) throw new Error("no contribution cells found");
  return days.sort((a, b) => (a.date < b.date ? -1 : 1));
}

function topSlices(slices, keep) {
  const sorted = [...slices].sort((a, b) => b.total_seconds - a.total_seconds);
  const hours = (s) => Math.round(s / 3600);
  const rest = hours(sorted.slice(keep).reduce((sum, s) => sum + s.total_seconds, 0));
  const top = sorted.slice(0, keep).map((s) => ({ name: s.name, hours: hours(s.total_seconds) }));
  return rest > 0 ? [...top, { name: "Other", hours: rest }] : top;
}

const [wakaBody, calendarBody] = await Promise.all([get(WAKATIME), get(CONTRIBUTIONS)]);
const waka = JSON.parse(wakaBody).data;
const days = parseContributions(calendarBody);

const stats = {
  days,
  languages: topSlices(waka.languages, 4),
  hours: Math.round(waka.total_seconds / 3600),
  contributions: days.reduce((sum, d) => sum + d.count, 0),
  activeDays: days.filter((d) => d.count > 0).length,
};

/* ── Type ────────────────────────────────────────────────────────────────── */

const glyphs = JSON.parse(readFileSync(join(root, "scripts/glyphs.json"), "utf8"));
const fmt = (n) => n.toLocaleString("en-US");

/** Each glyph is defined once per card and reused with <use>. */
function typesetter(prefix) {
  const used = new Map();
  const id = (face, ch) => `${prefix}-${face}-${ch.codePointAt(0)}`;

  function width(face, text, size) {
    const font = glyphs[face];
    return [...text].reduce((w, ch) => w + (font.glyphs[ch]?.a ?? 0), 0) * (size / font.upm);
  }

  function text(face, str, size, x, y, fill, anchor = "start") {
    const font = glyphs[face];
    const scale = size / font.upm;
    const start = anchor === "end" ? x - width(face, str, size) : x;
    let pen = 0;
    const uses = [];
    for (const ch of str) {
      const glyph = font.glyphs[ch];
      if (!glyph) continue;
      if (glyph.d) {
        used.set(id(face, ch), glyph.d);
        uses.push(`<use href="#${id(face, ch)}" x="${pen}"/>`);
      }
      pen += glyph.a;
    }
    return `<g transform="translate(${start.toFixed(1)} ${y}) scale(${scale.toFixed(5)})" fill="${fill}">${uses.join("")}</g>`;
  }

  const defs = () => [...used].map(([key, d]) => `<path id="${key}" d="${d}"/>`).join("");
  return { text, width, defs };
}

/* ── Card ────────────────────────────────────────────────────────────────── */

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function card(t, mode) {
  const W = 1200;
  const H = 468;
  const CELL = 16;
  const STEP = 20;
  const type = typesetter(mode[0]);

  const weeks = Math.ceil((days.length + new Date(`${days[0].date}T00:00:00Z`).getUTCDay()) / 7);
  const gridW = weeks * STEP - (STEP - CELL);
  const x0 = Math.round((W - gridW) / 2);
  const calTop = 210;
  const offset = new Date(`${days[0].date}T00:00:00Z`).getUTCDay();

  // Figures
  const figures = [
    [fmt(stats.hours), "hours in the editor, all time"],
    [fmt(stats.contributions), "contributions in the past year"],
    [fmt(stats.activeDays), "days with a contribution"],
  ];
  const colW = gridW / 3;
  const figureMarkup = figures
    .map(([value, label], i) => {
      const x = x0 + i * colW;
      return type.text("acorn", value, 64, x, 112, t.primary) + type.text("inter", label, 20, x, 148, t.muted);
    })
    .join("\n");

  // Calendar
  const cells = [];
  const months = [];
  let lastMonthCol = -4;
  days.forEach((day, i) => {
    const col = Math.floor((i + offset) / 7);
    const row = (i + offset) % 7;
    const level = Math.max(0, Math.min(4, day.level));
    const tip = `${day.count} on ${day.date}`;
    cells.push(
      `<rect class="c" style="animation-delay:${(col * 18).toFixed(0)}ms" x="${x0 + col * STEP}" y="${calTop + row * STEP}" width="${CELL}" height="${CELL}" rx="4" fill="${t.calendar[level]}"><title>${tip}</title></rect>`,
    );
    if (day.date.endsWith("-01") && col - lastMonthCol >= 3) {
      months.push(type.text("inter", MONTHS[Number(day.date.slice(5, 7)) - 1], 16, x0 + col * STEP, calTop - 12, t.muted));
      lastMonthCol = col;
    }
  });

  // Languages
  const barY = calTop + 7 * STEP + 34;
  const total = stats.languages.reduce((s, l) => s + l.hours, 0);
  let bx = x0;
  const gap = 4;
  const segments = stats.languages
    .map((lang, i) => {
      const w = Math.max(2, (lang.hours / total) * (gridW - gap * (stats.languages.length - 1)));
      const seg = `<rect x="${bx.toFixed(1)}" y="${barY}" width="${w.toFixed(1)}" height="10" fill="${t.languages[i]}"/>`;
      bx += w + gap;
      return seg;
    })
    .join("");

  let lx = x0;
  const legendY = barY + 48;
  const legend = stats.languages
    .map((lang, i) => {
      const name = type.text("inter", lang.name, 19, lx + 20, legendY, t.ink);
      const nameW = type.width("inter", lang.name, 19);
      const hours = `${fmt(lang.hours)} h`;
      const value = type.text("inter", hours, 19, lx + 20 + nameW + 8, legendY, t.muted);
      const swatch = `<rect x="${lx}" y="${legendY - 13}" width="13" height="13" rx="3.5" fill="${t.languages[i]}"/>`;
      lx += 20 + nameW + 8 + type.width("inter", hours, 19) + 30;
      return swatch + name + value;
    })
    .join("");

  const body = [figureMarkup, months.join(""), cells.join("\n"), segments, legend].join("\n");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="${fmt(stats.hours)} hours coded, ${fmt(stats.contributions)} contributions and ${stats.activeDays} active days in the past year">
<title>${fmt(stats.hours)} hours coded, ${fmt(stats.contributions)} contributions in the past year</title>
<defs>
${type.defs()}
<clipPath id="bar"><rect x="${x0}" y="${barY}" width="${gridW}" height="10" rx="5"/></clipPath>
</defs>
<style>
.c{transform-box:fill-box;transform-origin:center;animation:in .45s cubic-bezier(.2,.8,.2,1) both}
@keyframes in{from{opacity:0;transform:scale(.3)}to{opacity:1;transform:none}}
@media (prefers-reduced-motion:reduce){.c{animation:none}}
</style>
<rect width="${W}" height="${H}" rx="24" fill="${t.ground}"/>
<rect x=".5" y=".5" width="${W - 1}" height="${H - 1}" rx="23.5" fill="none" stroke="${t.edge}"/>
${body.replace(segments, `<g clip-path="url(#bar)">${segments}</g>`)}
</svg>
`;
}

for (const [mode, t] of Object.entries(themes)) {
  const file = join(root, `assets/stats-${mode}.svg`);
  writeFileSync(file, card(t, mode));
  console.log(`  assets/stats-${mode}.svg`);
}
console.log(`  ${fmt(stats.hours)} h, ${fmt(stats.contributions)} contributions, ${stats.activeDays} active days`);
