FROM node:20-alpine
WORKDIR /app

COPY server/package.json ./
RUN npm install

COPY server/src ./src

EXPOSE 5000
ENV PORT=5000

CMD ["npx", "tsx", "src/index.ts"]
