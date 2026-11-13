// package-lock.json が変わっていたら npm ci を実行する（コンテナ起動時に使う）
// node_modules は名前付きボリュームにあるため、ホスト側の変更が自動では反映されない。
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";

const lockHash = createHash("sha256").update(readFileSync("package-lock.json")).digest("hex");
const stampPath = "node_modules/.package-lock.sha256";
const installed = existsSync(stampPath) ? readFileSync(stampPath, "utf8").trim() : "";

if (installed === lockHash) {
  console.log("Dependencies are up to date.");
} else {
  console.log("Installing dependencies (npm ci)...");
  execFileSync("npm", ["ci"], { stdio: "inherit" });
  writeFileSync(stampPath, `${lockHash}\n`);
}
