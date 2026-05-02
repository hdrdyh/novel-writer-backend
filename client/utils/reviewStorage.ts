/**
 * 追责制审查系统 - 数据存储层
 *
 * AsyncStorage key 设计：
 * - review_sessions: ReviewSession[]
 * - review_messages: ReviewMessage[]
 * - change_records: ChangeRecord[]
 * - outline_versions: OutlineVersionInfo
 * - reader_profiles: ReaderProfile[] (用户自定义时覆盖 DEFAULT_READERS)
 * - chapter_slang_cache: { chapterIndex, slang, timestamp }
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  ReviewSession,
  ReviewMessage,
  ChangeRecord,
  OutlineVersionInfo,
  OutlinePatch,
  ReaderProfile,
  DEFAULT_READERS,
  ChangeType,
  ChangeStatus,
  ReviewStep,
  REVIEW_STEP_ORDER,
  SessionStatus,
  AgentType,
  MessageStatus,
} from './reviewTypes';

// ============== Key 常量 ==============

const KEYS = {
  SESSIONS: 'review_sessions',
  MESSAGES: 'review_messages',
  CHANGES: 'change_records',
  OUTLINE: 'outline_versions',
  READERS: 'reader_profiles',
  SLANG_CACHE: 'chapter_slang_cache',
} as const;

// ============== 通用读写 ==============

async function safeRead<T>(key: string, fallback: T): Promise<T> {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

async function safeWrite<T>(key: string, data: T): Promise<void> {
  await AsyncStorage.setItem(key, JSON.stringify(data));
}

// ============== ID 生成 ==============

export function genId(prefix: string = ''): string {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 8);
  return prefix ? `${prefix}_${ts}_${rand}` : `${ts}_${rand}`;
}

// ============== 审查会话 ==============

/** 获取所有审查会话 */
export async function getReviewSessions(): Promise<ReviewSession[]> {
  return safeRead<ReviewSession[]>(KEYS.SESSIONS, []);
}

/** 获取单个审查会话 */
export async function getReviewSession(sessionId: string): Promise<ReviewSession | null> {
  const sessions = await getReviewSessions();
  return sessions.find(s => s.id === sessionId) || null;
}

/** 获取审查会话列表 */
export async function getSessionList(): Promise<ReviewSession[]> {
  const sessions = await safeRead<ReviewSession[]>(KEYS.SESSIONS, []);
  return sessions.sort((a, b) => b.updatedAt - a.updatedAt);
}

/** 创建审查会话 */
export async function createReviewSession(partial: Omit<ReviewSession, 'id' | 'createdAt' | 'updatedAt' | 'status' | 'currentStep' | 'currentStepIndex' | 'messageIds' | 'changeRecordIds'>): Promise<ReviewSession> {
  const session: ReviewSession = {
    ...partial,
    id: genId('rs'),
    createdAt: Date.now(),
    updatedAt: Date.now(),
    status: 'active',
    currentStep: 'showdown',
    currentStepIndex: 0,
    messageIds: [],
    changeRecordIds: [],
  };
  const sessions = await getReviewSessions();
  sessions.push(session);
  await safeWrite(KEYS.SESSIONS, sessions);
  return session;
}

/** 更新审查会话 */
export async function updateReviewSession(sessionId: string, updates: Partial<ReviewSession>): Promise<ReviewSession | null> {
  const sessions = await getReviewSessions();
  const idx = sessions.findIndex(s => s.id === sessionId);
  if (idx === -1) return null;
  sessions[idx] = { ...sessions[idx], ...updates, updatedAt: Date.now() };
  await safeWrite(KEYS.SESSIONS, sessions);
  return sessions[idx];
}

/** 推进审查会话到下一步 */
export async function advanceSessionStep(sessionId: string): Promise<ReviewSession | null> {
  const session = await getReviewSession(sessionId);
  if (!session) return null;
  const nextIndex = session.currentStepIndex + 1;
  if (nextIndex >= REVIEW_STEP_ORDER.length) {
    // 流程完成
    return updateReviewSession(sessionId, {
      status: 'completed',
      currentStepIndex: nextIndex - 1,
    });
  }
  return updateReviewSession(sessionId, {
    currentStep: REVIEW_STEP_ORDER[nextIndex],
    currentStepIndex: nextIndex,
  });
}

/** 暂停审查会话 */
export async function pauseSession(sessionId: string): Promise<ReviewSession | null> {
  return updateReviewSession(sessionId, { status: 'paused' });
}

/** 恢复审查会话 */
export async function resumeSession(sessionId: string): Promise<ReviewSession | null> {
  return updateReviewSession(sessionId, { status: 'active' });
}

