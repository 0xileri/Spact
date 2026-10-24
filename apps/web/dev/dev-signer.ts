/**
 * Local "wallet" for the sandbox demo and browser tests.
 *
 * Holds the sandbox owner key from the demo-sandbox fixture and signs only owner decisions
 * (approve, reject, execute) on the demo vault. Listens on 127.0.0.1 only and refuses to start
 * unless the fixture points at a local sandbox. Real networks use a real wallet instead.
 *
 * Usage: node --experimental-strip-types dev/dev-signer.ts <fixture.json>
 */
import { readFileSync } from "node:fs";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";

import { Account, actions, JsonRpcProvider, type KeyPairString } from "near-api-js";

interface Fixture {
  network: string;
  rpc_url: string;
  vault_id: string;
  owner_id: string;
  owner_secret_key: string;
}

const ALLOWED_METHODS = new Set(["approve_request", "reject_request", "execute_request"]);
const MAX_GAS = 300_000_000_000_000n;
const MAX_BODY = 16 * 1024;

const fixturePath = process.argv[2];
if (!fixturePath) throw new Error("usage: dev-signer.ts <fixture.json>");
const fixture = JSON.parse(readFileSync(fixturePath, "utf8")) as Fixture;
const rpcHost = new URL(fixture.rpc_url).hostname;
if (fixture.network !== "sandbox" || (rpcHost !== "127.0.0.1" && rpcHost !== "localhost")) {
  throw new Error("dev signer only runs against a local sandbox");
}

const owner = new Account(fixture.owner_id, new JsonRpcProvider({ url: fixture.rpc_url }), fixture.owner_secret_key as KeyPairString);
const port = Number(process.env.DEV_SIGNER_PORT ?? 8788);

interface RequestedCall {
  methodName: string;
  args: Record<string, unknown>;
  gas: bigint;
  deposit: bigint;
}

/** Accepts only owner decisions on the demo vault, in the shape the web app sends. */
function parseSignRequest(body: unknown): RequestedCall[] {
  if (typeof body !== "object" || body === null) throw new Error("body must be an object");
  const { receiverId, actions: list } = body as { receiverId?: unknown; actions?: unknown };
  if (receiverId !== fixture.vault_id) throw new Error(`receiverId must be ${fixture.vault_id}`);
  if (!Array.isArray(list) || list.length < 1 || list.length > 2) throw new Error("expected 1 or 2 actions");
  return list.map((a: unknown) => {
    const { type, params } = (a ?? {}) as { type?: unknown; params?: Record<string, unknown> };
    if (type !== "FunctionCall" || !params) throw new Error("only FunctionCall actions are signed");
    const { methodName, args, gas, deposit } = params;
    if (typeof methodName !== "string" || !ALLOWED_METHODS.has(methodName)) throw new Error(`method ${String(methodName)} is not allowed`);
    if (typeof args !== "object" || args === null || Array.isArray(args)) throw new Error("args must be an object");
    if (typeof gas !== "string" || !/^\d+$/.test(gas) || BigInt(gas) > MAX_GAS) throw new Error("bad gas");
    if (deposit !== "0" && deposit !== "1") throw new Error("deposit must be 0 or 1 yoctoNEAR");
    return { methodName, args: args as Record<string, unknown>, gas: BigInt(gas), deposit: BigInt(deposit) };
  });
}

function send(req: IncomingMessage, res: ServerResponse, status: number, body: unknown) {
  const origin = req.headers.origin;
  if (origin && /^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin)) {
    res.setHeader("access-control-allow-origin", origin);
    res.setHeader("access-control-allow-headers", "content-type");
    res.setHeader("access-control-allow-methods", "GET, POST, OPTIONS");
  }
  res.writeHead(status, { "content-type": "application/json" });
  res.end(JSON.stringify(body));
}

async function readJson(req: IncomingMessage): Promise<unknown> {
  let size = 0;
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    size += (chunk as Buffer).length;
    if (size > MAX_BODY) throw new Error("body too large");
    chunks.push(chunk as Buffer);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function txHashOf(result: unknown): string | null {
  const tx = (result as { transaction?: { hash?: unknown } } | null)?.transaction;
  return typeof tx?.hash === "string" ? tx.hash : null;
}

const server = createServer((req, res) => {
  void (async () => {
    if (req.method === "OPTIONS") return send(req, res, 204, {});
    if (req.method === "GET" && req.url === "/account") return send(req, res, 200, { accountId: fixture.owner_id });
    if (req.method !== "POST" || req.url !== "/sign") return send(req, res, 404, { ok: false, error: "not found" });

    let calls: RequestedCall[];
    try {
      calls = parseSignRequest(await readJson(req));
    } catch (e) {
      return send(req, res, 400, { ok: false, error: (e as Error).message });
    }
    try {
      const result: unknown = await owner.signAndSendTransaction({
        receiverId: fixture.vault_id,
        actions: calls.map((c) => actions.functionCall(c.methodName, c.args, c.gas, c.deposit)),
        throwOnFailure: false,
      });
      const status = (result as { status?: unknown } | null)?.status;
      const failure = typeof status === "object" && status !== null && "Failure" in status ? (status as { Failure: unknown }).Failure : null;
      if (failure) return send(req, res, 200, { ok: false, error: JSON.stringify(failure), txHash: txHashOf(result) });
      return send(req, res, 200, { ok: true, txHash: txHashOf(result) });
    } catch (e) {
      return send(req, res, 200, { ok: false, error: (e as Error).message });
    }
  })();
});

server.listen(port, "127.0.0.1", () => {
  console.log(`dev signer for ${fixture.owner_id} on http://127.0.0.1:${port} (sandbox only)`);
});
