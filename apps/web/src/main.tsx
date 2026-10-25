import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { App } from "./App.js";
import { ConfigError, parseSiteConfig } from "./config.js";
import "@fontsource-variable/space-grotesk";
import "./index.css";

const root = createRoot(document.getElementById("root") as HTMLElement);

if (window.top !== window.self) {
  // Clickjacking guard. Static hosts like GitHub Pages cannot send a frame-ancestors header, so
  // inside a frame the page draws nothing to click except a link that opens it on its own.
  root.render(
    <main className="mx-auto max-w-2xl p-6" data-testid="framed">
      <h1 className="text-lg font-semibold">Spact does not run inside a frame</h1>
      <p className="mt-2 text-sm text-slate-600">
        Another site has embedded this page. Approvals only happen on Spact&apos;s own page, where you can see its address.
      </p>
      <a href={window.location.href} target="_blank" rel="noreferrer noopener" className="mt-2 inline-block text-sm underline">
        Open Spact in a new tab
      </a>
    </main>,
  );
} else {
  try {
    const config = parseSiteConfig(import.meta.env as Record<string, string | undefined>);
    root.render(
      <StrictMode>
        <App config={config} />
      </StrictMode>,
    );
  } catch (e) {
    const message = e instanceof ConfigError ? e.message : String(e);
    root.render(
      <main className="mx-auto max-w-2xl p-6">
        <h1 className="text-lg font-semibold">Spact is not configured</h1>
        <p className="mt-2 text-sm text-rose-700">{message}</p>
        <p className="mt-2 text-sm text-slate-600">See apps/web/.env.example.</p>
      </main>,
    );
  }
}
