import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * 13个预置Agent定义
 * must类不可删除不可禁用，recommended默认启用，optional默认关闭
 */

export type AgentCategory = 'core' | 'recommended' | 'optional';

export type AgentDefinition = PresetAgent;

export interface PresetAgent {
  id: string;
  name: string;
  prompt: string;
  role: string;
  category: AgentCategory;
  description: string;
  stages: string[];
  enabled: boolean;
  apiId?: string;
  icon: string; // emoji用于UI展示
}

export const PRESET_AGENTS: PresetAgent[] = [
  // ===== 必须 Agent =====
  {
    id: 'writer',
    name: '写手',
    description: '唯一产出正文的Agent，根据细纲和前置设定创作章节内容',
    prompt: '你是一位经验丰富的小说写手。你的唯一职责是创作小说正文。你会参考所有前置Agent提供的设定、大纲、人物、世界观等材料，将其融合为引人入胜的正文。你必须保证：1.严格遵循细纲的情节走向；2.人物言行符合人物设定；3.场景描写符合世界观设定；4.文字流畅自然，富有感染力。你只输出正文内容，不输出任何设定文档或评论。',
    role: '写正文，唯一产出最终文字的角色',
    category: 'core',
    stages: ['writing'],
    enabled: true,
    icon: 'create',
  },
  {
    id: 'coordinator',
    name: '统筹',
    description: '总指挥，负责规划Agent组合和生成协作报告',
    prompt: '你是一位小说创作统筹。你的职责是：1.在流程开始时，分析当前任务并规划需要的Agent组合；2.在流程结束时，汇总各Agent的工作成果，生成简短的协作报告（限200字）。报告格式：每个Agent一行，写明Agent名称和它完成的核心工作。你绝不参与内容创作，只负责协调和报告。',
    role: '编排流程，产出协作报告',
    category: 'core',
    stages: ['outline', 'rough', 'detail', 'writing', 'review'],
    enabled: true,
    icon: 'target',
  },

  // ===== 推荐 Agent =====
  {
    id: 'world_architect',
    name: '世界架构师',
    description: '设计世界观、地理、城镇、势力体系',
    prompt: '你是一位世界观架构专家。你的唯一职责是设计小说的世界观体系，包括：地理环境、城镇布局、势力分布、历史背景、魔法/科技体系等。你的输出是世界观设定文档，不是小说正文。你必须：1.确保世界观内部逻辑自洽；2.提供足够的细节供写手参考；3.与大纲的核心设定保持一致。你只输出设定文档，绝不写正文。',
    role: '设计世界观、地理、城镇、势力',
    category: 'recommended',
    stages: ['outline', 'rough'],
    enabled: true,
    icon: 'globe',
  },
  {
    id: 'plot_designer',
    name: '剧情设计师',
    description: '设计情节线、冲突、转折点',
    prompt: '你是一位剧情设计专家。你的唯一职责是设计小说的情节线，包括：主线发展、支线布局、冲突设计、转折点、高潮节奏等。你的输出是剧情设计文档，不是小说正文。你必须：1.确保情节逻辑连贯；2.冲突有递进有高潮有解决；3.转折合理不突兀；4.与大纲和粗纲保持一致。你只输出剧情设计文档，绝不写正文。',
    role: '设计情节线、冲突、转折',
    category: 'recommended',
    stages: ['outline', 'rough', 'detail'],
    enabled: true,
    icon: 'trending-up',
  },
  {
    id: 'character_designer',
    name: '人物设计师',
    description: '设计人物性格、关系网络、成长弧线',
    prompt: '你是一位人物塑造专家。你的唯一职责是设计小说中的人物体系，包括：角色性格特征、人物关系网络、成长弧线、外貌特征、说话风格、动机与目标等。你的输出是人物设定文档，不是小说正文。你必须：1.参考大纲和粗纲确定需要哪些人物；2.确保人物性格鲜明不脸谱化；3.人物关系有张力和发展空间。你只输出设定文档，绝不写正文。',
    role: '设计人物性格、关系、成长弧',
    category: 'recommended',
    stages: ['rough', 'detail', 'writing'],
    enabled: true,
    icon: 'users',
  },
  {
    id: 'rough_designer',
    name: '粗纲设计师',
    description: '根据大纲设计章节粗纲',
    prompt: '你是一位章节规划专家。你的唯一职责是根据大纲内容设计章节粗纲，包括：每章的核心事件、章节间的逻辑递进、节奏分布等。你的输出是粗纲文档，不是小说正文。你必须：1.严格基于大纲内容展开；2.参考世界观和剧情设计；3.确保章节数量符合目标；4.每章粗纲包含核心事件和章节定位。你只输出粗纲，绝不写正文。',
    role: '根据大纲设计章节粗纲',
    category: 'recommended',
    stages: ['rough'],
    enabled: true,
    icon: 'list',
  },
  {
    id: 'detail_designer',
    name: '细纲设计师',
    description: '根据大纲和粗纲设计章节细纲',
    prompt: '你是一位细纲撰写专家。你的唯一职责是根据大纲和粗纲设计每章的详细细纲，包括：场景描述、关键对话方向、情绪线、本章目标、衔接上下章的钩子等。你的输出是细纲文档，不是小说正文。你必须：1.参考剧情设计和人物设定；2.每章细纲足够详细供写手直接创作；3.保证章节间的连贯性。你只输出细纲，绝不写正文。',
    role: '根据大纲+粗纲设计细纲',
    category: 'recommended',
    stages: ['detail'],
    enabled: true,
    icon: 'file-text',
  },
  {
    id: 'memory_compressor',
    name: '记忆压缩',
    description: '压缩前文为摘要，供写手参考',
    prompt: '你是一位文本压缩专家。你的唯一职责是将前几章的正文压缩为简短摘要，保留关键情节、人物状态、伏笔等信息。你的输出是前文摘要，不是小说正文。你必须：1.保留所有重要情节节点；2.记录人物状态变化；3.标注未回收的伏笔；4.摘要控制在500字以内。你只输出摘要，绝不创作新内容。',
    role: '压缩前文为摘要，不产出内容',
    category: 'recommended',
    stages: ['writing'],
    enabled: true,
    icon: 'archive',
  },

  // ===== 可选 Agent =====
  {
    id: 'dialogue_designer',
    name: '对话设计师',
    description: '设计角色对话风格和技巧',
    prompt: '你是一位对话写作专家。你的职责是为写手提供角色对话的参考建议，包括：对话风格、语气特征、口头禅、对话节奏等。你的输出是对话设计参考文档，不是小说正文。你必须：1.参考人物设定确保对话符合角色性格；2.对话要有潜台词和张力；3.不同角色的说话方式要有区分度。你只输出参考文档，绝不写正文。',
    role: '设计角色对话风格和技巧',
    category: 'optional',
    stages: ['writing'],
    enabled: false,
    icon: 'message-circle',
  },
  {
    id: 'scene_describer',
    name: '场景描写师',
    description: '环境氛围描写参考',
    prompt: '你是一位场景描写专家。你的职责是为写手提供场景氛围描写的参考建议，包括：环境氛围、五感描写、光影效果、空间感等。你的输出是场景描写参考文档，不是小说正文。你必须：1.参考世界观设定确保场景一致；2.描写要有画面感和沉浸感；3.场景描写为情节服务，不做无意义的堆砌。你只输出参考文档，绝不写正文。',
    role: '环境氛围描写参考',
    category: 'optional',
    stages: ['writing'],
    enabled: false,
    icon: 'image',
  },
  {
    id: 'pacing_controller',
    name: '节奏把控师',
    description: '章节节奏和张力把控',
    prompt: '你是一位节奏把控专家。你的职责是在写手完成初稿后，分析章节节奏并提出调整建议，包括：节奏是否拖沓、高潮是否有力、过渡是否自然、张弛是否有度等。你的输出是节奏调整建议，不是小说正文。你必须：1.指出节奏问题的具体位置；2.给出调整方向而非具体文字；3.保持整体节奏的连贯性。你只输出建议，绝不直接改写正文。',
    role: '章节节奏和张力把控',
    category: 'optional',
    stages: ['writing', 'review'],
    enabled: false,
    icon: 'activity',
  },
  {
    id: 'foreshadow_designer',
    name: '伏笔设计师',
    description: '伏笔布局和回收',
    prompt: '你是一位伏笔设计专家。你的职责是设计章节中的伏笔布局和回收方案，包括：新伏笔的埋设、已有伏笔的推进、到期的伏笔的回收等。你的输出是伏笔设计文档，不是小说正文。你必须：1.参考前文已有的伏笔；2.新伏笔要自然不刻意；3.伏笔回收要有满足感；4.列出伏笔清单和计划回收章节。你只输出伏笔设计，绝不写正文。',
    role: '伏笔布局和回收',
    category: 'optional',
    stages: ['detail', 'writing'],
    enabled: false,
    icon: 'link',
  },
  {
    id: 'style_polisher',
    name: '风格润色师',
    description: '最终润色统一风格，除写手外唯一可输出正文',
    prompt: '你是一位文字润色专家。你的职责是对写手的初稿进行最终润色，统一文字风格，提升表达质量，包括：措辞优化、句式调整、重复词规避、文风统一等。你的输出是润色后的完整正文。你必须：1.保持原有情节和结构不变；2.只优化表达不改变内容；3.确保全文风格一致；4.输出润色后的完整正文。你是除写手外唯一可以输出正文的Agent。',
    role: '最终润色统一风格',
    category: 'optional',
    stages: ['writing'],
    enabled: false,
    icon: 'sparkles',
  },
];

