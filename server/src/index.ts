import express from "express";
import cors from "cors";
import { z } from "zod";
import fs from "fs";
import path from "path";

const app = express();
const port = parseInt(process.env.PORT || '9091', 10);

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// ============== 数据存储 ==============
interface Chapter {
  id: string;
  chapterNumber: number;
  outline: string;
  content: string;
  summary: string;
  status: 'draft' | 'completed';
  createdAt: string;
  updatedAt: string;
}

interface Memory {
  id: string;
  chapterNumber: number;
  content: string;
  summary: string;
  createdAt: string;
}

interface Agent {
  id: string;
  name: string;
  role: string;
  prompt: string;
  enabled: boolean;
  order: number;
  apiId?: string;
}

// 内存存储（生产环境应使用数据库）
const chapters: Map<string, Chapter> = new Map();
const memories: Memory[] = [];
let agents: Agent[] = [
  {
    id: '1',
    name: '世界观架构师',
    role: 'system',
    prompt: `【世界观架构师】
负责设计故事背景、世界观设定、历史文明、地理环境等宏观架构。

【核心职责】
1. 设计完整的世界观：包括时代背景、地理环境、社会结构、势力分布
2. 规划地图信息：区域气候、建筑风格、势力范围
3. 建立世界观规则：魔法体系、科技水平、修炼等级等
4. 确保世界观的内部自洽性

【输出格式】
- 世界背景概述（200字内）
- 主要势力介绍
- 地图/区域划分
- 核心规则设定`,
    enabled: true,
    order: 1,
  },
  {
    id: '2',
    name: '人物设定师',
    role: 'character',
    prompt: `【人物设定师】
负责塑造角色性格、外貌特征、行为动机、技能设定与成长轨迹。

【核心职责】
1. 外貌描写：外貌锚点，不超过20字
2. 性格塑造：行为边界、说话风格、冷幽默风格
3. 技能卡设计：核心技能、战斗风格
4. 动机设定：欲望、恐惧、目标
5. 角色关系：与其他角色的互动动态

【外貌描写规则】
- 单次外貌描写不超过20字
- 使用特征性描写而非面面俱到
- 与角色性格保持一致

【冷幽默要求】
- 面瘫式幽默，禁止解释笑话
- 禁止挤眉弄眼、过度表情
- 用反差制造笑点`,
    enabled: true,
    order: 2,
  },
  {
    id: '3',
    name: '情节设计师',
    role: 'plot',
    prompt: `【情节设计师】
负责规划故事线、高潮转折、冲突设置与悬念埋设。

【核心职责】
1. 设计章节结构：起承转合、节奏把控
2. 埋设伏笔：在"本章±2章"范围内计划回收的伏笔
3. 设计冲突：角色对立、内心挣扎、外部威胁
4. 设置钩子：每章结尾必须留有悬念或转折点
5. 规划爽点：铺垫不超过500字

【节奏规则】
- 非关键转场不超过3句话
- 爽点前铺垫不超过500字
- 每章至少一处角色受损时刻
- 打斗场景不超过200字，不使用招式名

【伏笔管理】
- 记录伏笔内容和计划回收章节
- 确保伏笔最终被回收`,
    enabled: true,
    order: 3,
  },
  {
    id: '4',
    name: '文笔润色师',
    role: 'style',
    prompt: `【文笔润色师】
负责优化文字描写、对话风格、环境渲染与情感表达。

【核心职责】
1. 文字优化：简洁有力，避免啰嗦
2. 对话打磨：符合角色性格，自然流畅
3. 环境渲染：用细节营造氛围
4. 情感表达：通过动作和反应表现内心

【禁用词句】
- 禁用破折号（——）和分号（；），用逗号替代
- 禁用心理标签词："他感到""他觉得""他意识到"
- 禁用嗅觉描写："铁锈味""泥土芬芳""青草香""雨后空气"
- 禁止"某人说"式对话标签

【对话规则】
- 连续对话超过2句必须插入动作描写
- 对话要符合角色性格和说话习惯
- 用动作替代"说"字（点头、皱眉、摆手等）

【心理描写规则】
- 心理活动通过身体反应表现
- 例如：紧张→手心出汗、腿软；愤怒→握拳、发抖`,
    enabled: false,
    order: 4,
  },
  {
    id: '5',
    name: '审核校对师',
    role: 'review',
    prompt: `【审核校对师】
负责检查逻辑漏洞、错别字、角色一致性与违规内容。

【合规检查清单】
1. ✅ 无破折号/分号
2. ✅ 无"某人说"式对话标签
3. ✅ 无连续纯对话无动作（超过2句）
4. ✅ 无心理标签词（"他感到""他觉得""他意识到"）
5. ✅ 无嗅觉禁词（铁锈味、泥土芬芳、青草香、雨后空气）
6. ✅ 外貌描写不超过20字且与角色档案一致
7. ✅ 打斗无招式名、不超过200字
8. ✅ 结尾有钩子（悬念或转折）
9. ✅ 无AI指纹词（首先、其次、总之等）
10. ✅ 空间一致性（不出现位置矛盾）
11. ✅ 角色一致性（行为语言符合人设）

【质量检查】
- 冷幽默是否面瘫（无过度表情）
- 每章至少一处角色受损时刻
- 节奏合规（非关键转场不超3句）
- 智斗章节是否有关幽默、无语义复盘

【审核输出】
- 通过：输出"✅ 审核通过"
- 打回：列出具体违规位置和原因`,
    enabled: true,
    order: 5,
  },
  {
    id: '6',
    name: '记忆压缩师',
    role: 'memory',
    prompt: `【记忆压缩师】
负责将正文压缩成记忆卡片，便于后续章节调用。

【核心职责】
1. 提取关键信息：角色状态、情绪、持有物
2. 记录关系变化：配角动线、冲突结果
3. 更新钩子状态：已解决/未解决
4. 记录伏笔：已埋设/已回收

【记忆卡格式】（每项不超过30字，总计不超过400字）
1. 当前主角状态：（位置、伤势、持有物）
2. 情绪/欲望：（当前情绪、目标）
3. 配角动线：（其他角色的行动）
4. 最近冲突：（发生了什么）
5. 未解决钩子：（悬念列表）
6. 伏笔/线索：（埋下的伏笔）
7. 时间推移：（过了多久）
8. 空间坐标：（当前位置）
9. 关系变化：（关系如何改变）`,
    enabled: true,
    order: 6,
  },
];

