import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useFocusEffect } from 'expo-router';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  Pressable,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Modal,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
} from 'react-native';
import { GC, GlassCardStyle } from '@/utils/glassColors';
import { useSafeRouter } from '@/hooks/useSafeRouter';
import { Screen } from '@/components/Screen';
import { Feather } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { orchestrateAgents, type AgentStepResult, type CoordinatorReport } from '@/utils/agentOrchestrator';
import { getActiveAgentsForStage, type PresetAgent } from '@/utils/presetAgents';

type OutlineStage = 'outline' | 'rough' | 'detail';

interface OutlineData {
  outline: string; // 大纲：整体骨架
  rough: string[]; // 粗纲：每章一句话
  detail: string[]; // 细纲：每章展开
  stage: OutlineStage; // 当前锁定到哪层
  outlineLocked: boolean;
  roughLocked: boolean;
  detailLocked: boolean;
  targetChapters: number; // 目标章节数
  title: string; // 小说名
}

const STORAGE_KEY = 'outline_data';

// ===== 粗纲解析 =====
// 支持格式：第X章：xxx / 第X章 xxx / 1. xxx / 一、xxx / 纯文本每行一章
function parseRoughOutline(text: string, targetChapters: number): string[] {
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  const chapters: string[] = [];

  for (const line of lines) {
    // 跳过纯标题行（只有"第X章"没有内容的）
    if (/^第[零一二三四五六七八九十百千\d]+章$/.test(line)) continue;
    // 跳过字数标记
    if (/^[\d约]+字$/.test(line)) continue;
    // 跳过Markdown标题标记
    if (/^#{1,3}\s/.test(line) && line.length < 10) continue;

    // 移除章节编号前缀，保留内容
    const cleaned = line
      .replace(/^第[零一二三四五六七八九十百千\d]+章[：:，,、]?\s*/, '')  // "第1章：xxx" → "xxx"
      .replace(/^\d+[、.．)\]]\s*/, '')                                      // "1. xxx" → "xxx"
      .replace(/^[零一二三四五六七八九十百千]+[、.．)\]]\s*/, '')              // "一、xxx" → "xxx"
      .replace(/^[-*]\s*/, '')                                                // "- xxx" → "xxx"
      .trim();

    if (cleaned.length > 0) {
      chapters.push(cleaned);
    }
  }

  // 如果解析出来的章数远超目标，截取
  if (targetChapters > 0 && chapters.length > targetChapters * 1.5) {
    return chapters.slice(0, targetChapters);
  }

  return chapters;
}

