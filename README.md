# بيدروك (Minecraft Bedrock)

حزمة ماينكرافت بيدروك على منصة سيرفرك (`serverk.gg`). هذا المستودع فيه كل شيء اللعبة تحتاجه عشان تشتغل على المنصة: ملف التعريف `serverk.yml`، الـ driver اللي يدير السيرفر، صورة الدوكر، والشروحات.

The Minecraft Bedrock game package for the Serverk platform (`serverk.gg`). This repo holds everything the game needs to run on the platform: the `serverk.yml` manifest, the driver that manages the server, the Docker image, and the guides.

This is the **native** Bedrock Dedicated Server, not Java with Geyser in front of it. The `minecraft` package is the Java Edition one and stays as it is; the two are siblings.

## Layout

- `serverk.yml` — the game manifest: metadata, resources, ports, backup rules, secrets, guides.
- `src/` — the bridge driver: install, lifecycle, query, backup, events, and the panel modules.
- `image/Dockerfile` — the runtime image; the compiled bridge binary is its entrypoint.
- `assets/` — logo and banner (webp).
- `guides/` — player guides in Arabic and English.

## What Bedrock does not have

Three things are missing on purpose, because the game has no equivalent and pretending otherwise would be worse than the gap:

- **No ban.** BDS ships no `ban`, no `banlist`, no `pardon` and no banned-players file. The allowlist is the moderation tool, and the panel and guides say so. `driver.test.ts` asserts no ban action exists so a later change cannot quietly promise one.
- **No death or advancement events.** BDS prints neither server-side, so there is no line to match.
- **No per-dimension reset.** One LevelDB holds the Overworld, the Nether and the End, so there is no Nether to reset on its own.

## Develop

Everything runs on [Bun](https://bun.sh):

```sh
bun install
bun run check
bun run tsc
bun run test
bun run validate
bun run compile
```

`validate` checks the manifest, assets, and driver wiring with the exact validation the platform runs at publish. `compile` produces `dist/bridge`, an amd64 binary — serverk publishes game images for `linux/amd64` only, which suits BDS, since Mojang ships it for x86-64 alone.

The `pre-commit` hook is the gate: it runs `fix`, `tsc`, `test`, `validate`, and `serverk-bridge schema --check`, and restages whatever the formatter touched. There is no CI workflow — a commit that passes the hook is a commit that is ready.

The driver is built on [`@serverkgg/bridge`](https://www.npmjs.com/package/@serverkgg/bridge). `package.json` always pins the published version. When the `serverk` repository is cloned beside this one, the `postinstall` step (`serverk-bridge link`) points `node_modules/@serverkgg/bridge` at `../serverk/modules/bridge`, so you develop against the local bridge without touching `package.json` or `bun.lock`; it does nothing in CI or when the checkout is absent. `bunx serverk-bridge link --check` shows which bridge is installed, and `bunx serverk-bridge link --unlink` drops the link so the next `bun install` restores the registry package. Never use `bun link` or commit a `file:` or `link:` dependency.

## Contribute

- افتح issue لأي مشكلة أو اقتراح — بالعربي أو بالإنجليزي، كلها مرحّب فيها.
- Run `bun install` once so the `pre-commit` hook is wired, then let it gate every commit — lint, types, tests, package validation, and the schema check all run locally, with no secrets and nothing to configure.
- Releases are done by the Serverk team through the platform's central release pipeline; merged changes ride the next release.

## Arabic copy

Arabic is the source language of the platform. Player-facing strings in `serverk.yml` and the guides use Gulf gaming Arabic — the game's Arabic name is always «بيدروك», written solid.