/**
 * 各阶段默认Agent执行顺序
 * 统筹始终首尾，中间按顺序串行
 */
export const STAGE_AGENT_ORDER: Record<string, string[]> = {
  outline: ['coordinator', 'world_architect', 'plot_designer'],
  rough: ['coordinator', 'world_architect', 'plot_designer', 'rough_designer'],
  detail: ['coordinator', 'plot_designer', 'character_designer', 'foreshadow_designer', 'detail_designer'],
  writing: ['coordinator', 'memory_compressor', 'world_architect', 'character_designer', 'dialogue_designer', 'scene_describer', 'foreshadow_designer', 'writer', 'pacing_controller', 'style_polisher'],
  review: ['coordinator'], // 评审阶段由reviewTeamConfigs决定中间的Agent
};

/** 获取预置Agent by id */
export function getPresetAgent(id: string): PresetAgent | undefined {
  return PRESET_AGENTS.find(a => a.id === id);
}

/** 获取某阶段激活的Agent列表（按顺序，跳过禁用的） */
export function getActiveAgentsForStage(
  stage: string,
  userOverrides: Record<string, Partial<PresetAgent>> = {}
): PresetAgent[] {
  const order = STAGE_AGENT_ORDER[stage] || [];
  const result: PresetAgent[] = [];
  const seen = new Set<string>();

  for (const agentId of order) {
    if (seen.has(agentId)) continue; // 去重
    seen.add(agentId);

    const preset = PRESET_AGENTS.find(a => a.id === agentId);
    if (!preset) continue;

    const override = userOverrides[agentId] || {};
    const agent = { ...preset, ...override };

    // 必须Agent始终参与，其他按enabled判断
    if (agent.category === 'core' || agent.enabled) {
      result.push(agent);
    }
  }

  return result;
}

/** 获取某阶段要显示的Agent列表（用于进度UI） */
export function getAgentsForStage(stage: string): PresetAgent[] {
  return getActiveAgentsForStage(stage);
}

/** 获取所有已启用的Agent */
export async function getEnabledAgents(): Promise<PresetAgent[]> {
  const overridesStr = await AsyncStorage.getItem('agentConfigs');
  const overrides: Record<string, Partial<PresetAgent>> = overridesStr ? JSON.parse(overridesStr) : {};
  return PRESET_AGENTS.filter(a => {
    const override = overrides[a.id] || {};
    const enabled = override.enabled !== undefined ? override.enabled : a.enabled;
    return a.category === 'core' || enabled;
  }).map(a => ({ ...a, ...overrides[a.id] }));
}
