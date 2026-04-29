import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Modal,
  Image,
  Dimensions,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Screen } from '@/components/Screen';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

const { width } = Dimensions.get('window');
const CARD_WIDTH = (width - 52) / 2;

export default function BookshelfScreen() {
  const [novels, setNovels] = useState<any[]>([]);
  const [selectedNovel, setSelectedNovel] = useState<any>(null);
  const [detailModal, setDetailModal] = useState(false);

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

  const handleDelete = async (id: string) => {
    const updated = novels.filter((n) => n.id !== id);
    setNovels(updated);
    await AsyncStorage.setItem('novels', JSON.stringify(updated));
  };

  const handleOpenDetail = (novel: any) => {
    setSelectedNovel(novel);
    setDetailModal(true);
  };

  return (
    <Screen>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.headerTitle}>书架</Text>
            <Text style={styles.headerSubtitle}>
              {novels.length} 本作品
            </Text>
          </View>
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
        >
          {novels.length === 0 ? (
            <View style={styles.emptyState}>
              <LinearGradient
                colors={['rgba(0, 210, 255, 0.2)', 'rgba(108, 99, 255, 0.2)']}
                style={styles.emptyGradient}
              >
                <Ionicons name="book-outline" size={64} color="#00D2FF" />
              </LinearGradient>
              <Text style={styles.emptyTitle}>书架空空</Text>
              <Text style={styles.emptySubtitle}>
                将创作的作品保存到书架
              </Text>
            </View>
          ) : (
            <View style={styles.grid}>
              {novels.map((novel) => (
                <TouchableOpacity
                  key={novel.id}
                  style={styles.card}
                  onPress={() => handleOpenDetail(novel)}
                  activeOpacity={0.8}
                >
                  {/* Cover */}
                  <View style={styles.coverContainer}>
                    <Image
                      source={{ uri: novel.cover || `https://picsum.photos/seed/${novel.id}/200/300` }}
                      style={styles.cover}
                      resizeMode="cover"
                    />
                    <LinearGradient
                      colors={['transparent', 'rgba(0,0,0,0.8)']}
                      style={styles.coverOverlay}
                    />
                    <View style={styles.chapterBadge}>
                      <Text style={styles.chapterBadgeText}>
                        第{novel.chapterNumber}章
                      </Text>
                    </View>
                  </View>

                  {/* Info */}
                  <View style={styles.cardInfo}>
                    <Text style={styles.cardTitle} numberOfLines={2}>
                      {novel.title}
                    </Text>
                    <View style={styles.cardMeta}>
                      <Ionicons name="time-outline" size={12} color="#666" />
                      <Text style={styles.cardDate}>
                        {new Date(novel.createdAt).toLocaleDateString('zh-CN')}
                      </Text>
                    </View>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </ScrollView>

        {/* Detail Modal */}
        <Modal
          visible={detailModal}
          animationType="slide"
          onRequestClose={() => setDetailModal(false)}
        >
          <View style={styles.detailContainer}>
            <View style={styles.detailHeader}>
              <TouchableOpacity onPress={() => setDetailModal(false)}>
                <Ionicons name="arrow-back" size={28} color="#fff" />
              </TouchableOpacity>
              <Text style={styles.detailTitle} numberOfLines={1}>
                {selectedNovel?.title}
              </Text>
              <TouchableOpacity onPress={() => handleDelete(selectedNovel?.id)}>
                <Ionicons name="trash-outline" size={24} color="#FF6B9D" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.detailScroll}>
              {/* Outline */}
              <View style={styles.outlineSection}>
                <Text style={styles.sectionLabel}>本章纲</Text>
                <View style={styles.outlineCard}>
                  <Text style={styles.outlineText}>{selectedNovel?.outline}</Text>
                </View>
              </View>

              {/* Content */}
              <View style={styles.contentSection}>
                <Text style={styles.sectionLabel}>正文内容</Text>
                <View style={styles.contentCard}>
                  <Text style={styles.contentText}>{selectedNovel?.content}</Text>
                </View>
              </View>
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
    backgroundColor: '#0F0C29',
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
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  card: {
    width: CARD_WIDTH,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(108, 99, 255, 0.2)',
  },
  coverContainer: {
    width: '100%',
    height: CARD_WIDTH * 1.4,
    position: 'relative',
  },
  cover: {
    width: '100%',
    height: '100%',
  },
  coverOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '50%',
  },
  chapterBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(108, 99, 255, 0.9)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  chapterBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '600',
  },
  cardInfo: {
    padding: 12,
  },
  cardTitle: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
    lineHeight: 20,
  },
  cardMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  cardDate: {
    color: '#666',
    fontSize: 11,
  },
  detailContainer: {
    flex: 1,
    backgroundColor: '#0F0C29',
    paddingTop: 60,
  },
  detailHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  detailTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    flex: 1,
    textAlign: 'center',
    marginHorizontal: 16,
  },
  detailScroll: {
    flex: 1,
    padding: 20,
  },
  outlineSection: {
    marginBottom: 24,
  },
  sectionLabel: {
    color: '#6C63FF',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 10,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  outlineCard: {
    backgroundColor: 'rgba(108, 99, 255, 0.1)',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(108, 99, 255, 0.2)',
  },
  outlineText: {
    color: '#ccc',
    fontSize: 14,
    lineHeight: 22,
  },
  contentSection: {},
  contentCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 16,
    padding: 20,
  },
  contentText: {
    color: '#ccc',
    fontSize: 15,
    lineHeight: 26,
  },
});
