# 落点

落点是一个面向个人使用的想法收口工作台。你可以先记录一个模糊想法，再回答真正会改变结果的问题，最后整理出可直接交给 AI 使用的提示词。

它适合把零散念头、需求和待办问题整理成更清楚的下一步，尤其适合在可信局域网里由一个人长期使用。

## 功能与边界

- 记录想法，并按步骤补充背景、目标和关键约束。
- 通过兼容 OpenAI Chat Completions 的接口辅助分析和整理。
- 保存问答过程、想法状态和提示词版本，便于继续修改或导出。
- 使用访问密码保护工作台，API Key 加密保存在本地数据卷中。

这是一个单用户、可信局域网工具，不是公开的多人服务。默认没有公网域名、HTTPS 反向代理或多用户权限系统；不要把端口直接暴露到互联网。

## 部署要求

本文以 Debian 服务器为例，需要：

- Docker Engine
- Docker Compose plugin，也就是 `docker compose` 命令
- 一个可用的 OpenAI 兼容 API 地址、模型名称和 API Key

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
2. OpenAI 兼容接口地址，例如服务商提供的 `/v1` 地址。
3. 模型名称。
4. API Key。

API Key 在网页中填写并保存即可，不需要在浏览器请求里手动追加 `Bearer`。保存后进入工作台；后续可在设置页修改访问密码或 AI 接口。

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
docker compose up -d --build
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

在设置页检查接口地址、模型名称和 API Key。接口必须兼容 OpenAI Chat Completions；不要把完整的 `Bearer` 前缀手动填进 API Key 字段。还应确认服务器能访问该接口，必要时查看：

```bash
docker compose logs --tail=200 luodian
```

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
