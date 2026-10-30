/**
 * The SpactVault mark's geometry (DECISIONS ADR-027): the Space Grotesk Bold S and V, in font units,
 * placed in a 100 x 100 box by *_AT. The S passes under the V's left arm and over its right; the gaps
 * of that weave are cut in the ground color, so the mark sits on white. Brand.tsx draws it in React;
 * markSvg() gives the same mark as a string for favicon.svg, the rendered PNGs and 404.html.
 */
export const V_PATH = "M196 0 18 700H154L302 85H316L464 700H600L422 0Z";
export const S_PATH =
  "M309 -14Q228 -14 166.0 15.0Q104 44 69.0 98.0Q34 152 34 228V256H164V228Q164 165 203.0 133.5Q242 102 309 102Q377 102 410.5 129.0Q444 156 444 198Q444 227 427.5 245.0Q411 263 379.5 274.5Q348 286 303 296L280 301Q208 317 156.5 341.5Q105 366 77.5 406.0Q50 446 50 510Q50 574 80.5 619.5Q111 665 166.5 689.5Q222 714 297 714Q372 714 430.5 688.5Q489 663 522.5 612.5Q556 562 556 486V456H426V486Q426 526 410.5 550.5Q395 575 366.0 586.5Q337 598 297 598Q237 598 208.5 575.5Q180 553 180 514Q180 488 193.5 470.0Q207 452 234.0 440.0Q261 428 303 419L326 414Q401 398 456.5 373.0Q512 348 543.0 307.0Q574 266 574 202Q574 138 541.5 89.5Q509 41 449.5 13.5Q390 -14 309 -14Z";
export const V_AT = "translate(15.569 89.000) scale(0.11143 -0.11143)";
export const S_AT = "translate(24.945 72.846) scale(0.08242 -0.08242)";
/** Gap of the weave in each glyph's font units: 2.6 units of the 100 box on each side. */
export const V_GAP = 46.7;
export const S_GAP = 63.1;

export const BRAND = { ink: "#140f2b", violet: "#6a4cff", white: "#ffffff", line: "#e8e6f0" } as const;

/** The mark alone: 100 x 100 user units, with an id for its clip path that is unique in the document. */
export function markSvg(id = "sv", colors: { ink: string; violet: string; ground: string } = { ...BRAND, ground: BRAND.white }): string {
  const s = (extra: string) => `<path d="${S_PATH}" transform="${S_AT}" fill="${colors.violet}"${extra}/>`;
  const gap = (w: number) => ` stroke="${colors.ground}" stroke-width="${w}" stroke-linejoin="round" paint-order="stroke"`;
  return (
    `<defs><clipPath id="${id}"><rect x="50" y="0" width="50" height="100"/></clipPath></defs>` +
    s("") +
    `<path d="${V_PATH}" transform="${V_AT}" fill="${colors.ink}"${gap(V_GAP)}/>` +
    `<g clip-path="url(#${id})">${s(gap(S_GAP))}</g>`
  );
}

/** The mark on its white tile, as a complete SVG: the favicon and app icon. `square` drops the corners. */
export function tileSvg(size?: number, square = false): string {
  const dims = size ? ` width="${size}" height="${size}"` : "";
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"${dims}>` +
    (square
      ? `<rect width="100" height="100" fill="${BRAND.white}"/>`
      : `<rect x="1.5" y="1.5" width="97" height="97" rx="22" fill="${BRAND.white}" stroke="${BRAND.line}" stroke-width="3"/>`) +
    `<g transform="translate(13 13) scale(0.74)">${markSvg()}</g></svg>`
  );
}
