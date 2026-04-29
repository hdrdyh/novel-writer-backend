# 小说写作助手 - 稳定版本

## 当前版本信息

**版本**: v1.0 (stable分支)  
**部署地址**: https://novel-writer-backend-production-24e9.up.railway.app

## 分支说明

- `main` - 开发分支（可能不稳定）
- `stable` - 稳定版本分支（生产可用）

## 稳定版本包含功能

1. 前后端一体化部署
2. 6个Agent工作流（世界观→人物→情节→正文→审核→记忆）
3. 记忆上下文支持（章节连贯）
4. 写作台UI优化（缩小章纲、扩大正文）
5. 记忆库正文预览修复
6. 书架同步更新

## 更新stable版本的步骤

如果需要在stable分支上更新：
```bash
cd railway-deploy
git checkout stable
# 进行修改...
git add -A
git commit -m "描述"
git push origin stable
```

## 重要提醒

- 更新stable分支后，Railway会自动部署
- 部署地址不会变：https://novel-writer-backend-production-24e9.up.railway.app
- 如果需要回退：`git reset --hard ba0d431`
