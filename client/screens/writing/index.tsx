import React, { useState, useCallback, useRef } from 'react';
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
  ActivityIndicator,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Screen } from '@/components/Screen';
import { Ionicons } from '@expo/vector-icons';
import RNSSE from 'react-native-sse';

const API_BASE_URL = process.env.EXPO_PUBLIC_BACKEND_BASE_URL || 'http://localhost:9091';

const AGENT_STEPS = [
  { name: '世界观构建' },
  { name: '人物设定' },
  { name: '情节设计' },
  { name: '正文生成' },
  { name: '审核校对' },
  { name: '记忆存档' },
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
          const json = JSON.parse(event.data || '{}');
          if (json.type === 'step') {
            setCurrentStep(json.stepIndex);
          } else if (json.type === 'chunk' && json.content) {
            fullContent += json.content;
            setContent(fullContent);
          } else if (json.type === 'done' && json.content) {
            fullContent = json.content;
            setContent(fullContent);
          }
        } catch (e) {}
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
          <Text style={styles.headerTitle}>创作中心</Text>
          <TouchableOpacity style={styles.deleteBtn} onPress={handleDeleteChapter}>
            <Ionicons name="trash-outline" size={20} color="#888" />
          </TouchableOpacity>
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* Chapter Number */}
          <View style={styles.chapterBadge}>
            <Ionicons name="document-text" size={16} color="#888" />
            <Text style={styles.chapterText}>第 {chapterNumber} 章</Text>
          </View>

          {/* Outline Input */}
          <View style={styles.outlineSection}>
            <Text style={styles.sectionLabel}>章纲</Text>
            <TextInput
              style={styles.outlineInput}
              placeholder="输入本章章纲，描述本章主要情节..."
              placeholderTextColor="#555"
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
            {isGenerating ? (
              <ActivityIndicator color="#000" />
            ) : (
              <>
                <Ionicons name="bulb" size={20} color="#000" />
                <Text style={styles.generateBtnText}>开始创作</Text>
              </>
            )}
          </TouchableOpacity>

          {/* Agent Status */}
          {isGenerating && (
            <View style={styles.agentStatus}>
              <Text style={styles.agentStatusTitle}>AI创作进度</Text>
              <View style={styles.agentSteps}>
                {AGENT_STEPS.slice(0, 3).map((step, idx) => (
                  <View key={idx} style={styles.agentStepItem}>
                    <View
                      style={[
                        styles.stepDot,
                        currentStep >= idx && styles.stepDotActive,
                      ]}
                    />
                    <Text
                      style={[
                        styles.stepText,
                        currentStep >= idx && styles.stepTextActive,
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
                  <Ionicons name="expand" size={16} color="#888" />
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
                  <Ionicons name="cloud-upload" size={18} color="#000" />
                  <Text style={styles.saveBtnText}>存记忆</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.saveBtn} onPress={handleSaveToLibrary}>
                  <Ionicons name="bookmark" size={18} color="#000" />
                  <Text style={styles.saveBtnText}>存书架</Text>
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
                placeholderTextColor="#555"
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
    backgroundColor: '#000',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 16,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
  },
  deleteBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#1a1a1a',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#333',
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
    backgroundColor: '#1a1a1a',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    alignSelf: 'flex-start',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#333',
  },
  chapterText: {
    color: '#fff',
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
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
    padding: 14,
    color: '#fff',
    fontSize: 15,
    minHeight: 60,
    textAlignVertical: 'top',
    borderWidth: 1,
    borderColor: '#333',
  },
  generateBtn: {
    backgroundColor: '#fff',
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 8,
    marginBottom: 16,
  },
  generateBtnDisabled: {
    opacity: 0.5,
  },
  generateBtnText: {
    color: '#000',
    fontSize: 17,
    fontWeight: '600',
  },
  agentStatus: {
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#333',
  },
  agentStatusTitle: {
    color: '#fff',
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
    backgroundColor: '#fff',
  },
  stepText: {
    color: '#555',
    fontSize: 12,
  },
  stepTextActive: {
    color: '#fff',
  },
  currentStepText: {
    color: '#fff',
    fontSize: 13,
    marginTop: 10,
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
    color: '#888',
    fontSize: 13,
  },
  contentCard: {
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
    padding: 16,
    maxHeight: 400,
    borderWidth: 1,
    borderColor: '#333',
  },
  contentScroll: {
    maxHeight: 380,
  },
  contentText: {
    color: '#fff',
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
    backgroundColor: '#fff',
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    gap: 8,
  },
  saveBtnText: {
    color: '#000',
    fontSize: 15,
    fontWeight: '600',
  },
  emptyContent: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    color: '#888',
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
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 24,
    width: '100%',
    maxWidth: 340,
    borderWidth: 1,
    borderColor: '#333',
  },
  modalTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  modalInput: {
    backgroundColor: '#000',
    borderRadius: 8,
    padding: 14,
    color: '#fff',
    fontSize: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#333',
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
    borderRadius: 8,
    backgroundColor: '#333',
    alignItems: 'center',
  },
  modalCancelText: {
    color: '#888',
    fontSize: 16,
  },
  modalConfirmBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    backgroundColor: '#fff',
    alignItems: 'center',
  },
  modalConfirmText: {
    color: '#000',
    fontSize: 16,
    fontWeight: '600',
  },
  previewModalContainer: {
    flex: 1,
    backgroundColor: '#000',
    paddingTop: 60,
  },
  previewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
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
    color: '#fff',
    fontSize: 16,
    lineHeight: 28,
  },
});
