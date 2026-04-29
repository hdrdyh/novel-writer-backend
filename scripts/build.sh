#!/bin/bash
# 一键构建脚本：导出前端 + 复制到server/public
# 用法：bash scripts/build.sh

set -e

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CLIENT_DIR="$PROJECT_ROOT/client"
SERVER_DIR="$PROJECT_ROOT/server"

echo "====================================="
echo "  一键构建：前端导出 + 部署到Server"
echo "====================================="

# 1. 导出前端静态文件
echo ""
echo "[1/2] 导出前端静态文件..."
cd "$CLIENT_DIR"
npx expo export --platform web

# 2. 复制到server/public
echo ""
echo "[2/2] 复制到 server/public..."
rm -rf "$SERVER_DIR/public"
cp -r "$CLIENT_DIR/dist" "$SERVER_DIR/public"

echo ""
echo "====================================="
echo "  构建完成！"
echo "  启动方式：cd server && pnpm run dev"
echo "  访问地址：http://localhost:5000"
echo "====================================="
