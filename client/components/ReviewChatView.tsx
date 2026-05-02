import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Animated,
  StyleSheet,
  FlatList,
} from 'react-native';
import { GC } from '@/utils/glassColors';
import type {
  ReviewMessage,
  ReviewStep,
  ChangeRecord,
  OutlinePatch,
  ReaderType,
} from '@/utils/reviewTypes';
import {
  REVIEW_STEP_ORDER,
  DEFAULT_READERS,
  THRILL_CATEGORIES,
  HARD_CHECKS,
} from '@/utils/reviewTypes';

// ─── Agent avatar colors ───
const AGENT_COLORS: Record<string, string> = {
  writer: '#7C5CFF',
  coordinator: '#FF6B6B',
  detail_outliner: '#69E7FF',
  rough_outliner: '#4ECDC4',
  reviewer: '#FFD700',
  memory: '#62FAD3',
  dialogue: '#FF8A65',
  scene: '#AB47BC',
  worldview: '#42A5F5',
};

const READER_COLORS: Record<string, string> = {
  office_worker: '#FF6B6B',
  otaku: '#AB47BC',
  student: '#42A5F5',
  veteran: '#FFD700',
  night_owl: '#69E7FF',
};

// ─── Step labels ───
const STEP_LABELS: Record<ReviewStep, string> = {
  showdown: '亮底牌',
  write: '写手执笔',
  review: '追责',
  respond: '写手回应',
  vote: '投票',
  impact: '影响评估',
  outline_update: '细纲修订',
  consistency: '一致性检查',
  execute: '执行修改',
  verify: '复核确认',
};

// ─── Props ───
interface ReviewChatViewProps {
  messages: ReviewMessage[];
  currentStep: ReviewStep | null;
  isStepRunning: boolean;
  pendingAgents: string[];
  changeRecords: ChangeRecord[];
  outlinePatch: OutlinePatch | null;
  onConfirmOutlinePatch: (patch: OutlinePatch) => void;
  onRejectOutlinePatch: () => void;
  onConfirmChange: (changeId: string) => void;
  onRejectChange: (changeId: string) => void;
  onClose: () => void;
  sessionComplete: boolean;
}

// ─── Sub-components ───

/** Single message bubble */
function MessageBubble({ message }: { message: ReviewMessage }) {
  const isReader = message.agentType === 'reader';
  const isCoordinator = message.agentId === 'coordinator';
  const isSystem = message.agentId === 'system';
  const avatarColor = isReader
    ? READER_COLORS[message.agentId] || GC.textMuted
    : AGENT_COLORS[message.agentId] || GC.textMuted;

  const agentLabel = getAgentLabel(message.agentId, message.agentType);

  return (
    <View style={[s.msgRow, isSystem && s.msgRowCenter]}>
      {!isSystem && (
        <View style={[s.avatar, { backgroundColor: avatarColor + '22', borderColor: avatarColor + '55' }]}>
          <Text style={[s.avatarText, { color: avatarColor }]}>
            {agentLabel.charAt(0)}
          </Text>
        </View>
      )}
      <View style={[
        s.msgBubble,
        isCoordinator && s.msgBubbleCoordinator,
        isReader && s.msgBubbleReader,
        isSystem && s.msgBubbleSystem,
      ]}>
        {!isSystem && (
          <View style={s.msgHeader}>
            <Text style={[s.msgName, { color: avatarColor }]}>{agentLabel}</Text>
            {message.voteStance && (
              <Text style={[s.msgStance, { color: stanceColor(message.voteStance) }]}>
                {stanceLabel(message.voteStance)}
              </Text>
            )}
            {isReader && message.voteWeight && message.voteWeight > 1 && (
              <Text style={s.msgWeight}>x{message.voteWeight}</Text>
            )}
          </View>
        )}
        <Text style={[s.msgContent, isSystem && s.msgContentSystem]}>
          {message.content}
        </Text>
        {message.status === 'done' && !isSystem && (
          <Text style={s.msgDelivered}>done</Text>
        )}
      </View>
    </View>
  );
}

