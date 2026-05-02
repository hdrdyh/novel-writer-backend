import {
  ReviewStep,
  REVIEW_STEP_ORDER,
  REVIEW_STEP_LABELS,
  AgentType,
  MessageStatus,
  ReviewVerdict,
  VoteStance,
  ReviewMessage,
  ReviewSession,
  SessionStatus,
  ChangeType,
  ChangeStatus,
  ChangeRecord,
  OutlinePatch,
  OutlineChapterPatch,
  OutlineVersionInfo,
  ReaderType,
  ReaderProfile,
  NOVEL_TYPE_READERS,
  DEFAULT_READERS,
  ThrillCategory,
  THRILL_CATEGORIES,
  HARD_CHECKS,
} from '../reviewTypes';

// ============== Helper ==============
let passCount = 0;
let failCount = 0;
function assert(condition: boolean, label: string) {
  if (condition) {
    passCount++;
  } else {
    failCount++;
    console.log(`FAIL: ${label}`);
  }
}

// ============== ReviewStep & REVIEW_STEP_ORDER ==============
assert(REVIEW_STEP_ORDER.length === 10, 'REVIEW_STEP_ORDER should have 10 steps');
assert(REVIEW_STEP_ORDER[0] === 'showdown', 'First step should be showdown');
assert(REVIEW_STEP_ORDER[9] === 'verify', 'Last step should be verify');
assert(REVIEW_STEP_LABELS['showdown'] === '亮底牌', 'showdown label should be correct');
assert(REVIEW_STEP_LABELS['verify'] === '复核', 'verify label should be correct');

// ============== ReviewMessage ==============
const msg: ReviewMessage = {
  id: 'msg1',
  sessionId: 's1',
  step: 'showdown',
  stepIndex: 0,
  agentId: 'writer',
  agentType: 'pro',
  agentName: '写手',
  content: 'test content',
  stance: 'keep',
  status: 'done',
  timestamp: Date.now(),
};
assert(msg.agentType === 'pro', 'agentType should be pro');
assert(msg.status === 'done', 'status should be done');
assert(msg.stance === 'keep', 'stance should be keep');

// ============== ReviewSession ==============
const session: ReviewSession = {
  id: 's1',
  chapterIndex: 3,
  paragraphIndex: 2,
  paragraphContent: 'test paragraph',
  outline: 'test outline',
  novelType: '玄幻修仙',
  status: 'active',
  currentStep: 'showdown',
  currentStepIndex: 0,
  messageIds: [],
  changeIds: [],
  createdAt: Date.now(),
  updatedAt: Date.now(),
};
assert(session.status === 'active', 'session status should be active');
assert(session.novelType === '玄幻修仙', 'novelType should be correct');
assert(session.messageIds.length === 0, 'messageIds should start empty');

// ============== ChangeRecord ==============
const change: ChangeRecord = {
  id: 'c1',
  sessionId: 's1',
  chapterIndex: 3,
  paragraphIndex: 2,
  changeType: 'local',
  description: 'silver->gold',
  status: 'pending',
  createdAt: Date.now(),
};
assert(change.changeType === 'local', 'changeType should be local');
assert(change.status === 'pending', 'change status should be pending');

// ============== ChangeRecord plot type ==============
const plotChange: ChangeRecord = {
  id: 'c2',
  sessionId: 's1',
  chapterIndex: 3,
  paragraphIndex: 2,
  changeType: 'plot',
  description: 'pretend obey -> direct resist',
  affectedChapters: [3, 4, 7],
  status: 'pending',
  createdAt: Date.now(),
};
assert(plotChange.changeType === 'plot', 'plot change type should be plot');
assert(plotChange.affectedChapters?.length === 3, 'plot change should have 3 affected chapters');

