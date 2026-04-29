import { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  Alert,
} from 'react-native';
import { Screen } from '@/components/Screen';
import { Feather } from '@expo/vector-icons';

interface MemoryChapter {
  id: string;
  chapterNumber: number;
  content: string;
  summary: string;
  createdAt: string;
}

export default function MemoryScreen() {
  const [memories, setMemories] = useState<MemoryChapter[]>([
    {
      id: '1',
      chapterNumber: 1,
      content: '张远站在废墟之中，四周是断壁残垣...',
      summary: '主角张远穿越到异世界，在青石镇废墟中醒来，遇到白发老者，得知觉醒仪式的存在。',
      createdAt: '2024-01-15',
    },
    {
      id: '2',
      chapterNumber: 2,
      content: '觉醒仪式在广场中央举行...',
      summary: '张远参加觉醒仪式，展现出惊人的天赋，引起各方势力的关注。',
      createdAt: '2024-01-16',
    },
  ]);

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [expandedContentIds, setExpandedContentIds] = useState<Set<string>>(new Set());

  const toggleContentExpand = (id: string) => {
    setExpandedContentIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const handleUseMemory = (memory: MemoryChapter) => {
    Alert.alert(
      '使用记忆',
      `确定要在当前章节中使用「第${memory.chapterNumber}章」的记忆作为上下文？`,
      [
        { text: '取消', style: 'cancel' },
        {
          text: '使用',
          onPress: () => {
            Alert.alert('已使用', '记忆已添加到写作上下文');
          },
        },
      ]
    );
  };

  const handleDeleteMemory = (id: string) => {
    Alert.alert('删除记忆', '确定删除该记忆？', [
      { text: '取消', style: 'cancel' },
      {
        text: '删除',
        style: 'destructive',
        onPress: () => setMemories(prev => prev.filter(m => m.id !== id)),
      },
    ]);
  };

  const toggleExpand = (id: string) => {
    setExpandedId(prev => (prev === id ? null : id));
  };

  return (
    <Screen>
      <View style={styles.header}>
        <Text style={styles.greeting}>记忆库</Text>
        <Text style={styles.title}>已保存章节</Text>
      </View>

      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        {memories.length === 0 ? (
          <View style={styles.emptyState}>
            <Feather name="database" size={48} color="#CCCCCC" />
            <Text style={styles.emptyText}>暂无记忆</Text>
            <Text style={styles.emptyHint}>在写作台保存章节后，这里会显示记忆</Text>
          </View>
        ) : (
          <>
            <View style={styles.infoCard}>
              <Feather name="info" size={16} color="#888888" />
              <Text style={styles.infoText}>
                共 {memories.length} 条记忆，可用于后续章节的上下文参考
              </Text>
            </View>

            {memories.map(memory => (
              <Pressable
                key={memory.id}
                style={styles.card}
                onPress={() => toggleExpand(memory.id)}
              >
                <View style={styles.cardHeader}>
                  <View style={styles.chapterInfo}>
                    <Text style={styles.chapterNumber}>第{memory.chapterNumber}章</Text>
                    <Text style={styles.dateText}>{memory.createdAt}</Text>
                  </View>
                  <Feather
                    name={expandedId === memory.id ? 'chevron-up' : 'chevron-down'}
                    size={20}
                    color="#888888"
                  />
                </View>

                <Text style={styles.summaryText}>{memory.summary}</Text>

                {expandedId === memory.id && (
                  <View style={styles.expandedContent}>
                    <View style={styles.divider} />
                    <Text style={styles.contentLabel}>正文预览</Text>
                    <Text style={styles.contentText} numberOfLines={expandedContentIds.has(memory.id) ? undefined : 6}>
                      {memory.content}
                    </Text>
                    <Pressable onPress={() => toggleContentExpand(memory.id)}>
                      <Text style={styles.expandText}>
                        {expandedContentIds.has(memory.id) ? '收起' : '查看全部'}
                      </Text>
                    </Pressable>

                    <View style={styles.cardActions}>
                      <Pressable
                        style={styles.useBtn}
                        onPress={() => handleUseMemory(memory)}
                      >
                        <Feather name="corner-down-left" size={14} color="#111111" />
                        <Text style={styles.useBtnText}>使用此记忆</Text>
                      </Pressable>
                      <Pressable
                        style={styles.deleteBtn}
                        onPress={() => handleDeleteMemory(memory.id)}
                      >
                        <Feather name="trash-2" size={14} color="#888888" />
                      </Pressable>
                    </View>
                  </View>
                )}
              </Pressable>
            ))}
          </>
        )}
        <View style={styles.bottomSpacer} />
      </ScrollView>
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
  infoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#F7F7F7',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    color: '#888888',
    lineHeight: 20,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#ECECEC',
    padding: 20,
    marginBottom: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  chapterInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  chapterNumber: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111111',
  },
  dateText: {
    fontSize: 12,
    color: '#CCCCCC',
  },
  summaryText: {
    fontSize: 14,
    color: '#888888',
    lineHeight: 22,
  },
  expandedContent: {
    marginTop: 4,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#ECECEC',
    marginVertical: 16,
  },
  contentLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#888888',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  contentText: {
    fontSize: 14,
    color: '#111111',
    lineHeight: 24,
  },
  expandText: {
    fontSize: 14,
    color: '#4A90D9',
    fontWeight: '600',
    marginTop: 8,
    textAlign: 'center',
  },
  cardActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#ECECEC',
  },
  useBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F7F7F7',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  useBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#111111',
  },
  deleteBtn: {
    padding: 10,
  },
  bottomSpacer: {
    height: 100,
  },
});
