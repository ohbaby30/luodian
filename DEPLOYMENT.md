# 落点 2.0.0 部署交接

**版本：** 2.0.0（Git tag：`v2.0.0`）

**当前状态：** 本地源码、2.0.0 文档、测试和生产构建已完成；GitHub 发布由本次版本操作完成。服务器是否已经运行 2.0.0，以重新上传并重建后的现场检查为准。

## 最新部署状态

- 2026-09-10：公共 GitHub 仓库 `https://github.com/ohbaby30/luodian` 已完成上传，公开仓库已包含 README 和 MIT LICENSE。
- 已在提交 `a2d9b39` 上创建并推送 `v1.0.0`，作为当前成功部署版本的恢复点。
- 2026-09-10：用户确认已在服务器完成上传、部署和实际测试，部署成功。
- 2026-09-11：针对截图要求补齐首页布局：左侧文案和新想法、右侧想法桌面、待收口/已收口折叠分组、两行标题和 GitHub 图标；本机生产构建与浏览器验收通过，服务器尚未复测。
- 2026-09-11：完成需求简报与专业问题分流改造；本机单元、构建和临时数据库工作流验收通过，服务器尚未同步或复测。
- 2026-09-11：顶部导航将“规则”改为“设置”，在设置与 GitHub 图标之间加入“已归档”分页；归档页支持查看、二次确认后单条删除和全部删除，首页“待收口想法”和“已收口想法”保持无删除按钮。本机检查完成，服务器尚未同步或复测。
- 2026-09-11：AI 配置拆为“普通 API 计量”和“Token Plan / Coding Plan”两个独立槽位；支持首次设置、设置页分别保存，两组同时完整时新想法首次分析前选择并绑定 Provider。本机测试、构建和初始化迁移复核通过，服务器尚未同步或复测。
- 2026-09-11：修正两个交付边界：已归档想法从首页“待收口想法”和“已收口想法”两组彻底排除，只保留在“已归档”页；普通 API 与 Token/Coding Plan 的测试反馈分别显示在各自按钮右侧，保存反馈单独显示。本机 21 个测试文件、64 个测试、TypeScript 检查和生产构建通过，待上传副本已重新同步，服务器尚未同步或复测。
- 2026-09-11：2.0.0 发布范围冻结；主技术栈保持不变，新增需求简报分流、Provider 兼容适配、双 Provider 绑定、委派/强制收口、归档管理和视觉改版。内部测试代码、测试资料、工作区规则、数据库、环境文件、密钥和运行数据不进入公共 GitHub 版本。
- 上述服务器状态来自用户现场实测反馈；本 Agent 未通过 SSH 独立复核服务器日志、容器状态、健康检查或真实 AI 请求。

## 交付文件

项目源目录：本仓库根目录。

服务器上传副本：本地工作区的 `待上传服务器/Project落点/`。

上传副本只包含源码、Docker 构建文件、Compose 文件、部署说明和必要配置，不包含 `node_modules`、`.next`、测试缓存、数据库、运行数据、API Key 或服务器密钥。

服务器目标目录：用户实际 Docker Compose 项目目录。公共文档不写死本机路径或服务器绝对路径；上传时请让 `Dockerfile` 和 `compose.yml` 直接位于目标目录根部，不要多嵌套一层项目目录。

## 当前实现说明

### 2.0.0 本次交付内容

- 保留 1.0 的单用户、局域网、Docker Compose 想法收口流程。
- 增加完整需求简报、技术问题自动分流、回答/委派追问和正常/强制收口流程。
- 增加普通 API 计量与 Token/Coding Plan 两组独立配置、协议选项、加密保存和按想法绑定。
- 增加“已归档”独立分页；归档想法从首页两个分组排除，只在归档页查看或删除。
- 增加 Markdown/JSON 导出、旧数据库幂等迁移、窄屏适配和山景背景 UI；两组 Provider 的连接测试反馈分别显示在各自按钮右侧。

### 技术栈变化

2.0 没有更换主技术栈，也没有新增外部运行时服务。仍使用 Next.js 15、React 19、TypeScript、Tailwind CSS、Zod、Node.js 22、Node 内置 SQLite 和 Docker Compose。变化集中在应用层：Provider 适配层、工作流接口、SQLite 迁移列和前端状态模型扩大；`package.json`/`package-lock.json` 的项目版本更新为 `2.0.0`。

### 2.0 踩过的坑与处理

