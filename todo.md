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

- **Memory under real load.** 234 MiB is the idle floor with one fresh world and nobody connected. Chunks and
  players move it unmeasured, so `playersPerMemoryGb` (10) is an estimate. `maxRecommendedPlayers` (64) is the
  `max-players` cap the UDP port block sets (NetherNet section).
- `resources.minDiskMb` (5120): a measured 365 MB install, the 104 MB archive held during the unpack, and world
  growth, which decides it and has not been observed. A 1 MB fresh world is no ground to lower it.
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

Add-ons whose manifests do not match what they ship:

- **A uuid dependency is met by a pack at the declared version or newer** (`dependencySatisfied`). A dependency with no
  version is met by presence, and an older pack is refused. The game loads these add-ons, and Mojang's Creator Tools
  validator has no rule for a dependency version. Rejected: an exact version match, which refused the projects below
  on catalog install, upload and repair.
- Bean's Armed Forces (project 1325803) v4.2 ships BP `1540965b-552e-4304-8175-c914e756821b` 4.0.2 and RP
  `01cf9f1a-ff90-41b5-b844-77251387d9ef` 4.0.2 in one `.mcaddon`, and the BP declares the RP at 4.0.1. In v4.3 both
  are 4.0.3, the BP still declares 4.0.1, and the RP lists its own uuid at 4.0.2.
- Vanilla Hammers (project 1198067) publishes BP `2dc25948-6598-43a4-b138-7e117a82c1f1` and RP
  `394c213a-0a76-4208-8ba2-a305c575e919`, both 3.1.0, as two files that require each other. AdminUtils (project
  1262779) publishes BP `9bf627d5-d1e0-4195-b581-897a2a34f372` 1.1.23 beside two alternative resource packs, RP Dark
  (`7477870a-d721-44a1-beb6-5b39f9049e27` 1.1.23) and RP Light. The newest file alone lacks its other half.
- **The catalog completes an add-on from the project's other files.** `install` reads the newest ten files and, while
  a uuid requirement is unmet, downloads at most four more in the order `pickCurseforgeFiles` hands it
  (`PARTNER_FILE_LIMIT`). It keeps a file only when it meets an unmet requirement without repeating a pack it already
  holds (`keepsPartner`). Anything still unmet ends in the refusal that names the pack needing it.

Picking a file for the server's build:

- CurseForge tags Bedrock files `1.21.50` to `1.21.100` before the year versions and `26.10` to `26.50` after. Hotfix
  tags appear only where the author adds them: Verity (project 1575941) tags its 26.10 file `26.10` to `26.13`, its
  26.40 file only `26.40`.
- **The catalog installs the file tagged for the server's build** (`pickCurseforgeFiles`). It tries the build's own
  tag (`1.26.45.1` gives `26.45`), then its update (`26.40`), because hotfix tags are optional, then the newest file.
  The partner walk gets the rest, files sharing a tag with the pick first.
- Unverified since 2026-10-17: that the API's `gameVersions` strings equal the CurseForge widget's `versions`.

## Still to verify against a real BDS

- BDS reports a taken port at `ERROR` as `Port [19132] may be in use by another process. Free up port and re-run
  program or adjust server.properties file to use alternate ports for server`, once per port (v4 then v6), then
  `Exiting program` and a segfault (Mojira BDS-18775, BDS 1.20.30 and 1.20.32.03). The first line can lack the space
  after the full stop.
- `PORT_BIND_FAILED` in `src/events/events.ts` matches `Port \[\d+\] may be in use by another process`, and the
  segfault also raises `ServerCrashed` through `SERVER_CRASHED`.
- Unverified since 2026-10-17: the same port lines on the current build. Hold the port to confirm.
- `WORLD_CORRUPT` in `src/events/events.ts` is still a guess. Corrupt a `db/` and fix the pattern, or delete it rather
  than ship a regex that never fires.
- Unverified since 2026-10-17: the `[Scripting]` script-error shape the console rules warn on (`SCRIPT_ERROR` in
  `src/terminal/terminal.ts`), assumed from QuickJS wording; no real BDS line was found. The stamp and level of the
  two pack-load lines are unrecorded.
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
  The query no longer sends it: every request costs the port a minute of `TIME_WAIT` (the 1.26.60.6 section).
