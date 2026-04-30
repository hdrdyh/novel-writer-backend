import { GC } from '@/utils/glassColors';
import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
  Modal,
  FlatList,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Screen } from '@/components/Screen';
import { Ionicons } from '@expo/vector-icons';

const API_BASE_URL = process.env.EXPO_PUBLIC_BACKEND_BASE_URL || 'http://localhost:9091';

interface MemoryItem {
  id: string;
  type: string;
  name: string;
  description: string;
  createdAt: string;
}

const TYPE_OPTIONS = [
  { value: 'character', label: '人物', icon: 'person', color: '#f472b6' },
  { value: 'world', label: '世界观', icon: 'globe', color: '#60a5fa' },
  { value: 'plot', label: '情节', icon: 'git-branch', color: '#fbbf24' },
  { value: 'setting', label: '设定', icon: 'settings', color: '#a78bfa' },
  { value: 'other', label: '其他', icon: 'bookmark', color: '#4ade80' },
];

const getTypeInfo = (type: string) => {
  return TYPE_OPTIONS.find((t) => t.value === type) || TYPE_OPTIONS[4];
};

export default function MemoryScreen() {
  const [memories, setMemories] = useState<MemoryItem[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedMemory, setSelectedMemory] = useState<MemoryItem | null>(null);

  // 添加表单
  const [newType, setNewType] = useState('character');
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');

  // 编辑
  const [editMode, setEditMode] = useState(false);

  // 预计算选中记忆的类型信息（避免JSX内重复调用）
  const selectedTypeInfo = selectedMemory ? getTypeInfo(selectedMemory.type) : null;

  const loadMemories = useCallback(async () => {
    try {
      const local = await AsyncStorage.getItem('memories');
      if (local) {
        setMemories(JSON.parse(local));
        return;
      }
      const res = await fetch(`${API_BASE_URL}/api/v1/memories`);
      const data = await res.json();
      if (data.memories) {
        setMemories(data.memories);
        await AsyncStorage.setItem('memories', JSON.stringify(data.memories));
      }
    } catch (e) {}
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadMemories();
    }, [loadMemories])
  );

  const handleAdd = async () => {
    if (!newName.trim() || !newDesc.trim()) {
      Alert.alert('提示', '请填写名称和描述');
      return;
    }

    const now = new Date();
    const newMemory: MemoryItem = {
      id: now.getTime().toString(),
      type: newType,
      name: newName.trim(),
      description: newDesc.trim(),
      createdAt: now.toISOString(),
    };

    const updated = [newMemory, ...memories];
    setMemories(updated);
    await AsyncStorage.setItem('memories', JSON.stringify(updated));

    setNewName('');
    setNewDesc('');
    setNewType('character');
    setShowAddModal(false);
    Alert.alert('成功', '已添加到记忆库');
  };

  const handleDelete = (id: string) => {
    Alert.alert('确认删除', '确定要删除这条记忆吗？', [
      { text: '取消', style: 'cancel' },
      {
        text: '删除',
        style: 'destructive',
        onPress: async () => {
          const updated = memories.filter((m) => m.id !== id);
          setMemories(updated);
          await AsyncStorage.setItem('memories', JSON.stringify(updated));
          setShowDetailModal(false);
          setSelectedMemory(null);
        },
      },
    ]);
  };

  const handleUpdate = async () => {
    if (!selectedMemory) return;
    const updated = memories.map((m) => (m.id === selectedMemory.id ? selectedMemory : m));
    setMemories(updated);
    await AsyncStorage.setItem('memories', JSON.stringify(updated));
    setEditMode(false);
    Alert.alert('成功', '已更新');
  };

  const renderMemoryItem = ({ item }: { item: MemoryItem }) => {
    const typeInfo = getTypeInfo(item.type);
    return (
      <TouchableOpacity
        style={styles.memoryCard}
        onPress={() => {
          setSelectedMemory(item);
          setEditMode(false);
          setShowDetailModal(true);
        }}
      >
        <View style={styles.memoryCardLeft}>
          <View style={[styles.typeIcon, { backgroundColor: typeInfo.color + '22' }]}>
            <Ionicons name={typeInfo.icon as any} size={18} color={typeInfo.color} />
          </View>
          <View style={styles.memoryCardInfo}>
            <Text style={styles.memoryName}>{item.name}</Text>
            <Text style={styles.memoryDesc} numberOfLines={2}>
              {item.description}
            </Text>
          </View>
        </View>
        <View style={[styles.typeBadge, { backgroundColor: typeInfo.color + '22' }]}>
          <Text style={[styles.typeBadgeText, { color: typeInfo.color }]}>{typeInfo.label}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <Screen>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>记忆库</Text>
          <TouchableOpacity
            style={styles.addBtn}
            onPress={() => setShowAddModal(true)}
          >
            <Ionicons name="add" size={24} color="#fff" />
          </TouchableOpacity>
        </View>

        {/* 统计 */}
        <View style={styles.statsRow}>
          {TYPE_OPTIONS.map((t) => {
            const count = memories.filter((m) => m.type === t.value).length;
            return (
              <View key={t.value} style={styles.statItem}>
                <Ionicons name={t.icon as any} size={16} color={t.color} />
                <Text style={styles.statCount}>{count}</Text>
              </View>
            );
          })}
        </View>

        {/* 列表 */}
        {memories.length > 0 ? (
          <FlatList
            data={memories}
            keyExtractor={(item) => item.id}
            renderItem={renderMemoryItem}
            contentContainerStyle={styles.listContent}
          />
        ) : (
          <View style={styles.emptyState}>
            <Ionicons name="bulb-outline" size={48} color="#8888AA" />
            <Text style={styles.emptyText}>记忆库为空</Text>
            <Text style={styles.emptySubText}>点击右上角 + 添加人物、世界观、情节等设定</Text>
          </View>
        )}

        {/* 添加弹窗 */}
        <Modal visible={showAddModal} transparent animationType="slide">
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>添加记忆</Text>
                <TouchableOpacity onPress={() => setShowAddModal(false)}>
                  <Ionicons name="close" size={24} color="#8888AA" />
                </TouchableOpacity>
              </View>

              <Text style={styles.modalLabel}>类型</Text>
              <View style={styles.typeRow}>
                {TYPE_OPTIONS.map((t) => (
                  <TouchableOpacity
                    key={t.value}
                    style={[
                      styles.typeOption,
                      newType === t.value && { backgroundColor: t.color + '22', borderColor: t.color },
                    ]}
                    onPress={() => setNewType(t.value)}
                  >
                    <Ionicons name={t.icon as any} size={16} color={newType === t.value ? t.color : GC.textSecondary} />
                    <Text style={[styles.typeOptionText, newType === t.value && { color: t.color }]}>
                      {t.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.modalLabel}>名称</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="角色名/地名/设定名..."
                placeholderTextColor="#555"
                value={newName}
                onChangeText={setNewName}
              />

              <Text style={styles.modalLabel}>描述</Text>
              <TextInput
                style={[styles.modalInput, { minHeight: 80 }]}
                placeholder="详细描述..."
                placeholderTextColor="#555"
                value={newDesc}
                onChangeText={setNewDesc}
                multiline
                textAlignVertical="top"
              />

              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={styles.modalCancelBtn}
                  onPress={() => setShowAddModal(false)}
                >
                  <Text style={styles.modalCancelText}>取消</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.modalConfirmBtn} onPress={handleAdd}>
                  <Text style={styles.modalConfirmText}>添加</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* 详情弹窗 */}
        <Modal visible={showDetailModal} transparent animationType="slide">
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              {selectedMemory && (
                <>
                  <View style={styles.modalHeader}>
                    <Text style={styles.modalTitle}>
                      {editMode ? '编辑记忆' : selectedMemory.name}
                    </Text>
                    <View style={{ flexDirection: 'row', gap: 12 }}>
                      {!editMode && (
                        <TouchableOpacity onPress={() => setEditMode(true)}>
                          <Ionicons name="create-outline" size={22} color="#8888AA" />
                        </TouchableOpacity>
                      )}
                      <TouchableOpacity
                        onPress={() => {
                          setShowDetailModal(false);
                          setEditMode(false);
                        }}
                      >
                        <Ionicons name="close" size={24} color="#8888AA" />
                      </TouchableOpacity>
                    </View>
                  </View>

                  <View style={[styles.typeBadge, { alignSelf: 'flex-start', marginBottom: 12 }]}>
                    <Text style={styles.typeBadgeText}>
                      {selectedTypeInfo ? selectedTypeInfo.label : '其他'}
                    </Text>
                  </View>

                  {editMode ? (
                    <>
                      <Text style={styles.modalLabel}>名称</Text>
                      <TextInput
                        style={styles.modalInput}
                        value={selectedMemory.name}
                        onChangeText={(t) => setSelectedMemory({ ...selectedMemory, name: t })}
                      />
                      <Text style={styles.modalLabel}>描述</Text>
                      <TextInput
                        style={[styles.modalInput, { minHeight: 100 }]}
                        value={selectedMemory.description}
                        onChangeText={(t) => setSelectedMemory({ ...selectedMemory, description: t })}
                        multiline
                        textAlignVertical="top"
                      />
                      <View style={styles.modalButtons}>
                        <TouchableOpacity
                          style={styles.modalCancelBtn}
                          onPress={() => handleDelete(selectedMemory.id)}
                        >
                          <Text style={{ color: '#ff6b6b', fontSize: 15 }}>删除</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.modalConfirmBtn} onPress={handleUpdate}>
                          <Text style={styles.modalConfirmText}>保存</Text>
                        </TouchableOpacity>
                      </View>
                    </>
                  ) : (
                    <>
                      <Text style={styles.detailDesc}>{selectedMemory.description}</Text>
                      <Text style={styles.detailTime}>
                        创建于 {new Date(selectedMemory.createdAt).toLocaleDateString()}
                      </Text>
                      <TouchableOpacity
                        style={styles.deleteDetailBtn}
                        onPress={() => handleDelete(selectedMemory.id)}
                      >
                        <Ionicons name="trash-outline" size={18} color="#ff6b6b" />
                        <Text style={styles.deleteDetailText}>删除此条</Text>
                      </TouchableOpacity>
                    </>
                  )}
                </>
              )}
            </View>
          </View>
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
  headerTitle: { fontSize: 28, fontWeight: 'bold', color: GC.textPrimary },
  addBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: GC.bgBase,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // 统计
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: 20,
    paddingVertical: 12,
    marginBottom: 8,
  },
  statItem: { alignItems: 'center', gap: 4 },
  statCount: { color: GC.textSecondary, fontSize: 13, fontWeight: '600' },

  // 列表
  listContent: { paddingHorizontal: 20, paddingBottom: 20 },
  memoryCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: GC.bgElevated,
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: GC.bgCard,
  },
  memoryCardLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  typeIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  memoryCardInfo: { flex: 1 },
  memoryName: { color: GC.textPrimary, fontSize: 16, fontWeight: '600', marginBottom: 4 },
  memoryDesc: { color: GC.textSecondary, fontSize: 13, lineHeight: 18 },
  typeBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  typeBadgeText: { fontSize: 12, fontWeight: '500' },

  // 空状态
  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingBottom: 100 },
  emptyText: { color: GC.textSecondary, fontSize: 16, marginTop: 16 },
  emptySubText: { color: '#555', fontSize: 13, marginTop: 8, textAlign: 'center' },

  // 弹窗
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: GC.bgElevated,
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
    borderColor: GC.border,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: { color: GC.textPrimary, fontSize: 20, fontWeight: 'bold' },
  modalLabel: { color: GC.textSecondary, fontSize: 13, marginBottom: 6, fontWeight: '500' },

  // 类型选择
  typeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  typeOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: GC.border,
  },
  typeOptionText: { color: GC.textSecondary, fontSize: 13 },

  modalInput: {
    backgroundColor: GC.bgElevated,
    borderRadius: 8,
    padding: 14,
    color: GC.textPrimary,
    fontSize: 15,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: GC.border,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  modalCancelBtn: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: GC.bgElevated,
    borderWidth: 1,
    borderColor: GC.border,
  },
  modalCancelText: { color: GC.textSecondary, fontSize: 15 },
  modalConfirmBtn: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: GC.bgBase,
  },
  modalConfirmText: { color: GC.textPrimary, fontSize: 15, fontWeight: '600' },

  // 详情
  detailDesc: { color: '#ddd', fontSize: 15, lineHeight: 26, marginBottom: 12 },
  detailTime: { color: '#555', fontSize: 12, marginBottom: 20 },
  deleteDetailBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
  },
  deleteDetailText: { color: '#ff6b6b', fontSize: 14 },
});
