# SpactVault brand

The mark is an S woven through a V, both drawn from Space Grotesk Bold: the S passes under the V's left arm and over its right. DECISIONS ADR-027 records the choices. Every file here and in `apps/web/public/` is generated from `apps/web/src/brandMark.ts`:

```sh
node --experimental-strip-types apps/web/dev/render-brand.ts
```

## Files

| File | Use it for |
|---|---|
| `spactvault-avatar-1024.png` | Profile pictures: X, the Telegram bot (BotFather, `/setuserpic`), GitHub. Square, so circle crops keep the whole mark. |
| `github-social-preview.png` | GitHub repository, Settings, Social preview (1280 x 640). |
| `spactvault-logo.png` | The logo with the wordmark, for slides, documents and the demo video. |
| `spactvault-icon.svg` | The mark on its white tile, as a vector. |

The site's own icons and share card are in `apps/web/public/`: `favicon.svg`, `favicon-32.png`, `apple-touch-icon.png` and `og-image.png`.

## Colors

| Role | Color |
|---|---|
| Ink: text, the V | `#140f2b` |
| Violet: the S, links, primary buttons, focus rings | `#6a4cff` |
| Page | `#f7f7fb` |
| Cards, the logo tile | `#ffffff` |
| Hairlines | `#e8e6f0` |
| Paid / waits / blocked | `#10b981` / `#f59e0b` / `#f43f5e` |

The last three only ever mean an outcome. They are never used for decoration.

## Rules

- The mark sits on white. The gaps of the weave are cut in white, so on another color it needs its white tile.
- The name is one word, **SpactVault**, with "Vault" in violet in the logo. "Spact" is fine as a short form in prose.
- Type: Space Grotesk for everything, and Geist Mono for code, account names and hashes.
