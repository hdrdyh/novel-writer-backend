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
  FlatList,
  KeyboardAvoidingView,
  Platform,
  TouchableWithoutFeedback,
  Keyboard,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Screen } from '@/components/Screen';
import { Ionicons } from '@expo/vector-icons';
import { useSafeRouter } from '@/hooks/useSafeRouter';
import { useFocusEffect } from 'expo-router';

const API_BASE = process.env.EXPO_PUBLIC_BACKEND_BASE_URL;

// ============== 类型 ==============
interface ApiConfig {
  id: string;
  name: string;
  apiKey: string;
  baseUrl: string;
  model: string;
}

interface Agent {
  id: string;
  name: string;
  role: string;
  prompt: string;
  enabled: boolean;
  order: number;
  apiId?: string;
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

  // 当data变化时重置（用key挂载更好，但这里兼容处理）
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
                <TouchableOpacity onPress={onClose}><Ionicons name="close" size={24} color="#888" /></TouchableOpacity>
              </View>
              <ScrollView style={m.modalBody}>
                <Text style={m.fieldLabel}>名称</Text>
                <TextInput style={m.fieldInput} placeholder="如：DeepSeek" placeholderTextColor="#555" value={name} onChangeText={setName} />

                <Text style={m.fieldLabel}>API Key</Text>
                <TextInput style={m.fieldInput} placeholder="sk-xxxx" placeholderTextColor="#555" value={apiKey} onChangeText={setApiKey} autoCapitalize="none" />

                <Text style={m.fieldLabel}>Base URL</Text>
                <TextInput style={m.fieldInput} placeholder="https://api.deepseek.com" placeholderTextColor="#555" value={baseUrl} onChangeText={setBaseUrl} autoCapitalize="none" />

