// ============== 类型定义 ==============

export interface ApiConfig {
  id: string;
  name: string;
  apiKey: string;
  baseUrl: string;
  model: string;
}

export interface AgentConfig {
  presetId: string;       // 对应 PRESET_AGENTS 的 id
  name: string;           // 可被用户修改
  prompt: string;         // 可被用户修改
  enabled: boolean;
  apiId?: string;         // 绑定的API配置ID
  order: number;          // 执行顺序
}

export interface ReviewAgent {
  id: string;
  name: string;
  role: string;
  prompt: string;
  enabled: boolean;
  order: number;
  apiId?: string;
}

export interface ReviewConfig {
  focusDirection: string;
  rounds: number;
  maxWords: number;
}

// ============== 默认评审团Agent ==============
export const DEFAULT_REVIEW_AGENTS: Omit<ReviewAgent, 'id'>[] = [
  { name: '逻辑审查员', role: 'logic', prompt: '你是逻辑审查员，负责检查内容的逻辑一致性，找出前后矛盾、因果不通、设定冲突等问题。用简短直接的语言指出问题所在。', enabled: true, order: 1 },
  { name: '节奏分析师', role: 'pacing', prompt: '你是节奏分析师，负责分析叙事节奏是否合理，是否存在拖沓、跳跃、冗余等问题。给出具体的调整建议。', enabled: true, order: 2 },
  { name: '读者视角', role: 'reader', prompt: '你站在读者视角，评价这段内容的吸引力、可读性和代入感。告诉作者读者最关心的点和最可能弃读的地方。', enabled: true, order: 3 },
];
