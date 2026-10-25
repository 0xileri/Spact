import { useMemo, type ReactNode } from "react";

import { ApprovalPage } from "./components/ApprovalPage.js";
import { Logo } from "./components/Brand.js";
import { Dashboard } from "./components/Dashboard.js";
import { Landing } from "./components/Landing.js";
import { SecurityLab } from "./components/SecurityLab.js";
import { Badge, Button, Mono, Notice } from "./components/ui.js";
import { explorerAccountLink, type NetworkId, type SiteConfig } from "./config.js";
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

function FooterLink({ href, children, external = false }: { href: string; children: ReactNode; external?: boolean }) {
  return (
    <li>
      <a href={href} className="text-stone-600 hover:text-ink" {...(external ? { target: "_blank", rel: "noreferrer noopener" } : {})}>
        {children}
      </a>
    </li>
  );
}

function SiteFooter({ config }: { config: SiteConfig }) {
  const vaultLink = config.vaultId === null ? null : explorerAccountLink(config, config.vaultId);
  return (
    <footer className="mt-24 border-t border-line">
      <div className="mx-auto grid max-w-6xl gap-10 px-5 py-12 text-sm sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_1fr]">
        <div>
          <Logo />
          <p className="mt-3 max-w-xs text-stone-600">Autonomous spending. Human rules. A spending firewall for AI agents on NEAR.</p>
        </div>
        <div>
          <p className="font-medium text-ink">Product</p>
          <ul className="mt-3 space-y-2">
            <FooterLink href="?page=overview">Dashboard</FooterLink>
            <FooterLink href="?page=security">Security Lab</FooterLink>
          </ul>
        </div>
        <div>
          <p className="font-medium text-ink">Developers</p>
          <ul className="mt-3 space-y-2">
            {config.repoUrl ? (
              <>
                <FooterLink href={config.repoUrl} external>
                  Source code
                </FooterLink>
                <FooterLink href={`${config.repoUrl}/tree/main/apps/mcp`} external>
                  MCP server
                </FooterLink>
              </>
            ) : (
              <li className="text-stone-500">Source link not configured</li>
            )}
          </ul>
        </div>
        <div>
          <p className="font-medium text-ink">Network</p>
          <ul className="mt-3 space-y-2">
            <li className="text-stone-600">{NETWORK_BADGE[config.network].label}</li>
            {vaultLink ? (
              <FooterLink href={vaultLink} external>
                Vault on the explorer
              </FooterLink>
            ) : null}
          </ul>
        </div>
      </div>
      <div className="border-t border-line">
        <p className="mx-auto max-w-6xl px-5 py-5 text-xs leading-relaxed text-stone-500">
          Spact is an unaudited hackathon prototype. Use test tokens only. This page never holds keys: your wallet signs, and the vault contract enforces
          the rules.
        </p>
      </div>
    </footer>
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
  const foreignVault = config.vaultId !== null && linkVault !== null && linkVault !== config.vaultId;
  const landing = onHome && !foreignVault;
  const navClass = (active: boolean) => (active ? "font-medium text-ink" : "text-stone-600 hover:text-ink");

  const walletControls =
    config.vaultId === null ? null : signer === null ? (
      <span className="text-xs text-stone-500">No signer configured</span>
    ) : wallet.accountId ? (
      <>
        <Mono className="text-sm">{wallet.accountId}</Mono>
        <Button onClick={() => void wallet.disconnect()} variant="secondary" disabled={wallet.busy}>
          Disconnect
        </Button>
      </>
    ) : (
      <Button onClick={() => void wallet.connect()} variant="secondary" disabled={wallet.busy} testId="connect">
        {wallet.busy ? "Connecting…" : `Connect ${signer.label}`}
      </Button>
    );

  let content: ReactNode;
  if (config.vaultId === null) {
    content = onSecurityLab ? <SecurityLab reportUrl={config.securityReportUrl} /> : onHome ? <Landing config={config} /> : <NoVault />;
  } else if (foreignVault) {
    content = (
      <Notice tone="bad" title="This link is for a different vault">
        <p>
          The link names <Mono>{linkVault}</Mono>, but this page only approves payments for <Mono>{config.vaultId}</Mono>. Nothing was loaded.
        </p>
      </Notice>
    );
  } else if (onSecurityLab) {
    content = <SecurityLab reportUrl={config.securityReportUrl} />;
  } else if (requestId) {
    content = <ApprovalPage config={config} requestId={requestId} signer={signer} wallet={wallet} />;
  } else if (onDashboard) {
    content = <Dashboard config={config} />;
  } else {
    content = <Landing config={config} />;
  }

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-30 border-b border-line bg-paper/85 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-6 gap-y-3 px-5 py-3.5">
          <div className="flex min-w-0 items-center gap-8">
            <a href="./" aria-label="Spact home" aria-current={onHome ? "page" : undefined}>
              <Logo />
            </a>
            <nav className="flex items-center gap-6 text-sm" aria-label="Pages">
              <a href="?page=overview" className={navClass(onDashboard)} aria-current={onDashboard ? "page" : undefined}>
                Dashboard
              </a>
              <a href="?page=security" className={navClass(onSecurityLab)} aria-current={onSecurityLab ? "page" : undefined}>
                Security Lab
              </a>
            </nav>
          </div>
          <div className="flex items-center gap-2" data-testid="wallet">
            {landing ? (
              config.repoUrl ? (
                <a
                  href={config.repoUrl}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="hidden rounded-lg px-3 py-2 text-sm font-medium text-stone-700 ring-1 ring-line hover:bg-surface hover:text-ink sm:inline-flex"
                >
                  GitHub
                </a>
              ) : null
            ) : (
              walletControls
            )}
          </div>
        </div>
      </header>

      <main className="flex-1">
        {wallet.error ? (
          <div className="mx-auto mt-6 max-w-5xl px-5">
            <Notice tone="bad" title="Wallet error">
              {wallet.error}
            </Notice>
          </div>
        ) : null}
        {landing ? (
          content
        ) : (
          <div className={`mx-auto px-5 pt-6 ${requestId ? "max-w-2xl" : "max-w-5xl"}`}>
            <div className="mb-6 flex flex-wrap items-center gap-2 text-xs text-stone-500" data-testid="environment">
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
            {content}
          </div>
        )}
      </main>

      <SiteFooter config={config} />
    </div>
  );
}
