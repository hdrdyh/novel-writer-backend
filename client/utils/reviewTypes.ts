/**
 * 追责制审查系统 - 数据类型定义
 *
 * 核心概念：
 * - ReviewSession: 一次完整的审查会话（10步流程）
 * - ReviewMessage: 群聊中的一条消息
 * - ChangeRecord: 改动记录（局部/剧情）
 * - OutlineVersion: 细纲版本（支持修订历史）
 * - ReaderProfile: 读者画像
 */

// ============== 审查流程状态 ==============

/** 审查10步流程的状态枚举 */
export type ReviewStep =
  | 'showdown'        // 1. 亮底牌
  | 'write'           // 2. 写手执笔
  | 'review'          // 3. 追责
  | 'respond'         // 4. 写手回应
  | 'vote'            // 5. 投票
  | 'impact'          // 6. 影响评估
  | 'outline_update'  // 7. 细纲修订
  | 'consistency'     // 8. 一致性检查
  | 'execute'         // 9. 执行修改
  | 'verify';         // 10. 复核

/** 审查步骤的顺序定义（不可跳步） */
export const REVIEW_STEP_ORDER: ReviewStep[] = [
  'showdown',
  'write',
  'review',
  'respond',
  'vote',
  'impact',
  'outline_update',
  'consistency',
  'execute',
  'verify',
];

/** 审查步骤的中文名 */
export const REVIEW_STEP_LABELS: Record<ReviewStep, string> = {
  showdown: '亮底牌',
  write: '写手执笔',
  review: '追责',
  respond: '写手回应',
  vote: '投票',
  impact: '影响评估',
  outline_update: '细纲修订',
  consistency: '一致性检查',
  execute: '执行修改',
  verify: '复核',
};

// ============== 消息类型 ==============

/** agent类型：专业/读者/统筹 */
export type AgentType = 'pro' | 'reader' | 'coordinator';

/** 消息状态 */
export type MessageStatus = 'pending' | 'streaming' | 'done' | 'error';

/** 追责判定等级 */
export type ReviewVerdict = 'pass' | 'suggest' | 'fail' | 'critical';

/** 投票立场 */
export type VoteStance = 'keep' | 'change';

/** 群聊消息 */
export interface ReviewMessage {
  id: string;
  sessionId: string;
  step: ReviewStep;
  stepIndex: number;       // 0-9
  agentId: string;         // agent presetId 或 reader_xxx
  agentName: string;       // 显示名
  agentType: AgentType;
  content: string;
  status: MessageStatus;
  timestamp: number;
  // 追责专用
  verdict?: ReviewVerdict;  // 追责判定
  verdictReason?: string;   // 判定理由
  // 投票专用
  voteStance?: VoteStance;
  voteReason?: string;
  voteWeight?: number;      // 投票权重（读者加权）
}

// ============== 审查会话 ==============

/** 审查会话状态 */
export type SessionStatus = 'active' | 'paused' | 'completed' | 'cancelled';

/** 审查会话 */
export interface ReviewSession {
  id: string;
  createdAt: number;
  updatedAt: number;
  status: SessionStatus;
  currentStep: ReviewStep;
  currentStepIndex: number;
  // 审查对象
  chapterIndex: number;
  paragraphIndex: number;   // -1 表示整章审查
  originalText: string;     // 原始段落文本
  revisedText?: string;     // 修改后文本
  // 小说类型（决定哪些读者是重点）
  novelType: string;
  // 重点读者ID列表
  focusReaderIds: string[];
  // 消息列表（只存ID引用，实际消息在 review_messages 里）
  messageIds: string[];
  // 改动记录ID列表
  changeRecordIds: string[];
  // 梗库快照（本章搜到的时新梗）
  slangSnapshot: string;
}

// ============== 改动记录 ==============

/** 改动类型 */
export type ChangeType = 'local' | 'plot';

/** 改动状态 */
export type ChangeStatus = 'pending' | 'applied' | 'rejected';

