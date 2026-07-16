#!/usr/bin/env node
'use strict'

const http = require('node:http')
const fs = require('node:fs')
const fsp = require('node:fs/promises')
const path = require('node:path')
const crypto = require('node:crypto')
const zlib = require('node:zlib')
const { once } = require('node:events')

const host = process.env.RISU_FAST_EXPORT_HOST || '127.0.0.1'
const port = Number(process.env.RISU_FAST_EXPORT_PORT || 6199)
const saveDir = path.resolve(process.env.RISU_SAVE_DIR || path.join(process.cwd(), 'save'))
const token = process.env.RISU_FAST_EXPORT_TOKEN || ''
const maxDatabaseBytes = Number(process.env.RISU_FAST_EXPORT_MAX_DB_BYTES || 256 * 1024 * 1024)
const jobTtlMs = Number(process.env.RISU_FAST_EXPORT_JOB_TTL_MS || 5 * 60 * 1000)
const jobs = new Map()

if (!token) {
  console.error('RISU_FAST_EXPORT_TOKEN is required.')
  process.exit(1)
}

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Headers', 'authorization, content-type, x-risu-filename')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
}

function json(res, status, value) {
  cors(res)
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.end(JSON.stringify(value))
}

function authorized(req) {
  const supplied = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '')
  const left = Buffer.from(supplied)
  const right = Buffer.from(token)
  return left.length === right.length && crypto.timingSafeEqual(left, right)
}

async function readBody(req) {
  const chunks = []
  let size = 0
  for await (const chunk of req) {
    size += chunk.length
    if (size > maxDatabaseBytes) throw Object.assign(new Error('Database payload is too large.'), { status: 413 })
    chunks.push(chunk)
  }
  return Buffer.concat(chunks, size)
}

function decodeStorageKey(filename) {
  if (!/^[0-9a-f]+$/i.test(filename) || filename.length % 2 !== 0) return null
  try { return Buffer.from(filename, 'hex').toString('utf8') } catch { return null }
}

function basename(value) {
  return value.replace(/\\/g, '/').split('/').pop() || value
}

function u32le(value) {
  const output = Buffer.allocUnsafe(4)
  output.writeUInt32LE(value, 0)
  return output
}

async function write(res, data) {
  if (!res.write(data)) await once(res, 'drain')
}

async function writeEntry(res, name, data, basenameOnly = true) {
  const encodedName = Buffer.from(basenameOnly ? basename(name) : name, 'utf8')
  await write(res, u32le(encodedName.length))
  await write(res, encodedName)
  await write(res, u32le(data.length))
  await write(res, data)
}

async function storageFiles() {
  const entries = await fsp.readdir(saveDir, { withFileTypes: true })
  const assets = []
  const cold = []
  for (const entry of entries) {
    if (!entry.isFile()) continue
    const key = decodeStorageKey(entry.name)
    if (!key) continue
    const item = { diskPath: path.join(saveDir, entry.name), key }
    if (key.endsWith('.png')) assets.push(item)
    else if (key.startsWith('coldstorage/')) cold.push(item)
  }
  return { assets, cold }
}

function safeFilename(value) {
  const cleaned = String(value || '').replace(/[\r\n"\\/]/g, '_').slice(0, 160)
  return cleaned || `RisuAI-fast-backup-${Date.now()}.bin`
}

async function streamBackup(req, res, job) {
  const { assets, cold } = await storageFiles()
  const filename = safeFilename(job.filename)
  res.statusCode = 200
  res.setHeader('Content-Type', 'application/octet-stream')
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
  res.setHeader('Cache-Control', 'no-store')
  res.setHeader('X-Risu-Asset-Count', String(assets.length))
  res.setHeader('X-Risu-Cold-Count', String(cold.length))

  for (const asset of assets) {
    if (res.destroyed) return
    await writeEntry(res, asset.key, await fsp.readFile(asset.diskPath))
  }
  for (const item of cold) {
    if (res.destroyed) return
    try {
      const jsonData = zlib.unzipSync(await fsp.readFile(item.diskPath))
      const key = item.key.slice('coldstorage/'.length)
      await writeEntry(res, `coldstorage_${key}.json`, jsonData)
    } catch (error) {
      console.warn(`Skipping invalid cold storage ${item.key}:`, error.message)
    }
  }
  await writeEntry(res, 'database.risudat', job.database)
  res.end()
}

async function streamBulkRead(req, res, paths) {
  res.statusCode = 200
  res.setHeader('Content-Type', 'application/octet-stream')
  res.setHeader('Cache-Control', 'no-store')
  res.setHeader('X-Risu-Requested-Count', String(paths.length))
  for (const key of paths) {
    if (res.destroyed) return
    if (typeof key !== 'string' || !key.startsWith('assets/') || key.length > 1000) continue
    const filename = Buffer.from(key, 'utf8').toString('hex')
    const diskPath = path.join(saveDir, filename)
    try {
      const data = await fsp.readFile(diskPath)
      await writeEntry(res, key, data, false)
    } catch (error) {
      if (error.code !== 'ENOENT') throw error
    }
  }
  res.end()
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`)
    if (req.method === 'OPTIONS') {
      cors(res); res.statusCode = 204; res.end(); return
    }
    if (req.method === 'GET' && url.pathname === '/health') {
      json(res, 200, { ok: true }); return
    }
    if (req.method === 'POST' && url.pathname === '/prepare') {
      if (!authorized(req)) { json(res, 401, { error: 'Unauthorized' }); return }
      const database = await readBody(req)
      if (database.length < 12) { json(res, 400, { error: 'Invalid database payload' }); return }
      const id = crypto.randomBytes(32).toString('hex')
      jobs.set(id, {
        database,
        filename: req.headers['x-risu-filename'],
        expiresAt: Date.now() + jobTtlMs,
      })
      json(res, 200, { id, download: `download/${id}`, expiresInMs: jobTtlMs })
      return
    }
    if (req.method === 'POST' && url.pathname === '/bulk-read') {
      if (!authorized(req)) { json(res, 401, { error: 'Unauthorized' }); return }
      const body = await readBody(req)
      let payload
      try { payload = JSON.parse(body.toString('utf8')) } catch { json(res, 400, { error: 'Invalid JSON' }); return }
      if (!Array.isArray(payload.paths) || payload.paths.length > 100000) {
        json(res, 400, { error: 'paths must be an array with at most 100000 items' }); return
      }
      await streamBulkRead(req, res, [...new Set(payload.paths)])
      return
    }
    const match = req.method === 'GET' && url.pathname.match(/^\/download\/([0-9a-f]{64})$/)
    if (match) {
      const job = jobs.get(match[1])
      jobs.delete(match[1])
      if (!job || job.expiresAt < Date.now()) { json(res, 404, { error: 'Download job not found or expired' }); return }
      await streamBackup(req, res, job)
      return
    }
    json(res, 404, { error: 'Not found' })
  } catch (error) {
    console.error(error)
    if (!res.headersSent) json(res, error.status || 500, { error: error.message || String(error) })
    else res.destroy(error)
  }
})

const cleanup = setInterval(() => {
  const now = Date.now()
  for (const [id, job] of jobs) if (job.expiresAt < now) jobs.delete(id)
}, 60_000)
cleanup.unref()

server.listen(port, host, () => {
  console.log(`Risu Fast Export Sidecar listening on http://${host}:${port}`)
  console.log(`Risu save directory: ${saveDir}`)
})
