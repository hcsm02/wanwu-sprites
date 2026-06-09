#!/bin/bash
# deploy.sh
# 一键部署 Wanwu Sprites 源代码（后端 + 前端）

# ---------- 配置 ----------
GIT_REPO="https://github.com/hcsm02/wanwu-sprites.git"
PROJECT_DIR="/opt/wanwu-sprites"

# 后端
BACKEND_DIR="$PROJECT_DIR/backend"
PYTHON_BIN="python3"
VENV_DIR="$BACKEND_DIR/.venv"
UVICORN_HOST="0.0.0.0"
UVICORN_PORT=8000

# 前端
FRONTEND_DIR="$PROJECT_DIR/frontend"
NODE_BIN="node"
NPM_BIN="npm"
FRONTEND_BUILD_DIR="$FRONTEND_DIR/dist"
VITE_PORT=5174

# ---------- 更新代码 ----------
echo ">>> 拉取最新代码..."
if [ -d "$PROJECT_DIR/.git" ]; then
    cd "$PROJECT_DIR"
    git reset --hard
    git pull
else
    git clone "$GIT_REPO" "$PROJECT_DIR"
fi

# ---------- 后端依赖 ----------
echo ">>> 配置后端环境..."
cd "$BACKEND_DIR"
if [ ! -d "$VENV_DIR" ]; then
    $PYTHON_BIN -m venv .venv
fi
source "$VENV_DIR/bin/activate"
pip install --upgrade pip
pip install -r requirements.txt

# ---------- 停掉旧后端 ----------
echo ">>> 停止可能残留的后端进程..."
PKID_LIST=$(lsof -ti tcp:$UVICORN_PORT)
if [ ! -z "$PKID_LIST" ]; then
    echo "找到旧进程: $PKID_LIST，正在杀掉..."
    kill -9 $PKID_LIST
fi

# ---------- 启动后端 ----------
echo ">>> 启动后端 uvicorn..."
# 后台运行并写日志
nohup uvicorn app.main:app --host $UVICORN_HOST --port $UVICORN_PORT > "$BACKEND_DIR/uvicorn.log" 2>&1 &

# ---------- 前端构建 ----------
echo ">>> 构建前端生产文件..."
cd "$FRONTEND_DIR"
$NPM_BIN install
$NPM_BIN run build

echo ">>> 部署完成"
echo "后端监听: http://$UVICORN_HOST:$UVICORN_PORT"
echo "前端生成目录: $FRONTEND_BUILD_DIR"
echo "查看后端日志: tail -f $BACKEND_DIR/uvicorn.log"