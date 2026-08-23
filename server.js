const express = require("express");
const { McpServer } = require("@modelcontextprotocol/sdk/server/mcp.js");
const {
  StreamableHTTPServerTransport,
} = require("@modelcontextprotocol/sdk/server/streamableHttp.js");
const { z } = require("zod");

const PORT = process.env.PORT || 3000;

function buildServer() {
  const server = new McpServer({
    name: "pollinations-image-generator",
    version: "1.0.0",
  });

  server.registerTool(
    "generate_image",
    {
      title: "Generate Image",
      description:
        "Generate an image from a text prompt using Pollinations.ai (a free, keyless image generation API). Returns the image itself plus the direct URL.",
      inputSchema: {
        prompt: z.string().min(1).describe("Text description of the image to generate"),
        width: z.number().int().min(64).max(2048).optional().describe("Image width in pixels (default 1024)"),
        height: z.number().int().min(64).max(2048).optional().describe("Image height in pixels (default 1024)"),
        model: z.string().optional().describe("Pollinations model name, e.g. 'flux' (default) or 'turbo'"),
        seed: z.number().int().optional().describe("Seed for reproducible results"),
      },
    },
    async ({ prompt, width, height, model, seed }) => {
      const params = new URLSearchParams();
      params.set("width", String(width ?? 1024));
      params.set("height", String(height ?? 1024));
      params.set("nologo", "true");
      if (model) params.set("model", model);
      if (seed !== undefined) params.set("seed", String(seed));

      // The classic image.pollinations.ai/prompt endpoint is still free and
      // keyless (verified live). Pollinations' newer gen.pollinations.ai/image
      // endpoint now requires an API key, so we deliberately use the legacy one.
      const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?${params.toString()}`;

      const res = await fetch(url, { signal: AbortSignal.timeout(60_000) });
      if (!res.ok) {
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: `Pollinations.ai returned an error: ${res.status} ${res.statusText}`,
            },
          ],
        };
      }

      const contentType = res.headers.get("content-type") || "image/jpeg";
      const arrayBuffer = await res.arrayBuffer();
      const base64 = Buffer.from(arrayBuffer).toString("base64");

      // Never echo the API key back in tool output.
      const displayUrl = new URL(url);
      displayUrl.searchParams.delete("key");

      return {
        content: [
          { type: "text", text: `Generated image URL: ${displayUrl.toString()}` },
          { type: "image", data: base64, mimeType: contentType },
        ],
      };
    }
  );

  return server;
}

const app = express();
app.use(express.json());

// Stateless MCP endpoint: a fresh server + transport per request avoids any
// cross-request session state, which keeps this robust on free hosts that
// sleep/restart the instance between calls.
app.post("/mcp", async (req, res) => {
  try {
    const server = buildServer();
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
    });
    res.on("close", () => {
      transport.close();
      server.close();
    });
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (err) {
    console.error("MCP request error:", err);
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: "2.0",
        error: { code: -32603, message: "Internal server error" },
        id: null,
      });
    }
  }
});

// GET/DELETE are not needed in stateless mode; respond politely instead of 404.
app.get("/mcp", (req, res) => {
  res.status(405).json({
    jsonrpc: "2.0",
    error: { code: -32000, message: "Method not allowed. This server is stateless; use POST /mcp." },
    id: null,
  });
});

app.get("/", (req, res) => {
  res.send("Pollinations MCP server is running. Point your MCP client at POST /mcp.");
});

app.listen(PORT, () => {
  console.log(`Pollinations MCP server listening on port ${PORT}`);
});
