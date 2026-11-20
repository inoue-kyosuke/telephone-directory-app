// 画面モック（仕様書 docs/spec-step1.md 5.8 の S-01〜S-08）
// 保存・削除などの処理は持たない。ボタンは次の画面への遷移のみ。

import { Hono } from "hono";
import type { AppEnv } from "../types.ts";
import { AuditInfo, Card, Field, KANA_HINT, M, MockLayout, PHONE_HINT, RuleBadge, RuleMatrix } from "./components.tsx";
import {
  type Company,
  type Contact,
  companies,
  contacts,
  contactsOf,
  displayName,
  effective,
  findCompany,
  findContact,
  MOCK_USER,
  memos,
  PURPOSES,
  RECIPIENTS,
  type Recipient,
  type RuleState,
  type Rules,
} from "./data.ts";

export const mock = new Hono<AppEnv>();

const NotFound = () => (
  <MockLayout title="対象が見つかりません">
    <div class="alert alert-error">対象が見つかりません</div>
  </MockLayout>
);

const RULE_STATES: RuleState[] = ["つなぐ", "つながない", "未設定"];

// ---------------------------------------------------------------- 画面一覧
mock.get("/", (c) => {
  const screens: [string, string, string][] = [
    ["S-01", "検索（トップ・初期表示）", `${M}/search`],
    ["S-01", "検索結果（会社ヒット）", `${M}/search?q=ミライ`],
    ["S-01", "検索結果（担当者のみヒット）", `${M}/search?q=たなか`],
    ["S-01", "検索結果（電話番号）", `${M}/search?q=03-0000-0001`],
    ["S-01", "該当なし", `${M}/search?q=ほげほげ`],
    ["S-01", "入力エラー（数字4桁未満）", `${M}/search?q=03`],
    ["S-02", "会社詳細", `${M}/companies/1`],
    ["S-02", "会社詳細（会社名が空・担当者なし）", `${M}/companies/3`],
    ["S-03", "担当者詳細", `${M}/contacts/1`],
    ["S-04", "会社の新規登録（検索語引き継ぎ）", `${M}/companies/new?q=ほげほげ`],
    ["S-04", "会社の新規登録（入力エラー）", `${M}/companies/new?error=1`],
    ["S-04", "会社の新規登録（重複警告）", `${M}/companies/new?dup=1`],
    ["S-04", "会社の編集", `${M}/companies/1/edit`],
    ["S-04", "担当者の新規登録", `${M}/contacts/new?companyId=1`],
    ["S-04", "担当者の編集", `${M}/contacts/1/edit`],
    ["S-04", "担当者の所属会社変更の確認", `${M}/contacts/1/move-confirm`],
    ["S-04", "競合エラー", `${M}/companies/1/edit?conflict=1`],
    ["S-05", "つなぐ設定の変更（会社）", `${M}/companies/1/rules/edit`],
    ["S-05", "つなぐ設定の確認（会社）", `${M}/companies/1/rules/confirm?益岡=つながない`],
    ["S-05", "つなぐ設定の変更（担当者）", `${M}/contacts/1/rules/edit`],
    ["S-06", "削除の確認（会社）", `${M}/companies/1/delete`],
    ["S-06", "削除の確認（担当者）", `${M}/contacts/1/delete`],
    ["S-07", "取次メモ一覧（自分宛て・未対処）", `${M}/memos`],
    ["S-07", "取次メモ一覧（すべて）", `${M}/memos?to=all&status=all`],
    ["S-07", "取次メモ一覧（0件）", `${M}/memos?empty=1`],
    ["S-08", "取次メモの作成", `${M}/memos/new`],
    ["S-08", "取次メモの作成（担当者から）", `${M}/memos/new?contactId=1`],
    ["S-08", "取次メモの作成（入力エラー）", `${M}/memos/new?error=1`],
    ["S-08", "取次メモの編集（未登録の相手）", `${M}/memos/3/edit`],
  ];
  return c.html(
    <MockLayout title="画面一覧">
      <Card>
        <p class="text-sm">
          仕様書 5.8 の画面一覧に対応する静的モックです。保存・削除などの処理はなく、ボタンは画面遷移のみです。
        </p>
        <div class="overflow-x-auto">
          <table class="table table-sm">
            <thead>
              <tr>
                <th>ID</th>
                <th>画面・状態</th>
              </tr>
            </thead>
            <tbody>
              {screens.map(([id, name, href]) => (
                <tr>
                  <td class="whitespace-nowrap">{id}</td>
                  <td>
                    <a class="link link-primary" href={href}>
                      {name}
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </MockLayout>,
  );
});

// ---------------------------------------------------------------- S-01 検索
const norm = (s: string) =>
  s
    .normalize("NFKC")
    .replace(/[\s　]/g, "")
    .toLowerCase()
    .replace(/[ァ-ヶ]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0x60));

function search(q: string) {
  const digits = q.normalize("NFKC").replace(/[-\s]/g, "");
  const isNumeric = /^\d+$/.test(digits);
  const key = isNumeric ? digits : norm(q);
  const textHit = (s: string) => s !== "" && norm(s).includes(key);
  const hit = (x: Company | Contact) => (isNumeric ? x.phone.includes(key) : textHit(x.name) || textHit(x.kana));

  const results = companies
    .map((co) => {
      const all = contactsOf(co.id);
      if (hit(co))
        return { co, list: all, partial: false, exact: co.phone === key || all.some((x) => x.phone === key) };
      const list = all.filter(hit);
      return list.length ? { co, list, partial: true, exact: list.some((x) => x.phone === key) } : null;
    })
    .filter((r) => r !== null);
  results.sort((a, b) => Number(b.exact) - Number(a.exact) || a.co.kana.localeCompare(b.co.kana, "ja"));
  return results;
}

function validateQuery(q: string): string | null {
  const stripped = q.normalize("NFKC").replace(/[-\s]/g, "");
  if (stripped === "") return "検索語を入力してください";
  if (/^\d+$/.test(stripped)) return stripped.length < 4 ? "数字のみの検索は4桁以上で入力してください" : null;
  return stripped.length < 2 ? "検索語は2文字以上で入力してください" : null;
}

function ContactRuleCells({ company, contact }: { company: Rules; contact: Rules }) {
  return (
    <>
      {RECIPIENTS.map((r) => {
        const e = effective(company[r], contact[r]);
        return (
          <td class="align-top">
            <RuleBadge state={e.state} />
            <div class="text-[11px] text-base-content/60 leading-tight mt-1 whitespace-nowrap">
              会社: {company[r]}
              <br />
              担当: {contact[r]}
            </div>
          </td>
        );
      })}
    </>
  );
}

function CompanyResult({ co, list, partial }: { co: Company; list: Contact[]; partial: boolean }) {
  return (
    <Card
      title={
        <a class="link link-hover" href={`${M}/companies/${co.id}`}>
          {displayName(co)}
        </a>
      }
      actions={
        <>
          <a class="btn btn-xs" href={`${M}/companies/${co.id}/edit`}>
            編集
          </a>
          <a class="btn btn-xs" href={`${M}/companies/${co.id}/rules/edit`}>
            設定を変更する
          </a>
          <a class="btn btn-xs" href={`${M}/companies/${co.id}/delete`}>
            削除
          </a>
          <a class="btn btn-xs btn-primary" href={`${M}/memos/new?companyId=${co.id}`}>
            この相手で取次メモ
          </a>
        </>
      }
    >
      <div class="text-sm flex flex-wrap gap-x-4 gap-y-1">
        <span>よみ: {co.kana}</span>
        <span>
          電話: <span class="font-mono">{co.phone}</span>
        </span>
        {co.memo && <span class="text-base-content/70">メモ: {co.memo}</span>}
      </div>
      <div class="flex flex-wrap gap-2 items-center text-sm">
        <span class="text-base-content/60">会社設定:</span>
        {RECIPIENTS.map((r) => (
          <span class="whitespace-nowrap">
            {r} <RuleBadge state={co.rules[r]} />
          </span>
        ))}
      </div>
      {list.length > 0 ? (
        <div class="overflow-x-auto">
          <table class="table table-sm">
            <thead>
              <tr>
                <th>担当者</th>
                {RECIPIENTS.map((r) => (
                  <th>{r}</th>
                ))}
                <th />
              </tr>
            </thead>
            <tbody>
              {list.map((ct) => (
                <tr>
                  <td class="align-top min-w-40">
                    <a class="link link-hover font-medium" href={`${M}/contacts/${ct.id}`}>
                      {displayName(ct)}
                    </a>
                    <div class="text-xs text-base-content/60">{ct.kana}</div>
                    <div class="text-xs font-mono">{ct.phone}</div>
                    {ct.memo && <div class="text-xs text-base-content/70">{ct.memo}</div>}
                  </td>
                  <ContactRuleCells company={co.rules} contact={ct.rules} />
                  <td class="align-top">
                    <a class="btn btn-xs btn-primary whitespace-nowrap" href={`${M}/memos/new?contactId=${ct.id}`}>
                      取次メモ
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p class="text-sm text-base-content/60">担当者は登録されていません</p>
      )}
      {partial && (
        <a class="link link-primary text-sm" href={`${M}/companies/${co.id}`}>
          この会社の担当者をすべて表示
        </a>
      )}
      <AuditInfo a={co} />
    </Card>
  );
}

mock.get("/search", (c) => {
  const q = c.req.query("q");
  const error = q === undefined ? null : validateQuery(q);
  const results = q !== undefined && !error ? search(q) : null;

  return c.html(
    <MockLayout title="検索">
      <Card>
        <form method="get" action={`${M}/search`} class="flex flex-col sm:flex-row gap-2">
          <input
            name="q"
            value={q ?? ""}
            class={`input input-bordered w-full ${error ? "input-error" : ""}`}
            placeholder="電話番号・会社名・氏名・よみがな"
            autofocus
          />
          <button type="submit" class="btn btn-primary">
            検索
          </button>
        </form>
        {error && <p class="text-error text-sm">{error}</p>}
        <div class="flex flex-wrap gap-2 text-sm">
          <a class="btn btn-sm btn-outline" href={`${M}/companies/new`}>
            会社を新規登録
          </a>
          <a class="btn btn-sm btn-outline" href={`${M}/contacts/new`}>
            担当者を新規登録
          </a>
        </div>
      </Card>

      {results && results.length === 0 && (
        <Card>
          <p>該当する会社・担当者はありません</p>
          <div class="flex flex-wrap gap-2">
            <a class="btn btn-primary btn-sm" href={`${M}/companies/new?q=${encodeURIComponent(q ?? "")}`}>
              「{q}」で会社を新規登録
            </a>
            <a class="btn btn-sm" href={`${M}/memos/new`}>
              未登録の相手として取次メモを作成
            </a>
          </div>
        </Card>
      )}

      {results && results.length > 0 && (
        <>
          <p class="text-sm text-base-content/70">{results.length}社 見つかりました</p>
          {results.map((r) => (
            <CompanyResult co={r.co} list={r.list} partial={r.partial} />
          ))}
          <Pager />
        </>
      )}
    </MockLayout>,
  );
});

const Pager = () => (
  <div class="join flex justify-center">
    <button type="button" class="join-item btn btn-sm" disabled>
      «
    </button>
    <button type="button" class="join-item btn btn-sm btn-active">
      1
    </button>
    <button type="button" class="join-item btn btn-sm">
      2
    </button>
    <button type="button" class="join-item btn btn-sm">
      »
    </button>
  </div>
);

// ---------------------------------------------------------------- S-02 会社詳細
mock.get("/companies/:id{[0-9]+}", (c) => {
  const co = findCompany(Number(c.req.param("id")));
  if (!co) return c.html(<NotFound />, 404);
  const list = contactsOf(co.id);
  return c.html(
    <MockLayout title={`会社詳細: ${displayName(co)}`}>
      <Card
        title="会社情報"
        actions={
          <>
            <a class="btn btn-sm" href={`${M}/companies/${co.id}/edit`}>
              編集
            </a>
            <a class="btn btn-sm btn-error btn-outline" href={`${M}/companies/${co.id}/delete`}>
              削除
            </a>
            <a class="btn btn-sm btn-primary" href={`${M}/memos/new?companyId=${co.id}`}>
              この相手で取次メモ
            </a>
          </>
        }
      >
        <dl class="grid grid-cols-[7rem_1fr] gap-y-2 text-sm">
          <dt class="text-base-content/60">会社名</dt>
          <dd>{co.name || <span class="text-base-content/40">（未入力）</span>}</dd>
          <dt class="text-base-content/60">よみがな</dt>
          <dd>{co.kana}</dd>
          <dt class="text-base-content/60">電話番号</dt>
          <dd class="font-mono">{co.phone}</dd>
          <dt class="text-base-content/60">メモ</dt>
          <dd class="whitespace-pre-wrap">{co.memo || "-"}</dd>
        </dl>
        <AuditInfo a={co} />
      </Card>

      <Card
        title="会社単位のつなぐ設定"
        actions={
          <a class="btn btn-sm" href={`${M}/companies/${co.id}/rules/edit`}>
            設定を変更する
          </a>
        }
      >
        <RuleMatrix company={co.rules} />
      </Card>

      <Card
        title={`所属担当者（${list.length}人）`}
        actions={
          <a class="btn btn-sm" href={`${M}/contacts/new?companyId=${co.id}`}>
            担当者を追加
          </a>
        }
      >
        {list.length === 0 ? (
          <p class="text-sm text-base-content/60">担当者は登録されていません</p>
        ) : (
          <div class="overflow-x-auto">
            <table class="table table-sm">
              <thead>
                <tr>
                  <th>担当者</th>
                  {RECIPIENTS.map((r) => (
                    <th>{r}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {list.map((ct) => (
                  <tr>
                    <td class="align-top min-w-40">
                      <a class="link link-hover font-medium" href={`${M}/contacts/${ct.id}`}>
                        {displayName(ct)}
                      </a>
                      <div class="text-xs text-base-content/60">{ct.kana}</div>
                      <div class="text-xs font-mono">{ct.phone}</div>
                    </td>
                    <ContactRuleCells company={co.rules} contact={ct.rules} />
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </MockLayout>,
  );
});

// ---------------------------------------------------------------- S-03 担当者詳細
mock.get("/contacts/:id{[0-9]+}", (c) => {
  const ct = findContact(Number(c.req.param("id")));
  const co = ct && findCompany(ct.companyId);
  if (!ct || !co) return c.html(<NotFound />, 404);
  return c.html(
    <MockLayout title={`担当者詳細: ${displayName(ct)}`}>
      <div class="text-sm breadcrumbs">
        <ul>
          <li>
            <a href={`${M}/companies/${co.id}`}>{displayName(co)}</a>
          </li>
          <li>{displayName(ct)}</li>
        </ul>
      </div>
      <Card
        title="取次可否"
        actions={
          <>
            <a class="btn btn-sm" href={`${M}/contacts/${ct.id}/rules/edit`}>
              担当者の設定を変更する
            </a>
            <a class="btn btn-sm btn-primary" href={`${M}/memos/new?contactId=${ct.id}`}>
              この相手で取次メモ
            </a>
          </>
        }
      >
        <p class="text-xs text-base-content/60">
          実効判定は担当者設定を優先し、担当者設定が未設定のときは会社設定を使います。
        </p>
        <RuleMatrix company={co.rules} contact={ct.rules} />
      </Card>
      <Card
        title="担当者情報"
        actions={
          <>
            <a class="btn btn-sm" href={`${M}/contacts/${ct.id}/edit`}>
              編集
            </a>
            <a class="btn btn-sm btn-error btn-outline" href={`${M}/contacts/${ct.id}/delete`}>
              削除
            </a>
          </>
        }
      >
        <dl class="grid grid-cols-[7rem_1fr] gap-y-2 text-sm">
          <dt class="text-base-content/60">所属会社</dt>
          <dd>
            <a class="link" href={`${M}/companies/${co.id}`}>
              {displayName(co)}
            </a>
          </dd>
          <dt class="text-base-content/60">氏名</dt>
          <dd>{ct.name || <span class="text-base-content/40">（未入力）</span>}</dd>
          <dt class="text-base-content/60">よみがな</dt>
          <dd>{ct.kana}</dd>
          <dt class="text-base-content/60">電話番号</dt>
          <dd class="font-mono">{ct.phone}</dd>
          <dt class="text-base-content/60">メモ</dt>
          <dd class="whitespace-pre-wrap">{ct.memo || "-"}</dd>
        </dl>
        <AuditInfo a={ct} />
      </Card>
    </MockLayout>,
  );
});

// ---------------------------------------------------------------- S-04 会社の登録/編集
const ConflictAlert = () => (
  <div class="alert alert-error text-sm">他の人が先に更新しました。画面を読み込み直してください</div>
);

function companyForm(c: { req: { query: (k: string) => string | undefined } }, co?: Company) {
  const error = c.req.query("error") === "1";
  const dup = c.req.query("dup") === "1";
  const conflict = c.req.query("conflict") === "1";
  const q = c.req.query("q") ?? "";
  const qIsPhone = /^[\d\-\s０-９]+$/.test(q);
  const back = co ? `${M}/companies/${co.id}` : `${M}/search`;
  return (
    <MockLayout title={co ? `会社の編集: ${displayName(co)}` : "会社の新規登録"}>
      {conflict && <ConflictAlert />}
      {dup && (
        <div class="alert alert-warning text-sm flex-col items-start">
          <p>同じ会社名またはよみがなの会社が登録済みです。</p>
          <ul class="list-disc ml-5">
            <li>
              <a class="link" href={`${M}/companies/1`}>
                株式会社ミライ商事（みらいしょうじ / 0300000001）
              </a>
            </li>
          </ul>
          <label class="label cursor-pointer gap-2">
            <input type="checkbox" class="checkbox checkbox-sm" />
            <span class="label-text">別の会社として登録する</span>
          </label>
        </div>
      )}
      <Card>
        <form class="space-y-1">
          <Field label="会社名" hint="任意・100文字以内（空の場合はよみがなを表示名にします）">
            <input class="input input-bordered" value={co?.name ?? (dup ? "株式会社ミライ商事" : !qIsPhone ? q : "")} />
          </Field>
          <Field
            label="会社名よみがな"
            required
            hint={KANA_HINT}
            error={error ? "よみがなを入力してください" : undefined}
          >
            <input
              class={`input input-bordered ${error ? "input-error" : ""}`}
              value={co?.kana ?? (dup ? "みらいしょうじ" : "")}
            />
          </Field>
          <Field
            label="電話番号"
            required
            hint={PHONE_HINT}
            error={error ? "電話番号は半角数字のみ(ハイフンなし)で入力してください" : undefined}
          >
            <input
              class={`input input-bordered font-mono ${error ? "input-error" : ""}`}
              inputmode="numeric"
              value={co?.phone ?? (error ? "03-0000-0010" : qIsPhone ? q : "")}
            />
          </Field>
          <Field label="メモ" hint="任意・1,000文字以内">
            <textarea class="textarea textarea-bordered h-24">{co?.memo ?? ""}</textarea>
          </Field>
          <div class="flex gap-2 pt-3">
            <a class="btn btn-primary" href={co ? `${M}/companies/${co.id}` : `${M}/companies/1`}>
              {co ? "保存する" : "登録する"}
            </a>
            <a class="btn btn-ghost" href={back}>
              キャンセル
            </a>
          </div>
        </form>
        {co && <AuditInfo a={co} />}
      </Card>
    </MockLayout>
  );
}

mock.get("/companies/new", (c) => c.html(companyForm(c)));
mock.get("/companies/:id{[0-9]+}/edit", (c) => {
  const co = findCompany(Number(c.req.param("id")));
  return co ? c.html(companyForm(c, co)) : c.html(<NotFound />, 404);
});

// ---------------------------------------------------------------- S-04 担当者の登録/編集
function contactForm(companyId: number | undefined, ct?: Contact) {
  const selected = ct?.companyId ?? companyId;
  return (
    <MockLayout title={ct ? `担当者の編集: ${displayName(ct)}` : "担当者の新規登録"}>
      <Card>
        <form class="space-y-1">
          <Field label="所属会社" required hint={ct ? "変更すると保存前に確認画面を表示します" : "有効な会社を1つ選択"}>
            <select class="select select-bordered">
              <option value="" disabled selected={selected === undefined}>
                選択してください
              </option>
              {companies.map((co) => (
                <option value={String(co.id)} selected={co.id === selected}>
                  {displayName(co)}（{co.kana} / {co.phone}）
                </option>
              ))}
            </select>
          </Field>
          <Field label="氏名" hint="任意・50文字以内（空の場合はよみがなを表示名にします）">
            <input class="input input-bordered" value={ct?.name ?? ""} />
          </Field>
          <Field label="氏名よみがな" required hint={KANA_HINT}>
            <input class="input input-bordered" value={ct?.kana ?? ""} />
          </Field>
          <Field label="電話番号" required hint={PHONE_HINT}>
            <input class="input input-bordered font-mono" inputmode="numeric" value={ct?.phone ?? ""} />
          </Field>
          <Field label="メモ" hint="任意・1,000文字以内">
            <textarea class="textarea textarea-bordered h-24">{ct?.memo ?? ""}</textarea>
          </Field>
          <div class="flex flex-wrap gap-2 pt-3">
            <a class="btn btn-primary" href={ct ? `${M}/contacts/${ct.id}` : `${M}/contacts/1`}>
              {ct ? "保存する" : "登録する"}
            </a>
            {ct && (
              <a class="btn btn-outline" href={`${M}/contacts/${ct.id}/move-confirm`}>
                （所属会社を変更した場合の確認画面）
              </a>
            )}
            <a class="btn btn-ghost" href={ct ? `${M}/contacts/${ct.id}` : `${M}/search`}>
              キャンセル
            </a>
          </div>
        </form>
        {ct && <AuditInfo a={ct} />}
      </Card>
    </MockLayout>
  );
}

mock.get("/contacts/new", (c) => {
  const id = c.req.query("companyId");
  return c.html(contactForm(id ? Number(id) : undefined));
});
mock.get("/contacts/:id{[0-9]+}/edit", (c) => {
  const ct = findContact(Number(c.req.param("id")));
  return ct ? c.html(contactForm(undefined, ct)) : c.html(<NotFound />, 404);
});

mock.get("/contacts/:id{[0-9]+}/move-confirm", (c) => {
  const ct = findContact(Number(c.req.param("id")));
  const from = ct && findCompany(ct.companyId);
  const to = companies.find((x) => x.id !== from?.id);
  if (!ct || !from || !to) return c.html(<NotFound />, 404);
  return c.html(
    <MockLayout title="所属会社の変更の確認">
      <Card>
        <p>
          担当者「<strong>{displayName(ct)}</strong>」の所属会社を変更します。
        </p>
        <div class="flex flex-wrap items-center gap-3 text-lg">
          <span class="badge badge-lg badge-outline">{displayName(from)}</span>
          <span>→</span>
          <span class="badge badge-lg badge-primary">{displayName(to)}</span>
        </div>
        <p class="text-sm text-base-content/70">
          担当者のつなぐ/つながない設定はそのまま引き継がれます。実効判定は変更先の会社設定で再計算されます。
        </p>
        <div class="flex gap-2">
          <a class="btn btn-primary" href={`${M}/contacts/${ct.id}`}>
            変更を確定する
          </a>
          <a class="btn btn-ghost" href={`${M}/contacts/${ct.id}/edit`}>
            キャンセル
          </a>
        </div>
      </Card>
    </MockLayout>,
  );
});

// ---------------------------------------------------------------- S-05 つなぐ設定の変更
type Target = { kind: "companies" | "contacts"; id: number; label: string; rules: Rules; companyRules?: Rules };

function resolveTarget(kind: string, id: number): Target | null {
  if (kind === "companies") {
    const co = findCompany(id);
    return co ? { kind, id, label: `会社「${displayName(co)}」`, rules: co.rules } : null;
  }
  const ct = findContact(id);
  const co = ct && findCompany(ct.companyId);
  return ct && co
    ? {
        kind: "contacts",
        id,
        label: `担当者「${displayName(co)} ${displayName(ct)}」`,
        rules: ct.rules,
        companyRules: co.rules,
      }
    : null;
}

mock.get("/:kind{companies|contacts}/:id{[0-9]+}/rules/edit", (c) => {
  const t = resolveTarget(c.req.param("kind"), Number(c.req.param("id")));
  if (!t) return c.html(<NotFound />, 404);
  return c.html(
    <MockLayout title="つなぐ設定の変更">
      <Card title={t.label}>
        <p class="text-sm text-base-content/70">変更する取次先の設定を選び、「確認へ進む」を押してください。</p>
        <form method="get" action={`${M}/${t.kind}/${t.id}/rules/confirm`}>
          <div class="overflow-x-auto">
            <table class="table">
              <thead>
                <tr>
                  <th>取次先</th>
                  <th>現在</th>
                  <th>変更後</th>
                  {t.companyRules && <th>（参考）会社設定</th>}
                </tr>
              </thead>
              <tbody>
                {RECIPIENTS.map((r) => (
                  <tr>
                    <th>{r}</th>
                    <td>
                      <RuleBadge state={t.rules[r]} />
                    </td>
                    <td>
                      <div class="join">
                        {RULE_STATES.map((s) => (
                          <input
                            type="radio"
                            name={r}
                            value={s}
                            aria-label={s}
                            checked={t.rules[r] === s}
                            class="join-item btn btn-sm"
                          />
                        ))}
                      </div>
                    </td>
                    {t.companyRules && (
                      <td>
                        <RuleBadge state={t.companyRules[r]} />
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div class="flex gap-2 pt-3">
            <button type="submit" class="btn btn-primary">
              確認へ進む
            </button>
            <a class="btn btn-ghost" href={`${M}/${t.kind}/${t.id}`}>
              キャンセル
            </a>
          </div>
        </form>
      </Card>
    </MockLayout>,
  );
});

mock.get("/:kind{companies|contacts}/:id{[0-9]+}/rules/confirm", (c) => {
  const t = resolveTarget(c.req.param("kind"), Number(c.req.param("id")));
  if (!t) return c.html(<NotFound />, 404);
  // 日本語のキーは c.req.query(key) で引けないため、デコード済みの全体を使う
  const query = c.req.query();
  const changes = RECIPIENTS.map((r) => {
    const v = query[r] as RuleState | undefined;
    return { r, before: t.rules[r], after: v && RULE_STATES.includes(v) ? v : t.rules[r] };
  }).filter((x) => x.before !== x.after);
  const affected = (r: Recipient) =>
    t.kind === "companies" ? contactsOf(t.id).filter((ct) => ct.rules[r] === "未設定").length : 0;

  return c.html(
    <MockLayout title="つなぐ設定の変更の確認">
      <Card title={t.label}>
        {changes.length === 0 ? (
          <div class="alert">変更はありません。</div>
        ) : (
          <>
            <p>以下の内容で保存します。よろしいですか？</p>
            <div class="overflow-x-auto">
              <table class="table">
                <thead>
                  <tr>
                    <th>取次先</th>
                    <th>変更前</th>
                    <th />
                    <th>変更後</th>
                    {t.kind === "companies" && <th>影響範囲</th>}
                  </tr>
                </thead>
                <tbody>
                  {changes.map((x) => (
                    <tr>
                      <th>{x.r}</th>
                      <td>
                        <RuleBadge state={x.before} />
                      </td>
                      <td>→</td>
                      <td>
                        <RuleBadge state={x.after} />
                      </td>
                      {t.kind === "companies" && <td class="text-sm">実効判定が変わる担当者: {affected(x.r)}人</td>}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
        <div class="flex gap-2">
          {changes.length > 0 && (
            <a class="btn btn-primary" href={`${M}/${t.kind}/${t.id}`}>
              確定する
            </a>
          )}
          <a class="btn btn-ghost" href={`${M}/${t.kind}/${t.id}/rules/edit`}>
            戻る
          </a>
          <a class="btn btn-ghost" href={`${M}/${t.kind}/${t.id}`}>
            キャンセル
          </a>
        </div>
      </Card>
    </MockLayout>,
  );
});

// ---------------------------------------------------------------- S-06 削除の確認
mock.get("/:kind{companies|contacts}/:id{[0-9]+}/delete", (c) => {
  const kind = c.req.param("kind");
  const id = Number(c.req.param("id"));
  const target = kind === "companies" ? findCompany(id) : findContact(id);
  if (!target) return c.html(<NotFound />, 404);
  const name = displayName(target);
  const children = kind === "companies" ? contactsOf(id) : [];
  return c.html(
    <MockLayout title="削除の確認">
      <Card>
        <div class="alert alert-warning text-sm flex-col items-start">
          <p>
            {kind === "companies" ? "会社" : "担当者"}「<strong>{name}</strong>」を削除します。
          </p>
          {children.length > 0 && <p>所属する担当者 {children.length}人 も同時に削除されます。</p>}
          <p>削除したデータは画面から元に戻せません。</p>
        </div>
        <Field label={`確認のため「${name}」と入力してください`} hint="空白・全角半角の違いは無視します">
          <input class="input input-bordered" placeholder={name} />
        </Field>
        <div class="flex gap-2">
          <button type="button" class="btn btn-error" disabled>
            削除する
          </button>
          <a class="btn btn-ghost" href={`${M}/${kind}/${id}`}>
            キャンセル
          </a>
        </div>
        <p class="text-xs text-base-content/50">※ 対象名が一致するまで「削除する」は押せません（モックでは常に無効）</p>
      </Card>
    </MockLayout>,
  );
});

// ---------------------------------------------------------------- S-07 取次メモ一覧
mock.get("/memos", (c) => {
  const to = c.req.query("to") ?? MOCK_USER.recipient;
  const status = c.req.query("status") ?? "open";
  const empty = c.req.query("empty") === "1";
  const list = empty
    ? []
    : memos
        .filter((m) => to === "all" || m.to === to)
        .filter((m) => status === "all" || (status === "open" ? !m.done : m.done))
        .sort((a, b) => b.receivedAt.localeCompare(a.receivedAt));

  return c.html(
    <MockLayout title="取次メモ一覧">
      <Card>
        <form method="get" action={`${M}/memos`} class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2 items-end">
          <Field label="宛先">
            <select name="to" class="select select-bordered select-sm">
              <option value="all" selected={to === "all"}>
                すべての宛先
              </option>
              {RECIPIENTS.map((r) => (
                <option value={r} selected={to === r}>
                  {r}
                  {r === MOCK_USER.recipient ? "（自分）" : ""}
                </option>
              ))}
            </select>
          </Field>
          <Field label="対処状況">
            <select name="status" class="select select-bordered select-sm">
              <option value="open" selected={status === "open"}>
                未対処のみ
              </option>
              <option value="done" selected={status === "done"}>
                対処済みのみ
              </option>
              <option value="all" selected={status === "all"}>
                すべて
              </option>
            </select>
          </Field>
          <Field label="用件">
            <select name="purpose" class="select select-bordered select-sm">
              <option value="">すべて</option>
              {PURPOSES.map((p) => (
                <option>{p}</option>
              ))}
            </select>
          </Field>
          <Field label="キーワード">
            <input name="kw" class="input input-bordered input-sm" placeholder="相手・伝言・メモ" />
          </Field>
          <button type="submit" class="btn btn-sm btn-primary">
            絞り込む
          </button>
        </form>
      </Card>

      {list.length === 0 ? (
        <Card>
          <p class="text-center text-base-content/60 py-6">
            {status === "open" ? "未対処の取次メモはありません" : "取次メモはありません"}
          </p>
        </Card>
      ) : (
        <div class="space-y-2">
          {list.map((m) => (
            <section class={`card bg-base-100 shadow-sm ${m.done ? "opacity-60" : ""}`}>
              <div class="card-body p-4 gap-2">
                <div class="flex flex-wrap justify-between gap-2">
                  <div class="flex flex-wrap items-center gap-2">
                    <span class="font-mono text-sm">{m.receivedAt}</span>
                    <span class="badge badge-outline">宛先: {m.to}</span>
                    <span class={`badge ${m.purpose === "折り返し希望" ? "badge-warning" : "badge-info"}`}>
                      {m.purpose}
                    </span>
                    {!m.registered && <span class="badge badge-ghost">未登録の相手</span>}
                  </div>
                  <div class="flex gap-1">
                    <a class="btn btn-xs" href={`${M}/memos/${m.id}/edit`}>
                      編集
                    </a>
                    {m.done ? (
                      <button type="button" class="btn btn-xs btn-outline">
                        未対処に戻す
                      </button>
                    ) : (
                      <button type="button" class="btn btn-xs btn-success">
                        対処済みにする
                      </button>
                    )}
                  </div>
                </div>
                <div class="text-sm">
                  <span class="font-medium">{[m.companyName, m.contactName].filter(Boolean).join(" ") || "-"}</span>
                  {m.phone && <span class="font-mono ml-3">{m.phone}</span>}
                </div>
                {m.message && <p class="text-sm whitespace-pre-wrap">伝言: {m.message}</p>}
                {m.note && <p class="text-sm text-base-content/70 whitespace-pre-wrap">メモ: {m.note}</p>}
                <AuditInfo a={m} />
              </div>
            </section>
          ))}
          <Pager />
        </div>
      )}
    </MockLayout>,
  );
});

// ---------------------------------------------------------------- S-08 取次メモの登録/編集
function nowJst() {
  const d = new Date(Date.now() + 9 * 3600_000);
  return d.toISOString().slice(0, 16);
}

mock.get("/memos/new", (c) => {
  const ct = findContact(Number(c.req.query("contactId")));
  const co = ct ? findCompany(ct.companyId) : findCompany(Number(c.req.query("companyId")));
  return c.html(
    memoForm({
      error: c.req.query("error") === "1",
      companyName: co ? displayName(co) : "",
      contactName: ct ? displayName(ct) : "",
      phone: ct?.phone ?? co?.phone ?? "",
      selected: ct ? `${displayName(co ?? { name: "", kana: "" })} ${displayName(ct)}` : co ? displayName(co) : "",
    }),
  );
});

mock.get("/memos/:id{[0-9]+}/edit", (c) => {
  const m = memos.find((x) => x.id === Number(c.req.param("id")));
  if (!m) return c.html(<NotFound />, 404);
  return c.html(memoForm({ memo: m, companyName: m.companyName, contactName: m.contactName, phone: m.phone }));
});

type MemoFormProps = {
  memo?: (typeof memos)[number];
  error?: boolean;
  companyName: string;
  contactName: string;
  phone: string;
  selected?: string;
};

function memoForm({ memo, error, companyName, contactName, phone, selected }: MemoFormProps) {
  const purpose = memo?.purpose ?? (error ? "折り返し希望" : undefined);
  const to = memo?.to;
  return (
    <MockLayout title={memo ? "取次メモの編集" : "取次メモの作成"}>
      {error && <div class="alert alert-error text-sm">入力内容を確認してください</div>}
      <Card title="相手">
        {selected ? (
          <div class="alert alert-success text-sm">
            <span>
              登録済みの相手「<strong>{selected}</strong>」を選択中
            </span>
            <a class="btn btn-xs" href={`${M}/memos/new`}>
              選択を解除
            </a>
          </div>
        ) : (
          !memo && (
            <div class="space-y-2">
              <div class="flex gap-2">
                <input
                  class="input input-bordered input-sm w-full"
                  placeholder="電話番号・会社名・氏名で登録済みの相手を探す"
                  value="0900000000"
                />
                <button type="button" class="btn btn-sm">
                  候補を探す
                </button>
              </div>
              <ul class="menu menu-sm bg-base-200 rounded-box">
                <li class="menu-title">候補（自動選択はしません）</li>
                {contacts.slice(0, 2).map((ct) => {
                  const co = findCompany(ct.companyId);
                  return (
                    <li>
                      <a href={`${M}/memos/new?contactId=${ct.id}`}>
                        {co && displayName(co)} {displayName(ct)}
                        <span class="font-mono text-xs">{ct.phone}</span>
                      </a>
                    </li>
                  );
                })}
              </ul>
              <p class="text-xs text-base-content/60">候補を選ばない場合は、未登録の相手として下の欄に手入力します。</p>
            </div>
          )
        )}
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-x-3">
          <Field label="会社名" hint="100文字以内">
            <input class="input input-bordered" value={companyName} />
          </Field>
          <Field label="氏名" hint="50文字以内">
            <input class="input input-bordered" value={contactName} />
          </Field>
          <Field
            label="電話番号"
            hint={`折り返し希望のとき必須・${PHONE_HINT}`}
            error={error ? "電話番号を入力してください" : undefined}
          >
            <input
              class={`input input-bordered font-mono ${error ? "input-error" : ""}`}
              inputmode="numeric"
              value={phone}
            />
          </Field>
        </div>
        <p class="text-xs text-base-content/60">会社名・氏名・電話番号のうち1つ以上を入力してください。</p>
        {memo && !memo.registered && (
          <a
            class="link link-primary text-sm"
            href={`${M}/companies/new?q=${encodeURIComponent(memo.companyName || memo.contactName)}`}
          >
            この相手を会社・担当者として登録する
          </a>
        )}
      </Card>

      <Card title="内容">
        <Field label="受電日時" required hint="初期値は画面を開いた日時（変更できます）">
          <input
            type="datetime-local"
            class="input input-bordered w-full sm:w-64"
            value={memo ? memo.receivedAt.replace(" ", "T") : nowJst()}
          />
        </Field>
        <Field label="用件" required>
          <div class="flex flex-wrap gap-4">
            {PURPOSES.map((p) => (
              <label class="label cursor-pointer gap-2 justify-start">
                <input type="radio" name="purpose" class="radio radio-sm radio-primary" checked={purpose === p} />
                <span class="label-text">{p}</span>
              </label>
            ))}
          </div>
        </Field>
        <Field label="伝言" hint="伝言希望のとき必須・1,000文字以内">
          <textarea class="textarea textarea-bordered h-20">{memo?.message ?? ""}</textarea>
        </Field>
        <Field label="メモ" hint="任意・1,000文字以内">
          <textarea class="textarea textarea-bordered h-20">{memo?.note ?? ""}</textarea>
        </Field>
        <Field label="宛先" required hint="取次先から1名を選択" error={error ? "宛先を選択してください" : undefined}>
          <div class="join">
            {RECIPIENTS.map((r) => (
              <input type="radio" name="to" aria-label={r} class="join-item btn btn-sm" checked={to === r} />
            ))}
          </div>
        </Field>
        {memo && (
          <label class="label cursor-pointer gap-2 justify-start">
            <input type="checkbox" class="checkbox checkbox-sm checkbox-success" checked={memo.done} />
            <span class="label-text">対処済み</span>
          </label>
        )}
        <div class="flex gap-2 pt-2">
          <a class="btn btn-primary" href={`${M}/memos`}>
            {memo ? "保存する" : "登録する"}
          </a>
          <a class="btn btn-ghost" href={memo ? `${M}/memos` : `${M}/search`}>
            キャンセル
          </a>
        </div>
        {memo && <AuditInfo a={memo} />}
      </Card>
    </MockLayout>
  );
}
