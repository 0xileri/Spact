/// <reference types="vitest/config" />
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defaultClientConditions, defaultServerConditions, defineConfig, type Plugin } from "vite";

import { shareImageTags } from "./src/shareTags.ts";

/** Adds the share-card image tags when the build knows the site's public URL (CI sets VITE_SITE_URL). */
function shareTags(siteUrl: string | undefined): Plugin {
  const tags = shareImageTags(siteUrl);
  return {
    name: "spact-share-tags",
    transformIndexHtml: () => tags.map((t) => ({ tag: "meta", attrs: { [t.attr]: t.key, content: t.content }, injectTo: "head" as const })),
  };
}

export default defineConfig({
  // relative asset paths, so one build works at / and under a subpath such as GitHub Pages /Spact/
  base: "./",
  plugins: [react(), tailwindcss(), shareTags(process.env.VITE_SITE_URL)],
  // Resolve workspace packages to their TypeScript sources, so no prebuild step is needed.
  resolve: { conditions: ["spact-source", ...defaultClientConditions] },
  // Vitest runs in the server environment, which has its own resolve conditions.
  ssr: { resolve: { conditions: ["spact-source", ...defaultServerConditions] } },
  test: {
    include: ["test/**/*.test.ts"],
  },
});
