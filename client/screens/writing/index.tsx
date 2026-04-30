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
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Screen } from '@/components/Screen';
import { Ionicons } from '@expo/vector-icons';
import { useSafeRouter, useSafeSearchParams } from '@/hooks/useSafeRouter';
import RNSSE from 'react-native-sse';

const API_BASE_URL = process.env.EXPO_PUBLIC_BACKEND_BASE_URL || 'http://localhost:9091';

interface QueueItem {
  id: string;
  chapterNumber: number;
  outline: string;
  content: string;
  status: 'pending' | 'generating' | 'done' | 'reviewed';
}

export default function WritingScreen() {
  const router = useSafeRouter();
  const params = useSafeSearchParams<{ chapterNumber: string; outline: string; rough: string; detail: string }>();

  // 单章模式
  const [chapterNumber, setChapterNumber] = useState(parseInt(params.chapterNumber || '1') || 1);
  const [outlineInput, setOutlineInput] = useState(params.outline || '');

  // 从大纲页传入细纲时，自动切换多章模式
  const detailFromOutline = React.useMemo(() => {
    try {
      return params.detail ? JSON.parse(params.detail) : [];
    } catch {
      return [];
    }
  }, [params.detail]);
  const [content, setContent] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentStep, setCurrentStep] = useState(-1);

  // 多章模式
  const [isMultiMode, setIsMultiMode] = useState(false);
  const [multiCount, setMultiCount] = useState('3');
  const [showMultiModal, setShowMultiModal] = useState(false);
  const [queue, setQueue] = useState<QueueItem[]>(() => {
    if (detailFromOutline.length > 0) {
      return detailFromOutline.map((item: string, idx: number) => ({
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

  // 预览
  const [previewModal, setPreviewModal] = useState(false);
  const [previewContent, setPreviewContent] = useState('');
  const [previewTitle, setPreviewTitle] = useState('');

  // 保存
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [novelName, setNovelName] = useState('');

  const [savedItems, setSavedItems] = useState<any[]>([]);
  const [memoryItems, setMemoryItems] = useState<any[]>([]);

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
      // 自动从大纲页加载细纲
      if (detailFromOutline.length > 0 && !hasAutoLoaded) {
        setIsMultiMode(true);
        setHasAutoLoaded(true);
        const firstChapter = detailFromOutline[0];
        if (firstChapter) {
          setOutlineInput(firstChapter);
          setChapterNumber(1);
        }
      }
    }, [loadSavedItems, loadMemory, detailFromOutline, hasAutoLoaded])
  );

  // 生成单章
  const handleGenerate = async (outline?: string, chNum?: number) => {
    const targetOutline = outline || outlineInput;
    const targetChNum = chNum || chapterNumber;

    if (!targetOutline.trim()) {
      Alert.alert('提示', '请输入本章章纲');
      return;
    }

    setIsGenerating(true);
    setContent('');
    setCurrentStep(0);

    let fullContent = '';

    try {
      // 读取用户配置的API
      const apisStr = await AsyncStorage.getItem('apiConfigs');
      const apis = apisStr ? JSON.parse(apisStr) : [];
      if (apis.length === 0) {
        Alert.alert('提示', '请先在写作流水线中配置API');
        setIsGenerating(false);
        return;
      }
      const api = apis[0];

      const sse = new RNSSE(`${API_BASE_URL}/api/v1/writing/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': api.apiKey || '',
          'x-model': api.model || 'deepseek-chat',
          'x-base-url': api.baseUrl || 'https://api.deepseek.com',
        },
        body: JSON.stringify({
          chapterId: `ch_${targetChNum}`,
          chapterNumber: targetChNum,
          outline: targetOutline,
          memoryContext: memoryItems.slice(-2).map((m) => `${m.name || ''}: ${m.description || ''}`),
          agentCount: 3,
        }),
      });

      sse.addEventListener('message', (event) => {
        if (event.data === '[DONE]') {
          setIsGenerating(false);
          setCurrentStep(-1);
          sse.close();
          // 多章模式：更新队列
          if (isMultiModeRef.current && currentQueueIdxRef.current >= 0) {
            const curIdx = currentQueueIdxRef.current;
            setQueue((prev) =>
              prev.map((item, idx) =>
                idx === curIdx ? { ...item, content: fullContent, status: 'done' as const } : item
              )
            );
            // 自动生成下一章
            const nextIdx = curIdx + 1;
            const currentQueue = queueRef.current;
            if (nextIdx < currentQueue.length && currentQueue[nextIdx].status === 'pending') {
              setCurrentQueueIdx(nextIdx);
              setTimeout(() => {
                handleGenerate(currentQueue[nextIdx].outline, currentQueue[nextIdx].chapterNumber);
              }, 1000);
            } else {
              setCurrentQueueIdx(-1);
            }
          }
          return;
        }

        try {
          const json = JSON.parse(event.data || '{}');
          if (json.type === 'step') {
            setCurrentStep(json.stepIndex);
          } else if (json.type === 'chunk' && json.content) {
            fullContent += json.content;
            setContent(fullContent);
          } else if (json.type === 'done' && json.content) {
            fullContent = json.content;
            setContent(fullContent);
          }
        } catch (e) {}
      });

      sse.addEventListener('error', () => {
        setIsGenerating(false);
        setCurrentStep(-1);
        Alert.alert('错误', '生成失败，请检查网络连接');
      });

    } catch (error) {
      setIsGenerating(false);
      setCurrentStep(-1);
      Alert.alert('错误', '生成失败，请检查网络连接');
    }
  };

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
    setQueue((prev) => prev.map((q, i) => (i === idx ? { ...q, status: 'generating', content: '' } : q)));
    handleGenerate(item.outline, item.chapterNumber);
  };

  // 保存为章节
  const handleSaveAsChapter = () => {
    if (!content.trim()) {
      Alert.alert('提示', '先生成正文后再保存');
      return;
    }
    setNovelName(`第${chapterNumber}章`);
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
      title: `第${item.chapterNumber}章`,
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

  const AGENT_STEPS = ['世界观构建', '人物设定', '情节设计', '正文生成', '审核校对'];

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

              <View style={styles.outlineSection}>
                <Text style={styles.sectionLabel}>章纲</Text>
                <TextInput
                  style={styles.outlineInput}
                  placeholder="输入本章章纲，描述本章主要情节..."
                  placeholderTextColor="#555"
                  value={outlineInput}
                  onChangeText={setOutlineInput}
                  multiline
                />
              </View>

              <TouchableOpacity
                style={[styles.generateBtn, isGenerating && styles.generateBtnDisabled]}
                onPress={() => handleGenerate()}
                disabled={isGenerating}
              >
                {isGenerating ? (
                  <ActivityIndicator color="#000" />
                ) : (
                  <>
                    <Ionicons name="bulb" size={20} color="#000" />
                    <Text style={styles.generateBtnText}>开始创作</Text>
                  </>
                )}
              </TouchableOpacity>

              {isGenerating && (
                <View style={styles.agentStatus}>
                  <Text style={styles.agentStatusTitle}>AI创作进度</Text>
                  <View style={styles.agentSteps}>
                    {AGENT_STEPS.map((step, idx) => (
                      <View key={idx} style={styles.agentStepItem}>
                        <View style={[styles.stepDot, currentStep >= idx && styles.stepDotActive]} />
                        <Text style={[styles.stepText, currentStep >= idx && styles.stepTextActive]}>
                          {step}
                        </Text>
                      </View>
                    ))}
                  </View>
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
                  <Text style={styles.emptyText}>输入章纲，点击开始创作</Text>
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
                          <TouchableOpacity
                            style={styles.queueActionBtn}
                            onPress={() => handleRegenerateQueueItem(idx)}
                          >
                            <Ionicons name="refresh" size={18} color="#fbbf24" />
                          </TouchableOpacity>
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

                  {/* 章纲输入 */}
                  <TextInput
                    style={styles.queueOutlineInput}
                    placeholder="输入章纲..."
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
                  {currentStep >= 0 && (
                    <Text style={styles.currentStepText}>
                      当前步骤：{AGENT_STEPS[Math.min(currentStep, AGENT_STEPS.length - 1)]}
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
                placeholder="输入章节名称"
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
  outlineInput: {
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
    padding: 14,
    color: '#fff',
    fontSize: 15,
    minHeight: 60,
    textAlignVertical: 'top',
    borderWidth: 1,
    borderColor: '#333',
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
  stepDotActive: { backgroundColor: '#fff' },
  stepText: { color: '#555', fontSize: 11 },
  stepTextActive: { color: '#fff' },
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