// ============== LLM 调用 ==============
interface LLMConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
}

// 获取 LLM 配置（从请求头或环境变量获取）
const getLLMConfig = (req: express.Request): LLMConfig => {
  const apiKey = req.headers['x-api-key'] as string || process.env.LLM_API_KEY || 'sk-2d333ed0b01a4fe899df1c7c6cbe5617';
  const baseUrl = req.headers['x-base-url'] as string || 'https://api.deepseek.com';
  const model = req.headers['x-model'] as string || 'deepseek-v4-flash';
  return { apiKey, baseUrl, model };
};

// 调用 LLM（非流式）
async function callLLM(config: LLMConfig, systemPrompt: string, userPrompt: string): Promise<string> {
  if (!config.apiKey) {
    throw new Error('API Key 未配置');
  }

  const response = await fetch(`${config.baseUrl}/v1/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: config.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.7,
      max_tokens: 2000,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`LLM 调用失败: ${response.status} - ${error}`);
  }

  const data = await response.json() as any;
  return data.choices[0]?.message?.content || '';
}

// ============== 写作工作流 ==============

// 写作铁律
const WRITING_RULES = `【写作铁律 - 必须遵守】
1. 禁用破折号（——）和分号（；），用逗号替代
2. 外貌描写不超过20字
3. 连续对话必须插入动作描写
4. 心理活动通过身体反应表现
5. 禁用"他感到""他觉得""他意识到"等心理标签词
6. 打斗描写不超过200字，不使用招式名
7. 禁止使用"铁锈味""泥土芬芳""青草香""雨后空气"等嗅觉描写
8. 结尾必须留有钩子（悬念或转折点）`;

// 多Agent工作流定义
interface WorkflowStep {
  name: string;       // 步骤名称
  prompt: string;     // 使用的提示词
  output: string;     // 存储输出结果
}

// 调用LLM并获取完整响应（非流式，用于中间步骤）
async function callLLMComplete(config: LLMConfig, systemPrompt: string, userPrompt: string): Promise<string> {
  const response = await fetch(`${config.baseUrl}/v1/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: config.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.7,
      max_tokens: 2000,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`LLM 调用失败: ${response.status} - ${error}`);
  }

  const data = await response.json() as any;
  return data.choices[0]?.message?.content || '';
}

// 工作流节点3：代码硬过滤
function filterContent(content: string): { filtered: string; violations: string[] } {
  let filtered = content;
  const violations: string[] = [];

  // 替换禁用符号
  if (content.includes('——')) {
    violations.push('包含破折号');
    filtered = filtered.replace(/——/g, '，');
  }
  if (content.includes('；')) {
    violations.push('包含分号');
    filtered = filtered.replace(/；/g, '，');
  }

  // 检查嗅觉禁词
  const smellWords = ['铁锈味', '泥土芬芳', '青草香', '雨后空气'];
  for (const word of smellWords) {
    if (content.includes(word)) {
      violations.push(`包含嗅觉禁词: ${word}`);
    }
  }

  // 检查心理标签词
  const mentalWords = ['他感到', '他觉得', '他意识到'];
  for (const word of mentalWords) {
    if (content.includes(word)) {
      violations.push(`包含心理标签词: ${word}`);
    }
  }

  return { filtered, violations };
}

// 工作流节点8：生成记忆摘要
function generateSummary(content: string): string {
  // 简单截取前100字作为摘要
  return content.slice(0, 100) + (content.length > 100 ? '...' : '');
}

// ============== API 路由 ==============

