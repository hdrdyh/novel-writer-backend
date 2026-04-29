import { useState, useRef, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  Pressable,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Modal,
} from 'react-native';
import { Screen } from '@/components/Screen';
import { Feather } from '@expo/vector-icons';
import { useSafeSearchParams, useSafeRouter } from '@/hooks/useSafeRouter';
import { useFocusEffect } from 'expo-router';
import RNSSE from 'react-native-sse';
import { AgentStatusIcon } from '@/components/AgentStatusMonitor';
import AsyncStorage from '@react-native-async-storage/async-storage';

// 云端后端地址
const API_BASE_URL = 'https://novel-writer-backend-production-24e9.up.railway.app';

// LLM配置（DeepSeek）
const LLM_API_KEY = 'sk-2d333ed0b01a4fe899df1c7c6cbe5617';
const LLM_MODEL = 'deepseek-v4-flash';
const LLM_BASE_URL = 'https://api.deepseek.com';

// Agent步骤
const AGENT_STEPS = ['世界观构建', '人物设定', '情节设计', '正文生成', '审核校对', '记忆存档'];

// 生成章节ID
const generateChapterId = () => `ch-${Date.now()}`;

// 保存章节到书架
const saveChapterToBookshelf = async (
  content: string,
  chapterNum: string,
  chapterOutline: string,
  novelId?: string,
  novelTitle?: string,
  existingChapters: any[] = [],
  existingNovels: any[] = []
) => {
  const now = Date.now();
  const nowISO = new Date().toISOString();
  const newChapter = {
    id: now.toString(),
    novelId: novelId || 'default',
    novelTitle: novelTitle || '默认小说',
    chapterNumber: parseInt(chapterNum) || 1,
    chapterTitle: `第${chapterNum}章`,
    outline: chapterOutline,
    content: content,
    summary: content.slice(0, 200),
    createdAt: nowISO,
  };
  
  await AsyncStorage.setItem('bookshelf_chapters', JSON.stringify([newChapter, ...existingChapters]));
  
  if (novelId === 'new' && novelTitle) {
    const newNovel = { id: novelId, title: novelTitle };
    await AsyncStorage.setItem('bookshelf_novels', JSON.stringify([newNovel, ...existingNovels]));
  }
};

