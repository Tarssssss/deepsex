# 部署 DeepSex(容器平台)

这个 app 是个**真·编程 agent**:它会写文件、跑 shell 命令(`run_command`)。所以它需要
**长驻进程 + 可写文件系统 + 真 shell** —— 容器平台(Railway / Render / Fly.io / VPS)是对的,
Vercel 那种 serverless 不行(只读 FS、每次请求可能换实例,workspace 不连贯)。

仓库里已经备好:`Dockerfile`、`.dockerignore`、`railway.json`、`render.yaml`。

---

## 方式 A:Railway(最省事,推荐)

1. https://railway.app → **New Project → Deploy from GitHub repo** → 选 `Tarssssss/deepsex`。
2. Railway 自动识别 `Dockerfile`(由 `railway.json` 指定)并构建。
3. **Variables** 里加环境变量:
   - `DEEPSEEK_API_KEY` = 你的 key
   - (可选)`DEEPSEEK_DEFAULT_MODEL` = `deepseek-chat`
   - `AGENT_WORKSPACE` 不用设,镜像里已默认 `/app/workspace`
4. **Settings → Networking → Generate Domain**,拿到公网 URL。
   (`PORT` 由 Railway 自动注入,`next start` 会读它,无需手动配。)
5. 想让 agent 改的文件**重启后还在** → **Settings → Volumes**,挂一个卷到 `/app/workspace`。
   (不挂也能用,只是每次重新部署 workspace 会重置回种子 demo。)

## 方式 B:Render

1. https://render.com → **New → Blueprint** → 选这个 repo,会读 `render.yaml`。
2. 在 dashboard 填 `DEEPSEEK_API_KEY`(`render.yaml` 里标了 `sync:false`,不进 git)。
3. Free 套餐会在闲置后休眠、磁盘临时;要常驻 + 持久 workspace 就升级套餐并取消 `render.yaml`
   里 `disk:` 那几行的注释。

## 方式 C:本地 Docker 自测 / 自己的 VPS

```bash
docker build -t deepsex .
docker run -p 3000:3000 -e DEEPSEEK_API_KEY=sk-xxx deepsex
# 持久 workspace:  -v deepsex-workspace:/app/workspace
```

---

## ⚠️ 安全(你选了「自己控制访问」,所以重点说一遍)

公网 URL + 无鉴权 = **任何拿到链接的人都能通过 `run_command` 在你的容器里跑任意 shell**,
包括把环境变量里的 `DEEPSEEK_API_KEY` 打印出来偷走。所以:

- **别把 URL 公开传播**,只给自己/可信的人,用完可以删掉服务。
- 把它当**一次性、可丢弃**的容器:不要在里面放任何别的密钥/数据。
- 这个 key 已经在本地和对话里出现过 —— 真要长期挂着,**去 DeepSeek 平台轮换一把新 key**,
  并给这个部署单独用。
- 想更稳:之后给它加个简单登录(Basic Auth / 一个中间件密码门),或在 `lib/tools.ts` 里
  把 `run_command` 关掉 / 加命令白名单。需要的话我可以帮你加。