/** Streaming indicator for active agent */
function StreamingIndicator({ agentId, agentType }: { agentId: string; agentType: string }) {
  const dot1 = useRef(new Animated.Value(0)).current;
  const dot2 = useRef(new Animated.Value(0)).current;
  const dot3 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animate = (dot: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(dot, { toValue: 1, duration: 300, useNativeDriver: true }),
          Animated.timing(dot, { toValue: 0, duration: 300, useNativeDriver: true }),
        ])
      );
    const a1 = animate(dot1, 0);
    const a2 = animate(dot2, 150);
    const a3 = animate(dot3, 300);
    a1.start(); a2.start(); a3.start();
    return () => { a1.stop(); a2.stop(); a3.stop(); };
  }, [dot1, dot2, dot3]);

  const label = getAgentLabel(agentId, agentType);

  return (
    <View style={s.msgRow}>
      <View style={[s.avatar, { backgroundColor: GC.primary + '22', borderColor: GC.primary + '55' }]}>
        <Text style={[s.avatarText, { color: GC.primary }]}>{label.charAt(0)}</Text>
      </View>
      <View style={s.msgBubble}>
        <Text style={[s.msgName, { color: GC.primary }]}>{label}</Text>
        <View style={s.streamingDots}>
          {[dot1, dot2, dot3].map((dot, i) => (
            <Animated.View
              key={i}
              style={[s.streamingDot, { opacity: dot, backgroundColor: GC.primary }]}
            />
          ))}
        </View>
      </View>
    </View>
  );
}

/** Pending agent queue */
function PendingQueue({ agents }: { agents: string[] }) {
  if (agents.length === 0) return null;
  return (
    <View style={s.pendingRow}>
      {agents.map((id) => (
        <View key={id} style={s.pendingBadge}>
          <Text style={s.pendingText}>{getAgentLabel(id, 'pro')}</Text>
        </View>
      ))}
    </View>
  );
}

/** Vote progress bar */
function VoteProgress({ messages }: { messages: ReviewMessage[] }) {
  const voteMsgs = messages.filter((m) => m.step === 'vote' && m.stance);
  if (voteMsgs.length === 0) return null;

  const keepCount = voteMsgs.filter((m) => m.stance === 'keep').length;
  const changeCount = voteMsgs.filter((m) => m.stance === 'change').length;
  const minorCount = voteMsgs.filter((m) => m.stance === 'minor_change').length;
  const total = Math.max(keepCount + changeCount + minorCount, 1);

  return (
    <View style={s.voteBar}>
      <View style={s.voteBarRow}>
        <View style={[s.voteBarSegment, { flex: keepCount / total, backgroundColor: GC.success }]} />
        <View style={[s.voteBarSegment, { flex: minorCount / total, backgroundColor: GC.warning }]} />
        <View style={[s.voteBarSegment, { flex: changeCount / total, backgroundColor: GC.danger }]} />
      </View>
      <View style={s.voteBarLabels}>
        <Text style={s.voteBarLabel}>keep {keepCount}</Text>
        <Text style={s.voteBarLabel}>minor {minorCount}</Text>
        <Text style={s.voteBarLabel}>change {changeCount}</Text>
      </View>
    </View>
  );
}