// ===== 细纲解析 =====
// 支持格式：===第X章=== / 第X章(分隔符) / Markdown ## 等
function parseDetailOutline(text: string, targetChapters: number): string[] {
  // 尝试按章节分隔符拆分
  const chapterPatterns = [
    /===第[零一二三四五六七八九十百千\d]+章===/g,
    /---第[零一二三四五六七八九十百千\d]+章---/g,
    /#{2,3}\s*第[零一二三四五六七八九十百千\d]+章/g,
  ];

  let bestSplit: string[] | null = null;

  for (const pattern of chapterPatterns) {
    const matches = [...text.matchAll(pattern)];
    if (matches.length >= 1) {
      // 按分隔符拆分
      const parts: string[] = [];
      for (let i = 0; i < matches.length; i++) {
        const start = matches[i].index! + matches[i][0].length;
        const end = i + 1 < matches.length ? matches[i + 1].index! : text.length;
        const content = text.slice(start, end).trim();
        if (content) parts.push(content);
      }
      if (parts.length >= 1) {
        bestSplit = parts;
        break;
      }
    }
  }

  if (bestSplit) {
    if (targetChapters > 0 && bestSplit.length > targetChapters * 1.5) {
      return bestSplit.slice(0, targetChapters);
    }
    return bestSplit;
  }

  // 没有明确的分隔符，尝试按"第X章"行拆分
  const lines = text.split('\n');
  const chapters: string[] = [];
  let currentChapter = '';

  for (const line of lines) {
    const trimmed = line.trim();
    // 遇到"第X章"开头的行，且当前已有内容，开始新章节
    if (/^第[零一二三四五六七八九十百千\d]+章[：:，,、\s]/.test(trimmed) && currentChapter.trim()) {
      chapters.push(currentChapter.trim());
      currentChapter = trimmed.replace(/^第[零一二三四五六七八九十百千\d]+章[：:，,、]?\s*/, '') + '\n';
    } else if (/^第[零一二三四五六七八九十百千\d]+章[：:，,、\s]/.test(trimmed)) {
      currentChapter = trimmed.replace(/^第[零一二三四五六七八九十百千\d]+章[：:，,、]?\s*/, '') + '\n';
    } else {
      // 跳过纯标题行和字数标记
      if (/^第[零一二三四五六七八九十百千\d]+章$/.test(trimmed)) continue;
      if (/^[\d约]+字$/.test(trimmed)) continue;
      currentChapter += line + '\n';
    }
  }
  if (currentChapter.trim()) {
    chapters.push(currentChapter.trim());
  }

  if (chapters.length >= 1) {
    if (targetChapters > 0 && chapters.length > targetChapters * 1.5) {
      return chapters.slice(0, targetChapters);
    }
    return chapters;
  }

  // 最后兜底：按行分割（每行一条）
  return parseRoughOutline(text, targetChapters);
}

