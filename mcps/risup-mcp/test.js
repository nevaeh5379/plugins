import fs from "fs/promises";
import crypto from "crypto";
import * as fflate from "fflate";
import { decode as decodeMsgpack } from "@msgpack/msgpack";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

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

async function run() {
    const filePath = "/home/jihoon/plugins/Risuai/이름추천좀 프롬프트 v2_preset.risup";
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
    console.log(JSON.stringify(pre, null, 2));
}

run().catch(console.error);