/** Outline patch confirmation panel */
function OutlinePatchPanel({
  patch,
  onConfirm,
  onReject,
}: {
  patch: OutlinePatch;
  onConfirm: () => void;
  onReject: () => void;
}) {
  return (
    <View style={s.patchPanel}>
      <Text style={s.patchTitle}>Outline Revision</Text>
      {patch.patches.map((p, i) => (
        <View key={i} style={s.patchItem}>
          <Text style={s.patchChapter}>Ch.{p.chapterIndex}</Text>
          <Text style={s.patchOld}>{p.originalContent}</Text>
          <Text style={s.patchArrow}>---</Text>
          <Text style={s.patchNew}>{p.revisedContent}</Text>
        </View>
      ))}
      <View style={s.patchActions}>
        <TouchableOpacity style={s.patchRejectBtn} onPress={onReject}>
          <Text style={s.patchRejectText}>Reject</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.patchConfirmBtn} onPress={onConfirm}>
          <Text style={s.patchConfirmText}>Confirm</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

/** Change record item */
function ChangeRecordItem({
  change,
  onConfirm,
  onReject,
}: {
  change: ChangeRecord;
  onConfirm: (id: string) => void;
  onReject: (id: string) => void;
}) {
  const typeColor = change.changeType === 'local' ? GC.success : GC.warning;
  return (
    <View style={s.changeItem}>
      <View style={s.changeHeader}>
        <Text style={[s.changeType, { color: typeColor }]}>
          {change.changeType === 'local' ? 'local' : 'plot'}
        </Text>
        <Text style={s.changeDesc}>{change.description}</Text>
      </View>
      {change.status === 'pending' && (
        <View style={s.changeActions}>
          <TouchableOpacity style={s.changeRejectBtn} onPress={() => onReject(change.id)}>
            <Text style={s.changeRejectText}>Skip</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.changeConfirmBtn} onPress={() => onConfirm(change.id)}>
            <Text style={s.changeConfirmText}>Apply</Text>
          </TouchableOpacity>
        </View>
      )}
      {change.status === 'applied' && <Text style={s.changeApplied}>applied</Text>}
    </View>
  );
}

// ─── Helper functions ───

function getAgentLabel(agentId: string, agentType: string): string {
  if (agentType === 'system') return 'System';
  if (agentType === 'reader') {
    const reader = DEFAULT_READERS.find((r) => r.id === agentId);
    return reader ? reader.name : agentId;
  }
  const labels: Record<string, string> = {
    writer: 'Writer',
    coordinator: 'Coordinator',
    detail_outliner: 'Detail',
    rough_outliner: 'Rough',
    reviewer: 'Reviewer',
    memory: 'Memory',
    dialogue: 'Dialogue',
    scene: 'Scene',
    worldview: 'Worldview',
  };
  return labels[agentId] || agentId;
}

function stanceColor(stance: string): string {
  switch (stance) {
    case 'keep': return GC.success;
    case 'change': return GC.danger;
    case 'minor_change': return GC.warning;
    default: return GC.textMuted;
  }
}

function stanceLabel(stance: string): string {
  switch (stance) {
    case 'keep': return 'KEEP';
    case 'change': return 'CHANGE';
    case 'minor_change': return 'MINOR';
    default: return '';
  }
}

// ─── Main component ───

