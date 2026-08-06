import { spawn } from "node:child_process";

const nodeOptions = [process.env.NODE_OPTIONS, "--conditions=react-server"]
  .filter(Boolean)
  .join(" ");
const child = spawn(
  process.execPath,
  ["--conditions=react-server", "node_modules/tsx/dist/cli.mjs", ...process.argv.slice(2)],
  {
    stdio: "inherit",
    env: { ...process.env, NODE_OPTIONS: nodeOptions },
  }
);

child.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  else process.exit(code ?? 1);
});
