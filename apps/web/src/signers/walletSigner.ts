import { NearConnector, type SignAndSendTransactionParams } from "@hot-labs/near-connect";

import { failureOf, SignError, txHashOf, type OwnerSigner } from "./types.js";

/**
 * Owner signer backed by NEAR Connect. Each wallet's code runs in a sandboxed iframe; this page
 * only hands it a transaction to sign. Approvals attach 1 yoctoNEAR, so the wallet must sign with
 * a full-access key and will ask the owner to confirm.
 */
export function createWalletSigner(network: "testnet" | "mainnet"): OwnerSigner {
  const connector = new NearConnector({
    network,
    features: network === "testnet" ? { signAndSendTransaction: true, testnet: true } : { signAndSendTransaction: true, mainnet: true },
    footerBranding: null,
  });
  let accountId: string | null = null;

  return {
    label: "NEAR wallet",

    async restore() {
      try {
        const { accounts } = await connector.getConnectedWallet();
        accountId = accounts[0]?.accountId ?? null;
      } catch {
        accountId = null;
      }
      return accountId;
    },

    async connect() {
      const wallet = await connector.connect();
      const accounts = await wallet.getAccounts({ network });
      const id = accounts[0]?.accountId;
      if (!id) throw new SignError("The wallet did not return an account");
      accountId = id;
      return id;
    },

    async disconnect() {
      await connector.disconnect();
      accountId = null;
    },

    async signAndSend(receiverId, actions) {
      const { wallet } = await connector.getConnectedWallet();
      const params: SignAndSendTransactionParams = { network, receiverId, actions };
      if (accountId) params.signerId = accountId;
      const outcome: unknown = await wallet.signAndSendTransaction(params);
      const txHash = txHashOf(outcome);
      const failure = failureOf(outcome);
      if (failure) throw new SignError(failure, txHash);
      return { txHash };
    },
  };
}
