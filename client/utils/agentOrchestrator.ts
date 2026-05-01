/**
 * Agent协作编排引擎
 * 统一入口，所有阶段（大纲/粗纲/细纲/写作/评审）复用
 */

import RNSSE from 'react-native-sse';
import { PresetAgent, PRESET_AGENTS, STAGE_AGENT_ORDER, getActiveAgentsForStage, AgentConfig } from './presetAgents';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ===== 类型定义 =====

export interface AgentStepResult {
  agentId: string;
  agentName: string;
  output: string;
}

export interface CoordinatorReport {
  stage: string;
  agents: { name: string; task: string; summary: string }[];
  userFeedback?: string;
}

export interface OrchestrationParams {
  stage: 'outline' | 'rough' | 'detail' | 'writing' | 'review';
  context: string;             // 当前内容（大纲/粗纲/细纲/章纲）
  secondaryContext?: string;   // 辅助内容（细纲阶段传大纲，写作阶段传粗纲等）
  previousContent?: string;    // 前文（写作阶段用）
  chapterNumber?: number;      // 章节号（写作阶段用）
  targetChapters?: number;     // 目标章节数（粗纲/细纲阶段用）
  novelName?: string;          // 小说名
  onAgentStart: (name: string, idx: number, total: number) => void;
  onAgentChunk: (chunk: string, agentId: string) => void;
  onAgentComplete: (name: string, output: string) => void;
  onAllComplete: (report: CoordinatorReport, allOutputs: AgentStepResult[]) => void;
  onError: (error: string) => void;
}

// ===== API配置读取 =====

interface ApiConfig {
  id: string;
  name: string;
  apiKey: string;
  baseUrl: string;
  model: string;
}