// 健康检查
app.get('/api/v1/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 通用LLM代理（单次调用，SSE流式返回）
app.post('/api/v1/llm/chat', async (req, res) => {
  res.setHeader('X-Accel-Buffering', 'no');
  (res as any).flush?.();

  const schema = z.object({
    messages: z.array(z.object({
      role: z.enum(['system', 'user', 'assistant']),
      content: z.string(),
    })),
  });

  try {
    const data = schema.parse(req.body);
    const config = getLLMConfig(req);

    if (!config.apiKey) {
      return res.status(400).json({ error: 'API Key 未配置' });
    }

    // 设置 SSE 流式响应头
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-store, no-transform, must-revalidate');
    res.setHeader('Connection', 'keep-alive');

    const response = await fetch(`${config.baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model: config.model,
        messages: data.messages,
        stream: true,
        temperature: 0.7,
        max_tokens: 4096,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      res.write(`data: ${JSON.stringify({ type: 'error', content: errText })}\n\n`);
      res.write('data: [DONE]\n\n');
      res.end();
      return;
    }

    const reader = response.body?.getReader();
    if (!reader) {
      res.write('data: [DONE]\n\n');
      res.end();
      return;
    }

    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith('data: ')) continue;
        const dataStr = trimmed.slice(6);
        if (dataStr === '[DONE]') {
          res.write('data: [DONE]\n\n');
          continue;
        }
        try {
          const json = JSON.parse(dataStr);
          const content = json.choices?.[0]?.delta?.content;
          if (content) {
            res.write(`data: ${JSON.stringify({ type: 'chunk', content })}\n\n`);
          }
        } catch (e) {}
      }
    }

    res.write('data: [DONE]\n\n');
    res.end();
  } catch (error: any) {
    if (!res.headersSent) {
      res.status(500).json({ error: error.message || 'LLM调用失败' });
    } else {
      res.write(`data: ${JSON.stringify({ type: 'error', content: error.message })}\n\n`);
      res.write('data: [DONE]\n\n');
      res.end();
    }
  }
});

// 获取章节列表
app.get('/api/v1/chapters', (req, res) => {
  const chapterList = Array.from(chapters.values())
    .sort((a, b) => b.chapterNumber - a.chapterNumber);
  res.json({ chapters: chapterList });
});

// 创建/更新章节
app.post('/api/v1/chapters', (req, res) => {
  const schema = z.object({
    id: z.string().optional(),
    chapterNumber: z.number(),
    outline: z.string(),
    content: z.string().optional(),
    status: z.enum(['draft', 'completed']).optional(),
  });

  try {
    const data = schema.parse(req.body);
    const now = new Date().toISOString();
    const id = data.id || Date.now().toString();

    const chapter: Chapter = {
      id,
      chapterNumber: data.chapterNumber,
      outline: data.outline,
      content: data.content || '',
      summary: data.content ? generateSummary(data.content) : '',
      status: data.status || 'draft',
      createdAt: chapters.get(id)?.createdAt || now,
      updatedAt: now,
    };

    chapters.set(id, chapter);
    res.json({ chapter });
  } catch (error) {
    res.status(400).json({ error: 'Invalid request body' });
  }
});

// 删除章节
app.delete('/api/v1/chapters/:id', (req, res) => {
  const { id } = req.params;
  if (chapters.delete(id)) {
    res.json({ success: true });
  } else {
    res.status(404).json({ error: 'Chapter not found' });
  }
});

// 记忆上下文类型
const MemoryEntrySchema = z.object({
  role: z.string(),
  content: z.string(),
}).passthrough();

// 写作台 - 生成正文（多Agent工作流+流式）
app.post('/api/v1/writing/generate', async (req, res) => {
  // 禁用Express内置缓冲，确保SSE立即发送
  res.setHeader('X-Accel-Buffering', 'no');
  (res as any).flush?.();
  const schema = z.object({
    chapterId: z.string(),
    chapterNumber: z.number(),
    outline: z.string(),
    memoryContext: z.array(z.union([z.string(), MemoryEntrySchema])).optional(),
  });

  try {
    const data = schema.parse(req.body);
    const config = getLLMConfig(req);

    if (!config.apiKey) {
      return res.status(400).json({ error: 'API Key 未配置，请在设置中输入 API Key' });
    }

    // 设置 SSE 流式响应头
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-store, no-transform, must-revalidate');
    res.setHeader('Connection', 'keep-alive');

    // 定义多Agent工作流
    const workflowSteps: WorkflowStep[] = [
      {
        name: '世界观构建',
        prompt: `你是【世界观架构师】，负责设计故事背景、世界观设定。

【核心职责】
1. 设计完整的世界观：包括时代背景、地理环境、社会结构
2. 建立世界观规则：修炼体系、社会等级等
3. 确保世界观的内部自洽性

请根据以下章纲，输出一段世界观补充描述（100字以内）：`,
        output: '',
      },
      {
        name: '人物设定',
        prompt: `你是【人物设定师】，负责塑造角色。

【核心职责】
1. 外貌描写：不超过20字
2. 性格塑造：行为边界、说话风格
3. 动机设定：欲望、恐惧、目标

【冷幽默要求】
- 面瘫式幽默，禁止解释笑话
- 用反差制造笑点

请根据以下内容，输出主角的简短设定（50字以内）：`,
        output: '',
      },
      {
        name: '情节设计',
        prompt: `你是【情节设计师】，负责规划故事线。

【核心职责】
1. 设计章节结构：起承转合
2. 埋设伏笔：在"本章±2章"范围内
3. 设置钩子：每章结尾必须留有悬念

请根据以下章纲，设计本章的关键情节点（3句话概括）：`,
        output: '',
      },
      {
        name: '正文生成',
        prompt: `你是专业的小说作家，擅长创作精彩的网文小说。

请严格遵守以下写作规则生成正文内容。

【写作铁律】
1. 禁用破折号（——）和分号（；），用逗号替代
2. 外貌描写不超过20字
3. 连续对话必须插入动作描写
4. 心理活动通过身体反应表现
5. 禁用"他感到""他觉得""他意识到"等心理标签词
6. 打斗描写不超过200字，不使用招式名
7. 禁止使用"铁锈味""泥土芬芳""青草香""雨后空气"等嗅觉描写
8. 结尾必须留有钩子（悬念或转折点）
9. 保持冷幽默风格

请根据以下章纲创作本章正文，要求：
1. 总字数：2500-3500字
2. 分成3个段落，段落之间用空行分隔`,
        output: '',
      },
      {
        name: '审核校对',
        prompt: `你是【审核校对师】，负责检查内容质量。

【合规检查清单】
1. 无破折号/分号
2. 无"某人说"式对话标签
3. 无连续纯对话无动作（超过2句）
4. 无心理标签词（"他感到""他觉得""他意识到"）
5. 无嗅觉禁词（铁锈味、泥土芬芳、青草香、雨后空气）
6. 外貌描写不超过20字
7. 打斗无招式名、不超过200字
8. 结尾有钩子（悬念或转折）

请检查以下小说正文，输出"✅ 审核通过"或指出具体问题：`,
        output: '',
      },
      {
        name: '记忆存档',
        prompt: `你是【记忆压缩师】，负责将正文压缩成记忆卡片。

【记忆卡格式】（每项不超过30字）
1. 当前主角状态：（位置、伤势、持有物）
2. 情绪/欲望：（当前情绪、目标）
3. 未解决钩子：（悬念列表）
4. 伏笔/线索：（埋下的伏笔）

请为以下小说正文生成记忆卡片（总字数不超过200字）：`,
        output: '',
      },
    ];

    // 发送步骤信息
    const sendStep = (stepIndex: number, totalSteps: number, stepName: string, message: string) => {
      const eventData = `data: ${JSON.stringify({
        type: 'step',
        stepIndex,
        totalSteps,
        stepName,
        message,
      })}\n\n`;
      console.log('[STEP]', stepName, `${stepIndex}/${totalSteps}`);
      res.write(eventData);
      // 确保立即发送
      (res as any).flush?.();
    };

    try {
      // ====== 执行多Agent工作流 ======
      // 根据实际执行的步骤确定总数
      const actualSteps = workflowSteps.length;
      
      // 步骤1-3: 世界观、人物、情节（快速执行，不流式输出）
      for (let i = 0; i < 3; i++) {
        const step = workflowSteps[i];
        sendStep(i, actualSteps, step.name, `正在${step.name}...`);
        
        const memoryContext = data.memoryContext?.join('\n') || '';
        const fullPrompt = `${step.prompt}\n\n【章纲】${data.outline}\n\n${memoryContext ? `【记忆上下文】\n${memoryContext}` : ''}`;
        
        const output = await callLLMComplete(config, '', fullPrompt);
        workflowSteps[i].output = output;
        
        sendStep(i, actualSteps, step.name, output.slice(0, 50) + (output.length > 50 ? '...' : ''));
      }

      // 步骤4: 正文生成（流式输出，这是主要的小说内容）
      sendStep(3, actualSteps, '正文生成', '正在生成小说正文...');
      
      const writingStep = workflowSteps[3];
      const contextPrompt = `【世界观补充】
${workflowSteps[0].output}

【主角设定】
${workflowSteps[1].output}

【本章情节】
${workflowSteps[2].output}

【章纲】
${data.outline}

${data.memoryContext?.length ? `【记忆上下文】\n${data.memoryContext.join('\n')}` : ''}

请根据以上设定创作本章正文。`;

      const response = await fetch(`${config.baseUrl}/v1/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${config.apiKey}`,
        },
        body: JSON.stringify({
          model: config.model,
          messages: [
            { role: 'system', content: writingStep.prompt },
            { role: 'user', content: contextPrompt },
          ],
          temperature: 0.7,
          max_tokens: 4000,
          stream: true,
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        res.write(`data: ${JSON.stringify({ error: `LLM 调用失败: ${response.status}` })}\n\n`);
        res.end();
        return;
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        res.write(`data: ${JSON.stringify({ error: '无法读取响应流' })}\n\n`);
        res.end();
        return;
      }

      let fullContent = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const dataStr = line.slice(6);
            if (dataStr === '[DONE]') {
              workflowSteps[3].output = fullContent;
            } else {
              try {
                const parsed = JSON.parse(dataStr);
                const delta = parsed.choices?.[0]?.delta?.content;
                if (delta) {
                  fullContent += delta;
                  // 流式发送内容片段
                  res.write(`data: ${JSON.stringify({ type: 'chunk', content: delta })}\n\n`);
                }
              } catch (e) {
                // 忽略解析错误
              }
            }
          }
        }
      }

      workflowSteps[3].output = fullContent;
      sendStep(3, actualSteps, '正文生成', '正文生成完成');

      // 步骤5: 审核校对（快速执行）
      sendStep(4, actualSteps, '审核校对', '正在审核内容...');
      const reviewPrompt = `${workflowSteps[4].prompt}\n\n【正文】\n${fullContent.slice(0, 2000)}${fullContent.length > 2000 ? '...' : ''}`;
      const reviewResult = await callLLMComplete(config, '', reviewPrompt);
      workflowSteps[4].output = reviewResult;
      sendStep(4, actualSteps, '审核校对', reviewResult.slice(0, 50) + (reviewResult.length > 50 ? '...' : ''));

      // 步骤6: 记忆存档（快速执行）
      sendStep(5, actualSteps, '记忆存档', '正在存档记忆...');
      const memoryPrompt = `${workflowSteps[5].prompt}\n\n【正文】\n${fullContent}`;
      const memoryResult = await callLLMComplete(config, '', memoryPrompt);
      workflowSteps[5].output = memoryResult;
      sendStep(5, actualSteps, '记忆存档', memoryResult.slice(0, 50) + (memoryResult.length > 50 ? '...' : ''));

      // 最终过滤和保存
      const { filtered, violations } = filterContent(fullContent);

      const now = new Date().toISOString();
      const chapter: Chapter = {
        id: data.chapterId,
        chapterNumber: data.chapterNumber,
        outline: data.outline,
        content: filtered,
        summary: generateSummary(filtered),
        status: 'draft',
        createdAt: chapters.get(data.chapterId)?.createdAt || now,
        updatedAt: now,
      };
      chapters.set(data.chapterId, chapter);

      // 发送完成消息
      res.write(`data: ${JSON.stringify({
        type: 'done',
        content: filtered,
        violations,
        chapterId: data.chapterId,
        workflowOutputs: {
          worldbuilding: workflowSteps[0].output,
          characters: workflowSteps[1].output,
          plot: workflowSteps[2].output,
          review: workflowSteps[4].output,
          memory: workflowSteps[5].output,
        },
      })}\n\n`);

    } catch (error: any) {
      res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`);
    }

    res.end();

  } catch (error) {
    res.status(400).json({ error: 'Invalid request body' });
  }
});

