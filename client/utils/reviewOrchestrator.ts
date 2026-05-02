/**
 * 追责制审查编排器
 *
 * 10步状态机，控制完整审查流程：
 * 1. 亮底牌 → 2. 写手执笔 → 3. 追责 → 4. 写手回应 → 5. 投票
 * → 6. 影响评估 → 7. 细纲修订 → 8. 一致性检查 → 9. 执行修改 → 10. 复核
 *
 * 严格不可跳步，每步有前置校验。
 */

import RNSSE from 'react-native-sse';
import Constants from 'expo-constants';
import {
  ReviewStep,
  ReviewMessage,
  ReviewSession,
  ChangeRecord,
  ChangeType,
  ChangeStatus,
  OutlinePatch,
  OutlineChapterPatch,
  OutlineVersionInfo,
  ReviewVerdict,
  VoteStance,
  AgentType,
  MessageStatus,
  REVIEW_STEP_ORDER,
  REVIEW_STEP_LABELS,
  DEFAULT_READERS,
  NOVEL_TYPE_READERS,
  ReaderProfile,
  THRILL_CATEGORIES,
  HARD_CHECKS,
} from './reviewTypes';
import {
  createReviewSession,
  updateReviewSession,
  advanceSessionStep,
  getReviewSession,
  getSessionList,
  getSessionMessages,
  addReviewMessage,
  updateReviewMessage,
  getSessionChanges,
  addChangeRecord,
  updateChangeStatus,
  getPendingPlotChanges,
  canWriteChapter,
  addOutlinePatch,
  getOutlineVersionInfo,
  getCurrentOutline,
} from './reviewStorage';
import { getFullSlangLib, CLASSIC_SLANG } from './slangLib';
import { PRESET_AGENTS } from './presetAgents';

// ============== 常量 ==============

const OUTLINE_STORAGE_KEY = 'novel_outline';

// ============== 回调类型 ==============

/** 消息流式回调（逐字输出） */
export type OnMessageChunk = (messageId: string, chunk: string) => void;

/** 步骤完成回调 */
export type OnStepComplete = (step: ReviewStep, messages: ReviewMessage[]) => void;

/** 需要用户确认回调（全局级改动） */
export type OnNeedConfirm = (change: ChangeRecord, outlinePatch: OutlinePatch | null) => Promise<boolean>;

/** 错误回调 */
export type OnError = (step: ReviewStep, error: Error) => void;

export interface ReviewCallbacks {
  onMessageChunk: OnMessageChunk;
  onStepComplete: OnStepComplete;
  onNeedConfirm: OnNeedConfirm;
  onError: OnError;
}

// ============== 辅助函数 ==============

// 模块级计数器，用于生成唯一ID
let _idCounter = 0;

function generateId(): string {
  const now = Date.now();
  _idCounter += 1;
  return `msg_${now}_${_idCounter}_${Math.random().toString(36).slice(2, 6)}`;
}

function generatePatchId(): string {
  const now = Date.now();
  _idCounter += 1;
  return `patch_${now}_${_idCounter}_${Math.random().toString(36).slice(2, 6)}`;
}

/** 获取步骤索引 */
function getStepIndex(step: ReviewStep): number {
  return REVIEW_STEP_ORDER.indexOf(step);
}

/** 下一步 */
function getNextStep(step: ReviewStep): ReviewStep | null {
  const idx = getStepIndex(step);
  if (idx < 0 || idx >= REVIEW_STEP_ORDER.length - 1) return null;
  return REVIEW_STEP_ORDER[idx + 1];
}

/** 获取当前小说的重点读者 */
function getFocusReaders(novelType: string): ReaderProfile[] {
  const readerIds = NOVEL_TYPE_READERS[novelType] || NOVEL_TYPE_READERS['默认'] || [];
  return DEFAULT_READERS.filter(r => readerIds.includes(r.id));
}

/** 获取陪审读者（非重点） */
function getJuryReaders(novelType: string): ReaderProfile[] {
  const focusIds = NOVEL_TYPE_READERS[novelType] || NOVEL_TYPE_READERS['默认'] || [];
  return DEFAULT_READERS.filter(r => !focusIds.includes(r.id));
}

/** 构建agent的系统prompt（带梗库） */
function buildAgentSystemPrompt(
  agentId: string,
  agentName: string,
  agentRole: string,
  slangLib: string,
): string {
  return `你是小说创作团队中的${agentName}，职责：${agentRole}

说话时自然地带入网络流行梗，像真人聊天一样。可用梗：${slangLib}

注意：梗要自然使用，不是每句都加，同一个梗一次审查最多用一次。吐槽时用梗最自然，正经提建议时少用。`;
}

/** 构建读者的系统prompt */
function buildReaderSystemPrompt(reader: ReaderProfile, slangLib: string): string {
  const thrillList = reader.thrillPoints.join('、');
  return `你是番茄小说的典型读者：${reader.name}。${reader.description}

你的底线：${reader.bottomLine}
你的爽点偏好：${thrillList}
你的说话风格：${reader.speakStyle}

你发言时用读者口吻，不要用分析腔调。说话时自然地带入网络流行梗。可用梗：${slangLib}

你的判断标准只有一个：我会不会继续往下看？
- 不会 → 必须改，给出原因
- 会但勉强 → 建议优化
- 完全停不下来 → 过关

投票原则：
- 爽的方案投keep，不爽的投change
- 两个都爽投更爽的
- 你的投票权重是${reader.weight}`;
}

// ============== LLM调用封装 ==============

/**
 * 调用LLM（通过SSE流式接口，使用react-native-sse）
 * 后端代理SSE接口：POST /api/v1/review/stream
 */
interface AgentInfo {
  agentId: string;
  agentName: string;
  agentType: AgentType;
}