export default function ReviewChatView({
  messages,
  currentStep,
  isStepRunning,
  pendingAgents,
  changeRecords,
  outlinePatch,
  onConfirmOutlinePatch,
  onRejectOutlinePatch,
  onConfirmChange,
  onRejectChange,
  onClose,
  sessionComplete,
}: ReviewChatViewProps) {
  const scrollRef = useRef<ScrollView>(null);
  const streamingAgentId = messages.length > 0 && messages[messages.length - 1].status === 'streaming'
    ? messages[messages.length - 1].agentId
    : null;
  const streamingAgentType = messages.length > 0 && messages[messages.length - 1].status === 'streaming'
    ? messages[messages.length - 1].agentType
    : null;

  // Auto-scroll to bottom
  useEffect(() => {
    scrollRef.current?.scrollToEnd?.({ animated: true });
  }, [messages.length]);

  const pendingChanges = changeRecords.filter((c) => c.status === 'pending');

  return (
    <View style={s.container}>
      {/* Header */}
      <View style={s.header}>
        <Text style={s.headerTitle}>
          {sessionComplete ? 'Review Complete' : currentStep ? STEP_LABELS[currentStep] : 'Review'}
        </Text>
        {currentStep && !sessionComplete && (
          <View style={s.stepBadge}>
            <Text style={s.stepBadgeText}>
              Step {REVIEW_STEP_ORDER.indexOf(currentStep) + 1}/10
            </Text>
          </View>
        )}
        <TouchableOpacity style={s.closeBtn} onPress={onClose}>
          <Text style={s.closeBtnText}>X</Text>
        </TouchableOpacity>
      </View>

      {/* Vote progress (shown during vote step) */}
      {currentStep === 'vote' && <VoteProgress messages={messages} />}

      {/* Messages */}
      <ScrollView ref={scrollRef} style={s.messageList} contentContainerStyle={s.messageListContent}>
        {messages.map((msg) => (
          <MessageBubble key={msg.id} message={msg} />
        ))}

        {/* Streaming indicator */}
        {streamingAgentId && streamingAgentType && (
          <StreamingIndicator agentId={streamingAgentId} agentType={streamingAgentType} />
        )}

        {/* Pending agents */}
        {isStepRunning && pendingAgents.length > 0 && !streamingAgentId && (
          <PendingQueue agents={pendingAgents} />
        )}

        {/* Step running indicator */}
        {isStepRunning && !streamingAgentId && pendingAgents.length === 0 && (
          <View style={s.loadingRow}>
            <ActivityIndicator size="small" color={GC.primary} />
            <Text style={s.loadingText}>Processing...</Text>
          </View>
        )}
      </ScrollView>

      {/* Outline patch panel */}
      {outlinePatch && (
        <OutlinePatchPanel
          patch={outlinePatch}
          onConfirm={() => onConfirmOutlinePatch(outlinePatch)}
          onReject={onRejectOutlinePatch}
        />
      )}

      {/* Change records panel */}
      {pendingChanges.length > 0 && (
        <View style={s.changePanel}>
          <Text style={s.changePanelTitle}>Changes ({pendingChanges.length})</Text>
          <FlatList
            data={pendingChanges}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <ChangeRecordItem change={item} onConfirm={onConfirmChange} onReject={onRejectChange} />
            )}
            scrollEnabled={false}
          />
        </View>
      )}

      {/* Bottom bar */}
      {sessionComplete && (
        <View style={s.bottomBar}>
          <TouchableOpacity style={s.doneBtn} onPress={onClose}>
            <Text style={s.doneBtnText}>Done</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

// ─── Styles ───

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: GC.bgBase },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 54,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: GC.border,
    backgroundColor: GC.bgElevated,
  },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: GC.textPrimary, flex: 1 },
  stepBadge: {
    backgroundColor: GC.primary + '22',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginRight: 12,
  },
  stepBadgeText: { color: GC.primary, fontSize: 12, fontWeight: '600' },
  closeBtn: { padding: 8 },
  closeBtnText: { color: GC.textMuted, fontSize: 18, fontWeight: 'bold' },

  // Vote progress
  voteBar: { paddingHorizontal: 16, paddingVertical: 10, backgroundColor: GC.bgElevated },
  voteBarRow: {
    flexDirection: 'row',
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
    backgroundColor: GC.bgCard,
  },
  voteBarSegment: { height: 6 },
  voteBarLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  voteBarLabel: { fontSize: 11, color: GC.textMuted },

  // Message list
  messageList: { flex: 1 },
  messageListContent: { paddingVertical: 12, paddingHorizontal: 12, gap: 10 },

  // Message row
  msgRow: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  msgRowCenter: { justifyContent: 'center' },

  // Avatar
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    marginTop: 2,
  },
  avatarText: { fontSize: 13, fontWeight: 'bold' },

  // Message bubble
  msgBubble: {
    flex: 1,
    backgroundColor: GC.bgCard,
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: GC.borderLight,
  },
  msgBubbleCoordinator: {
    borderColor: GC.danger + '44',
    backgroundColor: GC.danger + '0A',
  },
  msgBubbleReader: {
    borderColor: GC.primary + '33',
    backgroundColor: GC.primary + '0A',
  },
  msgBubbleSystem: {
    backgroundColor: 'transparent',
    borderWidth: 0,
    borderRadius: 0,
    paddingVertical: 4,
  },

  // Message content
  msgHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  msgName: { fontSize: 12, fontWeight: '700' },
  msgStance: { fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },
  msgWeight: { fontSize: 10, color: GC.warning, fontWeight: '600' },
  msgContent: { fontSize: 14, color: GC.textPrimary, lineHeight: 20 },
  msgContentSystem: { fontSize: 12, color: GC.textMuted, textAlign: 'center' },
  msgDelivered: { fontSize: 10, color: GC.textTertiary, textAlign: 'right', marginTop: 4 },

  // Streaming indicator
  streamingDots: { flexDirection: 'row', gap: 4, marginTop: 6 },
  streamingDot: { width: 6, height: 6, borderRadius: 3 },

  // Pending queue
  pendingRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingHorizontal: 12, paddingVertical: 8 },
  pendingBadge: {
    backgroundColor: GC.bgCard,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: GC.border,
  },
  pendingText: { fontSize: 11, color: GC.textMuted },

  // Loading row
  loadingRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 8 },
  loadingText: { fontSize: 13, color: GC.textMuted },

  // Outline patch panel
  patchPanel: {
    backgroundColor: GC.bgElevated,
    borderTopWidth: 1,
    borderTopColor: GC.warning + '44',
    padding: 16,
  },
  patchTitle: { fontSize: 15, fontWeight: 'bold', color: GC.warning, marginBottom: 10 },
  patchItem: { marginBottom: 10, paddingLeft: 8, borderLeftWidth: 2, borderLeftColor: GC.warning + '55' },
  patchChapter: { fontSize: 12, color: GC.textMuted, marginBottom: 2 },
  patchOld: { fontSize: 13, color: GC.danger, textDecorationLine: 'line-through', marginBottom: 2 },
  patchArrow: { fontSize: 11, color: GC.textTertiary },
  patchNew: { fontSize: 13, color: GC.success },
  patchActions: { flexDirection: 'row', gap: 10, marginTop: 12, justifyContent: 'flex-end' },
  patchRejectBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: GC.border,
  },
  patchRejectText: { color: GC.textSecondary, fontSize: 14 },
  patchConfirmBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: GC.warning,
  },
  patchConfirmText: { color: '#000', fontSize: 14, fontWeight: '600' },

  // Change panel
  changePanel: {
    backgroundColor: GC.bgElevated,
    borderTopWidth: 1,
    borderTopColor: GC.border,
    padding: 12,
    maxHeight: 200,
  },
  changePanelTitle: { fontSize: 14, fontWeight: 'bold', color: GC.textPrimary, marginBottom: 8 },
  changeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: GC.borderLight,
  },
  changeHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  changeType: { fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },
  changeDesc: { fontSize: 13, color: GC.textPrimary, flex: 1 },
  changeActions: { flexDirection: 'row', gap: 6 },
  changeRejectBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: GC.border,
  },
  changeRejectText: { fontSize: 12, color: GC.textSecondary },
  changeConfirmBtn: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6, backgroundColor: GC.primary },
  changeConfirmText: { fontSize: 12, color: '#FFF', fontWeight: '600' },
  changeApplied: { fontSize: 11, color: GC.success, fontWeight: '600' },

  // Bottom bar
  bottomBar: { padding: 16, backgroundColor: GC.bgElevated, borderTopWidth: 1, borderTopColor: GC.border },
  doneBtn: {
    backgroundColor: GC.primary,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  doneBtnText: { color: '#FFF', fontSize: 16, fontWeight: '700' },
});
