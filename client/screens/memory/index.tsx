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

export default function MemoryScreen() {
  const [memoryItems, setMemoryItems] = useState<any[]>([]);
  const [previewModal, setPreviewModal] = useState(false);
  const [previewItem, setPreviewItem] = useState<any>(null);

  const loadMemory = useCallback(async () => {
    try {
      const data = await AsyncStorage.getItem('memory');
      if (data) setMemoryItems(JSON.parse(data));
    } catch (e) {}
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadMemory();
    }, [loadMemory])
  );

  const handleDelete = (id: string) => {
    Alert.alert('确认', '确定删除这条记忆吗？', [
      { text: '取消', style: 'cancel' },
      {
        text: '删除',
        style: 'destructive',
        onPress: async () => {
          const updated = memoryItems.filter((m) => m.id !== id);
          setMemoryItems(updated);
          await AsyncStorage.setItem('memory', JSON.stringify(updated));
        },
      },
    ]);
  };

  const handlePreview = (item: any) => {
    setPreviewItem(item);
    setPreviewModal(true);
  };

  return (
    <Screen>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>记忆库</Text>
          <Text style={styles.headerSubtitle}>
            {memoryItems.length} 条记忆
          </Text>
        </View>

        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
          {memoryItems.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="library-outline" size={64} color="#333" />
              <Text style={styles.emptyTitle}>暂无记忆</Text>
              <Text style={styles.emptySubtitle}>创作章节后保存到记忆库</Text>
            </View>
          ) : (
            memoryItems.map((item) => (
              <View key={item.id} style={styles.card}>
                <View style={styles.cardHeader}>
                  <View style={styles.chapterBadge}>
                    <Text style={styles.chapterText}>第{item.chapterNumber}章</Text>
                  </View>
                  <TouchableOpacity
                    style={styles.deleteBtn}
                    onPress={() => handleDelete(item.id)}
                  >
                    <Ionicons name="trash-outline" size={18} color="#888" />
                  </TouchableOpacity>
                </View>

                <Text style={styles.outlineText} numberOfLines={2}>
                  {item.outline}
                </Text>

                <View style={styles.summaryContainer}>
                  <Text style={styles.summaryLabel}>摘要</Text>
                  <Text style={styles.summaryText} numberOfLines={3}>
                    {item.summary || item.content?.substring(0, 150)}
                  </Text>
                </View>

                <TouchableOpacity
                  style={styles.previewBtn}
                  onPress={() => handlePreview(item)}
                  activeOpacity={0.7}
                >
                  <Ionicons name="document-text-outline" size={16} color="#888" />
                  <Text style={styles.previewBtnText}>正文预览</Text>
                  <Ionicons name="chevron-forward" size={16} color="#888" />
                </TouchableOpacity>

                <Text style={styles.dateText}>
                  {new Date(item.createdAt).toLocaleDateString('zh-CN')}
                </Text>
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
              <Text style={styles.previewTitle}>第{previewItem?.chapterNumber}章正文</Text>
              <TouchableOpacity onPress={() => setPreviewModal(false)}>
                <Ionicons name="close-circle" size={32} color="#888" />
              </TouchableOpacity>
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
  card: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#333',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  chapterBadge: {
    backgroundColor: '#333',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 8,
  },
  chapterText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  deleteBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#1a1a1a',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#333',
  },
  outlineText: {
    color: '#ccc',
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 12,
  },
  summaryContainer: {
    backgroundColor: '#000',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#333',
  },
  summaryLabel: {
    color: '#888',
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 6,
  },
  summaryText: {
    color: '#888',
    fontSize: 13,
    lineHeight: 20,
  },
  previewBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 8,
    marginBottom: 12,
    backgroundColor: '#1a1a1a',
    borderWidth: 1,
    borderColor: '#333',
    gap: 8,
  },
  previewBtnText: {
    color: '#888',
    fontSize: 14,
    fontWeight: '600',
  },
  dateText: {
    color: '#555',
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
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  previewTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
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
