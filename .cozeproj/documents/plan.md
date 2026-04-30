# 写作大师 - Agent协作系统重构计划

## 概述
重构Agent协作系统：13个预置Agent、统筹Agent自动编排、全流程Agent协作（大纲/粗纲/细纲/写作/评审）、实时进度+完成后报告。同时修复章节切换细纲不更新、已完成章节缺少重写功能等bug。

## 技术方案

| 维度 | 选择 | 理由 |
|------|------|------|
| Agent编排 | 前端编排（不走后端） | 用户明确要求不动后端 |
| 统筹决策 | B+C混合：预设规则默认+可选LLM建议 | 稳定且灵活 |
| Agent存储 | AsyncStorage `agentConfigs` + 新增 `presetAgents` | 预置不可删，用户可调参数 |
| 协作报告 | 实时进度区+完成后弹窗 | 用户要求两者都要 |
| 各阶段Agent调用 | 前端统一引擎 `orchestrateAgents()` | 所有阶段复用同一套编排逻辑 |

## 功能模块

### 1. 预置Agent定义（13个）

| Agent | 名称 | 核心职责 | 参与阶段 | 是否必须 |
|-------|------|---------|---------|---------|
| writer | 写手 | 写正文，唯一产出最终文字的角色 | 写作 | ✅不可删 |
| coordinator | 统筹 | 编排Agent流程，产出协作报告 | 所有阶段 | ✅不可删 |
| world_architect | 世界架构师 | 世界观、地理、城镇、势力 | 大纲/粗纲 | 推荐 |
| plot_designer | 剧情设计师 | 情节线、冲突、转折 | 大纲/粗纲/细纲 | 推荐 |
| character_designer | 人物设计师 | 人物性格、关系、成长弧 | 粗纲/细纲/写作 | 推荐 |
| rough_designer | 粗纲设计师 | 根据大纲设计章节粗纲 | 粗纲 | 推荐 |
| detail_designer | 细纲设计师 | 根据大纲+粗纲设计细纲 | 细纲 | 推荐 |
| memory_compressor | 记忆压缩 | 压缩前文为摘要，不产出内容 | 写作(长篇) | 推荐 |
| dialogue_designer | 对话设计师 | 角色对话风格和技巧 | 写作 | 可选 |
| scene_describer | 场景描写师 | 环境氛围描写 | 写作 | 可选 |
| pacing_controller | 节奏把控师 | 章节节奏和张力 | 写作/评审 | 可选 |
| foreshadow_designer | 伏笔设计师 | 伏笔布局和回收 | 细纲/写作 | 可选 |
| style_polisher | 风格润色师 | 最终润色统一风格 | 写作 | 可选 |

**必须Agent**（写手+统筹）：不可删除不可禁用
**推荐Agent**：默认启用，用户可禁用
**可选Agent**：默认关闭，用户可启用

### 2. 各阶段默认Agent组合

```
大纲阶段: 统筹 → 世界架构师 → 剧情设计师 → 统筹整合报告
粗纲阶段: 统筹 → 世界架构师 → 剧情设计师 → 粗纲设计师 → 统筹整合报告
细纲阶段: 统筹 → 剧情设计师 → 人物设计师 → 伏笔设计师 → 细纲设计师 → 统筹整合报告
写作阶段: 统筹 → 记忆压缩 → 世界架构师 → 人物设计师 → 对话设计师 → 场景描写师 → 写手 → 节奏把控师 → 风格润色师 → 统筹整合报告
评审阶段: 统筹 → 评审agents(用户配置) → 统筹整合报告
```

**编排规则**：
- 统筹始终第一个运行（决定流程），最后一个运行（出报告）
- 中间Agent按顺序串行执行，每个Agent的输出作为下一个Agent的上下文
- 记忆压缩不产出内容，产出前文摘要供写手参考
- 被禁用的Agent自动跳过

### 3. 统筹Agent工作流

**默认模式（预设规则）**：直接按上方组合执行，不调LLM决策。

**智能模式（LLM建议）**：
1. 统筹Agent接收当前阶段+可用Agent列表+已有内容
2. LLM输出：建议使用的Agent列表+执行顺序+理由
3. 弹窗展示建议，用户确认/修改后执行

### 4. Agent协作引擎 `orchestrateAgents()`

