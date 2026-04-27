import express from "express";
import cors from "cors";
import { z } from "zod";

const app = express();
const port = process.env.PORT || 9091;

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
}

// 内存存储（生产环境应使用数据库）
const chapters: Map<string, Chapter> = new Map();
const memories: Memory[] = [];
const agents: Agent[] = [
  {
    id: '1',
    name: '世界观架构师',
    role: 'system',
    prompt: '负责设计故事背景、世界观设定、历史文明、地理环境等宏观架构。',
    enabled: true,
  },
  {
    id: '2',
    name: '人物设定师',
    role: 'character',
    prompt: '负责塑造角色性格、外貌特征、行为动机、技能设定与成长轨迹。',
    enabled: true,
  },
  {
    id: '3',
    name: '情节设计师',
    role: 'plot',
    prompt: '负责规划故事线、高潮转折、冲突设置与悬念埋设。',
    enabled: true,
  },
  {
    id: '4',
    name: '文笔润色师',
    role: 'style',
    prompt: '负责优化文字描写、对话风格、环境渲染与情感表达。',
    enabled: false,
  },
  {
    id: '5',
    name: '审核校对师',
    role: 'review',
    prompt: '负责检查逻辑漏洞、错别字、角色一致性与违规内容。',
    enabled: true,
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
  const apiKey = req.headers['x-api-key'] as string || process.env.LLM_API_KEY || '';
  const baseUrl = req.headers['x-base-url'] as string || 'https://api.deepseek.com';
  const model = req.headers['x-model'] as string || 'deepseek-chat';
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

const systemPrompt = `你是专业的小说作家，擅长创作精彩的网文小说。
请严格遵守以下写作规则生成正文内容。

${WRITING_RULES}

请根据章纲生成小说正文，保持文笔流畅、节奏紧凑、情节生动。`;

// 工作流节点1：读取上下文
function buildWritingContext(outline: string, memoryContext: string[]): string {
  return `【本章章纲】
${outline}

${memoryContext.length > 0 ? `【相关记忆上下文】
${memoryContext.map(m => `- ${m}`).join('\n')}` : ''}

请根据章纲创作本章正文。`;
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

// 写作台 - 生成正文（支持流式）
app.post('/api/v1/writing/generate', async (req, res) => {
  const schema = z.object({
    chapterId: z.string(),
    chapterNumber: z.number(),
    outline: z.string(),
    memoryContext: z.array(z.string()).optional(),
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

    // 节点1：构建上下文
    const context = buildWritingContext(data.outline, data.memoryContext || []);

    // 节点2：流式生成
    try {
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
            { role: 'user', content: context },
          ],
          temperature: 0.7,
          max_tokens: 3000,
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
              // 节点3：代码过滤
              const { filtered, violations } = filterContent(fullContent);

              // 保存章节
              const now = new Date().toISOString();
              const chapter: Chapter = {
                id: req.body.chapterId,
                chapterNumber: req.body.chapterNumber,
                outline: req.body.outline,
                content: filtered,
                summary: generateSummary(filtered),
                status: 'draft',
                createdAt: chapters.get(req.body.chapterId)?.createdAt || now,
                updatedAt: now,
              };
              chapters.set(req.body.chapterId, chapter);

              res.write(`data: ${JSON.stringify({
                type: 'done',
                content: filtered,
                violations,
              })}\n\n`);
            } else {
              try {
                const parsed = JSON.parse(dataStr);
                const delta = parsed.choices?.[0]?.delta?.content;
                if (delta) {
                  fullContent += delta;
                  res.write(`data: ${JSON.stringify({ type: 'chunk', content: delta })}\n\n`);
                }
              } catch (e) {
                // 忽略解析错误
              }
            }
          }
        }
      }

      // 节点3：代码过滤
      const { filtered, violations } = filterContent(fullContent);

      // 保存章节
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

      res.write(`data: ${JSON.stringify({
        type: 'done',
        content: filtered,
        violations,
        chapterId: data.chapterId,
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

app.put('/api/v1/agents/:id', (req, res) => {
  const { id } = req.params;
  const schema = z.object({
    name: z.string().optional(),
    prompt: z.string().optional(),
    enabled: z.boolean().optional(),
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

    res.json({ agent });
  } catch (error) {
    res.status(400).json({ error: 'Invalid request body' });
  }
});

// ============== 启动服务 ==============

app.listen(port, () => {
  console.log(`✍️ 小说写作服务已启动: http://localhost:${port}/`);
  console.log(`📝 API 端点: /api/v1/`);
});