async function callLLM(
  apiConfig: { baseUrl: string; apiKey: string; model: string },
  agentInfo: AgentInfo,
  systemPrompt: string,
  userPrompt: string,
  onChunk: (chunk: string) => void,
  maxTokens: number = 2048,
): Promise<string> {
  // API请求通过Metro proxy转发，使用相对路径
  const url = `/api/v1/review/agent-stream`;

  return new Promise((resolve, reject) => {
    let fullContent = '';
    let settled = false;

    const sse = new RNSSE(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        agentId: agentInfo.agentId,
        agentRole: agentInfo.agentName,
        agentType: agentInfo.agentType,
        prompt: userPrompt,
        systemPrompt,
        model: apiConfig.model,
        apiUrl: apiConfig.baseUrl,
        apiKey: apiConfig.apiKey,
        maxTokens,
      }),
    });

    sse.addEventListener('message', (event) => {
      if (!event.data || settled) return;
      if (event.data === '[DONE]') {
        settled = true;
        sse.close();
        resolve(fullContent);
        return;
      }

      try {
        const parsed = JSON.parse(event.data);
        const delta = parsed.choices?.[0]?.delta?.content || '';
        if (delta) {
          fullContent += delta;
          onChunk(delta);
        }
      } catch {
        // 跳过无法解析的行
      }
    });

    sse.addEventListener('error', (event) => {
      if (!settled) {
        settled = true;
        reject(new Error(`SSE error: ${event.type || 'unknown'}`));
      }
    });

    // 超时保护（60秒）
    setTimeout(() => {
      if (!settled) {
        settled = true;
        sse.close();
        if (fullContent) {
          resolve(fullContent);
        } else {
          reject(new Error('SSE timeout'));
        }
      }
    }, 60000);
  });
}

// ============== 审查编排器主类 ==============

export class ReviewOrchestrator {
  private session: ReviewSession | null = null;
  private callbacks: ReviewCallbacks;
  private apiConfig: { baseUrl: string; apiKey: string; model: string };
  private outline: string = '';       // 当前细纲
  private writtenContent: string = ''; // 已写内容（供记忆agent用）
  private slangLib: string = '';       // 梗库
  private novelType: string = '';      // 小说类型

  // 每步的缓存消息
  private stepMessages: Map<ReviewStep, ReviewMessage[]> = new Map();
  // 追责结果缓存
  private reviewVerdicts: Map<string, { verdict: ReviewVerdict; reason: string }> = new Map();
  // 投票结果缓存
  private voteResults: Map<string, { stance: VoteStance; reason: string; weight: number }> = new Map();
  // 改动记录缓存
  private changes: ChangeRecord[] = [];

  constructor(
    apiConfig: { baseUrl: string; apiKey: string; model: string },
    callbacks: ReviewCallbacks,
  ) {
    this.apiConfig = apiConfig;
    this.callbacks = callbacks;
  }

  // ============== 初始化 ==============

