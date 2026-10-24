import { useMemo } from "react";

import { ApprovalPage } from "./components/ApprovalPage.js";
import { Dashboard } from "./components/Dashboard.js";
import { SecurityLab } from "./components/SecurityLab.js";
import { Badge, Button, Mono, Notice } from "./components/ui.js";
import type { NetworkId, SiteConfig } from "./config.js";
import { createSigner } from "./signers/index.js";
import { useSigner } from "./useSigner.js";

const NETWORK_BADGE: Record<NetworkId, { tone: "neutral" | "warn" | "bad"; label: string }> = {
  sandbox: { tone: "neutral", label: "Local sandbox" },
  testnet: { tone: "warn", label: "Testnet" },
  mainnet: { tone: "bad", label: "Mainnet: real funds" },
};

function NoVault() {
  return (
    <Notice tone="info" title="No vault is connected to this site yet">
      <p>
        The overview and the approval page read one vault contract on chain, and this site was built without one. The Security Lab works: it shows the
        test results for the commit this site was built from.
      </p>
      <p className="mt-2">
        <a href="?page=security" className="font-medium underline">
          Open the Security Lab
        </a>
      </p>
    </Notice>
  );
}

export function App({ config }: { config: SiteConfig }) {
  const signer = useMemo(() => (config.vaultId === null ? null : createSigner(config)), [config]);
  const wallet = useSigner(signer);
  const params = new URLSearchParams(window.location.search);
  const requestId = params.get("request");
  const linkVault = params.get("vault");
  const badge = NETWORK_BADGE[config.network];
  const page = params.get("page");
  const onSecurityLab = page === "security" && !requestId;
  const onDashboard = !requestId && !onSecurityLab && (linkVault === null || linkVault === config.vaultId);
  const wide = onDashboard || onSecurityLab;

  return (
    <div className={`mx-auto flex min-h-screen flex-col px-4 py-6 ${wide ? "max-w-5xl" : "max-w-2xl"}`}>
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <a href="./" className="text-lg font-bold tracking-tight">
            Spact
          </a>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
            {config.vaultId === null ? (
              <Badge tone="neutral">No vault connected</Badge>
            ) : (
              <>
                <Badge tone={badge.tone}>{badge.label}</Badge>
                <span>
                  vault <Mono>{config.vaultId}</Mono>
                </span>
              </>
            )}
          </div>
          <nav className="mt-2 flex gap-4 text-sm" aria-label="Pages">
            <a href="./" className={onDashboard ? "font-semibold text-slate-900" : "text-slate-600 hover:text-slate-900"} aria-current={onDashboard ? "page" : undefined}>
              Overview
            </a>
            <a
              href="?page=security"
              className={onSecurityLab ? "font-semibold text-slate-900" : "text-slate-600 hover:text-slate-900"}
              aria-current={onSecurityLab ? "page" : undefined}
            >
              Security Lab
            </a>
          </nav>
        </div>
        <div className="flex items-center gap-2" data-testid="wallet">
          {config.vaultId === null ? null : signer === null ? (
            <span className="text-xs text-slate-500">No signer configured</span>
          ) : wallet.accountId ? (
            <>
              <Mono className="text-sm" >{wallet.accountId}</Mono>
              <Button onClick={() => void wallet.disconnect()} variant="secondary" disabled={wallet.busy}>
                Disconnect
              </Button>
            </>
          ) : (
            <Button onClick={() => void wallet.connect()} variant="secondary" disabled={wallet.busy} testId="connect">
              {wallet.busy ? "Connecting…" : `Connect ${signer.label}`}
            </Button>
          )}
        </div>
      </header>

      <main className="flex-1">
        {wallet.error ? (
          <div className="mb-4">
            <Notice tone="bad" title="Wallet error">
              {wallet.error}
            </Notice>
          </div>
        ) : null}
        {config.vaultId === null ? (
          onSecurityLab ? (
            <SecurityLab reportUrl={config.securityReportUrl} />
          ) : (
            <NoVault />
          )
        ) : linkVault !== null && linkVault !== config.vaultId ? (
          <Notice tone="bad" title="This link is for a different vault">
            <p>
              The link names <Mono>{linkVault}</Mono>, but this page only approves payments for <Mono>{config.vaultId}</Mono>. Nothing was loaded.
            </p>
          </Notice>
        ) : onSecurityLab ? (
          <SecurityLab reportUrl={config.securityReportUrl} />
        ) : requestId ? (
          <ApprovalPage config={config} requestId={requestId} signer={signer} wallet={wallet} />
        ) : (
          <Dashboard config={config} />
        )}
      </main>

      <footer className="mt-10 border-t border-slate-200 pt-4 text-xs leading-relaxed text-slate-500">
        Unaudited hackathon prototype. This page never holds keys: your wallet signs, and the vault contract enforces the rules.
      </footer>
    </div>
  );
}
