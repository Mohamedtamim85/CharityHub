import { readFileSync } from "fs";
import path from "path";

export function loadEnvFile(file: string): Record<string, string> {
  const content = readFileSync(file, "utf-8");
  const env: Record<string, string> = {};
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    env[key] = value;
  }
  return env;
}

const root = path.resolve(__dirname, "..", "..");
export const testEnv = loadEnvFile(path.join(root, ".env.test"));
export const TEST_PORT = testEnv.TEST_PORT || "3199";
export const BASE_URL = `http://localhost:${TEST_PORT}`;
export const REPO_ROOT = root;
