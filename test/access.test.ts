import { Hono } from "hono";
import { createLocalJWKSet, exportJWK, generateKeyPair, type JWTPayload, type JWTVerifyGetKey, SignJWT } from "jose";
import { beforeAll, describe, expect, it, type Mock, vi } from "vitest";
import { ACCESS_JWT_HEADER, accessAuth, DEFAULT_DEV_USER_EMAIL } from "../src/middleware/access.ts";
import type { AppEnv } from "../src/types.ts";

const TEAM_DOMAIN = "example-team.cloudflareaccess.com";
const AUD = "test-aud-tag";
const KID = "test-key";

type TestEnv = Partial<AppEnv["Bindings"]>;

const configured: TestEnv = {
  ENVIRONMENT: "production",
  ACCESS_TEAM_DOMAIN: TEAM_DOMAIN,
  ACCESS_AUD: AUD,
};

let signingKey: CryptoKey;
let otherKey: CryptoKey;
let getKey: Mock<(teamDomain: string) => JWTVerifyGetKey>;

beforeAll(async () => {
  const pair = await generateKeyPair("RS256", { extractable: true });
  signingKey = pair.privateKey;
  otherKey = (await generateKeyPair("RS256")).privateKey;

  const jwk = { ...(await exportJWK(pair.publicKey)), kid: KID, alg: "RS256" };
  const jwks = createLocalJWKSet({ keys: [jwk] });
  getKey = vi.fn((_teamDomain: string) => jwks);
});

function sign(
  payload: JWTPayload,
  options: { key?: CryptoKey; aud?: string; iss?: string; exp?: string | number } = {},
) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "RS256", kid: KID })
    .setIssuer(options.iss ?? `https://${TEAM_DOMAIN}`)
    .setAudience(options.aud ?? AUD)
    .setIssuedAt()
    .setExpirationTime(options.exp ?? "5m")
    .sign(options.key ?? signingKey);
}

function createApp() {
  const app = new Hono<AppEnv>();
  app.use(accessAuth({ getKey }));
  app.get("/", (c) => c.text(c.var.userEmail));
  return app;
}

async function request(env: TestEnv, token?: string, url = "https://app.example.workers.dev/") {
  const headers = token ? { [ACCESS_JWT_HEADER]: token } : undefined;
  return createApp().request(url, { headers }, env);
}

describe("accessAuth", () => {
  it("正常系: 正しい JWT ならメールアドレスを Context に格納する", async () => {
    const res = await request(configured, await sign({ email: "alice@example.com", sub: "user-id" }));
    expect(res.status).toBe(200);
    expect(await res.text()).toBe("alice@example.com");
  });

  it("チームドメインは https:// 付き・末尾スラッシュ付きでも受け付ける", async () => {
    const env = { ...configured, ACCESS_TEAM_DOMAIN: `https://${TEAM_DOMAIN}/` };
    const res = await request(env, await sign({ email: "alice@example.com" }));
    expect(res.status).toBe(200);
  });

  it("署名不正: 別の鍵で署名された JWT は 403", async () => {
    const res = await request(configured, await sign({ email: "alice@example.com" }, { key: otherKey }));
    expect(res.status).toBe(403);
  });

  it("改ざん: ペイロードを書き換えた JWT は 403", async () => {
    const token = await sign({ email: "alice@example.com" });
    const [header, , signature] = token.split(".");
    const forged = btoa(JSON.stringify({ email: "mallory@example.com", aud: AUD, iss: `https://${TEAM_DOMAIN}` }))
      .replace(/=+$/, "")
      .replace(/\+/g, "-")
      .replace(/\//g, "_");
    const res = await request(configured, `${header}.${forged}.${signature}`);
    expect(res.status).toBe(403);
  });

  it("aud 不一致は 403", async () => {
    const res = await request(configured, await sign({ email: "alice@example.com" }, { aud: "other-aud" }));
    expect(res.status).toBe(403);
  });

  it("iss 不一致は 403", async () => {
    const res = await request(
      configured,
      await sign({ email: "alice@example.com" }, { iss: "https://other-team.cloudflareaccess.com" }),
    );
    expect(res.status).toBe(403);
  });

  it("有効期限切れは 403", async () => {
    const expired = Math.floor(Date.now() / 1000) - 60;
    const res = await request(configured, await sign({ email: "alice@example.com" }, { exp: expired }));
    expect(res.status).toBe(403);
  });

  it("メールアドレスを含まない JWT（サービストークン等）は 403", async () => {
    const res = await request(configured, await sign({ common_name: "service-token" }));
    expect(res.status).toBe(403);
  });

  it("ヘッダーなしは 403", async () => {
    const res = await request(configured);
    expect(res.status).toBe(403);
  });

  describe("設定値なし（フェイルクローズ）", () => {
    it.each([
      ["ACCESS_TEAM_DOMAIN が空", { ...configured, ACCESS_TEAM_DOMAIN: "" }],
      ["ACCESS_AUD が空", { ...configured, ACCESS_AUD: "" }],
      ["両方とも未定義", { ENVIRONMENT: "production" }],
      ["ENVIRONMENT も未定義", {}],
    ])("%s なら、正しい JWT があっても拒否する", async (_, env) => {
      getKey.mockClear();
      const res = await request(env, await sign({ email: "alice@example.com" }));
      expect(res.status).toBe(500);
      expect(getKey).not.toHaveBeenCalled();
    });
  });

  describe("ローカルスキップ", () => {
    it("ENVIRONMENT=local かつ localhost なら、JWT なしで DEV_USER_EMAIL のユーザーになる", async () => {
      const env = { ENVIRONMENT: "local", DEV_USER_EMAIL: "me@example.com" };
      const res = await request(env, undefined, "http://localhost:8787/");
      expect(res.status).toBe(200);
      expect(await res.text()).toBe("me@example.com");
    });

    it("DEV_USER_EMAIL が未設定ならデフォルトのダミーユーザーになる", async () => {
      const res = await request({ ENVIRONMENT: "local" }, undefined, "http://127.0.0.1:8787/");
      expect(await res.text()).toBe(DEFAULT_DEV_USER_EMAIL);
    });

    it("ENVIRONMENT=local でも localhost 以外へのリクエストはスキップしない", async () => {
      const res = await request({ ENVIRONMENT: "local" }, undefined, "https://app.example.workers.dev/");
      expect(res.status).toBe(500);
    });

    it.each(["Local", "development", "test", ""])("ENVIRONMENT=%j ではスキップしない", async (environment) => {
      const res = await request({ ENVIRONMENT: environment }, undefined, "http://localhost:8787/");
      expect(res.status).toBe(500);
    });
  });
});
