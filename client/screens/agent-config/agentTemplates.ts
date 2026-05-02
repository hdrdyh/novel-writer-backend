import { PRESET_AGENTS } from '@/utils/presetAgents';

// ============== 模板解析/导出工具 ==============

export interface ParsedTemplateItem {
  presetId: string;
  name: string;
  prompt: string;
  enabled: boolean;
}

export interface ParsedTemplate {
  globalRules: string;
  agents: ParsedTemplateItem[];
}

/**
 * 模板格式：
 * [全局铁律]
 * 1.全程去除AI味
 * 2.严禁破折号分号
 *
 * === 写手 ===
 * 启用
 * 你是一位经验丰富的小说写手...
 *
 * === 统筹 ===
 * 禁用
 * 你是一位小说创作统筹...
 */
export const parseTemplate = (text: string): ParsedTemplate => {
  let globalRules = '';
  const agents: ParsedTemplateItem[] = [];

  // 提取[全局铁律]段落
  const globalRulesIdx = text.indexOf('[全局铁律]');
  if (globalRulesIdx !== -1) {
    const afterMarker = text.substring(globalRulesIdx + '[全局铁律]'.length);
    const nextAgentIdx = afterMarker.indexOf('\n===');
    globalRules = (nextAgentIdx !== -1 ? afterMarker.substring(0, nextAgentIdx) : afterMarker).trim();
  }

  // 解析助手段落
  const blocks = text.split(/===\s*/).filter(b => b.trim());

  for (const block of blocks) {
    const lines = block.split('\n');
    const agentName = lines[0].replace(/\s*===\s*$/, '').trim();
    if (!agentName) continue;

    const preset = PRESET_AGENTS.find(p => p.name === agentName || p.id === agentName);
    if (!preset) continue;

    const statusLine = (lines[1] || '').trim();
    const enabled = statusLine === '启用' || statusLine === '开启' || statusLine === 'true' || statusLine === '1';

    const promptLines = lines.slice(2).join('\n').trim();

    agents.push({
      presetId: preset.id,
      name: preset.name,
      prompt: promptLines || preset.prompt,
      enabled,
    });
  }

  return { globalRules, agents };
};

export const exportTemplate = (
  agentConfigs: { presetId: string; name: string; prompt: string; enabled: boolean }[],
  globalRules?: string,
): string => {
  const lines: string[] = [];

  // 导出全局铁律
  if (globalRules && globalRules.trim()) {
    lines.push('[全局铁律]');
    lines.push(globalRules.trim());
    lines.push('');
  }

  for (const preset of PRESET_AGENTS) {
    const config = agentConfigs.find(c => c.presetId === preset.id);
    const name = config?.name || preset.name;
    const enabled = config?.enabled ?? preset.enabled;
    const prompt = config?.prompt || preset.prompt;
    lines.push(`=== ${name} ===`);
    lines.push(enabled ? '启用' : '禁用');
    lines.push(prompt);
    lines.push('');
  }
  return lines.join('\n');
};

// ============== 内置预设模板 ==============

export interface BuiltinTemplate {
  name: string;
  desc: string;
  text: string;
}

