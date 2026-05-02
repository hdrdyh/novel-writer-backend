import React, { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView,
  Modal, TextInput, ActivityIndicator, Alert,
} from 'react-native';
type ReviewApiConfig = { baseUrl: string; apiKey: string; model: string };
import RNSSE from 'react-native-sse';
import { GC } from '@/utils/glassColors';

// 专业Agent列表（对应PRESET_AGENTS中必须参与的类型）
const PRO_AGENTS = [
  { id: 'writer', label: '写手', color: '#8B5CF6', desc: '产出正文' },
  { id: 'coordinator', label: '统筹', color: '#F59E0B', desc: '编排流程' },
  { id: 'world_architect', label: '世界架构师', color: '#6B7280', desc: '世界观设计' },
  { id: 'plot_designer', label: '剧情设计师', color: '#6B7280', desc: '情节设计' },
  { id: 'character_designer', label: '人物设计师', color: '#6B7280', desc: '人物塑造' },
  { id: 'rough_designer', label: '粗纲设计师', color: '#6B7280', desc: '章节粗纲' },
  { id: 'detail_designer', label: '细纲设计师', color: '#6B7280', desc: '章节细纲' },
  { id: 'memory_compressor', label: '记忆压缩', color: '#6B7280', desc: '前文摘要' },
  { id: 'foreshadow_designer', label: '伏笔设计师', color: '#6B7280', desc: '伏笔布局' },
];

// 读者Agent列表
const READER_AGENTS = [
  { id: 'office_worker', label: '上班族', color: '#FF6B35', desc: '权重x2', weight: 2 },
  { id: 'otaku', label: '宅男', color: '#7C3AED', desc: '权重x2', weight: 2 },
  { id: 'student', label: '学生党', color: '#059669', desc: '权重x2', weight: 2 },
  { id: 'veteran', label: '老书虫', color: '#6B7280', desc: '权重x1.5', weight: 1.5 },
  { id: 'night_owl', label: '夜猫族', color: '#3B82F6', desc: '权重x1.5', weight: 1.5 },
];

interface AgentTestPanelProps {
  visible: boolean;
  onClose: () => void;
  onSave?: (config: { baseUrl: string; apiKey: string; model: string }) => void;
  initialConfig?: { baseUrl: string; apiKey: string; model: string };
}

