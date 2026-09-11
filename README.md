# 落点

**当前版本：2.0.0**

落点是一个面向个人使用的想法收口工作台。你可以先记录一个模糊想法，再回答真正会改变结果的问题，最后整理出可直接交给 AI 使用的提示词。

它适合把零散念头、需求和待办问题整理成更清楚的下一步，尤其适合在可信局域网里由一个人长期使用。

## 功能与边界

- 记录想法，并按步骤补充背景、目标和关键约束。
- 通过兼容 OpenAI Chat Completions 的接口辅助分析和整理。
- 支持同时保存普通 API 计量和 Token/Coding Plan 两组配置，也支持 Token/Coding Plan 常见的鉴权头、输出参数、JSON mode 和 thinking 差异；高级兼容设置可按服务商文档覆盖。
- 输出包含目标、背景、交付物、范围、优先级、假设和验收标准的完整需求简报。
- 技术事实、路径、工具、版本和发布位置等事项自动列入“Agent 自行研究 / 决策”；用户只需要确认会改变意图、范围、优先级或授权的内容。
- 保存问答过程、想法状态和提示词版本，便于继续修改或导出。
- 当前问题可以回答，也可以手动交给执行 Agent；确实不能继续等待时，可在二次确认后强制收口。
- 支持 Markdown 和 JSON 导出，导出内容包含分析结果和每条问题的处理状态。
- 顶部导航提供“已归档”分页，展示已归档想法；支持二次确认后删除单条或全部已归档想法。
- 使用访问密码保护工作台，API Key 加密保存在本地数据卷中。

这是一个单用户、可信局域网工具，不是公开的多人服务。默认没有公网域名、HTTPS 反向代理或多用户权限系统；不要把端口直接暴露到互联网。

## 部署要求

本文以 Debian 服务器为例，需要：

- Docker Engine
- Docker Compose plugin，也就是 `docker compose` 命令
- 至少一组可用的 OpenAI 兼容 API 地址、模型名称和 API Key

服务器不需要预装 Node.js 或 npm，应用会在 Docker 构建阶段安装依赖并完成生产构建。

## 下载

```bash
git clone https://github.com/ohbaby30/luodian.git
cd luodian
```

## 启动

先检查 Compose 配置，再构建并启动：

```bash
docker compose config
docker compose up -d --build
docker compose ps
curl http://127.0.0.1:3088/api/health
```

健康检查返回成功后，在浏览器打开：

```text
http://<Debian服务器局域网IP>:3088
```

第一次打开时，按页面提示设置：

1. 落点访问密码，至少 8 位。
2. “普通 API 计量”配置，填写 OpenAI 兼容接口地址、模型名称和 API Key；或者填写下面的 Token/Coding Plan 配置。
3. “Token Plan / Coding Plan”配置可以单独填写，也可以和普通 API 同时填写。

API Key 在网页中填写原始值即可，不需要手动追加 `Bearer`。普通接口默认使用 `Authorization: Bearer` 和 `max_tokens`；识别到 Xiaomi MiMo Token Plan 地址时，自动使用 `api-key` 和 `max_completion_tokens`。其他 Token/Coding Plan 可在各自配置卡的“高级兼容设置”里手动选择鉴权头、输出参数、JSON mode 和 thinking。只填写一组时落点自动使用；两组都填写时，新想法第一次分析前会让你选择，后续会沿用该选择。保存后进入工作台；后续可在设置页分别修改两组配置。

首页的“待收口想法”和“已收口想法”不提供删除按钮。已经归档的想法在顶部“已归档”分页中管理；删除会同时删除该想法保存的问答、分析快照和提示词版本，浏览器会在执行前要求二次确认。

归档后的想法不会出现在首页的任一分组中；首页“已收口想法”只显示尚未归档、已经生成最终提示词的想法。设置页中两组 AI 配置各自有独立的“测试连接”按钮，测试结果显示在对应按钮右侧，保存结果单独显示。

### 修改端口

默认端口是 `3088`。如果该端口已被占用，可以换成其他宿主机端口：

```bash
LUODIAN_PORT=8088 docker compose up -d --build
```

之后使用 `http://<Debian服务器局域网IP>:8088` 访问。

## 日常更新与管理

查看容器状态和日志：

```bash
docker compose ps
docker compose logs -f --tail=200 luodian
```

从 GitHub 获取新版本并重新构建：

```bash
git pull --ff-only
docker compose up -d --build
```

## 故障排查

### `docker compose config` 报错

确认当前目录是项目根目录，并确认 Docker Compose plugin 已安装。这个命令只检查配置，不会启动容器。

### 容器没有正常运行

先看状态和最近日志：

```bash
docker compose ps
docker compose logs --tail=200 luodian
```

如果刚修改过代码或更新过版本，重新执行：

```bash
docker compose build --no-cache luodian
docker compose up -d --force-recreate luodian
```

### 健康检查失败

在服务器上执行：

```bash
curl http://127.0.0.1:3088/api/health
```

如果本机成功、其他设备打不开，通常是服务器防火墙或局域网访问路径问题；检查宿主机是否允许对应端口，以及浏览器使用的是否是服务器局域网 IP。

### 端口被占用

查看 `docker compose ps` 或启动日志中的端口错误，然后使用 `LUODIAN_PORT` 换一个未占用的端口，重新启动并用新端口访问。

### AI 分析报错

在设置页分别检查“普通 API 计量”和“Token Plan / Coding Plan”的接口地址、模型名称和 API Key。接口必须兼容 OpenAI Chat Completions；不要把完整的 `Bearer` 前缀手动填进 API Key 字段。Xiaomi MiMo Token Plan 要使用 Token Plan 页面提供的专属 `tp-` Key 和对应区域 Base URL，不能把普通付费接口的 `sk-` Key 混用。其他服务商如果协议不同，可在对应配置卡打开“高级兼容设置”按文档调整。还应确认服务器能访问所选接口，必要时查看：

```bash
docker compose logs --tail=200 luodian
```

如果页面列出了“Agent 自行研究 / 决策”事项，说明这些是可以由执行 Agent 查证或选择的技术细节，不是必须由用户回答的问题。只有仍会改变用户意图、范围、优先级、受众、授权或验收的事项才会进入当前关键问题。确实需要先产出版本时，可以在详情页使用“强制收口并生成”，但未确认内容会被记录为开放决策，执行 Agent 会采用保守默认值。

旧版本数据库升级时，启动脚本会为追问记录补充 `resolution` 字段，并按已有回答回填为 `answered` 或 `pending`；不会删除想法、问答或提示词版本。

旧版本设置表启动时会自动补充 `provider_options_json` 和 `provider_profiles_json` 列，旧版想法表会补充 `provider_kind` 列；旧的单配置会继续作为兼容配置读取，不会删除已保存的 API Key。新建或重新分析想法时，如果两组配置都完整，落点会要求选择本次使用的接口，并把选择绑定到该想法。

## 数据与隐私

Compose 会创建名为 `luodian_data` 的 Docker 数据卷，用于保存 SQLite 数据、想法内容、问答记录、提示词版本以及加密 API Key 所需的数据密钥。不要把这个数据卷、运行时数据或 API Key 上传到 GitHub。

## 停止与结束运行

暂时停止容器但保留数据：

```bash
docker compose stop
```

停止并移除容器与网络，但保留 `luodian_data` 数据卷：

```bash
docker compose down
```

只有确认不再需要数据时才执行：

```bash
docker compose down -v
```

`docker compose down -v` 会删除 `luodian_data` 数据卷，可能导致想法、配置和 API Key 数据丢失。执行前请先完成备份。