/** 取消审查会话 */
export async function cancelSession(sessionId: string): Promise<ReviewSession | null> {
  return updateReviewSession(sessionId, { status: 'cancelled' });
}

// ============== 审查消息 ==============

/** 获取所有消息 */
export async function getReviewMessages(): Promise<ReviewMessage[]> {
  return safeRead<ReviewMessage[]>(KEYS.MESSAGES, []);
}

/** 获取某个会话的消息 */
export async function getSessionMessages(sessionId: string): Promise<ReviewMessage[]> {
  const all = await getReviewMessages();
  return all.filter(m => m.sessionId === sessionId).sort((a, b) => a.timestamp - b.timestamp);
}

/** 获取某个会话某一步的消息 */
export async function getStepMessages(sessionId: string, step: ReviewStep): Promise<ReviewMessage[]> {
  const all = await getSessionMessages(sessionId);
  return all.filter(m => m.step === step);
}

/** 添加消息（支持完整ReviewMessage，自动补齐id/timestamp） */
export async function addReviewMessage(msg: Partial<ReviewMessage> & { sessionId: string; step: ReviewStep; agentId: string; agentName: string; agentType: AgentType; content: string; status: MessageStatus }): Promise<ReviewMessage> {
  const message: ReviewMessage = {
    ...msg,
    id: msg.id || genId('rm'),
    timestamp: msg.timestamp || Date.now(),
    stepIndex: msg.stepIndex ?? REVIEW_STEP_ORDER.indexOf(msg.step),
  };
  const all = await getReviewMessages();
  all.push(message);
  await safeWrite(KEYS.MESSAGES, all);
  // 同时更新session的messageIds
  const session = await getReviewSession(msg.sessionId);
  if (session) {
    await updateReviewSession(msg.sessionId, {
      messageIds: [...session.messageIds, message.id],
    });
  }
  return message;
}

/** 更新消息内容（流式输出时用） */
export async function updateReviewMessage(messageId: string, updates: Partial<ReviewMessage>): Promise<ReviewMessage | null> {
  const all = await getReviewMessages();
  const idx = all.findIndex(m => m.id === messageId);
  if (idx === -1) return null;
  all[idx] = { ...all[idx], ...updates };
  await safeWrite(KEYS.MESSAGES, all);
  return all[idx];
}

// ============== 改动记录 ==============

/** 获取所有改动记录 */
export async function getChangeRecords(): Promise<ChangeRecord[]> {
  return safeRead<ChangeRecord[]>(KEYS.CHANGES, []);
}

/** 获取某个会话的改动记录 */
export async function getSessionChanges(sessionId: string): Promise<ChangeRecord[]> {
  const all = await getChangeRecords();
  return all.filter(c => c.sessionId === sessionId);
}

/** 获取未应用的剧情改动（写下一章前检查用） */
export async function getPendingPlotChanges(): Promise<ChangeRecord[]> {
  const all = await getChangeRecords();
  return all.filter(c => c.changeType === 'plot' && c.status === 'pending');
}

/** 获取影响某章的未应用改动 */
export async function getPendingChangesForChapter(chapterIndex: number): Promise<ChangeRecord[]> {
  const all = await getChangeRecords();
  return all.filter(c =>
    c.status === 'pending' &&
    c.changeType === 'plot' &&
    c.affectedChapters?.includes(chapterIndex)
  );
}

/** 添加改动记录 */
export async function addChangeRecord(change: Omit<ChangeRecord, 'id' | 'createdAt'>): Promise<ChangeRecord> {
  const record: ChangeRecord = {
    ...change,
    id: genId('cr'),
    createdAt: Date.now(),
  };
  const all = await getChangeRecords();
  all.push(record);
  await safeWrite(KEYS.CHANGES, all);
  // 同时更新session的changeRecordIds
  const session = await getReviewSession(change.sessionId);
  if (session) {
    await updateReviewSession(change.sessionId, {
      changeRecordIds: [...session.changeRecordIds, record.id],
    });
  }
  return record;
}

/** 更新改动状态 */
export async function updateChangeStatus(changeId: string, status: ChangeStatus, verifiedBy?: string): Promise<ChangeRecord | null> {
  const all = await getChangeRecords();
  const idx = all.findIndex(c => c.id === changeId);
  if (idx === -1) return null;
  all[idx] = {
    ...all[idx],
    status,
    ...(verifiedBy ? { verifiedBy, verifiedAt: Date.now() } : {}),
  };
  await safeWrite(KEYS.CHANGES, all);
  return all[idx];
}