  /**
   * 初始化审查会话
   */
  async init(
    chapterIndex: number,
    paragraphIndex: number,
    originalText: string,
    novelType: string,
    outline: string,
    writtenContent: string,
  ): Promise<string> {
    // 获取梗库
    const classic = CLASSIC_SLANG;
    let freshSlang = '';
    try {
      // API请求通过Metro proxy转发，使用相对路径
      const res = await fetch(`/api/v1/slang/fresh?type=${encodeURIComponent(novelType)}`);
      const data = await res.json();
      freshSlang = data.slang || '';
    } catch {
      // 搜不到就用经典梗
    }
    this.slangLib = classic + (freshSlang ? ' / ' + freshSlang : '');
    this.novelType = novelType;
    this.outline = outline;
    this.writtenContent = writtenContent;

    // 创建会话
    const sessionId = `session_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const focusReaders = getFocusReaders(novelType);

    this.session = {
      id: sessionId,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      status: 'active',
      currentStep: 'showdown',
      currentStepIndex: 0,
      chapterIndex,
      paragraphIndex,
      originalText,
      novelType,
      focusReaderIds: focusReaders.map(r => r.id),
      messageIds: [],
      changeRecordIds: [],
      slangSnapshot: this.slangLib.slice(0, 200),
    };

    await updateReviewSession(this.session!.id, this.session);
    this.stepMessages.clear();
    this.reviewVerdicts.clear();
    this.voteResults.clear();
    this.changes = [];

    return sessionId;
  }

  // ============== 从断点恢复 ==============

  async restore(sessionId: string): Promise<boolean> {
    const session = await getReviewSession(sessionId);
    if (!session) return false;

    this.session = session;
    this.novelType = session.novelType;
    this.slangLib = session.slangSnapshot;

    // 加载已有消息
    const allMessages = await getSessionMessages(sessionId);
    for (const msg of allMessages) {
      if (!this.stepMessages.has(msg.step)) {
        this.stepMessages.set(msg.step, []);
      }
      this.stepMessages.get(msg.step)!.push(msg);
    }

    // 加载改动记录
    const allChanges = await getSessionChanges(sessionId);
    this.changes = allChanges;

    return true;
  }

  // ============== 执行当前步骤 ==============

  async runCurrentStep(): Promise<void> {
    if (!this.session) throw new Error('Session not initialized');

    const step = this.session.currentStep;
    try {
      switch (step) {
        case 'showdown': await this.runShowdown(); break;
        case 'write': await this.runWrite(); break;
        case 'review': await this.runReview(); break;
        case 'respond': await this.runRespond(); break;
        case 'vote': await this.runVote(); break;
        case 'impact': await this.runImpact(); break;
        case 'outline_update': await this.runOutlineUpdate(); break;
        case 'consistency': await this.runConsistency(); break;
        case 'execute': await this.runExecute(); break;
        case 'verify': await this.runVerify(); break;
      }

      // 步骤完成后回调
      const msgs = this.stepMessages.get(step) || [];
      this.callbacks.onStepComplete(step, msgs);

      // 推进到下一步
      await this.advanceStep();
    } catch (error) {
      this.callbacks.onError(step, error instanceof Error ? error : new Error(String(error)));
    }
  }

  /** 推进到下一步 */
  private async advanceStep(): Promise<void> {
    if (!this.session) return;

    const nextStep = getNextStep(this.session.currentStep);
    if (!nextStep) {
      // 全部完成
      this.session.status = 'completed';
      this.session.updatedAt = Date.now();
      await updateReviewSession(this.session!.id, this.session);
      return;
    }

    this.session.currentStep = nextStep;
    this.session.currentStepIndex = getStepIndex(nextStep);
    this.session.updatedAt = Date.now();
    await updateReviewSession(this.session!.id, this.session);
  }

  // ============== 第1步：亮底牌 ==============

  private async runShowdown(): Promise<void> {
    if (!this.session) return;

    const { chapterIndex, paragraphIndex, originalText } = this.session;
    const focusReaders = getFocusReaders(this.novelType);
    const juryReaders = getJuryReaders(this.novelType);

    // 专业agent亮底牌
    const proPromises = PRESET_AGENTS.filter(a => a.enabled !== false).map(async (agent) => {
      const msgId = generateId();
      const systemPrompt = buildAgentSystemPrompt(agent.id, agent.name, agent.role, this.slangLib);
      const userPrompt = `【亮底牌】
当前：第${chapterIndex + 1}章${paragraphIndex >= 0 ? `第${paragraphIndex + 1}段` : '（整章）'}
原文：${originalText.slice(0, 500)}
细纲：${this.outline.slice(0, 1000)}

请提出你对这段文字的写作要求。明确说清楚你要什么，不要含糊。
如果你对这段没有特殊要求，就说"无特殊要求"。`;

      const message = this.createMessage(msgId, 'showdown', agent.id, agent.name, 'pro', 'streaming');
      this.addMessage(message);

      try {
        const content = await callLLM(
          this.apiConfig,
          { agentId: agent.id, agentName: agent.name, agentType: 'pro' },
          systemPrompt,
          userPrompt,
          (chunk) => this.callbacks.onMessageChunk(msgId, chunk),
          512,
        );
        message.content = content;
        message.status = 'done';
        message.timestamp = Date.now();
      } catch (error) {
        message.content = `亮底牌失败：${error instanceof Error ? error.message : String(error)}`;
        message.status = 'error';
      }

      await addReviewMessage(message);
      this.updateMessage(message);
    });

    // 重点读者亮期待
    const readerPromises = focusReaders.map(async (reader) => {
      const msgId = generateId();
      const systemPrompt = buildReaderSystemPrompt(reader, this.slangLib);
      const userPrompt = `【亮底牌】
当前：第${chapterIndex + 1}章${paragraphIndex >= 0 ? `第${paragraphIndex + 1}段` : '（整章）'}
原文：${originalText.slice(0, 500)}

你作为读者，对这段文字有什么期待？你最想看到什么？
用读者口吻说，别用分析腔调。`;

      const message = this.createMessage(msgId, 'showdown', `reader_${reader.id}`, reader.name, 'reader', 'streaming');
      this.addMessage(message);

      try {
        const content = await callLLM(
          this.apiConfig,
          { agentId: `reader_${reader.id}`, agentName: reader.name, agentType: 'reader' },
          systemPrompt,
          userPrompt,
          (chunk) => this.callbacks.onMessageChunk(msgId, chunk),
          256,
        );
        message.content = content;
        message.status = 'done';
        message.timestamp = Date.now();
      } catch (error) {
        message.content = `发言失败：${error instanceof Error ? error.message : String(error)}`;
        message.status = 'error';
      }

      await addReviewMessage(message);
      this.updateMessage(message);
    });

    // 并行执行所有亮底牌
    await Promise.all([...proPromises, ...readerPromises]);
  }

  // ============== 第2步：写手执笔 ==============

  private async runWrite(): Promise<void> {
    if (!this.session) return;

    // 收集亮底牌的所有要求
    const showdownMsgs = this.stepMessages.get('showdown') || [];
    const requirements = showdownMsgs
      .filter(m => m.status === 'done')
      .map(m => `${m.agentName}：${m.content}`)
      .join('\n');

    const writer = PRESET_AGENTS.find(a => a.id === 'writer');
    if (!writer) throw new Error('Writer agent not found');

    const msgId = generateId();
    const systemPrompt = buildAgentSystemPrompt('writer', '写手', writer.role, this.slangLib);
    const userPrompt = `【写手执笔】
各方的写作要求如下：
${requirements}

请根据以上要求，写出以下段落的正文：
第${this.session.chapterIndex + 1}章${this.session.paragraphIndex >= 0 ? `第${this.session.paragraphIndex + 1}段` : '（整章）'}

原始文本（供参考修改）：
${this.session.originalText}

细纲参考：
${this.outline.slice(0, 1000)}

如果各要求有冲突，优先满足读者体验和剧情逻辑。
直接输出正文，不要加额外说明。`;

    const message = this.createMessage(msgId, 'write', 'writer', '写手', 'pro', 'streaming');
    this.addMessage(message);

    try {
      const content = await callLLM(
        this.apiConfig,
        { agentId: 'writer', agentName: '写手', agentType: 'pro' },
        systemPrompt,
        userPrompt,
        (chunk) => this.callbacks.onMessageChunk(msgId, chunk),
        2048,
      );
      message.content = content;
      message.status = 'done';
      this.session!.revisedText = content;
    } catch (error) {
      message.content = `写作失败：${error instanceof Error ? error.message : String(error)}`;
      message.status = 'error';
    }

    message.timestamp = Date.now();
    await addReviewMessage(message);
    this.updateMessage(message);
    await updateReviewSession(this.session!.id, { currentStep: this.session!.currentStep, currentStepIndex: this.session!.currentStepIndex });
  }

  // ============== 第3步：追责 ==============

  private async runReview(): Promise<void> {
    if (!this.session) return;

    const { originalText, revisedText } = this.session;
    if (!revisedText) throw new Error('No revised text to review');

    // 收集亮底牌的要求（作为对照基准）
    const showdownMsgs = this.stepMessages.get('showdown') || [];
    const requirements = showdownMsgs
      .filter(m => m.status === 'done')
      .map(m => `${m.agentName}的要求：${m.content}`)
      .join('\n');

    const focusReaders = getFocusReaders(this.novelType);

    // 所有agent并行追责
    const allAgents = [
      ...PRESET_AGENTS.filter(a => a.enabled !== false).map(a => ({
        id: a.id,
        name: a.name,
        role: a.role,
        type: 'pro' as AgentType,
      })),
      ...focusReaders.map(r => ({
        id: `reader_${r.id}`,
        name: r.name,
        role: r.speakStyle,
        type: 'reader' as AgentType,
      })),
    ];

    const reviewPromises = allAgents.map(async (agent) => {
      const msgId = generateId();
      const isReader = agent.type === 'reader';
      const reader = isReader ? DEFAULT_READERS.find(r => `reader_${r.id}` === agent.id) : null;

      const systemPrompt = isReader && reader
        ? buildReaderSystemPrompt(reader, this.slangLib)
        : buildAgentSystemPrompt(agent.id, agent.name, agent.role, this.slangLib);

      const userPrompt = isReader
        ? `【追责】
原文：${originalText.slice(0, 500)}
改写后：${revisedText.slice(0, 500)}

你看着爽不爽？用读者口吻直接说。
判定标准：
[PASS] 过关（看得下去）
[WARN] 建议优化（看得下去但不够爽）
[FAIL] 必须改（看不下去）
[KILL] 必须删（赶读者的内容）

请先给出判定符号，再说理由。`
        : `【追责】
各方亮底牌的要求：
${requirements}

原文：${originalText.slice(0, 300)}
改写后：${revisedText.slice(0, 500)}

请对照你的要求，检查写手有没有做到。
判定标准：
[PASS] 过关（做到了）
[WARN] 建议优化（做到了但不够好）
[FAIL] 必须改（没做到）
[KILL] 严重偏离（必须删）

请先给出判定符号，再说理由。只追责你职责范围内的事。`;

      const message = this.createMessage(msgId, 'review', agent.id, agent.name, agent.type, 'streaming');
      this.addMessage(message);

      try {
        const content = await callLLM(
          this.apiConfig,
          { agentId: agent.id, agentName: agent.name, agentType: agent.type },
          systemPrompt,
          userPrompt,
          (chunk) => this.callbacks.onMessageChunk(msgId, chunk),
          512,
        );
        message.content = content;
        message.status = 'done';

        // 解析判定
        const verdict = this.parseVerdict(content);
        message.verdict = verdict.verdict;
        message.verdictReason = verdict.reason;

        // 缓存追责结果
        this.reviewVerdicts.set(agent.id, verdict);
      } catch (error) {
        message.content = `追责失败：${error instanceof Error ? error.message : String(error)}`;
        message.status = 'error';
        message.verdict = 'pass';
      }

      message.timestamp = Date.now();
      await addReviewMessage(message);
      this.updateMessage(message);
    });

    await Promise.all(reviewPromises);
  }

  /** 解析追责判定 */
  private parseVerdict(content: string): { verdict: ReviewVerdict; reason: string } {
    // 按优先级匹配判定符号
    if (content.includes('[KILL]') || content.includes('严重偏离')) {
      return { verdict: 'critical', reason: content.slice(0, 200) };
    }
    if (content.includes('[FAIL]') || content.includes('必须改')) {
      return { verdict: 'fail', reason: content.slice(0, 200) };
    }
    if (content.includes('[WARN]') || content.includes('建议优化')) {
      return { verdict: 'suggest', reason: content.slice(0, 200) };
    }
    return { verdict: 'pass', reason: content.slice(0, 200) };
  }

  // ============== 第4步：写手回应 ==============

  private async runRespond(): Promise<void> {
    if (!this.session) return;

    // 只回应 fail 和 critical 的追责
    const reviewMsgs = this.stepMessages.get('review') || [];
    const issues = reviewMsgs.filter(m => m.verdict === 'fail' || m.verdict === 'critical');

    if (issues.length === 0) {
      // 没有需要回应的，跳过到投票
      const skipMsg = this.createMessage(
        generateId(), 'respond', 'system', '系统', 'coordinator', 'done',
      );
      skipMsg.content = '没有需要回应的异议，跳过此步';
      this.addMessage(skipMsg);
      await addReviewMessage(skipMsg);
      return;
    }

    const issuesText = issues.map(m => `${m.agentName}（${m.verdict === 'critical' ? '严重偏离' : '必须改'}）：${m.verdictReason || m.content}`).join('\n');

    const writer = PRESET_AGENTS.find(a => a.id === 'writer');
    if (!writer) throw new Error('Writer agent not found');

    const msgId = generateId();
    const systemPrompt = buildAgentSystemPrompt('writer', '写手', writer.role, this.slangLib);
    const userPrompt = `【写手回应异议】
以下是对你写的内容的异议：
${issuesText}

请逐条回应：
- 认的：说"认，改"并说明怎么改
- 不认的：给出反驳理由，可以引用细纲/大纲原文
- 不确定：给出替代方案

你的原文：
${(this.session.revisedText || '').slice(0, 500)}

细纲参考：
${this.outline.slice(0, 500)}`;

    const message = this.createMessage(msgId, 'respond', 'writer', '写手', 'pro', 'streaming');
    this.addMessage(message);

    try {
      const content = await callLLM(
        this.apiConfig,
        { agentId: 'writer', agentName: '写手', agentType: 'pro' },
        systemPrompt,
        userPrompt,
        (chunk) => this.callbacks.onMessageChunk(msgId, chunk),
        1024,
      );
      message.content = content;
      message.status = 'done';
    } catch (error) {
      message.content = `回应失败：${error instanceof Error ? error.message : String(error)}`;
      message.status = 'error';
    }

    message.timestamp = Date.now();
    await addReviewMessage(message);
    this.updateMessage(message);
  }

  // ============== 第5步：投票 ==============

  private async runVote(): Promise<void> {
    if (!this.session) return;

    // 收集写手回应中反驳的议题
    const reviewMsgs = this.stepMessages.get('review') || [];
    const respondMsgs = this.stepMessages.get('respond') || [];
    const issues = reviewMsgs.filter(m => m.verdict === 'fail' || m.verdict === 'critical');

    if (issues.length === 0) {
      const skipMsg = this.createMessage(
        generateId(), 'vote', 'system', '系统', 'coordinator', 'done',
      );
      skipMsg.content = '没有争议议题，跳过投票';
      this.addMessage(skipMsg);
      await addReviewMessage(skipMsg);
      return;
    }

    // 构建议题摘要
    const issuesSummary = issues.map(m => `${m.agentName}：${m.verdictReason || m.content}`).join('\n');
    const writerResponse = respondMsgs.find(m => m.agentId === 'writer')?.content || '（写手未回应）';

    // 统筹先发起投票
    const coordinatorId = generateId();
    const coordinatorMsg = this.createMessage(coordinatorId, 'vote', 'coordinator', '统筹', 'coordinator', 'done');
    coordinatorMsg.content = `投票开始！\n议题：\n${issuesSummary}\n\n写手回应：${writerResponse.slice(0, 300)}\n\n请各位投票：keep（保持写手方案）或 change（按追责方改）`;
    this.addMessage(coordinatorMsg);
    await addReviewMessage(coordinatorMsg);

    // 所有agent+读者并行投票
    const focusReaders = getFocusReaders(this.novelType);
    const juryReaders = getJuryReaders(this.novelType);
    const allVoters = [
      ...PRESET_AGENTS.filter(a => a.enabled !== false && a.id !== 'writer' && a.id !== 'coordinator'),
      ...focusReaders,
      ...juryReaders,
    ];

    const votePromises = allVoters.map(async (voter) => {
      const isReader = 'thrillPoints' in voter;
      const voterId = isReader ? `reader_${(voter as ReaderProfile).id}` : (voter as { id: string }).id;
      const voterName = isReader ? (voter as ReaderProfile).name : (voter as { name: string }).name;
      const voterWeight = isReader ? (voter as ReaderProfile).weight : 1;

      const msgId = generateId();
      const systemPrompt = isReader
        ? buildReaderSystemPrompt(voter as ReaderProfile, this.slangLib)
        : buildAgentSystemPrompt(voterId, voterName, (voter as { role: string }).role, this.slangLib);

      const userPrompt = `【投票】
议题：
${issuesSummary}

写手回应：
${writerResponse.slice(0, 500)}

请投票并简短说明理由（一句话）：
- keep：保持写手的方案
- change：按追责方改

格式：你的投票（keep/change）+ 一句话理由`;

      const message = this.createMessage(msgId, 'vote', voterId, voterName, isReader ? 'reader' : 'pro', 'streaming');
      this.addMessage(message);

      try {
        const content = await callLLM(
          this.apiConfig,
          { agentId: voterId, agentName: voterName, agentType: isReader ? 'reader' : 'pro' },
          systemPrompt,
          userPrompt,
          (chunk) => this.callbacks.onMessageChunk(msgId, chunk),
          128,
        );
        message.content = content;
        message.status = 'done';

        // 解析投票
        const vote = this.parseVote(content, voterWeight);
        message.voteStance = vote.stance;
        message.voteReason = vote.reason;
        message.voteWeight = voterWeight;

        this.voteResults.set(voterId, vote);
      } catch (error) {
        message.content = `投票失败：${error instanceof Error ? error.message : String(error)}`;
        message.status = 'error';
        message.voteStance = 'keep';
        message.voteWeight = voterWeight;
      }

      message.timestamp = Date.now();
      await addReviewMessage(message);
      this.updateMessage(message);
    });

    await Promise.all(votePromises);

    // 统筹宣布结果
    const result = this.tallyVotes();
    const resultId = generateId();
    const resultMsg = this.createMessage(resultId, 'vote', 'coordinator', '统筹', 'coordinator', 'done');
    resultMsg.content = `投票结果：keep ${result.keepVotes}票 vs change ${result.changeVotes}票（含加权）\n${result.winner === 'change' ? '按追责方改' : '保持写手方案'}${result.isClose ? '（票数接近，我决定折中处理）' : ''}`;
    this.addMessage(resultMsg);
    await addReviewMessage(resultMsg);
  }

  /** 解析投票 */
  private parseVote(content: string, weight: number): { stance: VoteStance; reason: string; weight: number } {
    const lower = content.toLowerCase();
    if (lower.includes('change') || lower.includes('改') || content.includes('[FAIL]')) {
      return { stance: 'change', reason: content.slice(0, 100), weight };
    }
    return { stance: 'keep', reason: content.slice(0, 100), weight };
  }

  /** 统计投票 */
  private tallyVotes(): { keepVotes: number; changeVotes: number; winner: VoteStance; isClose: boolean } {
    let keepVotes = 0;
    let changeVotes = 0;

    for (const vote of this.voteResults.values()) {
      if (vote.stance === 'keep') keepVotes += vote.weight;
      else changeVotes += vote.weight;
    }

    const winner = changeVotes > keepVotes ? 'change' : 'keep';
    const isClose = Math.abs(keepVotes - changeVotes) <= 2;

    return { keepVotes, changeVotes, winner, isClose };
  }

  // ============== 第6步：影响评估 ==============

  private async runImpact(): Promise<void> {
    if (!this.session) return;

    const voteResult = this.tallyVotes();
    if (voteResult.winner === 'keep') {
      // 不需要改，跳过后续步骤
      const skipMsg = this.createMessage(
        generateId(), 'impact', 'coordinator', '统筹', 'coordinator', 'done',
      );
      skipMsg.content = '投票决定保持原方案，无需修改，跳过影响评估';
      this.addMessage(skipMsg);
      await addReviewMessage(skipMsg);
      return;
    }

    // 统筹评估影响
    const reviewMsgs = this.stepMessages.get('review') || [];
    const issues = reviewMsgs.filter(m => m.verdict === 'fail' || m.verdict === 'critical');
    const issuesText = issues.map(m => `${m.agentName}：${m.verdictReason || m.content}`).join('\n');

    const coordinator = PRESET_AGENTS.find(a => a.id === 'coordinator');
    const systemPrompt = buildAgentSystemPrompt('coordinator', '统筹', coordinator?.role || '协调各agent', this.slangLib);

    const userPrompt = `【影响评估】
以下追责项需要修改：
${issuesText}

当前细纲：
${this.outline.slice(0, 1500)}

请评估每个修改的影响范围：
1. 局部改动（只影响当前段落，后续不受影响）→ 标记 local
2. 章节级改动（影响当前章其他段落或下一章）→ 标记 chapter
3. 全局改动（影响后续多章走向）→ 标记 global

对每个修改，给出：
- 改动描述
- 影响级别（local/chapter/global）
- 受影响的章节号（如果是chapter/global）`;

    const msgId = generateId();
    const message = this.createMessage(msgId, 'impact', 'coordinator', '统筹', 'coordinator', 'streaming');
    this.addMessage(message);

    try {
      const content = await callLLM(
        this.apiConfig,
        { agentId: 'coordinator', agentName: '统筹', agentType: 'coordinator' },
        systemPrompt,
        userPrompt,
        (chunk) => this.callbacks.onMessageChunk(msgId, chunk),
        512,
      );
      message.content = content;
      message.status = 'done';

      // 解析影响级别，创建改动记录
      this.createChangeRecords(content);
    } catch (error) {
      message.content = `评估失败：${error instanceof Error ? error.message : String(error)}`;
      message.status = 'error';
    }

    message.timestamp = Date.now();
    await addReviewMessage(message);
    this.updateMessage(message);
  }

  /** 根据影响评估创建改动记录 */
  private async createChangeRecords(impactContent: string): Promise<void> {
    if (!this.session) return;

    // 简单解析：检测影响级别关键字
    const lines = impactContent.split('\n');
    let currentDesc = '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      // 检测影响级别
      const isGlobal = /global|全局/.test(trimmed);
      const isChapter = /chapter|章节级/.test(trimmed);
      const isLocal = /local|局部/.test(trimmed);

      if (isGlobal || isChapter || isLocal) {
        const changeType: ChangeType = isGlobal ? 'plot' : (isChapter ? 'plot' : 'local');
        const change: ChangeRecord = {
          id: generateId(),
          sessionId: this.session.id,
          chapterIndex: this.session.chapterIndex,
          paragraphIndex: this.session.paragraphIndex,
          changeType,
          status: 'pending',
          description: currentDesc || trimmed,
          originalContent: this.session.originalText.slice(0, 500),
          affectedChapters: isGlobal || isChapter ? [this.session.chapterIndex + 1] : undefined,
          createdAt: Date.now(),
        };

        this.changes.push(change);
        await addChangeRecord(change);
        currentDesc = '';
      } else {
        currentDesc += (currentDesc ? ' ' : '') + trimmed;
      }
    }

    // 如果没有解析到任何改动记录，创建一个默认的
    if (this.changes.length === 0) {
      const change: ChangeRecord = {
        id: generateId(),
        sessionId: this.session.id,
        chapterIndex: this.session.chapterIndex,
        paragraphIndex: this.session.paragraphIndex,
        changeType: 'local',
        status: 'pending',
        description: '追责修改',
        originalContent: this.session.originalText.slice(0, 500),
        createdAt: Date.now(),
      };
      this.changes.push(change);
      await addChangeRecord(change);
    }
  }

  // ============== 第7步：细纲修订 ==============

  private async runOutlineUpdate(): Promise<void> {
    if (!this.session) return;

    const plotChanges = this.changes.filter(c => c.changeType === 'plot');
    if (plotChanges.length === 0) {
      const skipMsg = this.createMessage(
        generateId(), 'outline_update', 'coordinator', '统筹', 'coordinator', 'done',
      );
      skipMsg.content = '无剧情级改动，跳过细纲修订';
      this.addMessage(skipMsg);
      await addReviewMessage(skipMsg);
      return;
    }

    // 检查是否需要用户确认（全局级改动）
    const globalChanges = plotChanges.filter(c => {
      const affected = c.affectedChapters || [];
      return affected.length > 1 || affected.some(ch => ch > this.session!.chapterIndex + 1);
    });

    if (globalChanges.length > 0) {
      // 需要用户确认
      const outlinePatch = this.buildOutlinePatch(plotChanges);
      const approved = await this.callbacks.onNeedConfirm(globalChanges[0], outlinePatch);

      if (!approved) {
        // 用户驳回，把全局改动降级为局部
        for (const c of globalChanges) {
          c.changeType = 'local';
          c.affectedChapters = undefined;
          c.status = 'pending';
          await updateChangeStatus(c.id, 'pending');
        }
        const rejectMsg = this.createMessage(
          generateId(), 'outline_update', 'coordinator', '统筹', 'coordinator', 'done',
        );
        rejectMsg.content = '作者驳回全局改动，降级为局部修改';
        this.addMessage(rejectMsg);
        await addReviewMessage(rejectMsg);
        return;
      }
    }

    // 细纲agent生成修订方案
    const outlineAgent = PRESET_AGENTS.find(a => a.id === 'detail_designer');
    const msgId = generateId();
    const systemPrompt = buildAgentSystemPrompt('detail_designer', '细纲', outlineAgent?.role || '管理细纲走向', this.slangLib);

    const changesDesc = plotChanges.map(c => c.description).join('\n');
    const userPrompt = `【细纲修订】
以下改动影响了后续剧情走向：
${changesDesc}

当前细纲：
${this.outline.slice(0, 2000)}

请生成细纲修订方案，说明：
1. 哪些章节需要改
2. 原细纲内容 vs 修订后内容
3. 哪些章节不受影响

格式：
第X章：原文→修订（或"无变化"）`;

    const message = this.createMessage(msgId, 'outline_update', 'detail_designer', '细纲', 'pro', 'streaming');
    this.addMessage(message);

    try {
      const content = await callLLM(
        this.apiConfig,
        { agentId: 'detail_designer', agentName: '细纲', agentType: 'pro' },
        systemPrompt,
        userPrompt,
        (chunk) => this.callbacks.onMessageChunk(msgId, chunk),
        1024,
      );
      message.content = content;
      message.status = 'done';

      // 写入细纲修订
      const patch = this.buildOutlinePatch(plotChanges);
      patch.patches = this.parseOutlinePatches(content);
      await this.applyOutlinePatch(patch);
    } catch (error) {
      message.content = `细纲修订失败：${error instanceof Error ? error.message : String(error)}`;
      message.status = 'error';
    }

    message.timestamp = Date.now();
    await addReviewMessage(message);
    this.updateMessage(message);
  }

  /** 构建细纲补丁 */
  private buildOutlinePatch(plotChanges: ChangeRecord[]): OutlinePatch {
    return {
      id: generatePatchId(),
      version: 'v1.x', // 将在apply时递增
      parentVersion: 'v1.0',
      sourceSessionId: this.session?.id || '',
      sourceChangeId: plotChanges[0]?.id || '',
      reason: plotChanges.map(c => c.description).join('; '),
      patches: [],
      createdAt: Date.now(),
    };
  }

  /** 从细纲agent输出中解析章节补丁 */
  private parseOutlinePatches(content: string): OutlineChapterPatch[] {
    const patches: OutlineChapterPatch[] = [];
    const lines = content.split('\n');
    let currentChapter = -1;

    for (const line of lines) {
      const chapterMatch = line.match(/第(\d+)章/);
      if (chapterMatch) {
        currentChapter = parseInt(chapterMatch[1], 10) - 1; // 0-indexed
        continue;
      }

      if (currentChapter >= 0 && line.includes('→')) {
        const [original, revised] = line.split('→').map(s => s.trim());
        if (original && revised && revised !== '无变化') {
          patches.push({
            chapterIndex: currentChapter,
            originalOutline: original,
            revisedOutline: revised,
            changed: true,
          });
        }
      }
    }

    return patches;
  }

  /** 应用细纲补丁 */
  private async applyOutlinePatch(patch: OutlinePatch): Promise<void> {
    // 加载当前版本信息
    const versionInfo = await this.getOutlineVersionInfo();

    // 递增版本号
    const lastVersion = versionInfo.currentVersion;
    const parts = lastVersion.replace('v', '').split('.');
    const minor = parseInt(parts[1] || '0', 10) + 1;
    const newVersion = `v1.${minor}`;

    // 通过存储函数添加补丁（内部会更新versionInfo和关联改动记录）
    await addOutlinePatch({
      version: newVersion,
      parentVersion: lastVersion,
      sourceSessionId: patch.sourceSessionId || this.session?.id || '',
      sourceChangeId: patch.sourceChangeId,
      reason: patch.reason || '',
      patches: patch.patches,
    });

    // 更新改动记录的关联
    for (const c of this.changes) {
      if (c.changeType === 'plot') {
        c.outlinePatchId = patch.id;
      }
    }
  }

  /** 获取细纲版本信息 */
  private async getOutlineVersionInfo(): Promise<OutlineVersionInfo> {
    return getOutlineVersionInfo();
  }

  // ============== 第8步：一致性检查 ==============

  private async runConsistency(): Promise<void> {
    if (!this.session) return;

    const plotChanges = this.changes.filter(c => c.changeType === 'plot');
    if (plotChanges.length === 0) {
      const skipMsg = this.createMessage(
        generateId(), 'consistency', 'coordinator', '统筹', 'coordinator', 'done',
      );
      skipMsg.content = '无剧情级改动，跳过一致性检查';
      this.addMessage(skipMsg);
      await addReviewMessage(skipMsg);
      return;
    }

    // 记忆agent检查一致性
    const memoryAgent = PRESET_AGENTS.find(a => a.id === 'memory_compressor');
    const msgId = generateId();
    const systemPrompt = buildAgentSystemPrompt('memory_compressor', '记忆', memoryAgent?.role || '管理伏笔和角色状态', this.slangLib);

    const changesDesc = plotChanges.map(c => c.description).join('\n');
    const userPrompt = `【一致性检查】
以下剧情改动已确认：
${changesDesc}

已写内容（最近部分）：
${this.writtenContent.slice(-1000)}

新细纲修订：
${this.stepMessages.get('outline_update')?.find(m => m.agentId === 'detail_designer')?.content || '（无修订）'}

请检查：
1. 改动和已写内容有没有矛盾？
2. 有没有断掉的伏笔？
3. 角色行为是否一致？

如果一切OK就说"一致性通过"。
如果有矛盾，列出具体问题并建议修补方式。`;

    const message = this.createMessage(msgId, 'consistency', 'memory_compressor', '记忆', 'pro', 'streaming');
    this.addMessage(message);

    try {
      const content = await callLLM(
        this.apiConfig,
        { agentId: 'memory_compressor', agentName: '记忆', agentType: 'pro' },
        systemPrompt,
        userPrompt,
        (chunk) => this.callbacks.onMessageChunk(msgId, chunk),
        512,
      );
      message.content = content;
      message.status = 'done';

      // 如果不一致，添加改动记录
      if (!content.includes('一致性通过')) {
        const consistencyChange: ChangeRecord = {
          id: generateId(),
          sessionId: this.session.id,
          chapterIndex: this.session.chapterIndex,
          paragraphIndex: this.session.paragraphIndex,
          changeType: 'local',
          status: 'pending',
          description: `一致性修补：${content.slice(0, 200)}`,
          originalContent: '',
          createdAt: Date.now(),
        };
        this.changes.push(consistencyChange);
        await addChangeRecord(consistencyChange);
      }
    } catch (error) {
      message.content = `一致性检查失败：${error instanceof Error ? error.message : String(error)}`;
      message.status = 'error';
    }

    message.timestamp = Date.now();
    await addReviewMessage(message);
    this.updateMessage(message);
  }

  // ============== 第9步：执行修改 ==============

  private async runExecute(): Promise<void> {
    if (!this.session) return;

    const voteResult = this.tallyVotes();
    if (voteResult.winner === 'keep') {
      const skipMsg = this.createMessage(
        generateId(), 'execute', 'coordinator', '统筹', 'coordinator', 'done',
      );
      skipMsg.content = '投票决定保持原方案，无需执行修改';
      this.addMessage(skipMsg);
      await addReviewMessage(skipMsg);
      return;
    }

    // 收集所有需要的修改
    const reviewMsgs = this.stepMessages.get('review') || [];
    const respondMsgs = this.stepMessages.get('respond') || [];
    const consistencyMsgs = this.stepMessages.get('consistency') || [];
    const issues = reviewMsgs.filter(m => m.verdict === 'fail' || m.verdict === 'critical');
    const writerResponse = respondMsgs.find(m => m.agentId === 'writer')?.content || '';
    const consistencyNote = consistencyMsgs.find(m => m.agentId === 'memory_compressor')?.content || '';

    const writer = PRESET_AGENTS.find(a => a.id === 'writer');
    const msgId = generateId();
    const systemPrompt = buildAgentSystemPrompt('writer', '写手', writer?.role || '产出正文', this.slangLib);

    const userPrompt = `【执行修改】
根据投票结果，以下修改需要执行：

追责项：
${issues.map(m => `${m.agentName}：${m.verdictReason || m.content}`).join('\n')}

写手回应（你之前的表态）：
${writerResponse.slice(0, 500)}

一致性检查备注：
${consistencyNote.slice(0, 300)}

原始文本：
${this.session.originalText}

请修改以上文本，直接输出修改后的完整内容。`;

    const message = this.createMessage(msgId, 'execute', 'writer', '写手', 'pro', 'streaming');
    this.addMessage(message);

    try {
      const content = await callLLM(
        this.apiConfig,
        { agentId: 'writer', agentName: '写手', agentType: 'pro' },
        systemPrompt,
        userPrompt,
        (chunk) => this.callbacks.onMessageChunk(msgId, chunk),
        2048,
      );
      message.content = content;
      message.status = 'done';
      this.session.revisedText = content;

      // 更新所有改动记录为已应用
      for (const c of this.changes) {
        c.status = 'applied';
        c.revisedContent = content.slice(0, 500);
        await updateChangeStatus(c.id, 'applied');
      }
    } catch (error) {
      message.content = `执行失败：${error instanceof Error ? error.message : String(error)}`;
      message.status = 'error';
    }

    message.timestamp = Date.now();
    await addReviewMessage(message);
    this.updateMessage(message);
    await updateReviewSession(this.session!.id, this.session);
  }

  // ============== 第10步：复核 ==============

  private async runVerify(): Promise<void> {
    if (!this.session) return;

    const voteResult = this.tallyVotes();
    if (voteResult.winner === 'keep') {
      const skipMsg = this.createMessage(
        generateId(), 'verify', 'coordinator', '统筹', 'coordinator', 'done',
      );
      skipMsg.content = '审查完成，原方案保持不变';
      this.addMessage(skipMsg);
      await addReviewMessage(skipMsg);
      return;
    }

    // 追责方 + 记忆agent复核
    const reviewMsgs = this.stepMessages.get('review') || [];
    const critics = reviewMsgs.filter(m => m.verdict === 'fail' || m.verdict === 'critical');
    const executeMsgs = this.stepMessages.get('execute') || [];
    const executedText = executeMsgs.find(m => m.agentId === 'writer')?.content || this.session.revisedText || '';

    const verifyPromises = critics.map(async (critic) => {
      const msgId = generateId();
      const systemPrompt = critic.agentType === 'reader'
        ? buildReaderSystemPrompt(DEFAULT_READERS.find(r => `reader_${r.id}` === critic.agentId) || DEFAULT_READERS[0], this.slangLib)
        : buildAgentSystemPrompt(critic.agentId, critic.agentName, PRESET_AGENTS.find(a => a.id === critic.agentId)?.role || '', this.slangLib);

      const userPrompt = `【复核】
你之前追责的问题：${critic.verdictReason || critic.content}
修改后的文本：
${executedText.slice(0, 800)}

你提的问题改了没？回答：
[PASS] 改了
[FAIL] 没改`;

      const message = this.createMessage(msgId, 'verify', critic.agentId, critic.agentName, critic.agentType, 'streaming');
      this.addMessage(message);

      try {
        const content = await callLLM(
          this.apiConfig,
          { agentId: critic.agentId, agentName: critic.agentName, agentType: critic.agentType },
          systemPrompt,
          userPrompt,
          (chunk) => this.callbacks.onMessageChunk(msgId, chunk),
          64,
        );
        message.content = content;
        message.status = 'done';

        // 记录复核结果
        for (const c of this.changes) {
          if (!c.verifiedBy) {
            c.verifiedBy = critic.agentId;
            c.verifiedAt = Date.now();
          }
        }
      } catch (error) {
        message.content = `复核失败：${error instanceof Error ? error.message : String(error)}`;
        message.status = 'error';
      }

      message.timestamp = Date.now();
      await addReviewMessage(message);
      this.updateMessage(message);
    });

    // 统筹最终总结
    const summaryPromise = async () => {
      const msgId = generateId();
      const message = this.createMessage(msgId, 'verify', 'coordinator', '统筹', 'coordinator', 'streaming');
      this.addMessage(message);

      // 等所有复核完成
      const verifyResults = this.stepMessages.get('verify')?.filter(m => m.agentId !== 'coordinator') || [];
      const passed = verifyResults.filter(m => m.content.includes('[PASS]')).length;
      const failed = verifyResults.filter(m => m.content.includes('[FAIL]')).length;

      message.content = `审查完成！\n复核结果：${passed}项通过，${failed}项未通过\n修改后文本已更新${this.changes.some(c => c.changeType === 'plot') ? '，细纲已更新' : ''}`;
      message.status = 'done';
      message.timestamp = Date.now();
      await addReviewMessage(message);
      this.updateMessage(message);
    };

    await Promise.all([...verifyPromises, summaryPromise()]);
  }

  // ============== 工具方法 ==============

  /** 创建消息 */
  private createMessage(
    id: string,
    step: ReviewStep,
    agentId: string,
    agentName: string,
    agentType: AgentType,
    status: MessageStatus,
  ): ReviewMessage {
    return {
      id,
      sessionId: this.session?.id || '',
      step,
      stepIndex: getStepIndex(step),
      agentId,
      agentName,
      agentType,
      content: '',
      status,
      timestamp: Date.now(),
    };
  }

  /** 添加消息到缓存 */
  private addMessage(message: ReviewMessage): void {
    if (!this.stepMessages.has(message.step)) {
      this.stepMessages.set(message.step, []);
    }
    this.stepMessages.get(message.step)!.push(message);
  }

  /** 更新消息（保存后调用） */
  private updateMessage(message: ReviewMessage): void {
    const msgs = this.stepMessages.get(message.step);
    if (msgs) {
      const idx = msgs.findIndex(m => m.id === message.id);
      if (idx >= 0) msgs[idx] = message;
    }
  }

  /** 获取修改后的文本 */
  getRevisedText(): string {
    return this.session?.revisedText || '';
  }

  /** 获取当前步骤 */
  getCurrentStep(): ReviewStep | null {
    return this.session?.currentStep || null;
  }

  /** 获取所有改动记录 */
  getChanges(): ChangeRecord[] {
    return this.changes;
  }

  /** 获取细纲最新版本号 */
  async getCurrentOutlineVersion(): Promise<string> {
    const info = await this.getOutlineVersionInfo();
    return info.currentVersion;
  }
}

// ============== 保护机制：写下一章前检查 ==============

/**
 * 检查是否有未应用的剧情改动
 * 写下一章前必须调用此函数
 */
export async function checkUnappliedPlotChanges(): Promise<ChangeRecord[]> {
  // 遍历所有改动记录，找pending的剧情改动
  try {
    const sessionList = await getSessionList();
    const pendingChanges: ChangeRecord[] = [];

    for (const session of sessionList) {
      const changes = await getSessionChanges(session.id);
      pendingChanges.push(...changes.filter(c => c.changeType === 'plot' && c.status === 'pending'));
    }

    return pendingChanges;
  } catch {
    return [];
  }
}

/**
 * 获取最新细纲文本（应用所有补丁后）
 */
export async function getLatestOutline(baseOutline: string): Promise<string> {
  try {
    const versionInfo = await getOutlineVersionInfo();
    if (!versionInfo) return baseOutline;
    let outline = baseOutline;

    // 按版本顺序应用补丁
    for (const patch of versionInfo.patches) {
      for (const chPatch of patch.patches) {
        if (chPatch.changed && chPatch.originalOutline) {
          outline = outline.replace(chPatch.originalOutline, chPatch.revisedOutline);
        }
      }
    }

    return outline;
  } catch {
    return baseOutline;
  }
}