// 保存章节到记忆库
app.post('/api/v1/memories', (req, res) => {
  const schema = z.object({
    chapterId: z.string(),
  });

  try {
    const data = schema.parse(req.body);
    const chapter = chapters.get(data.chapterId);

    if (!chapter) {
      return res.status(404).json({ error: '章节不存在' });
    }

    // 创建记忆
    const memory: Memory = {
      id: Date.now().toString(),
      chapterNumber: chapter.chapterNumber,
      content: chapter.content,
      summary: chapter.summary,
      createdAt: new Date().toISOString(),
    };

    memories.unshift(memory);
    res.json({ memory });
  } catch (error) {
    res.status(400).json({ error: 'Invalid request body' });
  }
});

// 获取记忆列表
app.get('/api/v1/memories', (req, res) => {
  res.json({ memories });
});

// 删除记忆
app.delete('/api/v1/memories/:id', (req, res) => {
  const { id } = req.params;
  const index = memories.findIndex(m => m.id === id);
  if (index !== -1) {
    memories.splice(index, 1);
    res.json({ success: true });
  } else {
    res.status(404).json({ error: 'Memory not found' });
  }
});

// 获取/更新 Agent 配置
app.get('/api/v1/agents', (req, res) => {
  res.json({ agents });
});

// 调整 Agent 顺序（必须放在 /agents/:id 之前）
app.put('/api/v1/agents/reorder', (req, res) => {
  const schema = z.object({
    orders: z.array(z.object({
      id: z.string(),
      order: z.number(),
    })),
  });

  try {
    const { orders } = schema.parse(req.body);
    
    orders.forEach(({ id, order }) => {
      const agent = agents.find(a => a.id === id);
      if (agent) {
        agent.order = order;
      }
    });

    // 按 order 排序返回
    const sortedAgents = [...agents].sort((a, b) => a.order - b.order);
    res.json({ agents: sortedAgents });
  } catch (error) {
    res.status(400).json({ error: 'Invalid request body' });
  }
});

