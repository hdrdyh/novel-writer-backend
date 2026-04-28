# 使用 Node.js 基础镜像
FROM node:20-alpine

# 设置工作目录
WORKDIR /app

# 复制 package.json
COPY server/package.json ./

# 安装依赖
RUN npm install

# 复制源代码
COPY server/tsconfig.json ./
COPY server/src ./src

# 编译 TypeScript
RUN npx tsc

# 暴露端口
ENV PORT=5000
EXPOSE 5000

# 启动命令 - 先编译再运行
CMD ["sh", "-c", "npx tsc && node dist/index.js"]
