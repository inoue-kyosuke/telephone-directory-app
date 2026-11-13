import { raw } from "hono/html";
import type { Child } from "hono/jsx";

type Props = {
  title: string;
  userEmail: string;
  children: Child;
};

export function Layout({ title, userEmail, children }: Props) {
  return (
    <>
      {raw("<!DOCTYPE html>")}
      <html lang="ja">
        <head>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <title>{title}</title>
          <style>{`
          body { font-family: system-ui, sans-serif; max-width: 720px; margin: 2rem auto; padding: 0 1rem; color: #222; }
          header { display: flex; justify-content: space-between; align-items: baseline; border-bottom: 1px solid #ddd; margin-bottom: 1.5rem; }
          header small { color: #666; }
          form.inline { display: inline; }
          ul { padding: 0; list-style: none; }
          li { display: flex; justify-content: space-between; gap: 1rem; padding: .5rem 0; border-bottom: 1px solid #eee; }
          li small { color: #666; }
          .error { color: #b00020; }
        `}</style>
        </head>
        <body>
          <header>
            <h1>{title}</h1>
            <small>{userEmail}</small>
          </header>
          <main>{children}</main>
        </body>
      </html>
    </>
  );
}
