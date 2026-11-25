-- Migration number: 0002
-- STEP1 の共通テーブル定義（第6回で決定）。docs/db-design-step1.md 付録A のDDL案をもとにする。
-- CHECK はアプリの入力チェックの後ろにある最後の防御線。

CREATE TABLE companies (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  name          TEXT CHECK (name IS NULL OR length(name) BETWEEN 1 AND 100),
  name_kana     TEXT NOT NULL CHECK (length(name_kana) BETWEEN 1 AND 100),
  phone         TEXT CHECK (phone IS NULL OR (length(phone) BETWEEN 1 AND 15 AND phone NOT GLOB '*[^0-9]*')),
  memo          TEXT CHECK (memo IS NULL OR length(memo) <= 1000),
  name_norm     TEXT,
  kana_norm     TEXT NOT NULL,
  request_token TEXT UNIQUE,
  version       INTEGER NOT NULL DEFAULT 1,
  created_by    TEXT NOT NULL,
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  updated_by    TEXT NOT NULL,
  updated_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  deleted_at    TEXT
);

CREATE TABLE contacts (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  company_id    INTEGER NOT NULL REFERENCES companies(id),
  name          TEXT CHECK (name IS NULL OR length(name) BETWEEN 1 AND 50),
  name_kana     TEXT NOT NULL CHECK (length(name_kana) BETWEEN 1 AND 50),
  phone         TEXT NOT NULL CHECK (length(phone) BETWEEN 1 AND 15 AND phone NOT GLOB '*[^0-9]*'),
  memo          TEXT CHECK (memo IS NULL OR length(memo) <= 1000),
  name_norm     TEXT,
  kana_norm     TEXT NOT NULL,
  request_token TEXT UNIQUE,
  version       INTEGER NOT NULL DEFAULT 1,
  created_by    TEXT NOT NULL,
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  updated_by    TEXT NOT NULL,
  updated_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  deleted_at    TEXT
);

CREATE TABLE transfer_targets (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  display_name  TEXT NOT NULL,
  email         TEXT,
  sort_order    INTEGER NOT NULL DEFAULT 0,
  version       INTEGER NOT NULL DEFAULT 1,
  created_by    TEXT NOT NULL,
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  updated_by    TEXT NOT NULL,
  updated_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  deleted_at    TEXT
);

-- 取次設定: 行があるのは「つなぐ」「つながない」のときだけ。「未設定」は行なし（戻したときは物理削除）
CREATE TABLE company_transfer_settings (
  company_id    INTEGER NOT NULL REFERENCES companies(id),
  target_id     INTEGER NOT NULL REFERENCES transfer_targets(id),
  status        TEXT NOT NULL CHECK (status IN ('connect', 'block')),
  created_by    TEXT NOT NULL,
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  updated_by    TEXT NOT NULL,
  updated_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  PRIMARY KEY (company_id, target_id)
);

CREATE TABLE contact_transfer_settings (
  contact_id    INTEGER NOT NULL REFERENCES contacts(id),
  target_id     INTEGER NOT NULL REFERENCES transfer_targets(id),
  status        TEXT NOT NULL CHECK (status IN ('connect', 'block')),
  created_by    TEXT NOT NULL,
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  updated_by    TEXT NOT NULL,
  updated_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  PRIMARY KEY (contact_id, target_id)
);

CREATE TABLE call_memos (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  caller_company_name TEXT CHECK (caller_company_name IS NULL OR length(caller_company_name) BETWEEN 1 AND 100),
  caller_name         TEXT CHECK (caller_name IS NULL OR length(caller_name) BETWEEN 1 AND 50),
  caller_phone        TEXT CHECK (caller_phone IS NULL OR (length(caller_phone) BETWEEN 1 AND 15 AND caller_phone NOT GLOB '*[^0-9]*')),
  received_at         TEXT NOT NULL,
  purpose             TEXT NOT NULL CHECK (purpose IN ('callback', 'notify', 'message')),
  message             TEXT CHECK (message IS NULL OR length(message) BETWEEN 1 AND 1000),
  memo                TEXT CHECK (memo IS NULL OR length(memo) <= 1000),
  addressee_id        INTEGER NOT NULL REFERENCES transfer_targets(id),
  linked_contact_id   INTEGER REFERENCES contacts(id),
  linked_company_id   INTEGER REFERENCES companies(id),
  handled_at          TEXT,
  handled_by          TEXT,
  request_token       TEXT UNIQUE,
  version             INTEGER NOT NULL DEFAULT 1,
  created_by          TEXT NOT NULL,
  created_at          TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  updated_by          TEXT NOT NULL,
  updated_at          TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  deleted_at          TEXT,
  CHECK (caller_company_name IS NOT NULL OR caller_name IS NOT NULL OR caller_phone IS NOT NULL),
  CHECK (purpose <> 'callback' OR caller_phone IS NOT NULL),
  CHECK (purpose <> 'message' OR message IS NOT NULL),
  CHECK (linked_contact_id IS NULL OR linked_company_id IS NULL),
  CHECK ((handled_at IS NULL) = (handled_by IS NULL))
);

-- インデックス
CREATE INDEX idx_companies_kana   ON companies (kana_norm) WHERE deleted_at IS NULL;
CREATE INDEX idx_companies_phone  ON companies (phone)     WHERE deleted_at IS NULL;
CREATE INDEX idx_contacts_company ON contacts (company_id, kana_norm) WHERE deleted_at IS NULL;
CREATE INDEX idx_contacts_phone   ON contacts (phone)      WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX uq_transfer_targets_email
  ON transfer_targets (email COLLATE NOCASE)
  WHERE deleted_at IS NULL AND email IS NOT NULL;
CREATE INDEX idx_company_settings_target ON company_transfer_settings (target_id);
CREATE INDEX idx_contact_settings_target ON contact_transfer_settings (target_id);
CREATE INDEX idx_memos_unhandled ON call_memos (addressee_id, received_at DESC)
  WHERE deleted_at IS NULL AND handled_at IS NULL;
CREATE INDEX idx_memos_received  ON call_memos (received_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX idx_memos_linked_contact ON call_memos (linked_contact_id);
CREATE INDEX idx_memos_linked_company ON call_memos (linked_company_id);

-- 取次先の初期データ（メールアドレスは開発用ダミー。本番の値はDB直接で設定する）
INSERT INTO transfer_targets (display_name, email, sort_order, created_by, updated_by) VALUES
  ('社長', NULL,                   1, 'system', 'system'),
  ('菊地', 'kikuchi@example.test', 2, 'system', 'system'),
  ('益岡', 'masuoka@example.test', 3, 'system', 'system'),
  ('木村', 'kimura@example.test',  4, 'system', 'system');
