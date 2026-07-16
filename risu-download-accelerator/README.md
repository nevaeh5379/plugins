# Risu Download Accelerator

Tampermonkey mod for `risu-userscript-loader`. It speeds up self-hosted RisuAI
backups and character/module exports without modifying `server.cjs`.

The mod provides separate fast backup, character export, and module export
commands. Assets are read with bounded concurrency and assembled without using
Risu's serial export loops.

For large Node installations, use the included `sidecar/server.cjs`. The
`서버 직접 고속 백업` command sends only the encoded database snapshot and
downloads a single stream assembled directly from the server's `save/`
directory. See `sidecar/README.md` for launch and reverse-proxy configuration.

Install in this order:

1. `risu-userscript-loader/dist/risu-loader.user.js`
2. `risu-download-accelerator/dist/risu-download-accelerator.user.js`

Both scripts match all HTTP(S) domains for custom-domain installations. The
loader activates only after a Risu entry bundle passes its source-map scan.
