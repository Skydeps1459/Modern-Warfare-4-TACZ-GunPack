# Modern Warfare 4 — TACZ Gun Pack

[简体中文](README.md) | **English**

[![Website](https://img.shields.io/badge/website-repository--linked-c7f36b)](https://github.com/Skydeps1459/Modern-Warfare-4-TACZ-GunPack/tree/main/web)
[![Code: MIT](https://img.shields.io/badge/code-MIT-c7f36b)](./LICENSE)
[![Gun pack: GPL--3.0](https://img.shields.io/badge/gun%20pack-GPL--3.0-orange)](./GUNPACK-LICENSE.md)

Modern Warfare 4 is a TACZ gun pack for Minecraft Forge 1.20.1 and NeoForge
1.21.1 with the namespace `mw4`. The current release is **1.11.0-Release**,
containing 15 guns, ammunition, attachments, reload state machines, and a
repository-linked website.

Website: <https://skydeps1459.github.io/Modern-Warfare-4-TACZ-GunPack/>

Download buttons use a daily speed-test result, select the fastest stable
mirror, and keep the original GitHub Release URL as a fallback.

> The Lite pack is frozen. This repository only maintains the main
> `Modern Warfare 4` package. Website, API, and GitHub workflow files are
> excluded from the TACZ gun-pack zip.

## Release policy

- Bug fixes are accumulated and verified locally. A hotfix release is created
  only after at least **six independent verified bug fixes**.
- Every hotfix Release page must list the bug fixes actually included in the
  attached package using [`RELEASE_NOTES_TEMPLATE.md`](./RELEASE_NOTES_TEMPLATE.md).
- New guns are not uploaded or released unless explicitly requested.
- Only the main pack participates in releases; the Lite pack remains frozen.

See [`RELEASE_POLICY.md`](./RELEASE_POLICY.md) for the complete policy.

## Weapons

| Category | Weapons |
| --- | --- |
| Assault rifles | AK-47, AK-74M, FN FAL, HK416D, HK437, M16A1, M4A1, SCAR-H, MCX SPEAR LT |
| Sniper / precision rifles | AWP, MRAD, M700, HK G28 |
| Light machine gun | RPK |
| Battle rifle | HK G3 |
| Pistols | Desert Eagle, HK MK23 |

The pack also includes 5.45×39mm, 5.56×45mm, 7.62×39mm, .308 Winchester,
.338 Lapua Magnum, .50 AE, and .45 ACP ammunition, M700 optics, and a drum
magazine.

## Installation

1. Download `Modern Warfare 4-<version>.zip` from
   [Releases](https://github.com/Skydeps1459/Modern-Warfare-4-TACZ-GunPack/releases).
2. Place the zip in the instance's `.minecraft/tacz/` directory. Do not extract it.
3. Start the game or run `/tacz reload`. Fully close the game before replacing
   a loaded pack.

The semantic baseline is the Forge 1.20.1 release of TACZ `1.1.8`.

## Repository website

The `web/` directory contains a dependency-free Node.js backend and a static
GitHub Pages build. It provides:

- Gun-pack metadata, icons, release history, and download links.
- Recent gun-pack Releases on the home page and a complete pack changelog.
- A separate website-update history and third-level detail pages for each
  website update.
- Five-minute data refreshes and scheduled GitHub Pages rebuilds.
- Automatically selected stable accelerator downloads with direct GitHub links.
- China Mobile Cloud and Quark Cloud domestic mirrors with sharing passwords; the Lanzou mirror is closed and shows a notice only.
- Health checks, automated tests, and a Dockerfile.

### Domestic mirror admin

The Node.js backend exposes mirror editors (Lanzou / China Mobile Cloud / Quark) at `/admin/`. It uses GitHub
OAuth and accepts only the repository owner's immutable GitHub user ID
`317516594`. Saves are committed to `web/domestic-mirror.json` using the
owner's own `public_repo` permission; no repository write secret is exposed to
the browser. See [`web/admin/README.md`](./web/admin/README.md).

Start it from the repository root:

```powershell
node web/server.mjs
```

Open `http://localhost:3000`. See [`web/README.md`](./web/README.md) for
deployment and configuration details.

Environment variables:

- `PORT`: HTTP port, defaults to `3000`.
- `GITHUB_OWNER` / `GITHUB_REPO`: override the repository in `web/config.json`.
- `GITHUB_TOKEN`: optional higher GitHub API rate limit.

## Repository layout

```text
assets/mw4/                Models, animations, textures, sounds, displays, and language files
data/mw4/                  Gun data, indexes, recipes, tags, and Lua scripts
web/                       Repository website and Node.js backend
.github/workflows/         Website CI and GitHub Pages deployment
```

## Development checks

```powershell
node --test web/test/server.test.mjs
python tools\repack_main.py
```

`tools\repack_main.py` excludes `web/`, `.github/`, `.git/`, `node_modules/`,
and all `.bak*` files from the TACZ zip.

## License

- Gun-pack models, animations, textures, sounds, and content under
  `assets/mw4/` and `data/mw4/` follow the TACZ project's **GPL-3.0** license.
  See [`GUNPACK-LICENSE.md`](./GUNPACK-LICENSE.md) and
  [`GUNPACK-LICENSE.txt`](./GUNPACK-LICENSE.txt).
- Website source, build scripts, and documentation use the
  [MIT License](./LICENSE).
- Third-party game names and original source assets remain the property of
  their respective owners.

