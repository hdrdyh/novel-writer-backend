FROM node:20-alpine

WORKDIR /app

# 复制 package.json 和依赖文件
COPY server/package.json ./
COPY server/pnpm-lock.yaml ./

# 安装依赖
RUN npm install

# 复制源代码
COPY server/src ./src

# 暴露端口
EXPOSE 5000

# 设置环境变量
ENV PORT=5000

# 启动命令
CMD ["npm", "start"]
