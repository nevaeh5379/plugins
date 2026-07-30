#!/usr/bin/env node

import { resolve } from "node:path";
import { CharxFile } from "./charx.mjs";

const argv = process.argv.slice(2);
const fileFlag = argv.indexOf("--file");
const targetPath = resolve(
  fileFlag >= 0 && argv[fileFlag + 1]
    ? argv[fileFlag + 1]
    : process.env.RISU_CHARX_FILE || "module.charx",
);
const charx = new CharxFile(targetPath);

const tools = [
  {
    name: "charx_inspect",
    description:
      "Inspect the configured module.charx archive. Returns its SHA-256, ZIP entries, card identity, asset references, and Risu module summary.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "charx_read",
    description:
      "Read card.json or the decoded Risu module from module.risum. Use an RFC 6901 JSON Pointer to select a subtree.",
    inputSchema: {
      type: "object",
      required: ["section"],
      properties: {
        section: { type: "string", enum: ["card", "module"] },
        pointer: {
          type: "string",
          default: "",
          description: "RFC 6901 JSON Pointer. Empty means the whole document.",
        },
      },
      additionalProperties: false,
    },
  },
  {
    name: "charx_patch",
    description:
      "Atomically patch card.json or the decoded Risu module using add/replace/remove/test JSON Patch operations. Preserves all archive entries and makes a backup by default.",
    inputSchema: {
      type: "object",
      required: ["section", "operations"],
      properties: {
        section: { type: "string", enum: ["card", "module"] },
        operations: {
          type: "array",
          minItems: 1,
          items: {
            type: "object",
            required: ["op", "path"],
            properties: {
              op: { type: "string", enum: ["add", "replace", "remove", "test"] },
              path: { type: "string", description: "RFC 6901 JSON Pointer." },
              value: {},
            },
            additionalProperties: false,
          },
        },
        expectedSha256: {
          type: "string",
          description: "Optional SHA-256 returned by inspect/read; rejects stale edits.",
        },
        backup: {
          type: "boolean",
          default: true,
          description: "Create module.charx.bak.<timestamp> before saving.",
        },
      },
      additionalProperties: false,
    },
  },
];

function result(value) {
  return {
    content: [{ type: "text", text: JSON.stringify(value, null, 2) }],
    structuredContent: value,
  };
}

async function callTool(name, args) {
  switch (name) {
    case "charx_inspect":
      return result(await charx.inspect());
    case "charx_read":
      return result(await charx.read(args?.section, args?.pointer ?? ""));
    case "charx_patch":
      return result(
        await charx.patch({
          section: args?.section,
          operations: args?.operations,
          expectedSha256: args?.expectedSha256,
          backup: args?.backup ?? true,
        }),
      );
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

function send(message) {
  process.stdout.write(`${JSON.stringify(message)}\n`);
}

async function handle(message) {
  if (!message || message.jsonrpc !== "2.0" || typeof message.method !== "string") return;
  if (message.id === undefined) return;

  try {
    let response;
    switch (message.method) {
      case "ping":
        response = {};
        break;
      case "initialize":
      case "init":
        response = {
          protocolVersion: ["2025-03-26", "2024-11-05"].includes(message.params?.protocolVersion)
            ? message.params.protocolVersion
            : "2025-03-26",
          capabilities: { tools: { listChanged: false } },
          serverInfo: { name: "risu-charx-editor", version: "0.1.0" },
          instructions: `Reads and edits only ${targetPath}. Inspect before editing and pass expectedSha256 for safe writes.`,
        };
        break;
      case "tools/list":
        response = { tools };
        break;
      case "tools/call":
        response = await callTool(message.params?.name, message.params?.arguments ?? {});
        break;
      default:
        send({
          jsonrpc: "2.0",
          id: message.id,
          error: { code: -32601, message: `Method not found: ${message.method}` },
        });
        return;
    }
    send({ jsonrpc: "2.0", id: message.id, result: response });
  } catch (error) {
    send({
      jsonrpc: "2.0",
      id: message.id,
      result: {
        content: [
          {
            type: "text",
            text: error instanceof Error ? error.message : String(error),
          },
        ],
        isError: true,
      },
    });
  }
}

let input = "";
let depth = 0;
let inString = false;
let escaped = false;
let start = -1;
let scanOffset = 0;
let messageQueue = Promise.resolve();

function consume(chunk) {
  input += chunk;
  for (let index = scanOffset; index < input.length; index += 1) {
    const character = input[index];
    scanOffset = index + 1;
    if (start < 0) {
      if (/\s/.test(character)) {
        continue;
      }
      if (character !== "{") {
        process.stderr.write("Ignoring non-JSON data on stdin.\n");
        input = input.slice(index + 1);
        scanOffset = 0;
        index = -1;
        continue;
      }
      start = index;
      depth = 1;
      continue;
    }
    if (inString) {
      if (escaped) escaped = false;
      else if (character === "\\") escaped = true;
      else if (character === '"') inString = false;
      continue;
    }
    if (character === '"') inString = true;
    else if (character === "{") depth += 1;
    else if (character === "}") depth -= 1;
    if (depth === 0) {
      const raw = input.slice(start, index + 1);
      input = input.slice(index + 1);
      start = -1;
      scanOffset = 0;
      index = -1;
      try {
        const message = JSON.parse(raw);
        messageQueue = messageQueue
          .then(() => handle(message))
          .catch((error) => {
            process.stderr.write(`Failed to handle JSON-RPC message: ${error instanceof Error ? error.message : error}\n`);
          });
      } catch (error) {
        process.stderr.write(`Invalid JSON-RPC message: ${error instanceof Error ? error.message : error}\n`);
      }
    }
  }
}

process.stdin.setEncoding("utf8");
process.stdin.on("data", consume);
process.stdin.resume();
process.stdin.ref?.();
