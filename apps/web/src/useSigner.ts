import { useCallback, useEffect, useState } from "react";

import { errorMessage } from "./format.js";
import type { OwnerSigner } from "./signers/index.js";

export interface SignerState {
  accountId: string | null;
  busy: boolean;
  error: string | null;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
}

export function useSigner(signer: OwnerSigner | null): SignerState {
  const [accountId, setAccountId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!signer) return;
    let alive = true;
    signer
      .restore()
      .then((id) => alive && setAccountId(id))
      .catch(() => alive && setAccountId(null));
    return () => {
      alive = false;
    };
  }, [signer]);

  const connect = useCallback(async () => {
    if (!signer) return;
    setBusy(true);
    setError(null);
    try {
      setAccountId(await signer.connect());
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }, [signer]);

  const disconnect = useCallback(async () => {
    if (!signer) return;
    setBusy(true);
    try {
      await signer.disconnect();
    } finally {
      setAccountId(null);
      setBusy(false);
    }
  }, [signer]);

  return { accountId, busy, error, connect, disconnect };
}