- 上传副本曾落后于源码；即使重新创建容器，也只会把旧源码重新打包。现已按目录逐文件同步，并在更新时使用 `docker compose build --no-cache` 与 `--force-recreate`。
- 批量复制嵌套路由时曾把文件平铺到错误目录；现用明确目标路径和 parity 检查，要求 `Dockerfile`、`compose.yml` 直接位于服务器项目根目录。
- 旧数据库不能假设已有新列；启动脚本和应用初始化都使用幂等迁移，不删除旧想法、问答或密钥。
- 不同 Provider 对鉴权头、`max_tokens`/`max_completion_tokens`、JSON mode、thinking 和流式响应的约定不同；2.0 将这些差异集中到适配层，并拒绝空响应、非 JSON 和误返回 SSE。
- 两组测试连接共用反馈状态会互相覆盖；现在按 Provider 分开保存测试反馈，保存反馈单独保存。
- 归档数据曾被同时带入首页“已收口”组；现在首页分组只接受未归档想法，归档页使用专用接口。
- 公共仓库不能依赖“整目录 `git add .`”来发布；`AGENTS.md`、`tests/`、内部计划、设计草稿、环境文件、数据库和密钥均保持排除，只把脱敏后的项目文档显式纳入版本。

### 2.0 未实施

- 真实 Token Plan 凭证的最终现场调用不由本地合成 Provider 测试替代，仍需用有效凭证单独确认。
- 不包含多人账号、注册/邀请、每用户数据隔离、公开公网入口、HTTPS、反向代理、登录限流、CSRF/Origin 校验或 Provider SSRF 防护。
- 不包含自动部署、GitHub Actions、语音交互、独立 Android/iOS App、Ollama、本地模型、文件上传和外部服务集成。

- 首次设置和设置页可以分别填写“普通 API 计量”和“Token Plan / Coding Plan”两组配置；至少完成一组即可使用，两组都完整时新想法首次分析前会要求选择，并把选择绑定到该想法的后续流程。
- 设置页中的 API Key 填写原始值即可，不要手动添加 `Bearer`。普通接口默认生成 `Authorization: Bearer <API Key>`；Xiaomi MiMo Token Plan 会根据 Base URL 自动使用 `api-key: <API Key>`。
- API Base URL 会自动补齐 `/chat/completions`，应填写服务商提供的 OpenAI-compatible 基础地址。
- 普通 OpenAI-compatible 服务请求默认携带 `max_tokens: 4096`；MiMo 模型默认使用 `max_completion_tokens: 4096`、`response_format: { type: "json_object" }` 和 `thinking: { type: "disabled" }`，LongCat 默认关闭 thinking。
- 所有请求都显式设置 `stream: false`，服务端只接受非流式 JSON Chat Completions；空响应、非 JSON 和误返回 SSE 会显示可诊断错误，不再出现 `null.choices`。
- 设置页的“高级兼容设置”支持 `Authorization Bearer`、`api-key`、`x-api-key`，以及 `max_tokens`/`max_completion_tokens`、JSON mode 和 thinking 的自动/手动选择，覆盖其他 Token/Coding Plan 的常见差异。
- Xiaomi MiMo Token Plan 请使用官方页面提供的对应区域 Base URL 和 `tp-` Key；普通按量付费 API 的 `sk-` Key 与 Token Plan Key 相互独立，不能混用。
- 当前功能验收状态：Provider 兼容逻辑和错误处理已通过本地测试；真实 Token Plan Base URL 仍待使用有效凭证单独复测。
- “测试接口”要求服务商返回 JSON `{"ok":true}`。这可以确认接口不只是返回 HTTP 200，而是能按本项目约定返回结构化内容。
- 设置页的“访问密码”区域要求输入当前密码、新密码和确认密码；服务端验证当前密码后才会保存新的 bcrypt 哈希，当前登录不会被主动退出。
- AI 测试连接和保存设置的结果显示在 AI 接口卡片内部；两组 Provider 的测试结果互不覆盖，分别显示在各自测试按钮右侧，保存结果单独显示。公共布局已适配 iPhone Safari/Chrome 的窄屏、安全区和触摸输入。
- 2026-09-11 山景玻璃 UI 改版已加入：根布局按路径展示指定山景视频或 WebP 海报，视频失败/减少动态效果时回退海报；首页、登录、首次设置使用视频，创建想法、详情、设置和已归档页使用海报。首页按截图要求将新想法放在左侧文案下方，想法桌面移到右侧，并把待收口/已收口想法放入上下两个原生折叠组；只有未归档且状态为 `finalized` 的想法（已生成最终提示词）进入已收口组，已归档想法从首页两组排除，只在已归档页显示；首页卡片只显示标题、状态、适用类型和创建时间，不显示原始正文，两个首页分组不提供删除按钮。顶部导航将“规则”改为“设置”，在设置与 GitHub 图标之间增加“已归档”分页；分页展示全部已归档想法，每条右侧提供删除按钮，顶部提供二次确认后的全部删除。标题按逗号分成两行，右上角使用 GitHub 图标入口，目标为 `https://github.com/ohbaby30/luodian`。保留既有 API 和导出能力，同时增加 `/api/ideas/[id]/delegate`、`/api/ideas/[id]/force-finalize`、`/api/archived-ideas` 和 JSON 导出格式；归档页使用专用归档接口，首页只消费活动想法。
- 新需求分析使用 v2 完整简报；技术事实、路径、工具、版本、依赖、API、部署命令和发布位置自动列入 Agent 自行研究/决策，用户意图、范围、优先级、授权和验收方面的缺口才进入当前问题。详情页支持回答或“交给执行 Agent”，并保留委派列表。
- 正常收口要求核心字段（目标、交付物、范围内、验收标准）完整且没有 pending 问题；强制收口经过两次浏览器确认，把当前问题和缺口放入开放决策，并要求执行 Agent 使用可逆、保守的默认值。`turns.resolution` 迁移兼容旧库，Markdown/JSON 导出均保留分析和处理结果。
- 提示词版本的“复制”按钮优先使用 Clipboard API；在局域网 HTTP 或浏览器拒绝权限时，会回退到临时文本框复制，失败时显示长按文本复制提示。
- 2.0.0 代码修改涉及应用源码、数据库兼容迁移、部署说明和公开项目文档；不会删除已有 Docker 数据卷，更新时必须保留 `luodian_data`。内部测试资料、工作区规则、运行数据和密钥不属于公开发布内容。

