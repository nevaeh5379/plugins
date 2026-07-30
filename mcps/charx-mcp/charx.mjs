import {
  constants as fsConstants,
  copyFile,
  mkdir,
  open,
  readFile,
  rename,
  stat,
  unlink,
} from "node:fs/promises";
import { createHash } from "node:crypto";
import { basename, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { unzipSync, zipSync } from "fflate";

const MAX_ARCHIVE_BYTES = 256 * 1024 * 1024;
const MAX_UNCOMPRESSED_BYTES = 512 * 1024 * 1024;
const MAX_ENTRIES = 10_000;
const textDecoder = new TextDecoder("utf-8", { fatal: true });
const textEncoder = new TextEncoder();
const dangerousKeys = new Set(["__proto__", "prototype", "constructor"]);

let rpackMaps;

function sha256(data) {
  return createHash("sha256").update(data).digest("hex");
}

function assertObject(value, message) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(message);
  }
}

function cloneJson(value) {
  return structuredClone(value);
}

function decodePointer(pointer) {
  if (pointer === "") return [];
  if (typeof pointer !== "string" || !pointer.startsWith("/")) {
    throw new Error("JSON Pointer must be empty or start with '/'.");
  }
  return pointer.slice(1).split("/").map((segment) => {
    const decoded = segment.replace(/~1/g, "/").replace(/~0/g, "~");
    if (dangerousKeys.has(decoded)) {
      throw new Error(`Unsafe JSON Pointer segment: ${decoded}`);
    }
    return decoded;
  });
}

function arrayIndex(segment, length, allowEnd = false) {
  if (allowEnd && segment === "-") return length;
  if (!/^(0|[1-9]\d*)$/.test(segment)) {
    throw new Error(`Invalid array index: ${segment}`);
  }
  const index = Number(segment);
  const max = allowEnd ? length : length - 1;
  if (!Number.isSafeInteger(index) || index < 0 || index > max) {
    throw new Error(`Array index out of bounds: ${segment}`);
  }
  return index;
}

export function getAtPointer(document, pointer) {
  let current = document;
  for (const segment of decodePointer(pointer)) {
    if (Array.isArray(current)) {
      current = current[arrayIndex(segment, current.length)];
    } else {
      assertObject(current, `Cannot traverse through non-container at '${segment}'.`);
      if (!Object.hasOwn(current, segment)) {
        throw new Error(`JSON Pointer does not exist: ${pointer}`);
      }
      current = current[segment];
    }
  }
  return current;
}

function parentAtPointer(document, pointer) {
  const segments = decodePointer(pointer);
  if (segments.length === 0) return { root: true };
  const key = segments.pop();
  const parent = getAtPointer(
    document,
    segments.length ? `/${segments.map((v) => v.replace(/~/g, "~0").replace(/\//g, "~1")).join("/")}` : "",
  );
  return { root: false, parent, key };
}

