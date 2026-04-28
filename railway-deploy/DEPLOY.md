# Railway 部署指南

## 1. 准备工作

### 创建 GitHub 仓库
1. 打开 https://github.com/new
2. 仓库名称：`novel-writer-backend`
3. 选择 Private
4. 点击 Create repository

### 推送代码
```bash
cd railway-deploy
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/novel-writer-backend.git
git push -u origin main
```

## 2. Railway 部署

### 创建 Railway 项目
1. 打开 https://railway.app
2. 登录（可用 GitHub 账号）
3. 点击 "New Project" → "Deploy from GitHub repo"
4. 选择刚创建的仓库 `novel-writer-backend`

### 配置环境变量（重要！）
在 Railway 项目设置中添加：

| 变量名 | 值 |
|--------|-----|
| `PORT` | `5000` |
| `NODE_ENV` | `production` |

### 等待部署
- Railway 会自动构建和部署
- 等待 2-3 分钟
- 部署成功后，你会获得一个 URL：`https://xxxxx.railway.app`

## 3. 测试部署

```bash
curl https://xxxxx.railway.app/api/v1/health
```

应该返回：`{"status":"ok"}`

## 4. 配置前端

部署成功后，把 URL 配置到前端：

1. 修改 `client/screens/writing/index.tsx`：
```typescript
const API_BASE_URL = 'https://xxxxx.railway.app';
```

2. 修改 `client/screens/settings/index.tsx`：
```typescript
const API_BASE_URL = 'https://xxxxx.railway.app';
```

3. 重新构建前端或本地测试

## 5. 免费额度

Railway 免费额度：
- 500小时/月
- 1GB 内存
- 足够个人使用

## 常见问题

### 部署失败
检查日志：
1. Railway 控制台 → Deployment → Logs
2. 常见错误：依赖安装失败、端口配置错误

### API 返回 404
确保使用 `/api/v1/` 前缀，例如：
- `https://xxxxx.railway.app/api/v1/agents`
- `https://xxxxx.railway.app/api/v1/writing/generate`