async function getApiConfigs(): Promise<ApiConfig[]> {
  try {
    const raw = await AsyncStorage.getItem('apiConfigs');
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

async function getUserAgentOverrides(): Promise<Record<string, { enabled?: boolean; prompt?: string; apiId?: string }>> {
  try {
    const raw = await AsyncStorage.getItem('agentConfigs');
    if (!raw) return {};
    const overrides = JSON.parse(raw); // AgentConfig[] 格式: [{ presetId, name, prompt, enabled, apiId, order }]
    const map: Record<string, { enabled?: boolean; prompt?: string; apiId?: string }> = {};
    for (const a of overrides) {
      if (a.presetId) {
        map[a.presetId] = {
          enabled: a.enabled,
          prompt: a.prompt,
          apiId: a.apiId,
        };
      }
    }
    return map;
  } catch {
    return {};
  }
}

/** 获取Agent的API配置 — overrideApiId 来自用户覆盖配置 */
function resolveApiConfig(overrideApiId: string | undefined, apiConfigs: ApiConfig[], defaultApi: ApiConfig | null): ApiConfig | null {
  if (overrideApiId) {
    const cfg = apiConfigs.find(c => c.id === overrideApiId);
    if (cfg) return cfg;
  }
  return defaultApi;
}

// ===== SSE调用单个Agent =====

function callAgentSSE(
  apiConfig: ApiConfig,
  systemPrompt: string,
  userPrompt: string,
  onChunk: (chunk: string) => void,
  maxTokens: number = 4096
): Promise<string> {
  return new Promise((resolve, reject) => {
    let accumulated = '';

    const base = apiConfig.baseUrl.replace(/\/+$/, '');
    const endpoint = base.endsWith('/v1') ? `${base}/chat/completions` : `${base}/v1/chat/completions`;

    const sse = new RNSSE(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiConfig.apiKey}`,
      },
      body: JSON.stringify({
        model: apiConfig.model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        stream: true,
        temperature: 0.7,
        max_tokens: maxTokens,
      }),
    });

    sse.addEventListener('message', (event) => {
      if (event.data === '[DONE]') {
        sse.close();
        resolve(accumulated);
        return;
      }

      try {
        const json = JSON.parse(event.data || '{}');
        const content = json.choices?.[0]?.delta?.content;
        if (content) {
          accumulated += content;
          onChunk(content);
        }
      } catch {}
    });

    sse.addEventListener('error', (event: any) => {
      sse.close();
      if (accumulated.length > 50) {
        // 有部分内容，按成功返回
        resolve(accumulated);
      } else {
        reject(new Error('SSE连接失败'));
      }
    });

    (sse as any).addEventListener('exception', (event: any) => {
      sse.close();
      reject(new Error(event?.detail?.message || 'SSE异常'));
    });
  });
}

// ===== 构建每个Agent的Prompt =====

function buildAgentPrompts(
  agent: PresetAgent,
  stage: string,
  context: string,
  previousOutputs: AgentStepResult[],
  params: OrchestrationParams
): { system: string; user: string; maxTokens: number } {
  // 前序Agent的输出汇总
  const prevSummary = previousOutputs
    .filter(o => o.agentId !== 'coordinator')
    .map(o => `【${o.agentName}的输出】\n${o.output.slice(0, 3000)}`)
    .join('\n\n');

  const isCoordinator = agent.id === 'coordinator';
  const isFirstCoordinator = isCoordinator && previousOutputs.length === 0;

  // 统筹Agent：首次规划 / 末次出报告
  if (isCoordinator) {
    if (isFirstCoordinator) {
      const targetInfo = params.targetChapters ? `目标章节数：${params.targetChapters}章。` : '';
      const novelInfo = params.novelName ? `小说名：《${params.novelName}》。` : '';
      return {
        system: '你是小说创作统筹。',
        user: `当前阶段：${stage}\n${novelInfo}${targetInfo}任务内容：${context.slice(0, 2000)}\n请简要分析当前任务，说明接下来各Agent需要完成的工作（限200字）。`,
        maxTokens: 1024,
      };
    } else {
      // 末次：生成协作报告
      const agentSummaries = previousOutputs
        .filter(o => o.agentId !== 'coordinator')
        .map(o => `- ${o.agentName}：${o.output.slice(0, 200)}`)
        .join('\n');
      return {
        system: '你是小说创作统筹，负责生成协作报告。',
        user: `以下是各Agent的工作成果摘要：\n${agentSummaries}\n\n请生成协作报告，每个Agent一行，写明名称和核心工作（限200字）。`,
        maxTokens: 1024,
      };
    }
  }

  // 非统筹Agent：严格按角色输出
  const roleBoundary = `你的职责边界：只做${agent.role}相关的工作，绝不越界。你绝不写小说正文（除非你是写手或风格润色师），绝不写其他Agent职责范围的内容。`;
  // 用户的自定义规则放在最前面，优先级最高
  const userRule = agent.prompt ? `\n【你必须严格遵守以下规则】\n${agent.prompt}\n` : '';

  let taskInstruction = '';
  let maxTokens = 4096;

  const novelNameStr = params.novelName ? `《${params.novelName}》` : '';
  const targetChaptersStr = params.targetChapters ? `目标章节数：${params.targetChapters}章` : '';

  // 每个Agent根据角色获得不同的任务指令，而非统一按阶段分配
  switch (agent.id) {
    // ===== 核心助手 =====
    case 'coordinator':
      // 已在上面处理
      break;
    case 'writer':
      taskInstruction = `请严格按照你的规则，根据细纲和参考材料，创作第${params.chapterNumber || 1}章的完整正文。只输出正文，不要任何说明或注释。`;
      maxTokens = 16000;
      break;

    // ===== 世界架构师 =====
    case 'world_architect':
      if (stage === 'outline') {
        taskInstruction = `请根据以下核心概念，为小说${novelNameStr}设计完整的世界观设定，包括：时代背景、地理环境、社会结构、力量体系/科技水平、重要势力。${targetChaptersStr}`;
      } else if (stage === 'rough') {
        taskInstruction = `请根据以下大纲内容，为小说${novelNameStr}补充各章节需要的世界观细节（如场景中涉及的城市、势力、规则等），以供粗纲设计参考。${targetChaptersStr}`;
      } else if (stage === 'detail') {
        taskInstruction = `请根据大纲和粗纲，为各章节细纲补充场景相关的世界观细节（建筑风格、风俗习惯、力量规则等）。`;
      } else if (stage === 'writing') {
        taskInstruction = `请为第${params.chapterNumber || 1}章的场景描写提供世界观细节参考（如环境描写要点、文化习俗等）。`;
      }
      break;

    // ===== 剧情设计师 =====
    case 'plot_designer':
      if (stage === 'outline') {
        taskInstruction = `请根据以下核心概念，为小说${novelNameStr}设计完整的剧情框架，包括：主线剧情走向、核心冲突、高潮设计、结局方向。${targetChaptersStr}`;
      } else if (stage === 'rough') {
        taskInstruction = `请根据以下大纲内容，为小说${novelNameStr}设计各章节的核心剧情事件和转折点，以供粗纲设计参考。${targetChaptersStr}。每章一行，格式："第X章：核心事件"。`;
      } else if (stage === 'detail') {
        taskInstruction = `请根据大纲和粗纲，为各章节设计具体的剧情走向和冲突设计，包括：场景冲突、人物动机、情节转折。`;
      } else if (stage === 'writing') {
        taskInstruction = `请为第${params.chapterNumber || 1}章的剧情设计提供参考（冲突设计、情节节奏、悬念设置等）。`;
      }
      break;

    // ===== 人物设计师 =====
    case 'character_designer':
      if (stage === 'outline' || stage === 'rough') {
        taskInstruction = `请根据以下内容，为小说${novelNameStr}设计核心人物设定，包括：性格特点、外貌描写、背景故事、人物关系、成长弧线。`;
      } else if (stage === 'detail') {
        taskInstruction = `请根据大纲和粗纲，为各章节补充涉及人物的行为细节、情感变化、对话风格参考。`;
      } else if (stage === 'writing') {
        taskInstruction = `请为第${params.chapterNumber || 1}章的人物描写提供参考（行为特征、口头禅、情感表达方式等）。`;
      }
      break;

    // ===== 粗纲设计师 =====
    case 'rough_designer':
      taskInstruction = `请根据以下大纲内容和参考材料，设计章节粗纲。${targetChaptersStr ? `必须设计${params.targetChapters}章的粗纲` : ''}。每章粗纲一行，格式："第X章：章节核心事件概括"。确保章节数量与目标一致。`;
      maxTokens = 8192;
      break;

    // ===== 细纲设计师 =====
    case 'detail_designer':
      taskInstruction = `请根据以下大纲和粗纲内容，逐章设计细纲。${targetChaptersStr ? `共${params.targetChapters}章` : ''}。每章细纲用"===第X章==="开头，然后写详细场景、关键对话方向、情绪线、本章目标。各章细纲之间用"===第X章==="分隔。`;
      maxTokens = 16384;
      break;

    // ===== 记忆压缩 =====
    case 'memory_compressor':
      taskInstruction = `请将以下前文压缩为简短摘要，保留关键情节、人物状态、伏笔（限500字）。`;
      maxTokens = 1024;
      break;

    // ===== 对话设计师 =====
    case 'dialogue_designer':
      if (stage === 'detail') {
        taskInstruction = `请根据大纲和粗纲，为各章节设计关键对话的方向和语气参考。`;
      } else if (stage === 'writing') {
        taskInstruction = `请为第${params.chapterNumber || 1}章的关键对话设计参考（对话风格、语气、潜台词等）。`;
      } else {
        taskInstruction = `请根据以下内容，为小说${novelNameStr}设计核心对话风格和语言特色。`;
      }
      break;

    // ===== 场景描写师 =====
    case 'scene_designer':
      if (stage === 'detail') {
        taskInstruction = `请根据大纲和粗纲，为各章节设计场景描写的氛围和感官细节参考。`;
      } else if (stage === 'writing') {
        taskInstruction = `请为第${params.chapterNumber || 1}章的场景描写提供参考（五感描写、氛围营造、空间布局等）。`;
      } else {
        taskInstruction = `请根据以下内容，为小说${novelNameStr}设计关键场景的氛围和描写方向。`;
      }
      break;

    // ===== 节奏把控师 =====
    case 'pacing_controller':
      if (stage === 'writing') {
        taskInstruction = '请分析以下正文的节奏，给出调整建议。只输出建议，不要改写正文。';
        maxTokens = 2048;
      } else {
        taskInstruction = `请根据以下内容，分析各章节的节奏设计是否合理，给出节奏调整建议。`;
      }
      break;

    // ===== 伏笔设计师 =====
    case 'foreshadow_designer':
      if (stage === 'detail') {
        taskInstruction = `请根据大纲和粗纲，为各章节设计伏笔和呼应关系参考。`;
      } else if (stage === 'writing') {
        taskInstruction = `请为第${params.chapterNumber || 1}章提供伏笔设计和呼应参考。`;
      } else {
        taskInstruction = `请根据以下内容，为小说${novelNameStr}设计整体的伏笔网络和呼应关系。`;
      }
      break;

    // ===== 风格润色师 =====
    case 'style_polisher':
      if (stage === 'writing') {
        taskInstruction = '请严格按照你的规则，对以下正文进行润色，输出润色后的完整正文。只输出正文，不要任何说明。';
        maxTokens = 16000;
      } else {
        taskInstruction = `请根据以下内容，为小说${novelNameStr}设定整体文风和语言特色参考。`;
      }
      break;

    default:
      // 通用兜底
      taskInstruction = `请根据以下内容，完成你的专业工作。${targetChaptersStr}`;
      break;
  }

  let userPrompt = '';
  userPrompt += userRule;
  if (prevSummary) {
    userPrompt += `【前序Agent提供的参考材料】\n${prevSummary}\n\n`;
  }
  if (params.previousContent && stage === 'writing' && agent.id !== 'memory_compressor') {
    userPrompt += `【前文摘要】\n${params.previousContent.slice(0, 2000)}\n\n`;
  }
  // 细纲阶段：辅助内容传大纲，主内容传粗纲
  if (params.secondaryContext && stage === 'detail') {
    userPrompt += `【大纲】\n${params.secondaryContext.slice(0, 3000)}\n\n`;
  }
  // 写作阶段：辅助内容传大纲+粗纲
  if (params.secondaryContext && stage === 'writing') {
    userPrompt += `${params.secondaryContext.slice(0, 3000)}\n\n`;
  }
  userPrompt += `${taskInstruction}\n\n【当前内容】\n${context.slice(0, 4000)}`;

  return {
    system: `你的角色：${agent.name}\n${roleBoundary}`,
    user: userPrompt,
    maxTokens,
  };
}

// ===== 主入口：编排Agent协作 =====

export async function orchestrateAgents(params: OrchestrationParams): Promise<void> {
  const { stage, context, onAgentStart, onAgentChunk, onAgentComplete, onAllComplete, onError } = params;

  // 1. 读取API配置和用户Agent覆盖
  const apiConfigs = await getApiConfigs();
  const userAgentOverrides = await getUserAgentOverrides();
  const defaultApi = apiConfigs.length > 0 ? apiConfigs[0] : null;

  if (!defaultApi) {
    onError('请先配置API（设置 → API配置）');
    return;
  }

  // 2. 获取本阶段激活的Agent列表
  const agents = getActiveAgentsForStage(stage, userAgentOverrides);

  if (agents.length === 0) {
    onError('没有可用的助手，请检查助手配置');
    return;
  }

  // 3. 检查是否有统筹Agent，如果有，末尾需再调用一次生成报告
  const hasCoordinator = agents.some(a => a.id === 'coordinator');
  const totalSteps = agents.length + (hasCoordinator ? 1 : 0);

  // 4. 逐个Agent执行
  const allOutputs: AgentStepResult[] = [];
  let lastWriterOutput = '';

  for (let i = 0; i < agents.length; i++) {
    const agent = agents[i];

    // 解析API配置：用户覆盖的apiId优先，否则用默认
    const override = userAgentOverrides[agent.id];
    const overrideApiId = override?.apiId;
    const apiConfig = resolveApiConfig(overrideApiId, apiConfigs, defaultApi);
    if (!apiConfig || !apiConfig.apiKey || !apiConfig.baseUrl || !apiConfig.model) {
      onError(`助手 "${agent.name}" 的API配置不完整，请检查`);
      return;
    }

    // 回调：Agent开始
    onAgentStart(agent.name, i, totalSteps);

    // 构建Prompt
    const { system, user, maxTokens } = buildAgentPrompts(agent, stage, context, allOutputs, params);

    // SSE调用
    let agentOutput = '';
    try {
      agentOutput = await callAgentSSE(
        apiConfig,
        system,
        user,
        (chunk) => onAgentChunk(chunk, agent.id),
        maxTokens
      );
    } catch (e: any) {
      onError(`助手 "${agent.name}" 执行失败：${e.message || '未知错误'}`);
      return;
    }

    const stepResult: AgentStepResult = {
      agentId: agent.id,
      agentName: agent.name,
      output: agentOutput,
    };
    allOutputs.push(stepResult);

    // 记录写手和润色师的输出（这是最终正文）
    if (agent.id === 'writer' || agent.id === 'style_polisher') {
      lastWriterOutput = agentOutput;
    }

    // 回调：Agent完成
    onAgentComplete(agent.name, agentOutput);
  }

  // 5. 统筹Agent末次调用：生成协作报告
  let coordinatorReportOutput = '';
  if (hasCoordinator) {
    const coordinatorAgent = agents.find(a => a.id === 'coordinator')!;
    const coordinatorOverride = userAgentOverrides['coordinator'];
    const apiConfig = resolveApiConfig(coordinatorOverride?.apiId, apiConfigs, defaultApi);
    if (apiConfig && apiConfig.apiKey && apiConfig.baseUrl && apiConfig.model) {
      onAgentStart('统筹(报告)', agents.length, totalSteps);
      const { system, user, maxTokens } = buildAgentPrompts(coordinatorAgent, stage, context, allOutputs, params);
      try {
        coordinatorReportOutput = await callAgentSSE(apiConfig, system, user, (_chunk: string) => { /* report generation */ }, maxTokens);
        onAgentComplete('统筹(报告)', coordinatorReportOutput);
      } catch {
        // 报告生成失败不影响主流程
        onAgentComplete('统筹(报告)', '报告生成失败');
      }
    }
  }

  // 6. 生成协作报告
  const report: CoordinatorReport = {
    stage,
    agents: allOutputs
      .filter(o => o.agentId !== 'coordinator')
      .map(o => ({
        name: o.agentName,
        task: o.output.slice(0, 100),
        summary: o.output.slice(0, 200),
      })),
  };

  // 如果统筹末次有输出，用它作为报告
  if (coordinatorReportOutput) {
    report.agents.push({
      name: '统筹',
      task: '协作报告',
      summary: coordinatorReportOutput.slice(0, 300),
    });
  }

  // 7. 回调：全部完成
  onAllComplete(report, allOutputs);
}

/**
 * 获取最终正文内容（从allOutputs中提取写手/润色师的输出）
 */
export function getFinalContent(allOutputs: AgentStepResult[]): string {
  // 优先取风格润色师的输出，其次写手
  const polisher = [...allOutputs].reverse().find(o => o.agentId === 'style_polisher');
  if (polisher && polisher.output.length > 100) return polisher.output;

  const writer = [...allOutputs].reverse().find(o => o.agentId === 'writer');
  if (writer) return writer.output;

  // 兜底：返回最后一个非统筹Agent的输出
  const last = [...allOutputs].reverse().find(o => o.agentId !== 'coordinator');
  return last?.output || '';
}

/**
 * 智能搭配：让统筹Agent用LLM建议Agent组合
 */
export async function smartSuggestAgents(
  stage: string,
  context: string,
  apiConfig: ApiConfig
): Promise<string> {
  const availableAgents = PRESET_AGENTS.filter(a => a.stages.includes(stage))
    .map(a => `- ${a.name}(${a.id})：${a.role}`)
    .join('\n');

  const systemPrompt = '你是小说创作统筹，负责为当前任务推荐最合适的Agent组合。';
  const userPrompt = `当前阶段：${stage}\n任务摘要：${context.slice(0, 500)}\n\n可用Agent：\n${availableAgents}\n\n请推荐本阶段需要的Agent列表和执行顺序，简要说明每个Agent的作用（限300字）。`;

  const result = await callAgentSSE(apiConfig, systemPrompt, userPrompt, (_chunk: string) => { /* 非流式调用忽略chunk */ }, 1024);
  return result;
}
