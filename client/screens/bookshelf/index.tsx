import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Modal,
  Alert,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Screen } from '@/components/Screen';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';

export default function BookshelfScreen() {
  const [novels, setNovels] = useState<any[]>([]);
  const [previewModal, setPreviewModal] = useState(false);
  const [previewItem, setPreviewItem] = useState<any>(null);

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

  const handlePreview = (item: any) => {
    setPreviewItem(item);
    setPreviewModal(true);
  };

  const handleDelete = (id: string) => {
    Alert.alert('确认', '确定删除这本小说吗？', [
      { text: '取消', style: 'cancel' },
      {
        text: '删除',
        style: 'destructive',
        onPress: async () => {
          const updated = novels.filter((n) => n.id !== id);
          setNovels(updated);
          await AsyncStorage.setItem('novels', JSON.stringify(updated));
        },
      },
    ]);
  };

  const handleClearAll = () => {
    Alert.alert('确认', '确定清空所有小说吗？此操作不可恢复。', [
      { text: '取消', style: 'cancel' },
      {
        text: '清空',
        style: 'destructive',
        onPress: async () => {
          setNovels([]);
          await AsyncStorage.removeItem('novels');
        },
      },
    ]);
  };

  return (
    <Screen>
      <View style={styles.container}>
        <View style={styles.header}>
          <View>
            <Text style={styles.headerTitle}>书架</Text>
            <Text style={styles.headerSubtitle}>{novels.length} 本小说</Text>
          </View>
          {novels.length > 0 && (
            <TouchableOpacity style={styles.clearBtn} onPress={handleClearAll}>
              <Ionicons name="trash-outline" size={20} color="#888" />
              <Text style={styles.clearBtnText}>清空</Text>
            </TouchableOpacity>
          )}
        </View>

        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
          {novels.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="book-outline" size={64} color="#333" />
              <Text style={styles.emptyTitle}>书架空空如也</Text>
              <Text style={styles.emptySubtitle}>创作章节后保存到书架</Text>
            </View>
          ) : (
            novels.map((item) => (
              <View key={item.id} style={styles.bookCard}>
                <View style={styles.coverContainer}>
                  <Image
                    source={{ uri: item.cover || 'https://picsum.photos/seed/novel/200/300' }}
                    style={styles.coverImage}
                    contentFit="cover"
                  />
                </View>
                <View style={styles.bookInfo}>
                  <Text style={styles.bookTitle}>{item.title}</Text>
                  <Text style={styles.bookChapter}>第{item.chapterNumber}章</Text>
                  <Text style={styles.bookOutline} numberOfLines={2}>
                    {item.outline}
                  </Text>
                  <View style={styles.bookActions}>
                    <TouchableOpacity
                      style={styles.bookActionBtn}
                      onPress={() => handlePreview(item)}
                    >
                      <Ionicons name="document-text-outline" size={14} color="#888" />
                      <Text style={styles.bookActionText}>阅读</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.bookActionBtn}
                      onPress={() => handleDelete(item.id)}
                    >
                      <Ionicons name="trash-outline" size={14} color="#888" />
                      <Text style={styles.bookActionText}>删除</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            ))
          )}
        </ScrollView>

        <Modal
          visible={previewModal}
          animationType="slide"
          onRequestClose={() => setPreviewModal(false)}
        >
          <View style={styles.previewContainer}>
            <View style={styles.previewHeader}>
              <Text style={styles.previewTitle}>{previewItem?.title || '小说预览'}</Text>
              <TouchableOpacity onPress={() => setPreviewModal(false)}>
                <Ionicons name="close-circle" size={32} color="#888" />
              </TouchableOpacity>
            </View>
            <View style={styles.previewMeta}>
              <Text style={styles.previewMetaText}>
                第{previewItem?.chapterNumber}章
              </Text>
            </View>
            <ScrollView style={styles.previewScroll}>
              <Text style={styles.previewContent}>
                {previewItem?.content || '暂无正文内容'}
              </Text>
            </ScrollView>
          </View>
        </Modal>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
  },
  headerSubtitle: {
    color: '#888',
    fontSize: 14,
    marginTop: 4,
  },
  clearBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#1a1a1a',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#333',
  },
  clearBtnText: {
    color: '#888',
    fontSize: 13,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 100,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 80,
  },
  emptyTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '600',
    marginTop: 24,
    marginBottom: 8,
  },
  emptySubtitle: {
    color: '#888',
    fontSize: 14,
  },
  bookCard: {
    flexDirection: 'row',
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#333',
  },
  coverContainer: {
    width: 80,
    height: 120,
  },
  coverImage: {
    width: 80,
    height: 120,
  },
  bookInfo: {
    flex: 1,
    padding: 14,
    justifyContent: 'space-between',
  },
  bookTitle: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '600',
    marginBottom: 4,
  },
  bookChapter: {
    color: '#888',
    fontSize: 12,
    marginBottom: 6,
  },
  bookOutline: {
    color: '#888',
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 8,
  },
  bookActions: {
    flexDirection: 'row',
    gap: 16,
  },
  bookActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  bookActionText: {
    color: '#888',
    fontSize: 12,
  },
  previewContainer: {
    flex: 1,
    backgroundColor: '#000',
    paddingTop: 60,
  },
  previewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  previewTitle: {
    color: '#fff',
    fontSize: 22,
    fontWeight: 'bold',
  },
  previewMeta: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  previewMetaText: {
    color: '#888',
    fontSize: 14,
  },
  previewScroll: {
    flex: 1,
    padding: 20,
  },
  previewContent: {
    color: '#fff',
    fontSize: 15,
    lineHeight: 26,
  },
});
