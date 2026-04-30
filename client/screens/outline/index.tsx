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

    // 构建上下文
    const targetOutline = stage === 'outline' ? data.outline :
      stage === 'rough' ? data.outline :
        data.rough.join('\n');

    let finalContent = '';

    try {
      await orchestrateAgents({
        stage: stage === 'outline' ? 'outline' : stage === 'rough' ? 'rough' : 'detail',
        context: targetOutline,
        previousContent: '',
        onAgentStart: (name: string, idx: number, _total: number) => {
          setCurrentAgentIdx(idx);
          setActiveAgentNames(prev => {
            const next = [...prev];
            next[idx] = name;
            return next;
          });
        },
        onAgentChunk: () => {
          // 大纲扩写不需要实时显示
        },
        onAgentComplete: (_agentName: string) => { /* 大纲扩写不需要逐Agent回调 */ },
        onAllComplete: (_report: CoordinatorReport, allOutputs: AgentStepResult[]) => {
          // 取最后一个非统筹Agent的输出作为最终内容
          const contentAgent = allOutputs.filter(o => o.agentId !== 'coordinator').pop();
          if (contentAgent) {
            finalContent = contentAgent.output;
          }
        },
        onError: (error: string) => {
          Alert.alert('AI扩写失败', error);
        },
      });

      if (!finalContent.trim()) {
        Alert.alert('提示', 'AI扩写返回内容为空');
        return;
      }

      if (stage === 'outline') {
        saveData({ ...data, outline: finalContent });
      } else if (stage === 'rough') {
        const lines = finalContent.split('\n').filter((l: string) => l.trim()).filter((l: string) => !/^[\d零一二三四五六七八九十百千]+[、.．]/.test(l.trim()) || l.length > 10);
        saveData({ ...data, rough: lines });
      } else {
        const rawLines = finalContent.split('\n').filter((l: string) => l.trim());
        const filtered: string[] = [];
        for (const line of rawLines) {
          const trimmed = line.trim();
          if (/^[\d约]+字$/.test(trimmed)) continue;
          if (/^第[零一二三四五六七八九十百千\d]+章$/.test(trimmed)) continue;
          filtered.push(trimmed);
        }
        saveData({ ...data, detail: filtered });
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
              <Feather name="lock" size={12} color="#4ade80" />
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
                <ActivityIndicator size="small" color="#000" />
              ) : (
                <Feather name="zap" size={14} color="#000" />
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
              <Feather name="check-circle" size={14} color="#4ade80" />
              <Text style={styles.lockBtnText}>定稿</Text>
            </Pressable>
          )}
          {locked && (
            <Pressable style={styles.unlockBtn} onPress={() => handleUnlock(stage)}>
              <Feather name="unlock" size={14} color="#888" />
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
            Agent {currentAgentIdx + 1}/{activeAgentNames.length}: {activeAgentNames[currentAgentIdx] || '处理中...'}
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
          <Feather name="book" size={16} color="#888" />
          <TextInput
            style={styles.novelNameInput}
            placeholder="输入小说名称"
            placeholderTextColor="#555"
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
              placeholderTextColor="#555"
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
                  placeholderTextColor="#555"
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
                    <Feather name="edit-2" size={14} color="#888" style={styles.listItemIcon} />
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
                <Feather name="plus" size={16} color="#888" />
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
                    <Feather name="edit-2" size={14} color="#888" style={styles.listItemIcon} />
                  )}
                </Pressable>
              ))
            )}
          </View>
        )}

        {/* 开始写作按钮 */}
        {data.detailLocked && (
          <Pressable style={styles.startWritingBtn} onPress={handleStartWriting}>
            <Feather name="pen-tool" size={20} color="#000" />
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
              placeholderTextColor="#555"
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
                  <Feather name="x" size={22} color="#888" />
                </Pressable>
              </View>
              <View style={styles.modalBody}>
                <Text style={{ color: '#888', fontSize: 13, marginBottom: 8 }}>
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
                  placeholderTextColor="#555"
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
    backgroundColor: '#000',
  },
  header: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 20,
  },
  greeting: {
    fontSize: 14,
    color: '#888',
    fontWeight: '600',
    letterSpacing: 2,
  },
  novelNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 6,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#333',
  },
  novelNameInput: {
    flex: 1,
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 10,
    paddingVertical: 6,
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
    color: '#fff',
    marginTop: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#888',
    marginTop: 6,
  },
  list: {
    flex: 1,
    paddingHorizontal: 24,
  },
  stageCard: {
    backgroundColor: '#1a1a1a',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#333',
  },
  stageCardLocked: {
    borderColor: '#4ade80',
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
    backgroundColor: '#333',
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
    color: '#fff',
  },
  stageSubtitle: {
    fontSize: 12,
    color: '#888',
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
    color: '#4ade80',
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
    backgroundColor: '#333',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    gap: 6,
  },
  importBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#fff',
  },
  aiBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    gap: 6,
  },
  aiBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#000',
  },
  reviewBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#333',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    gap: 6,
  },
  reviewBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#fff',
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
    color: '#4ade80',
  },
  unlockBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    gap: 6,
    backgroundColor: '#1a1a1a',
    borderWidth: 1,
    borderColor: '#333',
  },
  unlockBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#888',
  },
  outlineEditArea: {
    marginTop: 4,
  },
  outlineInput: {
    backgroundColor: '#000',
    borderRadius: 12,
    padding: 16,
    fontSize: 15,
    color: '#fff',
    lineHeight: 24,
    minHeight: 180,
    borderWidth: 1,
    borderColor: '#333',
  },
  listArea: {
    marginTop: 4,
  },
  hintText: {
    fontSize: 14,
    color: '#555',
    textAlign: 'center',
    paddingVertical: 24,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#000',
    borderRadius: 10,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#222',
  },
  listItemNum: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#333',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  listItemNumText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#fff',
  },
  listItemText: {
    flex: 1,
    fontSize: 14,
    color: '#ccc',
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
    backgroundColor: '#111',
    borderRadius: 8,
    gap: 8,
  },
  chapterCountLabel: {
    color: '#999',
    fontSize: 13,
  },
  chapterCountInput: {
    flex: 1,
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
    textAlign: 'center',
    paddingVertical: 4,
    paddingHorizontal: 8,
    backgroundColor: '#1a1a1a',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#333',
  },
  chapterCountUnit: {
    color: '#999',
    fontSize: 13,
  },
  addItemBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#333',
    borderStyle: 'dashed',
    gap: 6,
    marginTop: 4,
  },
  addItemText: {
    fontSize: 14,
    color: '#888',
  },
  startWritingBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    borderRadius: 14,
    paddingVertical: 18,
    gap: 10,
    marginBottom: 20,
  },
  startWritingText: {
    fontSize: 18,
    fontWeight: '800',
    color: '#000',
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
    backgroundColor: '#1a1a1a',
    borderRadius: 16,
    padding: 24,
    width: '90%',
    borderWidth: 1,
    borderColor: '#333',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#fff',
    marginBottom: 16,
  },
  modalInput: {
    backgroundColor: '#000',
    borderRadius: 10,
    padding: 16,
    fontSize: 15,
    color: '#fff',
    minHeight: 150,
    borderWidth: 1,
    borderColor: '#333',
    textAlignVertical: 'top',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
  cancelBtn: {
    flex: 1,
    backgroundColor: '#333',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  cancelBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#888',
  },
  saveBtn: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  saveBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#000',
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
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 16,
    fontSize: 14,
    color: '#fff',
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
    backgroundColor: '#7C5CFF',
    borderRadius: 2,
  },
  agentProgressText: {
    color: '#7C5CFF',
    fontSize: 12,
    marginTop: 6,
  },
});