                <Text style={m.fieldLabel}>模型名称</Text>
                <TextInput style={m.fieldInput} placeholder="deepseek-chat" placeholderTextColor="#555" value={model} onChangeText={setModel} autoCapitalize="none" />
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

// ============== 子组件：Agent编辑弹窗 ==============
function AgentEditModal({
  visible,
  agent,
  apiConfigs,
  onClose,
  onSave,
}: {
  visible: boolean;
  agent: Agent | null;
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
                <Text style={m.modalTitle}>{agent ? '编辑Agent' : '添加Agent'}</Text>
                <TouchableOpacity onPress={onClose}><Ionicons name="close" size={24} color="#888" /></TouchableOpacity>
              </View>
              <ScrollView style={m.modalBody}>
                {/* 1. 名称 */}
                <Text style={m.sectionNum}>① 名称</Text>
                <TextInput
                  style={m.fieldInput}
                  placeholder="给Agent取个名字"
                  placeholderTextColor="#555"
                  value={name}
                  onChangeText={setName}
                />

                {/* 2. 规则编辑框 */}
                <Text style={m.sectionNum}>② 规则</Text>
                <TextInput
                  style={[m.fieldInput, m.promptInput]}
                  placeholder="编写Agent的执行规则和prompt..."
                  placeholderTextColor="#555"
                  value={prompt}
                  onChangeText={setPrompt}
                  multiline
                  textAlignVertical="top"
                />

                {/* 3. API绑定 */}
                <Text style={m.sectionNum}>③ 绑定API</Text>
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

// ============== 主页面 ==============
export default function AgentConfigScreen() {
  const router = useSafeRouter();

  // API配置（本地存储）
  const [apiConfigs, setApiConfigs] = useState<ApiConfig[]>([]);
  const [apiModalVisible, setApiModalVisible] = useState(false);
  const [editingApi, setEditingApi] = useState<ApiConfig | null>(null);

  // Agent列表（后端）
  const [agents, setAgents] = useState<Agent[]>([]);
  const [agentModalVisible, setAgentModalVisible] = useState(false);
  const [editingAgent, setEditingAgent] = useState<Agent | null>(null);
  const [isAddingAgent, setIsAddingAgent] = useState(false);

  // 加载API配置
  const loadApiConfigs = useCallback(async () => {
    try {
      const data = await AsyncStorage.getItem('apiConfigs');
      if (data) setApiConfigs(JSON.parse(data));
    } catch (e) {}
  }, []);

  // 加载Agent列表
  const loadAgents = useCallback(async () => {
    try {
      /**
       * 服务端文件：server/src/index.ts
       * 接口：GET /api/v1/agents
       */
      const res = await fetch(`${API_BASE}/api/v1/agents`);
      const data = await res.json();
      if (data.agents) {
        const sorted = [...data.agents].sort((a: Agent, b: Agent) => a.order - b.order);
        setAgents(sorted);
      }
    } catch (e) {}
  }, []);

  // 评审配置
  const [reviewConfig, setReviewConfig] = useState({
    selectedAgents: [] as string[],
    focusDirection: '',
    rounds: 1,
    maxWords: 80,
  });

  // 加载评审配置
  const loadReviewConfig = useCallback(async () => {
    try {
      const data = await AsyncStorage.getItem('reviewConfig');
      if (data) setReviewConfig(JSON.parse(data));
    } catch (e) {}
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadApiConfigs();
      loadAgents();
      loadReviewConfig();
    }, [loadApiConfigs, loadAgents, loadReviewConfig])
  );

  // 保存API配置到本地
  const saveApiConfigs = async (configs: ApiConfig[]) => {
    setApiConfigs(configs);
    await AsyncStorage.setItem('apiConfigs', JSON.stringify(configs));
  };

  // ============== API配置操作 ==============
  const handleAddApi = () => {
    setEditingApi(null);
    setApiModalVisible(true);
  };

  const handleEditApi = (cfg: ApiConfig) => {
    setEditingApi(cfg);
    setApiModalVisible(true);
  };

  const handleDeleteApi = (cfg: ApiConfig) => {
    Alert.alert('确认', `确定删除API "${cfg.name}" 吗？`, [
      { text: '取消', style: 'cancel' },
      {
        text: '删除',
        style: 'destructive',
        onPress: () => {
          const next = apiConfigs.filter((c) => c.id !== cfg.id);
          saveApiConfigs(next);
        },
      },
    ]);
  };

  const handleSaveApi = (data: Omit<ApiConfig, 'id'> & { id?: string }) => {
    if (data.id) {
      // 编辑
      const next = apiConfigs.map((c) => (c.id === data.id ? { ...c, ...data } : c));
      saveApiConfigs(next);
    } else {
      // 新增
      const newCfg: ApiConfig = { ...data, id: new Date().getTime().toString() };
      saveApiConfigs([...apiConfigs, newCfg]);
    }
  };

  // ============== Agent操作 ==============
  const handleAddAgent = () => {
    setIsAddingAgent(true);
    setEditingAgent(null);
    setAgentModalVisible(true);
  };

  const handleEditAgent = (agent: Agent) => {
    setIsAddingAgent(false);
    setEditingAgent(agent);
    setAgentModalVisible(true);
  };

  const handleSaveAgent = async (data: { name: string; prompt: string; apiId: string }) => {
    if (editingAgent && !isAddingAgent) {
      // 编辑已有Agent
      /**
       * 服务端文件：server/src/index.ts
       * 接口：PUT /api/v1/agents/:id
       * Body参数：name?: string, role?: string, prompt?: string, enabled?: boolean, order?: number, apiId?: string
       */
      try {
        await fetch(`${API_BASE}/api/v1/agents/${editingAgent.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        });
        loadAgents();
      } catch (e) {
        Alert.alert('错误', '保存失败');
      }
    } else {
      // 新增Agent
      /**
       * 服务端文件：server/src/index.ts
       * 接口：POST /api/v1/agents
       * Body参数：name: string, role: string, prompt: string, apiId?: string
       */
      try {
        await fetch(`${API_BASE}/api/v1/agents`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: data.name,
            role: 'custom',
            prompt: data.prompt,
            apiId: data.apiId,
          }),
        });
        loadAgents();
      } catch (e) {
        Alert.alert('错误', '添加失败');
      }
    }
  };

  const handleDeleteAgent = (agent: Agent) => {
    Alert.alert('确认', `确定删除Agent "${agent.name}" 吗？`, [
      { text: '取消', style: 'cancel' },
      {
        text: '删除',
        style: 'destructive',
        onPress: async () => {
          /**
           * 服务端文件：server/src/index.ts
           * 接口：DELETE /api/v1/agents/:id
           */
          try {
            await fetch(`${API_BASE}/api/v1/agents/${agent.id}`, { method: 'DELETE' });
            loadAgents();
          } catch (e) {}
        },
      },
    ]);
  };

  const handleToggleAgent = async (agent: Agent) => {
    /**
     * 服务端文件：server/src/index.ts
     * 接口：PUT /api/v1/agents/:id
     * Body参数：enabled: boolean
     */
    try {
      await fetch(`${API_BASE}/api/v1/agents/${agent.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: !agent.enabled }),
      });
      loadAgents();
    } catch (e) {}
  };

  // 上下移动顺序
  const handleMoveUp = async (index: number) => {
    if (index === 0) return;
    const newAgents = [...agents];
    const temp = newAgents[index];
    newAgents[index] = newAgents[index - 1];
    newAgents[index - 1] = temp;
    // 更新order
    const reorderData = newAgents.map((a, i) => ({ id: a.id, order: i + 1 }));
    setAgents(newAgents);
    /**
     * 服务端文件：server/src/index.ts
     * 接口：PUT /api/v1/agents/reorder
     * Body参数：items: Array<{id: string, order: number}>
     */
    try {
      await fetch(`${API_BASE}/api/v1/agents/reorder`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: reorderData }),
      });
    } catch (e) {}
  };

  const handleMoveDown = async (index: number) => {
    if (index === agents.length - 1) return;
    const newAgents = [...agents];
    const temp = newAgents[index];
    newAgents[index] = newAgents[index + 1];
    newAgents[index + 1] = temp;
    const reorderData = newAgents.map((a, i) => ({ id: a.id, order: i + 1 }));
    setAgents(newAgents);
    try {
      await fetch(`${API_BASE}/api/v1/agents/reorder`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: reorderData }),
      });
    } catch (e) {}
  };

  // 保存评审配置
  const saveReviewConfig = async (config: typeof reviewConfig) => {
    setReviewConfig(config);
    await AsyncStorage.setItem('reviewConfig', JSON.stringify(config));
  };

  // 获取绑定的API名称
  const getApiName = (apiId?: string) => {
    if (!apiId) return '默认';
    const cfg = apiConfigs.find((c) => c.id === apiId);
    return cfg ? cfg.name : '默认';
  };

  // 切换评审Agent勾选
  const toggleReviewAgent = (agentId: string) => {
    const next = reviewConfig.selectedAgents.includes(agentId)
      ? reviewConfig.selectedAgents.filter((id) => id !== agentId)
      : [...reviewConfig.selectedAgents, agentId];
    saveReviewConfig({ ...reviewConfig, selectedAgents: next });
  };

  return (
    <Screen>
      <View style={s.container}>
        {/* Header */}
        <View style={s.header}>
          <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={s.headerTitle}>写作流水线</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView style={s.scrollView} contentContainerStyle={s.scrollContent}>

          {/* ====== API配置管理 ====== */}
          <Text style={s.sectionTitle}>API配置</Text>

          {apiConfigs.map((cfg) => (
            <View key={cfg.id} style={s.apiCard}>
              <View style={s.apiInfo}>
                <Text style={s.apiName}>{cfg.name}</Text>
                <Text style={s.apiDetail}>{cfg.model} · {cfg.baseUrl.replace('https://', '').replace('http://', '').split('/')[0]}</Text>
              </View>
              <View style={s.apiActions}>
                <TouchableOpacity onPress={() => handleEditApi(cfg)} style={s.iconBtn}>
                  <Ionicons name="pencil" size={18} color="#888" />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => handleDeleteApi(cfg)} style={s.iconBtn}>
                  <Ionicons name="trash-outline" size={18} color="#666" />
                </TouchableOpacity>
              </View>
            </View>
          ))}

          <TouchableOpacity style={s.addBtn} onPress={handleAddApi}>
            <Ionicons name="add" size={20} color="#fff" />
            <Text style={s.addBtnText}>添加API</Text>
          </TouchableOpacity>

          {/* ====== Agent流水线 ====== */}
          <Text style={s.sectionTitle}>Agent流水线</Text>
          <Text style={s.sectionDesc}>从上往下依次执行，上下箭头调整顺序</Text>

          {agents.map((agent, index) => (
            <View key={agent.id} style={[s.agentCard, !agent.enabled && s.agentCardDisabled]}>
              {/* 序号 + 排序按钮 */}
              <View style={s.agentOrder}>
                <TouchableOpacity onPress={() => handleMoveUp(index)} disabled={index === 0}>
                  <Ionicons name="chevron-up" size={22} color={index === 0 ? '#333' : '#888'} />
                </TouchableOpacity>
                <Text style={[s.agentOrderNum, !agent.enabled && s.textDisabled]}>{index + 1}</Text>
                <TouchableOpacity onPress={() => handleMoveDown(index)} disabled={index === agents.length - 1}>
                  <Ionicons name="chevron-down" size={22} color={index === agents.length - 1 ? '#333' : '#888'} />
                </TouchableOpacity>
              </View>

              {/* Agent信息 */}
              <TouchableOpacity style={s.agentInfo} onPress={() => handleEditAgent(agent)} activeOpacity={0.7}>
                <Text style={[s.agentName, !agent.enabled && s.textDisabled]}>{agent.name}</Text>
                <Text style={s.agentApi}>API: {getApiName(agent.apiId)}</Text>
              </TouchableOpacity>

              {/* 开关 + 删除 */}
              <View style={s.agentRightActions}>
                <Switch
                  value={agent.enabled}
                  onValueChange={() => handleToggleAgent(agent)}
                  trackColor={{ false: '#333', true: '#666' }}
                  thumbColor={agent.enabled ? '#fff' : '#555'}
                />
                <TouchableOpacity onPress={() => handleDeleteAgent(agent)} style={s.iconBtn}>
                  <Ionicons name="trash-outline" size={18} color="#666" />
                </TouchableOpacity>
              </View>
            </View>
          ))}

          <TouchableOpacity style={s.addBtn} onPress={handleAddAgent}>
            <Ionicons name="add" size={20} color="#fff" />
            <Text style={s.addBtnText}>添加Agent</Text>
          </TouchableOpacity>

          {/* 重置按钮 */}
          <TouchableOpacity
            style={s.resetBtn}
            onPress={() => {
              Alert.alert('确认', '确定重置为默认Agent吗？自定义Agent将丢失。', [
                { text: '取消', style: 'cancel' },
                {
                  text: '重置',
                  style: 'destructive',
                  onPress: async () => {
                    /**
                     * 服务端文件：server/src/index.ts
                     * 接口：POST /api/v1/agents/reset
                     */
                    try {
                      await fetch(`${API_BASE}/api/v1/agents/reset`, { method: 'POST' });
                      loadAgents();
                    } catch (e) {}
                  },
                },
              ]);
            }}
          >
            <Text style={s.resetBtnText}>重置为默认Agent</Text>
          </TouchableOpacity>

          {/* ====== 评审配置 ====== */}
          <Text style={s.sectionTitle}>评审配置</Text>
          <Text style={s.sectionDesc}>AI评审时，只有勾选的Agent会参与讨论</Text>

          {/* 勾选参与评审的Agent */}
          {agents.filter((a) => a.enabled).map((agent) => (
            <TouchableOpacity
              key={agent.id}
              style={s.reviewAgentRow}
              onPress={() => toggleReviewAgent(agent.id)}
              activeOpacity={0.7}
            >
              <View style={[s.checkbox, reviewConfig.selectedAgents.includes(agent.id) && s.checkboxChecked]}>
                {reviewConfig.selectedAgents.includes(agent.id) && (
                  <Ionicons name="checkmark" size={16} color="#000" />
                )}
              </View>
              <Text style={s.reviewAgentName}>{agent.name}</Text>
            </TouchableOpacity>
          ))}

          {/* 评审重点/方向 */}
          <Text style={s.fieldTitle}>评审重点</Text>
          <TextInput
            style={s.reviewInput}
            placeholder="如：重点检查前后矛盾和节奏拖沓..."
            placeholderTextColor="#555"
            value={reviewConfig.focusDirection}
            onChangeText={(text) => saveReviewConfig({ ...reviewConfig, focusDirection: text })}
            multiline
          />

          {/* 评审轮数 */}
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

          {/* 字数限制 */}
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

        </ScrollView>

        {/* 弹窗 */}
        <ApiConfigModal
          visible={apiModalVisible}
          data={editingApi}
          onClose={() => setApiModalVisible(false)}
          onSave={handleSaveApi}
        />
        <AgentEditModal
          visible={agentModalVisible}
          agent={editingAgent}
          apiConfigs={apiConfigs}
          onClose={() => setAgentModalVisible(false)}
          onSave={handleSaveAgent}
        />
      </View>
    </Screen>
  );
}

