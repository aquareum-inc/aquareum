import { mkdtempSync, readFileSync, readdirSync, rmSync, statSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { NextRequest } from "next/server";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { POST as mcp } from "../../app/api/mcp/route";
import { GET as route } from "../../app/api/v1/[...path]/route";
import { devices } from "../devices";
import { operatorAudit, operatorDevices } from "../operator-devices";
import { confirmMessage, inputHash, unlockMessage } from "../operator-devices/proof";
import { MAX_FAILED_PROOFS } from "../operator-devices/sessions";
import { TEST_CHALLENGE, TEST_VERIFIER, testPhone, type TestPhone } from "../operator-devices/testing";
import { OPEN_TO_OPERATOR_DEVICES } from "./dispatch";
import { OPERATIONS, type Operation } from "./operations";

/**
 * The rules for an operator's phone, tested through the API route itself: the real `authenticate()`, the
 * real dispatcher and file stores, against a mock-only instance. These are the tests section 18.6 of
 * docs/mobile/plan.md asks of the server.
 */
const dir = mkdtempSync(path.join(tmpdir(), "livepeer-operator-phones-"));
const configFile = path.join(dir, "instance.config.json");
const sam = { userId: "usr_demo_sam", name: "Sam Whitfield", email: "sam@example.test", role: "operator" as const };

function configure(surfaces: { mobile: boolean; mobileConsole: boolean; api?: boolean }) {
  writeFileSync(configFile, JSON.stringify({ name: "Test", surfaces: { app: true, console: true, api: surfaces.api ?? true, mcp: true, mobile: surfaces.mobile, mobileConsole: surfaces.mobileConsole }, mobile: { ios: { bundleId: "org.livepeer.app.dev" } } }));
  // The config is re-read when the file's time changes; make sure it does within one test.
  const next = new Date(statSync(configFile).mtimeMs + 2000 * (configure.count += 1));
  utimesSync(configFile, next, next);
}
configure.count = 0;

beforeAll(() => {
  vi.stubEnv("INSTANCE_CONFIG", configFile);
  vi.stubEnv("DATA_DIR", path.join(dir, "data"));
  vi.stubEnv("MOCK_ONLY", "1");
  vi.stubEnv("SESSION_SECRET", "a-session-secret-for-the-operator-phone-tests");
  vi.stubEnv("OPERATOR_API_TOKEN", "");
  configure({ mobile: true, mobileConsole: true });
});
afterAll(() => {
  vi.unstubAllEnvs();
  rmSync(dir, { recursive: true, force: true });
});

interface Answer {
  status: number;
  code: string | undefined;
  body: unknown;
  text: string;
}

async function call(operation: Operation | string, options: { token?: string; input?: Record<string, unknown>; proof?: string; query?: string } = {}): Promise<Answer> {
  const found = typeof operation === "string" ? OPERATIONS.find((entry) => entry.name === operation)! : operation;
  const input = { ...options.input };
  const segments = found.path.split("/").filter(Boolean).map((part) => {
    if (!part.startsWith("{")) return part;
    const name = part.slice(1, -1);
    const value = String(input[name] ?? "x");
    delete input[name];
    return value;
  });
  const takesBody = found.method === "POST" || found.method === "PATCH";
  const search = takesBody ? (options.query ?? "") : new URLSearchParams(Object.entries(input).map(([key, value]) => [key, String(value)])).toString();
  const request = new NextRequest(`http://localhost/api/v1/${segments.join("/")}${search ? `?${search}` : ""}`, {
    method: found.method,
    headers: { ...(options.token ? { authorization: `Bearer ${options.token}` } : {}), ...(options.proof ? { "x-operator-proof": options.proof } : {}), ...(takesBody ? { "content-type": "application/json" } : {}) },
    ...(takesBody ? { body: JSON.stringify(input) } : {}),
  });
  const response = await route(request, { params: Promise.resolve({ path: segments }) });
  const text = await response.text();
  const body: unknown = text ? JSON.parse(text) : null;
  return { status: response.status, code: (body as { error?: { code?: string } } | null)?.error?.code, body, text };
}

/** Something for every required input, so a refusal is about who is asking and not about what was left out. */
function filled(operation: Operation): Record<string, unknown> {
  const schema = operation.input as { required?: string[]; properties?: Record<string, { enum?: unknown[]; type?: unknown }> };
  return Object.fromEntries((schema.required ?? []).map((key) => [key, schema.properties?.[key]?.enum?.[0] ?? (schema.properties?.[key]?.type === "number" ? 1 : "x")]));
}

/** A phone enrolled for the console, as the app would hold it. */
function enrol(identity: typeof sam = sam): { token: string; id: string; phone: TestPhone } {
  const phone = testPhone();
  const code = operatorDevices().issueCode({ identity, challenge: TEST_CHALLENGE, platform: "ios" })!;
  const issued = operatorDevices().redeemCode({ code, verifier: TEST_VERIFIER, deviceName: "Sam's iPhone", platform: "ios", publicKey: phone.rawPublicKey })!;
  return { token: issued.token, id: issued.device.id, phone };
}

async function unlock(device: { token: string; phone: TestPhone }): Promise<Answer> {
  const { nonce } = (await call("create_operator_challenge", { token: device.token, input: { purpose: "unlock" } })).body as { nonce: string };
  return call("unlock_operator_device_session", { token: device.token, input: { nonce, signature: device.phone.sign(unlockMessage(nonce)) } });
}

/** Asks for a nonce for one change and signs it, as the app does after a face or fingerprint. */
async function proofFor(device: { token: string; phone: TestPhone }, operation: string, input: Record<string, unknown>, signer: TestPhone = device.phone): Promise<string> {
  const hash = inputHash(input);
  const { nonce } = (await call("create_operator_challenge", { token: device.token, input: { purpose: operation, input_hash: hash } })).body as { nonce: string };
  return `${nonce}.${signer.sign(confirmMessage(nonce, operation, hash))}`;
}

const lastAudit = () => operatorAudit().list(1)[0];
const operatorOperations = OPERATIONS.filter((operation) => operation.operator);

describe("a user's device session", () => {
  it("is refused every operator operation with 403, even when the provider marks the person an operator", async () => {
    const code = devices().issueCode({ identity: sam, builderKey: null, challenge: TEST_CHALLENGE, platform: "ios" });
    const { token } = devices().redeemCode({ code, verifier: TEST_VERIFIER, deviceName: "Sam's iPhone", platform: "ios" })!;
    expect(token.startsWith("aqd_")).toBe(true);
    expect(operatorOperations.length).toBeGreaterThan(15);
    for (const operation of operatorOperations) {
      const answer = await call(operation, { token, input: filled(operation) });
      expect(answer.status, operation.name).toBe(403);
    }
    // It knows the person is an operator, so the app can offer the console. That is all it knows.
    expect((await call("get_me", { token })).body).toMatchObject({ id: "usr_demo_sam", role: "operator" });
    // And it is no use where the console's own session is asked for.
    expect((await call("create_operator_challenge", { token, input: { purpose: "unlock" } })).code).toBe("operator_device_required");
    expect((await call("delete_operator_device_session", { token })).code).toBe("operator_device_required");
  });
});

describe("an operator device session", () => {
  it("is refused every operator operation not marked for phones with 403 web_only, unlocked or not, and each refusal is written down", async () => {
    const device = enrol();
    expect((await unlock(device)).status).toBe(200);
    const unmarked = operatorOperations.filter((operation) => !operation.mobile);
    expect(unmarked.map((operation) => operation.name)).toEqual(expect.arrayContaining(["operator_top_up_user", "operator_assign_plan", "operator_list_keys", "operator_create_grant", "operator_set_capability", "operator_list_devices", "operator_revoke_device", "operator_revoke_all_devices", "operator_list_audit"]));
    for (const operation of unmarked) {
      const answer = await call(operation, { token: device.token, input: filled(operation), proof: "nonce.signature" });
      expect([answer.status, answer.code], operation.name).toEqual([403, "web_only"]);
      expect(lastAudit(), operation.name).toMatchObject({ event: "refused", operation: operation.name, detail: "web_only", device_id: device.id, user_id: "usr_demo_sam" });
    }
    // None of them ran: the phones are all still enrolled.
    expect(operatorDevices().list().some((entry) => entry.id === device.id)).toBe(true);
  });

  it("is refused every user operation, so it can never run a job or spend credit", async () => {
    const device = enrol();
    await unlock(device);
    const userOperations = OPERATIONS.filter((operation) => !operation.operator && !OPEN_TO_OPERATOR_DEVICES.includes(operation.name));
    expect(userOperations.map((operation) => operation.name)).toEqual(expect.arrayContaining(["create_generation", "run_capability", "create_conversation", "open_session", "delete_account", "list_devices", "create_device_session"]));
    for (const operation of userOperations) {
      const answer = await call(operation, { token: device.token, input: filled(operation) });
      expect([answer.status, answer.code], operation.name).toEqual([403, "operator_session"]);
    }
    expect(lastAudit()).toMatchObject({ event: "refused", detail: "operator_session" });
    expect([...OPEN_TO_OPERATOR_DEVICES].sort()).toEqual(["create_operator_challenge", "delete_operator_device_session", "get_instance", "get_me", "unlock_operator_device_session"]);
    expect((await call("get_instance", { token: device.token })).body).toMatchObject({ surfaces: { console: true, mobile_console: true } });
    expect((await call("get_me", { token: device.token })).body).toMatchObject({ id: "usr_demo_sam", role: "operator" });
  });

  it("can't read while locked (401 locked), and can once it has unlocked with the phone's signature", async () => {
    const device = enrol();
    const reads = OPERATIONS.filter((operation) => operation.mobile === "read");
    for (const operation of reads) {
      const answer = await call(operation, { token: device.token });
      expect([answer.status, answer.code], operation.name).toEqual([401, "locked"]);
    }
    expect(lastAudit()).toMatchObject({ event: "refused", detail: "locked", device_id: device.id });

    const opened = await unlock(device);
    expect(opened.body).toEqual({ unlocked_until: expect.any(String) });
    expect(lastAudit()).toMatchObject({ event: "unlock", device_id: device.id });
    for (const operation of reads) expect((await call(operation, { token: device.token })).status, operation.name).toBe(200);
  });

  it("answers the phone's reads without a token, a key or a builder key in them", async () => {
    const device = enrol();
    await unlock(device);
    for (const operation of OPERATIONS.filter((entry) => entry.mobile === "read")) {
      const { text } = await call(operation, { token: device.token });
      expect(text, operation.name).not.toMatch(/aqo_|aqd_|lpk_|token|secret|builder_?key|public_?key|private/i);
    }
    const { text } = await call("get_me", { token: device.token });
    expect(text).not.toMatch(/aqo_|aqd_|lpk_|builder_?key|public_?key/i);
  });

  it("needs a proof for every change: an unlocked session is not enough", async () => {
    const device = enrol();
    await unlock(device);
    const input = { id: "usr_demo_priya", status: "paused" };
    const answer = await call("operator_set_user_status", { token: device.token, input });
    expect([answer.status, answer.code]).toEqual([401, "proof_required"]);
    expect(lastAudit()).toMatchObject({ event: "refused", operation: "operator_set_user_status", target: "usr_demo_priya", detail: "proof_required" });
  });

  it("makes a change with a proof for exactly it, once, and writes it down", async () => {
    const device = enrol();
    const input = { id: "usr_demo_priya", status: "paused" };
    const proof = await proofFor(device, "operator_set_user_status", input);
    // No unlock is needed for a change: the proof is the stronger check.
    const done = await call("operator_set_user_status", { token: device.token, input, proof });
    expect([done.status, done.body]).toEqual([200, { ok: true }]);
    expect(lastAudit()).toMatchObject({ event: "change", operation: "operator_set_user_status", target: "usr_demo_priya", detail: "paused", device_id: device.id, device_name: "Sam's iPhone", user_name: "Sam Whitfield" });

    const again = await call("operator_set_user_status", { token: device.token, input, proof });
    expect([again.status, again.code]).toEqual([401, "proof_required"]);
    expect(lastAudit()).toMatchObject({ event: "refused", operation: "operator_set_user_status", detail: "unknown or used nonce" });
  });

  it("refuses a proof made for another operation, for other input, or signed by another key", async () => {
    const device = enrol();
    const input = { id: "usr_demo_priya", status: "paused" };

    const forReport = await proofFor(device, "operator_resolve_report", { id: "usr_demo_priya", outcome: "hidden" });
    expect((await call("operator_set_user_status", { token: device.token, input, proof: forReport })).code).toBe("proof_required");
    expect(lastAudit()).toMatchObject({ event: "refused", detail: "made for another operation or input" });

    const forResume = await proofFor(device, "operator_set_user_status", { id: "usr_demo_priya", status: "active" });
    expect((await call("operator_set_user_status", { token: device.token, input, proof: forResume })).code).toBe("proof_required");
    const forSomeoneElse = await proofFor(device, "operator_set_user_status", { id: "usr_demo_adam", status: "paused" });
    expect((await call("operator_set_user_status", { token: device.token, input, proof: forSomeoneElse })).code).toBe("proof_required");

    const otherKey = await proofFor(device, "operator_set_user_status", input, testPhone());
    expect((await call("operator_set_user_status", { token: device.token, input, proof: otherKey })).code).toBe("proof_required");
    expect(lastAudit()).toMatchObject({ event: "refused", detail: "signature isn't this phone's" });

    // Another enrolled phone's proof is no use to this one.
    const other = enrol();
    const theirs = await proofFor(other, "operator_set_user_status", input);
    expect((await call("operator_set_user_status", { token: device.token, input, proof: theirs })).code).toBe("proof_required");
  });

  it("ignores the address of a change, so nothing unsigned can ride along with a signed body", async () => {
    const device = enrol();
    const input = { id: "usr_demo_priya", status: "active" };
    const proof = await proofFor(device, "operator_set_user_status", input);
    const done = await call("operator_set_user_status", { token: device.token, input, proof, query: "status=paused&application_id=other" });
    expect(done.status).toBe(200);
    expect(lastAudit()).toMatchObject({ event: "change", detail: "active" });
  });

  it("only gives a nonce for unlocking or for a change a phone may make", async () => {
    const device = enrol();
    const ask = (input: Record<string, unknown>) => call("create_operator_challenge", { token: device.token, input });
    expect((await ask({ purpose: "operator_top_up_user", input_hash: inputHash({}) })).status).toBe(400);
    expect((await ask({ purpose: "operator_list_jobs", input_hash: inputHash({}) })).status).toBe(400);
    expect((await ask({ purpose: "operator_resolve_report" })).status).toBe(400);
    expect((await ask({ purpose: "operator_resolve_report", input_hash: "short" })).status).toBe(400);
    expect((await ask({ purpose: "operator_resolve_report", input_hash: inputHash({ id: "rep_1", outcome: "hidden" }) })).body).toEqual({ nonce: expect.stringMatching(/^[\w-]{43}$/), expires_at: expect.any(String) });
  });

  it("is revoked at five refused proofs in a row, and then nothing works", async () => {
    const device = enrol();
    const input = { id: "usr_demo_priya", status: "paused" };
    for (let attempt = 1; attempt <= MAX_FAILED_PROOFS; attempt += 1) {
      const answer = await call("operator_set_user_status", { token: device.token, input, proof: `nonce${attempt}.c2lnbmF0dXJlLXRoYXQtaXMtbm90LW9uZQ` });
      expect([answer.status, answer.code], `attempt ${attempt}`).toEqual([401, "proof_required"]);
    }
    expect(lastAudit()).toMatchObject({ event: "revoked", device_id: device.id, detail: `${MAX_FAILED_PROOFS} refused proofs in a row` });
    const after = await call("get_me", { token: device.token });
    expect([after.status, after.code]).toEqual([401, "signed_out"]);
  });

  it("stops on the request after it is revoked from the web console, and the person's user app carries on", async () => {
    const device = enrol();
    await unlock(device);
    const code = devices().issueCode({ identity: sam, builderKey: null, challenge: TEST_CHALLENGE, platform: "ios" });
    const app = devices().redeemCode({ code, verifier: TEST_VERIFIER, deviceName: "Sam's iPhone", platform: "ios" })!;
    expect((await call("operator_status", { token: device.token })).status).toBe(200);

    expect(operatorDevices().revoke(device.id, { userId: "usr_demo_ops", name: "Ola Operator", deviceId: null, deviceName: null })).toBe(true);
    expect(lastAudit()).toMatchObject({ event: "revoked", user_name: "Ola Operator", device_id: device.id, detail: "revoked from the web console" });
    const after = await call("operator_status", { token: device.token });
    expect([after.status, after.code]).toEqual([401, "signed_out"]);
    expect((await call("get_me", { token: app.token })).status).toBe(200);
  });

  it("signs itself out, and suspending the person ends their console sessions too", async () => {
    const device = enrol();
    expect((await call("delete_operator_device_session", { token: device.token })).body).toEqual({ deleted: true });
    expect(lastAudit()).toMatchObject({ event: "sign_out", device_id: device.id });
    expect((await call("get_me", { token: device.token })).status).toBe(401);

    const acting = enrol();
    const suspended = enrol({ ...sam, userId: "usr_demo_priya", name: "Priya Raman" });
    const input = { id: "usr_demo_priya", status: "paused" };
    expect((await call("operator_set_user_status", { token: acting.token, input, proof: await proofFor(acting, "operator_set_user_status", input) })).status).toBe(200);
    expect((await call("get_me", { token: suspended.token })).status).toBe(401);
    expect(operatorAudit().list(5)).toContainEqual(expect.objectContaining({ event: "revoked", device_id: suspended.id, detail: "suspended" }));
  });

  it("can't be used over MCP", async () => {
    const device = enrol();
    await unlock(device);
    const response = await mcp(new NextRequest("http://localhost/api/mcp", { method: "POST", headers: { authorization: `Bearer ${device.token}`, "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "operator_list_keys", arguments: {} } }) }));
    expect(response.status).toBe(401);
  });

  it("collects an operator sign-in over the API, with the phone's key, once", async () => {
    const phone = testPhone();
    const code = operatorDevices().issueCode({ identity: sam, challenge: TEST_CHALLENGE, platform: "ios" })!;
    const input = { code, verifier: TEST_VERIFIER, platform: "ios", device_name: "Sam's iPhone", public_key: phone.rawPublicKey };
    const issued = await call("create_operator_device_session", { input });
    expect(issued.body).toMatchObject({ token: expect.stringMatching(/^aqo_/), device: { user_name: "Sam Whitfield", name: "Sam's iPhone", platform: "ios" } });
    expect(lastAudit()).toMatchObject({ event: "sign_in", user_id: "usr_demo_sam" });
    expect((await call("create_operator_device_session", { input })).code).toBe("sign_in_expired");
  });
});

describe("with the console on phones switched off", () => {
  it("refuses an enrolled phone everything with 403 mobile_console_off, enrols no one, and leaves the user app alone", async () => {
    const device = enrol();
    await unlock(device);
    const code = devices().issueCode({ identity: sam, builderKey: null, challenge: TEST_CHALLENGE, platform: "ios" });
    const app = devices().redeemCode({ code, verifier: TEST_VERIFIER, deviceName: "Sam's iPhone", platform: "ios" })!;

    configure({ mobile: true, mobileConsole: false });
    for (const name of ["operator_status", "get_me", "get_instance", "create_operator_challenge", "operator_set_user_status"]) {
      const operation = OPERATIONS.find((entry) => entry.name === name)!;
      const answer = await call(operation, { token: device.token, input: filled(operation) });
      expect([answer.status, answer.code], name).toEqual([403, "mobile_console_off"]);
    }
    const pending = operatorDevices().issueCode({ identity: sam, challenge: TEST_CHALLENGE, platform: "ios" })!;
    expect((await call("create_operator_device_session", { input: { code: pending, verifier: TEST_VERIFIER, platform: "ios", public_key: testPhone().rawPublicKey } })).code).toBe("mobile_console_off");
    expect((await call("get_me", { token: app.token })).status).toBe(200);
    expect((await call("get_instance")).body).toMatchObject({ surfaces: { mobile: true, mobile_console: false } });

    // Switched back on, the phone carries on where it was.
    configure({ mobile: true, mobileConsole: true });
    expect((await call("operator_status", { token: device.token })).status).toBe(200);
  });

  it("serves the console on phones alone, with the user app and the API both off", async () => {
    configure({ mobile: false, mobileConsole: true, api: false });
    const device = enrol();
    expect((await unlock(device)).status).toBe(200);
    expect((await call("operator_status", { token: device.token })).status).toBe(200);
    // A user's device session is still refused, and an API key finds nothing there.
    const code = devices().issueCode({ identity: sam, builderKey: null, challenge: TEST_CHALLENGE, platform: "ios" });
    const app = devices().redeemCode({ code, verifier: TEST_VERIFIER, deviceName: "Sam's iPhone", platform: "ios" })!;
    expect((await call("get_me", { token: app.token })).code).toBe("mobile_off");
    expect((await call("operator_status", { token: "lpk_an_api_key" })).status).toBe(404);
    configure({ mobile: true, mobileConsole: true });
  });
});

describe("the dispatcher", () => {
  it("is the only place a request reaches an operation's run", () => {
    const root = path.resolve(import.meta.dirname, "../..");
    const sources = (folder: string): string[] =>
      readdirSync(folder, { withFileTypes: true }).flatMap((entry) => {
        const full = path.join(folder, entry.name);
        if (entry.isDirectory()) return entry.name === "node_modules" || entry.name.startsWith(".") ? [] : sources(full);
        return /\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name) ? [full] : [];
      });
    const callers = sources(root).filter((file) => /\boperation\.run\(|\.operation\.run\(|\]\.run\(/.test(readFileSync(file, "utf8")));
    expect(callers.map((file) => path.relative(root, file))).toEqual(["lib/public-api/dispatch.ts"]);
  });
});
