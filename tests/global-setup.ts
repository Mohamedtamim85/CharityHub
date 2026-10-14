import { spawn, execSync, type ChildProcess } from "child_process";
import { testEnv, BASE_URL, REPO_ROOT } from "./helpers/test-env";

async function waitForServer(url: string, timeoutMs: number): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.status < 500) return;
    } catch {
      // not ready yet
    }
    await new Promise((r) => setTimeout(r, 300));
  }
  throw new Error(`Server at ${url} did not become ready in time`);
}

export default async function globalSetup() {
  const env = { ...process.env, ...testEnv };

  execSync("npx prisma migrate deploy", {
    cwd: REPO_ROOT,
    env,
    stdio: "inherit",
  });

  const server: ChildProcess = spawn(
    "npx",
    ["next", "dev", "-p", testEnv.TEST_PORT],
    { cwd: REPO_ROOT, env, stdio: "pipe", detached: true },
  );

  let serverOutput = "";
  server.stdout?.on("data", (d) => (serverOutput += d.toString()));
  server.stderr?.on("data", (d) => (serverOutput += d.toString()));

  try {
    await waitForServer(`${BASE_URL}/login`, 30000);
  } catch (err) {
    console.error("Server output:\n" + serverOutput);
    server.kill();
    throw err;
  }

  return async () => {
    if (server.pid) {
      try {
        process.kill(-server.pid, "SIGTERM");
      } catch {
        // process group may already be gone
      }
    }
  };
}
