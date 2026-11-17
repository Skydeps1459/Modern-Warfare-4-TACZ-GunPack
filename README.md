# Modern Warfare 4 — TACZ Gun Pack

**简体中文** | [English](README.en.md)

[![Website](https://img.shields.io/badge/website-repository--linked-c7f36b)](https://github.com/Skydeps1459/Modern-Warfare-4-TACZ-GunPack/tree/main/web)
[![Code: MIT](https://img.shields.io/badge/code-MIT-c7f36b)](./LICENSE)
[![Gun pack: GPL--3.0](https://img.shields.io/badge/gun%20pack-GPL--3.0-orange)](./GUNPACK-LICENSE.md)

Modern Warfare 4 是面向 Minecraft Forge 1.20.1 与 NeoForge 1.21.1 的 TACZ
枪包，命名空间为 `mw4`。当前版本为 **1.11.0-Release**，包含 15 把枪、弹药、
配件、换弹状态机和仓库联动网页。

在线网页：<https://skydeps1459.github.io/Modern-Warfare-4-TACZ-GunPack/>

下载按钮使用每日自动测速结果：每天一次测试候选节点，选择当前最快且稳定的
加速线路并更新全站主下载地址。GitHub Release 原链保留为备用。

> Lite 包已冻结，本仓库只维护主包 `Modern Warfare 4`。仓库中的网页、API 和
> GitHub 工作流不会被打进 TACZ 枪包 zip。

## 发布规则

- Bug 修复先在本地累计；满 **6 个独立且已验证的 bug 修复**后，才发布末位 +1
  的 hotfix 版本。
- 每个 hotfix 的 GitHub Release 页面必须同步列出本次实际包含的 bug 修复项，
  统一使用 [`RELEASE_NOTES_TEMPLATE.md`](./RELEASE_NOTES_TEMPLATE.md)。
- 新增枪械默认不推送 GitHub、不更新 Pages、不发布 Release；只有用户明确要求
  上传或发布时才执行。
- 发布只针对主包，Lite 保持冻结。

完整规则见 [`RELEASE_POLICY.md`](./RELEASE_POLICY.md)。

## 枪械

| 类型 | 枪械 |
| --- | --- |
| 突击步枪 | AK-47、AK-74M、FN FAL、HK416D、HK437、M16A1、M4A1、SCAR-H、MCX SPEAR LT |
| 狙击/精准步枪 | AWP、MRAD、M700 |
| 轻机枪 | RPK |
| 战斗步枪 | HK G3 |
| 手枪 | 沙漠之鹰、HK MK23 |

枪包还包含 5.45×39mm、5.56×45mm、7.62×39mm、.308 Winchester、.338 Lapua
Magnum、.50 AE 和 .45 ACP 等弹药，以及 M700 瞄具和弹鼓配件。

## 安装

1. 从 [Releases](https://github.com/Skydeps1459/Modern-Warfare-4-TACZ-GunPack/releases)
   下载 `Modern Warfare 4-<version>.zip`。
2. 把 zip 原样放进实例的 `.minecraft/tacz/` 目录，不要解压。
3. 启动游戏，或执行 `/tacz reload`。更新已加载的枪包时先完全退出游戏。

枪包以正式版 Forge 1.20.1 TACZ `1.1.8` 为语义基线。

## 仓库联动网页

`web/` 内是一个零运行时依赖的 Node.js 后端，并会自动发布 GitHub Pages
静态版本：

- 直接读取仓库内的 `gunpack_info.json`、枪械索引、语言文件和槽位图标。
- 通过 GitHub API 同步仓库状态、Stars、最近发布日期和 Release 下载资源。
- 首页展示最近 3 次枪包 Release；独立枪包日志同步完整版本内容与 bug 修复记录。
- 网页自身功能更新写入 `web/website-updates.json`，在独立“网页更新”页展示，
  并在主页底部展示最近 3 条；不进入枪包日志，也不提供网站文件下载。
- 网页打开时每 5 分钟自动刷新数据，GitHub Pages 每 5 分钟重建静态快照。
- 提供枪包清单 API、图标 API 和最新版本下载跳转。
- 主下载按钮使用每日自动筛选并提交到仓库的最快稳定节点，GitHub 原链保留为备用。
- 国内用户可通过蓝奏云分流下载，网页会显示当前分享密码。
- 包含响应式中文展示页、健康检查、自动化测试和 Dockerfile。

下载后如果提示动画文件损坏或出现 GeckoLib 报错，先按
[`docs/troubleshooting.md`](./docs/troubleshooting.md) 用
`python tools/verify_gunpack_zip.py <枪包.zip>` 核对文件完整性

从仓库根目录启动：

```powershell
node web/server.mjs
```

打开 `http://localhost:3000`。更多配置与部署方法见
[`web/README.md`](./web/README.md)。

可用环境变量：

- `PORT`：HTTP 端口，默认 `3000`
- `GITHUB_OWNER` / `GITHUB_REPO`：覆盖 `web/config.json` 中的仓库坐标
- `GITHUB_TOKEN`：可选，提高 GitHub API 匿名调用限额

### 分流后台

Node.js 后端提供 `/admin/` 蓝奏云分流管理页，使用 GitHub OAuth 登录。
后台只接受仓库所有者不可变的 GitHub 用户 ID `317516594`，不接受其他账号。
保存时使用登录用户自己的 `public_repo` 权限提交 `web/domestic-mirror.json`，
浏览器不会接触仓库写密钥。OAuth 配置与部署方法见
[`web/admin/README.md`](./web/admin/README.md)。

## 目录

```text
assets/mw4/                模型、动画、贴图、音效、显示与语言文件
data/mw4/                  枪械数据、索引、配方、标签与 Lua 脚本
web/                       仓库联动网页与 Node.js 后端
.github/workflows/         网页后端 CI
```

## 开发校验

```powershell
node --test web/test/server.test.mjs
python tools\repack_main.py
```

`tools\repack_main.py` 会自动排除 `web/`、`.github/`、`.git/`、
`node_modules/` 和所有 `.bak*` 文件，确保网页源码不会混入 TACZ zip。

## License

授权按内容类型区分：

- 枪包模型、动画、贴图、音效及 `assets/mw4/`、`data/mw4/` 下的枪包内容遵循
  TACZ 官方使用 **GPL-3.0**，见
  [`GUNPACK-LICENSE.md`](./GUNPACK-LICENSE.md) 与
  [`GUNPACK-LICENSE.txt`](./GUNPACK-LICENSE.txt)。
- 网站源码、构建脚本和文档使用 [MIT License](./LICENSE)。
- 第三方游戏名称、原始模型、贴图和音效的权利仍归各自权利人所有。

