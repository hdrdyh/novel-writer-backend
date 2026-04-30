import { GC } from '@/utils/glassColors';
import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
  FlatList,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Pressable,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useSafeRouter } from '@/hooks/useSafeRouter';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Screen } from '@/components/Screen';
import { Ionicons, Feather } from '@expo/vector-icons';

interface NovelItem {
  id: string;
  title: string;
  chapterNumber: number;
  outline: string;
  content: string;
  createdAt: string;
  cover: string;
}

export default function BookshelfScreen() {
  const [novels, setNovels] = useState<NovelItem[]>([]);
  const [selectedNovel, setSelectedNovel] = useState<NovelItem | null>(null);
  const [showDetail, setShowDetail] = useState(false);
  const [importModalVisible, setImportModalVisible] = useState(false);
  const [importTitle, setImportTitle] = useState('');
  const [importContent, setImportContent] = useState('');
  const router = useSafeRouter();

  const loadNovels = useCallback(async () => {
    try {
      const data = await AsyncStorage.getItem('novels');
      if (data) setNovels(JSON.parse(data));
    } catch (e) {}
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadNovels();
    }, [loadNovels])
  );

  const handleDelete = (id: string) => {
    Alert.alert('确认删除', '确定要删除这本小说吗？', [
      { text: '取消', style: 'cancel' },
      {
        text: '删除',
        style: 'destructive',
        onPress: async () => {
          const updated = novels.filter((n) => n.id !== id);
          setNovels(updated);
          await AsyncStorage.setItem('novels', JSON.stringify(updated));
          await AsyncStorage.setItem('savedItems', JSON.stringify(updated));
          setShowDetail(false);
          setSelectedNovel(null);
        },
      },
    ]);
  };

  // 导入小说
  const handleImport = useCallback(async () => {
    if (!importTitle.trim() || !importContent.trim()) {
      Alert.alert('提示', '请填写标题和正文');
      return;
    }
    // 按空行分章
    const chapters = importContent.split(/\n\s*\n/).filter((c) => c.trim());
    const now = new Date().getTime().toString();
    const newNovel: NovelItem = {
      id: now,
      title: importTitle.trim(),
      chapterNumber: chapters.length,
      outline: `共${chapters.length}章（导入）`,
      content: importContent.trim(),
      createdAt: now,
      cover: '',
    };
    const updated = [newNovel, ...novels];
    setNovels(updated);
    await AsyncStorage.setItem('novels', JSON.stringify(updated));
    await AsyncStorage.setItem('savedItems', JSON.stringify(updated));
    setImportModalVisible(false);
    setImportTitle('');
    setImportContent('');
    Alert.alert('导入成功', `已导入《${newNovel.title}》，共${chapters.length}章`);
  }, [importTitle, importContent, novels]);

  // AI反推
  const handleReverseEngine = useCallback(
    async (novel: NovelItem) => {
      // 大内容通过AsyncStorage传递，避免路由参数过大
      await AsyncStorage.setItem('reverse_outline_source', novel.content);
      router.push('/reverse-outline', { novelId: novel.id, novelTitle: novel.title });
    },
    [router]
  );

  const renderNovelItem = ({ item }: { item: NovelItem }) => (
    <TouchableOpacity
      style={styles.novelCard}
      onPress={() => {
        setSelectedNovel(item);
        setShowDetail(true);
      }}
    >
      <View style={styles.novelCover}>
        <Ionicons name="book" size={28} color="#6B6B8D" />
      </View>
      <View style={styles.novelInfo}>
        <Text style={styles.novelTitle} numberOfLines={1}>
          {item.title}
        </Text>
        <Text style={styles.novelOutline} numberOfLines={2}>
          {item.outline || '无章纲'}
        </Text>
        <Text style={styles.novelDate}>
          {item.createdAt ? new Date(Number(item.createdAt)).toLocaleDateString() : '未保存'}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color="#6B6B8D" />
    </TouchableOpacity>
  );

  return (
    <Screen>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.headerTitle}>书架</Text>
            <Text style={styles.headerCount}>{novels.length} 章</Text>
          </View>
          <TouchableOpacity style={styles.importHeaderBtn} onPress={() => setImportModalVisible(true)}>
            <Feather name="upload" size={16} color="#fff" />
            <Text style={styles.importHeaderBtnText}>导入小说</Text>
          </TouchableOpacity>
        </View>

        {/* 列表 */}
        {novels.length > 0 ? (
          <FlatList
            data={novels}
            keyExtractor={(item) => item.id}
            renderItem={renderNovelItem}
            contentContainerStyle={styles.listContent}
          />
        ) : (
          <View style={styles.emptyState}>
            <Ionicons name="library-outline" size={48} color="#8888AA" />
            <Text style={styles.emptyText}>书架空空如也</Text>
            <Text style={styles.emptySubText}>在创作中心写作并保存章节，或点右上角导入已有小说</Text>
            <TouchableOpacity style={styles.emptyImportBtn} onPress={() => setImportModalVisible(true)}>
              <Feather name="upload" size={18} color="#fff" />
              <Text style={styles.emptyImportBtnText}>导入小说</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* 详情弹窗 - 全屏阅读 */}
        <Modal visible={showDetail} animationType="slide" onRequestClose={() => setShowDetail(false)}>
          <View style={styles.detailContainer}>
            <View style={styles.detailHeader}>
              <TouchableOpacity onPress={() => setShowDetail(false)} style={styles.detailBackBtn}>
                <Ionicons name="arrow-back" size={24} color="#fff" />
              </TouchableOpacity>
              <Text style={styles.detailTitle} numberOfLines={1}>
                {selectedNovel?.title}
              </Text>
              <TouchableOpacity
                onPress={() => {
                  if (selectedNovel) handleReverseEngine(selectedNovel);
                  setShowDetail(false);
                }}
                style={{ marginRight: 12 }}
              >
                <Ionicons name="sparkles-outline" size={22} color="#6C63FF" />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => {
                  if (selectedNovel) handleDelete(selectedNovel.id);
                }}
              >
                <Ionicons name="trash-outline" size={22} color="#ff6b6b" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.detailScroll} contentContainerStyle={styles.detailScrollContent}>
              {selectedNovel?.outline ? (
                <View style={styles.outlineSection}>
                  <Text style={styles.outlineLabel}>章纲</Text>
                  <Text style={styles.outlineText}>{selectedNovel.outline}</Text>
                </View>
              ) : null}

              <View style={styles.contentSection}>
                <Text style={styles.contentLabel}>正文</Text>
                <Text style={styles.contentText}>{selectedNovel?.content}</Text>
              </View>

              {/* 底部操作按钮 */}
              <View style={styles.detailActions}>
                <TouchableOpacity
                  style={styles.reverseBtn}
                  onPress={() => {
                    if (selectedNovel) handleReverseEngine(selectedNovel);
                    setShowDetail(false);
                  }}
                >
                  <Ionicons name="sparkles" size={18} color="#fff" />
                  <Text style={styles.reverseBtnText}>AI反推大纲</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </Modal>

        {/* 导入小说Modal */}
        <Modal visible={importModalVisible} transparent animationType="slide">
          <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <View style={styles.modalOverlay}>
              <View style={styles.modalContent}>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>导入小说</Text>
                  <Pressable onPress={() => setImportModalVisible(false)}>
                    <Feather name="x" size={22} color="#8888AA" />
                  </Pressable>
                </View>
                <View style={styles.modalBody}>
                  <Text style={styles.modalHint}>标题</Text>
                  <TextInput
                    style={styles.titleInput}
                    value={importTitle}
                    onChangeText={setImportTitle}
                    placeholder="输入小说标题"
                    placeholderTextColor="#555"
                  />
                  <Text style={styles.modalHint}>正文（空行分隔章节）</Text>
                  <TextInput
                    style={[styles.titleInput, { flex: 1, textAlignVertical: 'top' }]}
                    multiline
                    value={importContent}
                    onChangeText={setImportContent}
                    placeholder="粘贴小说正文，空行自动分章..."
                    placeholderTextColor="#555"
                  />
                </View>
                <View style={styles.modalFooter}>
                  <TouchableOpacity style={styles.cancelBtn} onPress={() => setImportModalVisible(false)}>
                    <Text style={styles.cancelBtnText}>取消</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.confirmBtn} onPress={handleImport}>
                    <Text style={styles.confirmBtnText}>导入</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </KeyboardAvoidingView>
        </Modal>
      </View>
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
  headerLeft: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  headerTitle: { fontSize: 28, fontWeight: 'bold', color: GC.textPrimary },
  headerCount: { color: GC.textSecondary, fontSize: 15 },
  importHeaderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: GC.border,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    gap: 6,
  },
  importHeaderBtnText: { color: GC.textPrimary, fontSize: 13, fontWeight: '600' },

  // 列表
  listContent: { paddingHorizontal: 20, paddingBottom: 20 },
  novelCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: GC.bgElevated,
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: GC.bgCard,
    gap: 12,
  },
  novelCover: {
    width: 50,
    height: 68,
    backgroundColor: GC.bgCard,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: GC.border,
  },
  novelInfo: { flex: 1 },
  novelTitle: { color: GC.textPrimary, fontSize: 16, fontWeight: '600', marginBottom: 4 },
  novelOutline: { color: GC.textSecondary, fontSize: 13, lineHeight: 18, marginBottom: 4 },
  novelDate: { color: '#555', fontSize: 12 },

  // 空状态
  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingBottom: 100 },
  emptyText: { color: GC.textSecondary, fontSize: 16, marginTop: 16 },
  emptySubText: { color: '#555', fontSize: 13, marginTop: 8, textAlign: 'center', paddingHorizontal: 40 },
  emptyImportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: GC.border,
    borderRadius: 10,
    paddingHorizontal: 20,
    paddingVertical: 12,
    marginTop: 20,
    gap: 8,
  },
  emptyImportBtnText: { color: GC.textPrimary, fontSize: 15, fontWeight: '600' },

  // 详情全屏
  detailContainer: { flex: 1, backgroundColor: GC.bgBase },
  detailHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 56,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: GC.bgCard,
    gap: 12,
  },
  detailBackBtn: { padding: 4 },
  detailTitle: { flex: 1, color: GC.textPrimary, fontSize: 18, fontWeight: 'bold' },
  detailScroll: { flex: 1 },
  detailScrollContent: { padding: 20, paddingBottom: 60 },
  outlineSection: {
    backgroundColor: GC.bgElevated,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: GC.border,
  },
  outlineLabel: { color: GC.textSecondary, fontSize: 12, fontWeight: '600', marginBottom: 8 },
  outlineText: { color: GC.textSecondary, fontSize: 14, lineHeight: 22 },
  contentSection: {
    backgroundColor: GC.bgElevated,
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    borderColor: GC.bgCard,
  },
  contentLabel: { color: GC.textSecondary, fontSize: 12, fontWeight: '600', marginBottom: 12 },
  contentText: { color: GC.textPrimary, fontSize: 16, lineHeight: 30 },
  detailActions: {
    marginTop: 20,
    gap: 10,
  },
  reverseBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#6C63FF',
    borderRadius: 10,
    paddingVertical: 14,
    gap: 8,
  },
  reverseBtnText: { color: GC.textPrimary, fontSize: 15, fontWeight: '700' },

  // 导入Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '90%',
    height: '80%',
    backgroundColor: GC.bgElevated,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: GC.border,
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: GC.bgCard,
  },
  modalTitle: { color: GC.textPrimary, fontSize: 18, fontWeight: 'bold' },
  modalBody: { flex: 1, padding: 16 },
  modalHint: { color: GC.textSecondary, fontSize: 13, marginBottom: 6, marginTop: 10 },
  titleInput: {
    backgroundColor: GC.bgElevated,
    borderRadius: 10,
    padding: 14,
    color: GC.textPrimary,
    fontSize: 15,
    borderWidth: 1,
    borderColor: GC.border,
  },
  modalFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: GC.bgCard,
  },
  cancelBtn: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: GC.border,
  },
  cancelBtnText: { color: GC.textPrimary, fontSize: 14 },
  confirmBtn: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#6C63FF',
  },
  confirmBtnText: { color: GC.textPrimary, fontSize: 14, fontWeight: '700' },
});