app.put('/api/v1/agents/:id', (req, res) => {
  const { id } = req.params;
  const schema = z.object({
    name: z.string().optional(),
    prompt: z.string().optional(),
    enabled: z.boolean().optional(),
    order: z.number().optional(),
  });

  try {
    const data = schema.parse(req.body);
    const agent = agents.find(a => a.id === id);

    if (!agent) {
      return res.status(404).json({ error: 'Agent not found' });
    }

    if (data.name) agent.name = data.name;
    if (data.prompt) agent.prompt = data.prompt;
    if (typeof data.enabled === 'boolean') agent.enabled = data.enabled;
    if (typeof data.order === 'number') agent.order = data.order;

    res.json({ agent });
  } catch (error) {
    res.status(400).json({ error: 'Invalid request body' });
  }
});

// 删除 Agent
app.delete('/api/v1/agents/:id', (req, res) => {
  const { id } = req.params;
  const index = agents.findIndex(a => a.id === id);
  
  if (index === -1) {
    return res.status(404).json({ error: 'Agent not found' });
  }
  
  agents.splice(index, 1);
  res.json({ success: true });
});

// 添加 Agent
app.post('/api/v1/agents', (req, res) => {
  try {
    const { name, role, prompt, enabled, order, apiId } = req.body;
    
    if (!name || !role || !prompt) {
      return res.status(400).json({ error: '缺少必要参数: name, role, prompt' });
    }
    
    const maxOrder = agents.length > 0 ? Math.max(...agents.map(a => a.order)) : 0;
    
    const newAgent: Agent = {
      id: Date.now().toString(),
      name,
      role,
      prompt,
      enabled: enabled ?? true,
      order: order ?? maxOrder + 1,
      apiId: apiId ?? null,
    };
    
    agents.push(newAgent);
    res.json({ agent: newAgent });
  } catch (error) {
    res.status(400).json({ error: 'Invalid request body' });
  }
});

