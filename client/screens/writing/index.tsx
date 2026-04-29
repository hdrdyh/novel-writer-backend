import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
  Platform,
  KeyboardAvoidingView,
  Modal,
  Keyboard,
  ActivityIndicator,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Screen } from '@/components/Screen';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import RNSSE from 'react-native-sse';

const API_BASE_URL = process.env.EXPO_PUBLIC_BACKEND_BASE_URL || 'http://localhost:5000';

// Agent配置
const AGENT_STEPS = [
  { name: '世界观构建', color: '#6C63FF' },
  { name: '人物设定', color: '#00D2FF' },
  { name: '情节设计', color: '#FF6B9D' },
  { name: '正文生成', color: '#FFD93D' },
  { name: '审核校对', color: '#6BCB77' },
  { name: '记忆存档', color: '#FF8C42' },
];

export default function WritingScreen() {
  const [chapterNumber, setChapterNumber] = useState(1);
  const [outlineInput, setOutlineInput] = useState('');
  const [content, setContent] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentStep, setCurrentStep] = useState(-1);
  const [memoryItems, setMemoryItems] = useState<any[]>([]);
  const [savedItems, setSavedItems] = useState<any[]>([]);
  const [novels, setNovels] = useState<any[]>([]);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [novelName, setNovelName] = useState('');
  const [previewModal, setPreviewModal] = useState(false);
  const [previewContent, setPreviewContent] = useState('');
  const [previewTitle, setPreviewTitle] = useState('');

  const loadMemory = useCallback(async () => {
    try {
      const data = await AsyncStorage.getItem('memory');
      if (data) setMemoryItems(JSON.parse(data));
    } catch (e) {}
  }, []);

  const loadNovels = useCallback(async () => {
    try {
      const data = await AsyncStorage.getItem('novels');
      if (data) setNovels(JSON.parse(data));
    } catch (e) {}
  }, []);

  const loadSavedItems = useCallback(async () => {
    try {
      const data = await AsyncStorage.getItem('savedItems');
      if (data) setSavedItems(JSON.parse(data));
    } catch (e) {}
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadMemory();
      loadNovels();
      loadSavedItems();
    }, [loadMemory, loadNovels, loadSavedItems])
  );

  const handleGenerate = async () => {
    if (!outlineInput.trim()) {
      Alert.alert('提示', '请输入本章章纲');
      return;
    }

    setIsGenerating(true);
    setContent('');
    setCurrentStep(0);

    let fullContent = '';

    try {
      const sse = new RNSSE(`${API_BASE_URL}/api/v1/writing/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': 'sk-2d333ed0b01a4fe899df1c7c6cbe5617',
          'x-model': 'deepseek-v4-flash',
          'x-base-url': 'https://api.deepseek.com',
        },
        body: JSON.stringify({
          chapterId: `ch${Date.now()}`,
          chapterNumber,
          outline: outlineInput,
          memoryContext: memoryItems.slice(-2).map((m) => m.summary || m.content.substring(0, 500)),
          agentCount: 3,
        }),
      });

      sse.addEventListener('message', (event) => {
        if (event.data === '[DONE]') {
          setIsGenerating(false);
          setCurrentStep(-1);
          sse.close();
          return;
        }

        try {
          const json = JSON.parse(event.data);
          if (json.type === 'step') {
            setCurrentStep(json.stepIndex);
          } else if (json.type === 'chunk' && json.content) {
            fullContent += json.content;
            setContent(fullContent);
          } else if (json.type === 'done' && json.content) {
            fullContent = json.content;
            setContent(fullContent);
          }
        } catch (e) {
          // 忽略解析错误
        }
      });

      sse.addEventListener('error', (error) => {
        console.error('SSE Error:', error);
        setIsGenerating(false);
        setCurrentStep(-1);
        Alert.alert('错误', '生成失败，请检查网络连接');
      });

    } catch (error) {
      console.error('Generate error:', error);
      Alert.alert('错误', '生成失败，请检查网络连接');
      setIsGenerating(false);
      setCurrentStep(-1);
    }
  };

  const handleSaveToMemory = async () => {
    if (!content.trim()) {
      Alert.alert('提示', '先生成正文后再保存');
      return;
    }

    const newItem = {
      id: Date.now().toString(),
      chapterNumber,
      outline: outlineInput,
      content: content.substring(0, 5000),
      summary: content.substring(0, 200),
      createdAt: new Date().toISOString(),
    };

    const updated = [newItem, ...memoryItems];
    setMemoryItems(updated);
    await AsyncStorage.setItem('memory', JSON.stringify(updated));
    Alert.alert('成功', '已保存到记忆库');
  };

  const handleSaveToLibrary = () => {
    if (!content.trim()) {
      Alert.alert('提示', '先生成正文后再保存');
      return;
    }
    setNovelName(`小说第${Date.now() % 10000}`);
    setShowSaveModal(true);
  };

  const confirmSaveToLibrary = async () => {
    const newItem = {
      id: Date.now().toString(),
      title: novelName || `第${chapterNumber}章`,
      chapterNumber,
      outline: outlineInput,
      content,
      createdAt: new Date().toISOString(),
      cover: `https://picsum.photos/seed/${Date.now()}/200/300`,
    };

    const updated = [newItem, ...savedItems];
    setSavedItems(updated);
    await AsyncStorage.setItem('savedItems', JSON.stringify(updated));
    await AsyncStorage.setItem('novels', JSON.stringify(updated));

    setShowSaveModal(false);
    Alert.alert('成功', `已保存"${newItem.title}"到书架`);
  };

  const handleDeleteChapter = async () => {
    Alert.alert('确认', '确定删除本章内容吗？', [
      { text: '取消', style: 'cancel' },
      {
        text: '删除',
        style: 'destructive',
        onPress: () => {
          setContent('');
          setOutlineInput('');
        },
      },
    ]);
  };

  const handleDeleteMemory = async (id: string) => {
    const updated = memoryItems.filter((m) => m.id !== id);
    setMemoryItems(updated);
    await AsyncStorage.setItem('memory', JSON.stringify(updated));
  };

  const handleUseMemory = (summary: string) => {
    setOutlineInput((prev) => (prev ? prev + ' ' + summary : summary));
  };

  return (
    <Screen>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.container}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <LinearGradient
              colors={['#6C63FF', '#00D2FF']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.titleGradient}
            >
              <Text style={styles.headerTitle}>创作中心</Text>
            </LinearGradient>
          </View>
          <TouchableOpacity style={styles.deleteBtn} onPress={handleDeleteChapter}>
            <Ionicons name="trash-outline" size={20} color="#FF6B9D" />
          </TouchableOpacity>
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* Chapter Number */}
          <View style={styles.chapterBadge}>
            <Ionicons name="document-text" size={16} color="#6C63FF" />
            <Text style={styles.chapterText}>第 {chapterNumber} 章</Text>
          </View>

          {/* Outline Input - Compact */}
          <View style={styles.outlineSection}>
            <Text style={styles.sectionLabel}>章纲</Text>
            <TextInput
              style={styles.outlineInput}
              placeholder="输入本章章纲，描述本章主要情节..."
              placeholderTextColor="#666"
              value={outlineInput}
              onChangeText={setOutlineInput}
              multiline
            />
          </View>

          {/* Generate Button */}
          <TouchableOpacity
            style={[styles.generateBtn, isGenerating && styles.generateBtnDisabled]}
            onPress={handleGenerate}
            disabled={isGenerating}
          >
            <LinearGradient
              colors={isGenerating ? ['#555', '#444'] : ['#6C63FF', '#00D2FF']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.generateBtnGradient}
            >
              {isGenerating ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Ionicons name="bulb" size={20} color="#fff" />
                  <Text style={styles.generateBtnText}>开始创作</Text>
                </>
              )}
            </LinearGradient>
          </TouchableOpacity>

          {/* Agent Status */}
          {isGenerating && (
            <View style={styles.agentStatus}>
              <Text style={styles.agentStatusTitle}>
                <Ionicons name="analytics" size={16} color="#6C63FF" /> AI创作进度
              </Text>
              <View style={styles.agentSteps}>
                {AGENT_STEPS.slice(0, 3).map((step, idx) => (
                  <View key={idx} style={styles.agentStepItem}>
                    <View
                      style={[
                        styles.stepDot,
                        { backgroundColor: step.color },
                        currentStep >= idx && styles.stepDotActive,
                      ]}
                    />
                    <Text
                      style={[
                        styles.stepText,
                        currentStep >= idx && { color: step.color },
                      ]}
                    >
                      {step.name}
                    </Text>
                  </View>
                ))}
              </View>
              {currentStep >= 0 && (
                <Text style={styles.currentStepText}>
                  正在：{AGENT_STEPS[Math.min(currentStep, 2)]?.name}
                </Text>
              )}
            </View>
          )}

          {/* Content Display */}
          {content ? (
            <View style={styles.contentSection}>
              <View style={styles.contentHeader}>
                <Text style={styles.sectionLabel}>正文</Text>
                <TouchableOpacity
                  style={styles.previewBtn}
                  onPress={() => {
                    setPreviewContent(content);
                    setPreviewTitle(`第${chapterNumber}章`);
                    setPreviewModal(true);
                  }}
                >
                  <Ionicons name="expand" size={16} color="#6C63FF" />
                  <Text style={styles.previewBtnText}>全屏</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.contentCard}>
                <ScrollView style={styles.contentScroll} nestedScrollEnabled>
                  <Text style={styles.contentText}>{content}</Text>
                </ScrollView>
              </View>

              {/* Action Buttons */}
              <View style={styles.actionButtons}>
                <TouchableOpacity style={styles.saveBtn} onPress={handleSaveToMemory}>
                  <LinearGradient colors={['#6C63FF', '#6C63FF']} style={styles.saveBtnGradient}>
                    <Ionicons name="cloud-upload" size={18} color="#fff" />
                    <Text style={styles.saveBtnText}>存记忆</Text>
                  </LinearGradient>
                </TouchableOpacity>
                <TouchableOpacity style={styles.saveBtn} onPress={handleSaveToLibrary}>
                  <LinearGradient colors={['#00D2FF', '#00D2FF']} style={styles.saveBtnGradient}>
                    <Ionicons name="bookmark" size={18} color="#fff" />
                    <Text style={styles.saveBtnText}>存书架</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <View style={styles.emptyContent}>
              <Ionicons name="create-outline" size={48} color="#333" />
              <Text style={styles.emptyText}>输入章纲，点击开始创作</Text>
            </View>
          )}
        </ScrollView>

        {/* Save Modal */}
        <Modal visible={showSaveModal} transparent animationType="fade">
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>保存到书架</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="输入书名"
                placeholderTextColor="#666"
                value={novelName}
                onChangeText={setNovelName}
              />
              <Text style={styles.modalInfo}>章节：第{chapterNumber}章</Text>
              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={styles.modalCancelBtn}
                  onPress={() => setShowSaveModal(false)}
                >
                  <Text style={styles.modalCancelText}>取消</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.modalConfirmBtn} onPress={confirmSaveToLibrary}>
                  <Text style={styles.modalConfirmText}>确认保存</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* Preview Modal */}
        <Modal visible={previewModal} animationType="slide" onRequestClose={() => setPreviewModal(false)}>
          <View style={styles.previewModalContainer}>
            <View style={styles.previewHeader}>
              <Text style={styles.previewTitle}>{previewTitle}</Text>
              <TouchableOpacity onPress={() => setPreviewModal(false)}>
                <Ionicons name="close" size={28} color="#fff" />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.previewScroll}>
              <Text style={styles.previewText}>{previewContent}</Text>
            </ScrollView>
          </View>
        </Modal>
      </KeyboardAvoidingView>
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
    paddingBottom: 16,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
  },
  titleGradient: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  deleteBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 107, 157, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 100,
  },
  chapterBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(108, 99, 255, 0.2)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    alignSelf: 'flex-start',
    marginBottom: 16,
  },
  chapterText: {
    color: '#6C63FF',
    fontSize: 15,
    fontWeight: '600',
    marginLeft: 6,
  },
  outlineSection: {
    marginBottom: 16,
  },
  sectionLabel: {
    color: '#888',
    fontSize: 13,
    marginBottom: 8,
    fontWeight: '500',
  },
  outlineInput: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 12,
    padding: 14,
    color: '#fff',
    fontSize: 15,
    minHeight: 60,
    textAlignVertical: 'top',
  },
  generateBtn: {
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 16,
  },
  generateBtnDisabled: {
    opacity: 0.7,
  },
  generateBtnGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 8,
  },
  generateBtnText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '600',
  },
  agentStatus: {
    backgroundColor: 'rgba(108, 99, 255, 0.1)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(108, 99, 255, 0.3)',
  },
  agentStatusTitle: {
    color: '#6C63FF',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 12,
  },
  agentSteps: {
    flexDirection: 'row',
    gap: 16,
  },
  agentStepItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  stepDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#333',
  },
  stepDotActive: {
    backgroundColor: '#6C63FF',
    shadowColor: '#6C63FF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 4,
  },
  stepText: {
    color: '#666',
    fontSize: 12,
  },
  currentStepText: {
    color: '#00D2FF',
    fontSize: 13,
    marginTop: 10,
    fontStyle: 'italic',
  },
  contentSection: {
    marginTop: 8,
  },
  contentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  previewBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  previewBtnText: {
    color: '#6C63FF',
    fontSize: 13,
  },
  contentCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: 16,
    padding: 16,
    maxHeight: 400,
  },
  contentScroll: {
    maxHeight: 380,
  },
  contentText: {
    color: '#ddd',
    fontSize: 15,
    lineHeight: 26,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
  saveBtn: {
    flex: 1,
    borderRadius: 12,
    overflow: 'hidden',
  },
  saveBtnGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    gap: 8,
  },
  saveBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  emptyContent: {
    alignItems: 'center',
    paddingVertical: 60,
    opacity: 0.5,
  },
  emptyText: {
    color: '#555',
    fontSize: 15,
    marginTop: 12,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#252550',
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 340,
  },
  modalTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  modalInput: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
    padding: 14,
    color: '#fff',
    fontSize: 16,
    marginBottom: 12,
  },
  modalInfo: {
    color: '#888',
    fontSize: 14,
    marginBottom: 20,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  modalCancelBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
  },
  modalCancelText: {
    color: '#888',
    fontSize: 16,
  },
  modalConfirmBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#6C63FF',
    alignItems: 'center',
  },
  modalConfirmText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  previewModalContainer: {
    flex: 1,
    backgroundColor: '#1A1A3E',
    paddingTop: 60,
  },
  previewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  previewTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  previewScroll: {
    flex: 1,
    padding: 20,
  },
  previewText: {
    color: '#ccc',
    fontSize: 16,
    lineHeight: 28,
  },
});
