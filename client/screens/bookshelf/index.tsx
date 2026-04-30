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
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Screen } from '@/components/Screen';
import { Ionicons } from '@expo/vector-icons';

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

  const renderNovelItem = ({ item }: { item: NovelItem }) => (
    <TouchableOpacity
      style={styles.novelCard}
      onPress={() => {
        setSelectedNovel(item);
        setShowDetail(true);
      }}
    >
      <View style={styles.novelCover}>
        <Ionicons name="book" size={28} color="#555" />
      </View>
      <View style={styles.novelInfo}>
        <Text style={styles.novelTitle} numberOfLines={1}>
          {item.title}
        </Text>
        <Text style={styles.novelOutline} numberOfLines={2}>
          {item.outline || '无章纲'}
        </Text>
        <Text style={styles.novelDate}>
          {item.createdAt ? new Date(item.createdAt).toLocaleDateString() : '未保存'}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color="#555" />
    </TouchableOpacity>
  );

  return (
    <Screen>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>书架</Text>
          <Text style={styles.headerCount}>{novels.length} 章</Text>
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
            <Ionicons name="library-outline" size={48} color="#333" />
            <Text style={styles.emptyText}>书架空空如也</Text>
            <Text style={styles.emptySubText}>在创作中心写作并保存章节后，会出现在这里</Text>
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
            </ScrollView>
          </View>
        </Modal>
      </View>
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
  headerCount: { color: '#888', fontSize: 15 },

  // 列表
  listContent: { paddingHorizontal: 20, paddingBottom: 20 },
  novelCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#222',
    gap: 12,
  },
  novelCover: {
    width: 50,
    height: 68,
    backgroundColor: '#222',
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#333',
  },
  novelInfo: { flex: 1 },
  novelTitle: { color: '#fff', fontSize: 16, fontWeight: '600', marginBottom: 4 },
  novelOutline: { color: '#888', fontSize: 13, lineHeight: 18, marginBottom: 4 },
  novelDate: { color: '#555', fontSize: 12 },

  // 空状态
  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingBottom: 100 },
  emptyText: { color: '#888', fontSize: 16, marginTop: 16 },
  emptySubText: { color: '#555', fontSize: 13, marginTop: 8, textAlign: 'center', paddingHorizontal: 40 },

  // 详情全屏
  detailContainer: { flex: 1, backgroundColor: '#000' },
  detailHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 56,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#222',
    gap: 12,
  },
  detailBackBtn: { padding: 4 },
  detailTitle: { flex: 1, color: '#fff', fontSize: 18, fontWeight: 'bold' },
  detailScroll: { flex: 1 },
  detailScrollContent: { padding: 20, paddingBottom: 60 },
  outlineSection: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#333',
  },
  outlineLabel: { color: '#888', fontSize: 12, fontWeight: '600', marginBottom: 8 },
  outlineText: { color: '#aaa', fontSize: 14, lineHeight: 22 },
  contentSection: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    borderColor: '#222',
  },
  contentLabel: { color: '#888', fontSize: 12, fontWeight: '600', marginBottom: 12 },
  contentText: { color: '#fff', fontSize: 16, lineHeight: 30 },
});
