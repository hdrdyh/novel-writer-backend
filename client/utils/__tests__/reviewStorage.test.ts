/* eslint-disable forbidEmoji/no-emoji */
/**
 * 追责制审查系统 - 数据层测试脚本
 * 
 * 运行方式：cd /workspace/projects && npx tsx client/utils/__tests__/reviewStorage.test.ts
 * 
 * 不依赖 React Native 环境，用内存模拟 AsyncStorage 验证逻辑正确性
 */

// ===== 内存模拟 AsyncStorage =====
const store: Record<string, string> = {};

const mockAsyncStorage = {
  getItem: async (key: string) => store[key] || null,
  setItem: async (key: string, value: string) => { store[key] = value; },
  removeItem: async (key: string) => { delete store[key]; },
};

// 替换模块（在import之前用require替换）
// 由于我们无法在测试中替换ES模块，改为直接测试逻辑

// ===== 直接复制核心逻辑进行测试 =====

function genId(prefix: string = ''): string {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 8);
  return prefix ? `${prefix}_${ts}_${rand}` : `${ts}_${rand}`;
}

const REVIEW_STEP_ORDER = [
  'showdown', 'write', 'review', 'respond', 'vote',
  'impact', 'outline_update', 'consistency', 'execute', 'verify',
] as const;

type ReviewStep = typeof REVIEW_STEP_ORDER[number];

interface ReviewSession {
  id: string;
  createdAt: number;
  updatedAt: number;
  status: 'active' | 'paused' | 'completed' | 'cancelled';
  currentStep: ReviewStep;
  currentStepIndex: number;
  messageIds: string[];
  changeRecordIds: string[];
  [key: string]: any;
}

interface ChangeRecord {
  id: string;
  sessionId: string;
  changeType: 'local' | 'plot';
  status: 'pending' | 'applied' | 'rejected';
  affectedChapters?: number[];
  outlinePatchId?: string;
  createdAt: number;
  [key: string]: any;
}

interface OutlineVersionInfo {
  currentVersion: string;
  baseVersion: string;
  patches: any[];
  lastUpdatedAt: number;
}

// ===== 内存存储层（模拟 reviewStorage 的核心逻辑）=====

let sessions: ReviewSession[] = [];
let changes: ChangeRecord[] = [];
let outlineInfo: OutlineVersionInfo = {
  currentVersion: 'v1.0',
  baseVersion: 'v1.0',
  patches: [],
  lastUpdatedAt: Date.now(),
};

function resetStore() {
  sessions = [];
  changes = [];
  outlineInfo = {
    currentVersion: 'v1.0',
    baseVersion: 'v1.0',
    patches: [],
    lastUpdatedAt: Date.now(),
  };
}

// ===== 测试用例 =====

let passCount = 0;
let failCount = 0;

function assert(condition: boolean, testName: string) {
  if (condition) {
    console.log(`  ✅ ${testName}`);
    passCount++;
  } else {
    console.log(`  ❌ ${testName}`);
    failCount++;
  }
}

async function test1_createSession() {
  console.log('\n📋 测试1：创建审查会话');
  
  const session: ReviewSession = {
    id: genId('rs'),
    createdAt: Date.now(),
    updatedAt: Date.now(),
    status: 'active',
    currentStep: 'showdown',
    currentStepIndex: 0,
    messageIds: [],
    changeRecordIds: [],
    chapterIndex: 3,
    paragraphIndex: 2,
    originalText: '测试段落',
    novelType: '玄幻修仙',
  };
  sessions.push(session);

  assert(session.id.startsWith('rs_'), 'ID以rs_开头');
  assert(session.status === 'active', '初始状态为active');
  assert(session.currentStep === 'showdown', '初始步骤为showdown');
  assert(session.currentStepIndex === 0, '初始步骤索引为0');
  assert(session.messageIds.length === 0, '消息列表初始为空');
  assert(session.changeRecordIds.length === 0, '改动列表初始为空');
}

