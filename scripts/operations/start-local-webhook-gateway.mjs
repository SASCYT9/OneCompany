import crypto from "node:crypto";
import http from "node:http";

const HOST = "127.0.0.1";
const PORT = 3099;
const WEBHOOK_PATH = "/api/operations/telegram-manager/webhook";
const TARGET_URL = `http://127.0.0.1:3000${WEBHOOK_PATH}`;
const MAX_BODY_BYTES = 1_000_000;

const webhookSecret = String(process.env.OPS_TELEGRAM_WEBHOOK_SECRET ?? "").trim();
if (!webhookSecret) {
  throw new Error("OPS_TELEGRAM_WEBHOOK_SECRET is required");
}

function secretsMatch(actual, expected) {
  const actualBuffer = Buffer.from(String(actual ?? ""), "utf8");
  const expectedBuffer = Buffer.from(expected, "utf8");
  return (
    actualBuffer.length === expectedBuffer.length &&
    crypto.timingSafeEqual(actualBuffer, expectedBuffer)
  );
}

function sendJson(response, status, body) {
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "x-content-type-options": "nosniff",
  });
  response.end(JSON.stringify(body));
}

const server = http.createServer(async (request, response) => {
  if (request.method !== "POST" || request.url !== WEBHOOK_PATH) {
    sendJson(response, 404, { ok: false });
    return;
  }

  const suppliedSecret = request.headers["x-telegram-bot-api-secret-token"];
  if (!secretsMatch(suppliedSecret, webhookSecret)) {
    sendJson(response, 401, { ok: false });
    return;
  }

  const declaredSize = Number(request.headers["content-length"]);
  if (Number.isFinite(declaredSize) && declaredSize > MAX_BODY_BYTES) {
    sendJson(response, 413, { ok: false });
    return;
  }

  const chunks = [];
  let receivedBytes = 0;
  for await (const chunk of request) {
    receivedBytes += chunk.length;
    if (receivedBytes > MAX_BODY_BYTES) {
      sendJson(response, 413, { ok: false });
      return;
    }
    chunks.push(chunk);
  }

  try {
    const upstream = await fetch(TARGET_URL, {
      method: "POST",
      headers: {
        "content-type": String(request.headers["content-type"] ?? "application/json"),
        "x-telegram-bot-api-secret-token": webhookSecret,
      },
      body: Buffer.concat(chunks),
      signal: AbortSignal.timeout(20_000),
    });
    const payload = Buffer.from(await upstream.arrayBuffer());
    response.writeHead(upstream.status, {
      "content-type": upstream.headers.get("content-type") ?? "application/json; charset=utf-8",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
    });
    response.end(payload);
  } catch {
    sendJson(response, 503, { ok: false, error: "LOCAL_INTAKE_UNAVAILABLE" });
  }
});

server.listen(PORT, HOST, () => {
  console.log(
    JSON.stringify({
      ready: true,
      address: `http://${HOST}:${PORT}${WEBHOOK_PATH}`,
      exposedSurface: "telegram webhook only",
    })
  );
});
