#!/bin/bash
# 一键启动脚本：构建 + 启动Server（仅5000端口）
# 用法：bash scripts/start.sh

set -e

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SERVER_DIR="$PROJECT_ROOT/server"

# 杀掉旧进程
pkill -f "tsx watch.*index.ts" 2>/dev/null || true
sleep 2

# 启动Server
echo "启动Server（端口5000）..."
cd "$SERVER_DIR"
nohup npx tsx watch ./src/index.ts > /tmp/server.log 2>&1 &
SERVER_PID=$!

# 等待启动
for i in $(seq 1 30); do
  if curl -s http://localhost:5000/api/v1/health > /dev/null 2>&1; then
    echo ""
    echo "====================================="
    echo "  Server启动成功！"
    echo "  PID: $SERVER_PID"
    echo "  访问地址：http://localhost:5000"
    echo "====================================="
    exit 0
  fi
  sleep 1
done

echo "Server启动失败，查看日志：tail -50 /tmp/server.log"
exit 1