- Every connected player takes one UDP socket from the `server-udp-ports` range (libwebrtc `BasicPortAllocator`); the first
  player landed on the first port of the block. The block is therefore sized to the player cap: `count: 64` and `max-players`
  capped at 64. A reconnecting player may hold a second socket until the old one times out; measured once, not exhaustively.
- Both mapping shapes joined through Docker NAT: `<publicIp>:<first>-<last>:<first>-<last>` (production) and the empty-ip
  form `:<first>-<last>:<first>-<last>` (dev fleet, whose agent reports 127.0.0.1), the latter through two NAT layers.
- The client shows a one-time prompt to trust the server on the first join; the player accepts it and is not asked again.
- `server-portv6` stays forced to the game port + 1 on purpose: NetherNet ignores it, but under the legacy `raknet` setting a
  mirrored game port of 19133 would otherwise collide with the BDS default v6 port.
- One-way door: a per-server rollback to a pre-NetherNet bundle leaves BDS listening on TCP with only UDP published. Set
  `transport=raknet` in Settings or in `server.properties` before reverting a Bedrock server. On 1.26.60 or newer there
  is no RakNet to fall back to.
- RakNet ends at 1.26.60. Aternos: "Minecraft 26.60 removes the old protocol entirely";
  `https://minecraft.wiki/w/Bedrock_Edition_26.60` calls 26.60 "also known as 1.26.60".
- **On 1.26.60 or newer the transport is NetherNet.** `seedValues` writes `transport=nethernet` on every boot whatever the
  file held, and logs once when it moved a `raknet` value; `settings.write` refuses `raknet`. The panel still lists
  RakNet, because a static field cannot depend on the build without a new options module.
- Unverified since 2026-10-17: whether 1.26.60 preview builds already lack RakNet. They count as 1.26.60 or newer.
- iPhone and iPad clients fail to join over NetherNet from outside the server's network on 1.26.52.3 with
  `InitialConnection-13`, while Windows and Android join (`https://github.com/itzg/docker-minecraft-bedrock-server/issues/680`,
  `https://mojira.dev/BDS-23125`). The transport help in `src/panel/panel.ts` and `guides/getting-started` name RakNet as
  the workaround until 1.26.60.
- Unverified since 2026-10-17: an iPhone join against a Serverk server on either transport. Verify it on the dev stack
  before the release.

## NetherNet, verified 2026-10-28 on BDS 1.26.60.6

26.60 shipped on 2026-10-27, and Mojang's links API serves BDS `1.26.60.6` on release. Read from the archive's own
`server.properties` and `bedrock_server_how_to.html`, and from scratch runs inside a dev game container.

- `transport` still allows `raknet` or `nethernet`, default `nethernet`. Under `raknet` BDS 1.26.60.6 starts on RakNet and
  prints `TRANSPORT TYPE ERROR` with `In this release, NetherNet is the only supported transport type.` and `Players will not
  be able to connect to your game without NetherNet.` That is why `seedValues` forces `nethernet` from 1.26.60.
- `server-udp-ports` grammar is now one entry: a port or range, `public:local`, or `IP:public:local`. The 1.26.52.3 comment
  allowed comma-separated entries; the new one does not mention them. `<ip>:<range>:<range>` and the empty-address form
  `:<range>:<range>` both boot without an error. A malformed value logs `ERROR server-udp-ports: …` before the banner and
  the server still starts, so read that line after changing the format.
- At idle BDS binds TCP `<server-port>` dual-stack and UDP 7551 only, as on 1.26.52.3. `GET /v1/join` now answers `200`
  with a status body: `{"name","protocol":2225,"version":"1.26.60","level","players","maxPlayers","gameType"}`.
