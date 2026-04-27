import { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  Pressable,
  StyleSheet,
  Modal,
  Alert,
} from 'react-native';
import { Screen } from '@/components/Screen';
import { Feather } from '@expo/vector-icons';
import { useSafeRouter } from '@/hooks/useSafeRouter';

interface ChapterOutline {
  id: string;
  chapterNumber: number;
  outline: string;
  createdAt: string;
  updatedAt: string;
}

export default function OutlineScreen() {
  const router = useSafeRouter();
  const [chapters, setChapters] = useState<ChapterOutline[]>([
    { id: '1', chapterNumber: 1, outline: '主角张远穿越到异世界，在废墟中醒来...', createdAt: '2024-01-01', updatedAt: '2024-01-01' },
  ]);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingChapter, setEditingChapter] = useState<ChapterOutline | null>(null);
  const [chapterNumber, setChapterNumber] = useState('');
  const [outline, setOutline] = useState('');
  const [confirmModalVisible, setConfirmModalVisible] = useState(false);
  const [selectedChapter, setSelectedChapter] = useState<ChapterOutline | null>(null);

  const handleAddChapter = () => {
    setEditingChapter(null);
    setChapterNumber(String(chapters.length + 1));
    setOutline('');
    setModalVisible(true);
  };

  const handleEditChapter = (chapter: ChapterOutline) => {
    setEditingChapter(chapter);
    setChapterNumber(String(chapter.chapterNumber));
    setOutline(chapter.outline);
    setModalVisible(true);
  };

  const handleSaveChapter = () => {
    if (!chapterNumber || !outline) {
      Alert.alert('提示', '请填写章节号和章纲');
      return;
    }

    if (editingChapter) {
      setChapters(prev =>
        prev.map(c =>
          c.id === editingChapter.id
            ? { ...c, chapterNumber: parseInt(chapterNumber), outline, updatedAt: new Date().toISOString() }
            : c
        )
      );
    } else {
      const newChapter: ChapterOutline = {
        id: Date.now().toString(),
        chapterNumber: parseInt(chapterNumber),
        outline,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      setChapters(prev => [...prev, newChapter].sort((a, b) => a.chapterNumber - b.chapterNumber));
    }
    setModalVisible(false);
  };

  const handleStartWriting = (chapter: ChapterOutline) => {
    setSelectedChapter(chapter);
    setConfirmModalVisible(true);
  };

  const confirmStartWriting = () => {
    setConfirmModalVisible(false);
    router.push('/writing', {
      chapterId: selectedChapter!.id,
      chapterNumber: String(selectedChapter!.chapterNumber),
      outline: selectedChapter!.outline,
    });
  };

  const handleDeleteChapter = (id: string) => {
    Alert.alert('删除', '确定删除该章节?', [
      { text: '取消', style: 'cancel' },
      {
        text: '删除',
        style: 'destructive',
        onPress: () => setChapters(prev => prev.filter(c => c.id !== id)),
      },
    ]);
  };

  return (
    <Screen>
      <View style={styles.header}>
        <Text style={styles.greeting}>小说工作台</Text>
        <Text style={styles.title}>粗纲管理</Text>
      </View>

      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        {chapters.length === 0 ? (
          <View style={styles.emptyState}>
            <Feather name="file-text" size={48} color="#CCCCCC" />
            <Text style={styles.emptyText}>暂无章节</Text>
            <Text style={styles.emptyHint}>点击下方按钮添加章节</Text>
          </View>
        ) : (
          chapters.map(chapter => (
            <View key={chapter.id} style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.chapterNumber}>第{chapter.chapterNumber}章</Text>
                <View style={styles.cardActions}>
                  <Pressable onPress={() => handleEditChapter(chapter)} style={styles.actionBtn}>
                    <Feather name="edit-2" size={16} color="#888888" />
                  </Pressable>
                  <Pressable onPress={() => handleDeleteChapter(chapter.id)} style={styles.actionBtn}>
                    <Feather name="trash-2" size={16} color="#888888" />
                  </Pressable>
                </View>
              </View>
              <Text style={styles.outlineText} numberOfLines={3}>{chapter.outline}</Text>
              <View style={styles.cardFooter}>
                <Text style={styles.dateText}>{chapter.updatedAt.split('T')[0]}</Text>
                <Pressable style={styles.startBtn} onPress={() => handleStartWriting(chapter)}>
                  <Text style={styles.startBtnText}>开始写作</Text>
                </Pressable>
              </View>
            </View>
          ))
        )}
        <View style={styles.bottomSpacer} />
      </ScrollView>

      <Pressable style={styles.fab} onPress={handleAddChapter}>
        <Feather name="plus" size={24} color="#FFFFFF" />
      </Pressable>

      {/* 添加/编辑章节弹窗 */}
      <Modal visible={modalVisible} transparent animationType="fade">
        <Pressable style={styles.modalOverlay} onPress={() => setModalVisible(false)}>
          <Pressable style={styles.modalContent} onPress={e => e.stopPropagation()}>
            <Text style={styles.modalTitle}>{editingChapter ? '编辑章节' : '新增章节'}</Text>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>章节号</Text>
              <TextInput
                style={styles.input}
                value={chapterNumber}
                onChangeText={setChapterNumber}
                placeholder="如: 1"
                placeholderTextColor="#CCCCCC"
                keyboardType="numeric"
              />
            </View>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>章纲内容</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={outline}
                onChangeText={setOutline}
                placeholder="输入本章章纲..."
                placeholderTextColor="#CCCCCC"
                multiline
                numberOfLines={6}
                textAlignVertical="top"
              />
            </View>
            <View style={styles.modalActions}>
              <Pressable style={styles.cancelBtn} onPress={() => setModalVisible(false)}>
                <Text style={styles.cancelBtnText}>取消</Text>
              </Pressable>
              <Pressable style={styles.saveBtn} onPress={handleSaveChapter}>
                <Text style={styles.saveBtnText}>保存</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* 开始写作确认弹窗 */}
      <Modal visible={confirmModalVisible} transparent animationType="fade">
        <Pressable style={styles.modalOverlay} onPress={() => setConfirmModalVisible(false)}>
          <Pressable style={styles.confirmContent} onPress={e => e.stopPropagation()}>
            <Feather name="alert-circle" size={48} color="#111111" />
            <Text style={styles.confirmTitle}>确认开始写作</Text>
            <Text style={styles.confirmText}>是否开始写作第{selectedChapter?.chapterNumber}章?</Text>
            <View style={styles.modalActions}>
              <Pressable style={styles.cancelBtn} onPress={() => setConfirmModalVisible(false)}>
                <Text style={styles.cancelBtnText}>取消</Text>
              </Pressable>
              <Pressable style={styles.saveBtn} onPress={confirmStartWriting}>
                <Text style={styles.saveBtnText}>确认</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
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
  greeting: {
    fontSize: 13,
    color: '#888888',
    fontWeight: '500',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#111111',
    marginTop: 4,
    letterSpacing: -0.5,
  },
  container: {
    flex: 1,
    paddingHorizontal: 24,
  },
  emptyState: {
    alignItems: 'center',
    paddingTop: 80,
  },
  emptyText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#111111',
    marginTop: 16,
  },
  emptyHint: {
    fontSize: 14,
    color: '#888888',
    marginTop: 8,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#ECECEC',
    padding: 20,
    marginBottom: 16,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  chapterNumber: {
    fontSize: 12,
    fontWeight: '600',
    color: '#888888',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  cardActions: {
    flexDirection: 'row',
    gap: 12,
  },
  actionBtn: {
    padding: 4,
  },
  outlineText: {
    fontSize: 15,
    color: '#111111',
    lineHeight: 22,
    marginBottom: 16,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dateText: {
    fontSize: 12,
    color: '#CCCCCC',
  },
  startBtn: {
    backgroundColor: '#111111',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  startBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  bottomSpacer: {
    height: 100,
  },
  fab: {
    position: 'absolute',
    right: 24,
    bottom: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#111111',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    width: '85%',
    maxWidth: 400,
  },
  confirmContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 32,
    width: '85%',
    maxWidth: 320,
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111111',
    marginBottom: 24,
    textAlign: 'center',
  },
  confirmTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111111',
    marginTop: 16,
    marginBottom: 8,
  },
  confirmText: {
    fontSize: 15,
    color: '#888888',
    marginBottom: 24,
    textAlign: 'center',
  },
  inputGroup: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#888888',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  input: {
    backgroundColor: '#F7F7F7',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#111111',
  },
  textArea: {
    minHeight: 120,
    paddingTop: 16,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  cancelBtn: {
    flex: 1,
    backgroundColor: '#F7F7F7',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  cancelBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111111',
  },
  saveBtn: {
    flex: 1,
    backgroundColor: '#111111',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  saveBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