// ============== OutlinePatch & OutlineChapterPatch ==============
const chapterPatch: OutlineChapterPatch = {
  chapterIndex: 3,
  originalContent: '假装顺从',
  revisedContent: '直接反抗',
  reason: '追责辩论',
};
assert(chapterPatch.chapterIndex === 3, 'chapterPatch chapterIndex should be 3');

const outlinePatch: OutlinePatch = {
  id: 'op1',
  version: 'v1.1',
  reason: '第3章追责辩论',
  patches: [chapterPatch],
  createdAt: Date.now(),
};
assert(outlinePatch.version === 'v1.1', 'outlinePatch version should be v1.1');
assert(outlinePatch.patches.length === 1, 'outlinePatch should have 1 patch');

// ============== OutlineVersionInfo ==============
const versionInfo: OutlineVersionInfo = {
  currentVersion: 'v1.1',
  lastUpdated: Date.now(),
  patchCount: 1,
};
assert(versionInfo.currentVersion === 'v1.1', 'versionInfo currentVersion should be v1.1');
assert(versionInfo.patchCount === 1, 'versionInfo patchCount should be 1');

// ============== ReaderProfile & DEFAULT_READERS ==============
assert(DEFAULT_READERS.length === 5, 'Should have 5 default readers');
assert(DEFAULT_READERS[0].id === 'office_worker', 'First reader should be office_worker');
assert(DEFAULT_READERS[1].id === 'otaku', 'Second reader should be otaku');
assert(DEFAULT_READERS[2].id === 'student', 'Third reader should be student');
assert(DEFAULT_READERS[3].id === 'veteran', 'Fourth reader should be veteran');
assert(DEFAULT_READERS[4].id === 'night_owl', 'Fifth reader should be night_owl');

// Verify each reader has required fields
DEFAULT_READERS.forEach((reader, i) => {
  assert(typeof reader.id === 'string', `Reader ${i} should have id`);
  assert(typeof reader.name === 'string', `Reader ${i} should have name`);
  assert(typeof reader.bottomLine === 'string', `Reader ${i} should have bottomLine`);
  assert(Array.isArray(reader.thrillPoints), `Reader ${i} should have thrillPoints array`);
  assert(typeof reader.weight === 'number', `Reader ${i} should have weight`);
  assert(typeof reader.color === 'string', `Reader ${i} should have color`);
  assert(reader.weight >= 1, `Reader ${i} weight should be >= 1`);
});

// ============== NOVEL_TYPE_READERS ==============
assert(NOVEL_TYPE_READERS['玄幻修仙'].includes('office_worker'), '玄幻修仙 should include office_worker');
assert(NOVEL_TYPE_READERS['都市重生'].includes('otaku'), '都市重生 should include otaku');
assert(NOVEL_TYPE_READERS['默认'].length >= 2, '默认 should have at least 2 readers');

// ============== THRILL_CATEGORIES ==============
const categories = Object.keys(THRILL_CATEGORIES) as ThrillCategory[];
assert(categories.length === 10, 'Should have 10 thrill categories');
assert('identity' in THRILL_CATEGORIES, 'Should have identity category');
assert('power' in THRILL_CATEGORIES, 'Should have power category');
assert('revenge' in THRILL_CATEGORIES, 'Should have revenge category');
assert('frenzy' in THRILL_CATEGORIES, 'Should have frenzy category');

// Verify each category has items
categories.forEach((cat) => {
  const c = THRILL_CATEGORIES[cat];
  assert(typeof c.label === 'string', `Category ${cat} should have label`);
  assert(Array.isArray(c.items), `Category ${cat} should have items array`);
  assert(c.items.length > 0, `Category ${cat} should have at least 1 item`);
});

// ============== HARD_CHECKS ==============
assert('opening_hook' in HARD_CHECKS, 'Should have opening_hook check');
assert('thrill_density' in HARD_CHECKS, 'Should have thrill_density check');
assert('chapter_end_hook' in HARD_CHECKS, 'Should have chapter_end_hook check');

