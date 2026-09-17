# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository layout

- `asaba-nextjs/` — **the active application.** Next.js 16 + React 19, Prisma/MySQL, MQTT. All work happens here.
- `RTS ANIMATION ASSET/` — numbered PNG sprite frames for the RTS animation component.

`db_demo (2).sql` at root is a dump of the legacy schema.

The legacy CodeIgniter 3 app (`asaba/`) was deleted; recover it from git history if needed. Many `src/lib/*.ts` files are ports of its controllers and helpers and still say so in their header comments — those references are historical, the PHP source is no longer in the working tree.

## Commands

Run everything from `asaba-nextjs/`.

```bash
npm run dev          # next dev (port 3000)
npm run build        # next build
npm run lint         # eslint
npm run db:generate  # prisma generate
npm run db:push      # prisma db push
npm run db:studio    # prisma studio
```

The dev server is also registered in `.claude/launch.json` as `asaba-dev` for the Browser pane.

### Tests

No test runner is installed and there is no `npm test`. Two different styles coexist:

```bash
npx tsx src/lib/status-rts.test.ts          # plain assert script, exits 1 on failure
npx tsx src/lib/kirim-peringatan.test.ts    # penerima, subjek, dan badan pesan peringatan
npx tsx src/components/monitoring/derive.test.ts  # "gagal ditembak" vs "tidak bergerak"
npx tsx src/components/monitoring/gabungan.test.ts  # analisa gabungan beberapa prisma
npx tsx scripts/regresi-protokol-rts.ts     # same style, protocol regression suite
npx tsx scripts/regresi-balasan-logger.ts
npx tsx scripts/regresi-site.ts
node --test src/lib/mine-network.test.ts    # this one uses node:test
```

Every file carries its own run command in the header comment. `scripts/test-rts.ts` and `scripts/test-sites.ts` are DB probes, not tests — they need a live MySQL connection.

`scripts/uji-kirim-peringatan.ts [site]` is neither: it reports which alert channels are configured (and, for WhatsApp, whether the session is still linked) and then **actually sends** a sample alert to that site's real recipients (marked UJI COBA). It touches no tables. It exists because a real alert can't be provoked on demand — one only fires after a prism crosses Siaga and holds for three consecutive cycles.

### Database migrations

`prisma/migrations/*.sql` are **hand-written raw SQL applied manually** — not Prisma Migrate. `prisma db push` syncs `schema.prisma` to the DB; the `.sql` files are the record of intent and each one opens with a long comment explaining why the change was made. Keep both in sync: add the `.sql` file *and* update `schema.prisma`.

## Deployment

This repo is deployed to **`demo-adr.monitoring4system.com`** on Server 3 — pm2 app `demo-adr`, port 4179, app root in the `asaba-nextjs/` subfolder of the deploy path.

Git is handled by **Plesk**, not a `.git` in the docroot: `git log` there fails, which does *not* mean the deploy is untracked. The Plesk repo is named `adr_baru` (no `.git` suffix), branch `main`, mode **manual**, and post-deploy actions are **disabled** — so a pull syncs source only and `next build` is a separate, explicit step.

```bash
plesk ext git --async-deploy -domain demo-adr.monitoring4system.com -name adr_baru
```

Build as the vhost user (`monitoring4sys`), never root, and export `PATH=/opt/plesk/node/24/bin:$PATH` before any `pm2` command — `pm2 restart --update-env` inherits the calling shell's environment and will take the app down with `env: 'node': No such file or directory` if node isn't on it.

Full procedure and the pitfalls that have already bitten: `be-server/docs/servers/server-3-runtime.md` and `server-3-projects.md`.

## Architecture

### MQTT is the device control plane

`src/lib/mqtt.ts` owns the topic scheme, which is hard-coded in device firmware and deliberately not configurable:

- `sub_<idAlat>` — commands, published by the Next.js server (`topikPerintah()`).
- `pub_<idAlat>` — command replies, subscribed to **directly by the browser over WSS** (`topikBalasan()`). See `src/app/(dashboard)/kontrol-adr/page.tsx`.
- `Logger_<idAlat>` — periodic measurement data. A **separate bridge service** subscribes and POSTs to `/api/datamasuk/adr`. This app never subscribes to it.

So control commands are fire-and-forget on the server side; the UI learns the outcome from its own MQTT subscription, not from the HTTP response. Command payloads are always shaped `{ "set_<idLogger>": { command: "set_rts", ... } }`.

Server MQTT needs `MQTT_*` env vars; browser MQTT needs the `NEXT_PUBLIC_MQTT_*` pair.

### Reply parsing lives in `src/lib/protokol-rts.ts`

~1000 lines of pure functions that classify every RTS reply value against `PROTOKOL_MQTT_ADR` (the device protocol doc, not in this repo). It is pure and dependency-free specifically so the protocol tables can be locked down by `scripts/regresi-protokol-rts.ts` — the MQTT flow itself can't be tested without hardware.

