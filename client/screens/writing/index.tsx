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
import { orchestrateAgents, type OrchestrationParams, type AgentStepResult, type CoordinatorReport } from '@/utils/agentOrchestrator';
import { PRESET_AGENTS, type PresetAgent } from '@/utils/presetAgents';
import { GC } from '@/utils/glassColors';

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

  // 解析细纲数据
  const parsedDetail = React.useMemo(() => {
    try {
      return params.detail ? JSON.parse(params.detail) : [];
    } catch {
      return [];
    }
  }, [params.detail]);

  // 解析粗纲数据
  const parsedRough = React.useMemo(() => {
    try {
      return params.rough ? JSON.parse(params.rough) : [];
    } catch {
      return [];
    }
  }, [params.rough]);

  // 单章模式
  const [chapterNumber, setChapterNumber] = useState(parseInt(params.chapterNumber || '1') || 1);
  const [outlineInput, setOutlineInput] = useState(() => {
    if (parsedDetail.length > 0) return parsedDetail[0] || '';
    return params.outline || '';
  });
  const [content, setContent] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [switchingChapter, setSwitchingChapter] = useState(false);

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

  // ref 跟踪最新值
  const isMultiModeRef = useRef(isMultiMode);
  const currentQueueIdxRef = useRef(currentQueueIdx);
  const queueRef = useRef(queue);
  useEffect(() => {
    isMultiModeRef.current = isMultiMode;
    currentQueueIdxRef.current = currentQueueIdx;
    queueRef.current = queue;
  }, [isMultiMode, currentQueueIdx, queue]);

  // AppState 监听
  const wasGeneratingRef = useRef(false);
  const isGeneratingRef = useRef(false);
  const lastOutlineRef = useRef('');
  const lastChNumRef = useRef(0);
  const generateErrorTimeRef = useRef(0);
  const handleGenerateRef = useRef<((outline?: string, chNum?: number) => Promise<void>) | null>(null);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'active' && wasGeneratingRef.current && !isGeneratingRef.current) {
        const errorElapsed = Date.now() - generateErrorTimeRef.current;
        if (errorElapsed > 60000) {
          wasGeneratingRef.current = false;
          return;
        }
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

  // Agent 编排状态
  const [activeAgentNames, setActiveAgentNames] = useState<string[]>([]);
  const [currentAgentIdx, setCurrentAgentIdx] = useState(-1);
  const [agentOutputs, setAgentOutputs] = useState<Record<string, string>>({});
  const abortRef = useRef(false);

  // 统筹报告弹窗
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportContent, setReportContent] = useState('');
  const [reportFeedback, setReportFeedback] = useState('');

  const loadSavedItems = useCallback(async () => {
    try {
      const data = await AsyncStorage.getItem('savedItems');
      if (data) setSavedItems(JSON.parse(data));
    } catch (_e) { /* ignore */ }
  }, []);

  const loadMemory = useCallback(async () => {
    try {
      const data = await AsyncStorage.getItem('memories');
      if (data) setMemoryItems(JSON.parse(data));
    } catch (_e) { /* ignore */ }
  }, []);

  // 章节切换：同步细纲
  const switchChapter = useCallback((newChNum: number) => {
    if (newChNum < 1) return;

    // 检查细纲是否存在
    if (parsedDetail.length > 0 && newChNum > parsedDetail.length) {
      Alert.alert('章节超出范围', `第${newChNum}章没有对应细纲，当前细纲共${parsedDetail.length}章`);
      return;
    }

    setSwitchingChapter(true);
    setChapterNumber(newChNum);
    setContent(''); // 切换章节时清空正文

    // 同步细纲
    if (parsedDetail.length > 0 && newChNum <= parsedDetail.length) {
      setOutlineInput(parsedDetail[newChNum - 1] || '');
    } else {
      setOutlineInput(params.outline || '');
    }

    // 模拟短暂加载
    setTimeout(() => setSwitchingChapter(false), 600);
  }, [parsedDetail, params.outline]);

  useFocusEffect(
    useCallback(() => {
      loadSavedItems();
      loadMemory();
      // 检查章节评审结果
      (async () => {
        try {
          const resultStr = await AsyncStorage.getItem('chapter_review_result');
          if (resultStr) {
            const result = JSON.parse(resultStr);
            await AsyncStorage.removeItem('chapter_review_result');
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
    }, [loadSavedItems, loadMemory, parsedDetail, hasAutoLoaded, queue])
  );

  // 核心：使用 agentOrchestrator 编排 Agent
  const handleGenerate = async (outline?: string, chNum?: number) => {
    const targetOutline = outline || outlineInput;
    const targetChNum = chNum || chapterNumber;

    if (!targetOutline.trim()) {
      Alert.alert('提示', '请先在大纲页生成细纲，然后从大纲页点击"开始写作"');
      return;
    }

    // 记录参数用于 AppState 恢复
    lastOutlineRef.current = targetOutline;
    lastChNumRef.current = targetChNum;

    // 读取记忆
    let memoryText = '';
    if (memoryItems.length > 0) {
      memoryText = memoryItems.map((m: any) => `- ${m.name || m.title || ''}: ${m.description || m.content || ''}`).join('\n');
    }

    // 读取大纲上下文
    const outlineContext = params.outline || '';
    let roughContext = '';
    if (parsedRough.length > 0) {
      roughContext = parsedRough.map((r: any, i: number) => `第${i + 1}章: ${typeof r === 'string' ? r : r.title || r.content || ''}`).join('\n');
    }

    setIsGenerating(true);
    isGeneratingRef.current = true;
    setContent('');
    setCurrentAgentIdx(0);
    setAgentOutputs({});
    abortRef.current = false;
    wasGeneratingRef.current = true;

    try {
      await orchestrateAgents({
        stage: 'writing',
        context: targetOutline || '无细纲',
        previousContent: memoryText,
        chapterNumber: targetChNum,
        novelName: novelName || '',
        onAgentStart: (name: string, idx: number, total: number) => {
          setCurrentAgentIdx(idx);
          setActiveAgentNames(prev => {
            const next = [...prev];
            next[idx] = name;
            return next;
          });
        },
        onAgentChunk: (chunk: string) => {
          // 实时追加内容
          setContent(prev => prev + chunk);
        },
        onAgentComplete: (name: string, output: string) => {
          setAgentOutputs(prev => ({ ...prev, [name]: output }));
        },
        onAllComplete: (report: CoordinatorReport, allOutputs: AgentStepResult[]) => {
          // 找写手或润色师的输出作为最终正文
          const writerOutput = allOutputs.find(o => o.agentId === 'style_polisher')?.output
            || allOutputs.find(o => o.agentId === 'writer')?.output
            || '';
          if (writerOutput) {
            setContent(writerOutput);
          }
          setIsGenerating(false);
          isGeneratingRef.current = false;
          setCurrentAgentIdx(-1);
          wasGeneratingRef.current = false;

          // 显示统筹报告
          setReportContent(report.agents.map(a => `${a.name}：${a.summary}`).join('\n'));
          setShowReportModal(true);

          // 多章模式：更新队列
          if (isMultiModeRef.current && currentQueueIdxRef.current >= 0) {
            const curIdx = currentQueueIdxRef.current;
            const finalContent = writerOutput || allOutputs.map(o => o.output).join('\n') || '';
            setQueue((prev) =>
              prev.map((item, idx) =>
                idx === curIdx ? { ...item, content: finalContent, status: 'done' as const } : item
              )
            );
            // 自动生成下一章
            const nextIdx = curIdx + 1;
            const currentQueue = queueRef.current;
            if (nextIdx < currentQueue.length && currentQueue[nextIdx].status === 'pending') {
              setCurrentQueueIdx(nextIdx);
              currentQueueIdxRef.current = nextIdx;
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
        },
        onError: (error: string) => {
          generateErrorTimeRef.current = Date.now();
          setIsGenerating(false);
          isGeneratingRef.current = false;
          setCurrentAgentIdx(-1);
          if (!content.trim()) {
            wasGeneratingRef.current = false;
            Alert.alert('错误', error);
          }
        },
      });
    } catch (error: any) {
      generateErrorTimeRef.current = Date.now();
      setIsGenerating(false);
      isGeneratingRef.current = false;
      setCurrentAgentIdx(-1);
      if (!content.trim()) {
        wasGeneratingRef.current = false;
        Alert.alert('错误', '生成失败，请检查API配置和网络连接');
      }
    }
  };

  // 更新 ref
  useEffect(() => {
    handleGenerateRef.current = handleGenerate;
  });

  // 多章模式：初始化队列
  const handleStartMultiMode = () => {
    const count = parseInt(multiCount) || 3;
    const startCh = chapterNumber;
    const newQueue: QueueItem[] = [];
    for (let i = 0; i < count; i++) {
      const chNum = startCh + i;
      newQueue.push({
        id: `ch_${new Date().getTime()}_${i}`,
        chapterNumber: chNum,
        outline: parsedDetail.length > 0 && chNum <= parsedDetail.length ? parsedDetail[chNum - 1] : '',
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
      Alert.alert('提示', '没有可创作的章节（需要有细纲内容）');
      return;
    }
    setCurrentQueueIdx(firstPending);
    currentQueueIdxRef.current = firstPending;
    handleGenerate(queue[firstPending].outline, queue[firstPending].chapterNumber);
  };

  // 多章模式：更新某章细纲
  const updateQueueOutline = (idx: number, text: string) => {
    setQueue((prev) => prev.map((item, i) => (i === idx ? { ...item, outline: text } : item)));
  };

  // 多章模式：删除某章
  const removeQueueItem = (idx: number) => {
    setQueue((prev) => prev.filter((_, i) => i !== idx));
  };

  // 多章模式：重新生成某章（重写）
  const handleRegenerateQueueItem = (idx: number) => {
    const item = queue[idx];
    if (!item.outline.trim()) {
      Alert.alert('提示', '该章节没有细纲，无法重写');
      return;
    }
    setCurrentQueueIdx(idx);
    currentQueueIdxRef.current = idx;
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
              {/* 章节切换 + 加载进度条 */}
              <View style={styles.chapterBadge}>
                <Ionicons name="document-text" size={16} color="#888" />
                <Text style={styles.chapterText}>第 {chapterNumber} 章</Text>
                <TouchableOpacity onPress={() => switchChapter(chapterNumber - 1)}>
                  <Ionicons name="remove-circle-outline" size={20} color="#888" style={{ marginLeft: 8 }} />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => switchChapter(chapterNumber + 1)}>
                  <Ionicons name="add-circle-outline" size={20} color="#888" />
                </TouchableOpacity>
              </View>
              {switchingChapter && (
                <View style={styles.switchingBar}>
                  <View style={styles.switchingProgress} />
                </View>
              )}

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
                    <Ionicons name="bulb" size={20} color={!outlineInput ? GC.border : GC.bgBase} />
                    <Text style={[styles.generateBtnText, !outlineInput && { color: GC.border }]}>
                      {outlineInput ? '开始创作' : '请先生成细纲'}
                    </Text>
                  </>
                )}
              </TouchableOpacity>

              {/* Agent 协作进度区 */}
              {isGenerating && activeAgentNames.length > 0 && (
                <View style={styles.agentStatus}>
                  <Text style={styles.agentStatusTitle}>Agent 协作进度</Text>
                  <View style={styles.agentSteps}>
                    {activeAgentNames.map((name, idx) => (
                      <View key={`${name}-${idx}`} style={styles.agentStepItem}>
                        {currentAgentIdx > idx && <Ionicons name="checkmark-circle" size={14} color="#4ade80" />}
                        {currentAgentIdx === idx && <ActivityIndicator size={14} color="#7C5CFF" />}
                        {currentAgentIdx < idx && <View style={styles.stepDotPending} />}
                        <Text style={[
                          styles.stepText,
                          currentAgentIdx > idx && styles.stepTextDone,
                          currentAgentIdx === idx && styles.stepTextCurrent,
                          currentAgentIdx < idx && styles.stepTextPending,
                        ]}>
                          {name}
                        </Text>
                      </View>
                    ))}
                  </View>
                  {currentAgentIdx >= 0 && currentAgentIdx < activeAgentNames.length && (
                    <Text style={styles.currentStepText}>
                      正在执行：{activeAgentNames[currentAgentIdx]} ({currentAgentIdx + 1}/{activeAgentNames.length})
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
                    {/* 重写按钮 - 醒目 */}
                    <TouchableOpacity
                      style={styles.rewriteBtn}
                      onPress={() => handleGenerate()}
                      disabled={isGenerating}
                    >
                      <Ionicons name="refresh" size={18} color="#fff" />
                      <Text style={styles.rewriteBtnText}>重写</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.saveBtn} onPress={handleSaveAsChapter}>
                      <Ionicons name="bookmark" size={18} color="#000" />
                      <Text style={styles.saveBtnText}>保存</Text>
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
                !isGenerating && (
                  <View style={styles.emptyContent}>
                    <Ionicons name="create-outline" size={48} color="#333" />
                    <Text style={styles.emptyText}>
                      {outlineInput ? '点击"开始创作"，AI将根据细纲生成正文' : '从大纲页点击"开始写作"进入创作'}
                    </Text>
                  </View>
                )
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
                      {item.status === 'pending' && !isGenerating && item.outline.trim() && (
                        <TouchableOpacity
                          style={[styles.queueActionBtn, { backgroundColor: GC.success, borderRadius: 4, paddingHorizontal: 6 }]}
                          onPress={() => {
                            setCurrentQueueIdx(idx);
                            currentQueueIdxRef.current = idx;
                            setQueue((prev) => prev.map((q, i) => (i === idx ? { ...q, status: 'generating' as const } : q)));
                            handleGenerate(item.outline, item.chapterNumber);
                          }}
                        >
                          <Ionicons name="play" size={16} color="#000" />
                          <Text style={{ color: GC.bgBase, fontSize: 12, fontWeight: '600' }}>创作</Text>
                        </TouchableOpacity>
                      )}
                      {item.status === 'pending' && !item.outline.trim() && (
                        <Text style={{ color: GC.danger, fontSize: 11 }}>无细纲</Text>
                      )}
                      {item.status === 'generating' && (
                        <ActivityIndicator size="small" color="#fbbf24" />
                      )}
                      {/* done/reviewed 状态：显示操作按钮 */}
                      {(item.status === 'done' || item.status === 'reviewed') && (
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
                          {/* 重写按钮 - 醒目 */}
                          {!isGenerating && (
                            <TouchableOpacity
                              style={[styles.queueActionBtn, { backgroundColor: '#7C5CFF22', borderRadius: 4, paddingHorizontal: 6 }]}
                              onPress={() => handleRegenerateQueueItem(idx)}
                            >
                              <Ionicons name="refresh" size={16} color="#7C5CFF" />
                              <Text style={{ color: GC.primary, fontSize: 11, fontWeight: '600' }}>重写</Text>
                            </TouchableOpacity>
                          )}
                        </>
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

                  {/* 细纲显示（只读） */}
                  {item.outline ? (
                    <Text style={styles.queueOutlineText} numberOfLines={3}>{item.outline}</Text>
                  ) : (
                    <Text style={styles.queueNoOutlineText}>无细纲内容</Text>
                  )}
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
                    {activeAgentNames.map((name, idx) => (
                      <View key={`${name}-${idx}`} style={styles.agentStepItem}>
                        {currentAgentIdx > idx && <Ionicons name="checkmark-circle" size={14} color="#4ade80" />}
                        {currentAgentIdx === idx && <ActivityIndicator size={14} color="#7C5CFF" />}
                        {currentAgentIdx < idx && <View style={styles.stepDotPending} />}
                        <Text style={[
                          styles.stepText,
                          currentAgentIdx > idx && styles.stepTextDone,
                          currentAgentIdx === idx && styles.stepTextCurrent,
                          currentAgentIdx < idx && styles.stepTextPending,
                        ]}>
                          {name}
                        </Text>
                      </View>
                    ))}
                  </View>
                  {currentAgentIdx >= 0 && currentAgentIdx < activeAgentNames.length && (
                    <Text style={styles.currentStepText}>
                      正在执行：{activeAgentNames[currentAgentIdx]} ({currentAgentIdx + 1}/{activeAgentNames.length})
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

        {/* 统筹报告弹窗 */}
        <Modal visible={showReportModal} transparent animationType="fade">
          <View style={styles.modalOverlay}>
            <View style={styles.reportModalContent}>
              <Text style={styles.reportTitle}>协作报告</Text>
              <ScrollView style={styles.reportScroll} nestedScrollEnabled>
                <Text style={styles.reportText}>{reportContent}</Text>
              </ScrollView>
              <Text style={styles.reportFeedbackLabel}>意见反馈（可选）</Text>
              <TextInput
                style={styles.reportFeedbackInput}
                placeholder="对本次协作有什么意见？"
                placeholderTextColor="#555"
                value={reportFeedback}
                onChangeText={setReportFeedback}
                multiline
                numberOfLines={3}
              />
              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={styles.modalCancelBtn}
                  onPress={() => {
                    setShowReportModal(false);
                    setReportFeedback('');
                  }}
                >
                  <Text style={styles.modalCancelText}>确认完成</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.modalConfirmBtn}
                  onPress={() => {
                    setShowReportModal(false);
                    setReportFeedback('');
                    // 重新生成
                    handleGenerate();
                  }}
                >
                  <Text style={styles.modalConfirmText}>重新生成</Text>
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
  container: { flex: 1, backgroundColor: GC.bgBase },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 16,
  },
  headerTitle: { fontSize: 28, fontWeight: 'bold', color: GC.textPrimary },
  headerRight: { flexDirection: 'row', gap: 8 },
  multiModeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: GC.bgElevated,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
    borderWidth: 1,
    borderColor: GC.border,
  },
  multiModeBtnText: { color: GC.textPrimary, fontSize: 14, fontWeight: '500' },
  exitMultiBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: GC.bgElevated,
    borderWidth: 1,
    borderColor: '#ff6b6b33',
  },
  exitMultiBtnText: { color: GC.danger, fontSize: 14, fontWeight: '500' },
  scrollView: { flex: 1 },
  scrollContent: { padding: 20, paddingBottom: 100 },
  chapterBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: GC.bgElevated,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    alignSelf: 'flex-start',
    marginBottom: 4,
    gap: 6,
    borderWidth: 1,
    borderColor: GC.border,
  },
  chapterText: { color: GC.textPrimary, fontSize: 15, fontWeight: '600' },
  switchingBar: {
    height: 3,
    backgroundColor: GC.bgElevated,
    borderRadius: 2,
    marginBottom: 16,
    overflow: 'hidden',
  },
  switchingProgress: {
    height: '100%',
    backgroundColor: GC.primary,
    borderRadius: 2,
    width: '60%',
  },
  outlineSection: { marginBottom: 16 },
  sectionLabel: { color: GC.textSecondary, fontSize: 13, marginBottom: 8, fontWeight: '500' },
  outlineDisplay: {
    backgroundColor: GC.bgElevated,
    borderRadius: 8,
    padding: 14,
    borderWidth: 1,
    borderColor: GC.border,
    maxHeight: 120,
  },
  outlineDisplayText: {
    color: GC.border,
    fontSize: 14,
    lineHeight: 22,
  },
  noOutlineHint: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: GC.bgElevated,
    borderRadius: 8,
    padding: 16,
    borderWidth: 1,
    borderColor: GC.border,
    gap: 8,
    marginBottom: 16,
  },
  noOutlineHintText: {
    color: GC.textMuted,
    fontSize: 13,
    flex: 1,
  },
  generateBtn: {
    backgroundColor: GC.bgBase,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 8,
    marginBottom: 16,
  },
  generateBtnDisabled: { opacity: 0.5 },
  generateBtnText: { color: GC.bgBase, fontSize: 17, fontWeight: '600' },
  agentStatus: {
    backgroundColor: GC.bgElevated,
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: GC.border,
  },
  agentStatusTitle: { color: GC.textPrimary, fontSize: 14, fontWeight: '600', marginBottom: 10 },
  agentSteps: { gap: 8 },
  agentStepItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  stepDotPending: { width: 8, height: 8, borderRadius: 4, backgroundColor: GC.border },
  stepText: { fontSize: 12 },
  stepTextDone: { color: GC.success },
  stepTextCurrent: { color: GC.primary, fontWeight: '700' },
  stepTextPending: { color: GC.textSecondary },
  currentStepText: { color: GC.textPrimary, fontSize: 13, marginTop: 8 },
  contentSection: { marginTop: 8 },
  contentHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  previewBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  previewBtnText: { color: GC.textSecondary, fontSize: 13 },
  contentCard: {
    backgroundColor: GC.bgElevated,
    borderRadius: 8,
    padding: 14,
    borderWidth: 1,
    borderColor: GC.border,
    minHeight: 200,
  },
  contentScroll: { maxHeight: 400 },
  contentText: { color: GC.textMuted, fontSize: 15, lineHeight: 26 },
  actionButtons: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
  },
  rewriteBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: GC.primary,
    borderRadius: 10,
    paddingVertical: 12,
    gap: 6,
  },
  rewriteBtnText: { color: GC.textPrimary, fontSize: 15, fontWeight: '600' },
  saveBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: GC.bgBase,
    borderRadius: 10,
    paddingVertical: 12,
    gap: 6,
  },
  saveBtnText: { color: GC.bgBase, fontSize: 15, fontWeight: '600' },
  reviewBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: GC.border,
    borderRadius: 10,
    paddingVertical: 12,
    gap: 6,
    borderWidth: 1,
    borderColor: GC.textSecondary,
  },
  reviewBtnText: { color: GC.textPrimary, fontSize: 15, fontWeight: '600' },
  emptyContent: {
    alignItems: 'center',
    paddingVertical: 40,
    gap: 12,
  },
  emptyText: { color: GC.textMuted, fontSize: 14, textAlign: 'center' },

  // 多章模式
  multiHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  multiTitle: { color: GC.textPrimary, fontSize: 20, fontWeight: 'bold' },
  multiCount: { color: GC.textSecondary, fontSize: 14 },
  queueCard: {
    backgroundColor: GC.bgElevated,
    borderRadius: 10,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: GC.border,
  },
  queueCardActive: { borderColor: GC.primary, borderWidth: 2 },
  queueCardReviewed: { borderColor: '#4ade8044' },
  queueCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  queueCardTitle: { color: GC.textPrimary, fontSize: 16, fontWeight: '600' },
  queueCardActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  queueActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingVertical: 4,
  },
  statusRow: { marginTop: 6 },
  statusBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    backgroundColor: GC.border,
  },
  statusBadgeGenerating: { backgroundColor: '#fbbf2433' },
  statusBadgeDone: { backgroundColor: '#4ade8033' },
  statusBadgeReviewed: { backgroundColor: '#7C5CFF33' },
  statusBadgeText: { fontSize: 11, color: GC.border },
  queueOutlineText: {
    color: GC.textSecondary,
    fontSize: 12,
    marginTop: 8,
    lineHeight: 18,
  },
  queueNoOutlineText: {
    color: GC.danger,
    fontSize: 12,
    marginTop: 8,
    fontStyle: 'italic',
  },

  // 弹窗
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: GC.bgElevated,
    borderRadius: 16,
    padding: 24,
    width: '85%',
    borderWidth: 1,
    borderColor: GC.border,
  },
  reportModalContent: {
    backgroundColor: GC.bgElevated,
    borderRadius: 16,
    padding: 24,
    width: '90%',
    maxHeight: '80%',
    borderWidth: 1,
    borderColor: '#7C5CFF44',
  },
  modalTitle: { color: GC.textPrimary, fontSize: 20, fontWeight: 'bold', marginBottom: 8 },
  modalDesc: { color: GC.textSecondary, fontSize: 14, marginBottom: 20 },
  modalLabel: { color: GC.border, fontSize: 14, marginBottom: 8 },
  modalInfo: { color: GC.textSecondary, fontSize: 14, marginBottom: 12 },
  modalInput: {
    backgroundColor: GC.bgBase,
    borderRadius: 8,
    padding: 14,
    color: GC.textPrimary,
    fontSize: 16,
    borderWidth: 1,
    borderColor: GC.border,
    marginBottom: 12,
  },
  modalQuickRow: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  modalQuickBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: GC.bgBase,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: GC.border,
  },
  modalQuickBtnActive: { borderColor: GC.primary, backgroundColor: '#7C5CFF22' },
  modalQuickBtnText: { color: GC.textSecondary, fontSize: 14 },
  modalQuickBtnTextActive: { color: GC.primary, fontWeight: '600' },
  modalButtons: { flexDirection: 'row', gap: 12, marginTop: 8 },
  modalCancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: GC.border,
    alignItems: 'center',
  },
  modalCancelText: { color: GC.textPrimary, fontSize: 15, fontWeight: '500' },
  modalConfirmBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: GC.primary,
    alignItems: 'center',
  },
  modalConfirmText: { color: GC.textPrimary, fontSize: 15, fontWeight: '600' },
  reportTitle: { color: GC.primary, fontSize: 18, fontWeight: 'bold', marginBottom: 12 },
  reportScroll: { maxHeight: 200, marginBottom: 12 },
  reportText: { color: GC.border, fontSize: 14, lineHeight: 22 },
  reportFeedbackLabel: { color: GC.textSecondary, fontSize: 12, marginBottom: 6 },
  reportFeedbackInput: {
    backgroundColor: GC.bgBase,
    borderRadius: 8,
    padding: 12,
    color: GC.textPrimary,
    fontSize: 14,
    borderWidth: 1,
    borderColor: GC.border,
    minHeight: 60,
    marginBottom: 12,
    textAlignVertical: 'top',
  },
  previewModalContainer: { flex: 1, backgroundColor: GC.bgBase },
  previewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    paddingTop: 60,
  },
  previewTitle: { color: GC.textPrimary, fontSize: 22, fontWeight: 'bold' },
  previewScroll: { flex: 1, padding: 20 },
  previewText: { color: GC.textMuted, fontSize: 16, lineHeight: 28 },
});