// ============== ReviewOrchestrator Logic Tests ==============
// Test the step progression logic
function getNextStep(current: ReviewStep): ReviewStep | null {
  const idx = REVIEW_STEP_ORDER.indexOf(current);
  if (idx === -1 || idx === REVIEW_STEP_ORDER.length - 1) return null;
  return REVIEW_STEP_ORDER[idx + 1];
}

assert(getNextStep('showdown') === 'write', 'showdown -> write');
assert(getNextStep('write') === 'review', 'write -> review');
assert(getNextStep('review') === 'respond', 'review -> respond');
assert(getNextStep('respond') === 'vote', 'respond -> vote');
assert(getNextStep('vote') === 'impact', 'vote -> impact');
assert(getNextStep('impact') === 'outline_update', 'impact -> outline_update');
assert(getNextStep('outline_update') === 'consistency', 'outline_update -> consistency');
assert(getNextStep('consistency') === 'execute', 'consistency -> execute');
assert(getNextStep('execute') === 'verify', 'execute -> verify');
assert(getNextStep('verify') === null, 'verify has no next step');

// Test change classification logic
function classifyChange(changeRecord: ChangeRecord): 'local' | 'plot' {
  return changeRecord.changeType;
}

assert(classifyChange(change) === 'local', 'local change classified correctly');
assert(classifyChange(plotChange) === 'plot', 'plot change classified correctly');

// Test vote counting with weights
interface Vote {
  readerId: ReaderType;
  stance: VoteStance;
  weight: number;
}

function countVotes(votes: Vote[]): { keep: number; change: number } {
  let keep = 0;
  let changeVal = 0;
  votes.forEach((v) => {
    if (v.stance === 'keep') keep += v.weight;
    else changeVal += v.weight;
  });
  return { keep, change: changeVal };
}

const testVotes: Vote[] = [
  { readerId: 'office_worker', stance: 'change', weight: 2 },
  { readerId: 'otaku', stance: 'change', weight: 2 },
  { readerId: 'student', stance: 'keep', weight: 2 },
  { readerId: 'veteran', stance: 'keep', weight: 1.5 },
  { readerId: 'night_owl', stance: 'change', weight: 1.5 },
];

const voteResult = countVotes(testVotes);
assert(voteResult.keep === 3.5, `Keep votes should be 3.5, got ${voteResult.keep}`);
assert(voteResult.change === 5.5, `Change votes should be 5.5, got ${voteResult.change}`);
assert(voteResult.change > voteResult.keep, 'Change should win this vote');

// Test reader selection by novel type
function getFocusReaders(novelType: string): ReaderType[] {
  return NOVEL_TYPE_READERS[novelType] || NOVEL_TYPE_READERS['默认'];
}

assert(getFocusReaders('玄幻修仙').length === 3, '玄幻修仙 should have 3 focus readers');
assert(getFocusReaders('都市重生').length === 3, '都市重生 should have 3 focus readers');
assert(getFocusReaders('默认').length === 3, '默认 should have 3 focus readers');
assert(getFocusReaders('未知类型').length === 3, 'Unknown type should fallback to 默认');

// Test outline patch version progression
function getNextVersion(current: string): string {
  const match = current.match(/^v(\d+)\.(\d+)$/);
  if (!match) return 'v1.0';
  const minor = parseInt(match[2], 10) + 1;
  return `v${match[1]}.${minor}`;
}

assert(getNextVersion('v1.0') === 'v1.1', 'v1.0 -> v1.1');
assert(getNextVersion('v1.1') === 'v1.2', 'v1.1 -> v1.2');
assert(getNextVersion('v2.3') === 'v2.4', 'v2.3 -> v2.4');

// ============== Summary ==============
console.log(`\n============================`);
console.log(`Review Types & Logic Tests: ${passCount} passed, ${failCount} failed`);
console.log(`============================\n`);
if (failCount > 0) {
  process.exit(1);
}
