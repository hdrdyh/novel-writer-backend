import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
  Platform,
  KeyboardAvoidingView,
  Modal,
  ActivityIndicator,
  AppState,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Screen } from '@/components/Screen';
import { Ionicons } from '@expo/vector-icons';
import { useSafeRouter, useSafeSearchParams } from '@/hooks/useSafeRouter';
import RNSSE from 'react-native-sse';

interface QueueItem {
  id: string;
  chapterNumber: number;
  outline: string;
  content: string;
  status: 'pending' | 'generating' | 'done' | 'reviewed';
}

export default function WritingScreen() {
  const router = useSafeRouter();
  const params = useSafeSearchParams<{ chapterNumber: string; outline: string; rough: string; detail: string; novelName: string }>();

  // 解析细纲数据（hooks之前计算）
  const parsedDetail = React.useMemo(() => {
    try {
      return params.detail ? JSON.parse(params.detail) : [];
    } catch {
      return [];
    }
  }, [params.detail]);

  // 单章模式
  const [chapterNumber, setChapterNumber] = useState(parseInt(params.chapterNumber || '1') || 1);
  const [outlineInput, setOutlineInput] = useState(() => {
    // 如果有细纲，用第一章的细纲作为初始值
    if (parsedDetail.length > 0) return parsedDetail[0] || '';
    // 否则用大纲文本
    return params.outline || '';
  });
  const [content, setContent] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  // 多章模式
  const [isMultiMode, setIsMultiMode] = useState(() => parsedDetail.length > 0);
  const [multiCount, setMultiCount] = useState('3');
  const [showMultiModal, setShowMultiModal] = useState(false);
  const [queue, setQueue] = useState<QueueItem[]>(() => {
    if (parsedDetail.length > 0) {
      return parsedDetail.map((item: string, idx: number) => ({
        id: String(new Date().getTime() + idx),
        chapterNumber: idx + 1,
        outline: item,
        content: '',
        status: 'pending' as const,
      }));
    }
    return [];
  });
  const [hasAutoLoaded, setHasAutoLoaded] = useState(false);
  const [currentQueueIdx, setCurrentQueueIdx] = useState(-1);

  // 用 ref 跟踪最新值，避免 SSE 回调闭包陈旧
  const isMultiModeRef = useRef(isMultiMode);
  const currentQueueIdxRef = useRef(currentQueueIdx);
  const queueRef = useRef(queue);
  useEffect(() => {
    isMultiModeRef.current = isMultiMode;
    currentQueueIdxRef.current = currentQueueIdx;
    queueRef.current = queue;
  }, [isMultiMode, currentQueueIdx, queue]);

  // AppState 监听：切回应用时，如果之前在生成中，自动重连继续
  const wasGeneratingRef = useRef(false);
  const isGeneratingRef = useRef(false);
  const lastOutlineRef = useRef('');
  const lastChNumRef = useRef(0);
  const generateErrorTimeRef = useRef(0); // 记录错误时间，超过60秒不自动重试
  const handleGenerateRef = useRef<((outline?: string, chNum?: number) => Promise<void>) | null>(null);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'active' && wasGeneratingRef.current && !isGeneratingRef.current) {
        const errorElapsed = Date.now() - generateErrorTimeRef.current;
        if (errorElapsed > 60000) {
          // 超过60秒，不再自动重试
          wasGeneratingRef.current = false;
          return;
        }
        // 从后台切回，之前在生成中且已断开 → 自动重试
        wasGeneratingRef.current = false;
        setTimeout(() => {
          if (handleGenerateRef.current) {
            handleGenerateRef.current(lastOutlineRef.current || undefined, lastChNumRef.current || undefined);
          }
        }, 500);
      }
    });
    return () => subscription.remove();
  }, []);

  // 预览
  const [previewModal, setPreviewModal] = useState(false);
  const [previewContent, setPreviewContent] = useState('');
  const [previewTitle, setPreviewTitle] = useState('');

  // 保存
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [novelName, setNovelName] = useState(params.novelName || '');

  const [savedItems, setSavedItems] = useState<any[]>([]);
  const [memoryItems, setMemoryItems] = useState<any[]>([]);

  // Agent 相关状态
  const [agentNames, setAgentNames] = useState<string[]>([]);
  const [currentAgentIdx, setCurrentAgentIdx] = useState(-1);
  const abortRef = useRef(false);

  // 读取用户配置的 Agent 列表
  const loadAgentConfigs = useCallback(async () => {
    try {
      const str = await AsyncStorage.getItem('agentConfigs');
      if (str) {
        const agents = JSON.parse(str);
        const enabled = agents.filter((a: any) => a.enabled !== false).sort((a: any, b: any) => (a.order || 0) - (b.order || 0));
        setAgentNames(enabled.map((a: any) => a.name || 'Agent'));
      }
    } catch (_e) { /* ignore */ }
  }, []);

  const loadSavedItems = useCallback(async () => {
    try {
      const data = await AsyncStorage.getItem('savedItems');
      if (data) setSavedItems(JSON.parse(data));
    } catch (e) {}
  }, []);

  const loadMemory = useCallback(async () => {
    try {
      const data = await AsyncStorage.getItem('memories');
      if (data) setMemoryItems(JSON.parse(data));
    } catch (e) {}
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadSavedItems();
      loadMemory();
      loadAgentConfigs();
      // 检查章节评审结果
      (async () => {
        try {
          const resultStr = await AsyncStorage.getItem('chapter_review_result');
          if (resultStr) {
            const result = JSON.parse(resultStr);
            await AsyncStorage.removeItem('chapter_review_result');
            // 找到对应章节，更新内容
            const idx = queue.findIndex(q => q.chapterNumber === Number(result.chapterNumber));
            if (idx >= 0) {
              const newQueue = [...queue];
              newQueue[idx] = { ...newQueue[idx], content: result.content, status: 'done' as const };
              setQueue(newQueue);
            } else {
              setContent(result.content);
            }
          }
        } catch (_e) { /* ignore */ }
      })();
      // 自动从大纲页加载细纲
      if (parsedDetail.length > 0 && !hasAutoLoaded) {
        setIsMultiMode(true);
        setHasAutoLoaded(true);
        const firstChapter = parsedDetail[0];
        if (firstChapter) {
          setOutlineInput(firstChapter);
          setChapterNumber(1);
        }
      }
    }, [loadSavedItems, loadMemory, loadAgentConfigs, parsedDetail, hasAutoLoaded, queue])
  );

  // 不单独用 useEffect 调 loadAgentConfigs，放在 useFocusEffect 中

  // 前端 Agent 编排：逐个调 LLM API
  const handleGenerate = async (outline?: string, chNum?: number) => {
    const targetOutline = outline || outlineInput;
    const targetChNum = chNum || chapterNumber;

    if (!targetOutline.trim()) {
      Alert.alert('提示', '请先在大纲页生成细纲，然后从大纲页点击"开始写作"');
      return;
    }

    // 记录参数，用于 AppState 恢复
    lastOutlineRef.current = targetOutline;
    lastChNumRef.current = targetChNum;

    // 读取 API 配置
    const apisStr = await AsyncStorage.getItem('apiConfigs');
    const apis = apisStr ? JSON.parse(apisStr) : [];
    if (apis.length === 0) {
      Alert.alert('提示', '请先在写作流水线中配置API');
      return;
    }

    // 读取 Agent 配置
    const agentsStr = await AsyncStorage.getItem('agentConfigs');
    const allAgents = agentsStr ? JSON.parse(agentsStr) : [];
    const enabledAgents = allAgents.filter((a: any) => a.enabled !== false).sort((a: any, b: any) => (a.order || 0) - (b.order || 0));

    if (enabledAgents.length === 0) {
      Alert.alert('提示', '请先在写作流水线中启用至少一个Agent');
      return;
    }

    // 更新 agent 名称列表用于 UI 显示
    setAgentNames(enabledAgents.map((a: any) => a.name || 'Agent'));

    setIsGenerating(true);
    isGeneratingRef.current = true;    setContent('');
    setCurrentAgentIdx(0);
    abortRef.current = false;
    wasGeneratingRef.current = true;

    let accumulatedContent = '';

    for (let i = 0; i < enabledAgents.length; i++) {
      if (abortRef.current) break;

      const agent = enabledAgents[i];
      setCurrentAgentIdx(i);

      // 找到该 Agent 绑定的 API 配置，没有就用默认（第一个）
      let useApi = apis[0];
      if (agent.apiId) {
        const found = apis.find((c: any) => c.id === agent.apiId);
        if (found) useApi = found;
      }

      if (!useApi?.apiKey || !useApi?.baseUrl || !useApi?.model) {
        Alert.alert('提示', `Agent "${agent.name}" 的API配置不完整，请检查`);
        setIsGenerating(false);
        isGeneratingRef.current = false;
        setCurrentAgentIdx(-1);
        wasGeneratingRef.current = false;
        return;
      }

      // 构建 prompt
      const agentPrompt = agent.prompt || agent.systemPrompt || `你是${agent.name}，一位专业的小说创作助手。`;
      const isFirstAgent = i === 0;

      let userPrompt = '';
      if (isFirstAgent) {
        // 第一个 Agent：根据细纲创作正文
        userPrompt = `请根据以下细纲创作小说第${targetChNum}章的正文内容：\n\n${targetOutline}\n\n要求：\n1. 严格按照细纲内容展开，不遗漏任何情节点\n2. 文笔流畅，描写生动\n3. 字数3000-5000字\n4. 直接输出正文内容，不要输出标题、大纲、说明等额外信息`;
      } else {
        // 后续 Agent：基于前一 Agent 的输出进行优化
        userPrompt = `以下是第${targetChNum}章的当前内容：\n\n${accumulatedContent}\n\n请基于你的角色（${agent.name}）对上述内容进行优化和改写。保持故事主线和情节不变，重点在：${agentPrompt}\n\n要求：\n1. 输出完整改写后的章节正文（不是增量修改，而是完整输出）\n2. 保持字数在3000-5000字\n3. 直接输出正文，不要输出标题、说明等额外信息`;
      }

      // 调用 LLM API（SSE 流式）
      try {
        const base = (useApi.baseUrl || '').replace(/\/+$/, '');
        const endpoint = base.endsWith('/v1') ? `${base}/chat/completions` : `${base}/v1/chat/completions`;

        const sse = new RNSSE(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${useApi.apiKey}`,
          },
          body: JSON.stringify({
            model: useApi.model,
            messages: [
              { role: 'system', content: agentPrompt },
              { role: 'user', content: userPrompt },
            ],
            stream: true,
          }),
        });

        let agentContent = '';

        await new Promise<void>((resolve, reject) => {
          sse.addEventListener('message', (event) => {
            if (abortRef.current) {
              sse.close();
              resolve();
              return;
            }
            if (event.data === '[DONE]') {
              sse.close();
              accumulatedContent = agentContent;
              setContent(accumulatedContent);
              resolve();
              return;
            }

            try {
              const json = JSON.parse(event.data || '{}');
              const delta = json.choices?.[0]?.delta?.content || '';
              if (delta) {
                agentContent += delta;
                // 实时显示当前 Agent 的输出
                accumulatedContent = agentContent;
                setContent(accumulatedContent);
              }
            } catch (_e) { /* ignore parse errors */ }
          });

          sse.addEventListener('error', (err: any) => {
            sse.close();
            // 非中止错误才弹出提示
            if (!abortRef.current) {
              reject(new Error('SSE连接错误'));
            } else {
              resolve();
            }
          });
        });

      } catch (error) {
        // SSE 错误
        generateErrorTimeRef.current = Number(new Date());
        setIsGenerating(false);
        isGeneratingRef.current = false;
        setCurrentAgentIdx(-1);
        // 如果已生成部分内容，保留 wasGeneratingRef 让 AppState 恢复时自动重连
        // 如果一点内容都没有，说明可能是 API 配置错误，给提示
        if (!accumulatedContent.trim()) {
          wasGeneratingRef.current = false;
          Alert.alert('错误', '生成失败，请检查API配置和网络连接');
        }
        return;
      }
    }

    // 全部 Agent 完成
    setIsGenerating(false);
    isGeneratingRef.current = false;
    setCurrentAgentIdx(-1);
    wasGeneratingRef.current = false;

    // 多章模式：更新队列
    if (isMultiModeRef.current && currentQueueIdxRef.current >= 0) {
      const curIdx = currentQueueIdxRef.current;
      setQueue((prev) =>
        prev.map((item, idx) =>
          idx === curIdx ? { ...item, content: accumulatedContent, status: 'done' as const } : item
        )
      );
      // 自动生成下一章
      const nextIdx = curIdx + 1;
      const currentQueue = queueRef.current;
      if (nextIdx < currentQueue.length && currentQueue[nextIdx].status === 'pending') {
        setCurrentQueueIdx(nextIdx);
        currentQueueIdxRef.current = nextIdx; // 立即同步 ref
        setQueue((prev) =>
          prev.map((item, idx) => (idx === nextIdx ? { ...item, status: 'generating' as const } : item))
        );
        setTimeout(() => {
          handleGenerateRef.current?.(currentQueue[nextIdx].outline, currentQueue[nextIdx].chapterNumber);
        }, 1000);
      } else {
        setCurrentQueueIdx(-1);
      }
    }
  };

  // 更新 ref 供 AppState 使用
  useEffect(() => {
    handleGenerateRef.current = handleGenerate;
  });

  // 多章模式：初始化队列
  const handleStartMultiMode = () => {
    const count = parseInt(multiCount) || 3;
    const newQueue: QueueItem[] = [];
    for (let i = 0; i < count; i++) {
      newQueue.push({
        id: `ch_${new Date().getTime()}_${i}`,
        chapterNumber: chapterNumber + i,
        outline: '',
        content: '',
        status: 'pending',
      });
    }
    setQueue(newQueue);
    setIsMultiMode(true);
    setShowMultiModal(false);
  };

  // 多章模式：开始生成全部
  const handleGenerateAll = () => {
    const firstPending = queue.findIndex((item) => item.status === 'pending' && item.outline.trim());
    if (firstPending < 0) {
      Alert.alert('提示', '请至少填写一章的章纲');
      return;
    }
    setCurrentQueueIdx(firstPending);
    currentQueueIdxRef.current = firstPending; // 立即同步 ref
    handleGenerate(queue[firstPending].outline, queue[firstPending].chapterNumber);
  };

  // 多章模式：更新某章章纲
  const updateQueueOutline = (idx: number, text: string) => {
    setQueue((prev) => prev.map((item, i) => (i === idx ? { ...item, outline: text } : item)));
  };

  // 多章模式：删除某章
  const removeQueueItem = (idx: number) => {
    setQueue((prev) => prev.filter((_, i) => i !== idx));
  };

  // 多章模式：重新生成某章
  const handleRegenerateQueueItem = (idx: number) => {
    const item = queue[idx];
    if (!item.outline.trim()) return;
    setCurrentQueueIdx(idx);
    currentQueueIdxRef.current = idx; // 立即同步 ref
    setQueue((prev) => prev.map((q, i) => (i === idx ? { ...q, status: 'generating', content: '' } : q)));
    handleGenerate(item.outline, item.chapterNumber);
  };

  // 保存为章节
  const handleSaveAsChapter = () => {
    if (!content.trim()) {
      Alert.alert('提示', '先生成正文后再保存');
      return;
    }
    setShowSaveModal(true);
  };

  const confirmSaveToLibrary = async () => {
    const newItem = {
      id: new Date().getTime().toString(),
      title: novelName || `第${chapterNumber}章`,
      chapterNumber,
      outline: outlineInput,
      content,
      createdAt: new Date().toISOString(),
      cover: `https://picsum.photos/seed/${new Date().getTime()}/200/300`,
    };

    const updated = [newItem, ...savedItems];
    setSavedItems(updated);
    await AsyncStorage.setItem('savedItems', JSON.stringify(updated));
    await AsyncStorage.setItem('novels', JSON.stringify(updated));

    setShowSaveModal(false);
    Alert.alert('成功', `已保存"${newItem.title}"到书架`);
  };

  // 保存多章中的某章到书架
  const handleSaveQueueItem = async (idx: number) => {
    const item = queue[idx];
    if (!item.content.trim()) return;

    const newItem = {
      id: `save_${idx}`,
      title: novelName ? `${novelName} - 第${item.chapterNumber}章` : `第${item.chapterNumber}章`,
      chapterNumber: item.chapterNumber,
      outline: item.outline,
      content: item.content,
      createdAt: '',
      cover: `https://picsum.photos/seed/${idx}/200/300`,
    };

    const updated = [newItem, ...savedItems];
    setSavedItems(updated);
    await AsyncStorage.setItem('savedItems', JSON.stringify(updated));
    await AsyncStorage.setItem('novels', JSON.stringify(updated));

    setQueue((prev) => prev.map((q, i) => (i === idx ? { ...q, status: 'reviewed' } : q)));
    Alert.alert('成功', `第${item.chapterNumber}章已保存到书架`);
  };

  // 退出多章模式
  const handleExitMultiMode = () => {
    if (isGenerating) {
      Alert.alert('提示', '正在生成中，请等待完成');
      return;
    }
    setIsMultiMode(false);
    setQueue([]);
    setCurrentQueueIdx(-1);
  };

  return (
    <Screen>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.container}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>创作中心</Text>
          <View style={styles.headerRight}>
            {!isMultiMode && (
              <TouchableOpacity
                style={styles.multiModeBtn}
                onPress={() => setShowMultiModal(true)}
              >
                <Ionicons name="layers-outline" size={18} color="#fff" />
                <Text style={styles.multiModeBtnText}>连续写作</Text>
              </TouchableOpacity>
            )}
            {isMultiMode && (
              <TouchableOpacity style={styles.exitMultiBtn} onPress={handleExitMultiMode}>
                <Ionicons name="close-circle-outline" size={18} color="#ff6b6b" />
                <Text style={styles.exitMultiBtnText}>退出连写</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {!isMultiMode ? (
            /* ========== 单章模式 ========== */
            <>
              <View style={styles.chapterBadge}>
                <Ionicons name="document-text" size={16} color="#888" />
                <Text style={styles.chapterText}>第 {chapterNumber} 章</Text>
                <TouchableOpacity onPress={() => setChapterNumber(Math.max(1, chapterNumber - 1))}>
                  <Ionicons name="remove-circle-outline" size={20} color="#888" style={{ marginLeft: 8 }} />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setChapterNumber(chapterNumber + 1)}>
                  <Ionicons name="add-circle-outline" size={20} color="#888" />
                </TouchableOpacity>
              </View>

              {outlineInput ? (
                <View style={styles.outlineSection}>
                  <Text style={styles.sectionLabel}>本章细纲</Text>
                  <ScrollView style={styles.outlineDisplay} nestedScrollEnabled>
                    <Text style={styles.outlineDisplayText}>{outlineInput}</Text>
                  </ScrollView>
                </View>
              ) : (
                <View style={styles.noOutlineHint}>
                  <Ionicons name="information-circle-outline" size={20} color="#666" />
                  <Text style={styles.noOutlineHintText}>请先在大纲页生成细纲，然后点击&ldquo;开始写作&rdquo;进入创作</Text>
                </View>
              )}

              <TouchableOpacity
                style={[styles.generateBtn, (isGenerating || !outlineInput) && styles.generateBtnDisabled]}
                onPress={() => handleGenerate()}
                disabled={isGenerating || !outlineInput}
              >
                {isGenerating ? (
                  <ActivityIndicator color="#000" />
                ) : (
                  <>
                    <Ionicons name="bulb" size={20} color={!outlineInput ? '#333' : '#000'} />
                    <Text style={[styles.generateBtnText, !outlineInput && { color: '#333' }]}>
                      {outlineInput ? '开始创作' : '请先生成细纲'}
                    </Text>
                  </>
                )}
              </TouchableOpacity>

              {isGenerating && (
                <View style={styles.agentStatus}>
                  <Text style={styles.agentStatusTitle}>AI创作进度</Text>
                  <View style={styles.agentSteps}>
                    {agentNames.map((name, idx) => (
                      <View key={idx} style={styles.agentStepItem}>
                        <View style={[styles.stepDot, currentAgentIdx >= idx && styles.stepDotActive, currentAgentIdx === idx && styles.stepDotCurrent]} />
                        <Text style={[styles.stepText, currentAgentIdx >= idx && styles.stepTextActive, currentAgentIdx === idx && styles.stepTextCurrent]}>
                          {name}
                        </Text>
                      </View>
                    ))}
                  </View>
                  {currentAgentIdx >= 0 && currentAgentIdx < agentNames.length && (
                    <Text style={styles.currentStepText}>
                      正在执行：{agentNames[currentAgentIdx]} ({currentAgentIdx + 1}/{agentNames.length})
                    </Text>
                  )}
                </View>
              )}

              {content ? (
                <View style={styles.contentSection}>
                  <View style={styles.contentHeader}>
                    <Text style={styles.sectionLabel}>正文</Text>
                    <TouchableOpacity
                      style={styles.previewBtn}
                      onPress={() => {
                        setPreviewContent(content);
                        setPreviewTitle(`第${chapterNumber}章`);
                        setPreviewModal(true);
                      }}
                    >
                      <Ionicons name="expand" size={16} color="#888" />
                      <Text style={styles.previewBtnText}>全屏</Text>
                    </TouchableOpacity>
                  </View>
                  <View style={styles.contentCard}>
                    <ScrollView style={styles.contentScroll} nestedScrollEnabled>
                      <Text style={styles.contentText}>{content}</Text>
                    </ScrollView>
                  </View>

                  {/* 操作按钮 */}
                  <View style={styles.actionButtons}>
                    <TouchableOpacity style={styles.saveBtn} onPress={handleSaveAsChapter}>
                      <Ionicons name="bookmark" size={18} color="#000" />
                      <Text style={styles.saveBtnText}>保存为章节</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.reviewBtn}
                      onPress={() => {
                        if (!content.trim()) return;
                        router.push('/chapter-review', { content, chapterNumber: String(chapterNumber), outline: outlineInput });
                      }}
                    >
                      <Ionicons name="chatbubbles" size={18} color="#fff" />
                      <Text style={styles.reviewBtnText}>AI评审</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                <View style={styles.emptyContent}>
                  <Ionicons name="create-outline" size={48} color="#333" />
                  <Text style={styles.emptyText}>{outlineInput ? '点击开始创作，AI将根据章纲生成正文' : '从大纲页点击"开始写作"，或输入章纲开始创作'}</Text>
                </View>
              )}
            </>
          ) : (
            /* ========== 多章模式 ========== */
            <>
              <View style={styles.multiHeader}>
                <Text style={styles.multiTitle}>连续写作队列</Text>
                <Text style={styles.multiCount}>{queue.filter(q => q.status === 'done' || q.status === 'reviewed').length}/{queue.length} 已完成</Text>
              </View>

              {/* 队列列表 */}
              {queue.map((item, idx) => (
                <View
                  key={item.id}
                  style={[
                    styles.queueCard,
                    currentQueueIdx === idx && styles.queueCardActive,
                    item.status === 'reviewed' && styles.queueCardReviewed,
                  ]}
                >
                  <View style={styles.queueCardHeader}>
                    <Text style={styles.queueCardTitle}>第 {item.chapterNumber} 章</Text>
                    <View style={styles.queueCardActions}>
                      {/* pending 状态：显示开始创作按钮 */}
                      {item.status === 'pending' && !isGenerating && (
                        <TouchableOpacity
                          style={[styles.queueActionBtn, { backgroundColor: '#4ade80', borderRadius: 4, paddingHorizontal: 6 }]}
                          onPress={() => {
                            setCurrentQueueIdx(idx);
                            currentQueueIdxRef.current = idx; // 立即同步 ref
                            setQueue((prev) => prev.map((q, i) => (i === idx ? { ...q, status: 'generating' as const } : q)));
                            handleGenerate(item.outline, item.chapterNumber);
                          }}
                        >
                          <Ionicons name="play" size={16} color="#000" />
                          <Text style={{ color: '#000', fontSize: 12, fontWeight: '600' }}>创作</Text>
                        </TouchableOpacity>
                      )}
                      {item.status === 'generating' && (
                        <ActivityIndicator size="small" color="#fbbf24" />
                      )}
                      {/* done 状态：显示操作按钮 */}
                      {item.status === 'done' && (
                        <>
                          <TouchableOpacity
                            style={styles.queueActionBtn}
                            onPress={() => {
                              setPreviewContent(item.content);
                              setPreviewTitle(`第${item.chapterNumber}章`);
                              setPreviewModal(true);
                            }}
                          >
                            <Ionicons name="eye-outline" size={18} color="#888" />
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={styles.queueActionBtn}
                            onPress={() => router.push('/chapter-review', {
                              content: item.content,
                              chapterNumber: String(item.chapterNumber),
                              outline: item.outline,
                            })}
                          >
                            <Ionicons name="chatbubbles-outline" size={18} color="#fff" />
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={styles.queueActionBtn}
                            onPress={() => handleSaveQueueItem(idx)}
                          >
                            <Ionicons name="bookmark-outline" size={18} color="#4ade80" />
                          </TouchableOpacity>
                          {!isGenerating && (
                            <TouchableOpacity
                              style={styles.queueActionBtn}
                              onPress={() => handleRegenerateQueueItem(idx)}
                            >
                              <Ionicons name="refresh" size={18} color="#fbbf24" />
                            </TouchableOpacity>
                          )}
                        </>
                      )}
                      {/* reviewed 状态 */}
                      {item.status === 'reviewed' && !isGenerating && (
                        <TouchableOpacity
                          style={styles.queueActionBtn}
                          onPress={() => handleRegenerateQueueItem(idx)}
                        >
                          <Ionicons name="refresh" size={18} color="#fbbf24" />
                        </TouchableOpacity>
                      )}
                      {!isGenerating && (
                        <TouchableOpacity onPress={() => removeQueueItem(idx)}>
                          <Ionicons name="close" size={18} color="#ff6b6b" />
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>

                  {/* 状态标签 */}
                  {item.status !== 'pending' && (
                    <View style={styles.statusRow}>
                      <View style={[styles.statusBadge, item.status === 'generating' && styles.statusBadgeGenerating, item.status === 'done' && styles.statusBadgeDone, item.status === 'reviewed' && styles.statusBadgeReviewed]}>
                        <Text style={styles.statusBadgeText}>
                          {item.status === 'generating' ? '生成中...' : item.status === 'done' ? '已生成' : '已保存'}
                        </Text>
                      </View>
                    </View>
                  )}

                  {/* 章纲输入 */}
                  <TextInput
                    style={styles.queueOutlineInput}
                    placeholder="细纲内容（可编辑）..."
                    placeholderTextColor="#555"
                    value={item.outline}
                    onChangeText={(text) => updateQueueOutline(idx, text)}
                    multiline
                    editable={item.status === 'pending'}
                  />
                </View>
              ))}

              {/* 开始生成按钮 */}
              {!isGenerating && (
                <TouchableOpacity style={styles.generateBtn} onPress={handleGenerateAll}>
                  <Ionicons name="play" size={20} color="#000" />
                  <Text style={styles.generateBtnText}>开始全部生成</Text>
                </TouchableOpacity>
              )}

              {/* 生成进度 */}
              {isGenerating && currentQueueIdx >= 0 && (
                <View style={styles.agentStatus}>
                  <Text style={styles.agentStatusTitle}>
                    正在生成：第 {queue[currentQueueIdx]?.chapterNumber} 章
                  </Text>
                  <View style={styles.agentSteps}>
                    {agentNames.map((name, idx) => (
                      <View key={idx} style={styles.agentStepItem}>
                        <View style={[styles.stepDot, currentAgentIdx >= idx && styles.stepDotActive, currentAgentIdx === idx && styles.stepDotCurrent]} />
                        <Text style={[styles.stepText, currentAgentIdx >= idx && styles.stepTextActive, currentAgentIdx === idx && styles.stepTextCurrent]}>
                          {name}
                        </Text>
                      </View>
                    ))}
                  </View>
                  {currentAgentIdx >= 0 && currentAgentIdx < agentNames.length && (
                    <Text style={styles.currentStepText}>
                      正在执行：{agentNames[currentAgentIdx]} ({currentAgentIdx + 1}/{agentNames.length})
                    </Text>
                  )}
                </View>
              )}
            </>
          )}
        </ScrollView>

        {/* 连续写作弹窗 */}
        <Modal visible={showMultiModal} transparent animationType="fade">
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>连续写作</Text>
              <Text style={styles.modalDesc}>一次性生成多个章节，每个章节可单独编辑和保存</Text>
              <Text style={styles.modalLabel}>要写几章？</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="输入章节数量"
                placeholderTextColor="#555"
                value={multiCount}
                onChangeText={setMultiCount}
                keyboardType="number-pad"
                autoFocus
              />
              <View style={styles.modalQuickRow}>
                {['3', '5', '10'].map((n) => (
                  <TouchableOpacity
                    key={n}
                    style={[styles.modalQuickBtn, multiCount === n && styles.modalQuickBtnActive]}
                    onPress={() => setMultiCount(n)}
                  >
                    <Text style={[styles.modalQuickBtnText, multiCount === n && styles.modalQuickBtnTextActive]}>{n}章</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <View style={styles.modalButtons}>
                <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setShowMultiModal(false)}>
                  <Text style={styles.modalCancelText}>取消</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.modalConfirmBtn} onPress={handleStartMultiMode}>
                  <Text style={styles.modalConfirmText}>确定</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* 保存弹窗 */}
        <Modal visible={showSaveModal} transparent animationType="fade">
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>保存为章节</Text>
              <Text style={styles.modalInfo}>章节：第{chapterNumber}章</Text>
              <TextInput
                style={styles.modalInput}
                placeholder={`${params.novelName || '我的小说'} - 第${chapterNumber}章`}
                placeholderTextColor="#555"
                value={novelName}
                onChangeText={setNovelName}
              />
              <View style={styles.modalButtons}>
                <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setShowSaveModal(false)}>
                  <Text style={styles.modalCancelText}>取消</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.modalConfirmBtn} onPress={confirmSaveToLibrary}>
                  <Text style={styles.modalConfirmText}>保存</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* 预览弹窗 */}
        <Modal visible={previewModal} animationType="slide" onRequestClose={() => setPreviewModal(false)}>
          <View style={styles.previewModalContainer}>
            <View style={styles.previewHeader}>
              <Text style={styles.previewTitle}>{previewTitle}</Text>
              <TouchableOpacity onPress={() => setPreviewModal(false)}>
                <Ionicons name="close" size={28} color="#fff" />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.previewScroll}>
              <Text style={styles.previewText}>{previewContent}</Text>
            </ScrollView>
          </View>
        </Modal>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 16,
  },
  headerTitle: { fontSize: 28, fontWeight: 'bold', color: '#fff' },
  headerRight: { flexDirection: 'row', gap: 8 },
  multiModeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
    borderWidth: 1,
    borderColor: '#333',
  },
  multiModeBtnText: { color: '#fff', fontSize: 14, fontWeight: '500' },
  exitMultiBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#1a1a1a',
    borderWidth: 1,
    borderColor: '#ff6b6b33',
  },
  exitMultiBtnText: { color: '#ff6b6b', fontSize: 14, fontWeight: '500' },
  scrollView: { flex: 1 },
  scrollContent: { padding: 20, paddingBottom: 100 },
  chapterBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    alignSelf: 'flex-start',
    marginBottom: 16,
    gap: 6,
    borderWidth: 1,
    borderColor: '#333',
  },
  chapterText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  outlineSection: { marginBottom: 16 },
  sectionLabel: { color: '#888', fontSize: 13, marginBottom: 8, fontWeight: '500' },
  outlineDisplay: {
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
    padding: 14,
    borderWidth: 1,
    borderColor: '#333',
    maxHeight: 120,
  },
  outlineDisplayText: {
    color: '#ccc',
    fontSize: 14,
    lineHeight: 22,
  },
  noOutlineHint: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
    padding: 16,
    borderWidth: 1,
    borderColor: '#333',
    gap: 8,
  },
  noOutlineHintText: {
    color: '#666',
    fontSize: 13,
    flex: 1,
  },
  generateBtn: {
    backgroundColor: '#fff',
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 8,
    marginBottom: 16,
  },
  generateBtnDisabled: { opacity: 0.5 },
  generateBtnText: { color: '#000', fontSize: 17, fontWeight: '600' },
  agentStatus: {
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#333',
  },
  agentStatusTitle: { color: '#fff', fontSize: 14, fontWeight: '600', marginBottom: 8 },
  agentSteps: { flexDirection: 'row', gap: 12, flexWrap: 'wrap' },
  agentStepItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  stepDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#333' },
  stepDotActive: { backgroundColor: '#888' },
  stepDotCurrent: { backgroundColor: '#4ade80', width: 10, height: 10, borderRadius: 5 },
  stepText: { color: '#555', fontSize: 11 },
  stepTextActive: { color: '#ccc' },
  stepTextCurrent: { color: '#4ade80', fontWeight: '600' },
  currentStepText: { color: '#fff', fontSize: 13, marginTop: 8 },
  contentSection: { marginTop: 8 },
  contentHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  previewBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  previewBtnText: { color: '#888', fontSize: 13 },
  contentCard: {
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
    padding: 16,
    maxHeight: 400,
    borderWidth: 1,
    borderColor: '#333',
  },
  contentScroll: { maxHeight: 380 },
  contentText: { color: '#fff', fontSize: 15, lineHeight: 26 },
  actionButtons: { flexDirection: 'row', gap: 12, marginTop: 16 },
  saveBtn: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    gap: 8,
  },
  saveBtnText: { color: '#000', fontSize: 15, fontWeight: '600' },
  reviewBtn: {
    flex: 1,
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    gap: 8,
    borderWidth: 1,
    borderColor: '#333',
  },
  reviewBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  emptyContent: { alignItems: 'center', paddingVertical: 60 },
  emptyText: { color: '#888', fontSize: 15, marginTop: 12 },

  // 多章模式
  multiHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  multiTitle: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  multiCount: { color: '#888', fontSize: 14 },
  queueCard: {
    backgroundColor: '#1a1a1a',
    borderRadius: 10,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#333',
  },
  queueCardActive: { borderColor: '#fff' },
  queueCardReviewed: { borderColor: '#4ade80' },
  queueCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  queueCardTitle: { color: '#fff', fontSize: 16, fontWeight: '600' },
  queueCardActions: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  queueActionBtn: { padding: 4 },
  statusRow: { marginBottom: 8 },
  statusBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: '#333',
  },
  statusBadgeGenerating: { backgroundColor: '#fbbf2433' },
  statusBadgeDone: { backgroundColor: '#60a5fa33' },
  statusBadgeReviewed: { backgroundColor: '#4ade8033' },
  statusBadgeText: { color: '#888', fontSize: 12, fontWeight: '500' },
  queueOutlineInput: {
    backgroundColor: '#111',
    borderRadius: 6,
    padding: 10,
    color: '#fff',
    fontSize: 14,
    minHeight: 40,
    textAlignVertical: 'top',
    borderWidth: 1,
    borderColor: '#222',
  },

  // 弹窗通用
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#1a1a1a',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 360,
    borderWidth: 1,
    borderColor: '#333',
  },
  modalTitle: { color: '#fff', fontSize: 20, fontWeight: 'bold', marginBottom: 12, textAlign: 'center' },
  modalDesc: { color: '#888', fontSize: 14, marginBottom: 20, textAlign: 'center', lineHeight: 20 },
  modalLabel: { color: '#888', fontSize: 13, marginBottom: 8, fontWeight: '500' },
  modalInput: {
    backgroundColor: '#000',
    borderRadius: 8,
    padding: 14,
    color: '#fff',
    fontSize: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#333',
  },
  modalInfo: { color: '#888', fontSize: 14, marginBottom: 16 },
  modalQuickRow: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  modalQuickBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#222',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#333',
  },
  modalQuickBtnActive: { backgroundColor: '#fff', borderColor: '#fff' },
  modalQuickBtnText: { color: '#888', fontSize: 15, fontWeight: '500' },
  modalQuickBtnTextActive: { color: '#000' },
  modalButtons: { flexDirection: 'row', gap: 12 },
  modalCancelBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    backgroundColor: '#333',
    alignItems: 'center',
  },
  modalCancelText: { color: '#888', fontSize: 16 },
  modalConfirmBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    backgroundColor: '#fff',
    alignItems: 'center',
  },
  modalConfirmText: { color: '#000', fontSize: 16, fontWeight: '600' },

  // 预览弹窗
  previewModalContainer: { flex: 1, backgroundColor: '#000', paddingTop: 60 },
  previewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  previewTitle: { color: '#fff', fontSize: 18, fontWeight: '600' },
  previewScroll: { flex: 1, padding: 20 },
  previewText: { color: '#fff', fontSize: 16, lineHeight: 28 },
});
