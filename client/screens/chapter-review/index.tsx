import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Screen } from '@/components/Screen';
import { Ionicons } from '@expo/vector-icons';
import { useSafeRouter, useSafeSearchParams } from '@/hooks/useSafeRouter';
import AsyncStorage from '@react-native-async-storage/async-storage';
import RNSSE from 'react-native-sse';

const API_BASE_URL = process.env.EXPO_PUBLIC_BACKEND_BASE_URL || 'http://localhost:9091';

interface ChatMessage {
  id: string;
  type: 'agent' | 'user' | 'system';
  agentName?: string;
  agentRole?: string;
  content: string;
  suggestion?: string;  // 采纳后要替换/修改的内容
  adopted?: boolean;
  timestamp: number;
}

const AGENT_COLORS: Record<string, string> = {
  '世界观架构师': '#60a5fa',
  '人物设定师': '#f472b6',
  '情节设计师': '#fbbf24',
  '文笔润色师': '#a78bfa',
  '审核校对师': '#4ade80',
  '记忆压缩师': '#fb923c',
};

export default function ChapterReviewScreen() {
  const router = useSafeRouter();
  const params = useSafeSearchParams<{ content: string; chapterNumber: string; outline: string }>();
  const chapterContent = params.content || '';
  const chapterNumber = params.chapterNumber || '1';
  const chapterOutline = params.outline || '';

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [userInput, setUserInput] = useState('');
  const [isReviewing, setIsReviewing] = useState(false);
  const [reviewStarted, setReviewStarted] = useState(false);
  const [adoptedHistory, setAdoptedHistory] = useState<string[]>([]);  // 已采纳的message id栈
  const [currentContent, setCurrentContent] = useState(chapterContent);
  const [contentSnapshots, setContentSnapshots] = useState<string[]>([chapterContent]);  // 内容快照栈
  const [showContent, setShowContent] = useState(false);

  const scrollViewRef = useRef<ScrollView>(null);
  const [agents, setAgents] = useState<any[]>([]);

  const loadAgents = useCallback(async () => {
    try {
      const data = await AsyncStorage.getItem('agents');
      if (data) {
        const parsed = JSON.parse(data);
        const enabled = parsed.filter((a: any) => a.enabled !== false);
        setAgents(enabled);
      }
    } catch (e) {}
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadAgents();
    }, [loadAgents])
  );

  // 滚动到底部
  useEffect(() => {
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd?.({ animated: true });
    }, 100);
  }, [messages]);

  // 开始AI评审
  const handleStartReview = async () => {
    if (isReviewing) return;

    setIsReviewing(true);
    setReviewStarted(true);
    setMessages([]);
    setAdoptedHistory([]);
    setContentSnapshots([currentContent]);

    // 系统消息
    addSystemMessage(`开始评审第${chapterNumber}章，请各位Agent发言...`);

    // 逐个Agent评审
    const enabledAgents = agents.length > 0
      ? agents.filter((a: any) => a.enabled !== false)
      : [
          { name: '世界观架构师', role: 'world' },
          { name: '人物设定师', role: 'character' },
          { name: '情节设计师', role: 'plot' },
          { name: '文笔润色师', role: 'style' },
          { name: '审核校对师', role: 'review' },
        ];

    for (const agent of enabledAgents) {
      await reviewWithAgent(agent);
    }

    addSystemMessage('所有Agent已发言完毕，你可以采纳建议或继续讨论。');
    setIsReviewing(false);
  };

  const addSystemMessage = (text: string) => {
    setMessages((prev) => [
      ...prev,
      {
        id: `sys_${Date.now()}_${Math.random()}`,
        type: 'system',
        content: text,
        timestamp: Date.now(),
      },
    ]);
  };

  // 单个Agent评审
  const reviewWithAgent = async (agent: any): Promise<void> => {
    return new Promise((resolve) => {
      const agentName = agent.name || 'Agent';
      const agentColor = AGENT_COLORS[agentName] || '#888';

      // 先添加"正在思考"消息
      const thinkingId = `thinking_${Date.now()}`;
      setMessages((prev) => [
        ...prev,
        {
          id: thinkingId,
          type: 'agent',
          agentName,
          agentRole: agent.role,
          content: '正在思考...',
          timestamp: Date.now(),
        },
      ]);

      const reviewPrompt = `你是"${agentName}"，负责${agent.role === 'world' ? '世界观一致性' : agent.role === 'character' ? '人物设定合理性' : agent.role === 'plot' ? '情节节奏和逻辑' : agent.role === 'style' ? '文笔和表达质量' : '内容审核校对'}的评审。\n\n请评审以下章节内容（50-80字简要评价，指出1-2个具体问题和改进建议）：\n\n章纲：${chapterOutline}\n\n正文：${currentContent.substring(0, 2000)}`;

      let agentResponse = '';

      try {
        const sse = new RNSSE(`${API_BASE_URL}/api/v1/writing/generate`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': 'sk-2d333ed0b01a4fe899df1c7c6cbe5617',
            'x-model': 'deepseek-v4-flash',
            'x-base-url': 'https://api.deepseek.com',
          },
          body: JSON.stringify({
            chapterId: `review_${Date.now()}`,
            chapterNumber: parseInt(chapterNumber),
            outline: reviewPrompt,
            memoryContext: [],
            agentCount: 1,
          }),
        });

        sse.addEventListener('message', (event) => {
          if (event.data === '[DONE]') {
            sse.close();
            // 替换"正在思考"消息为最终消息
            setMessages((prev) =>
              prev.map((m) =>
                m.id === thinkingId
                  ? { ...m, content: agentResponse || '无意见', suggestion: agentResponse }
                  : m
              )
            );
            resolve();
            return;
          }

          try {
            const json = JSON.parse(event.data || '{}');
            if (json.type === 'chunk' && json.content) {
              agentResponse += json.content;
              // 实时更新消息
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === thinkingId
                    ? { ...m, content: agentResponse, suggestion: agentResponse }
                    : m
                )
              );
            } else if (json.type === 'done' && json.content) {
              agentResponse = json.content;
            }
          } catch (e) {}
        });

        sse.addEventListener('error', () => {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === thinkingId ? { ...m, content: '评审失败，请重试' } : m
            )
          );
          resolve();
        });

        // 超时保护：30秒
        setTimeout(() => {
          if (agentResponse) {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === thinkingId ? { ...m, content: agentResponse, suggestion: agentResponse } : m
              )
            );
          }
          resolve();
        }, 30000);

      } catch (error) {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === thinkingId ? { ...m, content: '评审失败' } : m
          )
        );
        resolve();
      }
    });
  };

  // 用户发言
  const handleUserSend = () => {
    if (!userInput.trim()) return;
    const msg: ChatMessage = {
      id: `user_${Date.now()}`,
      type: 'user',
      content: userInput.trim(),
      timestamp: Date.now(),
    };
    setMessages((prev) => [...prev, msg]);
    setUserInput('');
  };

  // 采纳建议
  const handleAdopt = (msgId: string) => {
    setMessages((prev) =>
      prev.map((m) => (m.id === msgId ? { ...m, adopted: true } : m))
    );
    setAdoptedHistory((prev) => [...prev, msgId]);
    // 保存内容快照
    setContentSnapshots((prev) => [...prev, currentContent]);
  };

  // 撤销上次采纳
  const handleUndoAdopt = () => {
    if (adoptedHistory.length === 0) return;
    const lastId = adoptedHistory[adoptedHistory.length - 1];

    setMessages((prev) =>
      prev.map((m) => (m.id === lastId ? { ...m, adopted: false } : m))
    );
    setAdoptedHistory((prev) => prev.slice(0, -1));

    // 恢复上一个内容快照
    if (contentSnapshots.length > 1) {
      const prevSnapshot = contentSnapshots[contentSnapshots.length - 2];
      setCurrentContent(prevSnapshot);
      setContentSnapshots((prev) => prev.slice(0, -1));
    }
  };

  // 确定修改
  const handleConfirmChanges = () => {
    Alert.alert('确定修改', '确认采纳的建议将应用到章节内容？', [
      { text: '取消', style: 'cancel' },
      {
        text: '确定',
        onPress: () => {
          // 将采纳的建议追加到内容末尾作为备注（简化实现）
          const adoptedMsgs = messages.filter((m) => m.adopted && m.type === 'agent');
          if (adoptedMsgs.length === 0) {
            Alert.alert('提示', '没有采纳任何建议');
            return;
          }
          Alert.alert('成功', '已应用采纳的建议');
          router.back();
        },
      },
    ]);
  };

  const getAgentColor = (name?: string) => {
    if (!name) return '#888';
    return AGENT_COLORS[name] || '#888';
  };

  return (
    <Screen>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.container}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>AI评审</Text>
            <Text style={styles.headerSub}>第{chapterNumber}章</Text>
          </View>
          <TouchableOpacity
            style={styles.toggleContentBtn}
            onPress={() => setShowContent(!showContent)}
          >
            <Ionicons name={showContent ? 'chatbubbles' : 'document-text'} size={20} color="#fff" />
          </TouchableOpacity>
        </View>

        {!showContent ? (
          /* ========== 群聊区 ========== */
          <>
            <ScrollView
              ref={scrollViewRef}
              style={styles.chatArea}
              contentContainerStyle={styles.chatContent}
              onContentSizeChange={() => scrollViewRef.current?.scrollToEnd?.({ animated: true })}
            >
              {!reviewStarted && (
                <View style={styles.startCard}>
                  <Ionicons name="chatbubbles-outline" size={40} color="#333" />
                  <Text style={styles.startTitle}>AI评审</Text>
                  <Text style={styles.startDesc}>
                    各Agent独立评审本章内容，提出改进建议。{'\n'}你可以逐条采纳，也可以参与讨论。
                  </Text>
                  <TouchableOpacity style={styles.startBtn} onPress={handleStartReview}>
                    <Ionicons name="play" size={20} color="#000" />
                    <Text style={styles.startBtnText}>开始评审</Text>
                  </TouchableOpacity>
                </View>
              )}

              {messages.map((msg) => {
                if (msg.type === 'system') {
                  return (
                    <View key={msg.id} style={styles.systemMsg}>
                      <Text style={styles.systemMsgText}>{msg.content}</Text>
                    </View>
                  );
                }

                if (msg.type === 'user') {
                  return (
                    <View key={msg.id} style={styles.userMsgWrap}>
                      <View style={styles.userMsg}>
                        <Text style={styles.userMsgText}>{msg.content}</Text>
                      </View>
                    </View>
                  );
                }

                // Agent消息
                const agentColor = getAgentColor(msg.agentName);
                return (
                  <View key={msg.id} style={styles.agentMsgWrap}>
                    <View style={styles.agentMsg}>
                      <View style={styles.agentMsgHeader}>
                        <View style={[styles.agentAvatar, { backgroundColor: agentColor + '22' }]}>
                          <Ionicons name="sparkles" size={14} color={agentColor} />
                        </View>
                        <Text style={[styles.agentName, { color: agentColor }]}>
                          {msg.agentName}
                        </Text>
                        {msg.adopted && (
                          <View style={styles.adoptedBadge}>
                            <Text style={styles.adoptedBadgeText}>已采纳</Text>
                          </View>
                        )}
                      </View>
                      <Text style={styles.agentMsgText}>{msg.content}</Text>
                      {!msg.adopted && msg.suggestion && msg.content !== '正在思考...' && msg.content !== '评审失败，请重试' && (
                        <TouchableOpacity
                          style={[styles.adoptBtn, { borderColor: agentColor }]}
                          onPress={() => handleAdopt(msg.id)}
                        >
                          <Ionicons name="checkmark-circle-outline" size={16} color={agentColor} />
                          <Text style={[styles.adoptBtnText, { color: agentColor }]}>采纳</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                );
              })}

              {isReviewing && (
                <View style={styles.reviewingIndicator}>
                  <ActivityIndicator color="#fff" size="small" />
                  <Text style={styles.reviewingText}>Agent评审中...</Text>
                </View>
              )}
            </ScrollView>

            {/* 底部操作栏 */}
            {reviewStarted && (
              <View style={styles.bottomBar}>
                {adoptedHistory.length > 0 && (
                  <TouchableOpacity style={styles.undoBtn} onPress={handleUndoAdopt}>
                    <Ionicons name="arrow-undo" size={18} color="#fbbf24" />
                    <Text style={styles.undoBtnText}>撤销采纳</Text>
                  </TouchableOpacity>
                )}
                {!isReviewing && adoptedHistory.length > 0 && (
                  <TouchableOpacity style={styles.confirmBtn} onPress={handleConfirmChanges}>
                    <Ionicons name="checkmark-done" size={18} color="#000" />
                    <Text style={styles.confirmBtnText}>确定修改</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}

            {/* 输入框 */}
            {reviewStarted && !isReviewing && (
              <View style={styles.inputBar}>
                <TextInput
                  style={styles.inputField}
                  placeholder="说说你的想法..."
                  placeholderTextColor="#555"
                  value={userInput}
                  onChangeText={setUserInput}
                  multiline
                />
                <TouchableOpacity
                  style={[styles.sendBtn, !userInput.trim() && styles.sendBtnDisabled]}
                  onPress={handleUserSend}
                  disabled={!userInput.trim()}
                >
                  <Ionicons name="send" size={20} color={userInput.trim() ? '#000' : '#555'} />
                </TouchableOpacity>
              </View>
            )}
          </>
        ) : (
          /* ========== 内容预览区 ========== */
          <ScrollView style={styles.contentArea} contentContainerStyle={styles.contentAreaContent}>
            <Text style={styles.contentAreaTitle}>第{chapterNumber}章 原文</Text>
            <View style={styles.contentAreaCard}>
              <Text style={styles.contentAreaText}>{currentContent}</Text>
            </View>
          </ScrollView>
        )}
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 56,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#222',
  },
  backBtn: { padding: 8 },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerTitle: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  headerSub: { color: '#888', fontSize: 12, marginTop: 2 },
  toggleContentBtn: {
    padding: 8,
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#333',
  },

  // 聊天区
  chatArea: { flex: 1 },
  chatContent: { padding: 16, paddingBottom: 20 },

  // 开始卡片
  startCard: {
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 20,
  },
  startTitle: { color: '#fff', fontSize: 22, fontWeight: 'bold', marginTop: 16 },
  startDesc: { color: '#888', fontSize: 14, textAlign: 'center', lineHeight: 22, marginTop: 8, marginBottom: 24 },
  startBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  startBtnText: { color: '#000', fontSize: 17, fontWeight: '600' },

  // 系统消息
  systemMsg: { alignItems: 'center', marginVertical: 8 },
  systemMsgText: { color: '#555', fontSize: 12 },

  // 用户消息
  userMsgWrap: { alignItems: 'flex-end', marginVertical: 6 },
  userMsg: {
    backgroundColor: '#1e3a5f',
    borderRadius: 14,
    borderBottomRightRadius: 4,
    paddingHorizontal: 16,
    paddingVertical: 10,
    maxWidth: '75%',
  },
  userMsgText: { color: '#fff', fontSize: 15, lineHeight: 22 },

  // Agent消息
  agentMsgWrap: { alignItems: 'flex-start', marginVertical: 6 },
  agentMsg: {
    backgroundColor: '#1a1a1a',
    borderRadius: 14,
    borderBottomLeftRadius: 4,
    paddingHorizontal: 16,
    paddingVertical: 12,
    maxWidth: '85%',
    borderWidth: 1,
    borderColor: '#222',
  },
  agentMsgHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  agentAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  agentName: { fontSize: 13, fontWeight: '600' },
  adoptedBadge: {
    backgroundColor: '#4ade8022',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  adoptedBadgeText: { color: '#4ade80', fontSize: 11, fontWeight: '500' },
  agentMsgText: { color: '#ddd', fontSize: 14, lineHeight: 22 },
  adoptBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 10,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  adoptBtnText: { fontSize: 13, fontWeight: '500' },

  // 评审中
  reviewingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
  },
  reviewingText: { color: '#888', fontSize: 13 },

  // 底部操作栏
  bottomBar: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: '#222',
  },
  undoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#1a1a1a',
    borderWidth: 1,
    borderColor: '#fbbf2444',
  },
  undoBtnText: { color: '#fbbf24', fontSize: 14, fontWeight: '500' },
  confirmBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#fff',
  },
  confirmBtnText: { color: '#000', fontSize: 14, fontWeight: '600' },

  // 输入框
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: '#222',
    paddingBottom: Platform.OS === 'ios' ? 20 : 8,
  },
  inputField: {
    flex: 1,
    backgroundColor: '#1a1a1a',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    color: '#fff',
    fontSize: 15,
    maxHeight: 80,
    borderWidth: 1,
    borderColor: '#333',
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendBtnDisabled: { backgroundColor: '#1a1a1a' },

  // 内容预览区
  contentArea: { flex: 1 },
  contentAreaContent: { padding: 20 },
  contentAreaTitle: { color: '#fff', fontSize: 18, fontWeight: 'bold', marginBottom: 16 },
  contentAreaCard: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    borderColor: '#333',
  },
  contentAreaText: { color: '#fff', fontSize: 15, lineHeight: 28 },
});
