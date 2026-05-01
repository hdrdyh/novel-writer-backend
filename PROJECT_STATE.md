# 写作大师 - 项目状态文档

> 新会话启动时优先阅读此文件，避免重复探索。

## 项目概述
AI 小说协作写作 App，用户输入大纲，多个 AI 助手协作完成小说。

## 目录结构（关键文件）
```
client/
  screens/
    outline/index.tsx       # 大纲输入页（首页）
    writing/index.tsx       # 写作过程页（SSE流式输出）
    agent-config/index.tsx  # 助手配置页（~1400行，最复杂的页面）
  utils/
    presetAgents.ts         # 预设助手定义（PresetAgent类型 + AgentConfig接口 + PRESET_AGENTS数组）
    agentOrchestrator.ts    # 助手编排器（SSE调用LLM，规则传递）
    glassColors.ts          # 暗色主题配色常量 GC
  components/
    Screen.tsx              # 页面容器组件（必用）
app/
  (tabs)/_layout.tsx        # 3个Tab：大纲、协作、我的
  (tabs)/index.tsx → outline
  (tabs)/collab.tsx → agent-config
  (tabs)/profile.tsx → profile
server/
  src/index.ts              # Express后端，/api/v1 前缀
```

## 核心数据流
1. 用户在大纲页填写大纲 → 写作页点击"开始写作"
2. 前端调用 `orchestrateAgents()` → 读取 AsyncStorage 中的助手配置
3. 按 presetId 匹配规则 → 组装 system prompt → SSE 调用 LLM
4. onAgentChunk 回调只显示写手/润色师的输出（过滤掉统筹/架构师等中间参考）

## 已修复的关键 Bug（勿复现）
- **AsyncStorage 数据格式**：存的是 `AgentConfig[]` 数组，不是 Record。必须用 `c.presetId` 作为 key 建映射，不能用 `a.id`
- **resolveApiConfig**：PresetAgent 没有 `apiId` 字段，必须从 override 中读取 `overrideApiId`
- **onAgentChunk**：必须传 `agentName` 参数，前端只显示包含"写手"或"润色"的文本块

## 助手配置页功能清单
- 3个Tab：核心助手 / 协作助手 / API管理
- 每个助手卡片：中文名 + 描述 + API绑定 + 测试按钮 + 开关
- 展开/折叠：点击卡片展开规则编辑区
- 智能搭配：根据题材自动推荐助手组合
- 导入模板：5个内置预设 + 文本粘贴导入
- 导出：将当前配置导出为文本模板
- 测试规则：双重验证（读存储 + LLM复述）

## 样式约定
- 暗色主题，配色用 `GC` 常量（glassColors.ts）
- 样式变量 `const s = StyleSheet.create({...})`
- 不使用 emoji，用文本标记如【通过】【失败】
- 不使用英文 agent 名，只用中文名

## 模板格式
```
=== 写手 ===
启用
规则文本...

=== 统筹 ===
禁用
规则文本...
```

## 主题配色 GC 常用值
- GC.bgBase: 主背景  GC.surface: 卡片背景
- GC.primary: 主色   GC.accent: 强调色
- GC.text: 主文字    GC.textSecondary: 次文字
- GC.bgInput: 输入框背景  GC.border: 边框色