Traps documented in that file and worth re-reading before touching it: `Success` is *progress*, not completion (`done` is completion); the string `done` appears at two different nesting levels meaning different things; firmware versions disagree on `value` vs `stage` vs `nilai` vs repeating the command name as the inner key. `src/lib/balasan-logger.ts` handles the flat-vs-nested variant of the same problem for a different set of replies.

### The wide sensor table

Measurement data lands in `rts` / `temp_rts` as 25 generic columns. The slot meanings are implicit and spread across query sites:

| slot | meaning |
|---|---|
| `sensor1` | id_prisma (slot number, reused per site) |
| `sensor3` | prism name |
| `sensor5` / `sensor6` / `sensor7` | HA / VA / SD |
| `sensor8` / `sensor9` / `sensor10` | **N / E** / Z — note N before E |
| `sensor14` | instrument powered on |
| `sensor16` | instrument mid-measurement |
| `sensor20`–`sensor23` | tilt readings |

`sensor1`–`sensor13` are VARCHAR; `sensor14`–`sensor25` are FLOAT and reject empty strings in MySQL — `/api/datamasuk/adr` coerces missing numeric slots to `"0"` for exactly this reason.

### Single sources of truth

Several modules exist because the same rule was previously duplicated and drifted. Route new code through them rather than recomputing:

- `src/lib/status-rts.ts` — `hitungStatusRts()`. "Logger connected" (fresh periodic data, 1-hour window) and "RTS powered on" (`sensor14`) are **two separate facts**; conflating them made Beranda, Kontrol ADR and Prism Config contradict each other for the same device.
- `src/lib/sites.ts` — per-site behaviour reads from the `t_site` table, replacing scattered `if (site === 'ccp')` branches. `t_site.id_logger` is the only place the site↔logger relation is modelled. `getLoggerForCommand()` falls back to "first ADR logger" with a non-deterministic `LIMIT 1` — always pass `site` or `id_logger` for commands that move hardware.
- `src/components/monitoring/format.ts` — DB timestamps are **WIB wall-clock**, displayed without timezone conversion. Use `waktuMsWib()` / `fmtDate()`.

### Alert channels

`src/lib/kirim-peringatan.ts` fans one cycle summary out to three independent, individually optional channels — Telegram, email (SMTP), WhatsApp (wwebjs-api on Server 3, documented in `be-server/docs/servers/server-3-wwebjs-api.md`). They run concurrently and **one success is enough** to mark the alert delivered: what matters is whether anyone was told, not whether every path is healthy. Channels that failed while configured are still written to `log_peringatan.galat` even on success, so a silently broken path can't hide behind a working one. A channel that isn't configured at all is marked `mati` and never reported as a failure.

Two traps worth knowing. The WhatsApp API can answer **HTTP 200 with `success:false`** — checking the status code alone records an alert as sent when it never left. And whatsapp-web.js is an unofficial client whose account can be blocked without notice; as of 15 Sep 2026 that server's chat-reading endpoints are already broken upstream. `sendMessage` still works, which is why the channel is usable — but never as the only one.

### Auth

`src/proxy.ts` (Next.js 16 renamed `middleware.ts` → `proxy.ts`) is the only route guard. It tries **both** cookie names (`__Secure-authjs.session-token` and `authjs.session-token`) rather than deriving one from the request protocol, because `AUTH_URL` is http while the site is served over https in production. Open paths are `/login`, `/api/auth`, `/api/datamasuk` (loggers POST without cookies) and `/api/mobile` (its own token scheme). API routes get 401; pages get a redirect plus `Cache-Control: no-store` so browser Back doesn't resurrect the dashboard after logout.

`src/lib/auth.ts` accepts bcrypt and falls back to legacy CI3 MD5 hashes.

### Data fetching

SWR everywhere via `src/hooks/use-api.ts`; near-real-time panels poll with `refreshInterval` rather than streaming. API routes return `{ success: boolean, data?, error? }` consistently.

## Conventions

- **Comments explain why, not what**, and are written in Indonesian in newer code. Many carry a dated field observation ("terlihat di lapangan 31 Agustus 2026") or name the bug the code prevents. Preserve them — they encode hardware behaviour that is not otherwise recorded anywhere.
- Newer identifiers are Indonesian (`hitungStatusRts`, `bacaBalasanJog`, `nilaiRts`); code ported from CI3 kept its English names. Match whichever file you are in.
- Commit messages are Conventional Commits with Indonesian subjects, phrased as the behaviour change rather than the edit (`fix(auth): password di-hash, dan rute benar-benar dijaga`).
- `asaba-nextjs/AGENTS.md` warns that this Next.js version predates most training data — check `node_modules/next/dist/docs/` before relying on remembered API shapes.