- **BDS cannot listen on `server-port` while a closed connection still holds it.** BDS answers signaling with
  `Connection: close` and closes first, so every request leaves a `TIME_WAIT` socket on the port for 60 seconds. A BDS started
  inside that minute prints `Server started.` with no `Accepting clients on` line and no error, nothing listens, and no
  player can join until the next start. Reproduced on 1.26.60.6 and 1.26.52.3 in a dev container: three `GET /v1/join`, stop,
  start again. A restart inside the same container keeps its network namespace and hits it; a recreated container does
  not. The query used to send that request every sample, so nearly every in-container restart lost the listener. The
  query now reads the listener from `/proc/net/tcp6` without connecting (`listeningOn`). Players' own signaling and the
  server-list status requests leave the same sockets, so the start goes through a `sh -c` wrapper (`startCommand`) that
  waits up to 75 seconds while a non-listening socket holds the port, then `exec`s `bedrock_server`. Nothing new arrives
  while BDS is down, because a refused connection leaves no `TIME_WAIT`.
- The wait lives in the process, not in `lifecycle.command`: a wait there holds the bridge's `start` reply, the agent's
  `start` call timed out after 15 seconds on dev and the platform stopped the container.
- Not yet reported to Mojang. A platform alternative is `net.ipv4.tcp_max_tw_buckets=0` on the container, which is per
  network namespace; unverified.
- **Server identity is new in 1.26.60.** BDS loads `keys/server_identity_key.pem` (unencrypted P-384 PEM) at start. Without
  it the server generates a key in memory each start, so every player has to accept the server again after every restart.
  `seedServerIdentity` writes a SEC1 key once when the file is absent and never replaces one; `backup.only` carries
  `keys/**` and `reset.keep` keeps `keys`. BDS accepted the key (`serveridentity status` answered `A saved server identity
  key exists at keys/server_identity_key.pem.`) and logs `Invalid server identity key file` at `ERROR` for a broken one.
- Unverified: a real 26.60 client join, the trust prompt staying away across a restart, and iPhone joins on 1.26.60.6.

## Deferred, on purpose

- **Player avatars.** There is no public gamertag→skin or XUID→gamerpic endpoint for Bedrock; the Xbox ones
  need an XSTS token, which is a Microsoft account and a refresh flow a game driver has no business holding.
  The Players page already degrades to a platform glyph and then the name's initial. The eventual shape is a
  platform-side `serverk://avatars/bedrock/{xuid}` route, after which this is one manifest line.
- **A `codecs/jsonList.ts` promotion into `@serverkgg/bridge`.** `codec.json` returns `{}` for a top-level
  array (`codecs/json.ts:14`), and `allowlist.json`, `permissions.json` and both `world_*_packs.json` are all
  top-level arrays. `src/shared/jsonList.ts` works around it here; a second package hitting the same wall is
  the moment to push it up.
- **`ModCrashed` / `MissingDependency` events.** Most pack load failures surface only in the content log. `seedConfig`
  sends it to the console by default (`content-log-console-output-enabled=true` when the key is absent) and forces
  `content-log-file-enabled=false` on every boot, because the file is enormous. Learning the real lines and adding the
  event patterns is the follow-up.
- Seen in the console on BDS 1.26.45.1: `[Scripting] Plugin [<name> - <version>] - requesting dependency on beta APIs
  [@minecraft/server - 2.10.0-beta], but the Beta APIs experiment is not enabled.` at `ERROR`, and `The following
  issues were found when loading packs:` followed by `Unable to find manifest in pack.` for a zip left in
  `resource_packs`.
- The console rules in `src/terminal/terminal.ts` warn on both pack-load lines and on a `[Scripting]` line carrying
  `SyntaxError`, `ReferenceError` or `TypeError`.
- **The listing keeps the console claim** ("phone, console and Windows players in one world", `description` in
  `serverk.yml`). Why: the claim rests on BedrockConnect, a third-party DNS service Serverk does not run, untested
  against its servers, and `guides/getting-started` says so.
- BedrockConnect's public DNS addresses in `guides/getting-started` can change on the project's side, so a guide check
  reads the README at `https://github.com/Pugmatt/BedrockConnect` first.
- Unverified since 2026-10-17: the DNS addresses in the guide, and a BedrockConnect join against a Serverk server.
- `development_skin_packs` survives an update (`PRESERVE_ON_UPDATE` in `src/install/installGame.ts`) but is not in
  `backup.only` in `serverk.yml`, so no backup carries it. Low risk, left as is.

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
