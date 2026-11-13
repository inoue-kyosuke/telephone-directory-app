// 画面モック用の共通レイアウトと部品（Tailwind CSS + daisyUI を CDN から読み込む）

import { raw } from "hono/html";
import type { Child } from "hono/jsx";
import { type Audit, effective, MOCK_USER, myOpenMemoCount, RECIPIENTS, type RuleState, type Rules } from "./data.ts";

export const M = "/mock";

type LayoutProps = { title: string; children: Child };

export function MockLayout({ title, children }: LayoutProps) {
  const count = myOpenMemoCount();
  return (
    <>
      {raw("<!DOCTYPE html>")}
      <html lang="ja" data-theme="corporate">
        <head>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <title>{title} | 電話取次（モック）</title>
          <link href="https://cdn.jsdelivr.net/npm/daisyui@4.12.24/dist/full.min.css" rel="stylesheet" />
          <script src="https://cdn.tailwindcss.com/3.4.17" />
        </head>
        <body class="min-h-screen bg-base-200">
          <div class="bg-warning text-warning-content text-center text-xs py-1">
            画面モック（動作なし・ダミーデータ） ―{" "}
            <a class="link" href={M}>
              画面一覧
            </a>
          </div>
          <div class="navbar bg-base-100 shadow-sm px-4 gap-2 flex-wrap">
            <div class="flex-1">
              <a href={`${M}/search`} class="text-lg font-bold">
                電話取次
              </a>
            </div>
            <div class="flex gap-1 flex-wrap items-center">
              <a href={`${M}/memos`} class="btn btn-sm btn-ghost">
                自分宛て未対処
                <span class="badge badge-error badge-sm">{count}</span>
              </a>
              <a href={`${M}/search`} class="btn btn-sm btn-ghost">
                検索
              </a>
              <a href={`${M}/memos`} class="btn btn-sm btn-ghost">
                取次メモ一覧
              </a>
              <a href={`${M}/memos/new`} class="btn btn-sm btn-primary">
                取次メモを作成
              </a>
              <span class="text-xs text-base-content/60 ml-2">{MOCK_USER.email}</span>
            </div>
          </div>
          <main class="max-w-5xl mx-auto p-4 space-y-4">
            <h1 class="text-xl font-bold">{title}</h1>
            {children}
          </main>
        </body>
      </html>
    </>
  );
}

const BADGE: Record<RuleState, string> = {
  つなぐ: "badge-success",
  つながない: "badge-error",
  未設定: "badge-ghost",
};

export function RuleBadge({ state }: { state: RuleState }) {
  return <span class={`badge ${BADGE[state]} whitespace-nowrap`}>{state}</span>;
}

// 取次先4名 × 会社設定・担当者設定・実効判定の表（参照のみ。変更コントロールは置かない）
export function RuleMatrix({ company, contact }: { company: Rules; contact?: Rules }) {
  return (
    <div class="overflow-x-auto">
      <table class="table table-sm">
        <thead>
          <tr>
            <th>取次先</th>
            {contact && <th>実効判定</th>}
            <th>会社設定</th>
            {contact && <th>担当者設定</th>}
          </tr>
        </thead>
        <tbody>
          {RECIPIENTS.map((r) => {
            const e = contact ? effective(company[r], contact[r]) : undefined;
            return (
              <tr>
                <th>{r}</th>
                {e && (
                  <td>
                    <RuleBadge state={e.state} />
                    <span class="text-xs text-base-content/60 ml-1">（設定元: {e.source}）</span>
                  </td>
                )}
                <td>
                  <RuleBadge state={company[r]} />
                </td>
                {contact && (
                  <td>
                    <RuleBadge state={contact[r]} />
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function AuditInfo({ a }: { a: Audit }) {
  return (
    <p class="text-xs text-base-content/60">
      作成: {a.createdBy} {a.createdAt} ／ 更新: {a.updatedBy} {a.updatedAt}
    </p>
  );
}

export function Card({ title, actions, children }: { title?: Child; actions?: Child; children: Child }) {
  return (
    <section class="card bg-base-100 shadow-sm">
      <div class="card-body p-4 gap-3">
        {(title || actions) && (
          <div class="flex flex-wrap justify-between items-center gap-2">
            <h2 class="card-title text-base">{title}</h2>
            <div class="flex flex-wrap gap-1">{actions}</div>
          </div>
        )}
        {children}
      </div>
    </section>
  );
}

type FieldProps = {
  label: string;
  required?: boolean;
  hint?: string;
  error?: string;
  children: Child;
};

export function Field({ label, required, hint, error, children }: FieldProps) {
  return (
    <div class="form-control w-full">
      <div class="label pb-1">
        <span class="label-text font-medium">
          {label}
          {required && <span class="badge badge-error badge-xs ml-2 align-middle">必須</span>}
        </span>
      </div>
      {children}
      {(hint || error) && (
        <div class="label pt-1">
          {error ? (
            <span class="label-text-alt text-error">{error}</span>
          ) : (
            <span class="label-text-alt text-base-content/60">{hint}</span>
          )}
        </div>
      )}
    </div>
  );
}

export const PHONE_HINT = "半角数字のみ（ハイフンなし）・15桁以内";
export const KANA_HINT = "ひらがな・カタカナ（カタカナはひらがなで保存）";
