/**
 * 梗库模块 - 经典梗 + 时新梗
 * 
 * 经典梗：内置常量，永不过时
 * 时新梗：每章开写前从后端搜一次，缓存当章使用
 */

// ============== 经典梗库 ==============

/** 吐槽类 - 质疑、不满、嫌弃 */
const SLANG_ROAST = [
  '卧槽', '就这？', '你认真的？', '好家伙', '我直接好家伙',
  '纯纯的', '答辩', '寄', '摆烂', '躺平', '破防了',
  '我裂开了', '社死', '大冤种', '小丑竟是我自己',
  '离谱', '太离谱了', '什么鬼', '什么玩意儿',
  '就这水平？', '建议重开', '换人吧', '别写了',
  '你在教我做事？', '你没事吧', '笑死', '谁给你的勇气',
  '也就那样', '不过如此', '花里胡哨', '别整这些没用的',
  '绷不住', '属实绷不住', '真绷不住了',
] as const;

/** 爽到类 - 满足、兴奋、认可 */
const SLANG_HYPE = [
  '牛逼', '6', '666', '赢麻了', '杀疯了', '爽到飞起',
  '膜拜', '大佬', '遥遥领先', '降维打击', '稳了',
  '拿捏', '上大分', '这波可以', '太可了',
  '帅炸了', '绝杀', '暴击', '核弹级',
  '燃起来了', '上头了', '起飞', '直接起飞',
  '真香', '顶', '满分', '完美的',
] as const;

/** 认同类 - 共鸣、理解、恍然 */
const SLANG_RESONATE = [
  '真实', '懂的都懂', '我悟了', '细思极恐', '高能预警',
  '绝了', '太绝了', '我emo了', '懂的',
  '就是这个味', '味对了', '对味了',
  '我哭死', '眼泪不争气', '破大防',
  '鸡皮疙瘩', '汗毛倒竖', '头皮发麻',
] as const;

/** 嘲讽类 - 挑刺、反讽、看不上 */
const SLANG_SARCASM = [
  '就这？', '还行吧（反讽）', '挺好的（不是）',
  '了不起呢', '可太厉害了', '精彩精彩',
  '又来了', '老套路', '就这套路',
  '下一个', '跳过', '我选择死亡',
  '无聊到想睡觉', '看得我困了', '这是在写什么',
  '这剧情我奶奶都能写', '写手是不是在摸鱼',
] as const;

/** 情绪类 - 激动、愤怒、崩溃 */
const SLANG_EMOTION = [
  '草', '我直接跪了', '燃起来了', '我人傻了',
  '绷不住了', '眼泪不争气', '鸡皮疙瘩', '上头了',
  '不爽', '心里堵得慌', '受不了了', '忍不了',
  '这也能忍？', '我是主角早动手了',
  '凭什么', '不公平', '气死我了',
] as const;

/** 打call类 - 催更、叫好、期待 */
const SLANG_CHEER = [
  '催更', '快写', '不要停', '继续',
  '下一章呢', '等不及了', '急死我了',
  '加更', '爆更', '求求了',
  '给我写', '写到天亮', '别睡了',
  '章呢？', '更新呢？', '人呢？',
] as const;

// ============== 导出 ==============

/** 所有经典梗，按分类 */
export const CLASSIC_SLANG = {
  roast: SLANG_ROAST,
  hype: SLANG_HYPE,
  resonate: SLANG_RESONATE,
  sarcasm: SLANG_SARCASM,
  emotion: SLANG_EMOTION,
  cheer: SLANG_CHEER,
} as const;

/** 所有经典梗的扁平列表（用于注入prompt） */
export const CLASSIC_SLANG_FLAT: string = [
  ...SLANG_ROAST,
  ...SLANG_HYPE,
  ...SLANG_RESONATE,
  ...SLANG_SARCASM,
  ...SLANG_EMOTION,
  ...SLANG_CHEER,
].join('/');

/** 分类中文名映射 */
export const SLANG_CATEGORY_NAMES: Record<string, string> = {
  roast: '吐槽',
  hype: '爽到',
  resonate: '共鸣',
  sarcasm: '嘲讽',
  emotion: '情绪',
  cheer: '催更',
};

// ============== 时新梗缓存 ==============

let cachedFreshSlang = '';
let cachedFreshSlangTime = 0;
const CACHE_DURATION = 30 * 60 * 1000; // 30分钟缓存

/**
 * 设置时新梗缓存（前端调用后端API后设置）
 */
export function setFreshSlang(slang: string): void {
  cachedFreshSlang = slang;
  cachedFreshSlangTime = Date.now();
}

/**
 * 获取时新梗缓存
 * @returns 缓存的时新梗，过期返回空字符串
 */
export function getFreshSlang(): string {
  if (Date.now() - cachedFreshSlangTime > CACHE_DURATION) {
    cachedFreshSlang = '';
    return '';
  }
  return cachedFreshSlang;
}

/**
 * 从后端API获取最新网络梗，并缓存到内存
 * 每章开写前调用一次
 * @param novelType 小说类型，可选（如 玄修/都市）
 * @returns 时新梗字符串
 */
export async function fetchFreshSlang(novelType?: string): Promise<string> {
  try {
    const baseUrl = process.env.EXPO_PUBLIC_BACKEND_BASE_URL;
    const typeParam = novelType ? `?type=${encodeURIComponent(novelType)}` : '';
    const response = await fetch(`${baseUrl}/api/v1/slang/fresh${typeParam}`);
    const data = await response.json();

    if (data.slang) {
      setFreshSlang(data.slang);
      return data.slang;
    }
    return '';
  } catch {
    // 搜索失败不影响流程，经典梗兜底
    return '';
  }
}

/**
 * 组合完整梗库（经典 + 时新），用于注入agent prompt
 * @param novelType 小说类型，可选
 * @returns 完整梗库字符串
 */
export function getFullSlangLib(novelType?: string): string {
  const fresh = getFreshSlang();
  const base = CLASSIC_SLANG_FLAT;
  if (fresh) {
    return `${base} / ${fresh}`;
  }
  return base;
}

/**
 * 生成梗库注入prompt片段
 * 在agent的社交指令中追加这段
 */
export function buildSlangPromptFragment(novelType?: string): string {
  const slangLib = getFullSlangLib(novelType);
  return `【当前可用网络梗/口头禅】
${slangLib}

使用规则：
- 像真人聊天一样自然带入，不是每句都要加
- 同一个梗一次审查最多用一次，不要重复
- 不确定怎么用的梗就别用，别用错
- 吐槽的时候用梗最自然，正经提建议时少用
- 说话像群里兄弟聊天，不要太正式`;
}
