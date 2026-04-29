import { useState } from 'react';
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

interface ChapterOutline {
  id: string;
  chapterNumber: number;
  outline: string;
  createdAt: string;
  updatedAt: string;
}

export default function OutlineScreen() {
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
    <Screen style={styles.screen}>
      {/* 顶部标题区 */}
      <View style={styles.header}>
        <Text style={styles.greeting}>创作空间</Text>
        <Text style={styles.title}>章节粗纲</Text>
        <Text style={styles.subtitle}>{chapters.length} 个章节</Text>
      </View>

      {/* 章节列表 */}
      <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
        {chapters.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>📝</Text>
            <Text style={styles.emptyText}>暂无章节</Text>
            <Text style={styles.emptyHint}>点击下方按钮添加第一章节</Text>
          </View>
        ) : (
          chapters.map(chapter => (
            <View key={chapter.id} style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={styles.chapterBadge}>
                  <Text style={styles.chapterBadgeText}>第{chapter.chapterNumber}章</Text>
                </View>
                <View style={styles.cardActions}>
                  <Pressable onPress={() => handleEditChapter(chapter)} style={styles.actionBtn}>
                    <Feather name="edit-2" size={16} color="#8B8B9A" />
                  </Pressable>
                  <Pressable onPress={() => handleDeleteChapter(chapter.id)} style={styles.actionBtn}>
                    <Feather name="trash-2" size={16} color="#8B8B9A" />
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

      {/* 添加按钮 */}
      <Pressable style={styles.fab} onPress={handleAddChapter}>
        <Feather name="plus" size={28} color="#FFFFFF" />
      </Pressable>

      {/* 添加/编辑弹窗 */}
      <Modal visible={modalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{editingChapter ? '编辑章节' : '新增章节'}</Text>
            
            <Text style={styles.inputLabel}>章节号</Text>
            <TextInput
              style={styles.input}
              value={chapterNumber}
              onChangeText={setChapterNumber}
              placeholder="输入章节号"
              placeholderTextColor="#5C5C6E"
              keyboardType="numeric"
            />
            
            <Text style={styles.inputLabel}>章纲内容</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={outline}
              onChangeText={setOutline}
              placeholder="描述本章的核心情节..."
              placeholderTextColor="#5C5C6E"
              multiline
              numberOfLines={5}
              textAlignVertical="top"
            />
            
            <View style={styles.modalActions}>
              <Pressable style={styles.cancelBtn} onPress={() => setModalVisible(false)}>
                <Text style={styles.cancelBtnText}>取消</Text>
              </Pressable>
              <Pressable style={styles.saveBtn} onPress={handleSaveChapter}>
                <Text style={styles.saveBtnText}>保存</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* 确认弹窗 */}
      <Modal visible={confirmModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.confirmContent}>
            <View style={styles.confirmIcon}>
              <Feather name="play-circle" size={40} color="#6C63FF" />
            </View>
            <Text style={styles.confirmTitle}>开始写作</Text>
            <Text style={styles.confirmText}>确认开始写作第{selectedChapter?.chapterNumber}章？</Text>
            <View style={styles.modalActions}>
              <Pressable style={styles.cancelBtn} onPress={() => setConfirmModalVisible(false)}>
                <Text style={styles.cancelBtnText}>取消</Text>
              </Pressable>
              <Pressable style={styles.saveBtn} onPress={() => setConfirmModalVisible(false)}>
                <Text style={styles.saveBtnText}>确认</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#0D0D1A',
  },
  header: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 20,
  },
  greeting: {
    fontSize: 14,
    color: '#6C63FF',
    fontWeight: '600',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
    color: '#FFFFFF',
    marginTop: 8,
    letterSpacing: -1,
  },
  subtitle: {
    fontSize: 14,
    color: '#5C5C6E',
    marginTop: 6,
  },
  list: {
    flex: 1,
    paddingHorizontal: 24,
  },
  emptyState: {
    alignItems: 'center',
    paddingTop: 100,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyText: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  emptyHint: {
    fontSize: 14,
    color: '#5C5C6E',
  },
  card: {
    backgroundColor: '#1A1A2E',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#252540',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  chapterBadge: {
    backgroundColor: '#6C63FF',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 20,
  },
  chapterBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  cardActions: {
    flexDirection: 'row',
    gap: 16,
  },
  actionBtn: {
    padding: 4,
  },
  outlineText: {
    fontSize: 15,
    color: '#A0A0B0',
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
    color: '#5C5C6E',
  },
  startBtn: {
    backgroundColor: '#6C63FF',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 20,
  },
  startBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  bottomSpacer: {
    height: 120,
  },
  fab: {
    position: 'absolute',
    right: 24,
    bottom: 100,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#6C63FF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#6C63FF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#1A1A2E',
    borderRadius: 20,
    padding: 28,
    width: '88%',
    maxWidth: 400,
    borderWidth: 1,
    borderColor: '#252540',
  },
  confirmContent: {
    backgroundColor: '#1A1A2E',
    borderRadius: 20,
    padding: 32,
    width: '80%',
    maxWidth: 320,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#252540',
  },
  confirmIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#252540',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 24,
    textAlign: 'center',
  },
  confirmTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  confirmText: {
    fontSize: 15,
    color: '#8B8B9A',
    marginBottom: 24,
    textAlign: 'center',
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#8B8B9A',
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  input: {
    backgroundColor: '#0D0D1A',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#FFFFFF',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#252540',
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
    backgroundColor: '#252540',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  cancelBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#A0A0B0',
  },
  saveBtn: {
    flex: 1,
    backgroundColor: '#6C63FF',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  saveBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
