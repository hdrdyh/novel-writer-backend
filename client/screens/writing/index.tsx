import { useState, useEffect, useRef, useCallback } from 'react';
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
} from 'react-native';
import { Screen } from '@/components/Screen';
import { Feather } from '@expo/vector-icons';
import { useSafeSearchParams, useSafeRouter } from '@/hooks/useSafeRouter';
import { useFocusEffect } from 'expo-router';

export default function WritingScreen() {
  const params = useSafeSearchParams<{
    chapterId?: string;
    chapterNumber?: string;
    outline?: string;
  }>();
  const router = useSafeRouter();
  const scrollRef = useRef<ScrollView>(null);
  const contentScrollRef = useRef<ScrollView>(null);  // 生成内容的滚动引用

  const [chapterNum, setChapterNum] = useState('');  // 跳转后为空状态
  const [chapterOutline, setChapterOutline] = useState('');  // 跳转后为空状态
  const [content, setContent] = useState('');
  const [editedContent, setEditedContent] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [savedChapters, setSavedChapters] = useState<string[]>([]);
  const [generationProgress, setGenerationProgress] = useState('');
  const [currentChapterInfo, setCurrentChapterInfo] = useState('');  // 当前写作的章节信息

  // 每次进入页面时清空状态，确保是新的一章
  useFocusEffect(
    useCallback(() => {
      setContent('');
      setEditedContent('');
      setIsGenerating(false);
      setIsEditMode(false);
      setGenerationProgress('');
      setCurrentChapterInfo('');
      setSavedChapters([]);
      setChapterNum('');
      setChapterOutline('');
    }, [])
  );

  // 模拟流式生成的示例内容
  const mockNovelContent = `春风拂过青石镇，带来泥土与野花的气息。

张远站在废墟之中，四周是断壁残垣。曾经繁华的街道如今杂草丛生，只剩下几座摇摇欲坠的木屋。

"这里就是异世界？"他低头看着自己身上的现代服装，嘴角泛起苦笑。

就在这时，一道苍老的声音从身后传来："年轻人，你是来参加觉醒仪式的吗？"

张远转身，只见一位白发老者拄着拐杖，浑浊的眼睛里却闪烁着精光。老者身后，还站着十几个和他年龄相仿的少年少女。

"觉醒仪式？"张远心中一动。

老者点头道："这个世界，力量才是一切。只有觉醒灵脉，才能成为真正的强者。"

远处传来阵阵喧嚣，似乎有什么大事即将发生。

张远握紧了拳头，眼中闪过一丝期待的光芒。`;

  const handleGenerate = () => {
    if (!chapterOutline) {
      Alert.alert('提示', '请先输入章纲内容');
      return;
    }

    Alert.alert(
      '确认开始写作',
      `是否开始写作第${chapterNum || '?'}章？`,
      [
        { text: '取消', style: 'cancel' },
        {
          text: '确认',
          onPress: () => {
            startGenerating();
          },
        },
      ]
    );
  };

  const startGenerating = () => {
    setIsGenerating(true);
    setContent('');
    setEditedContent('');
    setGenerationProgress('');

    // 模拟流式输出
    let index = 0;
    const timer = setInterval(() => {
      if (index < mockNovelContent.length) {
        const chunk = mockNovelContent[index];
        setContent(prev => prev + chunk);
        setGenerationProgress(`已生成 ${index + 1}/${mockNovelContent.length} 字`);
        index++;
        // 滚动到底部
        setTimeout(() => {
          contentScrollRef.current?.scrollToEnd({ animated: true });
        }, 10);
      } else {
        clearInterval(timer);
        setIsGenerating(false);
        setGenerationProgress('生成完成');
        setEditedContent(mockNovelContent);
      }
    }, 30);  // 加快速度
  };

  const handleSave = () => {
    if (!content) {
      Alert.alert('提示', '请先生成内容');
      return;
    }

    Alert.alert(
      '保存到记忆库',
      '确定将本章保存到记忆库？',
      [
        { text: '取消', style: 'cancel' },
        {
          text: '保存',
          onPress: async () => {
            setIsSaving(true);
            // 模拟保存
            setTimeout(() => {
              setSavedChapters(prev => [...prev, `第${chapterNum}章`]);
              setIsSaving(false);
              Alert.alert('成功', `第${chapterNum}章已存入记忆库`, [
                {
                  text: '确定',
                  onPress: () => {
                    // 保存成功后清空所有内容
                    setContent('');
                    setEditedContent('');
                    setChapterOutline('');
                    setCurrentChapterInfo('');
                  }
                }
              ]);
            }, 500);
          },
        },
      ]
    );
  };

  const handleEdit = () => {
    setIsEditMode(true);
    setEditedContent(content);
  };

  const handleSaveEdit = () => {
    setContent(editedContent);
    setIsEditMode(false);
    Alert.alert('已保存修改');
  };

  const handleCancelEdit = () => {
    setIsEditMode(false);
    setEditedContent(content);
  };

  const handleReset = () => {
    Alert.alert(
      '重新生成',
      '确定要重新生成本章内容吗？',
      [
        { text: '取消', style: 'cancel' },
        {
          text: '确定',
          onPress: () => {
            setContent('');
            setEditedContent('');
            startGenerating();
          },
        },
      ]
    );
  };

  return (
    <Screen>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <Text style={styles.title}>写作台</Text>
            {savedChapters.includes(`第${chapterNum}章`) && (
              <View style={styles.savedBadge}>
                <Feather name="check-circle" size={14} color="#059669" />
                <Text style={styles.savedBadgeText}>已保存</Text>
              </View>
            )}
          </View>
          {isGenerating && (
            <Text style={styles.progressText}>{generationProgress}</Text>
          )}
        </View>

        <ScrollView
          ref={scrollRef}
          style={styles.container}
          contentContainerStyle={styles.contentContainer}
          showsVerticalScrollIndicator={false}
        >
          {/* 章纲输入区 */}
          <View style={styles.outlineSection}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>本章章纲</Text>
              <Text style={styles.chapterBadge}>第{chapterNum || '?'}章</Text>
            </View>
            <View style={styles.outlineCard}>
              <TextInput
                style={styles.outlineInput}
                value={chapterOutline}
                onChangeText={setChapterOutline}
                placeholder="输入本章章纲..."
                placeholderTextColor="#CCCCCC"
                multiline
              />
            </View>
          </View>

          {/* 内容生成区 */}
          <View style={styles.contentSection}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>正文</Text>
              {content.length > 0 && (
                <Text style={styles.wordCount}>{content.length} 字</Text>
              )}
            </View>

            {isGenerating ? (
              <View style={styles.generatingCard}>
                <View style={styles.generatingIndicator}>
                  <Feather name="feather" size={24} color="#111111" />
                  <Text style={styles.generatingText}>正在写作...</Text>
                </View>
                <ScrollView ref={contentScrollRef} style={styles.generatingContent} showsVerticalScrollIndicator={false}>
                  <Text style={styles.generatedText}>{content}</Text>
                  <View style={styles.cursor} />
                </ScrollView>
              </View>
            ) : isEditMode ? (
              <View style={styles.editCard}>
                <TextInput
                  style={styles.editInput}
                  value={editedContent}
                  onChangeText={setEditedContent}
                  multiline
                  autoFocus
                />
              </View>
            ) : content ? (
              <Pressable style={styles.contentCard} onPress={handleEdit}>
                <Text style={styles.contentText}>{content}</Text>
                <View style={styles.editHint}>
                  <Feather name="edit-2" size={12} color="#888888" />
                  <Text style={styles.editHintText}>点击编辑</Text>
                </View>
              </Pressable>
            ) : (
              <View style={styles.emptyCard}>
                <Feather name="file-plus" size={48} color="#CCCCCC" />
                <Text style={styles.emptyText}>点击下方按钮开始写作</Text>
              </View>
            )}
          </View>

          <View style={styles.bottomSpacer} />
        </ScrollView>

        {/* 底部操作区 */}
        <View style={styles.actionBar}>
          {isGenerating ? (
            <View style={styles.generatingBar}>
              <View style={styles.generatingDots}>
                <View style={styles.dot} />
                <View style={[styles.dot, styles.dotActive]} />
                <View style={styles.dot} />
              </View>
              <Text style={styles.generatingLabel}>AI 写作中</Text>
            </View>
          ) : isEditMode ? (
            <View style={styles.editBar}>
              <Pressable style={styles.cancelEditBtn} onPress={handleCancelEdit}>
                <Text style={styles.cancelEditText}>取消</Text>
              </Pressable>
              <Pressable style={styles.saveEditBtn} onPress={handleSaveEdit}>
                <Text style={styles.saveEditText}>保存修改</Text>
              </Pressable>
            </View>
          ) : content ? (
            <View style={styles.contentActions}>
              <Pressable style={styles.secondaryBtn} onPress={handleReset}>
                <Feather name="refresh-cw" size={16} color="#111111" />
                <Text style={styles.secondaryBtnText}>重新生成</Text>
              </Pressable>
              <Pressable style={styles.secondaryBtn} onPress={handleEdit}>
                <Feather name="edit-3" size={16} color="#111111" />
                <Text style={styles.secondaryBtnText}>修改</Text>
              </Pressable>
              <Pressable
                style={[styles.primaryBtn, isSaving && styles.primaryBtnDisabled]}
                onPress={handleSave}
                disabled={isSaving}
              >
                <Feather name="download" size={16} color="#FFFFFF" />
                <Text style={styles.primaryBtnText}>
                  {isSaving ? '保存中...' : '保存到记忆库'}
                </Text>
              </Pressable>
            </View>
          ) : (
            <Pressable style={styles.generateBtn} onPress={handleGenerate}>
              <Feather name="feather" size={20} color="#FFFFFF" />
              <Text style={styles.generateBtnText}>开始写作</Text>
            </Pressable>
          )}
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 16,
    backgroundColor: '#FFFFFF',
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#111111',
    letterSpacing: -0.5,
  },
  savedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  savedBadgeText: {
    fontSize: 12,
    color: '#059669',
    fontWeight: '600',
  },
  progressText: {
    fontSize: 13,
    color: '#888888',
    marginTop: 8,
  },
  container: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: 24,
    paddingBottom: 20,
  },
  outlineSection: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#888888',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  chapterBadge: {
    fontSize: 12,
    fontWeight: '600',
    color: '#111111',
    backgroundColor: '#F7F7F7',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  wordCount: {
    fontSize: 12,
    color: '#888888',
  },
  outlineCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#ECECEC',
    padding: 16,
    minHeight: 80,
  },
  outlineInput: {
    fontSize: 15,
    color: '#111111',
    lineHeight: 22,
  },
  contentSection: {
    flex: 1,
  },
  generatingCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#ECECEC',
    padding: 16,
    minHeight: 300,
  },
  generatingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#ECECEC',
  },
  generatingText: {
    fontSize: 14,
    color: '#888888',
  },
  generatingContent: {
    minHeight: 200,
    maxHeight: 400,
  },
  generatedText: {
    fontSize: 15,
    color: '#111111',
    lineHeight: 26,
  },
  cursor: {
    width: 2,
    height: 16,
    backgroundColor: '#111111',
    marginTop: 2,
  },
  editCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#111111',
    padding: 16,
    minHeight: 300,
  },
  editInput: {
    fontSize: 15,
    color: '#111111',
    lineHeight: 26,
    minHeight: 280,
  },
  contentCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#ECECEC',
    padding: 16,
    minHeight: 300,
  },
  contentText: {
    fontSize: 15,
    color: '#111111',
    lineHeight: 26,
  },
  editHint: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#ECECEC',
  },
  editHintText: {
    fontSize: 12,
    color: '#888888',
  },
  emptyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#ECECEC',
    padding: 48,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: '#888888',
    marginTop: 16,
  },
  bottomSpacer: {
    height: 20,
  },
  actionBar: {
    backgroundColor: '#FFFFFF',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#ECECEC',
    paddingHorizontal: 24,
    paddingVertical: 16,
    paddingBottom: 24,
  },
  generateBtn: {
    backgroundColor: '#111111',
    borderRadius: 12,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  generateBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  generatingBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  generatingDots: {
    flexDirection: 'row',
    gap: 6,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#CCCCCC',
  },
  dotActive: {
    backgroundColor: '#111111',
  },
  generatingLabel: {
    fontSize: 14,
    color: '#888888',
  },
  editBar: {
    flexDirection: 'row',
    gap: 12,
  },
  cancelEditBtn: {
    flex: 1,
    backgroundColor: '#F7F7F7',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  cancelEditText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111111',
  },
  saveEditBtn: {
    flex: 2,
    backgroundColor: '#111111',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  saveEditText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  contentActions: {
    flexDirection: 'row',
    gap: 8,
  },
  secondaryBtn: {
    backgroundColor: '#F7F7F7',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  secondaryBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#111111',
  },
  primaryBtn: {
    backgroundColor: '#111111',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
    justifyContent: 'center',
  },
  primaryBtnDisabled: {
    opacity: 0.6,
  },
  primaryBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
