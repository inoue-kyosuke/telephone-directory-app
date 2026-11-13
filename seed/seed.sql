-- ローカル D1 用のダミーデータ（npm run db:seed:local）
-- 実データは入れないこと
INSERT INTO items (title, created_by) VALUES
  ('サンプル 1', 'dev-user@example.com'),
  ('サンプル 2', 'dev-user@example.com'),
  ('サンプル 3', 'someone@example.com');