统一入口函数，所有阶段调用：
```typescript
interface OrchestrationParams {
  stage: 'outline' | 'rough' | 'detail' | 'writing' | 'review';
  context: string;           // 当前内容（大纲/粗纲/细纲/章纲）
  previousContent?: string;  // 前文（写作阶段用）
  chapterNumber?: number;    // 章节号（写作阶段用）
  onAgentStart: (name: string, idx: number, total: number) => void;
  onAgentChunk: (chunk: string) => void;
  onAgentComplete: (name: string, output: string) => void;
  onAllComplete: (report: CoordinatorReport) => void;
  onError: (error: string) => void;
}
```

**每个Agent的Prompt结构**：
- system: `你的角色：${agent.name}\n你的规则：${agent.prompt}\n你的职责边界：只做${agent.role}相关的工作，绝不越界`
- user: `已有参考材料：${前序Agent输出}\n当前任务：${stage对应的具体指令}\n细纲/大纲/粗纲：${context}`

### 5. 协作报告

**实时进度**：Agent进度区显示
```
[1/5] 🏗️ 世界架构师 - 设计中... 
[2/5] 🎭 人物设计师 - ✅ 已完成
[3/5] ✍️ 写手 - 生成中... ████░░░░
```

**完成后弹窗**（统筹报告，限200字）：
```
协作报告：
- 世界架构师：设计了3个主要城镇、2个势力
- 人物设计师：定义了5个角色的性格和关系
- 写手：基于以上设定完成第3章正文
- 节奏把控师：调整了3处节奏问题

意见反馈：[输入框] [提交]
```

### 6. Bug修复

**章节切换细纲不更新**：
- 单章模式 +/- 按钮切换时，从parsedDetail同步outlineInput
- 超出细纲范围弹出错误提示
- 切换时清空content，显示加载指示器

**已完成章节缺少重写功能**：
- done/reviewed状态增加醒目"重写"文字按钮
- 保存后可选从队列移除
- 单章模式有内容时也显示重写按钮

## 数据结构

### 预置Agent（存于代码常量，不可删）
```typescript
interface PresetAgent {
  id: string;           // writer, coordinator, world_architect...
  name: string;         // 写手, 统筹, 世界架构师...
  prompt: string;       // 预置的规则prompt
  role: string;         // 职责边界描述
  category: 'must' | 'recommended' | 'optional';
  stages: string[];     // 参与的阶段
  enabled: boolean;     // must类始终true，其他用户可调
  apiId?: string;       // 绑定的API配置
}
```

### 协作报告
```typescript
interface CoordinatorReport {
  stage: string;
  agents: { name: string; task: string; summary: string }[];
  totalTokens?: number;
  userFeedback?: string;
}
```

## 涉及文件
- `client/screens/writing/index.tsx` — 写作台重构
- `client/screens/outline/index.tsx` — 大纲/粗纲/细纲阶段接入Agent编排
- `client/screens/chapter-review/index.tsx` — 评审阶段接入Agent编排
- `client/screens/outline-review/index.tsx` — 评审阶段接入Agent编排
- `client/screens/agent-config/index.tsx` — Agent配置页重构（预置+自定义）
- `client/utils/agentOrchestrator.ts` — 新建，Agent协作引擎
- `client/utils/presetAgents.ts` — 新建，13个预置Agent定义

## 是否有原型设计
是 — 设计引导已开启，需先完成原型设计再开发

## 实施步骤

1. **阶段一：原型设计** — 加载design-canvas技能，设计Agent配置页(预置Agent列表+启用禁用)、写作台Agent进度区+统筹报告弹窗、章节切换交互的原型HTML
2. **创建预置Agent定义+协作引擎** — 新建 `presetAgents.ts`(13个Agent常量) 和 `agentOrchestrator.ts`(编排引擎，含SSE调用、进度回调、报告生成)
3. **重构Agent配置页** — 改为预置Agent列表(不可删，可调参数/启用禁用/绑定API) + 自定义Agent添加，`agent-config/index.tsx`
4. **重构写作台Agent编排+修复bug** — 写作台使用orchestrateAgents()，实时显示Agent进度，完成后弹统筹报告，修复章节切换细纲+重写按钮，`writing/index.tsx`
5. **重构大纲/评审阶段的Agent编排** — outline页AI扩写改用orchestrateAgents()，review页改用orchestrateAgents()，`outline/index.tsx` + `chapter-review/index.tsx` + `outline-review/index.tsx`
6. **静态检查 + 服务验证 + 全流程测试**
