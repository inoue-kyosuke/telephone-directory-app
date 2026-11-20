// 画面モック用のダミーデータ（架空の会社・人物・電話番号のみ。実在データは使わない）

export const RECIPIENTS = ["社長", "菊地", "益岡", "木村"] as const;
export type Recipient = (typeof RECIPIENTS)[number];

export type RuleState = "つなぐ" | "つながない" | "未設定";
export type Rules = Record<Recipient, RuleState>;

export type Audit = {
  createdBy: string;
  createdAt: string;
  updatedBy: string;
  updatedAt: string;
};

export type Contact = Audit & {
  id: number;
  companyId: number;
  name: string;
  kana: string;
  phone: string;
  memo: string;
  rules: Rules;
};

export type Company = Audit & {
  id: number;
  name: string;
  kana: string;
  phone: string;
  memo: string;
  rules: Rules;
};

export const PURPOSES = ["折り返し希望", "連絡があったことをお伝え希望", "伝言希望"] as const;
export type Purpose = (typeof PURPOSES)[number];

export type Memo = Audit & {
  id: number;
  receivedAt: string;
  companyName: string;
  contactName: string;
  phone: string;
  purpose: Purpose;
  message: string;
  note: string;
  to: Recipient;
  done: boolean;
  registered: boolean;
};

// モックのログインユーザー（取次先「菊地」に対応する想定）
export const MOCK_USER = { email: "kikuchi@example.test", recipient: "菊地" as Recipient };

const rules = (r: Partial<Rules> = {}): Rules => ({
  社長: "未設定",
  菊地: "未設定",
  益岡: "未設定",
  木村: "未設定",
  ...r,
});

const audit = (updatedBy = "inoue@example.test", updatedAt = "2026-11-10 14:32"): Audit => ({
  createdBy: "inoue@example.test",
  createdAt: "2026-11-01 10:05",
  updatedBy,
  updatedAt,
});

export const companies: Company[] = [
  {
    id: 1,
    name: "株式会社ミライ商事",
    kana: "みらいしょうじ",
    phone: "0300000001",
    memo: "求人広告の営業が多い。社長は既存取引のため取次可。",
    rules: rules({ 社長: "つなぐ", 菊地: "つながない" }),
    ...audit("kikuchi@example.test", "2026-11-12 09:15"),
  },
  {
    id: 2,
    name: "サンプル人材株式会社",
    kana: "さんぷるじんざい",
    phone: "0300000002",
    memo: "",
    rules: rules({ 社長: "つなぐ" }),
    ...audit(),
  },
  {
    id: 3,
    name: "",
    kana: "あおばこうぎょう",
    phone: "0300000003",
    memo: "会社名の漢字表記が不明。",
    rules: rules(),
    ...audit(),
  },
  {
    id: 4,
    name: "テスト物産株式会社",
    kana: "てすとぶっさん",
    phone: "0300000004",
    memo: "",
    rules: rules({ 益岡: "つなぐ", 木村: "つなぐ" }),
    ...audit(),
  },
];

export const contacts: Contact[] = [
  {
    id: 1,
    companyId: 1,
    name: "原田 一郎",
    kana: "はらだ いちろう",
    phone: "09000000001",
    memo: "菊地さんと既存案件あり。",
    rules: rules({ 菊地: "つなぐ" }),
    ...audit("kikuchi@example.test", "2026-11-12 09:20"),
  },
  {
    id: 2,
    companyId: 1,
    name: "佐藤 花子",
    kana: "さとう はなこ",
    phone: "09000000002",
    memo: "",
    rules: rules(),
    ...audit(),
  },
  {
    id: 3,
    companyId: 2,
    name: "田中 健",
    kana: "たなか けん",
    phone: "09000000003",
    memo: "",
    rules: rules({ 社長: "つなぐ", 菊地: "つながない" }),
    ...audit(),
  },
  {
    id: 4,
    companyId: 4,
    name: "",
    kana: "やまもと",
    phone: "09000000004",
    memo: "氏名の漢字不明。",
    rules: rules({ 益岡: "つながない" }),
    ...audit(),
  },
];

export const memos: Memo[] = [
  {
    id: 1,
    receivedAt: "2026-11-13 10:42",
    companyName: "株式会社ミライ商事",
    contactName: "原田 一郎",
    phone: "09000000001",
    purpose: "折り返し希望",
    message: "",
    note: "見積もりの件。午後なら在席とのこと。",
    to: "菊地",
    done: false,
    registered: true,
  },
  {
    id: 2,
    receivedAt: "2026-11-13 09:05",
    companyName: "サンプル人材株式会社",
    contactName: "田中 健",
    phone: "",
    purpose: "連絡があったことをお伝え希望",
    message: "",
    note: "",
    to: "菊地",
    done: false,
    registered: true,
  },
  {
    id: 3,
    receivedAt: "2026-11-12 17:30",
    companyName: "",
    contactName: "鈴木",
    phone: "0600000009",
    purpose: "伝言希望",
    message: "来週の打ち合わせを木曜15時に変更したい。",
    note: "未登録の相手",
    to: "社長",
    done: false,
    registered: false,
  },
  {
    id: 4,
    receivedAt: "2026-11-12 11:12",
    companyName: "テスト物産株式会社",
    contactName: "やまもと",
    phone: "09000000004",
    purpose: "折り返し希望",
    message: "",
    note: "",
    to: "益岡",
    done: true,
    registered: true,
  },
  {
    id: 5,
    receivedAt: "2026-11-11 15:48",
    companyName: "株式会社ミライ商事",
    contactName: "",
    phone: "0300000001",
    purpose: "伝言希望",
    message: "資料を送付したので確認してほしい。",
    note: "",
    to: "菊地",
    done: true,
    registered: true,
  },
].map((m) => ({ ...m, ...audit("masuoka@example.test", m.receivedAt) }) as Memo);

export const displayName = (x: { name: string; kana: string }) => x.name || x.kana;

export const findCompany = (id: number) => companies.find((c) => c.id === id);
export const findContact = (id: number) => contacts.find((c) => c.id === id);
export const contactsOf = (companyId: number) => contacts.filter((c) => c.companyId === companyId);

// 実効判定: 担当者設定を優先し、未設定なら会社設定（仕様 5.4.3）
export function effective(company: RuleState, contact: RuleState): { state: RuleState; source: string } {
  if (contact !== "未設定") return { state: contact, source: "担当者" };
  if (company !== "未設定") return { state: company, source: "会社" };
  return { state: "未設定", source: "-" };
}

export const myOpenMemoCount = () => memos.filter((m) => m.to === MOCK_USER.recipient && !m.done).length;
