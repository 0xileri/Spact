/**
 * Renders the brand PNGs in public/ from HTML with Chromium, so they match favicon.svg and the font.
 * Run after changing the mark, the colors or the share card:
 *   node --experimental-strip-types dev/render-brand.ts
 */
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";

import { chromium } from "@playwright/test";

const WEB = resolve(import.meta.dirname, "..");
const PUBLIC = join(WEB, "public");
const INK = "#0b0f14";
const PAPER = "#f7f6f2";
const PAID = "#10b981";
const WAITS = "#f59e0b";
const BLOCKED = "#f43f5e";

const font = readFileSync(join(WEB, "node_modules/@fontsource-variable/space-grotesk/files/space-grotesk-latin-wght-normal.woff2"));
const fontFace = `@font-face { font-family: "Space Grotesk"; font-weight: 300 700; src: url(data:font/woff2;base64,${font.toString("base64")}) format("woff2"); }`;

/** The gate mark at any size; `square` drops the rounded corners (iOS masks icons itself). */
function mark(size: number, square = false): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="${size}" height="${size}">
    <rect width="32" height="32" rx="${square ? 0 : 8}" fill="${INK}"/>
    <rect x="7.5" y="8" width="3.5" height="16" rx="1.75" fill="${PAPER}"/>
    <rect x="21" y="8" width="3.5" height="16" rx="1.75" fill="${PAPER}"/>
    <circle cx="16" cy="16" r="3.25" fill="${PAID}"/>
  </svg>`;
}

const pill = (color: string, label: string) =>
  `<span class="pill"><span class="dot" style="background:${color}"></span>${label}</span>`;

const card = `<!doctype html><html><head><style>
  ${fontFace}
  * { margin: 0; box-sizing: border-box; }
  body { width: 1200px; height: 630px; background: ${PAPER}; color: ${INK}; font-family: "Space Grotesk", sans-serif; position: relative; overflow: hidden; }
  .left { position: absolute; left: 80px; top: 64px; width: 840px; }
  .brand { display: flex; align-items: center; gap: 18px; }
  .word { font-size: 44px; font-weight: 700; letter-spacing: 0.14em; }
  h1 { margin-top: 56px; font-size: 70px; line-height: 1.04; font-weight: 700; letter-spacing: -0.02em; }
  p { margin-top: 24px; font-size: 28px; color: #475569; font-weight: 400; }
  .pills { position: absolute; left: 80px; bottom: 60px; display: flex; gap: 14px; }
  .pill { display: inline-flex; align-items: center; gap: 12px; padding: 12px 22px; border-radius: 999px; background: #fff; border: 2px solid #e2e0d8; font-size: 24px; font-weight: 500; }
  .dot { width: 16px; height: 16px; border-radius: 50%; }
  .gate { position: absolute; right: 88px; top: 170px; width: 190px; height: 290px; }
  .post { position: absolute; top: 0; width: 38px; height: 290px; border-radius: 19px; background: ${INK}; }
  .ball { position: absolute; left: 50%; top: 50%; width: 54px; height: 54px; margin: -27px 0 0 -27px; border-radius: 50%; background: ${PAID}; }
  .note { position: absolute; right: 88px; top: 88px; font-size: 18px; color: #64748b; }
</style></head><body>
  <div class="left">
    <div class="brand">${mark(64)}<span class="word">SPACT</span></div>
    <h1>Autonomous spending.<br>Human rules.</h1>
    <p>A spending firewall for AI agents on NEAR.</p>
  </div>
  <div class="gate"><div class="post" style="left:0"></div><div class="post" style="right:0"></div><div class="ball"></div></div>
  <div class="pills">${pill(PAID, "Paid at once")}${pill(WAITS, "Waits for your wallet")}${pill(BLOCKED, "Blocked")}</div>
  <div class="note">NEAR testnet · unaudited prototype</div>
</body></html>`;

const icon = (size: number, square: boolean) =>
  `<!doctype html><html><body style="margin:0;background:transparent">${mark(size, square)}</body></html>`;

const browser = await chromium.launch();
try {
  const shots: [string, string, number, number, boolean][] = [
    ["og-image.png", card, 1200, 630, false],
    ["favicon-32.png", icon(32, false), 32, 32, true],
    ["apple-touch-icon.png", icon(180, true), 180, 180, false],
  ];
  for (const [file, html, width, height, transparent] of shots) {
    const page = await browser.newPage({ viewport: { width, height } });
    await page.setContent(html);
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: join(PUBLIC, file), omitBackground: transparent });
    await page.close();
    console.log(`wrote public/${file}`);
  }
} finally {
  await browser.close();
}