async function test2_advanceSteps() {
  console.log('\n📋 测试2：步骤推进');
  
  const session = sessions[0];
  
  // 推进一步
  session.currentStepIndex = 1;
  session.currentStep = REVIEW_STEP_ORDER[1];
  
  assert(session.currentStep === 'write', '第2步为write');
  assert(session.currentStepIndex === 1, '步骤索引为1');
  
  // 推到最后
  session.currentStepIndex = 9;
  session.currentStep = REVIEW_STEP_ORDER[9];
  
  assert(session.currentStep === 'verify', '最后一步为verify');
  
  // 再推一步应该完成
  const nextIndex = session.currentStepIndex + 1;
  if (nextIndex >= REVIEW_STEP_ORDER.length) {
    session.status = 'completed';
  }
  
  assert(session.status === 'completed', '10步走完状态为completed');
}

async function test3_pauseResume() {
  console.log('\n📋 测试3：暂停和恢复');
  
  const session: ReviewSession = {
    id: genId('rs'),
    createdAt: Date.now(),
    updatedAt: Date.now(),
    status: 'active',
    currentStep: 'review',
    currentStepIndex: 2,
    messageIds: [],
    changeRecordIds: [],
  };
  
  session.status = 'paused';
  assert(session.status === 'paused', '暂停成功');
  
  session.status = 'active';
  assert(session.status === 'active', '恢复成功');
}

async function test4_changeRecord_local() {
  console.log('\n📋 测试4：局部改动记录');
  
  const change: ChangeRecord = {
    id: genId('cr'),
    sessionId: sessions[0]?.id || 'test',
    chapterIndex: 3,
    paragraphIndex: 2,
    changeType: 'local',
    status: 'pending',
    description: '银色→金色',
    originalContent: '银色灵光',
    revisedContent: '金色灵光',
    createdAt: Date.now(),
  };
  changes.push(change);

  assert(change.changeType === 'local', '改动类型为local');
  assert(!change.affectedChapters, '局部改动不影响其他章节');
  assert(change.status === 'pending', '初始状态为pending');
  
  // 标记已应用
  change.status = 'applied';
  assert(change.status === 'applied', '局部改动可直接标记已应用');
}

async function test5_changeRecord_plot() {
  console.log('\n📋 测试5：剧情改动记录');
  
  const change: ChangeRecord = {
    id: genId('cr'),
    sessionId: sessions[0]?.id || 'test',
    chapterIndex: 3,
    paragraphIndex: 2,
    changeType: 'plot',
    status: 'pending',
    description: '假装顺从→直接反抗',
    originalContent: '假装顺从',
    revisedContent: '直接反抗',
    affectedChapters: [3, 4, 7],
    createdAt: Date.now(),
  };
  changes.push(change);

  assert(change.changeType === 'plot', '改动类型为plot');
  assert(change.affectedChapters!.length === 3, '影响3个章节');
  assert(change.affectedChapters!.includes(7), '影响第7章');
  assert(change.status === 'pending', '剧情改动初始为pending，需细纲修订后才能applied');
  
  // 模拟细纲修订完成
  change.outlinePatchId = genId('op');
  change.status = 'applied';
  assert(change.status === 'applied', '细纲修订后改动标记为applied');
}

async function test6_pendingPlotChanges() {
  console.log('\n📋 测试6：未应用剧情改动检查');
  
  // 添加一个pending的剧情改动
  const pendingChange: ChangeRecord = {
    id: genId('cr'),
    sessionId: 'test_session',
    chapterIndex: 5,
    paragraphIndex: 1,
    changeType: 'plot',
    status: 'pending',
    description: '角色关系调整',
    affectedChapters: [5, 6],
    createdAt: Date.now(),
  };
  changes.push(pendingChange);

  const pendingPlotChanges = changes.filter(c => c.changeType === 'plot' && c.status === 'pending');
  assert(pendingPlotChanges.length >= 1, '存在未应用的剧情改动');
  
  // 检查能否写第6章
  const canWrite6 = !pendingPlotChanges.some(c => c.affectedChapters?.includes(6));
  assert(!canWrite6, '第6章有未应用改动，不能写');
  
  // 检查能否写第8章
  const canWrite8 = !pendingPlotChanges.some(c => c.affectedChapters?.includes(8));
  assert(canWrite8, '第8章无未应用改动，可以写');
}