## 启动

上传完整的 `待上传服务器/Project落点/` 目录内容后，在服务器项目目录执行：

```bash
docker compose build --no-cache luodian
docker compose up -d --force-recreate luodian
```

Compose 文件没有必填环境变量，因此 `up`、`down`、`ps`、`logs` 和 `config` 都使用同一套默认配置，不需要额外的 `--env-file`。

启动后检查：

```bash
docker compose ps
docker compose logs --tail=200 luodian
curl http://127.0.0.1:3088/api/health
```

局域网浏览器地址：

`http://<Debian服务器局域网IP>:3088`

首次打开网页后，创建访问密码并至少完成一组 AI 配置；如果两组都填写，后续新想法首次分析时选择本次使用的接口。

## 更新

保留服务器上的 `luodian_data` Docker 卷，只更新上传副本中的项目文件，然后在包含 `Dockerfile` 和 `compose.yml` 的项目根目录执行。源码不会挂载到容器里；本次更新使用无缓存构建并强制重建容器：

```bash
docker compose build --no-cache luodian
docker compose up -d --force-recreate luodian
```

如果仍然是旧版，再确认浏览器已刷新到新容器，并核对运行目录确实含有新版文件：

```bash
test -f components/ScenicBackdrop.tsx && echo "new source present"
test -f components/ProviderProfileFields.tsx && echo "dual provider source present"
grep -q 'home-layout' app/globals.css && echo "new stylesheet present"
grep -q 'status !== "archived"' lib/home.ts && echo "archived ideas excluded from home groups"
grep -q 'providerTestFeedback' components/SettingsClient.tsx && echo "provider test feedback is per provider"
docker compose ps
curl http://127.0.0.1:3088/api/health
```

不要执行 `docker compose down -v`，它会删除 `luodian_data` 数据卷。

## 查看与停止

```bash
docker compose ps
docker compose logs -f --tail=200 luodian
docker compose stop
docker compose down
```

`docker compose down` 只移除容器和网络，保留命名卷 `luodian_data`。

以下命令会删除落点的数据库、想法、提示词版本、个人规则和加密密钥，属于破坏性操作，执行前必须完成独立备份并再次确认：

```bash
docker compose down -v
```

## 数据、密钥和访问边界

- 持久化卷名称固定为 `luodian_data`。
- SQLite 数据库、个人想法、问答、分析快照、提示词版本和 API Key 加密密文均在该卷内。
- API Key 的解密密钥也在该卷内；备份数据库时必须同时保留该密钥文件，否则无法恢复 API Key。
- 访问密码只保存不可逆哈希。
- 首版端口直接面向局域网，未配置公网认证、HTTPS 或反向代理；不要把 3088 端口直接暴露到公网。
- Compose 默认监听所有宿主机网卡，是否允许局域网访问由服务器防火墙和网络拓扑决定。

## 文件清单

下面是 2.0.0 公共 GitHub 提交中的文件范围。`AGENTS.md`、`tests/`、`vitest.config.ts`、`findings.md`、`progress.md`、`task_plan.md`、`docs/`、数据库、环境文件和运行数据不在公共提交中。