/** 批量标记改动为已应用 */
export async function markChangesApplied(changeIds: string[]): Promise<void> {
  const all = await getChangeRecords();
  for (const id of changeIds) {
    const idx = all.findIndex(c => c.id === id);
    if (idx !== -1) {
      all[idx].status = 'applied';
    }
  }
  await safeWrite(KEYS.CHANGES, all);
}

/** 检查是否可以写下一章（硬拦截） */
export async function canWriteChapter(chapterIndex: number): Promise<{ can: boolean; pendingChanges: ChangeRecord[] }> {
  const pending = await getPendingChangesForChapter(chapterIndex);
  return {
    can: pending.length === 0,
    pendingChanges: pending,
  };
}

// ============== 细纲版本 ==============

/** 获取细纲版本信息 */
export async function getOutlineVersionInfo(): Promise<OutlineVersionInfo> {
  return safeRead<OutlineVersionInfo>(KEYS.OUTLINE, {
    currentVersion: 'v1.0',
    baseVersion: 'v1.0',
    patches: [],
    lastUpdatedAt: Date.now(),
  });
}

/** 获取当前生效的完整细纲（基础 + 所有补丁叠加） */
export async function getCurrentOutline(): Promise<string> {
  const raw = await AsyncStorage.getItem('global_iron_rules');
  // 细纲暂时存在另一个key，后续独立
  // 这里先用 global_iron_rules 占位
  return raw || '';
}

/** 添加细纲补丁 */
export async function addOutlinePatch(patch: Omit<OutlinePatch, 'id' | 'createdAt'>): Promise<OutlinePatch> {
  const newPatch: OutlinePatch = {
    ...patch,
    id: genId('op'),
    createdAt: Date.now(),
  };
  const info = await getOutlineVersionInfo();
  info.patches.push(newPatch);
  info.currentVersion = patch.version;
  info.lastUpdatedAt = Date.now();
  await safeWrite(KEYS.OUTLINE, info);
  // 同时把关联的改动记录标记为已应用
  if (patch.sourceChangeId) {
    await updateChangeStatus(patch.sourceChangeId, 'applied');
  }
  return newPatch;
}

/** 获取某章的最新细纲内容 */
export async function getChapterOutline(chapterIndex: number): Promise<string> {
  const info = await getOutlineVersionInfo();
  // 从最新的补丁往回找
  for (let i = info.patches.length - 1; i >= 0; i--) {
    const patch = info.patches[i];
    const chapterPatch = patch.patches.find(p => p.chapterIndex === chapterIndex && p.changed);
    if (chapterPatch) {
      return chapterPatch.revisedOutline;
    }
  }
  // 没有补丁，返回基础细纲
  return '';
}

// ============== 读者配置 ==============

/** 获取读者配置（用户自定义 > 默认） */
export async function getReaderProfiles(): Promise<ReaderProfile[]> {
  const custom = await safeRead<ReaderProfile[] | null>(KEYS.READERS, null);
  return custom || DEFAULT_READERS;
}

/** 保存读者配置 */
export async function saveReaderProfiles(profiles: ReaderProfile[]): Promise<void> {
  await safeWrite(KEYS.READERS, profiles);
}

/** 重置读者配置为默认 */
export async function resetReaderProfiles(): Promise<void> {
  await AsyncStorage.removeItem(KEYS.READERS);
}

// ============== 梗库缓存 ==============

interface SlangCache {
  chapterIndex: number;
  slang: string;
  timestamp: number;
}

/** 获取章节梗库缓存 */
export async function getSlangCache(chapterIndex: number): Promise<string | null> {
  const cache = await safeRead<SlangCache | null>(KEYS.SLANG_CACHE, null);
  if (cache && cache.chapterIndex === chapterIndex) {
    // 缓存30分钟有效
    if (Date.now() - cache.timestamp < 30 * 60 * 1000) {
      return cache.slang;
    }
  }
  return null;
}

/** 保存章节梗库缓存 */
export async function saveSlangCache(chapterIndex: number, slang: string): Promise<void> {
  await safeWrite(KEYS.SLANG_CACHE, {
    chapterIndex,
    slang,
    timestamp: Date.now(),
  });
}

/** 清除梗库缓存 */
export async function clearSlangCache(): Promise<void> {
  await AsyncStorage.removeItem(KEYS.SLANG_CACHE);
}

/** 清除所有审查相关数据（仅用于测试） */
export async function clearAllReviewData(): Promise<void> {
  const keys = Object.values(KEYS);
  await AsyncStorage.multiRemove(keys);
}