// 重置 Agent 到默认配置
app.post('/api/v1/agents/reset', (req, res) => {
  const defaultAgents: Agent[] = [
    {
      id: '1',
      name: '世界观架构师',
      role: 'system',
      prompt: `【世界观架构师】
负责设计故事背景、世界观设定、历史文明、地理环境等宏观架构。

【核心职责】
1. 设计完整的世界观：包括时代背景、地理环境、社会结构、势力分布
2. 规划地图信息：区域气候、建筑风格、势力范围
3. 建立世界观规则：魔法体系、科技水平、修炼等级等
4. 确保世界观的内部自洽性

【输出格式】
- 世界背景概述（200字内）
- 主要势力介绍
- 地图/区域划分
- 核心规则设定`,
      enabled: true,
      order: 1,
    },
    {
      id: '2',
      name: '人物设定师',
      role: 'character',
      prompt: `【人物设定师】
负责塑造角色性格、外貌特征、行为动机、技能设定与成长轨迹。

【核心职责】
1. 外貌描写：外貌锚点，不超过20字
2. 性格塑造：行为边界、说话风格、冷幽默风格
3. 技能卡设计：核心技能、战斗风格
4. 动机设定：欲望、恐惧、目标
5. 角色关系：与其他角色的互动动态

【外貌描写规则】
- 单次外貌描写不超过20字
- 使用特征性描写而非面面俱到
- 与角色性格保持一致

【冷幽默要求】
- 面瘫式幽默，禁止解释笑话
- 禁止挤眉弄眼、过度表情
- 用反差制造笑点`,
      enabled: true,
      order: 2,
    },
    {
      id: '3',
      name: '情节设计师',
      role: 'plot',
      prompt: `【情节设计师】
负责规划故事线、高潮转折、冲突设置与悬念埋设。

【核心职责】
1. 设计章节结构：起承转合、节奏把控
2. 埋设伏笔：在"本章±2章"范围内计划回收的伏笔
3. 设计冲突：角色对立、内心挣扎、外部威胁
4. 设置钩子：每章结尾必须留有悬念或转折点
5. 规划爽点：铺垫不超过500字

【节奏规则】
- 非关键转场不超过3句话
- 爽点前铺垫不超过500字
- 每章至少一处角色受损时刻
- 打斗场景不超过200字，不使用招式名

【伏笔管理】
- 记录伏笔内容和计划回收章节
- 确保伏笔最终被回收`,
      enabled: true,
      order: 3,
    },
    {
      id: '4',
      name: '文笔润色师',
      role: 'style',
      prompt: `【文笔润色师】
负责优化文字描写、对话风格、环境渲染与情感表达。

【核心职责】
1. 文字优化：简洁有力，避免啰嗦
2. 对话打磨：符合角色性格，自然流畅
3. 环境渲染：用细节营造氛围
4. 情感表达：通过动作和反应表现内心

【禁用词句】
- 禁用破折号（——）和分号（；），用逗号替代
- 禁用心理标签词："他感到""他觉得""他意识到"
- 禁用嗅觉描写："铁锈味""泥土芬芳""青草香""雨后空气"
- 禁止"某人说"式对话标签

【对话规则】
- 连续对话超过2句必须插入动作描写
- 对话要符合角色性格和说话习惯
- 用动作替代"说"字（点头、皱眉、摆手等）

【心理描写规则】
- 心理活动通过身体反应表现
- 例如：紧张→手心出汗、腿软；愤怒→握拳、发抖`,
      enabled: true,
      order: 4,
    },
    {
      id: '5',
      name: '审核校对师',
      role: 'review',
      prompt: `【审核校对师】
负责检查逻辑漏洞、错别字、角色一致性与违规内容。

【合规检查清单】
1. ✅ 无破折号/分号
2. ✅ 无"某人说"式对话标签
3. ✅ 无连续纯对话无动作（超过2句）
4. ✅ 无心理标签词（"他感到""他觉得""他意识到"）
5. ✅ 无嗅觉禁词（铁锈味、泥土芬芳、青草香、雨后空气）
6. ✅ 外貌描写不超过20字且与角色档案一致
7. ✅ 打斗无招式名、不超过200字
8. ✅ 结尾有钩子（悬念或转折）
9. ✅ 无AI指纹词（首先、其次、总之等）
10. ✅ 空间一致性（不出现位置矛盾）
11. ✅ 角色一致性（行为语言符合人设）

【质量检查】
- 冷幽默是否面瘫（无过度表情）
- 每章至少一处角色受损时刻
- 节奏合规（非关键转场不超3句）
- 智斗章节是否有关幽默、无语义复盘

【审核输出】
- 通过：输出"✅ 审核通过"
- 打回：列出具体违规位置和原因`,
      enabled: true,
      order: 5,
    },
    {
      id: '6',
      name: '记忆压缩师',
      role: 'memory',
      prompt: `【记忆压缩师】
负责将正文压缩成记忆卡片，便于后续章节调用。

【核心职责】
1. 提取关键信息：角色状态、情绪、持有物
2. 记录关系变化：配角动线、冲突结果
3. 更新钩子状态：已解决/未解决
4. 记录伏笔：已埋设/已回收

【记忆卡格式】（每项不超过30字，总计不超过400字）
1. 当前主角状态：（位置、伤势、持有物）
2. 情绪/欲望：（当前情绪、目标）
3. 配角动线：（其他角色的行动）
4. 最近冲突：（发生了什么）
5. 未解决钩子：（悬念列表）
6. 伏笔/线索：（埋下的伏笔）
7. 时间推移：（过了多久）
8. 空间坐标：（当前位置）
9. 关系变化：（关系如何改变）`,
      enabled: true,
      order: 6,
    },
  ];

  agents = defaultAgents;
  res.json({ agents, message: 'Agent 已重置为默认配置' });
});

// ============== 梗库搜索 ==============
import { SearchClient, Config, HeaderUtils } from "coze-coding-dev-sdk";

