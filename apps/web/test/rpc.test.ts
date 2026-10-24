import { afterEach, describe, expect, it, vi } from "vitest";

import { finalBlockTimestampNs, RpcError, viewFunction } from "../src/near/rpc.js";

function mockFetch(body: unknown, status = 200) {
  const text = typeof body === "string" ? body : JSON.stringify(body);
  const fn = vi.fn(async () => new Response(text, { status }));
  vi.stubGlobal("fetch", fn);
  return fn;
}

afterEach(() => vi.unstubAllGlobals());

const bytes = (value: unknown) => Array.from(new TextEncoder().encode(JSON.stringify(value)));

describe("viewFunction", () => {
  it("sends a call_function query and decodes the JSON result", async () => {
    const fetchMock = mockFetch({ jsonrpc: "2.0", id: "spendpact", result: { result: bytes({ ok: 1 }), logs: [], block_height: 1 } });
    await expect(viewFunction("http://rpc", "vault.test.near", "get_request", { request_id: "r1" })).resolves.toEqual({ ok: 1 });
    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    const sent = JSON.parse(init.body as string);
    expect(sent.params).toMatchObject({ request_type: "call_function", finality: "final", account_id: "vault.test.near", method_name: "get_request" });
    expect(JSON.parse(atob(sent.params.args_base64))).toEqual({ request_id: "r1" });
  });

  it("surfaces contract errors and malformed responses as RpcError", async () => {
    mockFetch({ jsonrpc: "2.0", id: "x", result: { error: "wasm execution failed: MethodNotFound" } });
    await expect(viewFunction("http://rpc", "v", "nope")).rejects.toBeInstanceOf(RpcError);
    mockFetch({ jsonrpc: "2.0", id: "x", error: { name: "HANDLER_ERROR", data: "account does not exist" } });
    await expect(viewFunction("http://rpc", "v", "get_config")).rejects.toThrow(/account does not exist/);
    mockFetch({ jsonrpc: "2.0", id: "x", result: { result: [300] } });
    await expect(viewFunction("http://rpc", "v", "get_config")).rejects.toThrow(/byte array/);
    mockFetch({}, 502);
    await expect(viewFunction("http://rpc", "v", "get_config")).rejects.toThrow(/HTTP 502/);
  });
});

describe("finalBlockTimestampNs", () => {
  it("reads the nanosecond string, not the lossy number", async () => {
    // raw JSON: the numeric timestamp cannot survive JSON.parse exactly, the string can
    mockFetch('{"jsonrpc":"2.0","id":"x","result":{"header":{"timestamp":1761996400123456789,"timestamp_nanosec":"1761996400123456789"}}}');
    await expect(finalBlockTimestampNs("http://rpc")).resolves.toBe(1_761_996_400_123_456_789n);
  });
});
