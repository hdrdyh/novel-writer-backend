FROM node:20-alpine

WORKDIR /app

# 复制 package.json
COPY server/package.json ./

# 安装所有依赖（包括 devDependencies）
RUN npm install --include=dev

# 复制源代码
COPY server/src ./src

# 暴露端口
EXPOSE 5000

# 设置环境变量
ENV PORT=5000

# 启动命令
CMD ["npx", "tsx", "src/index.ts"]
