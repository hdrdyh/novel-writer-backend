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
import { LinearGradient } from 'expo-linear-gradient';
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
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.headerTitle}>记忆库</Text>
            <Text style={styles.headerSubtitle}>
              {memoryItems.length} 条记忆 · 上下文参考
            </Text>
          </View>
        </View>

        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
          {memoryItems.length === 0 ? (
            <View style={styles.emptyState}>
              <LinearGradient
                colors={['rgba(108, 99, 255, 0.2)', 'rgba(0, 210, 255, 0.2)']}
                style={styles.emptyGradient}
              >
                <Ionicons name="library-outline" size={64} color="#6C63FF" />
              </LinearGradient>
              <Text style={styles.emptyTitle}>暂无记忆</Text>
              <Text style={styles.emptySubtitle}>
                创作章节后保存到记忆库
              </Text>
            </View>
          ) : (
            memoryItems.map((item, index) => (
              <View key={item.id} style={styles.card}>
                {/* Chapter Badge */}
                <View style={styles.cardHeader}>
                  <LinearGradient
                    colors={['#6C63FF', '#00D2FF']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.chapterBadge}
                  >
                    <Text style={styles.chapterText}>第{item.chapterNumber}章</Text>
                  </LinearGradient>
                  <TouchableOpacity
                    style={styles.deleteBtn}
                    onPress={() => handleDelete(item.id)}
                  >
                    <Ionicons name="trash-outline" size={18} color="#FF6B9D" />
                  </TouchableOpacity>
                </View>

                {/* Outline */}
                <Text style={styles.outlineText} numberOfLines={2}>
                  {item.outline}
                </Text>

                {/* Summary */}
                <View style={styles.summaryContainer}>
                  <Text style={styles.summaryLabel}>摘要</Text>
                  <Text style={styles.summaryText} numberOfLines={3}>
                    {item.summary || item.content?.substring(0, 150)}
                  </Text>
                </View>

                {/* Content Preview - Fixed */}
                <TouchableOpacity
                  style={styles.previewBtn}
                  onPress={() => handlePreview(item)}
                  activeOpacity={0.7}
                >
                  <LinearGradient
                    colors={['rgba(108, 99, 255, 0.15)', 'rgba(0, 210, 255, 0.1)']}
                    style={styles.previewBtnGradient}
                  >
                    <Ionicons name="document-text-outline" size={16} color="#6C63FF" />
                    <Text style={styles.previewBtnText}>正文预览</Text>
                    <Ionicons name="chevron-forward" size={16} color="#6C63FF" />
                  </LinearGradient>
                </TouchableOpacity>

                {/* Date */}
                <Text style={styles.dateText}>
                  <Ionicons name="time-outline" size={12} color="#666" />
                  {' '}
                  {new Date(item.createdAt).toLocaleDateString('zh-CN')}
                </Text>
              </View>
            ))
          )}
        </ScrollView>

        {/* Preview Modal */}
        <Modal
          visible={previewModal}
          animationType="slide"
          onRequestClose={() => setPreviewModal(false)}
        >
          <View style={styles.previewContainer}>
            <View style={styles.previewHeader}>
              <View>
                <Text style={styles.previewTitle}>第{previewItem?.chapterNumber}章正文</Text>
                <Text style={styles.previewSubtitle}>
                  {previewItem?.outline?.substring(0, 50)}
                </Text>
              </View>
              <TouchableOpacity onPress={() => setPreviewModal(false)}>
                <Ionicons name="close-circle" size={32} color="#666" />
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
    backgroundColor: '#1A1A3E',
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
    color: '#666',
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
  emptyGradient: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  emptyTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 8,
  },
  emptySubtitle: {
    color: '#666',
    fontSize: 14,
  },
  card: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 20,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(108, 99, 255, 0.2)',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  chapterBadge: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
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
    backgroundColor: 'rgba(255, 107, 157, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  outlineText: {
    color: '#ddd',
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 12,
  },
  summaryContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  summaryLabel: {
    color: '#6C63FF',
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  summaryText: {
    color: '#888',
    fontSize: 13,
    lineHeight: 20,
  },
  previewBtn: {
    marginBottom: 12,
  },
  previewBtnGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    gap: 8,
  },
  previewBtnText: {
    color: '#6C63FF',
    fontSize: 14,
    fontWeight: '600',
  },
  dateText: {
    color: '#555',
    fontSize: 12,
  },
  previewContainer: {
    flex: 1,
    backgroundColor: '#1A1A3E',
    paddingTop: 60,
  },
  previewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  previewTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  previewSubtitle: {
    color: '#666',
    fontSize: 13,
    marginTop: 4,
    maxWidth: 280,
  },
  previewScroll: {
    flex: 1,
    padding: 20,
  },
  previewContent: {
    color: '#ccc',
    fontSize: 15,
    lineHeight: 26,
  },
});