export const BUILTIN_TEMPLATES: BuiltinTemplate[] = [
  {
    name: '默认配置',
    desc: '核心+推荐启用，可选关闭，默认规则',
    text: PRESET_AGENTS.map(p => `=== ${p.name} ===\n${p.category === 'core' || p.category === 'recommended' ? '启用' : '禁用'}\n${p.prompt}`).join('\n\n'),
  },
  {
    name: '全量协作',
    desc: '所有助手全部启用',
    text: PRESET_AGENTS.map(p => `=== ${p.name} ===\n启用\n${p.prompt}`).join('\n\n'),
  },
  {
    name: '极简写作',
    desc: '只保留写手+统筹+润色师',
    text: PRESET_AGENTS
      .filter(p => ['writer', 'coordinator', 'style_polisher'].includes(p.id))
      .map(p => `=== ${p.name} ===\n启用\n${p.prompt}`)
      .join('\n\n'),
  },
  {
    name: '悬疑推理',
    desc: '强化剧情/伏笔/节奏，弱化世界观/对话',
    text: PRESET_AGENTS.map(p => {
      let enabled = p.category === 'core';
      let prompt = p.prompt;
      if (['plot_designer', 'foreshadow_designer', 'pacing_controller', 'character_designer', 'detail_designer', 'memory_compressor'].includes(p.id)) {
        enabled = true;
      }
      if (p.id === 'plot_designer') {
        prompt = '你是一位悬疑推理剧情设计专家。你的唯一职责是设计小说的情节线，特别注重：1.案件线索的布局和递进揭示；2.嫌疑人设置的误导与反转；3.悬念的层层升级；4.逻辑推理链的严密性；5.真相揭晓时的震撼感。你必须确保每个线索都有交代，每个反转都有伏笔支撑。你只输出剧情设计文档，绝不写正文。';
      }
      if (p.id === 'foreshadow_designer') {
        prompt = '你是一位悬疑伏笔设计专家。你的职责是精心设计案件中的伏笔布局，包括：1.关键线索的隐蔽埋设；2.误导性信息的巧妙穿插；3.真相反转的层层铺垫；4.伏笔回收时的意外与合理并存。你必须确保伏笔自然不刻意，回收时有恍然大悟的满足感。你只输出伏笔设计文档，绝不写正文。';
      }
      if (p.id === 'pacing_controller') {
        prompt = '你是一位悬疑节奏把控专家。你的职责是确保章节节奏紧凑、悬念感持续，包括：1.每章结尾设置钩子让读者欲罢不能；2.信息揭示的节奏把控——不能太快也不能太慢；3.紧张与舒缓的交替；4.高潮戏的节奏加速。你必须确保读者始终处于"想知道真相"的紧迫感中。你只输出节奏调整建议，绝不写正文。';
      }
      if (p.id === 'character_designer') {
        prompt = '你是一位悬疑小说人物塑造专家。你的职责是设计嫌疑人、侦探、受害者等角色，特别注重：1.每个嫌疑人都有作案动机和不在场证明的矛盾；2.角色表面与内心的反差；3.人物关系的暗流涌动；4.关键人物的信息差设计。你必须确保人物立体不脸谱化，每个人都有秘密。你只输出人物设定文档，绝不写正文。';
      }
      return `=== ${p.name} ===\n${enabled ? '启用' : '禁用'}\n${prompt}`;
    }).join('\n\n'),
  },
  {
    name: '玄幻修仙',
    desc: '强化世界观/人物/伏笔，适合长篇',
    text: (() => {
      const globalRules = '1.全程去除AI味。只用通俗自然短句。禁止书面长句和空洞排比。\n2.严禁使用破折号。严禁使用分号。\n3.不直白旁白概括设定。全部靠动作细节对话体现。\n4.禁止强行升华。禁止生硬讲道理煽情。\n5.严格遵守固定人设。绝不私自篡改人物。';
      let text = `[全局铁律]\n${globalRules}\n\n`;
      text += PRESET_AGENTS.map(p => {
        let enabled = p.category === 'core';
        let prompt = p.prompt;
        if (['world_architect', 'character_designer', 'foreshadow_designer', 'plot_designer', 'detail_designer', 'memory_compressor', 'style_polisher'].includes(p.id)) {
          enabled = true;
        }
        if (p.id === 'world_architect') {
          prompt = '你是一位玄幻修仙世界观架构专家。你的职责是设计完整的修仙世界观体系，包括：1.修炼体系（境界划分、突破条件、天劫设定）；2.势力格局（宗门、世家、散修、魔道）；3.地理体系（凡界、修仙界、秘境、禁地）；4.资源体系（灵石、丹药、法宝、功法的品级划分）；5.天道法则与因果循环。你必须确保体系完整、等级分明、有成长空间。你只输出世界观设定文档，绝不写正文。';
        }
        if (p.id === 'character_designer') {
          prompt = '你是一位玄幻修仙人物塑造专家。你的职责是设计修仙者角色体系，特别注重：1.修炼资质与心性成长的对应；2.师承关系与门派立场；3.道侣/兄弟/宿敌的情感纽带；4.性格在修炼路上的变化轨迹；5.功法与性格的相互影响。你必须确保每个角色都有独特的修炼道路和性格魅力。你只输出人物设定文档，绝不写正文。';
        }
        if (p.id === 'foreshadow_designer') {
          prompt = '你是一位玄幻修仙伏笔设计专家。你的职责是设计长篇伏笔布局，包括：1.前世因果的层层揭示；2.宝物/功法的隐藏来历；3.势力暗棋和卧底；4.天道预言与宿命；5.跨越数十章的大伏笔回收。你必须确保伏笔有远有近、有明有暗，让读者始终有期待感。你只输出伏笔设计文档，绝不写正文。';
        }
        if (p.id === 'style_polisher') {
          prompt = '你是一位玄幻修仙文字润色专家。你的职责是对写手的初稿进行润色，特别注重：1.修炼术语的一致性和准确性；2.战斗场面的画面感和节奏感；3.境界突破时的气势渲染；4.古风文辞的韵味和节奏；5.避免现代化用语破坏仙侠氛围。你必须保持原有情节不变，只优化表达。你只输出润色后的正文。';
        }
        return `=== ${p.name} ===\n${enabled ? '启用' : '禁用'}\n${prompt}`;
      }).join('\n\n');
      return text;
    })(),
  },
];
