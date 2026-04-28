FROM node:20-alpine

WORKDIR /app

# 复制 package.json
COPY server/package.json ./

# 安装依赖
RUN npm install

# 复制源代码
COPY server/src ./src

# 暴露端口
EXPOSE 9091

# 启动命令
CMD ["npm", "start"]
