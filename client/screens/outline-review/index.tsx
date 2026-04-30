import { useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useSafeRouter, useSafeSearchParams } from '@/hooks/useSafeRouter';
import { Screen } from '@/components/Screen';
import { Feather } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface ChatMessage {
  id: string;
  sender: 'user' | 'agent';
  senderName: string;
  content: string;
  agentRole?: string;
  adopted?: boolean;
}

const STAGE_NAMES: Record<string, string> = {
  outline: '大纲',
  rough: '粗纲',
  detail: '细纲',
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

  // 读取配置
  const getConfig = useCallback(async () => {
    const agentsStr = await AsyncStorage.getItem('agentConfigs');
    const apisStr = await AsyncStorage.getItem('apiConfigs');
    const reviewStr = await AsyncStorage.getItem('reviewConfig');
    const agents = agentsStr ? JSON.parse(agentsStr) : [];
    const apis = apisStr ? JSON.parse(apisStr) : [];
    const review = reviewStr ? JSON.parse(reviewStr) : {};
    const enabledAgents = agents.filter((a: any) => a.enabled);
    const reviewAgents = enabledAgents.filter((a: any) =>
      review.agentIds ? review.agentIds.includes(a.id) : true
    );
    const wordLimit = review.wordLimit || 80;
    return { agents: reviewAgents.length > 0 ? reviewAgents : enabledAgents, apis, wordLimit };
  }, []);

  // 开始AI评审
  const handleStartReview = useCallback(async () => {
    const { agents, apis, wordLimit } = await getConfig();
    if (agents.length === 0 || apis.length === 0) {
      Alert.alert('提示', '请先在写作流水线中配置Agent和API');
      return;
    }

    setLoading(true);
    const newMessages: ChatMessage[] = [];

    for (const agent of agents) {
      try {
        const api = apis.find((a: any) => a.name === agent.apiName) || apis[0];
        const response = await fetch(`${api.baseUrl}/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${api.apiKey}`,
          },
          body: JSON.stringify({
            model: api.model,
            messages: [
              {
                role: 'system',
                content: `${agent.systemPrompt}\n你正在评审一份小说${stageName}。请用${wordLimit}字以内给出你的评审意见和改进建议。简洁直接。`,
              },
              { role: 'user', content: `以下是需要评审的${stageName}内容：\n${params.content}` },
            ],
            max_tokens: 500,
          }),
        });

        const result = await response.json();
        const content = result.choices?.[0]?.message?.content || '评审失败，请重试';

        newMessages.push({
          id: `agent_${agent.id}_${new Date().getTime()}`,
          sender: 'agent',
          senderName: agent.name,
          content,
          agentRole: agent.role,
        });
      } catch (e: any) {
        newMessages.push({
          id: `error_${agent.id}_${new Date().getTime()}`,
          sender: 'agent',
          senderName: agent.name,
          content: `评审出错：${e.message}`,
          agentRole: agent.role,
        });
      }
    }

    setMessages(newMessages);
    setLoading(false);
  }, [getConfig, params.content, stageName]);

  // 用户发言
  const handleSend = useCallback(async () => {
    if (!inputText.trim()) return;

    const userMsg: ChatMessage = {
      id: `user_${new Date().getTime()}`,
      sender: 'user',
      senderName: '你',
      content: inputText.trim(),
    };
    setMessages(prev => [...prev, userMsg]);
    setInputText('');

    // 触发Agent回复
    const { agents, apis, wordLimit } = await getConfig();
    if (agents.length === 0 || apis.length === 0) return;

    setLoading(true);
    const replies: ChatMessage[] = [];
    const chatHistory = [...messages, userMsg].map(m => ({
      role: m.sender === 'user' ? 'user' as const : 'assistant' as const,
      content: `${m.senderName}：${m.content}`,
    }));

    for (const agent of agents) {
      try {
        const api = apis.find((a: any) => a.name === agent.apiName) || apis[0];
        const response = await fetch(`${api.baseUrl}/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${api.apiKey}`,
          },
          body: JSON.stringify({
            model: api.model,
            messages: [
              {
                role: 'system',
                content: `${agent.systemPrompt}\n你正在参与${stageName}的群聊讨论。用${wordLimit}字以内回复，简洁直接，给出你的看法或建议。`,
              },
              ...chatHistory.slice(-10),
            ],
            max_tokens: 300,
          }),
        });

        const result = await response.json();
        const content = result.choices?.[0]?.message?.content || '';

        replies.push({
          id: `reply_${agent.id}_${new Date().getTime()}`,
          sender: 'agent',
          senderName: agent.name,
          content,
          agentRole: agent.role,
        });
      } catch (e: any) {
        // 静默失败
      }
    }

    setMessages(prev => [...prev, ...replies]);
    setLoading(false);
  }, [inputText, messages, getConfig, params.content, stageName]);

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
    // 将采纳的建议存到AsyncStorage，大纲页读取后应用
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
        // 原文预览
        <ScrollView style={styles.previewArea} contentContainerStyle={styles.previewContent}>
          <Text style={styles.previewLabel}>原文内容</Text>
          <Text style={styles.previewText}>{params.content}</Text>
        </ScrollView>
      ) : (
        <>
          {/* 聊天区 */}
          <ScrollView style={styles.chatArea} contentContainerStyle={styles.chatContent}>
            {messages.length === 0 && !loading && (
              <View style={styles.emptyState}>
                <Feather name="message-circle" size={48} color="#555" />
                <Text style={styles.emptyText}>点击下方按钮开始AI评审</Text>
              </View>
            )}
            {messages.map(msg => (
              <View
                key={msg.id}
                style={[
                  styles.msgBubble,
                  msg.sender === 'user' ? styles.userBubble : styles.agentBubble,
                  adoptedIds.includes(msg.id) && styles.adoptedBubble,
                ]}
              >
                <Text style={styles.msgSender}>{msg.senderName}</Text>
                <Text style={styles.msgContent}>{msg.content}</Text>
                {msg.sender === 'agent' && !adoptedIds.includes(msg.id) && (
                  <Pressable style={styles.adoptBtn} onPress={() => handleAdopt(msg.id)}>
                    <Feather name="check" size={12} color="#000" />
                    <Text style={styles.adoptBtnText}>采纳</Text>
                  </Pressable>
                )}
                {adoptedIds.includes(msg.id) && (
                  <View style={styles.adoptedTag}>
                    <Feather name="check-circle" size={12} color="#4ade80" />
                    <Text style={styles.adoptedTagText}>已采纳</Text>
                  </View>
                )}
              </View>
            ))}
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
                  />
                  <Pressable style={styles.sendBtn} onPress={handleSend} disabled={loading}>
                    <Feather name="send" size={18} color="#000" />
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
  msgBubble: {
    backgroundColor: '#1a1a1a',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#333',
  },
  userBubble: {
    backgroundColor: '#1a2a1a',
    borderColor: '#2a3a2a',
    marginLeft: 40,
  },
  agentBubble: {
    marginRight: 20,
  },
  adoptedBubble: {
    borderColor: '#4ade80',
    borderLeftWidth: 3,
  },
  msgSender: {
    fontSize: 12,
    fontWeight: '700',
    color: '#888',
    marginBottom: 6,
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
    backgroundColor: '#fff',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    gap: 4,
    marginTop: 8,
  },
  adoptBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#000',
  },
  adoptedTag: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-end',
    gap: 4,
    marginTop: 8,
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
    borderRadius: 12,
    paddingVertical: 16,
    gap: 8,
  },
  startReviewText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#000',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  input: {
    flex: 1,
    backgroundColor: '#1a1a1a',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 15,
    color: '#fff',
    borderWidth: 1,
    borderColor: '#333',
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  undoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  undoText: {
    fontSize: 13,
    color: '#888',
  },
  confirmBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 6,
  },
  confirmText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#000',
  },
});
