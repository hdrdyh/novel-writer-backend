import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  Alert,
  TextInput,
  Modal,
  RefreshControl,
} from 'react-native';
import { Screen } from '@/components/Screen';
import { Feather } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';

// API地址：固定指向Railway后端
const API_BASE_URL = 'https://novel-writer-backend-production-24e9.up.railway.app';

interface Novel {
  id: string;
  title: string;
  genre: string;
  synopsis: string;
  createdAt: string;
  updatedAt: string;
  chapterCount: number;
  status: 'writing' | 'completed' | 'draft';
}

interface Chapter {
  id: string;
  novelId: string;
  chapterNumber: number;
  outline: string;
  content: string;
  summary: string;
  status: 'draft' | 'completed';
  createdAt: string;
  updatedAt: string;
}

export default function BookshelfScreen() {
  const [novels, setNovels] = useState<Novel[]>([]);
  const [selectedNovel, setSelectedNovel] = useState<Novel | null>(null);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [viewMode, setViewMode] = useState<'novels' | 'chapters'>('novels');
  
  // 小说创建弹窗
  const [novelModalVisible, setNovelModalVisible] = useState(false);
  const [newNovelTitle, setNewNovelTitle] = useState('');
  const [newNovelGenre, setNewNovelGenre] = useState('都市');
  const [newNovelSynopsis, setNewNovelSynopsis] = useState('');

  // 章节创建弹窗
  const [chapterModalVisible, setChapterModalVisible] = useState(false);
  const [newChapterOutline, setNewChapterOutline] = useState('');

  const genres = ['都市', '玄幻', '修仙', '科幻', '悬疑', '历史', '武侠', '都市异能', '穿越'];

  // 加载小说列表
  useFocusEffect(
    useCallback(() => {
      loadNovels();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])
  );

  const loadNovels = async () => {
    try {
      // 合并novels和bookshelf_novels的数据
      const stored = await AsyncStorage.getItem('novels');
      const shelfNovels = await AsyncStorage.getItem('bookshelf_novels');
      
      let allNovels: Novel[] = [];
      
      if (stored) {
        allNovels = [...JSON.parse(stored)];
      }
      
      if (shelfNovels) {
        const shelf = JSON.parse(shelfNovels);
        // 合并，避免重复
        shelf.forEach((s: {id: string; title: string}) => {
          if (!allNovels.find(n => n.id === s.id)) {
            allNovels.push({
              id: s.id,
              title: s.title,
              genre: '小说',
              synopsis: '从写作台保存的章节',
              createdAt: new Date().toISOString().split('T')[0],
              updatedAt: new Date().toISOString().split('T')[0],
              chapterCount: 1,
              status: 'writing',
            });
          }
        });
      }
      
      if (allNovels.length === 0) {
        // 初始化示例数据
        const sampleNovels: Novel[] = [
          {
            id: '1',
            title: '异世界觉醒录',
            genre: '都市异能',
            synopsis: '普通青年意外获得异能，从此改变人生轨迹...',
            createdAt: '2024-01-20',
            updatedAt: '2024-01-25',
            chapterCount: 12,
            status: 'writing',
          },
          {
            id: '2',
            title: '修仙归来',
            genre: '修仙',
            synopsis: '一代仙尊重生都市，弥补前世遗憾...',
            createdAt: '2024-01-18',
            updatedAt: '2024-01-22',
            chapterCount: 5,
            status: 'draft',
          },
        ];
        setNovels(sampleNovels);
        await AsyncStorage.setItem('novels', JSON.stringify(sampleNovels));
      } else {
        setNovels(allNovels);
      }
    } catch (e) {
      console.error('加载小说失败:', e);
    }
  };

  const saveNovels = async (newNovels: Novel[]) => {
    try {
      await AsyncStorage.setItem('novels', JSON.stringify(newNovels));
      setNovels(newNovels);
    } catch (e) {
      console.error('保存小说失败:', e);
    }
  };

  const handleCreateNovel = () => {
    setNewNovelTitle('');
    setNewNovelGenre('都市');
    setNewNovelSynopsis('');
    setNovelModalVisible(true);
  };

  const confirmCreateNovel = () => {
    if (!newNovelTitle.trim()) {
      Alert.alert('提示', '请输入小说标题');
      return;
    }

    const newNovel: Novel = {
      id: Date.now().toString(),
      title: newNovelTitle.trim(),
      genre: newNovelGenre,
      synopsis: newNovelSynopsis.trim() || '暂无简介',
      createdAt: new Date().toISOString().split('T')[0],
      updatedAt: new Date().toISOString().split('T')[0],
      chapterCount: 0,
      status: 'draft',
    };

    saveNovels([newNovel, ...novels]);
    setNovelModalVisible(false);
    Alert.alert('创建成功', `"${newNovel.title}" 已创建`);
  };

  const handleDeleteNovel = (id: string, title: string) => {
    Alert.alert('删除小说', `确定删除《${title}》？此操作不可恢复！`, [
      { text: '取消', style: 'cancel' },
      {
        text: '删除',
        style: 'destructive',
        onPress: () => {
          saveNovels(novels.filter(n => n.id !== id));
          // 同时删除本地章节
          AsyncStorage.removeItem(`chapters_${id}`);
        },
      },
    ]);
  };

  const handleOpenNovel = (novel: Novel) => {
    setSelectedNovel(novel);
    setViewMode('chapters');
    loadChapters(novel.id);
  };

  const loadChapters = async (novelId: string) => {
    try {
      const stored = await AsyncStorage.getItem(`chapters_${novelId}`);
      let loadedChapters: Chapter[] = [];
      
      if (stored) {
        loadedChapters = [...JSON.parse(stored)];
      }
      
      // 也读取bookshelf_chapters中的章节
      const shelfChapters = await AsyncStorage.getItem('bookshelf_chapters');
      if (shelfChapters) {
        const shelf = JSON.parse(shelfChapters);
        shelf.forEach((c: any) => {
          if (c.novelId === novelId && !loadedChapters.find(existing => existing.id === c.id)) {
            loadedChapters.push({
              id: c.id,
              novelId: c.novelId,
              chapterNumber: c.chapterNumber,
              outline: c.outline || '',
              content: c.content,
              summary: c.summary || c.content?.slice(0, 200) || '',
              status: 'completed',
              createdAt: c.createdAt,
              updatedAt: c.createdAt,
            });
          }
        });
      }
      
      // 按章节号排序
      loadedChapters.sort((a, b) => a.chapterNumber - b.chapterNumber);
      setChapters(loadedChapters);
    } catch (e) {
      console.error('加载章节失败:', e);
    }
  };

  const saveChapters = async (novelId: string, newChapters: Chapter[]) => {
    try {
      await AsyncStorage.setItem(`chapters_${novelId}`, JSON.stringify(newChapters));
      setChapters(newChapters);
      // 更新小说的章节数
      const updatedNovels = novels.map(n => 
        n.id === novelId ? { ...n, chapterCount: newChapters.length, updatedAt: new Date().toISOString().split('T')[0] } : n
      );
      saveNovels(updatedNovels);
    } catch (e) {
      console.error('保存章节失败:', e);
    }
  };

  const handleCreateChapter = () => {
    if (!selectedNovel) return;
    setNewChapterOutline('');
    setChapterModalVisible(true);
  };

  const confirmCreateChapter = () => {
    if (!selectedNovel) return;
    if (!newChapterOutline.trim()) {
      Alert.alert('提示', '请输入章纲内容');
      return;
    }

    const newChapter: Chapter = {
      id: Date.now().toString(),
      novelId: selectedNovel.id,
      chapterNumber: chapters.length + 1,
      outline: newChapterOutline.trim(),
      content: '',
      summary: '',
      status: 'draft',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    saveChapters(selectedNovel.id, [...chapters, newChapter]);
    setChapterModalVisible(false);
  };

  const handleDeleteChapter = (id: string) => {
    if (!selectedNovel) return;
    Alert.alert('删除章节', '确定删除此章节？', [
      { text: '取消', style: 'cancel' },
      {
        text: '删除',
        style: 'destructive',
        onPress: () => {
          saveChapters(selectedNovel.id, chapters.filter(c => c.id !== id));
        },
      },
    ]);
  };

  const getStatusBadge = (status: Novel['status']) => {
    switch (status) {
      case 'writing':
        return { text: '创作中', color: '#059669', bg: '#ECFDF5' };
      case 'completed':
        return { text: '已完成', color: '#2563EB', bg: '#EFF6FF' };
      case 'draft':
        return { text: '草稿', color: '#888888', bg: '#F7F7F7' };
    }
  };

  const getChapterStatusBadge = (status: Chapter['status']) => {
    switch (status) {
      case 'draft':
        return { text: '待写作', color: '#D97706', bg: '#FEF3C7' };
      case 'completed':
        return { text: '已完成', color: '#059669', bg: '#ECFDF5' };
    }
  };

  const totalChapters = novels.reduce((sum, n) => sum + n.chapterCount, 0);
  const writingCount = novels.filter(n => n.status === 'writing').length;

  // 渲染小说列表
  const renderNovelList = () => (
    <>
      {/* 统计 */}
      <View style={styles.statsRow}>
        <View style={styles.statItem}>
          <Text style={styles.statNumber}>{novels.length}</Text>
          <Text style={styles.statLabel}>部小说</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statNumber}>{totalChapters}</Text>
          <Text style={styles.statLabel}>总章节</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statNumber}>{writingCount}</Text>
          <Text style={styles.statLabel}>创作中</Text>
        </View>
      </View>

      {/* 小说列表 */}
      {novels.map(novel => {
        const badge = getStatusBadge(novel.status);
        return (
          <Pressable
            key={novel.id}
            style={styles.novelCard}
            onPress={() => handleOpenNovel(novel)}
          >
            <View style={styles.novelCover}>
              <Feather name="book" size={32} color="#CCCCCC" />
              <Text style={styles.genreTag}>{novel.genre}</Text>
            </View>
            <View style={styles.novelInfo}>
              <View style={styles.novelHeader}>
                <Text style={styles.novelTitle} numberOfLines={1}>
                  {novel.title}
                </Text>
                <Pressable
                  onPress={() => handleDeleteNovel(novel.id, novel.title)}
                  hitSlop={8}
                >
                  <Feather name="trash-2" size={18} color="#DC2626" />
                </Pressable>
              </View>
              <Text style={styles.synopsis} numberOfLines={2}>
                {novel.synopsis}
              </Text>
              <View style={styles.novelFooter}>
                <Text style={styles.novelMeta}>
                  {novel.chapterCount} 章 · {novel.updatedAt}
                </Text>
                <View style={[styles.statusBadge, { backgroundColor: badge.bg }]}>
                  <Text style={[styles.statusText, { color: badge.color }]}>
                    {badge.text}
                  </Text>
                </View>
              </View>
            </View>
          </Pressable>
        );
      })}
    </>
  );

  // 渲染章节列表
  const renderChapterList = () => (
    <>
      {/* 返回按钮 */}
      <Pressable style={styles.backButton} onPress={() => {
        setViewMode('novels');
        setSelectedNovel(null);
      }}>
        <Feather name="arrow-left" size={20} color="#333333" />
        <Text style={styles.backText}>返回书架</Text>
      </Pressable>

      {/* 小说信息 */}
      <View style={styles.novelHeaderCard}>
        <Text style={styles.novelHeaderTitle}>{selectedNovel?.title}</Text>
        <Text style={styles.novelHeaderMeta}>
          {selectedNovel?.genre} · {selectedNovel?.chapterCount} 章
        </Text>
        {selectedNovel?.synopsis && (
          <Text style={styles.novelHeaderSynopsis}>{selectedNovel.synopsis}</Text>
        )}
      </View>

      {/* 章节列表 */}
      <Text style={styles.sectionTitle}>章节列表</Text>
      {chapters.length === 0 ? (
        <View style={styles.emptyState}>
          <Feather name="file-text" size={40} color="#CCCCCC" />
          <Text style={styles.emptyText}>暂无章节</Text>
          <Text style={styles.emptyHint}>点击下方按钮创建第一章</Text>
        </View>
      ) : (
        chapters.map(chapter => {
          const badge = getChapterStatusBadge(chapter.status);
          return (
            <Pressable key={chapter.id} style={styles.chapterCard}>
              <View style={styles.chapterNumber}>
                <Text style={styles.chapterNumberText}>{chapter.chapterNumber}</Text>
              </View>
              <View style={styles.chapterInfo}>
                <View style={styles.chapterHeader}>
                  <Text style={styles.chapterTitle}>
                    第{chapter.chapterNumber}章
                  </Text>
                  <View style={[styles.statusBadge, { backgroundColor: badge.bg }]}>
                    <Text style={[styles.statusText, { color: badge.color }]}>
                      {badge.text}
                    </Text>
                  </View>
                </View>
                <Text style={styles.chapterOutline} numberOfLines={2}>
                  {chapter.outline}
                </Text>
                <Text style={styles.chapterMeta}>
                  {new Date(chapter.updatedAt).toLocaleDateString()}
                </Text>
              </View>
              <Pressable
                onPress={() => handleDeleteChapter(chapter.id)}
                hitSlop={8}
              >
                <Feather name="trash-2" size={16} color="#DC2626" />
              </Pressable>
            </Pressable>
          );
        })
      )}
    </>
  );

  return (
    <Screen>
      <View style={styles.header}>
        <Text style={styles.greeting}>
          {viewMode === 'chapters' && selectedNovel ? selectedNovel.title : '书架'}
        </Text>
        <Text style={styles.title}>
          {viewMode === 'novels' ? '我的小说' : '章节管理'}
        </Text>
      </View>

      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        {viewMode === 'novels' ? renderNovelList() : renderChapterList()}
        <View style={styles.bottomSpacer} />
      </ScrollView>

      {/* 底部按钮 */}
      {viewMode === 'novels' && (
        <Pressable style={styles.fab} onPress={handleCreateNovel}>
          <Feather name="plus" size={24} color="#FFFFFF" />
          <Text style={styles.fabText}>创建小说</Text>
        </Pressable>
      )}

      {viewMode === 'chapters' && (
        <Pressable style={styles.fab} onPress={handleCreateChapter}>
          <Feather name="plus" size={24} color="#FFFFFF" />
          <Text style={styles.fabText}>添加章节</Text>
        </Pressable>
      )}

      {/* 创建小说弹窗 */}
      <Modal visible={novelModalVisible} transparent animationType="fade">
        <Pressable style={styles.modalOverlay} onPress={() => setNovelModalVisible(false)}>
          <Pressable style={styles.modalContent} onPress={e => e.stopPropagation()}>
            <Text style={styles.modalTitle}>创建新小说</Text>
            
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>小说标题 *</Text>
              <TextInput
                style={styles.input}
                value={newNovelTitle}
                onChangeText={setNewNovelTitle}
                placeholder="输入小说标题..."
                placeholderTextColor="#CCCCCC"
                autoFocus
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>类型</Text>
              <View style={styles.genreSelector}>
                {genres.map(g => (
                  <Pressable
                    key={g}
                    style={[styles.genreOption, newNovelGenre === g && styles.genreOptionActive]}
                    onPress={() => setNewNovelGenre(g)}
                  >
                    <Text style={[styles.genreText, newNovelGenre === g && styles.genreTextActive]}>
                      {g}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>简介</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={newNovelSynopsis}
                onChangeText={setNewNovelSynopsis}
                placeholder="简述故事背景..."
                placeholderTextColor="#CCCCCC"
                multiline
                numberOfLines={3}
                textAlignVertical="top"
              />
            </View>

            <View style={styles.modalActions}>
              <Pressable style={styles.cancelBtn} onPress={() => setNovelModalVisible(false)}>
                <Text style={styles.cancelBtnText}>取消</Text>
              </Pressable>
              <Pressable style={styles.createBtn} onPress={confirmCreateNovel}>
                <Text style={styles.createBtnText}>创建</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* 创建章节弹窗 */}
      <Modal visible={chapterModalVisible} transparent animationType="fade">
        <Pressable style={styles.modalOverlay} onPress={() => setChapterModalVisible(false)}>
          <Pressable style={styles.modalContent} onPress={e => e.stopPropagation()}>
            <Text style={styles.modalTitle}>
              添加第{chapters.length + 1}章
            </Text>
            
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>章纲 *</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={newChapterOutline}
                onChangeText={setNewChapterOutline}
                placeholder="输入本章剧情大纲..."
                placeholderTextColor="#CCCCCC"
                multiline
                numberOfLines={5}
                textAlignVertical="top"
                autoFocus
              />
            </View>

            <View style={styles.modalActions}>
              <Pressable style={styles.cancelBtn} onPress={() => setChapterModalVisible(false)}>
                <Text style={styles.cancelBtnText}>取消</Text>
              </Pressable>
              <Pressable style={styles.createBtn} onPress={confirmCreateChapter}>
                <Text style={styles.createBtnText}>创建</Text>
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
  statsRow: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#ECECEC',
    padding: 20,
    marginBottom: 24,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111111',
  },
  statLabel: {
    fontSize: 12,
    color: '#888888',
    marginTop: 4,
  },
  statDivider: {
    width: StyleSheet.hairlineWidth,
    backgroundColor: '#ECECEC',
    marginHorizontal: 12,
  },
  novelCard: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#ECECEC',
    padding: 16,
    marginBottom: 12,
  },
  novelCover: {
    width: 70,
    height: 90,
    backgroundColor: '#F7F7F7',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  genreTag: {
    fontSize: 9,
    color: '#888888',
    marginTop: 4,
    backgroundColor: '#EEEEEE',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  novelInfo: {
    flex: 1,
  },
  novelHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  novelTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111111',
    flex: 1,
    marginRight: 8,
  },
  synopsis: {
    fontSize: 13,
    color: '#666666',
    marginBottom: 8,
    lineHeight: 18,
  },
  novelFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  novelMeta: {
    fontSize: 12,
    color: '#888888',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
  },
  emptyState: {
    alignItems: 'center',
    paddingTop: 60,
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
  // 章节列表样式
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    paddingVertical: 8,
  },
  backText: {
    fontSize: 15,
    color: '#333333',
    marginLeft: 8,
  },
  novelHeaderCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#ECECEC',
    padding: 16,
    marginBottom: 20,
  },
  novelHeaderTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111111',
    marginBottom: 4,
  },
  novelHeaderMeta: {
    fontSize: 13,
    color: '#888888',
    marginBottom: 8,
  },
  novelHeaderSynopsis: {
    fontSize: 14,
    color: '#666666',
    lineHeight: 20,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#888888',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  chapterCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#ECECEC',
    padding: 14,
    marginBottom: 10,
  },
  chapterNumber: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#F0F0F0',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  chapterNumberText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#333333',
  },
  chapterInfo: {
    flex: 1,
  },
  chapterHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  chapterTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111111',
    marginRight: 8,
  },
  chapterOutline: {
    fontSize: 13,
    color: '#666666',
    marginBottom: 4,
  },
  chapterMeta: {
    fontSize: 11,
    color: '#999999',
  },
  bottomSpacer: {
    height: 100,
  },
  fab: {
    position: 'absolute',
    right: 24,
    bottom: 24,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#111111',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 28,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
  },
  fabText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
    marginLeft: 8,
  },
  // 弹窗样式
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
    width: '90%',
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111111',
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
    padding: 14,
    fontSize: 15,
    color: '#111111',
  },
  textArea: {
    minHeight: 80,
    paddingTop: 14,
  },
  genreSelector: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  genreOption: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#F7F7F7',
    borderWidth: 1,
    borderColor: '#ECECEC',
  },
  genreOptionActive: {
    backgroundColor: '#111111',
    borderColor: '#111111',
  },
  genreText: {
    fontSize: 13,
    color: '#666666',
  },
  genreTextActive: {
    color: '#FFFFFF',
    fontWeight: '600',
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
    paddingVertical: 14,
    alignItems: 'center',
  },
  cancelBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111111',
  },
  createBtn: {
    flex: 1,
    backgroundColor: '#111111',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  createBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