```text
PROJECT.md
README.md
LICENSE
DEPLOYMENT.md
Dockerfile
compose.yml
.dockerignore
.gitignore
package.json
package-lock.json
next-env.d.ts
next.config.mjs
postcss.config.mjs
tailwind.config.ts
tsconfig.json
app/
components/
lib/
scripts/
```

## 验证边界

### 已完成的本机检查

- `npm test`：21 个测试文件、64 个本地单元测试通过（包含需求契约、技术分流、工作流事务、旧数据库迁移、导出、归档删除、Provider 适配、双配置选择与首次设置、结构化字段归一化和 UI 行为）；其中 Token Plan 测试只证明本地适配逻辑，不替代实际服务场景验收。
- `npm run typecheck`：TypeScript 检查通过。
- `npm run build`：Next.js 生产构建通过，API 路由和页面均已编译。
- 隔离本机 HTTP/页面验收：使用临时 `DATA_DIR` 和合成测试配置覆盖已归档页；新增验收确认顶部顺序为“设置 → 已归档 → GitHub”，归档列表可读取，活动想法删除返回 404，单条归档删除和全部删除均成功且活动想法保留。此前浏览器验收已覆盖首页、首次设置、登录、创建想法、想法详情和设置页；视频页能播放指定视频，功能页使用海报，AI 配置错误和设置保存反馈可见，390×844 与 320×640 窄视口无横向滚动，导航保持可见可点击，输入框为 16px。
- 本次 Provider 生产 HTTP 验收：临时 Next.js 服务配合本地假 Provider，标准 Bearer + `max_tokens` 和显式 `api-key` + `max_completion_tokens` 两条设置测试均返回 `{"ok":true}`；假 Provider 观察到请求包含 `stream: false`。这只验证应用运行时链路，不替代真实 Token Plan 凭证验收。
- `npm audit --omit=dev --audit-level=moderate`：生产依赖审计通过，发现 0 个漏洞。
- `scripts/init-db.mjs`：在临时 `DATA_DIR` 中成功创建 SQLite 数据库；`scripts/init-db.mjs` 和 `scripts/entrypoint.mjs` 语法检查通过。
- 源目录与待上传副本的交付运行文件一致；待上传副本不含 `node_modules`、`.next`、数据库或日志。`components/ProviderProfileFields.tsx` 是双 Provider 表单所需的新运行文件；归档首页过滤和两组 Provider 独立反馈的源码也已同步。
- 已检查 Compose、Dockerfile 和部署脚本内容；当前环境的 `docker` 命令不可用，未执行 `docker compose config`。

### 用户确认的服务器验收

- 2026-09-10，用户确认已在服务器完成上传、部署和实际测试，部署成功。
- 该结论是用户的服务器现场验收反馈；本 Agent 未连接服务器，也未独立读取服务器日志或运行状态。

### 当前待复测

- Token Plan 的 Base URL 实际功能场景尚未完成，待使用有效 `tp-` Key 单独复测后再更新本文件状态。

### 本 Agent 尚未独立复核

- 本次仅启动了使用临时 `DATA_DIR` 的本机 Next.js 生产 HTTP 服务；未在本机执行 Docker 镜像构建或容器启动。
- 用户已确认服务器部署和测试成功，但本 Agent 未独立复核真实 Debian 的镜像构建、容器启动、健康检查、局域网浏览器访问和真实 AI 接口调用细节；本次修正仍需按“无缓存构建 + 强制重建”重新上传后在服务器现场复测。
- 未独立读取服务器现有端口、防火墙和 Docker 版本；这些状态以用户服务器现场为准。

## 公共 GitHub 已发布 / 多用户改造计划（暂缓）

公共 GitHub 仓库已经发布并完成 MIT 许可标注；当前应用仍是单用户局域网版本，公开源码不等于已经具备公网服务安全性。本阶段不配置 GitHub Actions，也不执行服务器迁移或多人化改造。

后续公共仓库整理至少需要：

- 排除 API Key、SQLite 数据库、`.luodian-key`、`luodian_data` 和 `待上传服务器/` 副本。
- 增加提交前密钥扫描，限制 GitHub Actions 权限，并固定第三方 Action 版本来源。
- 如果应用要开放给多人，增加用户注册/邀请、登录与密码生命周期、每用户数据隔离，以及所有 API 的资源归属校验。
- 公网部署前补齐 HTTPS、Secure Cookie、登录限流、CSRF/Origin 校验、API Key 按用户隔离加密、Provider 地址白名单与 SSRF 防护、备份和隐私说明。

当前 `luodian_data` 仍是单用户局域网版本的数据边界；未来改造必须保留数据迁移和回滚方案，不能直接把现有全局数据模型暴露到公网。
