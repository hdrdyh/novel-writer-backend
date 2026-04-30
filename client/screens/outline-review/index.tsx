import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useSafeRouter, useSafeSearchParams } from '@/hooks/useSafeRouter';
import { Screen } from '@/components/Screen';
import { Feather, Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import RNSSE from 'react-native-sse';

const API_BASE_URL = process.env.EXPO_PUBLIC_BACKEND_BASE_URL || 'http://localhost:9091';

interface Agent {
  id: string;
  name: string;
  role: string;
  prompt: string;
  enabled: boolean;
  order: number;
  apiId?: string;
}

interface ApiConfig {
  id: string;
  name: string;
  apiKey: string;
  baseUrl: string;
  model: string;
}

interface ReviewConfig {
  focusDirection: string;
  rounds: number;
  maxWords: number;
}

interface ChatMessage {
  id: string;
  sender: 'user' | 'agent' | 'system';
  senderName: string;
  content: string;
  agentRole?: string;
  adopted?: boolean;
  suggestion?: string;
}

const STAGE_NAMES: Record<string, string> = {
  outline: '大纲',
  rough: '粗纲',
  detail: '细纲',
};

const AGENT_COLORS: Record<string, string> = {
  '逻辑审查员': '#60a5fa',
  '节奏分析师': '#fbbf24',
  '读者视角': '#f472b6',
  '世界观架构师': '#60a5fa',
  '人物设定师': '#f472b6',
  '情节设计师': '#fbbf24',
  '文笔润色师': '#a78bfa',
  '审核校对师': '#4ade80',
};

export default function OutlineReviewScreen() {
  const router = useSafeRouter();
  const params = useSafeSearchParams<{ content: string; stage: string }>();
  const stageName = STAGE_NAMES[params.stage] || '大纲';

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const [adoptedIds, setAdoptedIds] = useState<string[]>([]);
  const [adoptHistory, setAdoptHistory] = useState<string[]>([]);
  const [showPreview, setShowPreview] = useState(false);

  const scrollViewRef = useRef<ScrollView>(null);

  // 配置数据
  const [reviewAgents, setReviewAgents] = useState<Agent[]>([]);
  const [apiConfigs, setApiConfigs] = useState<ApiConfig[]>([]);
  const [defaultApi, setDefaultApi] = useState<{ apiKey: string; baseUrl: string; model: string }>({
    apiKey: '',
    baseUrl: '',
    model: '',
  });
  const [reviewConfig, setReviewConfig] = useState<ReviewConfig>({
    focusDirection: '',
    rounds: 1,
    maxWords: 80,
  });

  const loadConfig = useCallback(async () => {
    try {
      const [reviewTeamData, apiData, reviewData] = await Promise.all([
        AsyncStorage.getItem('reviewTeamConfigs'),
        AsyncStorage.getItem('apiConfigs'),
        AsyncStorage.getItem('reviewConfig'),
      ]);
      if (reviewTeamData) setReviewAgents(JSON.parse(reviewTeamData));
      if (apiData) {
        const parsed: ApiConfig[] = JSON.parse(apiData);
        setApiConfigs(parsed);
        if (parsed.length > 0) {
          setDefaultApi({ apiKey: parsed[0].apiKey, baseUrl: parsed[0].baseUrl, model: parsed[0].model });
        }
      }
      if (reviewData) {
        const parsed = JSON.parse(reviewData);
        setReviewConfig({
          focusDirection: parsed.focusDirection || '',
          rounds: parsed.rounds || 1,
          maxWords: parsed.maxWords || 80,
        });
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

  // 获取启用的评审Agent
  const getEnabledReviewAgents = () => {
    return reviewAgents.filter((a) => a.enabled);
  };

  // 确定用哪个API
  const getApiForAgent = (agent: Agent) => {
    if (agent.apiId) {
      const cfg = apiConfigs.find((c) => c.id === agent.apiId);
      if (cfg) return { apiKey: cfg.apiKey, baseUrl: cfg.baseUrl, model: cfg.model };
    }
    return defaultApi;
  };

  const addSystemMessage = (text: string) => {
    setMessages((prev) => [
      ...prev,
      {
        id: `sys_${new Date().getTime()}_${Math.random()}`,
        sender: 'system',
        senderName: '系统',
        content: text,
      },
    ]);
  };

  // 单个Agent评审（SSE流式）
  const reviewWithAgent = async (agent: Agent): Promise<void> => {
    return new Promise((resolve) => {
      const agentName = agent.name || 'Agent';
      const thinkingId = `thinking_${new Date().getTime()}`;
      setMessages((prev) => [
        ...prev,
        {
          id: thinkingId,
          sender: 'agent',
          senderName: agentName,
          content: '正在思考...',
          agentRole: agent.role,
        },
      ]);

      const focusText = reviewConfig.focusDirection ? `\n\n评审重点：${reviewConfig.focusDirection}` : '';
      const reviewPrompt = `你是"${agentName}"。${agent.prompt || ''}\n\n你正在评审一份小说${stageName}。请用${reviewConfig.maxWords}字以内给出你的评审意见和改进建议。简洁直接。\n\n以下是需要评审的${stageName}内容：\n${params.content}${focusText}`;

      let agentResponse = '';
      const api = getApiForAgent(agent);

      try {
        const sse = new RNSSE(`${API_BASE_URL}/api/v1/writing/generate`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': api.apiKey,
            'x-model': api.model,
            'x-base-url': api.baseUrl,
          },
          body: JSON.stringify({
            chapterId: `outline_review_${new Date().getTime()}`,
            chapterNumber: 1,
            outline: reviewPrompt,
            memoryContext: [],
            agentCount: 1,
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
            if (json.type === 'chunk' && json.content) {
              agentResponse += json.content;
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
              m.id === thinkingId ? { ...m, content: '评审失败，请检查API配置' } : m
            )
          );
          resolve();
        });

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

  // 开始AI评审（使用SSE流式）
  const handleStartReview = async () => {
    const agents = getEnabledReviewAgents();
    if (agents.length === 0) {
      Alert.alert('提示', '请先在写作流水线的评审团中启用Agent');
      return;
    }
    if (apiConfigs.length === 0) {
      Alert.alert('提示', '请先在写作流水线中配置API');
      return;
    }

    setLoading(true);
    setMessages([]);
    setAdoptedIds([]);
    setAdoptHistory([]);

    addSystemMessage(`开始${stageName}评审（${agents.length}位Agent参与）...`);

    for (const agent of agents) {
      await reviewWithAgent(agent);
    }

    addSystemMessage('所有Agent已发言完毕，你可以采纳建议或继续讨论。');
    setLoading(false);
  };

  // 用户发言
  const handleSend = async () => {
    if (!inputText.trim() || loading) return;

    const userMsg: ChatMessage = {
      id: `user_${new Date().getTime()}`,
      sender: 'user',
      senderName: '你',
      content: inputText.trim(),
    };
    setMessages(prev => [...prev, userMsg]);
    const userText = inputText.trim();
    setInputText('');

    // 触发一个Agent回复
    const agents = getEnabledReviewAgents();
    if (agents.length === 0) return;

    const agentIndex = messages.filter((m) => m.sender === 'agent' && m.content !== '正在思考...').length % agents.length;
    const agent = agents[agentIndex];
    const agentName = agent.name || 'Agent';

    const thinkingId = `discuss_${new Date().getTime()}`;
    setMessages(prev => [
      ...prev,
      { id: thinkingId, sender: 'agent', senderName: agentName, content: '正在思考...', agentRole: agent.role },
    ]);

    const discussPrompt = `你是"${agentName}"。${agent.prompt || ''}\n\n你正在参与${stageName}的群聊讨论。作者说："${userText}"\n\n用${reviewConfig.maxWords}字以内回复，简洁直接，给出你的看法或建议。`;
    let agentResponse = '';
    const api = getApiForAgent(agent);

    setLoading(true);
    try {
      const sse = new RNSSE(`${API_BASE_URL}/api/v1/writing/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': api.apiKey,
          'x-model': api.model,
          'x-base-url': api.baseUrl,
        },
        body: JSON.stringify({
          chapterId: `discuss_${new Date().getTime()}`,
          chapterNumber: 1,
          outline: discussPrompt,
          memoryContext: [],
          agentCount: 1,
        }),
      });

      sse.addEventListener('message', (event) => {
        if (event.data === '[DONE]') {
          sse.close();
          setMessages(prev =>
            prev.map(m => m.id === thinkingId ? { ...m, content: agentResponse || '暂无回应', suggestion: agentResponse } : m)
          );
          return;
        }
        try {
          const json = JSON.parse(event.data || '{}');
          if (json.type === 'chunk' && json.content) {
            agentResponse += json.content;
            setMessages(prev =>
              prev.map(m => m.id === thinkingId ? { ...m, content: agentResponse, suggestion: agentResponse } : m)
            );
          }
        } catch (e) {}
      });

      sse.addEventListener('error', () => {
        setMessages(prev => prev.map(m => m.id === thinkingId ? { ...m, content: '回复失败' } : m));
      });

      setTimeout(() => {
        setMessages(prev =>
          prev.map(m => m.id === thinkingId ? { ...m, content: agentResponse || '回复超时', suggestion: agentResponse } : m)
        );
      }, 20000);
    } catch (e) {
      setMessages(prev => prev.map(m => m.id === thinkingId ? { ...m, content: '回复失败' } : m));
    }
    setLoading(false);
  };

  // 采纳
  const handleAdopt = useCallback((msgId: string) => {
    setAdoptedIds(prev => [...prev, msgId]);
    setAdoptHistory(prev => [...prev, msgId]);
  }, []);

  // 撤销采纳
  const handleUndo = useCallback(() => {
    if (adoptHistory.length === 0) return;
    const lastId = adoptHistory[adoptHistory.length - 1];
    setAdoptedIds(prev => prev.filter(id => id !== lastId));
    setAdoptHistory(prev => prev.slice(0, -1));
  }, [adoptHistory]);

  // 确定修改
  const handleConfirm = useCallback(() => {
    const adopted = messages.filter(m => adoptedIds.includes(m.id));
    AsyncStorage.setItem('outline_review_adopted', JSON.stringify({
      stage: params.stage,
      suggestions: adopted.map(m => ({ name: m.senderName, content: m.content })),
      timestamp: new Date().getTime(),
    }));
    Alert.alert('已保存', '评审建议已保存，返回大纲页可查看', [
      { text: '好的', onPress: () => router.back() },
    ]);
  }, [messages, adoptedIds, params.stage, router]);

  return (
    <Screen style={styles.screen}>
      {/* 顶栏 */}
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="arrow-left" size={22} color="#fff" />
        </Pressable>
        <Text style={styles.topTitle}>{stageName}评审</Text>
        <Pressable onPress={() => setShowPreview(!showPreview)} style={styles.previewToggle}>
          <Feather name={showPreview ? 'message-circle' : 'eye'} size={18} color="#888" />
        </Pressable>
      </View>

      {showPreview ? (
        <ScrollView style={styles.previewArea} contentContainerStyle={styles.previewContent}>
          <Text style={styles.previewLabel}>原文内容</Text>
          <Text style={styles.previewText}>{params.content}</Text>
        </ScrollView>
      ) : (
        <>
          {/* 聊天区 */}
          <ScrollView
            ref={scrollViewRef}
            style={styles.chatArea}
            contentContainerStyle={styles.chatContent}
            onContentSizeChange={() => scrollViewRef.current?.scrollToEnd?.({ animated: true })}
          >
            {messages.length === 0 && !loading && (
              <View style={styles.emptyState}>
                <Feather name="message-circle" size={48} color="#555" />
                <Text style={styles.emptyText}>点击下方按钮开始AI评审</Text>
                {reviewConfig.focusDirection ? (
                  <Text style={styles.focusHint}>评审重点：{reviewConfig.focusDirection}</Text>
                ) : null}
              </View>
            )}
            {messages.map(msg => {
              if (msg.sender === 'system') {
                return (
                  <View key={msg.id} style={styles.systemMsg}>
                    <Text style={styles.systemMsgText}>{msg.content}</Text>
                  </View>
                );
              }

              const agentColor = AGENT_COLORS[msg.senderName] || '#888';

              if (msg.sender === 'user') {
                return (
                  <View key={msg.id} style={styles.userBubbleWrap}>
                    <View style={styles.userBubble}>
                      <Text style={styles.userMsgText}>{msg.content}</Text>
                    </View>
                  </View>
                );
              }

              // Agent消息
              return (
                <View
                  key={msg.id}
                  style={[
                    styles.msgBubble,
                    adoptedIds.includes(msg.id) && styles.adoptedBubble,
                  ]}
                >
                  <View style={styles.agentMsgHeader}>
                    <View style={[styles.agentAvatar, { backgroundColor: agentColor + '22' }]}>
                      <Ionicons name="sparkles" size={12} color={agentColor} />
                    </View>
                    <Text style={[styles.msgSender, { color: agentColor }]}>{msg.senderName}</Text>
                    {adoptedIds.includes(msg.id) && (
                      <View style={styles.adoptedTag}>
                        <Feather name="check-circle" size={12} color="#4ade80" />
                        <Text style={styles.adoptedTagText}>已采纳</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.msgContent}>{msg.content}</Text>
                  {msg.sender === 'agent' && !adoptedIds.includes(msg.id) && msg.content !== '正在思考...' && !msg.content.startsWith('评审失败') && !msg.content.startsWith('回复') && (
                    <Pressable style={[styles.adoptBtn, { borderColor: agentColor }]} onPress={() => handleAdopt(msg.id)}>
                      <Feather name="check" size={12} color={agentColor} />
                      <Text style={[styles.adoptBtnText, { color: agentColor }]}>采纳</Text>
                    </Pressable>
                  )}
                </View>
              );
            })}
            {loading && (
              <View style={styles.loadingBubble}>
                <ActivityIndicator size="small" color="#888" />
                <Text style={styles.loadingText}>Agent思考中...</Text>
              </View>
            )}
          </ScrollView>

          {/* 底部操作栏 */}
          <View style={styles.bottomBar}>
            {messages.length === 0 ? (
              <Pressable style={styles.startReviewBtn} onPress={handleStartReview} disabled={loading}>
                <Feather name="zap" size={18} color="#000" />
                <Text style={styles.startReviewText}>开始AI评审</Text>
              </Pressable>
            ) : (
              <>
                <View style={styles.inputRow}>
                  <TextInput
                    style={styles.input}
                    value={inputText}
                    onChangeText={setInputText}
                    placeholder="说你的想法..."
                    placeholderTextColor="#555"
                    onSubmitEditing={handleSend}
                    editable={!loading}
                  />
                  <Pressable style={styles.sendBtn} onPress={handleSend} disabled={loading || !inputText.trim()}>
                    <Feather name="send" size={18} color={inputText.trim() && !loading ? '#000' : '#555'} />
                  </Pressable>
                </View>
                <View style={styles.actionRow}>
                  {adoptHistory.length > 0 && (
                    <Pressable style={styles.undoBtn} onPress={handleUndo}>
                      <Feather name="rotate-ccw" size={14} color="#888" />
                      <Text style={styles.undoText}>撤销采纳</Text>
                    </Pressable>
                  )}
                  {adoptedIds.length > 0 && (
                    <Pressable style={styles.confirmBtn} onPress={handleConfirm}>
                      <Feather name="check-circle" size={14} color="#000" />
                      <Text style={styles.confirmText}>确定修改</Text>
                    </Pressable>
                  )}
                </View>
              </>
            )}
          </View>
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#000',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#222',
    paddingTop: 56,
  },
  backBtn: {
    padding: 8,
  },
  topTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '800',
    color: '#fff',
    textAlign: 'center',
  },
  previewToggle: {
    padding: 8,
  },
  previewArea: {
    flex: 1,
  },
  previewContent: {
    padding: 24,
  },
  previewLabel: {
    fontSize: 12,
    color: '#888',
    fontWeight: '600',
    marginBottom: 12,
  },
  previewText: {
    fontSize: 15,
    color: '#ccc',
    lineHeight: 24,
  },
  chatArea: {
    flex: 1,
  },
  chatContent: {
    padding: 16,
    paddingBottom: 24,
  },
  emptyState: {
    alignItems: 'center',
    paddingTop: 120,
  },
  emptyText: {
    fontSize: 15,
    color: '#555',
    marginTop: 16,
  },
  focusHint: {
    color: '#fbbf24',
    fontSize: 13,
    marginTop: 8,
  },
  systemMsg: {
    alignItems: 'center',
    marginVertical: 8,
  },
  systemMsgText: {
    color: '#555',
    fontSize: 12,
  },
  msgBubble: {
    backgroundColor: '#1a1a1a',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#333',
    marginRight: 20,
  },
  userBubbleWrap: {
    alignItems: 'flex-end',
    marginVertical: 6,
  },
  userBubble: {
    backgroundColor: '#1e3a5f',
    borderRadius: 14,
    borderBottomRightRadius: 4,
    paddingHorizontal: 16,
    paddingVertical: 10,
    maxWidth: '75%',
  },
  userMsgText: {
    color: '#fff',
    fontSize: 15,
    lineHeight: 22,
  },
  agentMsgHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  agentAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  adoptedBubble: {
    borderColor: '#4ade80',
    borderLeftWidth: 3,
  },
  msgSender: {
    fontSize: 12,
    fontWeight: '700',
  },
  msgContent: {
    fontSize: 14,
    color: '#ddd',
    lineHeight: 22,
  },
  adoptBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-end',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    gap: 4,
    marginTop: 8,
    borderWidth: 1,
  },
  adoptBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },
  adoptedTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 0,
  },
  adoptedTagText: {
    fontSize: 12,
    color: '#4ade80',
    fontWeight: '600',
  },
  loadingBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 8,
  },
  loadingText: {
    fontSize: 13,
    color: '#888',
  },
  bottomBar: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#222',
  },
  startReviewBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  startReviewText: {
    color: '#000',
    fontSize: 17,
    fontWeight: '600',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
  },
  input: {
    flex: 1,
    backgroundColor: '#1a1a1a',
    borderRadius: 10,
    padding: 14,
    color: '#fff',
    fontSize: 15,
    borderWidth: 1,
    borderColor: '#333',
    maxHeight: 80,
  },
  sendBtn: {
    backgroundColor: '#fff',
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
    marginTop: 8,
  },
  undoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#1a1a1a',
    borderWidth: 1,
    borderColor: '#fbbf2444',
  },
  undoText: {
    color: '#fbbf24',
    fontSize: 14,
    fontWeight: '500',
  },
  confirmBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#fff',
  },
  confirmText: {
    color: '#000',
    fontSize: 14,
    fontWeight: '600',
  },
});
