# todo

What is deliberately left, and what still has to be proven against a real server.

## Measured on a live server

Sampled on 2026-09-12 from a provisioned dev server, idle with a fresh world loaded and no players:

- **234 MiB resident, flat across a minute, 2.3 % CPU.** The Java servers on the same machine were sitting
  at 1.81 and 1.89 GiB against a 2 GiB cap — Bedrock uses roughly an eighth of what the JVM does.
- **365 MB on disk** installed, of which 123 MB is the shipped vanilla packs; a fresh world is 1 MB.

`minMemoryMb` is therefore **512** and `recommendedMemoryMb` **1024**, down from 1024/2048. The old numbers
were invented and would have blocked Bedrock from the smallest plans for no reason, which is a pricing
mistake rather than a technical one.

## Still to measure

- **Memory under real load.** 234 MiB is the idle floor with one fresh world and nobody connected. Chunk
  loading and players move it, and that has not been measured, so `playersPerMemoryGb` (10) and
  `maxRecommendedPlayers` (100) are still estimates.
- `resources.minDiskMb` (5120) — deliberately left alone. The install is a measured 365 MB and the archive
  adds 104 MB transiently, but world growth over months is the term that actually decides this and it has
  not been observed. Lowering it on the strength of a 1 MB fresh world would swap one guess for another.
- `resources.minDiskMb` (5120) — a measured 365 MB install plus the 104 MB archive held transiently during
  the unpack, plus world growth. The only unmeasured part left is how fast a real world grows.
- `container.runtime.installBudgetMinutes` (10) — a measured cold install. This is the number the
  provisioning screen shows the customer, so an optimistic value fails real provisions. The download alone is
  104 MB and took minutes on this machine, so 10 may be tight on a slow link.
- `container.runtime.bootBudgetMinutes` (6) — process start to the ready line, worst case: first boot
  generates a world.
- `container.runtime.shmMb` (64) and `pidsLimit` (512) — defaults; raise only if a failure demands it.
- `lifecycle.stopTimeoutSeconds` (120) — how long BDS really takes to flush a large LevelDB world. **180s is
  the ceiling a package may declare alone**; past that, `DEFAULT_STOP_TIMEOUT_SECONDS` in
  `platform/src/services/server/stopControl.ts` has to move in the same change.

## Verified against a real BDS 1.26.45.1

Booted in `debian:12-slim` on 2026-09-12 with the commands driven over stdin. These are no longer assumptions:

- **`allow-list` ships as `true`.** The server prints an ALLOW LIST WARNING block on first boot saying the list
  is enabled and empty. That is a server nobody — including its owner — can join, which is exactly why
  `seedConfig` forces it to `false` on a first install.
- **`level-name` ships as `Bedrock level`**, with a space, confirming the first-install override to `world`.
- Ready line is `Server started.`; stop prints `Stopping server...` then `Quit correctly`.
- `Saving...` → `Data saved. Files are now ready to be copied.` → `Changes to the world are resumed.` — all
  three match what `bedrockSave.ts` waits for, including "world" rather than "level" in the resume line.
- `save query` prints its file list on the line **after** the ready line, comma separated as
  `Bedrock level/db/CURRENT:16, Bedrock level/db/000003.log:156, …` — the researched format exactly.
- `list` prints `There are 0/10 players online:` — the `LIST_HEADER` shape.
- The archive holds **10,920 entries, no debug symbols at all**, and unpacks to **365 MB**. The symbol prune
  was removed because it found nothing; `minDiskMb: 5120` now has a measured 365 MB install under it.
- The archive **ships `server.properties`, `allowlist.json` and `permissions.json`**, so the `-x` exclusions
  in `installGame` are load-bearing rather than defensive: without them every upgrade would reset the lot.
- Top-level names are `allowlist.json bedrock_server bedrock_server_how_to.html behavior_packs config data
  definitions libMinecraft.Server.Lib.a packetlimitconfig.json permissions.json profanity_filter.wlist
  release-notes.txt resource_packs server.properties`. `reset.keep` and `files.protected` were rewritten from
  this list rather than from guesses.
- `allowlist list`, `ops` and `permissions` answer with **JSON wrapped in `###* … *###`**, not plain text.
  Nothing here parses those replies — both collections read the files — but anyone who adds a parser should
  know before they write a line-scraper.
- **Beta APIs is `experiments.gametest` in `level.dat`**, checked on 2026-09-13 on a dev server. While the flag is
  absent, a beta script add-on logs `requesting dependency on beta APIs … but the Beta APIs experiment is not
  enabled` at `ERROR`. After `enableBetaApis` writes `gametest: 1`, the same script runs. On the next save the
  game keeps the flag and sets `experiments_ever_used` and `saved_with_toggled_experiments` to 1 by itself. Every
  other tag in the file was byte-identical before and after the write.

## Verified against the live CurseForge API

Checked on 2026-09-12 with the platform's own `CURSEFORGE_API_KEY` (stored in the `secrets` table,
not in any `.env`), so none of this is inferred:

- `gameId 78022` is Minecraft Bedrock. Java is `432`; using it here would fill the tab with mods that
  cannot run on this server, which is the one failure worth guarding against.
- Classes are `4984 addons`, `6913 maps`, `6929 texture-packs`, `6940 scripts`, `6925 skins`.
- The catalog's own `search` returns 10,000 addons and 5,671 texture packs through the class facet.
- Files are real `.mcaddon` archives carrying SHA-1 hashes, and `curseforgeDownloadUrl` resolves for
  every project sampled — so the digest-pinned download works and the "searches but cannot install"
  risk this was deferred over does not exist for Bedrock.