export default function AgentTestPanel({
  visible, onClose, onSave, initialConfig,
}: AgentTestPanelProps) {
  const [apiKey, setApiKey] = useState(initialConfig?.apiKey || '');
  const [baseUrl, setBaseUrl] = useState(initialConfig?.baseUrl || '');
  const [model, setModel] = useState(initialConfig?.model || '');
  const [selectedAgent, setSelectedAgent] = useState('writer');
  const [testPrompt, setTestPrompt] = useState('你好，请简短回复：测试成功');
  const [testSystem, setTestSystem] = useState('');
  const [testLoading, setTestLoading] = useState(false);
  const [testResult, setTestResult] = useState('');
  const [testError, setTestError] = useState('');
  const [testType, setTestType] = useState<'pro' | 'reader'>('pro');


  const allAgents = testType === 'pro' ? PRO_AGENTS : READER_AGENTS;

  const handleSave = () => {
    if (onSave) {
      onSave({ baseUrl, apiKey, model });
    }
    onClose();
  };

  const handleTest = async () => {
    if (!apiKey.trim() && !baseUrl.trim()) {
      Alert.alert('请填写', '请先填写 API Key 或 Base URL');
      return;
    }

    setTestLoading(true);
    setTestResult('');
    setTestError('');

    const agent = allAgents.find(a => a.id === selectedAgent);
    const systemPrompt = testSystem || `你是小说创作团队中的${agent?.label || selectedAgent}。`;

    try {
      let fullContent = '';

      // 构建URL和参数
      const useLocalBackend = !apiKey.trim() && !baseUrl.trim();
      const url = useLocalBackend
        ? 'http://vefaas-prrxc29p-evjxady09u-d7qpsi03rt8n0s8g8ga0-sandbox:9091/api/v1/review/agent-stream'
        : `${baseUrl.replace(/\/$/, '')}/api/v1/review/agent-stream`;

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      // 如果用户提供了自己的key，通过Authorization传递
      const effectiveApiKey = apiKey.trim();

      const body: Record<string, string> = {
        agentId: selectedAgent,
        agentRole: agent?.label || selectedAgent,
        agentType: testType,
        prompt: testPrompt,
        systemPrompt,
      };

      if (effectiveApiKey) {
        body.apiKey = effectiveApiKey;
      }
      if (model.trim()) {
        body.model = model.trim();
      }

      const sse = new RNSSE(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      });

      sse.addEventListener('message', (event) => {
        if (event.data === '[DONE]') {
          sse.close();
          return;
        }
        try {
          if (!event.data) return; const parsed = JSON.parse(event.data);
          const msg = (parsed as { content?: string }).content; fullContent += (msg ?? '') || '';
          setTestResult(fullContent);
        } catch {
          fullContent += event.data;
          setTestResult(fullContent);
        }
      });

      sse.addEventListener('error', () => {
        setTestError(`连接失败，请检查网络和配置`);
        setTestLoading(false);
        sse.close();
      });

      sse.addEventListener('close', () => {
        setTestLoading(false);
      });

    } catch (err: any) {
      setTestError(`错误: ${err.message || '未知错误'}`);
      setTestLoading(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={{
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.7)',
        justifyContent: 'flex-end',
      }}>
        <View style={{
          backgroundColor: GC.bgBase,
          borderTopLeftRadius: 20,
          borderTopRightRadius: 20,
          maxHeight: '90%',
        }}>
          {/* Header */}
          <View style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: 16,
            borderBottomWidth: 1,
            borderBottomColor: GC.border,
          }}>
            <Text style={{ color: GC.textPrimary, fontSize: 18, fontWeight: 'bold' }}>
              审查设置
            </Text>
            <TouchableOpacity onPress={onClose}>
              <Text style={{ color: GC.textSecondary, fontSize: 16 }}>X</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={{ padding: 16 }}>
            {/* 全局API配置 */}
            <Text style={{ color: GC.textPrimary, fontSize: 14, fontWeight: 'bold', marginBottom: 12 }}>
              全局API配置（所有Agent共用）
            </Text>

            <Text style={{ color: GC.textSecondary, fontSize: 12, marginBottom: 6 }}>
              API Key（留空则使用后端默认CozeLLM）
            </Text>
            <TextInput
              value={apiKey}
              onChangeText={setApiKey}
              placeholder="sk-xxxx 或留空"
              placeholderTextColor={GC.textSecondary}
              style={{
                backgroundColor: GC.bgCard,
                borderRadius: 10,
                padding: 12,
                color: GC.textPrimary,
                marginBottom: 12,
                borderWidth: 1,
                borderColor: GC.border,
              }}
            />

            <Text style={{ color: GC.textSecondary, fontSize: 12, marginBottom: 6 }}>
              Base URL（留空则使用内置后端）
            </Text>
            <TextInput
              value={baseUrl}
              onChangeText={setBaseUrl}
              placeholder="https://api.deepseek.com（留空用内置）"
              placeholderTextColor={GC.textSecondary}
              style={{
                backgroundColor: GC.bgCard,
                borderRadius: 10,
                padding: 12,
                color: GC.textPrimary,
                marginBottom: 12,
                borderWidth: 1,
                borderColor: GC.border,
              }}
            />

            <Text style={{ color: GC.textSecondary, fontSize: 12, marginBottom: 6 }}>
              模型
            </Text>
            <TextInput
              value={model}
              onChangeText={setModel}
              placeholder="deepseek-v4-flash（留空用默认）"
              placeholderTextColor={GC.textSecondary}
              style={{
                backgroundColor: GC.bgCard,
                borderRadius: 10,
                padding: 12,
                color: GC.textPrimary,
                marginBottom: 16,
                borderWidth: 1,
                borderColor: GC.border,
              }}
            />

            {/* 保存按钮 */}
            <TouchableOpacity
              onPress={handleSave}
              style={{
                backgroundColor: '#8B5CF6',
                borderRadius: 10,
                padding: 14,
                alignItems: 'center',
                marginBottom: 20,
              }}
            >
              <Text style={{ color: '#fff', fontSize: 16, fontWeight: 'bold' }}>保存配置</Text>
            </TouchableOpacity>

            {/* 测试区域 */}
            <View style={{ borderTopWidth: 1, borderTopColor: GC.border, paddingTop: 16 }}>
              <Text style={{ color: GC.textPrimary, fontSize: 14, fontWeight: 'bold', marginBottom: 12 }}>
                单Agent测试
              </Text>

              {/* Agent类型切换 */}
              <View style={{ flexDirection: 'row', marginBottom: 12 }}>
                <TouchableOpacity
                  onPress={() => { setTestType('pro'); setSelectedAgent('writer'); }}
                  style={{
                    flex: 1,
                    padding: 10,
                    borderRadius: 8,
                    backgroundColor: testType === 'pro' ? '#8B5CF6' : GC.bgCard,
                    marginRight: 8,
                    alignItems: 'center',
                  }}
                >
                  <Text style={{ color: '#fff', fontSize: 14 }}>专业Agent</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => { setTestType('reader'); setSelectedAgent('office_worker'); }}
                  style={{
                    flex: 1,
                    padding: 10,
                    borderRadius: 8,
                    backgroundColor: testType === 'reader' ? '#F59E0B' : GC.bgCard,
                    alignItems: 'center',
                  }}
                >
                  <Text style={{ color: '#fff', fontSize: 14 }}>读者Agent</Text>
                </TouchableOpacity>
              </View>

              {/* Agent选择 */}
              <Text style={{ color: GC.textSecondary, fontSize: 12, marginBottom: 6 }}>选择Agent</Text>
              <View style={{ marginBottom: 12 }}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  {allAgents.map(agent => (
                    <TouchableOpacity
                      key={agent.id}
                      onPress={() => setSelectedAgent(agent.id)}
                      style={{
                        paddingHorizontal: 12,
                        paddingVertical: 8,
                        borderRadius: 8,
                        backgroundColor: selectedAgent === agent.id ? agent.color : GC.bgCard,
                        marginRight: 8,
                      }}
                    >
                      <Text style={{ color: '#fff', fontSize: 13 }}>{agent.label}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>

              {/* System Prompt */}
              <Text style={{ color: GC.textSecondary, fontSize: 12, marginBottom: 6 }}>System Prompt（可选）</Text>
              <TextInput
                value={testSystem}
                onChangeText={setTestSystem}
                placeholder="留空使用默认提示词"
                placeholderTextColor={GC.textSecondary}
                multiline
                style={{
                  backgroundColor: GC.bgCard,
                  borderRadius: 10,
                  padding: 12,
                  color: GC.textPrimary,
                  marginBottom: 12,
                  borderWidth: 1,
                  borderColor: GC.border,
                  minHeight: 60,
                }}
              />

              {/* 测试Prompt */}
              <Text style={{ color: GC.textSecondary, fontSize: 12, marginBottom: 6 }}>测试内容</Text>
              <TextInput
                value={testPrompt}
                onChangeText={setTestPrompt}
                placeholder="输入测试提示词"
                placeholderTextColor={GC.textSecondary}
                multiline
                style={{
                  backgroundColor: GC.bgCard,
                  borderRadius: 10,
                  padding: 12,
                  color: GC.textPrimary,
                  marginBottom: 12,
                  borderWidth: 1,
                  borderColor: GC.border,
                  minHeight: 60,
                }}
              />

              {/* 测试按钮 */}
              <TouchableOpacity
                onPress={handleTest}
                disabled={testLoading}
                style={{
                  backgroundColor: testLoading ? '#6B7280' : '#10B981',
                  borderRadius: 10,
                  padding: 14,
                  alignItems: 'center',
                  marginBottom: 12,
                }}
              >
                {testLoading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={{ color: '#fff', fontSize: 16, fontWeight: 'bold' }}>
                    发送测试
                  </Text>
                )}
              </TouchableOpacity>

              {/* 测试结果 */}
              {testError ? (
                <View style={{ backgroundColor: 'rgba(239,68,68,0.1)', borderRadius: 10, padding: 12, marginBottom: 12 }}>
                  <Text style={{ color: '#EF4444', fontSize: 13 }}>{testError}</Text>
                </View>
              ) : null}

              {testResult ? (
                <View style={{ backgroundColor: GC.bgCard, borderRadius: 10, padding: 12, marginBottom: 12 }}>
                  <Text style={{ color: GC.textPrimary, fontSize: 13 }}>{testResult}</Text>
                </View>
              ) : null}
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