export default function OutlineScreen() {
  const router = useSafeRouter();
  const [data, setData] = useState<OutlineData>({
    outline: '',
    rough: [],
    detail: [],
    stage: 'outline',
    outlineLocked: false,
    roughLocked: false,
    detailLocked: false,
    targetChapters: 300,
    title: '',
  });
  const [loading, setLoading] = useState(false);
  const [editIndex, setEditIndex] = useState(-1); // 当前编辑的粗纲/细纲索引
  const [editStage, setEditStage] = useState<'rough' | 'detail'>('rough'); // 当前编辑的是粗纲还是细纲
  const [editText, setEditText] = useState('');
  const [targetInput, setTargetInput] = useState(String(data.targetChapters || 300));
  useEffect(() => { setTargetInput(String(data.targetChapters || 300)); }, [data.targetChapters]);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [importModalVisible, setImportModalVisible] = useState(false);
  const [importStage, setImportStage] = useState<OutlineStage>('outline');
  const [importText, setImportText] = useState('');

  // 加载本地数据
  const loadData = useCallback(async () => {
    try {
      const saved = await AsyncStorage.getItem(STORAGE_KEY);
      if (saved) {
        setData(JSON.parse(saved));
      }
    } catch (e) {
      // 忽略
    }
  }, []);

  const saveData = useCallback(async (newData: OutlineData) => {
    setData(newData);
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(newData));
    } catch (e) {
      // 忽略
    }
  }, []);

  // 页面聚焦时加载数据（从反向大纲返回后也能刷新）
  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  // Agent 协作进度
  const [activeAgentNames, setActiveAgentNames] = useState<string[]>([]);
  const [currentAgentIdx, setCurrentAgentIdx] = useState(-1);
  const abortRef = useRef(false);

  // AI扩写 - 使用 agentOrchestrator 编排
  const handleAIExpand = useCallback(async (stage: OutlineStage) => {
    setLoading(true);
    setCurrentAgentIdx(0);
    abortRef.current = false;

    // 构建上下文：粗纲阶段传大纲，细纲阶段传粗纲(主)+大纲(辅)
    let context = '';
    let secondaryContext = '';
    if (stage === 'outline') {
      // 大纲阶段：用小说名+目标章节数作为种子
      const novelInfo = data.title ? `小说名：《${data.title}》` : '';
      const targetInfo = data.targetChapters ? `目标章节数：${data.targetChapters}章` : '';
      const existingOutline = data.outline ? `\n已有大纲内容：\n${data.outline}` : '';
      context = `${novelInfo}\n${targetInfo}${existingOutline}`;
    } else if (stage === 'rough') {
      context = data.outline;
      // 如果用户已有粗纲草稿，也传入供参考
      if (data.rough.length > 0) {
        context += '\n\n【已有粗纲草稿】\n' + data.rough.join('\n');
      }
    } else {
      // detail: 主内容=粗纲，辅助=大纲
      context = data.rough.join('\n');
      secondaryContext = data.outline;
      // 如果用户已有细纲草稿，也传入供参考
      if (data.detail.length > 0) {
        context += '\n\n【已有细纲草稿】\n' + data.detail.join('\n');
      }
    }

    let finalContent = '';
    let hasError = false;

    try {
      await orchestrateAgents({
        stage: stage === 'outline' ? 'outline' : stage === 'rough' ? 'rough' : 'detail',
        context,
        secondaryContext,
        targetChapters: data.targetChapters,
        novelName: data.title,
        previousContent: '',
        onAgentStart: (name: string, idx: number, _total: number) => {
          setCurrentAgentIdx(idx);
          setActiveAgentNames(prev => {
            const next = [...prev];
            next[idx] = name;
            return next;
          });
        },
        onAgentChunk: (_chunk: string, _agentId: string) => {
          // 大纲扩写不需要实时显示
        },
        onAgentComplete: (_agentName: string) => { /* 大纲扩写不需要逐Agent回调 */ },
        onAllComplete: (_report: CoordinatorReport, allOutputs: AgentStepResult[]) => {
          if (stage === 'outline') {
            // 大纲阶段：合并世界架构师+剧情设计师的输出
            const worldOut = allOutputs.find(o => o.agentId === 'world_architect');
            const plotOut = allOutputs.find(o => o.agentId === 'plot_designer');
            const parts: string[] = [];
            if (worldOut && worldOut.output.trim()) {
              parts.push('【世界观设定】\n' + worldOut.output.trim());
            }
            if (plotOut && plotOut.output.trim()) {
              parts.push('【剧情设计】\n' + plotOut.output.trim());
            }
            finalContent = parts.join('\n\n');
            // 兜底：如果合并后为空，取最后一个非统筹Agent输出
            if (!finalContent.trim()) {
              const contentAgent = allOutputs.filter(o => o.agentId !== 'coordinator').pop();
              if (contentAgent) finalContent = contentAgent.output;
            }
          } else {
            // 粗纲/细纲阶段：取对应设计师的输出
            const designerId = stage === 'rough' ? 'rough_designer' : 'detail_designer';
            const designer = allOutputs.find(o => o.agentId === designerId);
            if (designer && designer.output.trim()) {
              finalContent = designer.output;
            } else {
              // 兜底：取最后一个非统筹Agent输出
              const contentAgent = allOutputs.filter(o => o.agentId !== 'coordinator').pop();
              if (contentAgent) finalContent = contentAgent.output;
            }
          }
        },
        onError: (error: string) => {
          hasError = true;
          Alert.alert('AI扩写失败', error);
        },
      });

      if (hasError) return;

      if (!finalContent.trim()) {
        Alert.alert('提示', 'AI扩写返回内容为空');
        return;
      }

      if (stage === 'outline') {
        saveData({ ...data, outline: finalContent });
      } else if (stage === 'rough') {
        const chapters = parseRoughOutline(finalContent, data.targetChapters);
        if (chapters.length === 0) {
          Alert.alert('提示', 'AI扩写未能解析出章节粗纲，请重试或手动输入');
          return;
        }
        saveData({ ...data, rough: chapters });
      } else {
        const details = parseDetailOutline(finalContent, data.targetChapters);
        if (details.length === 0) {
          Alert.alert('提示', 'AI扩写未能解析出章节细纲，请重试或手动输入');
          return;
        }
        saveData({ ...data, detail: details });
      }
    } catch (e: any) {
      Alert.alert('AI扩写失败', e.message || '请检查API配置');
    } finally {
      setLoading(false);
      setCurrentAgentIdx(-1);
      setActiveAgentNames([]);
    }
  }, [data, saveData]);

  // 定稿
  const handleLock = useCallback((stage: OutlineStage) => {
    const updates: Partial<OutlineData> = {};
    if (stage === 'outline') updates.outlineLocked = true;
    if (stage === 'rough') updates.roughLocked = true;
    if (stage === 'detail') updates.detailLocked = true;
    saveData({ ...data, ...updates });
  }, [data, saveData]);

  // 解锁（重新编辑）
  const handleUnlock = useCallback((stage: OutlineStage) => {
    Alert.alert('解锁', '解锁后下层内容将清空，确定？', [
      { text: '取消', style: 'cancel' },
      {
        text: '确定',
        style: 'destructive',
        onPress: () => {
          const updates: Partial<OutlineData> = {};
          if (stage === 'outline') {
            updates.outlineLocked = false;
            updates.roughLocked = false;
            updates.detailLocked = false;
            updates.rough = [];
            updates.detail = [];
          } else if (stage === 'rough') {
            updates.roughLocked = false;
            updates.detailLocked = false;
            updates.detail = [];
          } else {
            updates.detailLocked = false;
          }
          saveData({ ...data, ...updates });
        },
      },
    ]);
  }, [data, saveData]);

  // 跳转AI评审
  const handleReview = useCallback((stage: OutlineStage) => {
    let content = '';
    if (stage === 'outline') content = data.outline;
    else if (stage === 'rough') content = data.rough.join('\n');
    else content = data.detail.join('\n');

    router.push('/outline-review', {
      content,
      stage,
    });
  }, [data, router]);

  // 编辑粗纲/细纲条目
  const handleEditItem = useCallback((stage: 'rough' | 'detail', index: number) => {
    const list = stage === 'rough' ? data.rough : data.detail;
    setEditIndex(index);
    setEditStage(stage);
    setEditText(list[index] || '');
    setEditModalVisible(true);
  }, [data]);

  const handleSaveItem = useCallback((stage: 'rough' | 'detail') => {
    if (stage === 'rough') {
      const newRough = [...data.rough];
      newRough[editIndex] = editText;
      saveData({ ...data, rough: newRough });
    } else {
      const newDetail = [...data.detail];
      newDetail[editIndex] = editText;
      saveData({ ...data, detail: newDetail });
    }
    setEditModalVisible(false);
  }, [data, editIndex, editText, saveData]);

  // 开始写作
  const handleStartWriting = useCallback(() => {
    router.push('/writing', {
      outline: data.outline,
      rough: JSON.stringify(data.rough),
      detail: JSON.stringify(data.detail),
      novelName: data.title || '',
    });
  }, [data, router]);

  // 导入文本
  const handleImport = useCallback((stage: OutlineStage) => {
    setImportStage(stage);
    setImportText('');
    setImportModalVisible(true);
  }, []);

  const handleImportSave = useCallback(() => {
    if (!importText.trim()) {
      Alert.alert('提示', '请粘贴内容');
      return;
    }
    if (importStage === 'outline') {
      saveData({ ...data, outline: importText.trim() });
    } else if (importStage === 'rough') {
      const lines = importText.split('\n').filter((l: string) => l.trim());
      saveData({ ...data, rough: lines });
    } else {
      const lines = importText.split('\n').filter((l: string) => l.trim());
      saveData({ ...data, detail: lines });
    }
    setImportModalVisible(false);
  }, [importText, importStage, data, saveData]);

  // 渲染阶段卡片
  const renderStageCard = (
    stage: OutlineStage,
    title: string,
    subtitle: string,
    icon: string,
    locked: boolean,
    canEdit: boolean,
    content: React.ReactNode,
  ) => (
    <View style={[styles.stageCard, locked && styles.stageCardLocked]}>
      <View style={styles.stageHeader}>
        <View style={styles.stageTitleRow}>
          <View style={styles.stageIcon}>
            <Feather name={icon as any} size={20} color="#fff" />
          </View>
          <View style={styles.stageTitleCol}>
            <Text style={styles.stageTitle}>{title}</Text>
            <Text style={styles.stageSubtitle}>{subtitle}</Text>
          </View>
          {locked && (
            <View style={styles.lockedBadge}>
              <Feather name="lock" size={12} color="#62FAD3" />
              <Text style={styles.lockedText}>已定稿</Text>
            </View>
          )}
        </View>
        <View style={styles.stageActions}>
          {!locked && canEdit && (
            <Pressable style={styles.importBtn} onPress={() => handleImport(stage)}>
              <Feather name="upload" size={14} color="#fff" />
              <Text style={styles.importBtnText}>导入</Text>
            </Pressable>
          )}
          {!locked && canEdit && (
            <Pressable style={styles.aiBtn} onPress={() => handleAIExpand(stage)} disabled={loading}>
              {loading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Feather name="zap" size={14} color="#fff" />
              )}
              <Text style={styles.aiBtnText}>AI扩写</Text>
            </Pressable>
          )}
          {!locked && canEdit && (
            <Pressable style={styles.reviewBtn} onPress={() => handleReview(stage)}>
              <Feather name="message-circle" size={14} color="#fff" />
              <Text style={styles.reviewBtnText}>AI评审</Text>
            </Pressable>
          )}
          {!locked && canEdit && (
            <Pressable style={styles.lockBtn} onPress={() => handleLock(stage)}>
              <Feather name="check-circle" size={14} color="#62FAD3" />
              <Text style={styles.lockBtnText}>定稿</Text>
            </Pressable>
          )}
          {locked && (
            <Pressable style={styles.unlockBtn} onPress={() => handleUnlock(stage)}>
              <Feather name="unlock" size={14} color="#8888AA" />
              <Text style={styles.unlockBtnText}>解锁</Text>
            </Pressable>
          )}
        </View>
      </View>
      {content}
      {loading && activeAgentNames.length > 0 && (
        <View style={styles.agentProgressContainer}>
          <View style={styles.agentProgressBar}>
            <View style={[styles.agentProgressFill, { width: `${((currentAgentIdx + 1) / activeAgentNames.length) * 100}%` }]} />
          </View>
          <Text style={styles.agentProgressText}>
            协作进度 {currentAgentIdx + 1}/{activeAgentNames.length}: {activeAgentNames[currentAgentIdx] || '处理中...'}
          </Text>
        </View>
      )}
    </View>
  );

  return (
    <Screen style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.greeting}>创作空间</Text>
        <Text style={styles.title}>大纲设计</Text>
        <Text style={styles.subtitle}>大纲 → 粗纲 → 细纲，逐层打磨</Text>
      </View>

      <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
        {/* 小说名 */}
        <View style={styles.novelNameRow}>
          <Feather name="book" size={16} color="#8888AA" />
          <TextInput
            style={styles.novelNameInput}
            placeholder="输入小说名称"
            placeholderTextColor="#6B6B8D"
            value={data.title}
            onChangeText={(text: string) => saveData({ ...data, title: text })}
          />
        </View>
        {/* 第一层：大纲 */}
        {renderStageCard(
          'outline',
          '大纲',
          data.outline ? `${data.outline.length}字` : '整本书的骨架，起承转合',
          'book-open',
          data.outlineLocked,
          true,
          <View style={styles.outlineEditArea}>
            <TextInput
              style={styles.outlineInput}
              value={data.outline}
              onChangeText={(text) => saveData({ ...data, outline: text })}
              placeholder="写出你的核心概念，AI帮你扩展为完整大纲..."
              placeholderTextColor="#6B6B8D"
              multiline
              numberOfLines={8}
              textAlignVertical="top"
              editable={!data.outlineLocked}
            />
          </View>
        )}

        {/* 第二层：粗纲 */}
        {renderStageCard(
          'rough',
          '粗纲',
          `${data.rough.length}章 / 目标${data.targetChapters || 300}章`,
          'list',
          data.roughLocked,
          data.outlineLocked,
          <View style={styles.listArea}>
            {/* 目标章节数输入 */}
            {!data.roughLocked && (
              <View style={styles.chapterCountRow}>
                <Text style={styles.chapterCountLabel}>目标章节数</Text>
                <TextInput
                  style={styles.chapterCountInput}
                  value={targetInput}
                  onChangeText={(text) => {
                    setTargetInput(text);
                    const num = parseInt(text, 10);
                    if (!isNaN(num) && num > 0) {
                      saveData({ ...data, targetChapters: num });
                    }
                  }}
                  keyboardType="numeric"
                  placeholder="300"
                  placeholderTextColor="#6B6B8D"
                  maxLength={5}
                />
                <Text style={styles.chapterCountUnit}>章</Text>
              </View>
            )}
            {data.rough.length === 0 ? (
              <Text style={styles.hintText}>
                {data.outlineLocked ? '大纲已定稿，点AI扩写生成粗纲' : '请先定稿大纲'}
              </Text>
            ) : (
              data.rough.map((item, idx) => (
                <Pressable
                  key={idx}
                  style={styles.listItem}
                  onPress={() => !data.roughLocked && handleEditItem('rough', idx)}
                  disabled={data.roughLocked}
                >
                  <View style={styles.listItemNum}>
                    <Text style={styles.listItemNumText}>{idx + 1}</Text>
                  </View>
                  <Text style={styles.listItemText} numberOfLines={2}>{item}</Text>
                  {!data.roughLocked && (
                    <Feather name="edit-2" size={14} color="#8888AA" style={styles.listItemIcon} />
                  )}
                </Pressable>
              ))
            )}
            {!data.roughLocked && data.rough.length > 0 && (
              <Pressable style={styles.addItemBtn} onPress={() => {
                saveData({ ...data, rough: [...data.rough, ''] });
                setEditIndex(data.rough.length);
                setEditText('');
                setEditModalVisible(true);
              }}>
                <Feather name="plus" size={16} color="#8888AA" />
                <Text style={styles.addItemText}>添加章节</Text>
              </Pressable>
            )}
          </View>
        )}

        {/* 第三层：细纲 */}
        {renderStageCard(
          'detail',
          '细纲',
          `${data.detail.length}章`,
          'file-text',
          data.detailLocked,
          data.roughLocked,
          <View style={styles.listArea}>
            {data.detail.length === 0 ? (
              <Text style={styles.hintText}>
                {data.roughLocked ? '粗纲已定稿，点AI扩写生成细纲' : '请先定稿粗纲'}
              </Text>
            ) : (
              data.detail.map((item, idx) => (
                <Pressable
                  key={idx}
                  style={styles.listItem}
                  onPress={() => !data.detailLocked && handleEditItem('detail', idx)}
                  disabled={data.detailLocked}
                >
                  <View style={styles.listItemNum}>
                    <Text style={styles.listItemNumText}>{idx + 1}</Text>
                  </View>
                  <Text style={styles.listItemText} numberOfLines={3}>{item}</Text>
                  {!data.detailLocked && (
                    <Feather name="edit-2" size={14} color="#8888AA" style={styles.listItemIcon} />
                  )}
                </Pressable>
              ))
            )}
          </View>
        )}

        {/* 开始写作按钮 */}
        {data.detailLocked && (
          <Pressable style={styles.startWritingBtn} onPress={handleStartWriting}>
            <Feather name="pen-tool" size={20} color="#fff" />
            <Text style={styles.startWritingText}>开始写作</Text>
          </Pressable>
        )}

        <View style={styles.bottomSpacer} />
      </ScrollView>

      {/* 编辑条目弹窗 */}
      {editModalVisible && (
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>编辑</Text>
            <TextInput
              style={styles.modalInput}
              value={editText}
              onChangeText={setEditText}
              placeholder="输入内容..."
              placeholderTextColor="#6B6B8D"
              multiline
              numberOfLines={6}
              textAlignVertical="top"
              autoFocus
            />
            <View style={styles.modalActions}>
              <Pressable style={styles.cancelBtn} onPress={() => setEditModalVisible(false)}>
                <Text style={styles.cancelBtnText}>取消</Text>
              </Pressable>
              <Pressable
                style={styles.saveBtn}
                onPress={() => {
                  handleSaveItem(editStage);
                }}
              >
                <Text style={styles.saveBtnText}>保存</Text>
              </Pressable>
            </View>
          </View>
        </View>
      )}

      {/* 导入Modal */}
      <Modal visible={importModalVisible} transparent animationType="slide">
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>
                  导入{importStage === 'outline' ? '大纲' : importStage === 'rough' ? '粗纲' : '细纲'}
                </Text>
                <Pressable onPress={() => setImportModalVisible(false)}>
                  <Feather name="x" size={22} color="#8888AA" />
                </Pressable>
              </View>
              <View style={styles.modalBody}>
                <Text style={{ color: GC.textSecondary, fontSize: 13, marginBottom: 8 }}>
                  {importStage === 'outline'
                    ? '粘贴大纲内容，整体骨架文本'
                    : importStage === 'rough'
                      ? '粘贴粗纲，每行一条章节概括'
                      : '粘贴细纲，每行一条章节详细情节'}
                </Text>
                <TextInput
                  style={[styles.textArea, { flex: 1 }]}
                  multiline
                  textAlignVertical="top"
                  value={importText}
                  onChangeText={setImportText}
                  placeholder={importStage === 'outline' ? '粘贴大纲内容...' : '每行一条，粘贴内容...'}
                  placeholderTextColor="#6B6B8D"
                  autoCapitalize="none"
                />
              </View>
              <View style={styles.modalFooter}>
                <Pressable style={styles.cancelBtn} onPress={() => setImportModalVisible(false)}>
                  <Text style={styles.cancelBtnText}>取消</Text>
                </Pressable>
                <Pressable style={styles.saveBtn} onPress={handleImportSave}>
                  <Text style={styles.saveBtnText}>导入</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: GC.bgBase,
  },
  header: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 20,
  },
  greeting: {
    fontSize: 14,
    color: GC.textSecondary,
    fontWeight: '600',
    letterSpacing: 2,
  },
  novelNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: GC.bgElevated,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 6,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: GC.border,
  },
  novelNameInput: {
    flex: 1,
    color: GC.textPrimary,
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 10,
    paddingVertical: 6,
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
    color: GC.textPrimary,
    marginTop: 8,
  },
  subtitle: {
    fontSize: 14,
    color: GC.textSecondary,
    marginTop: 6,
  },
  list: {
    flex: 1,
    paddingHorizontal: 24,
  },
  stageCard: {
    backgroundColor: GC.bgElevated,
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: GC.border,
  },
  stageCardLocked: {
    borderColor: GC.success,
    borderLeftWidth: 3,
  },
  stageHeader: {
    marginBottom: 16,
  },
  stageTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  stageIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: GC.border,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  stageTitleCol: {
    flex: 1,
  },
  stageTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: GC.textPrimary,
  },
  stageSubtitle: {
    fontSize: 12,
    color: GC.textSecondary,
    marginTop: 2,
  },
  lockedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(74, 222, 128, 0.15)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  lockedText: {
    fontSize: 12,
    color: GC.success,
    fontWeight: '600',
  },
  stageActions: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  importBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: GC.border,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    gap: 6,
  },
  importBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: GC.textPrimary,
  },
  aiBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: GC.primary,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    gap: 6,
  },
  aiBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: GC.textPrimary,
  },
  reviewBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: GC.border,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    gap: 6,
  },
  reviewBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: GC.textPrimary,
  },
  lockBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    gap: 6,
    backgroundColor: 'rgba(74, 222, 128, 0.15)',
  },
  lockBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: GC.success,
  },
  unlockBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    gap: 6,
    backgroundColor: GC.bgElevated,
    borderWidth: 1,
    borderColor: GC.border,
  },
  unlockBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: GC.textSecondary,
  },
  outlineEditArea: {
    marginTop: 4,
  },
  outlineInput: {
    backgroundColor: GC.bgBase,
    borderRadius: 12,
    padding: 16,
    fontSize: 15,
    color: GC.textPrimary,
    lineHeight: 24,
    minHeight: 180,
    borderWidth: 1,
    borderColor: GC.border,
  },
  listArea: {
    marginTop: 4,
  },
  hintText: {
    fontSize: 14,
    color: GC.textTertiary,
    textAlign: 'center',
    paddingVertical: 24,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: GC.bgBase,
    borderRadius: 10,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: GC.border,
  },
  listItemNum: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: GC.border,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  listItemNumText: {
    fontSize: 12,
    fontWeight: '700',
    color: GC.textPrimary,
  },
  listItemText: {
    flex: 1,
    fontSize: 14,
    color: GC.textSecondary,
    lineHeight: 20,
  },
  listItemIcon: {
    marginLeft: 8,
  },
  chapterCountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 8,
    backgroundColor: GC.bgElevated,
    borderRadius: 8,
    gap: 8,
  },
  chapterCountLabel: {
    color: GC.textSecondary,
    fontSize: 13,
  },
  chapterCountInput: {
    flex: 1,
    color: GC.textPrimary,
    fontSize: 15,
    fontWeight: '600',
    textAlign: 'center',
    paddingVertical: 4,
    paddingHorizontal: 8,
    backgroundColor: GC.bgElevated,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: GC.border,
  },
  chapterCountUnit: {
    color: GC.textSecondary,
    fontSize: 13,
  },
  addItemBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: GC.border,
    borderStyle: 'dashed',
    gap: 6,
    marginTop: 4,
  },
  addItemText: {
    fontSize: 14,
    color: GC.textSecondary,
  },
  startWritingBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: GC.primary,
    borderRadius: 14,
    paddingVertical: 18,
    gap: 10,
    marginBottom: 20,
  },
  startWritingText: {
    fontSize: 18,
    fontWeight: '800',
    color: GC.textPrimary,
  },
  bottomSpacer: {
    height: 40,
  },
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: GC.bgElevated,
    borderRadius: 16,
    padding: 24,
    width: '90%',
    borderWidth: 1,
    borderColor: GC.border,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: GC.textPrimary,
    marginBottom: 16,
  },
  modalInput: {
    backgroundColor: GC.bgBase,
    borderRadius: 10,
    padding: 16,
    fontSize: 15,
    color: GC.textPrimary,
    minHeight: 150,
    borderWidth: 1,
    borderColor: GC.border,
    textAlignVertical: 'top',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
  cancelBtn: {
    flex: 1,
    backgroundColor: GC.border,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  cancelBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: GC.textSecondary,
  },
  saveBtn: {
    flex: 1,
    backgroundColor: GC.primary,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  saveBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: GC.textPrimary,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalBody: {
    flex: 1,
  },
  textArea: {
    backgroundColor: GC.bgElevated,
    borderRadius: 12,
    padding: 16,
    fontSize: 14,
    color: GC.textPrimary,
    minHeight: 200,
    textAlignVertical: 'top',
  },
  modalFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    marginTop: 16,
  },
  agentProgressContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'rgba(124, 92, 255, 0.1)',
    borderRadius: 8,
    marginTop: 8,
  },
  agentProgressBar: {
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  agentProgressFill: {
    height: '100%',
    backgroundColor: GC.accent,
    borderRadius: 2,
  },
  agentProgressText: {
    color: GC.accent,
    fontSize: 12,
    marginTop: 6,
  },
});