/** 改动记录 */
export interface ChangeRecord {
  id: string;
  sessionId: string;
  chapterIndex: number;
  paragraphIndex: number;
  changeType: ChangeType;
  status: ChangeStatus;
  description: string;           // 改动描述
  originalContent: string;       // 原始内容
  revisedContent?: string;       // 修改后内容
  // 剧情改动专用
  affectedChapters?: number[];   // 受影响的章节号
  outlinePatchId?: string;       // 关联的细纲补丁ID
  // 审核信息
  verifiedBy?: string;           // 复核方 agentId
  verifiedAt?: number;           // 复核时间
  createdAt: number;
}

// ============== 细纲版本 ==============

/** 细纲补丁 */
export interface OutlinePatch {
  id: string;
  version: string;              // 如 "v1.1"
  parentVersion: string;        // 父版本号
  sourceSessionId: string;      // 来源审查会话
  sourceChangeId: string;       // 来源改动记录
  reason: string;               // 修订原因
  patches: OutlineChapterPatch[];  // 各章节的修改
  createdAt: number;
}

/** 单个章节的细纲修改 */
export interface OutlineChapterPatch {
  chapterIndex: number;
  originalOutline: string;      // 原始细纲内容
  revisedOutline: string;       // 修改后细纲内容
  changed: boolean;             // 是否有变化
}

/** 细纲版本信息 */
export interface OutlineVersionInfo {
  currentVersion: string;       // 当前生效版本号
  baseVersion: string;          // 基础版本（v1.0）
  patches: OutlinePatch[];      // 所有补丁（按版本号排序）
  lastUpdatedAt: number;
}

// ============== 读者画像 ==============

/** 读者类型 */
export type ReaderType = 'office_worker' | 'otaku' | 'student' | 'veteran' | 'night_owl';

/** 读者画像 */
export interface ReaderProfile {
  id: ReaderType;
  name: string;
  avatar: string;               // emoji头像
  description: string;          // 一句话画像
  bottomLine: string;           // 底线（什么情况下弃书）
  thrillPoints: string[];       // 爽点偏好
  speakStyle: string;           // 说话风格
  weight: number;               // 基础权重
  color: string;                // 气泡颜色
}

/** 小说类型→重点读者映射 */
export const NOVEL_TYPE_READERS: Record<string, ReaderType[]> = {
  '玄幻修仙': ['office_worker', 'student', 'veteran'],
  '都市重生': ['office_worker', 'otaku', 'night_owl'],
  '悬疑推理': ['night_owl', 'veteran'],
  '系统流': ['office_worker', 'student'],
  '甜宠言情': ['otaku', 'student', 'night_owl'],
  '虐文': ['night_owl', 'otaku'],
  '默认': ['office_worker', 'otaku', 'student'],
};

// ============== 默认读者定义 ==============

export const DEFAULT_READERS: ReaderProfile[] = [
  {
    id: 'office_worker',
    name: '上班族',
    avatar: 'briefcase',
    description: '996打工人，通勤和睡前看小说',
    bottomLine: '连续3段没爽点就跳，主角受委屈超过1章就弃',
    thrillPoints: ['打脸', '碾压', '装逼', '反转', '弱者翻身', '现世报'],
    speakStyle: '直接，不管设定对不对，只说爽不爽，说话带网络梗',
    weight: 2,
    color: '#FF6B35',
  },
  {
    id: 'otaku',
    name: '宅男',
    avatar: 'gamepad',
    description: '社交少，小说是精神寄托，大段连续时间看',
    bottomLine: '代入感差就弃，女主塑造敷衍就弃',
    thrillPoints: ['代入感', '红颜知己', '大佬主动结交', '被选中', '身份揭露'],
    speakStyle: '关注角色情感和代入感，说话带梗，对女主敏感',
    weight: 2,
    color: '#7C3AED',
  },
  {
    id: 'student',
    name: '学生党',
    avatar: 'book',
    description: '零花钱有限，课上偷偷看，热血',
    bottomLine: '不值就弃，幼稚也弃，但容易被满足',
    thrillPoints: ['一招秒杀', '天赋觉醒', '碾压全场', '装逼打脸', '帅'],
    speakStyle: '简短有力，关注帅不帅爽不爽，说话带学生梗',
    weight: 2,
    color: '#059669',
  },
  {
    id: 'veteran',
    name: '老书虫',
    avatar: 'glasses',
    description: '看了五年以上，什么套路都见过',
    bottomLine: '一眼看穿伏笔就无聊，套路重复就弃',
    thrillPoints: ['反套路', '新花样', '意料之外', '暗线揭露', '智商在线'],
    speakStyle: '毒舌，一眼识破套路，要求新意，说话带老道梗',
    weight: 1.5,
    color: '#6B7280',
  },
  {
    id: 'night_owl',
    name: '夜猫族',
    avatar: 'moon',
    description: '凌晨1-3点看，情绪最脆弱的时候',
    bottomLine: '三行不抓就划走，抓住了能看通宵',
    thrillPoints: ['开头钩子', '章尾钩子', '极致反转', '疯魔爆发', '燃起来了'],
    speakStyle: '情绪化，沉浸感要求高，说话带夜猫梗',
    weight: 1.5,
    color: '#3B82F6',
  },
];