// ============== 页面样式 ==============
const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 60,
    paddingBottom: 16,
  },
  backBtn: { padding: 8 },
  headerTitle: { fontSize: 22, fontWeight: 'bold', color: '#fff' },
  scrollView: { flex: 1 },
  scrollContent: { padding: 20, paddingBottom: 100 },

  sectionTitle: { color: '#888', fontSize: 13, fontWeight: '600', marginBottom: 6, marginTop: 16, textTransform: 'uppercase', letterSpacing: 1 },
  sectionDesc: { color: '#555', fontSize: 12, marginBottom: 12 },

  // API卡片
  apiCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#333',
  },
  apiInfo: { flex: 1 },
  apiName: { color: '#fff', fontSize: 16, fontWeight: '500' },
  apiDetail: { color: '#888', fontSize: 12, marginTop: 2 },
  apiActions: { flexDirection: 'row', gap: 8 },

  // Agent卡片
  agentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#333',
  },
  agentCardDisabled: { opacity: 0.45 },
  agentOrder: { alignItems: 'center', marginRight: 12, width: 36 },
  agentOrderNum: { color: '#fff', fontSize: 16, fontWeight: 'bold', marginVertical: 2 },
  agentInfo: { flex: 1 },
  agentName: { color: '#fff', fontSize: 16, fontWeight: '500' },
  agentApi: { color: '#888', fontSize: 12, marginTop: 2 },
  agentRightActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  textDisabled: { color: '#555' },

  // 通用
  iconBtn: { padding: 8 },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#333',
    gap: 8,
    marginTop: 4,
  },
  addBtnText: { color: '#fff', fontSize: 15, fontWeight: '500' },
  resetBtn: {
    alignItems: 'center',
    padding: 16,
    marginTop: 24,
  },
  resetBtnText: { color: '#666', fontSize: 14 },

  // 评审配置
  reviewAgentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    borderRadius: 10,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#333',
    gap: 12,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#555',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: '#fff',
    borderColor: '#fff',
  },
  reviewAgentName: { color: '#fff', fontSize: 15 },
  fieldTitle: { color: '#888', fontSize: 13, fontWeight: '600', marginTop: 18, marginBottom: 8 },
  reviewInput: {
    backgroundColor: '#1a1a1a',
    borderRadius: 10,
    padding: 14,
    color: '#fff',
    fontSize: 15,
    borderWidth: 1,
    borderColor: '#333',
    minHeight: 60,
    textAlignVertical: 'top',
  },
  roundsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  roundBtn: {
    flex: 1,
    backgroundColor: '#1a1a1a',
    borderRadius: 10,
    padding: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#333',
  },
  roundBtnActive: {
    backgroundColor: '#fff',
    borderColor: '#fff',
  },
  roundBtnText: { color: '#888', fontSize: 14, fontWeight: '500' },
  roundBtnTextActive: { color: '#000', fontWeight: '600' },
});

