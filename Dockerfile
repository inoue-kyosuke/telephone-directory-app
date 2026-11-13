# workerd (wrangler dev / vitest) は glibc が必要なため、Alpine ではなく Debian 系を使う
FROM node:24-bookworm-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates git \
  && rm -rf /var/lib/apt/lists/*

ENV WRANGLER_SEND_METRICS=false \
    NPM_CONFIG_UPDATE_NOTIFIER=false

# 名前付きボリュームをマウントする場所を node ユーザー所有で作っておく
# （ボリュームの初回作成時に所有者が引き継がれる）
RUN mkdir -p /app/node_modules /app/.wrangler /home/node/.config/.wrangler \
  && chown -R node:node /app /home/node/.config

USER node
WORKDIR /app

EXPOSE 8787
