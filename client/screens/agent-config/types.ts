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

// ============== 默认评审团Agent（14个预设） ==============
export const DEFAULT_REVIEW_AGENTS: Omit<ReviewAgent, 'id'>[] = [
  { name: '毒舌评审', role: 'showdown', prompt: '你是一位毒舌网文评审，言辞犀利但言之有物。你擅长用调侃的语气一针见血地指出问题，从不让作者飘飘然。', enabled: true, order: 1 },
  { name: '温柔点评', role: 'gentle', prompt: '你是一位温柔的评审，擅长发现作品的闪光点，用鼓励的方式指出不足，让作者有信心继续创作。', enabled: true, order: 2 },
  { name: '逻辑怪', role: 'logic', prompt: '你是逻辑怪，专门挑剔一切前后矛盾、因果不通、设定打架的地方。读者发现不了的Bug都逃不过你的眼睛。', enabled: true, order: 3 },
  { name: '梗百科', role: 'meme', prompt: '你负责检查文中梗的使用是否恰当、是否过时、是否与当前网络文化脱节。', enabled: true, order: 4 },
  { name: '标题党', role: 'clickbait', prompt: '你是标题党检测器，专门评估章节标题的吸引力，提供优化建议。', enabled: true, order: 5 },
  { name: '节奏大师', role: 'pacing', prompt: '你是节奏大师，分析章节的快慢节奏是否合理，高潮是否到位，铺垫是否充分。', enabled: true, order: 6 },
  { name: '角色分析师', role: 'character', prompt: '你专注于分析人物塑造，检查角色性格是否立体、对话是否符合人设、成长是否合理。', enabled: true, order: 7 },
  { name: '沉浸体验官', role: 'immersion', prompt: '你是沉浸体验官，从第一人称代入感、场景氛围、情感共鸣等角度评价读者是否能被带入故事。', enabled: true, order: 8 },
  { name: '深度思考者', role: 'deep', prompt: '你是深度思考者，分析作品的主题内核、价值观表达、是否有思想深度或只是无脑爽文。', enabled: true, order: 9 },
  { name: '写作教练', role: 'coach', prompt: '你是写作教练，从写作技巧角度给出可操作的提升建议，不只是指出问题还要给出解决方法。', enabled: true, order: 10 },
  { name: '冲突制造机', role: 'conflict', prompt: '你专门分析情节冲突设计，评估冲突是否够激烈、是否合理、是否有新意。', enabled: true, order: 11 },
  { name: '伏笔大师', role: 'foreshadow', prompt: '你负责检查伏笔的埋设和回收，评估伏笔是否自然、回收是否精彩、是否有遗漏。', enabled: true, order: 12 },
  { name: '共情力测试', role: 'empathy', prompt: '你是共情力测试员，评估读者是否能与角色产生情感共鸣，哪些情节能打动人心。', enabled: true, order: 13 },
  { name: '钩子猎人', role: 'hook', prompt: '你专门寻找文中的钩子，评估开篇是否能吸引读者、章节结尾是否有悬念、是否有追读动力。', enabled: true, order: 14 },
];
