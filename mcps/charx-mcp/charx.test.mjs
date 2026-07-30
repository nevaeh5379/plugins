import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { unzipSync, zipSync } from "fflate";
import { applyJsonPatch, CharxFile, decodeRisum, encodeRisum } from "./charx.mjs";

test("applies JSON Patch with RFC 6901 pointers", () => {
  const original = { data: { name: "Old", list: ["a"], "a/b": { "~key": true } } };
  const patched = applyJsonPatch(original, [
    { op: "test", path: "/data/name", value: "Old" },
    { op: "replace", path: "/data/name", value: "New" },
    { op: "add", path: "/data/list/-", value: "b" },
    { op: "remove", path: "/data/a~1b/~0key" },
  ]);
  assert.deepEqual(patched, { data: { name: "New", list: ["a", "b"], "a/b": {} } });
  assert.equal(original.data.name, "Old");
});

test("round-trips a Risu module while preserving its asset tail", async () => {
  const tail = Buffer.from([1, 3, 0, 0, 0, 9, 8, 7, 0]);
  const encoded = await encodeRisum({ name: "Module", id: "id-1" }, tail);
  const decoded = await decodeRisum(encoded);
  assert.deepEqual(decoded.module, { name: "Module", id: "id-1" });
  assert.deepEqual(decoded.tail, tail);
});

test("inspects and atomically patches card and module data", async (context) => {
  const directory = await mkdtemp(join(tmpdir(), "charx-mcp-"));
  context.after(() => rm(directory, { recursive: true, force: true }));
  const filePath = join(directory, "module.charx");
  const moduleData = await encodeRisum({ name: "Old module", description: "before", id: "m1" });
  const archive = zipSync({
    "card.json": Buffer.from(
      JSON.stringify({ spec: "chara_card_v3", spec_version: "3.0", data: { name: "Old card", assets: [] } }),
    ),
    "module.risum": moduleData,
    "assets/icon/image/icon.png": Buffer.from([1, 2, 3, 4]),
  });
  await writeFile(filePath, archive);

  const charx = new CharxFile(filePath);
  const inspected = await charx.inspect();
  assert.equal(inspected.card.name, "Old card");
  assert.equal(inspected.module.name, "Old module");

  const cardEdit = await charx.patch({
    section: "card",
    expectedSha256: inspected.sha256,
    operations: [{ op: "replace", path: "/data/name", value: "New card" }],
  });
  assert.match(cardEdit.backupPath, /\.bak\./);

  const moduleEdit = await charx.patch({
    section: "module",
    expectedSha256: cardEdit.sha256,
    backup: false,
    operations: [{ op: "replace", path: "/description", value: "after" }],
  });
  assert.equal(moduleEdit.backupPath, null);

  const entries = unzipSync(await readFile(filePath));
  assert.equal(JSON.parse(Buffer.from(entries["card.json"]).toString()).data.name, "New card");
  assert.equal((await decodeRisum(entries["module.risum"])).module.description, "after");
  assert.deepEqual(entries["assets/icon/image/icon.png"], new Uint8Array([1, 2, 3, 4]));
  await assert.rejects(
    charx.patch({
      section: "card",
      expectedSha256: inspected.sha256,
      operations: [{ op: "replace", path: "/data/name", value: "stale write" }],
    }),
    /changed since it was read/,
  );
});