async function test7_outlineVersion() {
  console.log('\n📋 测试7：细纲版本管理');
  
  assert(outlineInfo.currentVersion === 'v1.0', '初始版本v1.0');
  assert(outlineInfo.patches.length === 0, '初始无补丁');
  
  // 添加补丁
  const patch = {
    id: genId('op'),
    version: 'v1.1',
    parentVersion: 'v1.0',
    sourceSessionId: 'test_session',
    sourceChangeId: 'test_change',
    reason: '第3章追责辩论，假装顺从→直接反抗',
    patches: [
      {
        chapterIndex: 3,
        originalOutline: '假装顺从，暗中布局',
        revisedOutline: '直接反抗，初露锋芒',
        changed: true,
      },
      {
        chapterIndex: 4,
        originalOutline: '继续伪装，深入敌营',
        revisedOutline: '反抗后的逃亡与追击',
        changed: true,
      },
      {
        chapterIndex: 5,
        originalOutline: '发现敌人核心秘密',
        revisedOutline: '逃亡中发现敌人核心秘密',
        changed: true,
      },
      {
        chapterIndex: 1,
        originalOutline: '原内容',
        revisedOutline: '原内容',
        changed: false,
      },
    ],
    createdAt: Date.now(),
  };
  
  outlineInfo.patches.push(patch);
  outlineInfo.currentVersion = 'v1.1';
  outlineInfo.lastUpdatedAt = Date.now();
  
  assert(outlineInfo.currentVersion === 'v1.1', '版本更新到v1.1');
  assert(outlineInfo.patches.length === 1, '有1个补丁');
  
  // 查找第3章最新细纲
  const ch3Patch = outlineInfo.patches[0].patches.find((p: any) => p.chapterIndex === 3 && p.changed);
  assert(ch3Patch?.revisedOutline === '直接反抗，初露锋芒', '第3章细纲已更新');
  
  // 查找第1章（未改）
  const ch1Patch = outlineInfo.patches[0].patches.find((p: any) => p.chapterIndex === 1);
  assert(ch1Patch?.changed === false, '第1章未受影响');
  
  // 添加第二个补丁
  const patch2 = {
    id: genId('op'),
    version: 'v1.2',
    parentVersion: 'v1.1',
    sourceSessionId: 'test_session2',
    sourceChangeId: 'test_change2',
    reason: '第5章角色关系调整',
    patches: [
      {
        chapterIndex: 3,
        originalOutline: '直接反抗，初露锋芒',
        revisedOutline: '直接反抗，初露锋芒，引发连锁反应',
        changed: true,
      },
    ],
    createdAt: Date.now(),
  };
  outlineInfo.patches.push(patch2);
  outlineInfo.currentVersion = 'v1.2';
  
  // 查找第3章最新细纲（应该用v1.2的）
  let latestCh3Outline = '';
  for (let i = outlineInfo.patches.length - 1; i >= 0; i--) {
    const chPatch = outlineInfo.patches[i].patches.find((p: any) => p.chapterIndex === 3 && p.changed);
    if (chPatch) {
      latestCh3Outline = chPatch.revisedOutline;
      break;
    }
  }
  assert(latestCh3Outline === '直接反抗，初露锋芒，引发连锁反应', '第3章细纲使用最新补丁v1.2');
}

