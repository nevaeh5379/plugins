# Risu Fast Export Sidecar

This companion process reads RisuAI's Node `save/` directory directly and
streams one compatible local-backup file. It does not modify `server.cjs`.

## Start

Run it on the same machine as the Risu Node server:

```bash
RISU_SAVE_DIR=/absolute/path/to/Risuai/save \
RISU_FAST_EXPORT_TOKEN='replace-with-a-long-random-secret' \
node /absolute/path/to/risu-download-accelerator/sidecar/server.cjs
```

It listens on `127.0.0.1:6199` by default. Optional variables:

- `RISU_FAST_EXPORT_HOST`
- `RISU_FAST_EXPORT_PORT`
- `RISU_FAST_EXPORT_MAX_DB_BYTES`
- `RISU_FAST_EXPORT_JOB_TTL_MS`

## Remote/custom-domain access

If the browser is not on the server machine, expose the sidecar behind the
same HTTPS reverse proxy. Example nginx location:

```nginx
location /risu-fast-export/ {
    proxy_pass http://127.0.0.1:6199/;
    proxy_buffering off;
    proxy_request_buffering off;
}
```

Configure the userscript endpoint as:

```text
https://your-risu-domain.example/risu-fast-export
```

The secret is required only for `POST /prepare`. The returned download URL is
random, single-use, and expires after five minutes.

Character and module exports use authenticated `POST /bulk-read` to retrieve
all requested assets in one response instead of one `/api/read` per asset.