export default function WritingScreen() {
  const params = useSafeSearchParams<{ chapterId?: string; chapterNumber?: string; outline?: string }>();
  const contentScrollRef = useRef<ScrollView>(null);

  // 状态
  const [chapterNum, setChapterNum] = useState('1');
  const [chapterOutline, setChapterOutline] = useState('');
  const [content, setContent] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentStep, setCurrentStep] = useState(-1);
  const [progressText, setProgressText] = useState('');
  const [isEditMode, setIsEditMode] = useState(false);
  const [editedContent, setEditedContent] = useState('');
  const [saved, setSaved] = useState(false);
  const [memoryContext, setMemoryContext] = useState<string[]>([]);
  const [agentCount, setAgentCount] = useState(3);
  
  // 书架相关状态
  const [showBookshelfModal, setShowBookshelfModal] = useState(false);
  const [novels, setNovels] = useState<{id: string; title: string}[]>([]);
  const [newBookTitle, setNewBookTitle] = useState('');

  // 加载书架小说列表
  useEffect(() => {
    const loadNovels = async () => {
      try {
        const data = await AsyncStorage.getItem('bookshelf_novels');
        if (data) {
          setNovels(JSON.parse(data));
        }
      } catch (e) {}
    };
    loadNovels();
  }, []);

  // 保存章节到书架
  const handleSaveToBookshelf = async (novelId?: string, novelTitle?: string) => {
    if (!content) return;
    
    try {
      const chaptersStr = await AsyncStorage.getItem('bookshelf_chapters');
      const novelsStr = await AsyncStorage.getItem('bookshelf_novels');
      const existingChapters = chaptersStr ? JSON.parse(chaptersStr) : [];
      const existingNovels = novelsStr ? JSON.parse(novelsStr) : [];
      
      await saveChapterToBookshelf(content, chapterNum, chapterOutline, novelId, novelTitle, existingChapters, existingNovels);
      
      Alert.alert('保存成功', `已保存到「${novelTitle || '默认小说'}」第${chapterNum}章`, [
        { text: '确定' }
      ]);
      setShowBookshelfModal(false);
      setNewBookTitle('');
    } catch (e) {
      Alert.alert('保存失败', '无法保存到书架');
    }
  };

  // 步骤名称映射（根据agentCount动态）
  const getStepNames = () => {
    const steps = ['世界观构建', '人物设定', '情节设计', '正文生成'];
    if (agentCount >= 5) steps.push('审核校对');
    if (agentCount >= 6) steps.push('记忆存档');
    return steps;
  };

  const stepNameMap: Record<string, number> = {};

  // 初始化steps
  const AGENT_STEPS = getStepNames();
  
  // 初始化stepNameMap
  useEffect(() => {
    const names = getStepNames();
    names.forEach((name, i) => { stepNameMap[name] = i; });
  }, [agentCount]);

  // 重置状态
  useFocusEffect(
    useCallback(() => {
      if (params.chapterNumber && params.outline) {
        setChapterNum(params.chapterNumber);
        setChapterOutline(params.outline);
      }
      setContent('');
      setIsGenerating(false);
      setCurrentStep(-1);
      setProgressText('');
      setSaved(false);
    }, [params.chapterNumber, params.outline])
  );

  // 开始生成
  const startGenerating = () => {
    if (!chapterOutline.trim()) {
      Alert.alert('提示', '请输入章纲');
      return;
    }

    setIsGenerating(true);
    setContent('');
    setCurrentStep(0);
    setSaved(false);
    setProgressText('连接服务器...');

    const requestChapterId = generateChapterId();
    const sse = new RNSSE(`${API_BASE_URL}/api/v1/writing/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': LLM_API_KEY,
        'x-model': LLM_MODEL,
        'x-base-url': LLM_BASE_URL,
      },
      body: JSON.stringify({
        chapterId: requestChapterId,
        chapterNumber: parseInt(chapterNum) || 1,
        outline: chapterOutline,
        memoryContext: memoryContext,
        agentCount: agentCount,
      }),
    });

    sse.addEventListener('message', (event) => {
      try {
        if (!event.data) return;
        const data = JSON.parse(event.data);

        if (data.type === 'step') {
          const idx = data.stepIndex ?? stepNameMap[data.stepName] ?? 0;
          setCurrentStep(idx);
          setProgressText(data.stepName || '处理中');
        } else if (data.type === 'done') {
          sse.close();
          setIsGenerating(false);
          setCurrentStep(6);
          setProgressText('完成');
        } else if (data.error) {
          sse.close();
          setIsGenerating(false);
          setCurrentStep(-1);
          setProgressText('失败');
          Alert.alert('错误', data.error);
        } else if (data.content) {
          setContent(prev => prev + data.content);
          setProgressText(`生成中 ${(content + data.content).length} 字`);
          setTimeout(() => contentScrollRef.current?.scrollToEnd({ animated: false }), 10);
        }
      } catch (e) { /* ignore */ }
    });

    sse.addEventListener('error', () => {
      setIsGenerating(false);
      setCurrentStep(-1);
      setProgressText('连接失败');
      Alert.alert('错误', '无法连接服务器');
    });

    sse.addEventListener('close', () => {
      if (isGenerating) {
        setIsGenerating(false);
        setCurrentStep(-1);
      }
    });
  };

  // 保存并加入记忆上下文
  const handleSave = () => {
    if (!content) return;
    // 保存本章前500字作为记忆
    const summary = content.slice(0, 500);
    setMemoryContext(prev => [...prev, summary]);
    Alert.alert('保存成功', `第${chapterNum}章已存入记忆库（衔接上下文已更新）`, [
      { text: '确定', onPress: () => setSaved(true) }
    ]);
  };

  // 编辑
  const handleEdit = () => {
    setEditedContent(content);
    setIsEditMode(true);
  };

  const handleSaveEdit = () => {
    setContent(editedContent);
    setIsEditMode(false);
  };

  return (
    <Screen>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {/* 顶部 */}
        <View style={styles.header}>
          <View style={styles.headerRow}>
            <Text style={styles.title}>写作台</Text>
            <AgentStatusIcon
              currentStep={currentStep >= 0 ? AGENT_STEPS[currentStep] : '待机'}
              isRunning={isGenerating}
              stepCount={currentStep}
              totalSteps={AGENT_STEPS.length}
            />
          </View>
          {isGenerating && (
            <View style={styles.progressRow}>
              <View style={styles.stepDots}>
                {AGENT_STEPS.map((_, i) => (
                  <View key={i} style={[
                    styles.dot,
                    i < currentStep && styles.dotDone,
                    i === currentStep && styles.dotActive,
                  ]} />
                ))}
              </View>
              <Text style={styles.progressText}>{progressText}</Text>
            </View>
          )}
        </View>

        {/* 内容区 */}
        <ScrollView ref={contentScrollRef} style={styles.container} contentContainerStyle={styles.contentContainer}>
          {/* Agent数量选择 */}
          <View style={styles.agentRow}>
            <Text style={styles.label}>Agent数量：</Text>
            <View style={styles.agentButtons}>
              {[1, 2, 3, 4, 5, 6].map((n) => (
                <Pressable
                  key={n}
                  style={[styles.agentBtn, agentCount === n && styles.agentBtnActive]}
                  onPress={() => !isGenerating && setAgentCount(n)}
                  disabled={isGenerating}
                >
                  <Text style={[styles.agentBtnText, agentCount === n && styles.agentBtnTextActive]}>{n}</Text>
                </Pressable>
              ))}
            </View>
          </View>

          {/* 章号 */}
          <View style={styles.numRow}>
            <Text style={styles.label}>第</Text>
            <TextInput
              style={styles.numInput}
              value={chapterNum}
              onChangeText={setChapterNum}
              keyboardType="number-pad"
              editable={!isGenerating}
            />
            <Text style={styles.label}>章</Text>
          </View>

          {/* 章纲 */}
          <Text style={styles.sectionLabel}>章纲</Text>
          <TextInput
            style={styles.outlineInput}
            value={chapterOutline}
            onChangeText={setChapterOutline}
            placeholder="输入本章章纲..."
            placeholderTextColor="#CCCCCC"
            multiline
            editable={!isGenerating}
          />

          {/* 正文 */}
          <Text style={styles.sectionLabel}>
            正文 {content.length > 0 && <Text style={styles.wordCount}>{content.length}字</Text>}
          </Text>

          {isGenerating ? (
            <View style={styles.contentBox}>
              <Text style={styles.generatedText}>{content}</Text>
              <View style={styles.cursor} />
            </View>
          ) : isEditMode ? (
            <TextInput
              style={[styles.contentBox, styles.editInput]}
              value={editedContent}
              onChangeText={setEditedContent}
              multiline
              autoFocus
            />
          ) : content ? (
            <Pressable style={styles.contentBox} onPress={handleEdit}>
              <Text style={styles.generatedText}>{content}</Text>
              <Text style={styles.editHint}>点击编辑</Text>
            </Pressable>
          ) : (
            <View style={styles.emptyBox}>
              <Feather name="feather" size={32} color="#DDDDDD" />
              <Text style={styles.emptyText}>输入章纲后点击开始写作</Text>
            </View>
          )}
        </ScrollView>

        {/* 底部按钮 */}
        <View style={styles.actionBar}>
          {isGenerating ? (
            <View style={styles.generatingBar}>
              <View style={styles.loadingDots}>
                <View style={styles.loadDot} />
                <View style={[styles.loadDot, styles.loadDotActive]} />
                <View style={styles.loadDot} />
              </View>
              <Text style={styles.generatingText}>写作中...</Text>
            </View>
          ) : isEditMode ? (
            <View style={styles.editBar}>
              <Pressable style={styles.cancelBtn} onPress={() => setIsEditMode(false)}>
                <Text style={styles.cancelText}>取消</Text>
              </Pressable>
              <Pressable style={styles.saveBtn} onPress={handleSaveEdit}>
                <Text style={styles.saveText}>保存</Text>
              </Pressable>
            </View>
          ) : content ? (
            <View style={styles.doneBar3}>
              <Pressable style={styles.editBtn} onPress={handleEdit}>
                <Text style={styles.editText}>修改</Text>
              </Pressable>
              <Pressable style={[styles.saveToLibBtn, saved && styles.savedBtn]} onPress={handleSave}>
                <Feather name="check-circle" size={16} color={saved ? '#FFFFFF' : '#111111'} />
                <Text style={[styles.saveToLibText, saved && styles.savedText]}>
                  {saved ? '已保存' : '存入记忆库'}
                </Text>
              </Pressable>
              <Pressable style={styles.saveToShelfBtn} onPress={() => setShowBookshelfModal(true)}>
                <Feather name="bookmark" size={16} color="#FFFFFF" />
                <Text style={styles.saveToShelfText}>保存到书架</Text>
              </Pressable>
            </View>
          ) : (
            <Pressable style={styles.startBtn} onPress={startGenerating}>
              <Feather name="feather" size={18} color="#FFFFFF" />
              <Text style={styles.startText}>开始写作</Text>
            </Pressable>
          )}
        </View>

        {/* 保存到书架弹窗 */}
        <Modal visible={showBookshelfModal} transparent animationType="fade">
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>保存到书架</Text>
                <Pressable onPress={() => setShowBookshelfModal(false)}>
                  <Feather name="x" size={20} color="#666666" />
                </Pressable>
              </View>
              
              <Text style={styles.modalSubtitle}>选择保存到哪本书</Text>
              
              {novels.length > 0 ? (
                <ScrollView style={styles.novelList}>
                  {novels.map(novel => (
                    <Pressable key={novel.id} style={styles.novelItem} onPress={() => handleSaveToBookshelf(novel.id, novel.title)}>
                      <Feather name="book" size={16} color="#666666" />
                      <Text style={styles.novelTitle}>{novel.title}</Text>
                    </Pressable>
                  ))}
                  <Pressable style={styles.newBookItem} onPress={() => handleSaveToBookshelf('new', newBookTitle)}>
                    <Feather name="plus" size={16} color="#3B82F6" />
                    <TextInput
                      style={styles.newBookInput}
                      placeholder="创建新书..."
                      placeholderTextColor="#999999"
                      value={newBookTitle}
                      onChangeText={setNewBookTitle}
                    />
                  </Pressable>
                </ScrollView>
              ) : (
                <View style={styles.emptyNovelList}>
                  <Text style={styles.emptyText}>暂无小说</Text>
                  <TextInput
                    style={styles.newBookInput}
                    placeholder="输入书名创建新书..."
                    placeholderTextColor="#999999"
                    value={newBookTitle}
                    onChangeText={setNewBookTitle}
                  />
                  <Pressable style={styles.createBookBtn} onPress={() => handleSaveToBookshelf('new', newBookTitle)}>
                    <Text style={styles.createBookText}>创建并保存</Text>
                  </Pressable>
                </View>
              )}
            </View>
          </View>
        </Modal>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12, backgroundColor: '#FFFFFF' },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontSize: 24, fontWeight: '700', color: '#111111' },
  progressRow: { marginTop: 8 },
  stepDots: { flexDirection: 'row', gap: 6, marginBottom: 6 },
  dot: { width: 24, height: 6, borderRadius: 3, backgroundColor: '#EEEEEE' },
  dotDone: { backgroundColor: '#10B981' },
  dotActive: { backgroundColor: '#3B82F6' },
  progressText: { fontSize: 12, color: '#888888' },
  
  container: { flex: 1 },
  contentContainer: { padding: 20 },
  
  numRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  label: { fontSize: 15, color: '#666666' },
  numInput: { fontSize: 16, fontWeight: '600', color: '#111111', paddingHorizontal: 8, minWidth: 50, textAlign: 'center' },
  
  agentRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12, paddingVertical: 8, paddingHorizontal: 12, backgroundColor: '#F8F8F8', borderRadius: 10 },
  agentButtons: { flexDirection: 'row', gap: 6, marginLeft: 8 },
  agentBtn: { width: 32, height: 32, borderRadius: 6, backgroundColor: '#EEEEEE', alignItems: 'center', justifyContent: 'center' },
  agentBtnActive: { backgroundColor: '#111111' },
  agentBtnText: { fontSize: 14, fontWeight: '600', color: '#666666' },
  agentBtnTextActive: { color: '#FFFFFF' },
  
  sectionLabel: { fontSize: 13, fontWeight: '600', color: '#999999', marginBottom: 8 },
  wordCount: { fontWeight: '400', color: '#BBBBBB', marginLeft: 6 },
  
  outlineInput: {
    backgroundColor: '#F8F8F8', borderRadius: 10, padding: 12, fontSize: 14, color: '#111111',
    minHeight: 44, marginBottom: 12, lineHeight: 20,
  },
  
  contentBox: {
    backgroundColor: '#FFFFFF', borderRadius: 10, padding: 14, minHeight: 350,
    borderWidth: 1, borderColor: '#EEEEEE',
  },
  generatedText: { fontSize: 15, color: '#111111', lineHeight: 26 },
  cursor: { width: 2, height: 16, backgroundColor: '#111111', marginTop: 4 },
  editHint: { fontSize: 12, color: '#BBBBBB', textAlign: 'center', marginTop: 12 },
  editInput: { borderColor: '#111111', textAlignVertical: 'top', minHeight: 300 },
  
  emptyBox: { backgroundColor: '#F8F8F8', borderRadius: 10, padding: 40, alignItems: 'center' },
  emptyText: { fontSize: 14, color: '#BBBBBB', marginTop: 12 },
  
  actionBar: { backgroundColor: '#FFFFFF', paddingHorizontal: 20, paddingVertical: 16, borderTopWidth: 1, borderTopColor: '#F0F0F0' },
  
  startBtn: { backgroundColor: '#111111', borderRadius: 10, paddingVertical: 15, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  startText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
  
  generatingBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  loadingDots: { flexDirection: 'row', gap: 6 },
  loadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#DDDDDD' },
  loadDotActive: { backgroundColor: '#111111' },
  generatingText: { fontSize: 14, color: '#888888' },
  
  editBar: { flexDirection: 'row', gap: 12 },
  cancelBtn: { flex: 1, backgroundColor: '#F5F5F5', borderRadius: 10, paddingVertical: 14, alignItems: 'center' },
  cancelText: { fontSize: 15, fontWeight: '600', color: '#666666' },
  saveBtn: { flex: 2, backgroundColor: '#111111', borderRadius: 10, paddingVertical: 14, alignItems: 'center' },
  saveText: { fontSize: 15, fontWeight: '600', color: '#FFFFFF' },
  
  doneBar: { flexDirection: 'row', gap: 10 },
  editBtn: { flex: 1, backgroundColor: '#F5F5F5', borderRadius: 10, paddingVertical: 14, alignItems: 'center' },
  editText: { fontSize: 15, fontWeight: '600', color: '#666666' },
  saveToLibBtn: { flex: 2, backgroundColor: '#F5F5F5', borderRadius: 10, paddingVertical: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  saveToLibText: { fontSize: 15, fontWeight: '600', color: '#111111' },
  savedBtn: { backgroundColor: '#10B981' },
  savedText: { color: '#FFFFFF' },
  
  doneBar3: { flexDirection: 'row', gap: 8 },
  saveToShelfBtn: { flex: 1.2, backgroundColor: '#111111', borderRadius: 10, paddingVertical: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  saveToShelfText: { fontSize: 14, fontWeight: '600', color: '#FFFFFF' },
  
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 24, width: '85%', maxHeight: '70%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#111111' },
  modalSubtitle: { fontSize: 14, color: '#888888', marginBottom: 16 },
  novelList: { maxHeight: 300 },
  novelItem: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#F0F0F0' },
  novelTitle: { fontSize: 16, color: '#111111' },
  newBookItem: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14 },
  newBookInput: { flex: 1, fontSize: 16, color: '#111111', padding: 0 },
  emptyNovelList: { alignItems: 'center', paddingVertical: 20 },
  createBookBtn: { backgroundColor: '#3B82F6', borderRadius: 10, paddingVertical: 14, paddingHorizontal: 24, marginTop: 16 },
  createBookText: { fontSize: 15, fontWeight: '600', color: '#FFFFFF' },
});
