import type { ReactNode } from "react";

import type { SiteConfig } from "../config.js";

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="border-t border-line pt-8">
      <h2 className="text-xl font-semibold">{title}</h2>
      <ul className="mt-4 space-y-3 text-base leading-relaxed text-zinc-700">{children}</ul>
    </section>
  );
}

/** Plain statements of what this site does with data, and what it promises. Not a legal opinion. */
export function Legal({ config }: { config: SiteConfig }) {
  const rpcHost = new URL(config.rpcUrl).host;
  return (
    <article className="max-w-2xl space-y-8 pb-12" data-testid="legal">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Privacy and terms</h1>
        <p className="mt-3 text-base text-zinc-600">What this site does with your data, and what it does not promise.</p>
      </div>
      <Section title="Privacy">
        <li>This site sets no cookies and runs no analytics or tracking scripts.</li>
        <li>
          Your browser reads the vault straight from a NEAR RPC endpoint ({rpcHost}) and loads the Security Lab report. Those services see your IP
          address, as any website would. The host serving this page keeps ordinary request logs.
        </li>
        <li>
          When you connect a wallet, the wallet selector loads wallet code from third parties, such as raw.githubusercontent.com and the
          wallet&apos;s own servers, and may remember the connection in your browser&apos;s storage.
        </li>
        <li>SpactVault never sees your keys. Your wallet signs; this page only hands it a transaction to show you.</li>
      </Section>
      <Section title="Terms">
        <li>SpactVault is an unaudited hackathon prototype, provided as is, without warranty of any kind.</li>
        <li>
          {config.network === "mainnet"
            ? "This deployment is on NEAR mainnet, where tokens have real value. Use only small amounts you can afford to lose."
            : `This deployment runs on ${config.network === "testnet" ? "NEAR testnet" : "a local NEAR sandbox"} with test tokens that have no value. Do not use it with real funds.`}
        </li>
        <li>Approvals you sign are transactions on a public blockchain. They are final, and anyone can read them.</li>
        {config.repoUrl ? (
          <li>
            The source code is public at{" "}
            <a href={config.repoUrl} className="underline underline-offset-2 hover:text-ink" target="_blank" rel="noreferrer noopener">
              {config.repoUrl.replace(/^https:\/\//, "")}
            </a>
            .
          </li>
        ) : null}
      </Section>
    </article>
  );
}