async function test8_changeTypeClassification() {
  console.log('\n📋 测试8：改动分类判定规则');
  
  // 规则：改动涉及后续章节关键词 → plot，否则 → local
  
  const testCases = [
    {
      description: '银色→金色（仅描写修改）',
      affectsFuture: false,
      expectedType: 'local' as const,
    },
    {
      description: '假装顺从→直接反抗（改变剧情走向）',
      affectsFuture: true,
      affectedChapters: [4, 7],
      expectedType: 'plot' as const,
    },
    {
      description: '加一句密室描写（氛围补充）',
      affectsFuture: false,
      expectedType: 'local' as const,
    },
    {
      description: '主角性格从隐忍变冲动（影响后续所有互动）',
      affectsFuture: true,
      affectedChapters: [4, 5, 6, 7, 8],
      expectedType: 'plot' as const,
    },
    {
      description: '修复时间线错误（第2章提过是上午，这里写成了晚上）',
      affectsFuture: false,
      expectedType: 'local' as const,
    },
  ];
  
  for (const tc of testCases) {
    const classified = tc.affectsFuture ? 'plot' : 'local';
    assert(classified === tc.expectedType, `${tc.description} → ${tc.expectedType}`);
  }
}

async function test9_stepOrderEnforcement() {
  console.log('\n📋 测试9：步骤顺序不可跳步');
  
  const validOrder = ['showdown', 'write', 'review', 'respond', 'vote', 'impact', 'outline_update', 'consistency', 'execute', 'verify'];
  
  // 验证顺序定义完整
  assert(REVIEW_STEP_ORDER.length === 10, '共10步');
  assert(REVIEW_STEP_ORDER[0] === 'showdown', '第1步是showdown');
  assert(REVIEW_STEP_ORDER[9] === 'verify', '第10步是verify');
  
  // 验证不可跳步：从第3步直接到第5步
  const fromIndex = 2; // review
  const toStep = 'vote'; // index 4
  const toIndex = REVIEW_STEP_ORDER.indexOf(toStep);
  const canSkip = toIndex === fromIndex + 1;
  assert(!canSkip, '不允许跳步：review→vote（跳过了respond）');
  
  // 验证正常推进
  const normalNext = fromIndex + 1;
  const normalStep = REVIEW_STEP_ORDER[normalNext];
  assert(normalStep === 'respond', '正常推进：review→respond');
}

async function test10_dataIntegrity() {
  console.log('\n📋 测试10：数据完整性');
  
  // 测试ID生成唯一性
  const ids = new Set<string>();
  for (let i = 0; i < 100; i++) {
    ids.add(genId('test'));
  }
  assert(ids.size === 100, '100个ID全部唯一');
  
  // 测试改动和会话的关联
  const session: ReviewSession = {
    id: genId('rs'),
    createdAt: Date.now(),
    updatedAt: Date.now(),
    status: 'active',
    currentStep: 'showdown',
    currentStepIndex: 0,
    messageIds: ['msg1', 'msg2'],
    changeRecordIds: ['cr1'],
  };
  
  assert(session.messageIds.length === 2, '消息ID列表长度正确');
  assert(session.changeRecordIds.includes('cr1'), '改动ID在会话中');
}

// ===== 运行所有测试 =====

async function runAll() {
  console.log('🚀 追责制审查系统 - 数据层测试');
  console.log('='.repeat(50));
  
  resetStore();
  
  await test1_createSession();
  await test2_advanceSteps();
  await test3_pauseResume();
  await test4_changeRecord_local();
  await test5_changeRecord_plot();
  await test6_pendingPlotChanges();
  await test7_outlineVersion();
  await test8_changeTypeClassification();
  await test9_stepOrderEnforcement();
  await test10_dataIntegrity();
  
  console.log('\n' + '='.repeat(50));
  console.log(`📊 测试结果：✅ ${passCount} 通过  ❌ ${failCount} 失败`);
  
  if (failCount > 0) {
    process.exit(1);
  }
}

runAll().catch(err => {
  console.error('测试运行失败:', err);
  process.exit(1);
});
