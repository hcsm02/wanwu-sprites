# 玩悟精灵 Wanwu Sprites

亲子活动抽卡 + 成长记录的前后端分离 MVP。

## 核心定位

> 每天不用想，抽一张就能玩；玩完不用写作文，一句话也能保存。

## 设计原则

- **少选择**：AI 推荐一个最合适的活动，不让家长筛选一堆分类。
- **低门槛**：活动 3 步以内，默认 5-15 分钟、少材料或无材料。
- **手机优先**：大按钮、卡片式布局、单手可操作。
- **先保存再美化**：家长只需要选心情、写一句话，AI 帮忙整理成简短记忆。

## 项目结构

```text
wanwu-sprites/
├─ frontend/          # React + Vite + TypeScript
├─ backend/           # FastAPI + SQLite
├─ data/              # SQLite 数据目录
├─ docker-compose.yml # 可选：Docker 启动
└─ README.md
```

## 本地启动

### 1. 启动后端

```bash
cd backend
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env
uvicorn app.main:app --reload --port 8000
```

后端地址：

```text
http://localhost:8000
```

### 2. 启动前端

```bash
cd frontend
npm install
npm run dev
```

前端地址：

```text
http://localhost:5173
```

## AI 配置

后端默认可以在没有 API Key 的情况下运行，会使用内置示例数据。

如需启用 AI，在 `backend/.env` 中配置：

```env
OPENAI_API_KEY=你的密钥
OPENAI_MODEL=gpt-4.1-mini
```

## Docker 启动

```bash
docker compose up --build
```

访问：

```text
http://localhost:5173
```

## 当前 MVP 功能

| 模块 | 功能 |
|---|---|
| 首页 | 大按钮抽卡，少量快捷状态芯片 |
| 玩精灵 | 推荐一个低门槛亲子活动 |
| 活动卡 | 3 步以内、一个亲子提问、一个记录提示 |
| 完成页 | 一键标记完成 |
| 悟精灵 | 情绪选择 + 一句话记录 |
| AI 记忆 | 将一句话整理成简短亲子记忆 |
| 历史记录 | 保存并回看记录 |

## API 简表

| 方法 | 路径 | 说明 |
|---|---|---|
| POST | `/api/auth/register` | 用用户名、手机号、密码注册账号并返回登录态 |
| POST | `/api/auth/login` | 用手机号、密码登录已有账号并返回登录态 |
| GET | `/api/auth/me` | 获取当前登录用户 |
| GET | `/health` | 健康检查，返回数据库实际落点、用户数与 LLM 配置状态 |
| GET | `/health?check_ai=true` | 在健康检查基础上额外执行一次 LLM 轻量连通性测试 |
| POST | `/api/activity/recommend` | 推荐活动卡 |
| POST | `/api/records` | 保存记录并生成记忆 |
| GET | `/api/records` | 获取当前登录用户的历史记录 |
