import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
  Modal,
  TextInput,
  Switch,
  KeyboardAvoidingView,
  Platform,
  TouchableWithoutFeedback,
  Keyboard,
  ActivityIndicator,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Screen } from '@/components/Screen';
import { Ionicons } from '@expo/vector-icons';
import { useSafeRouter } from '@/hooks/useSafeRouter';
import { useFocusEffect } from 'expo-router';
import { GC } from '@/utils/glassColors';
import { PRESET_AGENTS, PresetAgent, AgentCategory } from '@/utils/presetAgents';

// ============== 类型 ==============
interface ApiConfig {
  id: string;
  name: string;
  apiKey: string;
  baseUrl: string;
  model: string;
}

interface AgentConfig {
  presetId: string;       // 对应 PRESET_AGENTS 的 id
  name: string;           // 可被用户修改
  prompt: string;         // 可被用户修改
  enabled: boolean;
  apiId?: string;         // 绑定的API配置ID
  order: number;          // 执行顺序
}

interface ReviewAgent {
  id: string;
  name: string;
  role: string;
  prompt: string;
  enabled: boolean;
  order: number;
  apiId?: string;
}

interface ReviewConfig {
  focusDirection: string;
  rounds: number;
  maxWords: number;
}

// ============== 子组件：API配置编辑弹窗 ==============
function ApiConfigModal({
  visible,
  data,
  onClose,
  onSave,
}: {
  visible: boolean;
  data: ApiConfig | null;
  onClose: () => void;
  onSave: (config: Omit<ApiConfig, 'id'> & { id?: string }) => void;
}) {
  const initName = data?.name || '';
  const initApiKey = data?.apiKey || '';
  const initBaseUrl = data?.baseUrl || 'https://api.deepseek.com';
  const initModel = data?.model || 'deepseek-chat';

  const [name, setName] = useState(initName);
  const [apiKey, setApiKey] = useState(initApiKey);
  const [baseUrl, setBaseUrl] = useState(initBaseUrl);
  const [model, setModel] = useState(initModel);

  const [prevDataId, setPrevDataId] = useState<string | null>(data?.id ?? null);
  if ((data?.id ?? null) !== prevDataId) {
    setPrevDataId(data?.id ?? null);
    setName(initName);
    setApiKey(initApiKey);
    setBaseUrl(initBaseUrl);
    setModel(initModel);
  }

  const handleSave = () => {
    if (!name.trim() || !apiKey.trim() || !baseUrl.trim() || !model.trim()) {
      Alert.alert('提示', '请填写所有字段');
      return;
    }
    onSave({ id: data?.id, name: name.trim(), apiKey: apiKey.trim(), baseUrl: baseUrl.trim(), model: model.trim() });
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide">
      <TouchableWithoutFeedback onPress={Keyboard.dismiss} disabled={Platform.OS === 'web'}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={m.modalContainer}>
            <View style={m.modalContent}>
              <View style={m.modalHeader}>
                <Text style={m.modalTitle}>{data ? '编辑API' : '添加API'}</Text>
                <TouchableOpacity onPress={onClose}><Ionicons name="close" size={24} color="#8888AA" /></TouchableOpacity>
              </View>
              <ScrollView style={m.modalBody}>
                <Text style={m.fieldLabel}>名称</Text>
                <TextInput style={m.fieldInput} placeholder="如：DeepSeek" placeholderTextColor="#6B6B8D" value={name} onChangeText={setName} />
                <Text style={m.fieldLabel}>API Key</Text>
                <TextInput style={m.fieldInput} placeholder="sk-xxxx" placeholderTextColor="#6B6B8D" value={apiKey} onChangeText={setApiKey} autoCapitalize="none" />
                <Text style={m.fieldLabel}>Base URL</Text>
                <TextInput style={m.fieldInput} placeholder="https://api.deepseek.com" placeholderTextColor="#6B6B8D" value={baseUrl} onChangeText={setBaseUrl} autoCapitalize="none" />
                <Text style={m.fieldLabel}>模型名称</Text>
                <TextInput style={m.fieldInput} placeholder="deepseek-chat" placeholderTextColor="#6B6B8D" value={model} onChangeText={setModel} autoCapitalize="none" />
              </ScrollView>
              <View style={m.modalFooter}>
                <TouchableOpacity style={[m.modalBtn, m.cancelBtn]} onPress={onClose}><Text style={m.cancelBtnText}>取消</Text></TouchableOpacity>
                <TouchableOpacity style={[m.modalBtn, m.submitBtn]} onPress={handleSave}><Text style={m.submitBtnText}>保存</Text></TouchableOpacity>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

// ============== 子组件：协作Agent编辑弹窗 ==============
function CollabAgentEditModal({
  visible,
  agent,
  preset,
  apiConfigs,
  onClose,
  onSave,
}: {
  visible: boolean;
  agent: AgentConfig | null;
  preset: PresetAgent | null;
  apiConfigs: ApiConfig[];
  onClose: () => void;
  onSave: (data: { name: string; prompt: string; apiId: string }) => void;
}) {
  const initName = agent?.name || preset?.name || '';
  const initPrompt = agent?.prompt || preset?.prompt || '';
  const initApiId = agent?.apiId || '';

  const [name, setName] = useState(initName);
  const [prompt, setPrompt] = useState(initPrompt);
  const [apiId, setApiId] = useState(initApiId);

  const [prevPresetId, setPrevPresetId] = useState<string | null>(preset?.id ?? null);
  if ((preset?.id ?? null) !== prevPresetId) {
    setPrevPresetId(preset?.id ?? null);
    setName(initName);
    setPrompt(initPrompt);
    setApiId(initApiId);
  }

  const handleSave = () => {
    if (!name.trim()) {
      Alert.alert('提示', '请填写Agent名称');
      return;
    }
    onSave({ name: name.trim(), prompt: prompt.trim(), apiId });
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide">
      <TouchableWithoutFeedback onPress={Keyboard.dismiss} disabled={Platform.OS === 'web'}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={m.modalContainer}>
            <View style={[m.modalContent, { maxHeight: '90%' }]}>
              <View style={m.modalHeader}>
                <Text style={m.modalTitle}>编辑 {preset?.name || 'Agent'}</Text>
                <TouchableOpacity onPress={onClose}><Ionicons name="close" size={24} color="#8888AA" /></TouchableOpacity>
              </View>
              <ScrollView style={m.modalBody}>
                <Text style={m.fieldLabel}>名称</Text>
                <TextInput style={m.fieldInput} placeholder="Agent名称" placeholderTextColor="#6B6B8D" value={name} onChangeText={setName} />

                <Text style={m.fieldLabel}>规则 Prompt</Text>
                <TextInput
                  style={[m.fieldInput, m.promptInput]}
                  placeholder="编写Agent的执行规则和prompt..."
                  placeholderTextColor="#6B6B8D"
                  value={prompt}
                  onChangeText={setPrompt}
                  multiline
                  textAlignVertical="top"
                />

                <Text style={m.fieldLabel}>绑定API</Text>
                <View style={m.pickerWrap}>
                  <ScrollView style={m.pickerScroll} nestedScrollEnabled>
                    <TouchableOpacity
                      style={[m.pickerItem, apiId === '' && m.pickerItemActive]}
                      onPress={() => setApiId('')}
                    >
                      <Text style={[m.pickerItemText, apiId === '' && m.pickerItemTextActive]}>默认API</Text>
                    </TouchableOpacity>
                    {apiConfigs.map((cfg) => (
                      <TouchableOpacity
                        key={cfg.id}
                        style={[m.pickerItem, apiId === cfg.id && m.pickerItemActive]}
                        onPress={() => setApiId(cfg.id)}
                      >
                        <Text style={[m.pickerItemText, apiId === cfg.id && m.pickerItemTextActive]}>
                          {cfg.name} ({cfg.model})
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              </ScrollView>
              <View style={m.modalFooter}>
                <TouchableOpacity style={[m.modalBtn, m.cancelBtn]} onPress={onClose}><Text style={m.cancelBtnText}>取消</Text></TouchableOpacity>
                <TouchableOpacity style={[m.modalBtn, m.submitBtn]} onPress={handleSave}><Text style={m.submitBtnText}>保存</Text></TouchableOpacity>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

// ============== 子组件：评审Agent编辑弹窗 ==============
function ReviewAgentEditModal({
  visible,
  agent,
  apiConfigs,
  onClose,
  onSave,
}: {
  visible: boolean;
  agent: ReviewAgent | null;
  apiConfigs: ApiConfig[];
  onClose: () => void;
  onSave: (data: { name: string; prompt: string; apiId: string }) => void;
}) {
  const initName = agent?.name || '';
  const initPrompt = agent?.prompt || '';
  const initApiId = agent?.apiId || '';

  const [name, setName] = useState(initName);
  const [prompt, setPrompt] = useState(initPrompt);
  const [apiId, setApiId] = useState(initApiId);

  const [prevAgentId, setPrevAgentId] = useState<string | null>(agent?.id ?? null);
  if ((agent?.id ?? null) !== prevAgentId) {
    setPrevAgentId(agent?.id ?? null);
    setName(initName);
    setPrompt(initPrompt);
    setApiId(initApiId);
  }

  const handleSave = () => {
    if (!name.trim()) {
      Alert.alert('提示', '请填写Agent名称');
      return;
    }
    onSave({ name: name.trim(), prompt: prompt.trim(), apiId });
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide">
      <TouchableWithoutFeedback onPress={Keyboard.dismiss} disabled={Platform.OS === 'web'}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={m.modalContainer}>
            <View style={[m.modalContent, { maxHeight: '90%' }]}>
              <View style={m.modalHeader}>
                <Text style={m.modalTitle}>{agent ? '编辑评审Agent' : '添加评审Agent'}</Text>
                <TouchableOpacity onPress={onClose}><Ionicons name="close" size={24} color="#8888AA" /></TouchableOpacity>
              </View>
              <ScrollView style={m.modalBody}>
                <Text style={m.fieldLabel}>名称</Text>
                <TextInput style={m.fieldInput} placeholder="Agent名称" placeholderTextColor="#6B6B8D" value={name} onChangeText={setName} />
                <Text style={m.fieldLabel}>规则 Prompt</Text>
                <TextInput
                  style={[m.fieldInput, m.promptInput]}
                  placeholder="编写评审规则..."
                  placeholderTextColor="#6B6B8D"
                  value={prompt}
                  onChangeText={setPrompt}
                  multiline
                  textAlignVertical="top"
                />
                <Text style={m.fieldLabel}>绑定API</Text>
                <View style={m.pickerWrap}>
                  <ScrollView style={m.pickerScroll} nestedScrollEnabled>
                    <TouchableOpacity style={[m.pickerItem, apiId === '' && m.pickerItemActive]} onPress={() => setApiId('')}>
                      <Text style={[m.pickerItemText, apiId === '' && m.pickerItemTextActive]}>默认API</Text>
                    </TouchableOpacity>
                    {apiConfigs.map((cfg) => (
                      <TouchableOpacity key={cfg.id} style={[m.pickerItem, apiId === cfg.id && m.pickerItemActive]} onPress={() => setApiId(cfg.id)}>
                        <Text style={[m.pickerItemText, apiId === cfg.id && m.pickerItemTextActive]}>{cfg.name} ({cfg.model})</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              </ScrollView>
              <View style={m.modalFooter}>
                <TouchableOpacity style={[m.modalBtn, m.cancelBtn]} onPress={onClose}><Text style={m.cancelBtnText}>取消</Text></TouchableOpacity>
                <TouchableOpacity style={[m.modalBtn, m.submitBtn]} onPress={handleSave}><Text style={m.submitBtnText}>保存</Text></TouchableOpacity>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

// ============== 默认评审团Agent ==============
const DEFAULT_REVIEW_AGENTS: Omit<ReviewAgent, 'id'>[] = [
  { name: '逻辑审查员', role: 'logic', prompt: '你是逻辑审查员，负责检查内容的逻辑一致性，找出前后矛盾、因果不通、设定冲突等问题。用简短直接的语言指出问题所在。', enabled: true, order: 1 },
  { name: '节奏分析师', role: 'pacing', prompt: '你是节奏分析师，负责分析叙事节奏是否合理，是否存在拖沓、跳跃、冗余等问题。给出具体的调整建议。', enabled: true, order: 2 },
  { name: '读者视角', role: 'reader', prompt: '你站在读者视角，评价这段内容的吸引力、可读性和代入感。告诉作者读者最关心的点和最可能弃读的地方。', enabled: true, order: 3 },
];

// ============== 主页面 ==============
export default function AgentConfigScreen() {
  const router = useSafeRouter();

  // Tab状态
  const [activeTab, setActiveTab] = useState<'collab' | 'review' | 'api'>('collab');

  // API配置
  const [apiConfigs, setApiConfigs] = useState<ApiConfig[]>([]);
  const [apiModalVisible, setApiModalVisible] = useState(false);
  const [editingApi, setEditingApi] = useState<ApiConfig | null>(null);

  // 协作Agent（预置Agent的用户配置）
  const [agentConfigs, setAgentConfigs] = useState<AgentConfig[]>([]);
  const [collabEditVisible, setCollabEditVisible] = useState(false);
  const [editingPreset, setEditingPreset] = useState<PresetAgent | null>(null);

  // 评审团Agent
  const [reviewAgents, setReviewAgents] = useState<ReviewAgent[]>([]);
  const [reviewModalVisible, setReviewModalVisible] = useState(false);
  const [editingReviewAgent, setEditingReviewAgent] = useState<ReviewAgent | null>(null);
  const [isAddingReviewAgent, setIsAddingReviewAgent] = useState(false);

  // 评审配置
  const [reviewConfig, setReviewConfig] = useState<ReviewConfig>({
    focusDirection: '',
    rounds: 1,
    maxWords: 80,
  });

  // 智能搭配弹窗
  const [smartMatchVisible, setSmartMatchVisible] = useState(false);
  const [smartMatchSuggestion, setSmartMatchSuggestion] = useState('');
  const [smartMatchLoading, setSmartMatchLoading] = useState(false);

  // ============== 加载数据 ==============
  const loadApiConfigs = useCallback(async () => {
    try {
      const data = await AsyncStorage.getItem('apiConfigs');
      if (data) setApiConfigs(JSON.parse(data));
    } catch (_e) {}
  }, []);

  const loadAgentConfigs = useCallback(async () => {
    try {
      const data = await AsyncStorage.getItem('agentConfigs');
      if (data) {
        setAgentConfigs(JSON.parse(data));
      } else {
        // 初始化默认配置：核心和推荐启用，可选关闭
        const defaultConfigs: AgentConfig[] = PRESET_AGENTS.map((p, i) => ({
          presetId: p.id,
          name: p.name,
          prompt: p.prompt,
          enabled: p.category === 'core' || p.category === 'recommended',
          apiId: '',
          order: i + 1,
        }));
        setAgentConfigs(defaultConfigs);
        await AsyncStorage.setItem('agentConfigs', JSON.stringify(defaultConfigs));
      }
    } catch (_e) {}
  }, []);

  const loadReviewAgents = useCallback(async () => {
    try {
      const data = await AsyncStorage.getItem('reviewTeamConfigs');
      if (data) {
        setReviewAgents(JSON.parse(data));
      } else {
        const defaultList: ReviewAgent[] = DEFAULT_REVIEW_AGENTS.map((a, i) => ({
          ...a,
          id: new Date().getTime().toString() + '_r' + i,
        }));
        setReviewAgents(defaultList);
        await AsyncStorage.setItem('reviewTeamConfigs', JSON.stringify(defaultList));
      }
    } catch (_e) {}
  }, []);

  const loadReviewConfig = useCallback(async () => {
    try {
      const data = await AsyncStorage.getItem('reviewConfig');
      if (data) setReviewConfig(JSON.parse(data));
    } catch (_e) {}
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadApiConfigs();
      loadAgentConfigs();
      loadReviewAgents();
      loadReviewConfig();
    }, [loadApiConfigs, loadAgentConfigs, loadReviewAgents, loadReviewConfig])
  );

  // ============== 保存函数 ==============
  const saveApiConfigs = async (configs: ApiConfig[]) => {
    setApiConfigs(configs);
    await AsyncStorage.setItem('apiConfigs', JSON.stringify(configs));
  };

  const saveAgentConfigs = async (list: AgentConfig[]) => {
    setAgentConfigs(list);
    await AsyncStorage.setItem('agentConfigs', JSON.stringify(list));
  };

  const saveReviewAgents = async (list: ReviewAgent[]) => {
    setReviewAgents(list);
    await AsyncStorage.setItem('reviewTeamConfigs', JSON.stringify(list));
  };

  const saveReviewConfig = async (config: ReviewConfig) => {
    setReviewConfig(config);
    await AsyncStorage.setItem('reviewConfig', JSON.stringify(config));
  };

  // ============== 协作Agent操作 ==============
  const handleEditCollabAgent = (preset: PresetAgent) => {
    setEditingPreset(preset);
    setCollabEditVisible(true);
  };

  const handleSaveCollabAgent = (data: { name: string; prompt: string; apiId: string }) => {
    if (!editingPreset) return;
    const next = agentConfigs.map((a) =>
      a.presetId === editingPreset.id ? { ...a, ...data } : a
    );
    saveAgentConfigs(next);
  };

  const handleToggleCollabAgent = (presetId: string) => {
    const preset = PRESET_AGENTS.find((p) => p.id === presetId);
    if (preset?.category === 'core') return; // 核心Agent不可禁用
    const next = agentConfigs.map((a) =>
      a.presetId === presetId ? { ...a, enabled: !a.enabled } : a
    );
    saveAgentConfigs(next);
  };

  const handleResetAgentConfigs = () => {
    Alert.alert('确认', '确定重置所有协作Agent为默认配置吗？', [
      { text: '取消', style: 'cancel' },
      {
        text: '重置',
        style: 'destructive',
        onPress: () => {
          const defaultConfigs: AgentConfig[] = PRESET_AGENTS.map((p, i) => ({
            presetId: p.id,
            name: p.name,
            prompt: p.prompt,
            enabled: p.category === 'core' || p.category === 'recommended',
            apiId: '',
            order: i + 1,
          }));
          saveAgentConfigs(defaultConfigs);
        },
      },
    ]);
  };

  // ============== 智能搭配 ==============
  const handleSmartMatch = async () => {
    setSmartMatchLoading(true);
    setSmartMatchVisible(true);

    try {
      // 读取第一个API配置
      const firstApi = apiConfigs[0];
      if (!firstApi) {
        setSmartMatchSuggestion('请先配置至少一个API，才能使用智能搭配功能。');
        setSmartMatchLoading(false);
        return;
      }

      const baseEndpoint = firstApi.baseUrl.endsWith('/v1') ? firstApi.baseUrl : `${firstApi.baseUrl}/v1`;
      const res = await fetch(`${baseEndpoint}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${firstApi.apiKey}`,
        },
        body: JSON.stringify({
          model: firstApi.model,
          messages: [
            { role: 'system', content: '你是小说写作AI助手，负责推荐最佳Agent协作方案。' },
            { role: 'user', content: `我正在写一部小说，有以下可用Agent：\n${PRESET_AGENTS.map((p) => `- ${p.name}(${p.id}): ${p.description}`).join('\n')}\n\n请根据小说创作的最佳实践，推荐哪些Agent应该启用、哪些可以关闭。格式要求：每行一个Agent，格式为"启用/关闭 Agent名: 理由"。限200字以内。` },
          ],
          max_tokens: 500,
        }),
      });

      if (!res.ok) {
        setSmartMatchSuggestion('API调用失败，请检查API配置。');
        setSmartMatchLoading(false);
        return;
      }

      const json = await res.json();
      const suggestion = json.choices?.[0]?.message?.content || '无法获取建议';
      setSmartMatchSuggestion(suggestion);
    } catch (_e) {
      setSmartMatchSuggestion('网络错误，请检查API配置。');
    }
    setSmartMatchLoading(false);
  };

  const handleApplySmartMatch = () => {
    // 简单解析：如果建议中包含"启用"某Agent名，则启用；包含"关闭"则关闭
    const next = agentConfigs.map((a) => {
      const preset = PRESET_AGENTS.find((p) => p.id === a.presetId);
      if (!preset) return a;
      if (preset.category === 'core') return { ...a, enabled: true }; // 核心始终启用
      const nameInSuggestion = smartMatchSuggestion.includes(preset.name);
      const shouldEnable = nameInSuggestion && (
        smartMatchSuggestion.includes(`启用${preset.name}`) ||
        smartMatchSuggestion.includes(`启用 ${preset.name}`) ||
        smartMatchSuggestion.includes(`推荐${preset.name}`) ||
        smartMatchSuggestion.includes(`建议${preset.name}`)
      );
      const shouldDisable = nameInSuggestion && (
        smartMatchSuggestion.includes(`关闭${preset.name}`) ||
        smartMatchSuggestion.includes(`关闭 ${preset.name}`) ||
        smartMatchSuggestion.includes(`不需要${preset.name}`)
      );
      if (shouldDisable) return { ...a, enabled: false };
      if (shouldEnable) return { ...a, enabled: true };
      return a;
    });
    saveAgentConfigs(next);
    setSmartMatchVisible(false);
    Alert.alert('成功', '已根据AI建议调整Agent配置');
  };

  // ============== 评审团Agent操作 ==============
  const handleAddReviewAgent = () => {
    setIsAddingReviewAgent(true);
    setEditingReviewAgent(null);
    setReviewModalVisible(true);
  };

  const handleEditReviewAgent = (agent: ReviewAgent) => {
    setIsAddingReviewAgent(false);
    setEditingReviewAgent(agent);
    setReviewModalVisible(true);
  };

  const handleSaveReviewAgent = (data: { name: string; prompt: string; apiId: string }) => {
    if (editingReviewAgent && !isAddingReviewAgent) {
      const next = reviewAgents.map((a) => a.id === editingReviewAgent.id ? { ...a, ...data } : a);
      saveReviewAgents(next);
    } else {
      const newAgent: ReviewAgent = {
        id: new Date().getTime().toString() + '_rnew',
        name: data.name,
        role: 'custom',
        prompt: data.prompt,
        apiId: data.apiId,
        enabled: true,
        order: reviewAgents.length + 1,
      };
      saveReviewAgents([...reviewAgents, newAgent]);
    }
  };

  const handleDeleteReviewAgent = (agent: ReviewAgent) => {
    Alert.alert('确认', `确定删除评审Agent "${agent.name}" 吗？`, [
      { text: '取消', style: 'cancel' },
      { text: '删除', style: 'destructive', onPress: () => saveReviewAgents(reviewAgents.filter((a) => a.id !== agent.id)) },
    ]);
  };

  const handleToggleReviewAgent = (agent: ReviewAgent) => {
    const next = reviewAgents.map((a) => a.id === agent.id ? { ...a, enabled: !a.enabled } : a);
    saveReviewAgents(next);
  };

  const handleResetReviewAgents = () => {
    Alert.alert('确认', '确定重置评审团Agent为默认吗？', [
      { text: '取消', style: 'cancel' },
      {
        text: '重置',
        style: 'destructive',
        onPress: () => {
          const defaultList: ReviewAgent[] = DEFAULT_REVIEW_AGENTS.map((a, i) => ({
            ...a,
            id: new Date().getTime().toString() + '_r' + i,
          }));
          saveReviewAgents(defaultList);
        },
      },
    ]);
  };

  // ============== API操作 ==============
  const handleAddApi = () => { setEditingApi(null); setApiModalVisible(true); };
  const handleEditApi = (cfg: ApiConfig) => { setEditingApi(cfg); setApiModalVisible(true); };
  const handleDeleteApi = (cfg: ApiConfig) => {
    Alert.alert('确认', `确定删除API "${cfg.name}" 吗？`, [
      { text: '取消', style: 'cancel' },
      { text: '删除', style: 'destructive', onPress: () => saveApiConfigs(apiConfigs.filter((c) => c.id !== cfg.id)) },
    ]);
  };
  const handleSaveApi = (data: Omit<ApiConfig, 'id'> & { id?: string }) => {
    if (data.id) {
      saveApiConfigs(apiConfigs.map((c) => (c.id === data.id ? { ...c, ...data } : c)));
    } else {
      saveApiConfigs([...apiConfigs, { ...data, id: new Date().getTime().toString() }]);
    }
  };

  const testApiConnection = async (cfg: ApiConfig) => {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);
      const baseEndpoint = cfg.baseUrl.endsWith('/v1') ? cfg.baseUrl : `${cfg.baseUrl}/v1`;
      const res = await fetch(`${baseEndpoint}/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${cfg.apiKey}` },
        body: JSON.stringify({ model: cfg.model, messages: [{ role: 'user', content: 'hi' }], max_tokens: 5 }),
        signal: controller.signal,
      });
      clearTimeout(timeout);
      if (res.ok) {
        Alert.alert('成功', `${cfg.name} 连接正常`);
      } else {
        Alert.alert('失败', `${cfg.name}: HTTP ${res.status}`);
      }
    } catch (e: any) {
      Alert.alert('失败', `${cfg.name}: ${e.message || '网络错误'}`);
    }
  };

  // ============== 工具函数 ==============
  const getApiName = (apiId?: string) => {
    if (!apiId) return '默认';
    const cfg = apiConfigs.find((c) => c.id === apiId);
    return cfg ? cfg.name : '默认';
  };

  const getAgentConfig = (presetId: string): AgentConfig | undefined => {
    return agentConfigs.find((a) => a.presetId === presetId);
  };

  // 按分类分组
  const coreAgents = PRESET_AGENTS.filter((p) => p.category === 'core');
  const recommendedAgents = PRESET_AGENTS.filter((p) => p.category === 'recommended');
  const optionalAgents = PRESET_AGENTS.filter((p) => p.category === 'optional');

  // ============== 渲染Agent卡片 ==============
  const renderAgentCard = (preset: PresetAgent) => {
    const config = getAgentConfig(preset.id);
    if (!config) return null;
    const isCore = preset.category === 'core';

    return (
      <View key={preset.id} style={[s.agentCard, !config.enabled && s.agentCardDisabled]}>
        <TouchableOpacity style={s.agentInfo} onPress={() => handleEditCollabAgent(preset)} activeOpacity={0.7}>
          <View style={s.agentNameRow}>
            <Text style={s.agentIcon}>{preset.icon}</Text>
            <View style={s.agentNameCol}>
              <Text style={[s.agentName, !config.enabled && s.textDisabled]}>{config.name}</Text>
              <Text style={s.agentDesc} numberOfLines={2}>{preset.description}</Text>
              <Text style={s.agentApi}>API: {getApiName(config.apiId)}</Text>
            </View>
          </View>
        </TouchableOpacity>
        <View style={s.agentRightActions}>
          <Switch
            value={config.enabled}
            onValueChange={() => handleToggleCollabAgent(preset.id)}
            trackColor={{ false: GC.border, true: isCore ? GC.textMuted : GC.primary }}
            thumbColor={config.enabled ? GC.textPrimary : GC.textMuted}
            disabled={isCore}
          />
        </View>
      </View>
    );
  };

  return (
    <Screen>
      <View style={s.container}>
        {/* Header */}
        <View style={s.header}>
          <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={s.headerTitle}>Agent配置</Text>
          <View style={{ width: 40 }} />
        </View>

        {/* Tab切换 */}
        <View style={s.tabBar}>
          {([
            { key: 'collab' as const, label: '协作Agent' },
            { key: 'review' as const, label: '评审团' },
            { key: 'api' as const, label: 'API配置' },
          ]).map((tab) => (
            <TouchableOpacity
              key={tab.key}
              style={[s.tabItem, activeTab === tab.key && s.tabItemActive]}
              onPress={() => setActiveTab(tab.key)}
            >
              <Text style={[s.tabItemText, activeTab === tab.key && s.tabItemTextActive]}>{tab.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <ScrollView style={s.scrollView} contentContainerStyle={s.scrollContent}>

          {/* ====== 协作Agent Tab ====== */}
          {activeTab === 'collab' && (
            <>
              {/* 智能搭配按钮 */}
              <TouchableOpacity style={s.smartMatchBtn} onPress={handleSmartMatch}>
                <Ionicons name="sparkles" size={18} color="#7C5CFF" />
                <Text style={s.smartMatchBtnText}>智能搭配</Text>
              </TouchableOpacity>

              {/* 核心Agent */}
              <View style={s.categoryHeader}>
                <Text style={s.categoryTitle}>核心（不可禁用）</Text>
              </View>
              {coreAgents.map(renderAgentCard)}

              {/* 推荐Agent */}
              <View style={s.categoryHeader}>
                <Text style={s.categoryTitle}>推荐（默认启用）</Text>
              </View>
              {recommendedAgents.map(renderAgentCard)}

              {/* 可选Agent */}
              <View style={s.categoryHeader}>
                <Text style={s.categoryTitle}>可选（默认关闭）</Text>
              </View>
              {optionalAgents.map(renderAgentCard)}

              {/* 重置按钮 */}
              <TouchableOpacity style={s.resetBtn} onPress={handleResetAgentConfigs}>
                <Text style={s.resetBtnText}>重置为默认</Text>
              </TouchableOpacity>
            </>
          )}

          {/* ====== 评审团 Tab ====== */}
          {activeTab === 'review' && (
            <>
              <View style={s.sectionHeader}>
                <Text style={s.sectionTitle}>评审团Agent</Text>
              </View>
              <Text style={s.sectionDesc}>只有启用的评审Agent会在AI评审时参与讨论</Text>

              {reviewAgents.map((agent) => (
                <View key={agent.id} style={[s.agentCard, !agent.enabled && s.agentCardDisabled]}>
                  <TouchableOpacity style={s.agentInfo} onPress={() => handleEditReviewAgent(agent)} activeOpacity={0.7}>
                    <View style={s.agentNameCol}>
                      <Text style={[s.agentName, !agent.enabled && s.textDisabled]}>{agent.name}</Text>
                      <Text style={s.agentApi}>API: {getApiName(agent.apiId)}</Text>
                    </View>
                  </TouchableOpacity>
                  <View style={s.agentRightActions}>
                    <Switch
                      value={agent.enabled}
                      onValueChange={() => handleToggleReviewAgent(agent)}
                      trackColor={{ false: GC.border, true: GC.primary }}
                      thumbColor={agent.enabled ? GC.textPrimary : GC.textMuted}
                    />
                    <TouchableOpacity onPress={() => handleDeleteReviewAgent(agent)} style={s.iconBtn}>
                      <Ionicons name="trash-outline" size={18} color="#6B6B8D" />
                    </TouchableOpacity>
                  </View>
                </View>
              ))}

              <TouchableOpacity style={s.addBtn} onPress={handleAddReviewAgent}>
                <Ionicons name="add" size={20} color="#fff" />
                <Text style={s.addBtnText}>添加评审Agent</Text>
              </TouchableOpacity>

              <TouchableOpacity style={s.resetBtn} onPress={handleResetReviewAgents}>
                <Text style={s.resetBtnText}>重置为默认</Text>
              </TouchableOpacity>

              {/* 评审参数 */}
              <View style={s.divider} />
              <Text style={s.sectionTitle}>评审参数</Text>

              <Text style={s.fieldTitle}>评审重点</Text>
              <TextInput
                style={s.reviewInput}
                placeholder="如：重点检查前后矛盾和节奏拖沓..."
                placeholderTextColor="#6B6B8D"
                value={reviewConfig.focusDirection}
                onChangeText={(text) => saveReviewConfig({ ...reviewConfig, focusDirection: text })}
                multiline
              />

              <Text style={s.fieldTitle}>评审轮数</Text>
              <View style={s.roundsRow}>
                {[1, 2, 3].map((r) => (
                  <TouchableOpacity
                    key={r}
                    style={[s.roundBtn, reviewConfig.rounds === r && s.roundBtnActive]}
                    onPress={() => saveReviewConfig({ ...reviewConfig, rounds: r })}
                  >
                    <Text style={[s.roundBtnText, reviewConfig.rounds === r && s.roundBtnTextActive]}>{r}轮</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={s.fieldTitle}>每条回复字数上限</Text>
              <View style={s.roundsRow}>
                {[50, 80, 120, 150].map((w) => (
                  <TouchableOpacity
                    key={w}
                    style={[s.roundBtn, reviewConfig.maxWords === w && s.roundBtnActive]}
                    onPress={() => saveReviewConfig({ ...reviewConfig, maxWords: w })}
                  >
                    <Text style={[s.roundBtnText, reviewConfig.maxWords === w && s.roundBtnTextActive]}>{w}字</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </>
          )}

          {/* ====== API配置 Tab ====== */}
          {activeTab === 'api' && (
            <>
              <View style={s.sectionHeader}>
                <Text style={s.sectionTitle}>API配置</Text>
              </View>

              {apiConfigs.map((cfg) => (
                <View key={cfg.id} style={s.apiCard}>
                  <View style={s.apiInfo}>
                    <Text style={s.apiName}>{cfg.name}</Text>
                    <Text style={s.apiDetail}>{cfg.model} · {cfg.baseUrl.replace('https://', '').replace('http://', '').split('/')[0]}</Text>
                  </View>
                  <View style={s.apiActions}>
                    <TouchableOpacity onPress={() => testApiConnection(cfg)} style={s.iconBtn}>
                      <Ionicons name="flash-outline" size={18} color="#8888AA" />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => handleEditApi(cfg)} style={s.iconBtn}>
                      <Ionicons name="pencil" size={18} color="#8888AA" />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => handleDeleteApi(cfg)} style={s.iconBtn}>
                      <Ionicons name="trash-outline" size={18} color="#6B6B8D" />
                    </TouchableOpacity>
                  </View>
                </View>
              ))}

              <TouchableOpacity style={s.addBtn} onPress={handleAddApi}>
                <Ionicons name="add" size={20} color="#fff" />
                <Text style={s.addBtnText}>添加API</Text>
              </TouchableOpacity>
            </>
          )}

        </ScrollView>

        {/* 弹窗 */}
        <ApiConfigModal
          visible={apiModalVisible}
          data={editingApi}
          onClose={() => setApiModalVisible(false)}
          onSave={handleSaveApi}
        />
        <CollabAgentEditModal
          visible={collabEditVisible}
          agent={editingPreset ? getAgentConfig(editingPreset.id) || null : null}
          preset={editingPreset}
          apiConfigs={apiConfigs}
          onClose={() => setCollabEditVisible(false)}
          onSave={handleSaveCollabAgent}
        />
        <ReviewAgentEditModal
          visible={reviewModalVisible}
          agent={editingReviewAgent}
          apiConfigs={apiConfigs}
          onClose={() => setReviewModalVisible(false)}
          onSave={handleSaveReviewAgent}
        />

        {/* 智能搭配弹窗 */}
        <Modal visible={smartMatchVisible} transparent animationType="slide">
          <View style={m.modalContainer}>
            <View style={[m.modalContent, { maxHeight: '80%' }]}>
              <View style={m.modalHeader}>
                <Text style={m.modalTitle}>智能搭配</Text>
                <TouchableOpacity onPress={() => setSmartMatchVisible(false)}><Ionicons name="close" size={24} color="#8888AA" /></TouchableOpacity>
              </View>
              <ScrollView style={m.modalBody}>
                {smartMatchLoading ? (
                  <View style={{ alignItems: 'center', paddingVertical: 40 }}>
                    <ActivityIndicator size="large" color="#7C5CFF" />
                    <Text style={{ color: GC.textSecondary, marginTop: 12 }}>AI正在分析最佳搭配方案...</Text>
                  </View>
                ) : (
                  <Text style={{ color: GC.textTertiary, fontSize: 14, lineHeight: 22 }}>{smartMatchSuggestion}</Text>
                )}
              </ScrollView>
              {!smartMatchLoading && smartMatchSuggestion && !smartMatchSuggestion.includes('失败') && !smartMatchSuggestion.includes('错误') && (
                <View style={m.modalFooter}>
                  <TouchableOpacity style={[m.modalBtn, m.cancelBtn]} onPress={() => setSmartMatchVisible(false)}>
                    <Text style={m.cancelBtnText}>取消</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[m.modalBtn, m.submitBtn]} onPress={handleApplySmartMatch}>
                    <Text style={m.submitBtnText}>采用此方案</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </View>
        </Modal>
      </View>
    </Screen>
  );
}

// ============== 弹窗样式 ==============
const m = StyleSheet.create({
  modalContainer: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.6)' },
  modalContent: { backgroundColor: GC.bgElevated, borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '85%', borderWidth: 1, borderColor: GC.border },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: GC.border },
  modalTitle: { fontSize: 18, fontWeight: 'bold', color: GC.textPrimary },
  modalBody: { padding: 20 },
  modalFooter: { flexDirection: 'row', gap: 12, padding: 20, borderTopWidth: 1, borderTopColor: GC.border },
  modalBtn: { flex: 1, paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
  cancelBtn: { backgroundColor: GC.border },
  cancelBtnText: { color: GC.textSecondary, fontSize: 16, fontWeight: '600' },
  submitBtn: { backgroundColor: GC.primary },
  submitBtnText: { color: GC.textPrimary, fontSize: 16, fontWeight: '600' },
  fieldLabel: { color: GC.textSecondary, fontSize: 13, fontWeight: '600', marginBottom: 6, marginTop: 12 },
  fieldInput: { backgroundColor: GC.inputBg, borderRadius: 10, padding: 14, color: GC.textPrimary, fontSize: 15, borderWidth: 1, borderColor: GC.border },
  promptInput: { minHeight: 120 },
  pickerWrap: { backgroundColor: GC.inputBg, borderRadius: 10, borderWidth: 1, borderColor: GC.border, maxHeight: 150 },
  pickerScroll: { padding: 8 },
  pickerItem: { paddingVertical: 10, paddingHorizontal: 14, borderRadius: 8 },
  pickerItemActive: { backgroundColor: GC.primary },
  pickerItemText: { color: GC.textSecondary, fontSize: 14 },
  pickerItemTextActive: { color: GC.textPrimary, fontWeight: '600' },
});

// ============== 页面样式 ==============
const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: GC.bgBase },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 60,
    paddingBottom: 16,
  },
  backBtn: { padding: 8 },
  headerTitle: { fontSize: 22, fontWeight: 'bold', color: GC.textPrimary },

  tabBar: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginBottom: 8,
    backgroundColor: GC.bgElevated,
    borderRadius: 12,
    padding: 4,
    borderWidth: 1,
    borderColor: GC.border,
  },
  tabItem: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 10 },
  tabItemActive: { backgroundColor: GC.primary },
  tabItemText: { color: GC.textSecondary, fontSize: 14, fontWeight: '600' },
  tabItemTextActive: { color: GC.textPrimary },

  scrollView: { flex: 1 },
  scrollContent: { padding: 20, paddingBottom: 100 },

  // 智能搭配
  smartMatchBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: GC.bgElevated,
    borderRadius: 12,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: '#7C5CFF33',
    marginBottom: 20,
  },
  smartMatchBtnText: { color: GC.primary, fontSize: 15, fontWeight: '600' },

  // 分类标题
  categoryHeader: { marginTop: 16, marginBottom: 8, paddingLeft: 4 },
  categoryTitle: { color: GC.primary, fontSize: 13, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1.5 },

  // Agent卡片
  agentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: GC.bgElevated,
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: GC.border,
  },
  agentCardDisabled: { opacity: 0.5 },
  agentInfo: { flex: 1 },
  agentNameRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  agentIcon: { fontSize: 20 },
  agentNameCol: { flex: 1 },
  agentName: { color: GC.textPrimary, fontSize: 15, fontWeight: '600' },
  agentDesc: { color: GC.textSecondary, fontSize: 12, marginTop: 2, lineHeight: 16 },
  agentApi: { color: GC.textMuted, fontSize: 11, marginTop: 4 },
  textDisabled: { color: GC.textMuted },
  agentRightActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },

  // 评审团
  sectionHeader: { marginTop: 16 },
  sectionTitle: { color: GC.textSecondary, fontSize: 13, fontWeight: '600', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 1 },
  sectionDesc: { color: GC.textMuted, fontSize: 12, marginBottom: 12 },

  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: GC.primary,
    borderRadius: 12,
    paddingVertical: 14,
    marginTop: 12,
  },
  addBtnText: { color: GC.textPrimary, fontSize: 15, fontWeight: '600' },

  resetBtn: { marginTop: 16, alignItems: 'center' },
  resetBtnText: { color: GC.textMuted, fontSize: 13 },

  iconBtn: { padding: 6 },

  // 评审参数
  divider: { height: 1, backgroundColor: GC.inputBg, marginTop: 24, marginBottom: 8 },
  fieldTitle: { color: GC.textSecondary, fontSize: 13, fontWeight: '600', marginBottom: 8, marginTop: 16 },
  reviewInput: {
    backgroundColor: GC.bgElevated,
    borderRadius: 10,
    padding: 14,
    color: GC.textPrimary,
    fontSize: 14,
    borderWidth: 1,
    borderColor: GC.border,
    minHeight: 60,
    textAlignVertical: 'top',
  },
  roundsRow: { flexDirection: 'row', gap: 10 },
  roundBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 10,
    backgroundColor: GC.bgElevated,
    borderWidth: 1,
    borderColor: GC.border,
  },
  roundBtnActive: { backgroundColor: GC.primary, borderColor: GC.primary },
  roundBtnText: { color: GC.textSecondary, fontSize: 14, fontWeight: '600' },
  roundBtnTextActive: { color: GC.textPrimary },

  // API卡片
  apiCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: GC.bgElevated,
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: GC.border,
  },
  apiInfo: { flex: 1 },
  apiName: { color: GC.textPrimary, fontSize: 16, fontWeight: '500' },
  apiDetail: { color: GC.textSecondary, fontSize: 12, marginTop: 2 },
  apiActions: { flexDirection: 'row', gap: 8 },
});