// ============== 弹窗样式 ==============
const m = StyleSheet.create({
  modalContainer: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.6)' },
  modalContent: {
    backgroundColor: '#111',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  modalTitle: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  modalBody: { padding: 20, maxHeight: 500 },
  modalFooter: {
    flexDirection: 'row',
    gap: 12,
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#333',
  },
  modalBtn: { flex: 1, padding: 14, borderRadius: 12, alignItems: 'center' },
  cancelBtn: { backgroundColor: '#1a1a1a', borderWidth: 1, borderColor: '#333' },
  cancelBtnText: { color: '#888', fontSize: 16 },
  submitBtn: { backgroundColor: '#fff' },
  submitBtnText: { color: '#000', fontSize: 16, fontWeight: '600' },

  fieldLabel: { color: '#888', fontSize: 13, marginBottom: 6, marginTop: 12 },
  sectionNum: { color: '#fff', fontSize: 15, fontWeight: '600', marginTop: 16, marginBottom: 8 },
  fieldInput: {
    backgroundColor: '#1a1a1a',
    borderRadius: 10,
    padding: 14,
    color: '#fff',
    fontSize: 15,
    borderWidth: 1,
    borderColor: '#333',
  },
  promptInput: {
    height: 160,
    textAlignVertical: 'top',
  },

  // API选择器
  pickerWrap: {
    backgroundColor: '#1a1a1a',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#333',
    maxHeight: 150,
  },
  pickerScroll: { padding: 6 },
  pickerItem: {
    padding: 12,
    borderRadius: 8,
    marginBottom: 4,
  },
  pickerItemActive: {
    backgroundColor: '#333',
  },
  pickerItemText: {
    color: '#888',
    fontSize: 14,
  },
  pickerItemTextActive: {
    color: '#fff',
    fontWeight: '600',
  },
});
