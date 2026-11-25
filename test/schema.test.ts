// 共通テーブル定義（migrations/0002）が適用され、DBの制約が効いていることを確かめる
import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";

const USER = "tester@example.com";

async function insertCompany(fields: Record<string, string | null> = {}) {
  const row = { name_kana: "てすとがいしゃ", kana_norm: "てすとがいしゃ", ...fields };
  const cols = [...Object.keys(row), "created_by", "updated_by"];
  const values = [...Object.values(row), USER, USER];
  const result = await env.DB.prepare(
    `INSERT INTO companies (${cols.join(", ")}) VALUES (${cols.map(() => "?").join(", ")})`,
  )
    .bind(...values)
    .run();
  return result.meta.last_row_id;
}

async function insertMemo(fields: Record<string, string | number | null>) {
  const row = { received_at: "2026-11-25T01:00:00Z", purpose: "notify", addressee_id: 1, ...fields };
  const cols = [...Object.keys(row), "created_by", "updated_by"];
  const values = [...Object.values(row), USER, USER];
  return env.DB.prepare(`INSERT INTO call_memos (${cols.join(", ")}) VALUES (${cols.map(() => "?").join(", ")})`)
    .bind(...values)
    .run();
}

describe("共通テーブル定義", () => {
  it("STEP1 の6テーブルが作られている", async () => {
    const { results } = await env.DB.prepare(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' AND name NOT LIKE 'd1_%'",
    ).all<{ name: string }>();
    expect(results.map((r) => r.name)).toEqual(
      expect.arrayContaining([
        "companies",
        "contacts",
        "transfer_targets",
        "company_transfer_settings",
        "contact_transfer_settings",
        "call_memos",
      ]),
    );
  });

  it("取次先の初期4名が並び順どおりに入っている", async () => {
    const { results } = await env.DB.prepare(
      "SELECT display_name FROM transfer_targets WHERE deleted_at IS NULL ORDER BY sort_order",
    ).all<{ display_name: string }>();
    expect(results.map((r) => r.display_name)).toEqual(["社長", "菊地", "益岡", "木村"]);
  });

  it("日時の既定値は UTC の ISO 8601（秒まで、Z付き）", async () => {
    const id = await insertCompany();
    const row = await env.DB.prepare("SELECT created_at FROM companies WHERE id = ?").bind(id).first<{
      created_at: string;
    }>();
    expect(row?.created_at).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/);
  });
});

describe("DBの制約（最後の防御線）", () => {
  it("電話番号は半角数字のみ", async () => {
    await expect(insertCompany({ phone: "03-1234-5678" })).rejects.toThrow(/CHECK/);
    await expect(insertCompany({ phone: "0312345678" })).resolves.toBeTypeOf("number");
  });

  it("存在しない会社に担当者を登録できない（外部キー）", async () => {
    const insert = env.DB.prepare(
      "INSERT INTO contacts (company_id, name_kana, kana_norm, phone, created_by, updated_by) VALUES (?, ?, ?, ?, ?, ?)",
    )
      .bind(99999, "たなか", "たなか", "0312345678", USER, USER)
      .run();
    await expect(insert).rejects.toThrow(/FOREIGN KEY/);
  });

  it("取次設定に「未設定」の値は入れられない（未設定は行なしで表す）", async () => {
    const companyId = await insertCompany();
    const insert = (status: string) =>
      env.DB.prepare(
        "INSERT INTO company_transfer_settings (company_id, target_id, status, created_by, updated_by) VALUES (?, 1, ?, ?, ?)",
      )
        .bind(companyId, status, USER, USER)
        .run();
    await expect(insert("unset")).rejects.toThrow(/CHECK/);
    await expect(insert("connect")).resolves.toBeTruthy();
  });

  it("取次先のメールアドレスは有効な中で一意（大文字・小文字を区別しない）", async () => {
    const insert = env.DB.prepare(
      "INSERT INTO transfer_targets (display_name, email, created_by, updated_by) VALUES ('重複', 'KIKUCHI@example.test', ?, ?)",
    )
      .bind(USER, USER)
      .run();
    await expect(insert).rejects.toThrow(/UNIQUE/);
  });

  it("取次メモの相手情報は1つ以上必要", async () => {
    await expect(insertMemo({})).rejects.toThrow(/CHECK/);
    await expect(insertMemo({ caller_name: "山田" })).resolves.toBeTruthy();
  });

  it("用件が折り返し希望なら電話番号、伝言希望なら伝言が必要", async () => {
    await expect(insertMemo({ caller_name: "山田", purpose: "callback" })).rejects.toThrow(/CHECK/);
    await expect(insertMemo({ caller_name: "山田", purpose: "message" })).rejects.toThrow(/CHECK/);
  });

  it("紐付けは担当者か会社のどちらか一方まで", async () => {
    const companyId = await insertCompany();
    const contact = await env.DB.prepare(
      "INSERT INTO contacts (company_id, name_kana, kana_norm, phone, created_by, updated_by) VALUES (?, 'たなか', 'たなか', '0312345678', ?, ?)",
    )
      .bind(companyId, USER, USER)
      .run();
    await expect(
      insertMemo({ caller_name: "田中", linked_contact_id: contact.meta.last_row_id, linked_company_id: companyId }),
    ).rejects.toThrow(/CHECK/);
  });

  it("対処日時と対処者はそろって入る", async () => {
    await expect(insertMemo({ caller_name: "山田", handled_at: "2026-11-25T02:00:00Z" })).rejects.toThrow(/CHECK/);
    await expect(
      insertMemo({ caller_name: "山田", handled_at: "2026-11-25T02:00:00Z", handled_by: USER }),
    ).resolves.toBeTruthy();
  });
});
