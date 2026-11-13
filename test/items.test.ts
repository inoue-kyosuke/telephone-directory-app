import { env, exports } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import app from "../src/index.tsx";

const BASE = "http://localhost:8787";
const localEnv = { ...env, ENVIRONMENT: "local", DEV_USER_EMAIL: "tester@example.com" };

function post(path: string, form: Record<string, string> = {}) {
  return app.request(
    `${BASE}${path}`,
    { method: "POST", body: new URLSearchParams(form), headers: { Origin: BASE } },
    localEnv,
  );
}

describe("items", () => {
  it("一覧・登録・削除ができ、作成者としてログインユーザーのメールアドレスを保存する", async () => {
    const created = await post("/items", { title: "テストアイテム" });
    expect(created.status).toBe(303);

    const row = await env.DB.prepare("SELECT id, title, created_by FROM items WHERE title = ?")
      .bind("テストアイテム")
      .first<{ id: number; title: string; created_by: string }>();
    expect(row?.created_by).toBe("tester@example.com");

    const list = await app.request(`${BASE}/`, {}, localEnv);
    expect(list.status).toBe(200);
    expect(await list.text()).toContain("テストアイテム");

    const deleted = await post(`/items/${row?.id}/delete`);
    expect(deleted.status).toBe(303);
    const count = await env.DB.prepare("SELECT COUNT(*) AS n FROM items").first<number>("n");
    expect(count).toBe(0);
  });

  it("空のタイトルは登録しない", async () => {
    const res = await post("/items", { title: "   " });
    expect(res.headers.get("Location")).toBe("/?error=title");
    const count = await env.DB.prepare("SELECT COUNT(*) AS n FROM items").first<number>("n");
    expect(count).toBe(0);
  });

  it("別オリジンからの POST は拒否する（CSRF 対策）", async () => {
    const res = await app.request(
      `${BASE}/items`,
      { method: "POST", body: new URLSearchParams({ title: "x" }), headers: { Origin: "https://evil.example" } },
      localEnv,
    );
    expect(res.status).toBe(403);
  });

  it("Access 設定値が未設定のデプロイ環境では、Worker 全体がリクエストを拒否する", async () => {
    // vitest.config.ts で ENVIRONMENT=test・Access 設定値は空にしている
    const res = await exports.default.fetch("https://app.example.workers.dev/");
    expect(res.status).toBe(500);
  });
});
