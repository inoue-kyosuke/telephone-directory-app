// Cloudflare Access の JWT を検証するミドルウェア
// https://developers.cloudflare.com/cloudflare-one/identity/authorization-cookie/validating-json/
//
// - Cf-Access-Jwt-Assertion ヘッダーの JWT を、チームドメインの公開鍵で検証する。
// - 成功したらメールアドレスを c.var.userEmail に格納する（sub は Zero Trust 組織ごとに変わるため使わない）。
// - ACCESS_TEAM_DOMAIN / ACCESS_AUD が未設定なら、検証をスキップせずに拒否する（フェイルクローズ）。
// - ENVIRONMENT=local かつ localhost へのリクエストのときだけ検証をスキップし、ダミーユーザーとして扱う。

import type { MiddlewareHandler } from "hono";
import { createMiddleware } from "hono/factory";
import { createRemoteJWKSet, type JWTVerifyGetKey, jwtVerify } from "jose";
import type { AppEnv } from "../types.ts";

export const ACCESS_JWT_HEADER = "Cf-Access-Jwt-Assertion";
export const DEFAULT_DEV_USER_EMAIL = "dev-user@example.com";

const LOCAL_HOSTNAMES = new Set(["localhost", "127.0.0.1", "[::1]", "0.0.0.0"]);

export type AccessOptions = {
  // テスト用: 公開鍵の取得方法を差し替える（省略時はチームドメインの certs エンドポイントから取得）
  getKey?: (teamDomain: string) => JWTVerifyGetKey;
};

// 公開鍵セットはチームドメインごとに使い回す（jose がキャッシュと鍵ローテーションを処理する）
const remoteJwks = new Map<string, JWTVerifyGetKey>();

function getRemoteJwks(teamDomain: string): JWTVerifyGetKey {
  let jwks = remoteJwks.get(teamDomain);
  if (!jwks) {
    jwks = createRemoteJWKSet(new URL(`https://${teamDomain}/cdn-cgi/access/certs`));
    remoteJwks.set(teamDomain, jwks);
  }
  return jwks;
}

// "https://example.cloudflareaccess.com/" と "example.cloudflareaccess.com" のどちらでも受け付ける
export function normalizeTeamDomain(value: string | undefined): string {
  return (value ?? "")
    .trim()
    .replace(/^https?:\/\//, "")
    .replace(/\/+$/, "");
}

export function accessAuth(options: AccessOptions = {}): MiddlewareHandler<AppEnv> {
  const getKey = options.getKey ?? getRemoteJwks;

  return createMiddleware<AppEnv>(async (c, next) => {
    // ローカル開発: ENVIRONMENT=local が明示され、かつ localhost へのリクエストのときだけスキップする
    if (c.env.ENVIRONMENT === "local") {
      const hostname = new URL(c.req.url).hostname;
      if (!LOCAL_HOSTNAMES.has(hostname)) {
        console.error(`ENVIRONMENT=local but request host is "${hostname}". Refusing to skip Access.`);
        return c.text("Server misconfiguration", 500);
      }
      c.set("userEmail", c.env.DEV_USER_EMAIL || DEFAULT_DEV_USER_EMAIL);
      return next();
    }

    const teamDomain = normalizeTeamDomain(c.env.ACCESS_TEAM_DOMAIN);
    const audience = (c.env.ACCESS_AUD ?? "").trim();
    if (!teamDomain || !audience) {
      console.error("ACCESS_TEAM_DOMAIN and ACCESS_AUD must be set.");
      return c.text("Server misconfiguration", 500);
    }

    const token = c.req.header(ACCESS_JWT_HEADER);
    if (!token) {
      return c.text("Forbidden", 403);
    }

    try {
      const { payload } = await jwtVerify(token, getKey(teamDomain), {
        issuer: `https://${teamDomain}`,
        audience,
        algorithms: ["RS256"],
      });
      // サービストークンなど、メールアドレスを持たないトークンは受け付けない
      if (typeof payload.email !== "string" || payload.email === "") {
        return c.text("Forbidden", 403);
      }
      c.set("userEmail", payload.email);
    } catch (err) {
      console.warn("Access JWT verification failed:", err instanceof Error ? err.message : err);
      return c.text("Forbidden", 403);
    }

    return next();
  });
}
