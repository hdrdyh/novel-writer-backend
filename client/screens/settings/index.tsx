import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Screen } from '@/components/Screen';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

const API_BASE_URL = typeof window !== 'undefined' && window.location.hostname !== 'localhost'
  ? 'https://novel-writer-backend-production-24e9.up.railway.app'
  : 'http://localhost:5000';

export default function SettingsScreen() {
  const [serverUrl, setServerUrl] = useState(API_BASE_URL);
  const [apiKey, setApiKey] = useState('');
  const [model, setModel] = useState('deepseek-v4-flash');
  const [baseUrl, setBaseUrl] = useState('https://api.deepseek.com');
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [agents, setAgents] = useState<any[]>([]);

  // 初始化加载设置
  useEffect(() => {
    const init = async () => {
      try {
        const saved = await AsyncStorage.getItem('llm_settings');
        if (saved) {
          const settings = JSON.parse(saved);
          setApiKey(settings.apiKey || '');
          setModel(settings.model || 'deepseek-v4-flash');
          setBaseUrl(settings.baseUrl || 'https://api.deepseek.com');
        }
        const savedServer = await AsyncStorage.getItem('server_url');
        if (savedServer) setServerUrl(savedServer);
      } catch (e) {}
    };
    init();
  }, []);

  const saveSettings = async () => {
    try {
      await AsyncStorage.setItem('llm_settings', JSON.stringify({
        apiKey,
        model,
        baseUrl,
      }));
      await AsyncStorage.setItem('server_url', serverUrl);
      Alert.alert('成功', '配置已保存');
    } catch (e) {
      Alert.alert('错误', '保存失败');
    }
  };

  const handleTestConnection = async () => {
    setConnectionStatus('testing');
    try {
      const res = await fetch(`${serverUrl}/api/v1/health`);
      if (res.ok) {
        setConnectionStatus('success');
        setTimeout(() => setConnectionStatus('idle'), 2000);
      } else {
        setConnectionStatus('error');
      }
    } catch {
      setConnectionStatus('error');
    }
  };

  return (
    <Screen>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>设置</Text>
          <Text style={styles.headerSubtitle}>配置AI写作助手</Text>
        </View>

        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
          {/* Server Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>服务器配置</Text>
            <View style={styles.card}>
              <View style={styles.inputRow}>
                <Ionicons name="server-outline" size={20} color="#6C63FF" />
                <TextInput
                  style={styles.input}
                  value={serverUrl}
                  onChangeText={setServerUrl}
                  placeholder="输入服务器地址"
                  placeholderTextColor="#555"
                />
              </View>
              <TouchableOpacity
                style={[
                  styles.testBtn,
                  connectionStatus === 'success' && styles.testBtnSuccess,
                  connectionStatus === 'error' && styles.testBtnError,
                ]}
                onPress={handleTestConnection}
                disabled={connectionStatus === 'testing'}
              >
                {connectionStatus === 'testing' ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Ionicons
                      name={connectionStatus === 'success' ? 'checkmark-circle' : 'pulse-outline'}
                      size={18}
                      color="#fff"
                    />
                    <Text style={styles.testBtnText}>
                      {connectionStatus === 'success' ? '连接成功' : '测试连接'}
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>

          {/* LLM Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>AI模型配置</Text>
            <View style={styles.card}>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>API Key</Text>
                <TextInput
                  style={styles.textInput}
                  value={apiKey}
                  onChangeText={setApiKey}
                  placeholder="输入API Key"
                  placeholderTextColor="#555"
                  secureTextEntry
                />
              </View>
              <View style={styles.divider} />
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>模型名称</Text>
                <TextInput
                  style={styles.textInput}
                  value={model}
                  onChangeText={setModel}
                  placeholder="deepseek-v4-flash"
                  placeholderTextColor="#555"
                />
              </View>
              <View style={styles.divider} />
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>API Base URL</Text>
                <TextInput
                  style={styles.textInput}
                  value={baseUrl}
                  onChangeText={setBaseUrl}
                  placeholder="https://api.deepseek.com"
                  placeholderTextColor="#555"
                  keyboardType="url"
                  autoCapitalize="none"
                />
              </View>
            </View>
          </View>

          {/* Agents Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Agent配置</Text>
            <View style={styles.card}>
              <View style={styles.agentInfo}>
                <Ionicons name="cube-outline" size={20} color="#00D2FF" />
                <Text style={styles.agentText}>后端自动管理6个Agent</Text>
              </View>
              <View style={styles.agentGrid}>
                {['策划师', '写手', '校对', '优化', '审核', '归档'].map((name, i) => (
                  <View key={i} style={styles.agentBadge}>
                    <Text style={styles.agentBadgeText}>{name}</Text>
                  </View>
                ))}
              </View>
            </View>
          </View>

          {/* Save Button */}
          <TouchableOpacity style={styles.saveBtn} onPress={saveSettings} activeOpacity={0.8}>
            <LinearGradient
              colors={['#6C63FF', '#00D2FF']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.saveBtnGradient}
            >
              <Ionicons name="checkmark-circle-outline" size={20} color="#fff" />
              <Text style={styles.saveBtnText}>保存配置</Text>
            </LinearGradient>
          </TouchableOpacity>

          {/* Version */}
          <Text style={styles.version}>v1.0.0 · 心文AI写作</Text>
        </ScrollView>
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
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 24,
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
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    color: '#6C63FF',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  card: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(108, 99, 255, 0.2)',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  input: {
    flex: 1,
    color: '#fff',
    fontSize: 15,
    paddingVertical: 8,
  },
  testBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: 'rgba(108, 99, 255, 0.3)',
    borderRadius: 12,
    paddingVertical: 12,
    marginTop: 16,
  },
  testBtnSuccess: {
    backgroundColor: 'rgba(16, 185, 129, 0.3)',
  },
  testBtnError: {
    backgroundColor: 'rgba(255, 107, 157, 0.3)',
  },
  testBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  inputGroup: {
    marginBottom: 4,
  },
  inputLabel: {
    color: '#888',
    fontSize: 12,
    marginBottom: 8,
  },
  textInput: {
    color: '#fff',
    fontSize: 15,
    paddingVertical: 8,
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    marginVertical: 16,
  },
  agentInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 16,
  },
  agentText: {
    color: '#ddd',
    fontSize: 14,
  },
  agentGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  agentBadge: {
    backgroundColor: 'rgba(108, 99, 255, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(108, 99, 255, 0.3)',
  },
  agentBadgeText: {
    color: '#00D2FF',
    fontSize: 12,
    fontWeight: '500',
  },
  saveBtn: {
    marginTop: 10,
    borderRadius: 16,
    overflow: 'hidden',
  },
  saveBtnGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 16,
  },
  saveBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  version: {
    color: '#444',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 30,
  },
});
