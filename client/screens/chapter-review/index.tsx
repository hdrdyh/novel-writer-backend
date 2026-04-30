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
  suggestion?: string;
  adopted?: boolean;
  timestamp: number;
}

interface Agent {
  id: string;
  name: string;
  role: string;
  prompt: string;
  enabled: boolean;
  order: number;
  apiId?: string;
}

interface ReviewConfig {
  focusDirection: string;
  rounds: number;
  maxWords: number;
}

interface ApiConfig {
  id: string;
  name: string;
  apiKey: string;
  baseUrl: string;
  model: string;
}

const AGENT_COLORS: Record<string, string> = {
  '世界观架构师': '#60a5fa',
  '人物设定师': '#f472b6',
  '情节设计师': '#fbbf24',
  '文笔润色师': '#a78bfa',
  '审核校对师': '#4ade80',
  '记忆压缩师': '#fb923c',
  '逻辑审查员': '#60a5fa',
  '节奏分析师': '#fbbf24',
  '读者视角': '#f472b6',
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
  const [adoptedHistory, setAdoptedHistory] = useState<string[]>([]);
  const [currentContent, setCurrentContent] = useState(chapterContent);
  const [contentSnapshots, setContentSnapshots] = useState<string[]>([chapterContent]);
  const [showContent, setShowContent] = useState(false);

  const scrollViewRef = useRef<ScrollView>(null);

  // 从本地读取配置
  const [reviewConfig, setReviewConfig] = useState<ReviewConfig>({
    focusDirection: '',
    rounds: 1,
    maxWords: 80,
  });
  const [apiConfigs, setApiConfigs] = useState<ApiConfig[]>([]);
  const [defaultApi, setDefaultApi] = useState<{ apiKey: string; baseUrl: string; model: string }>({
    apiKey: '',
    baseUrl: '',
    model: '',
  });

  // 评审团Agent列表（从本地存储读取）
  const [reviewAgents, setReviewAgents] = useState<Agent[]>([]);

  const loadConfig = useCallback(async () => {
    try {
      const [reviewData, apiData, reviewTeamData] = await Promise.all([
        AsyncStorage.getItem('reviewConfig'),
        AsyncStorage.getItem('apiConfigs'),
        AsyncStorage.getItem('reviewTeamConfigs'),
      ]);
      if (reviewData) {
        const parsed = JSON.parse(reviewData);
        setReviewConfig({
          focusDirection: parsed.focusDirection || '',
          rounds: parsed.rounds || 1,
          maxWords: parsed.maxWords || 80,
        });
      }
      if (apiData) {
        const parsed: ApiConfig[] = JSON.parse(apiData);
        setApiConfigs(parsed);
        if (parsed.length > 0) {
          setDefaultApi({ apiKey: parsed[0].apiKey, baseUrl: parsed[0].baseUrl, model: parsed[0].model });
        }
      }
      if (reviewTeamData) {
        setReviewAgents(JSON.parse(reviewTeamData));
      }
    } catch (e) {}
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadConfig();
    }, [loadConfig])
  );

  // 滚动到底部
  useEffect(() => {
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd?.({ animated: true });
    }, 100);
  }, [messages]);

  // 获取参与评审的Agent（只使用评审团中已启用的）
  const getReviewAgents = () => {
    return reviewAgents.filter((a) => a.enabled);
  };

  const addSystemMessage = (text: string) => {
    setMessages((prev) => [
      ...prev,
      {
        id: `sys_${new Date().getTime()}_${Math.random()}`,
        type: 'system',
        content: text,
        timestamp: new Date().getTime(),
      },
    ]);
  };

  // 通用LLM调用（SSE流式，走后端/api/v1/llm/chat代理）
  const callLLM = (agent: any, systemPrompt: string, userPrompt: string, thinkingId: string): Promise<void> => {
    return new Promise((resolve) => {
      let useApiKey = defaultApi.apiKey;
      let useBaseUrl = defaultApi.baseUrl;
      let useModel = defaultApi.model;
      if (agent.apiId) {
        const cfg = apiConfigs.find((c) => c.id === agent.apiId);
        if (cfg) {
          useApiKey = cfg.apiKey;
          useBaseUrl = cfg.baseUrl;
          useModel = cfg.model;
        }
      }

      let agentResponse = '';

      // 确保 baseUrl 末尾无斜杠，拼接 /v1/chat/completions
      const base = useBaseUrl.replace(/\/+$/, '');
      const endpoint = base.endsWith('/v1') ? `${base}/chat/completions` : `${base}/v1/chat/completions`;

      try {
        // 直接调外部LLM API，SSE流式，标准OpenAI格式
        const sse = new RNSSE(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${useApiKey}`,
          },
          body: JSON.stringify({
            model: useModel,
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: userPrompt },
            ],
            stream: true,
            temperature: 0.7,
            max_tokens: 1024,
          }),
        });

        sse.addEventListener('message', (event) => {
          if (event.data === '[DONE]') {
            sse.close();
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
            const content = json.choices?.[0]?.delta?.content;
            if (content) {
              agentResponse += content;
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === thinkingId
                    ? { ...m, content: agentResponse, suggestion: agentResponse }
                    : m
                )
              );
            }
          } catch (e) {}
        });

        sse.addEventListener('error', () => {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === thinkingId ? { ...m, content: '评审失败，请检查API配置和网络' } : m
            )
          );
          resolve();
        });

        setTimeout(() => {
          sse.close();
          if (agentResponse) {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === thinkingId ? { ...m, content: agentResponse, suggestion: agentResponse } : m
              )
            );
          } else {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === thinkingId ? { ...m, content: '回复超时' } : m
              )
            );
          }
          resolve();
        }, 60000);

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

  // 单个Agent评审
  const reviewWithAgent = async (agent: any): Promise<void> => {
    const agentName = agent.name || 'Agent';

    const thinkingId = `thinking_${new Date().getTime()}_${Math.random()}`;
    setMessages((prev) => [
      ...prev,
      {
        id: thinkingId,
        type: 'agent',
        agentName,
        agentRole: agent.role,
        content: '正在思考...',
        timestamp: new Date().getTime(),
      },
    ]);

    const focusText = reviewConfig.focusDirection ? `\n\n评审重点：${reviewConfig.focusDirection}` : '';
    const systemPrompt = `你是"${agentName}"，一位专业的小说章节评审员。${agent.prompt || ''}\n\n你的职责是评审小说章节，给出简洁的评审意见和改进建议。字数控制在${reviewConfig.maxWords}字以内。不要生成新的章节内容，只做评审。`;
    const userPrompt = `请评审以下章节内容：\n\n章纲：${chapterOutline}\n\n正文：${currentContent.substring(0, 2000)}${focusText}\n\n请指出1-2个具体问题和改进建议。`;

    await callLLM(agent, systemPrompt, userPrompt, thinkingId);
  };

  // 开始AI评审
  const handleStartReview = async () => {
    if (isReviewing) return;

    // 检查API配置
    if (apiConfigs.length === 0) {
      Alert.alert('未配置API', '请先在写作流水线中添加API配置');
      return;
    }

    const activeReviewAgents = getReviewAgents();
    if (activeReviewAgents.length === 0) {
      Alert.alert('提示', '没有可用的评审Agent，请先在写作流水线的评审团中启用Agent');
      return;
    }

    setIsReviewing(true);
    setReviewStarted(true);
    setMessages([]);
    setAdoptedHistory([]);
    setContentSnapshots([currentContent]);

    addSystemMessage(`开始评审第${chapterNumber}章（${activeReviewAgents.length}位Agent参与）...`);

    for (const agent of activeReviewAgents) {
      await reviewWithAgent(agent);
    }

    addSystemMessage('所有Agent已发言完毕，你可以采纳建议或继续讨论。');
    setIsReviewing(false);
  };

  // 用户发言 + 触发AI回复讨论
  const handleUserSend = () => {
    if (!userInput.trim() || isReviewing) return;
    const msg: ChatMessage = {
      id: `user_${new Date().getTime()}`,
      type: 'user',
      content: userInput.trim(),
      timestamp: new Date().getTime(),
    };
    setMessages((prev) => [...prev, msg]);
    const userText = userInput.trim();
    setUserInput('');

    // 触发一个Agent回复用户的发言
    discussWithAgent(userText);
  };

  // 用户讨论后，让一个Agent回复
  const discussWithAgent = async (userText: string) => {
    const activeReviewAgents = getReviewAgents();
    if (activeReviewAgents.length === 0) return;

    // 轮流选一个Agent回复
    const agentIndex = messages.filter((m) => m.type === 'agent' && m.content !== '正在思考...').length % activeReviewAgents.length;
    const agent = activeReviewAgents[agentIndex];
    const agentName = agent.name || 'Agent';

    const thinkingId = `discuss_${new Date().getTime()}_${Math.random()}`;
    setMessages((prev) => [
      ...prev,
      {
        id: thinkingId,
        type: 'agent',
        agentName,
        agentRole: agent.role,
        content: '正在思考...',
        timestamp: new Date().getTime(),
      },
    ]);

    const systemPrompt = `你是"${agentName}"，一位专业的小说章节评审员。${agent.prompt || ''}\n\n你正在参与章节评审的群聊讨论。字数控制在${reviewConfig.maxWords}字以内，简洁直接。`;
    const userPrompt = `作者说："${userText}"\n\n请基于章节内容回应作者的想法：\n\n章纲：${chapterOutline}\n\n正文：${currentContent.substring(0, 1500)}`;

    await callLLM(agent, systemPrompt, userPrompt, thinkingId);
  };

  // 采纳建议
  const handleAdopt = (msgId: string) => {
    setMessages((prev) =>
      prev.map((m) => (m.id === msgId ? { ...m, adopted: true } : m))
    );
    setAdoptedHistory((prev) => [...prev, msgId]);
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

    if (contentSnapshots.length > 1) {
      const prevSnapshot = contentSnapshots[contentSnapshots.length - 2];
      setCurrentContent(prevSnapshot);
      setContentSnapshots((prev) => prev.slice(0, -1));
    }
  };

  // 确定修改
  const handleConfirmChanges = () => {
    const adoptedMsgs = messages.filter((m) => m.adopted && m.type === 'agent');
    if (adoptedMsgs.length === 0) {
      Alert.alert('提示', '没有采纳任何建议，请先采纳至少一条建议');
      return;
    }
    Alert.alert('确定修改', '确认采纳的建议将应用到章节内容？', [
      { text: '取消', style: 'cancel' },
      {
        text: '确定',
        onPress: () => {
          // 把采纳的建议合并到内容中
          const suggestions = adoptedMsgs.map((m) => `[${m.agentName}的建议] ${m.suggestion}`).join('\n\n');
          const updatedContent = currentContent + '\n\n--- 评审建议 ---\n' + suggestions;
          setCurrentContent(updatedContent);
          Alert.alert('成功', '已应用采纳的建议到章节内容');
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
                  {reviewConfig.focusDirection ? (
                    <Text style={styles.focusHint}>评审重点：{reviewConfig.focusDirection}</Text>
                  ) : null}
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
                      {!msg.adopted && msg.suggestion && msg.content !== '正在思考...' && msg.content !== '评审失败，请检查API配置' && !msg.content.startsWith('回复') && !msg.content.startsWith('讨论') && (
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
                {!isReviewing && messages.length > 0 && (
                  <TouchableOpacity style={styles.regenerateBtn} onPress={handleStartReview}>
                    <Ionicons name="refresh" size={18} color="#60a5fa" />
                    <Text style={styles.regenerateBtnText}>重新评审</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}

            {/* 输入框 */}
            {reviewStarted && !isReviewing && (
              <View style={styles.inputBar}>
                <TextInput
                  style={styles.inputField}
                  placeholder="说说你的想法，Agent会回复你..."
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
  focusHint: {
    color: '#fbbf24',
    fontSize: 13,
    marginTop: 4,
    marginBottom: 12,
    textAlign: 'center',
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
  regenerateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#1a1a1a',
    borderWidth: 1,
    borderColor: '#60a5fa44',
  },
  regenerateBtnText: { color: '#60a5fa', fontSize: 14, fontWeight: '500' },
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