// ============== 爽点类型 ==============

export type ThrillCategory =
  | 'identity'    // 身份类
  | 'power'       // 实力类
  | 'revenge'     // 报复类
  | 'contrast'    // 反差类
  | 'reversal'    // 反转类
  | 'frenzy'      // 疯魔类
  | 'wealth'      // 财富类
  | 'bond'        // 羁绊类
  | 'recognition' // 认可类
  | 'control';    // 掌控类

export const THRILL_CATEGORIES: Record<ThrillCategory, { label: string; items: string[] }> = {
  identity: {
    label: '身份类',
    items: ['废物真身揭露', '天才归来', '大佬伪装', '低调王者', '被选中者', '传承觉醒', '身份碾压'],
  },
  power: {
    label: '实力类',
    items: ['一招秒杀', '越级挑战', '碾压全场', '众强围攻依然碾压', '不出手就吓退', '一个眼神', '无人敢动'],
  },
  revenge: {
    label: '报复类',
    items: ['当面打脸', '迟来的惩罚', '十倍奉还', '不接受道歉', '让你跪', '新账旧账一起算', '斩草除根', '你求我也没用'],
  },
  contrast: {
    label: '反差类',
    items: ['跪着的人站起来', '最弱变最强', '笑话变传说', '乞丐变帝王', '囚徒变主宰', '孤儿变天骄'],
  },
  reversal: {
    label: '反转类',
    items: ['示弱是演的', '故意输的', '早就布局了', '一切尽在掌控', '你以为赢了？', '我等的就是这一刻'],
  },
  frenzy: {
    label: '疯魔类',
    items: ['忍到极限爆发', '不死不休', '笑着毁灭', '流泪碾压', '无人可挡', '踏尸前行'],
  },
  wealth: {
    label: '财富类',
    items: ['一掷千金', '全场买单', '你嫌我穷我买下你', '天材地宝随便拿', '资源自由', '钱对我来说没有意义'],
  },
  bond: {
    label: '羁绊类',
    items: ['冰山融化', '红颜相随', '大佬主动结交', '被抛弃后众人追随', '孤独者不再孤独'],
  },
  recognition: {
    label: '认可类',
    items: ['大佬亲迎', '天才低头', '强者敬酒', '曾经看不起的人悔恨终生', '全场无人敢出声'],
  },
  control: {
    label: '掌控类',
    items: ['一言定生死', '翻手为云', '他站着就是规则', '所有人的命运在他手里'],
  },
};

// ============== 三个硬指标 ==============

export interface HardCheckResult {
  checkType: 'opening_hook' | 'thrill_density' | 'chapter_end_hook';
  passed: boolean;
  comment: string;
}

export const HARD_CHECKS = {
  opening_hook: {
    label: '开头3行钩子',
    description: '看到第三行时，想不想继续看？',
  },
  thrill_density: {
    label: '爽点密度',
    description: '这章有没有至少一个让读者"卧槽"的瞬间？',
  },
  chapter_end_hook: {
    label: '章尾钩子',
    description: '看完最后一句，会不会点下一章？',
  },
} as const;