// 时新梗缓存（内存缓存，30分钟过期）
let cachedSlang = '';
let cachedSlangTime = 0;
const SLANG_CACHE_MS = 30 * 60 * 1000;

/**
 * GET /api/v1/slang/fresh
 * 搜索最新网络流行梗
 * Query: type? - 小说类型（如 玄修/都市），用于搜相关梗
 */
app.get('/api/v1/slang/fresh', async (req, res) => {
  try {
    // 检查缓存
    if (cachedSlang && Date.now() - cachedSlangTime < SLANG_CACHE_MS) {
      res.json({ slang: cachedSlang, cached: true });
      return;
    }

    const novelType = (req.query.type as string) || '';
    const now = new Date();
    const monthStr = `${now.getFullYear()}年${now.getMonth() + 1}月`;
    const query = `${monthStr} 最新网络流行语 盘点 热词 缩写 梗大全${novelType ? ` ${novelType}` : ''}`;

    const customHeaders = HeaderUtils.extractForwardHeaders(
      req.headers as Record<string, string>,
    );
    const config = new Config();
    const client = new SearchClient(config, customHeaders);

    const response = await client.webSearch(query, 5, true);

    // 用LLM从搜索结果中提取梗（比正则准确得多）
    const summaryText = response.summary || '';
    const snippetTexts = (response.web_items || [])
      .map((item) => `标题：${item.title}\n摘要：${item.snippet}`)
      .join('\n\n');
    const searchContext = `AI摘要：${summaryText}\n\n搜索结果：\n${snippetTexts}`;

    console.log('[slang] Search returned', (response.web_items || []).length, 'items, summary length:', summaryText.length);
    let freshSlang = '';
    try {
      const { LLMClient, Config } = await import('coze-coding-dev-sdk');
      const llmConfig = new Config();
      const llmClient = new LLMClient(llmConfig);
      const llmResponse = await llmClient.invoke(
        [
          {
            role: 'system' as const,
            content: '你是一个网络流行语专家。从给定的搜索结果中，提取当前最火的网络流行语/梗/口头禅。只输出提取到的词，用斜杠分隔，不要解释，不要编号，不要其他任何内容。例如：破防了/赢麻了/寄/纯纯的/就这。如果没有找到流行语，输出空。',
          },
          {
            role: 'user' as const,
            content: searchContext,
          },
        ],
        { model: 'doubao-seed-2-0-mini-260215', temperature: 0.3 },
      );
      console.log('[slang] LLM response length:', llmResponse.content?.length);
      freshSlang = (llmResponse.content || '').trim();
      freshSlang = freshSlang
        .replace(/^\d+[.、)\]]\s*/gm, '')
        .replace(/[，,、\n]+/g, ' / ')
        .trim();
    } catch (e) {
      console.error('LLM slang extraction failed:', e);
      const slangSet = new Set<string>();
      const quotedMatches = searchContext.match(
        /[「"'""《〈]([^「"'""》〉]{2,8})[」"'""》〉]/g,
      );
      if (quotedMatches) {
        quotedMatches.forEach((m) => {
          const clean = m.replace(/^[「"'""《〈]|[」"'""》〉]$/g, '').trim();
          if (clean.length >= 2 && clean.length <= 8) {
            slangSet.add(clean);
          }
        });
      }
      freshSlang = Array.from(slangSet).slice(0, 15).join(' / ');
    }

    // 缓存
    cachedSlang = freshSlang;
    cachedSlangTime = Date.now();

    res.json({ slang: freshSlang, cached: false });
  } catch (error) {
    console.error('Slang search failed:', error);
    // 搜索失败不阻塞，返回空
    res.json({ slang: '', cached: false, error: '搜索失败，将使用经典梗' });
  }
});

// ============== 审查系统 SSE 流式接口 ==============

