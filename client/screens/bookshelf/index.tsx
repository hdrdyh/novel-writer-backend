import { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  Alert,
  TextInput,
  Modal,
} from 'react-native';
import { Screen } from '@/components/Screen';
import { Feather } from '@expo/vector-icons';

interface Novel {
  id: string;
  title: string;
  chapters: number;
  lastRead: string;
  status: 'writing' | 'completed' | 'draft';
}

export default function BookshelfScreen() {
  const [novels, setNovels] = useState<Novel[]>([
    {
      id: '1',
      title: '异世界觉醒录',
      chapters: 12,
      lastRead: '2024-01-20',
      status: 'writing',
    },
    {
      id: '2',
      title: '都市修仙传',
      chapters: 5,
      lastRead: '2024-01-18',
      status: 'draft',
    },
  ]);

  const [novelModalVisible, setNovelModalVisible] = useState(false);
  const [newNovelTitle, setNewNovelTitle] = useState('');

  const handleCreateNovel = () => {
    setNewNovelTitle('');
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
      chapters: 0,
      lastRead: new Date().toISOString().split('T')[0],
      status: 'draft',
    };

    setNovels(prev => [newNovel, ...prev]);
    setNovelModalVisible(false);
    Alert.alert('创建成功', `"${newNovel.title}" 已创建`);
  };

  const handleDeleteNovel = (id: string, title: string) => {
    Alert.alert('删除小说', `确定删除《${title}》？`, [
      { text: '取消', style: 'cancel' },
      {
        text: '删除',
        style: 'destructive',
        onPress: () => setNovels(prev => prev.filter(n => n.id !== id)),
      },
    ]);
  };

  const handleOpenNovel = (novel: Novel) => {
    Alert.alert(novel.title, '即将进入小说详情页');
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

  return (
    <Screen>
      <View style={styles.header}>
        <Text style={styles.greeting}>书架</Text>
        <Text style={styles.title}>我的小说</Text>
      </View>

      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        {novels.length === 0 ? (
          <View style={styles.emptyState}>
            <Feather name="book-open" size={48} color="#CCCCCC" />
            <Text style={styles.emptyText}>暂无小说</Text>
            <Text style={styles.emptyHint}>点击下方按钮创建你的第一部小说</Text>
          </View>
        ) : (
          <>
            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <Text style={styles.statNumber}>{novels.length}</Text>
                <Text style={styles.statLabel}>本小说</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={styles.statNumber}>
                  {novels.reduce((sum, n) => sum + n.chapters, 0)}
                </Text>
                <Text style={styles.statLabel}>总章节</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={styles.statNumber}>
                  {novels.filter(n => n.status === 'writing').length}
                </Text>
                <Text style={styles.statLabel}>创作中</Text>
              </View>
            </View>

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
                        <Feather name="more-vertical" size={20} color="#888888" />
                      </Pressable>
                    </View>
                    <Text style={styles.novelMeta}>
                      {novel.chapters} 章 · 最后阅读 {novel.lastRead}
                    </Text>
                    <View style={[styles.statusBadge, { backgroundColor: badge.bg }]}>
                      <Text style={[styles.statusText, { color: badge.color }]}>
                        {badge.text}
                      </Text>
                    </View>
                  </View>
                  <Feather name="chevron-right" size={20} color="#CCCCCC" />
                </Pressable>
              );
            })}
          </>
        )}
        <View style={styles.bottomSpacer} />
      </ScrollView>

      <Pressable style={styles.fab} onPress={handleCreateNovel}>
        <Feather name="plus" size={24} color="#FFFFFF" />
      </Pressable>

      {/* 创建小说弹窗 */}
      <Modal visible={novelModalVisible} transparent animationType="fade">
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setNovelModalVisible(false)}
        >
          <Pressable style={styles.modalContent} onPress={e => e.stopPropagation()}>
            <Text style={styles.modalTitle}>创建新小说</Text>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>小说标题</Text>
              <TextInput
                style={styles.input}
                value={newNovelTitle}
                onChangeText={setNewNovelTitle}
                placeholder="输入小说标题..."
                placeholderTextColor="#CCCCCC"
                autoFocus
              />
            </View>
            <View style={styles.modalActions}>
              <Pressable
                style={styles.cancelBtn}
                onPress={() => setNovelModalVisible(false)}
              >
                <Text style={styles.cancelBtnText}>取消</Text>
              </Pressable>
              <Pressable style={styles.createBtn} onPress={confirmCreateNovel}>
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
    textAlign: 'center',
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
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#ECECEC',
    padding: 16,
    marginBottom: 12,
  },
  novelCover: {
    width: 60,
    height: 80,
    backgroundColor: '#F7F7F7',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
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
  novelMeta: {
    fontSize: 13,
    color: '#888888',
    marginBottom: 8,
  },
  statusBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusText: {
    fontSize: 11,
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
    padding: 16,
    fontSize: 16,
    color: '#111111',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
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
  createBtn: {
    flex: 1,
    backgroundColor: '#111111',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  createBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