function jsonEqual(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

export function applyJsonPatch(document, operations) {
  if (!Array.isArray(operations) || operations.length === 0) {
    throw new Error("'operations' must be a non-empty array.");
  }
  let result = cloneJson(document);
  for (const operation of operations) {
    assertObject(operation, "Every patch operation must be an object.");
    const { op, path } = operation;
    if (!["add", "replace", "remove", "test"].includes(op)) {
      throw new Error(`Unsupported patch operation: ${String(op)}`);
    }
    if (typeof path !== "string") throw new Error("Patch operation 'path' must be a string.");

    if (op === "test") {
      if (!jsonEqual(getAtPointer(result, path), operation.value)) {
        throw new Error(`JSON Patch test failed at '${path}'.`);
      }
      continue;
    }

    const location = parentAtPointer(result, path);
    if (location.root) {
      if (op === "remove") throw new Error("Removing the document root is not allowed.");
      result = cloneJson(operation.value);
      continue;
    }

    const { parent, key } = location;
    if (Array.isArray(parent)) {
      if (op === "add") {
        parent.splice(arrayIndex(key, parent.length, true), 0, cloneJson(operation.value));
      } else {
        const index = arrayIndex(key, parent.length);
        if (op === "replace") parent[index] = cloneJson(operation.value);
        else parent.splice(index, 1);
      }
      continue;
    }

    assertObject(parent, `Patch parent at '${path}' is not a container.`);
    if (op !== "add" && !Object.hasOwn(parent, key)) {
      throw new Error(`JSON Pointer does not exist: ${path}`);
    }
    if (op === "remove") delete parent[key];
    else parent[key] = cloneJson(operation.value);
  }
  return result;
}

async function loadRpackMaps() {
  if (rpackMaps) return rpackMaps;
  const mapPath = fileURLToPath(new URL("../../src/ts/rpack/rpack_map.bin", import.meta.url));
  const data = await readFile(mapPath);
  if (data.length !== 512) throw new Error("Invalid RPack map.");
  rpackMaps = {
    encode: data.subarray(0, 256),
    decode: data.subarray(256, 512),
  };
  return rpackMaps;
}

function translateRpack(data, map) {
  const result = Buffer.allocUnsafe(data.length);
  for (let index = 0; index < data.length; index += 1) {
    result[index] = map[data[index]];
  }
  return result;
}

export async function decodeRisum(data) {
  const input = Buffer.from(data);
  if (input.length < 7 || input[0] !== 111 || input[1] !== 0) {
    throw new Error("module.risum has an invalid header.");
  }
  const jsonLength = input.readUInt32LE(2);
  const jsonEnd = 6 + jsonLength;
  if (jsonEnd >= input.length) throw new Error("module.risum is truncated.");
  const maps = await loadRpackMaps();
  const decoded = translateRpack(input.subarray(6, jsonEnd), maps.decode);
  const wrapper = JSON.parse(textDecoder.decode(decoded));
  if (wrapper?.type !== "risuModule" || !wrapper.module) {
    throw new Error("module.risum does not contain a Risu module.");
  }
  return { module: wrapper.module, tail: input.subarray(jsonEnd) };
}

export async function encodeRisum(module, tail = Buffer.from([0])) {
  assertObject(module, "Risu module must be a JSON object.");
  const maps = await loadRpackMaps();
  const wrapper = Buffer.from(JSON.stringify({ module, type: "risuModule" }, null, 2), "utf8");
  const encoded = translateRpack(wrapper, maps.encode);
  const header = Buffer.alloc(6);
  header[0] = 111;
  header[1] = 0;
  header.writeUInt32LE(encoded.length, 2);
  return Buffer.concat([header, encoded, Buffer.from(tail)]);
}

async function loadArchive(filePath) {
  const info = await stat(filePath);
  if (!info.isFile()) throw new Error(`Not a file: ${filePath}`);
  if (info.size > MAX_ARCHIVE_BYTES) {
    throw new Error(`CharX exceeds the ${MAX_ARCHIVE_BYTES} byte safety limit.`);
  }
  const raw = await readFile(filePath);
  let entries;
  let declaredEntries = 0;
  let declaredUncompressedBytes = 0;
  try {
    entries = unzipSync(new Uint8Array(raw), {
      filter(entry) {
        declaredEntries += 1;
        declaredUncompressedBytes += entry.originalSize;
        if (declaredEntries > MAX_ENTRIES) {
          throw new Error(`CharX contains more than ${MAX_ENTRIES} entries.`);
        }
        if (declaredUncompressedBytes > MAX_UNCOMPRESSED_BYTES) {
          throw new Error(`CharX expands beyond the ${MAX_UNCOMPRESSED_BYTES} byte safety limit.`);
        }
        return true;
      },
    });
  } catch (error) {
    throw new Error(`Invalid CharX/ZIP archive: ${error instanceof Error ? error.message : error}`);
  }
  const names = Object.keys(entries);
  let uncompressedBytes = 0;
  for (const name of names) {
    uncompressedBytes += entries[name].byteLength;
    if (uncompressedBytes > MAX_UNCOMPRESSED_BYTES) {
      throw new Error(`CharX expands beyond the ${MAX_UNCOMPRESSED_BYTES} byte safety limit.`);
    }
  }
  if (!entries["card.json"]) throw new Error("CharX does not contain card.json.");
  return { entries, raw, info, uncompressedBytes };
}

function parseCard(entries) {
  try {
    const card = JSON.parse(textDecoder.decode(entries["card.json"]));
    assertObject(card, "card.json must contain an object.");
    return card;
  } catch (error) {
    throw new Error(`Invalid card.json: ${error instanceof Error ? error.message : error}`);
  }
}

function timestamp() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

async function atomicSave(filePath, contents, backup) {
  const directory = dirname(filePath);
  await mkdir(directory, { recursive: true });
  let backupPath;
  if (backup) {
    backupPath = `${filePath}.bak.${timestamp()}`;
    await copyFile(filePath, backupPath, fsConstants.COPYFILE_EXCL);
  }
  const tempPath = resolve(directory, `.${basename(filePath)}.${process.pid}.${Date.now()}.tmp`);
  let handle;
  try {
    handle = await open(tempPath, "wx", 0o600);
    await handle.writeFile(contents);
    await handle.sync();
    await handle.close();
    handle = undefined;
    await rename(tempPath, filePath);
  } catch (error) {
    await handle?.close().catch(() => {});
    await unlink(tempPath).catch(() => {});
    throw error;
  }
  return backupPath;
}

function assetReferences(card) {
  const assets = card?.data?.assets;
  return Array.isArray(assets)
    ? assets.map((asset) => ({
        name: asset?.name ?? null,
        type: asset?.type ?? null,
        uri: asset?.uri ?? null,
        ext: asset?.ext ?? null,
      }))
    : [];
}

export class CharxFile {
  constructor(filePath) {
    this.filePath = resolve(filePath);
  }

  async inspect() {
    const { entries, raw, info, uncompressedBytes } = await loadArchive(this.filePath);
    const card = parseCard(entries);
    const module = entries["module.risum"] ? (await decodeRisum(entries["module.risum"])).module : null;
    return {
      path: this.filePath,
      sha256: sha256(raw),
      size: info.size,
      uncompressedSize: uncompressedBytes,
      entryCount: Object.keys(entries).length,
      entries: Object.entries(entries).map(([name, value]) => ({ name, size: value.byteLength })),
      card: {
        spec: card.spec ?? null,
        specVersion: card.spec_version ?? null,
        name: card?.data?.name ?? card.name ?? null,
        assetReferences: assetReferences(card),
      },
      module: module
        ? {
            name: module.name ?? null,
            description: module.description ?? null,
            lorebookCount: module.lorebook?.length ?? 0,
            regexCount: module.regex?.length ?? 0,
            triggerCount: module.trigger?.length ?? 0,
          }
        : null,
    };
  }

  async read(section, pointer = "") {
    const { entries, raw } = await loadArchive(this.filePath);
    let document;
    if (section === "card") {
      document = parseCard(entries);
    } else if (section === "module") {
      if (!entries["module.risum"]) throw new Error("CharX does not contain module.risum.");
      document = (await decodeRisum(entries["module.risum"])).module;
    } else {
      throw new Error("'section' must be 'card' or 'module'.");
    }
    return {
      path: this.filePath,
      sha256: sha256(raw),
      section,
      pointer,
      value: cloneJson(getAtPointer(document, pointer)),
    };
  }

  async patch({ section, operations, expectedSha256, backup = true }) {
    const { entries, raw } = await loadArchive(this.filePath);
    const beforeSha256 = sha256(raw);
    if (expectedSha256 && expectedSha256 !== beforeSha256) {
      throw new Error(`CharX changed since it was read (expected ${expectedSha256}, found ${beforeSha256}).`);
    }

    let before;
    if (section === "card") {
      before = parseCard(entries);
      const after = applyJsonPatch(before, operations);
      assertObject(after, "Patched card.json root must be an object.");
      entries["card.json"] = textEncoder.encode(`${JSON.stringify(after, null, 2)}\n`);
    } else if (section === "module") {
      if (!entries["module.risum"]) throw new Error("CharX does not contain module.risum.");
      const decoded = await decodeRisum(entries["module.risum"]);
      before = decoded.module;
      const after = applyJsonPatch(before, operations);
      assertObject(after, "Patched module root must be an object.");
      entries["module.risum"] = await encodeRisum(after, decoded.tail);
    } else {
      throw new Error("'section' must be 'card' or 'module'.");
    }

    const output = Buffer.from(zipSync(entries, { level: 6 }));
    const backupPath = await atomicSave(this.filePath, output, backup);
    return {
      path: this.filePath,
      section,
      beforeSha256,
      sha256: sha256(output),
      backupPath: backupPath ?? null,
      operationCount: operations.length,
    };
  }
}