// POST /api/v1/review/agent-stream - 单agent流式调用
app.post('/api/v1/review/agent-stream', async (req, res) => {
  const { agentId, agentRole, agentType, prompt, systemPrompt, model, apiUrl, apiKey } = req.body;

  if (!prompt) {
    res.status(400).json({ error: 'Missing prompt' });
    return;
  }

  // SSE 响应头
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-store, no-transform, must-revalidate');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  try {
    // 优先使用 coze-coding-dev-sdk (豆包系模型)
    // 如果没有配置apiUrl，或者apiUrl不是第三方API，则使用coze-sdk
    const isThirdPartyApi = apiUrl && apiKey && (
      apiUrl.includes('deepseek') || 
      apiUrl.includes('openai') || 
      apiUrl.includes('anthropic')
    );
    
    if (!isThirdPartyApi) {
      const { LLMClient, Config } = await import('coze-coding-dev-sdk');
      const llmConfig = new Config();
      const llmClient = new LLMClient(llmConfig);

      // 选择模型 - 根据agent类型选不同模型
      let selectedModel = model || 'doubao-seed-2-0-mini-260215';
      // 如果model是deepseek系，强制用doubao替代
      if (selectedModel.includes('deepseek')) {
        selectedModel = 'doubao-seed-2-0-mini-260215';
      }

      const defaultSystem = `你是小说创作团队中的${agentRole || agentId}。说话要简洁有力，像真人在群里聊天一样，可以自然地带入网络流行梗。不要长篇大论，几句话说清楚立场和理由。`;
      const finalSystem = systemPrompt || defaultSystem;

      const stream = await llmClient.stream(
        [
          {
            role: 'system' as const,
            content: finalSystem,
          },
          {
            role: 'user' as const,
            content: prompt,
          },
        ],
        { model: selectedModel, temperature: 0.7 },
      );

      for await (const chunk of stream) {
        const content = chunk.content || '';
        if (content) {
          res.write(`data: ${JSON.stringify({ content })}\n\n`);
        }
      }
    } else if (apiUrl && apiKey) {
      // 使用用户配置的第三方API (如DeepSeek)
      const defaultSystem = `你是小说创作团队中的${agentRole || agentId}。说话要简洁有力，像真人在群里聊天一样，可以自然地带入网络流行梗。不要长篇大论，几句话说清楚立场和理由。`;
      const finalSystem = systemPrompt || defaultSystem;

      const fetchUrl = `${apiUrl}/chat/completions`;
      const response = await fetch(fetchUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: model || 'deepseek-chat',
          messages: [
            {
              role: 'system',
              content: finalSystem,
            },
            { role: 'user', content: prompt },
          ],
          stream: true,
          temperature: 0.7,
        }),
      });

      if (!response.ok) {
        res.write(`data: ${JSON.stringify({ error: `API error: ${response.status}` })}\n\n`);
        res.write('data: [DONE]\n\n');
        res.end();
        return;
      }

      const reader = response.body?.getReader();
      if (!reader) {
        res.write(`data: ${JSON.stringify({ error: 'No response body' })}\n\n`);
        res.write('data: [DONE]\n\n');
        res.end();
        return;
      }

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6).trim();
            if (data === '[DONE]') continue;
            try {
              const parsed = JSON.parse(data);
              const content = parsed.choices?.[0]?.delta?.content || '';
              if (content) {
                res.write(`data: ${JSON.stringify({ content })}\n\n`);
              }
            } catch {
              // 忽略解析失败的行
            }
          }
        }
      }
    } else {
      res.write(`data: ${JSON.stringify({ error: 'No API configuration available' })}\n\n`);
    }

    res.write('data: [DONE]\n\n');
  } catch (error) {
    console.error('[review-stream] Error:', error);
    res.write(`data: ${JSON.stringify({ error: 'Stream error' })}\n\n`);
    res.write('data: [DONE]\n\n');
  }

  res.end();
});

// 获取写作进度状态
app.get('/api/v1/writing/status', (req, res) => {
  res.json({
    status: 'idle',
    currentAgent: null,
    step: 0,
    totalSteps: 6,
    message: '就绪',
  });
});

// ============== Metro Bundler 兼容协议 ==============
// 让Expo Go/Coze扫码工具认为这是Metro开发服务器

// 1. 状态检查 - Expo Go连接时首先请求此端点
app.get('/status', (_req, res) => {
  res.setHeader('X-React-Native-Project-Root', encodeURI('/workspace/projects/client'));
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.end('packager-status:running');
});

// 2. Metro HMR端点 (不支持热更新) - 必须在动态路由之前
app.get('/onchange', (_req, res) => {
  res.status(404).end();
});

// 3. JS Bundle请求 - Expo Go请求 *.bundle 文件
app.get('*.bundle', (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const platform = url.searchParams.get('platform') || 'android';
  
  const bundleDir = path.resolve('public/_expo/static/js');
  
  // 优先使用对应平台的bundle
  const platformDir = path.join(bundleDir, platform);
  if (fs.existsSync(platformDir)) {
    const files = fs.readdirSync(platformDir);
    const hbcFile = files.find(f => f.endsWith('.hbc'));
    const jsFile = files.find(f => f.endsWith('.js'));
    if (hbcFile) { res.sendFile(path.join(platformDir, hbcFile)); return; }
    if (jsFile) { res.sendFile(path.join(platformDir, jsFile)); return; }
  }
  
  // fallback: android
  const androidDir = path.join(bundleDir, 'android');
  if (fs.existsSync(androidDir)) {
    const files = fs.readdirSync(androidDir);
    const hbcFile = files.find(f => f.endsWith('.hbc'));
    const jsFile = files.find(f => f.endsWith('.js'));
    if (hbcFile) { res.sendFile(path.join(androidDir, hbcFile)); return; }
    if (jsFile) { res.sendFile(path.join(androidDir, jsFile)); return; }
  }
  
  // 最后fallback: web
  const webDir = path.join(bundleDir, 'web');
  if (fs.existsSync(webDir)) {
    const files = fs.readdirSync(webDir).filter(f => f.endsWith('.js'));
    if (files.length > 0) { res.sendFile(path.join(webDir, files[0])); return; }
  }
  
  res.status(404).send('Bundle not found');
});

// 4. Source Map请求
app.get('*.map', (_req, res) => {
  res.setHeader('Access-Control-Allow-Origin', 'devtools://devtools');
  res.status(404).send('Source map not available');
});

// 5. Assets请求
app.get('*.assets', (_req, res) => {
  res.status(404).send('Assets not available');
});

// 6. Symbolicate端点
app.post('/symbolicate', (_req, res) => {
  res.end('{}');
});

// 7. Open stack frame端点
app.post('/open-stack-frame', (_req, res) => {
  res.end('OK');
});

// ============== 前端静态文件 ==============
app.use(express.static('public'));
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/')) return next();
  res.sendFile('index.html', { root: 'public' });
});

// ============== 启动服务 ==============
// 9091: API + 静态页面（备用）
app.listen(9091, () => {
  console.log(`✍️ 小说写作服务已启动: http://localhost:9091/`);
  console.log(`📝 API 端点: /api/v1/`);
});