## Still to verify against a real BDS

- `PORT_BIND_FAILED` and `WORLD_CORRUPT` in `src/events/events.ts` are informed guesses. Reproduce them
  (hold the port; corrupt a `db/`) and fix the patterns — or **delete them rather than ship regexes that
  never fire**.
- `kick <xuid>` — the shipped manual says kick takes a name or an xuid; `players.kick` relies on it.
- Whether `op <gamertag>` needs quoting for a gamertag containing a space.
- Whether `permission reload` picks up a `visitor` downgrade without a rejoin.
- What `allowlist add` does when `online-mode=false`. If it refuses to operate at all, the whole allowlist
  tab is a no-op in that configuration and the `online-mode` warning has to say so.
- Whether a pack version mismatch between `world_*_packs.json` and a manifest fails silently, and whether
  a `format_version: 3` semver string is accepted there (we always write the numeric triple).
- Whether the first entry of `world_resource_packs.json` is the highest priority. New packs are appended and
  the operator gets explicit move up/down, so the design does not depend on the answer — but the `help`
  copy on the add-ons tab names one end as winning and should be correct.

## NetherNet, verified 2026-09-28 on BDS 1.26.52.3

Measured on a throwaway container and on the dev stack (`c72mrym8dv` on `riyadh-01`), with real joins from a PC client.

- `transport=nethernet` boots clean: `Accepting clients on [::]:<server-port>`, `Signed in to signaling service successfully`, no
  TRANSPORT TYPE ERROR banner. With the key absent or `raknet` the banner prints, but RakNet still accepts 1.26.52 clients.
- At idle BDS binds only TCP `<server-port>` (dual-stack) and UDP 7551 (LAN discovery). Nothing on UDP `<server-port>`.
- `GET http://127.0.0.1:<server-port>/v1/join` answers `200`, `Content-Type: application/json`, empty body, `Connection: close`.
  That is the liveness probe the query uses.
- Every connected player takes one UDP socket from the `server-udp-ports` range (libwebrtc `BasicPortAllocator`); the first
  player landed on the first port of the block. The block is therefore sized to the player cap: `count: 64` and `max-players`
  capped at 64. A reconnecting player may hold a second socket until the old one times out; measured once, not exhaustively.
- Both mapping shapes joined through Docker NAT: `<publicIp>:<first>-<last>:<first>-<last>` (production) and the empty-ip
  form `:<first>-<last>:<first>-<last>` (dev fleet, whose agent reports 127.0.0.1), the latter through two NAT layers.
- The client shows a one-time prompt to trust the server on the first join; the player accepts it and is not asked again.
- `server-portv6` stays forced to the game port + 1 on purpose: NetherNet ignores it, but under the legacy `raknet` setting a
  mirrored game port of 19133 would otherwise collide with the BDS default v6 port.
- One-way door: a per-server rollback to a pre-NetherNet bundle leaves BDS listening on TCP with only UDP published. Set
  `transport=raknet` in Settings or in `server.properties` before reverting a Bedrock server.

## Deferred, on purpose

- **Player avatars.** There is no public gamertag→skin or XUID→gamerpic endpoint for Bedrock; the Xbox ones
  need an XSTS token, which is a Microsoft account and a refresh flow a game driver has no business holding.
  The Players page already degrades to a platform glyph and then the name's initial. The eventual shape is a
  platform-side `serverk://avatars/bedrock/{xuid}` route, after which this is one manifest line.
- **A `codecs/jsonList.ts` promotion into `@serverkgg/bridge`.** `codec.json` returns `{}` for a top-level
  array (`codecs/json.ts:14`), and `allowlist.json`, `permissions.json` and both `world_*_packs.json` are all
  top-level arrays. `src/shared/jsonList.ts` works around it here; a second package hitting the same wall is
  the moment to push it up.
- **`ModCrashed` / `MissingDependency` events.** Most pack load failures only surface in the content log, which
  `seedConfig` forces off because it is enormous. Turning it on behind a variable, learning the real lines
  and adding the patterns is the follow-up. Two lines do reach the console with the content log off, seen on
  BDS 1.26.45.1 on 2026-09-13: `[Scripting] Plugin [<name> - <version>] - requesting dependency on beta APIs
  [@minecraft/server - 2.10.0-beta], but the Beta APIs experiment is not enabled.` at `ERROR`, and
  `The following issues were found when loading packs:` followed by `Unable to find manifest in pack.` for a
  zip left in `resource_packs`. Server status already picks up both.

## Notes for whoever runs the first real install

- **Mojang's CDN refuses curl's User-Agent.** Verified against the real URL from inside `debian:12-slim`:
  curl's default UA and an explicit `curl/7.88.1` both get an empty reply, while `Mozilla/5.0` and
  `serverk-bridge/1.0 (serverk.gg)` both answer `206`. The bridge sends the latter
  (`runtime/bridgeFiles.ts:306` reuses `USER_AGENT` from `bridgeNet.ts:10`), so `context.files.download`
  works — but anyone reaching for `context.exec(["curl", ...])` here will be confused for an hour.
- `install.run` logs the archive's entry count and top-level names on every install (`unzip -Z1` before
  unpacking). Read that line on the first container run — it is how we learn what the archive actually
  carries, and it is what the stale-file sweep on the next upgrade deletes.
- World and pack folder names keep Unicode letters (`/[^\p{L}\p{N}._-]+/gu`), so an Arabic add-on or world
  name survives into the folder instead of sanitising to nothing. BDS's own default `level-name` carries a
  space, so a non-ASCII one should be fine — but confirm that an Arabic `level-name` round-trips through
  `server.properties` on a real server before relying on it.
