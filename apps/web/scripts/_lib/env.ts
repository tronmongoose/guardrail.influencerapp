import * as fs from "fs";
import * as path from "path";

const APPS_WEB_DIR = path.resolve(__dirname, "..", "..");

function loadEnvFile(filePath: string, opts: { override?: boolean } = {}) {
  if (!fs.existsSync(filePath)) return;
  const content = fs.readFileSync(filePath, "utf-8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    let value = trimmed.slice(eqIdx + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (opts.override || !process.env[key]) process.env[key] = value;
  }
}

export function loadEnv(opts: { prod?: boolean } = {}) {
  if (opts.prod) {
    const prodFile = path.join(APPS_WEB_DIR, ".env.production.local");
    if (!fs.existsSync(prodFile)) {
      console.error(
        `--prod given but ${prodFile} not found.\n` +
          `Run: cd apps/web && vercel env pull .env.production.local --environment=production`,
      );
      process.exit(1);
    }
    loadEnvFile(prodFile, { override: true });
  }
  loadEnvFile(path.join(APPS_WEB_DIR, ".env"));
  loadEnvFile(path.join(APPS_WEB_DIR, ".env.local"));
}

export function getDbHost(): string {
  return (process.env.DATABASE_URL ?? "").split("@")[1]?.split("/")[0] ?? "<unset>";
}

export function logDbHost(scriptName: string) {
  console.log(`[${scriptName}] DATABASE_URL host: ${getDbHost()}`);
}

export function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) {
    console.error(`Missing required env var: ${name}`);
    process.exit(1);
  }
  return v;
}
