import { useMemo } from "react";

import { ApprovalPage } from "./components/ApprovalPage.js";
import { Logo } from "./components/Brand.js";
import { Dashboard } from "./components/Dashboard.js";
import { Landing } from "./components/Landing.js";
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
        The dashboard and the approval page read one vault contract on chain, and this site was built without one. The Security Lab works: it shows the
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
  const onDashboard = page === "overview" && !requestId;
  const onHome = !requestId && !onSecurityLab && !onDashboard;
  const navClass = (active: boolean) => (active ? "font-semibold text-ink" : "text-slate-600 hover:text-ink");

  return (
    <div className={`mx-auto flex min-h-screen flex-col px-4 py-6 ${requestId ? "max-w-2xl" : "max-w-5xl"}`}>
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 flex-wrap items-center gap-x-7 gap-y-2">
          <a href="./" aria-label="Spact home" aria-current={onHome ? "page" : undefined}>
            <Logo />
          </a>
          <nav className="flex gap-5 text-sm" aria-label="Pages">
            <a href="?page=overview" className={navClass(onDashboard)} aria-current={onDashboard ? "page" : undefined}>
              Dashboard
            </a>
            <a href="?page=security" className={navClass(onSecurityLab)} aria-current={onSecurityLab ? "page" : undefined}>
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

      <div className="mb-6 flex flex-wrap items-center gap-2 text-xs text-slate-500" data-testid="environment">
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
          ) : onHome ? (
            <Landing config={config} />
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
        ) : onDashboard ? (
          <Dashboard config={config} />
        ) : (
          <Landing config={config} />
        )}
      </main>

      <footer className="mt-10 border-t border-slate-200 pt-4 text-xs leading-relaxed text-slate-500">
        Spact is an unaudited hackathon prototype. Use test tokens only. This page never holds keys: your wallet signs, and the vault contract enforces the rules.
      </footer>
    </div>
  );
}
