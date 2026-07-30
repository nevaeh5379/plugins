import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import fs from "fs/promises";
import crypto from "crypto";
import * as fflate from "fflate";
import { decode as decodeMsgpack } from "@msgpack/msgpack";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// 1. decodeRPack
let decodeMap;
async function initRPack() {
  if (decodeMap) return;
  const buffer = await fs.readFile(path.join(__dirname, "rpack_map.bin"));
  const mapData = new Uint8Array(buffer);
  decodeMap = mapData.slice(256, 512);
}

async function decodeRPack(data) {
  await initRPack();
  let result = new Uint8Array(data.length);
  for (let i = 0; i < data.length; i++) {
    result[i] = decodeMap[data[i]];
  }
  return result;
}

// 2. decryptBuffer
async function decryptBuffer(data, keys) {
  const keyBuffer = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(keys));
  const key = await crypto.subtle.importKey(
    "raw",
    keyBuffer,
    "AES-GCM",
    false,
    ["decrypt"]
  );
  
  const result = await crypto.subtle.decrypt(
    {
      name: "AES-GCM",
      iv: new Uint8Array(12),
    },
    key,
    data
  );
  
  return new Uint8Array(result);
}

// Create server
const server = new Server(
  {
    name: "risup-mcp-server",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Tools setup
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "read_risup",
        description: "Read and decode a .risup file",
        inputSchema: {
          type: "object",
          properties: {
            filePath: {
              type: "string",
              description: "Absolute path to the .risup file",
            },
          },
          required: ["filePath"],
        },
      },
    ],
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  if (request.params.name === "read_risup") {
    const { filePath } = request.params.arguments;
    
    try {
      const fileBuf = await fs.readFile(filePath);
      let data = new Uint8Array(fileBuf);
      data = await decodeRPack(data);
      const decoded = decodeMsgpack(fflate.decompressSync(data));
      
      let pre;
      if ((decoded.presetVersion === 0 || decoded.presetVersion === 2) && decoded.type === "preset") {
        const decrypted = await decryptBuffer(decoded.preset ?? decoded.pres, "risupreset");
        pre = decodeMsgpack(Buffer.from(decrypted));
      } else {
        pre = decoded;
      }
      
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(pre, null, 2),
          },
        ],
      };
    } catch (e) {
      return {
        content: [
          {
            type: "text",
            text: `Error decoding .risup file: ${e.message}\n${e.stack}`,
          },
        ],
        isError: true,
      };
    }
  }
  throw new Error("Tool not found");
});

async function run() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Risup MCP server running on stdio");
}

run().catch(console.error);
