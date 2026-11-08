import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";

async function loadLocalEnv() {
  try {
    const contents = await readFile(join(process.cwd(), ".env"), "utf8");
    for (const line of contents.split(/\r?\n/)) {
      const match = line.match(/^\s*([A-Z][A-Z0-9_]*)\s*=\s*(.*?)\s*$/);
      if (!match || process.env[match[1]]) continue;
      process.env[match[1]] = match[2].replace(/^(["'])(.*)\1$/, "$2");
    }
  } catch {
    // A .env file is optional; Nova will use its local demo mode without one.
  }
}

await loadLocalEnv();

const port = Number(process.env.PORT || 3000);
const publicDir = join(process.cwd(), "public");
const systemInstructions = `You are Nova, a thoughtful general-purpose AI assistant. Be useful, warm, clear, and concise. Explain your reasoning only when it helps. If information may be current or uncertain, say what you know and what should be verified. Never claim you completed actions you cannot actually perform.`;

const types = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
};

function send(res, status, body, type = "application/json; charset=utf-8") {
  res.writeHead(status, {
    "Content-Type": type,
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  });
  res.end(Buffer.isBuffer(body) ? body : typeof body === "string" ? body : JSON.stringify(body));
}

async function readJson(req) {
  let body = "";
  for await (const chunk of req) {
    body += chunk;
    if (body.length > 1_000_000) throw new Error("Request too large");
  }
  return JSON.parse(body || "{}");
}

function demoReply(prompt) {
  const value = prompt.trim();
  const lower = value.toLowerCase();
  if (/(plan|organize|schedule)/.test(lower)) {
    return `Here’s a simple way to begin:\n\n1. Define the one outcome that matters most.\n2. Break it into the next three concrete actions.\n3. Reserve a focused 30-minute block for the first action.\n\nTell me what you’re planning, and I’ll turn this into a specific plan.`;
  }
  if (/(write|email|message|draft)/.test(lower)) {
    return `I can help shape that. First, decide who it is for, what you want them to do, and what tone fits.\n\nFor a direct first draft, give me those details—or paste what you have—and I’ll refine it.`;
  }
  if (/(learn|explain|study|how does)/.test(lower)) {
    return `Great question. I can explain it at any level—from a quick overview to a step-by-step lesson with examples. What part feels unclear right now?`;
  }
  return `I’m Nova’s local demo mode, so I can guide the conversation but I’m not using a live language model yet. Add an OpenAI API key to the server configuration and I’ll be ready to help with: “${value.slice(0, 140)}${value.length > 140 ? "…" : ""}”`;
}

function extractText(response) {
  if (response.output_text) return response.output_text;
  const parts = response.output?.flatMap((item) => item.content || []) || [];
  return parts.filter((part) => part.type === "output_text").map((part) => part.text).join("\n");
}

async function handleChat(req, res) {
  try {
    const { messages } = await readJson(req);
    if (!Array.isArray(messages) || messages.length === 0) {
      return send(res, 400, { error: "A message is required." });
    }

    const cleanMessages = messages
      .filter((message) => message && ["user", "assistant"].includes(message.role) && typeof message.content === "string")
      .slice(-20)
      .map((message) => ({ role: message.role, content: message.content.slice(0, 12_000) }));
    const latest = cleanMessages.at(-1)?.content || "";

    if (!process.env.OPENAI_API_KEY) {
      return send(res, 200, { reply: demoReply(latest), mode: "demo" });
    }

    const upstream = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || "gpt-5.4-mini",
        instructions: systemInstructions,
        input: cleanMessages,
      }),
    });
    const payload = await upstream.json();
    if (!upstream.ok) {
      console.error("OpenAI error", payload);
      return send(res, upstream.status, { error: "Nova could not reach the AI service. Please try again." });
    }

    const reply = extractText(payload);
    if (!reply) return send(res, 502, { error: "Nova received an empty response. Please try again." });
    return send(res, 200, { reply, mode: "live" });
  } catch (error) {
    console.error(error);
    return send(res, 500, { error: "Something went wrong. Please try again." });
  }
}

async function serveStatic(res, url) {
  const path = url === "/" ? "/index.html" : url;
  const cleanPath = normalize(path).replace(/^([/\\])+/, "");
  if (cleanPath.includes("..")) return send(res, 403, "Forbidden", "text/plain; charset=utf-8");

  try {
    const file = await readFile(join(publicDir, cleanPath));
    send(res, 200, file, types[extname(cleanPath)] || "application/octet-stream");
  } catch {
    send(res, 404, "Not found", "text/plain; charset=utf-8");
  }
}

createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  if (req.method === "POST" && url.pathname === "/api/chat") return handleChat(req, res);
  if (req.method === "GET") return serveStatic(res, url.pathname);
  send(res, 405, { error: "Method not allowed" });
}).listen(port, () => {
  console.log(`Nova is ready at http://localhost:${port}`);
});
