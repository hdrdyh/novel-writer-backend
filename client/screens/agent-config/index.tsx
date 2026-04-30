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

// ============== 默认写作线Agent模板 ==============
const DEFAULT_WRITING_AGENTS: Omit<Agent, 'id'>[] = [
  { name: '世界观架构师', role: 'worldbuilder', prompt: '你是世界观架构师，负责构建小说的世界观体系，包括历史背景、地理环境、社会制度、魔法/科技体系等。确保世界观自洽、丰富、有深度。', enabled: true, order: 1 },
  { name: '人物设定师', role: 'character', prompt: '你是人物设定师，负责塑造鲜活的人物角色，包括性格特征、外貌描写、行为习惯、说话方式、成长弧线等。确保人物立体、真实、有魅力。', enabled: true, order: 2 },
  { name: '情节设计师', role: 'plotter', prompt: '你是情节设计师，负责设计引人入胜的故事情节，包括主线支线、起承转合、悬念设置、伏笔呼应、高潮节奏等。确保情节紧凑、有张力、有意外。', enabled: true, order: 3 },
  { name: '文笔润色师', role: 'polisher', prompt: '你是文笔润色师，负责润色和优化文字表达，包括修辞手法、节奏韵律、画面感营造、情感渲染等。确保文笔优美、细腻、有感染力。', enabled: true, order: 4 },
  { name: '审核校对师', role: 'reviewer', prompt: '你是审核校对师，负责检查章节的逻辑一致性、前后矛盾、人物行为是否合理、世界观是否违反已设定规则等。确保内容严谨、无破绽。', enabled: true, order: 5 },
  { name: '记忆压缩师', role: 'compressor', prompt: '你是记忆压缩师，负责将长篇内容压缩为关键信息摘要，保留核心情节、人物状态、世界观要点等，供后续章节参考。确保摘要精准、不遗漏关键信息。', enabled: true, order: 6 },
];

// ============== 默认评审团Agent模板 ==============
const DEFAULT_REVIEW_AGENTS: Omit<Agent, 'id'>[] = [
  { name: '逻辑审查员', role: 'logic', prompt: '你是逻辑审查员，负责检查内容的逻辑一致性，找出前后矛盾、因果不通、设定冲突等问题。用简短直接的语言指出问题所在。', enabled: true, order: 1 },
  { name: '节奏分析师', role: 'pacing', prompt: '你是节奏分析师，负责分析叙事节奏是否合理，是否存在拖沓、跳跃、冗余等问题。给出具体的调整建议。', enabled: true, order: 2 },
  { name: '读者视角', role: 'reader', prompt: '你站在读者视角，评价这段内容的吸引力、可读性和代入感。告诉作者读者最关心的点和最可能弃读的地方。', enabled: true, order: 3 },
];

// ============== 评审配置 ==============
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
                <Text style={m.sectionNum}>① 名称</Text>
                <TextInput style={m.fieldInput} placeholder="给Agent取个名字" placeholderTextColor="#555" value={name} onChangeText={setName} />

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

// ============== 子组件：导入导出弹窗 ==============
function ImportExportModal({
  visible,
  title,
  initialValue,
  onClose,
  onImport,
}: {
  visible: boolean;
  title: string;
  initialValue: string;
  onClose: () => void;
  onImport: (text: string) => void;
}) {
  const [text, setText] = useState(initialValue);
  const [prevVisible, setPrevVisible] = useState(false);
  React.useEffect(() => {
    if (visible && !prevVisible) {
      setText(initialValue);
    }
    setPrevVisible(visible);
  }, [visible, initialValue, prevVisible]);

  const handleImport = () => {
    if (!text.trim()) {
      Alert.alert('提示', '内容不能为空');
      return;
    }
    onImport(text.trim());
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide">
      <TouchableWithoutFeedback onPress={Keyboard.dismiss} disabled={Platform.OS === 'web'}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={m.modalContainer}>
            <View style={[m.modalContent, { maxHeight: '90%' }]}>
              <View style={m.modalHeader}>
                <Text style={m.modalTitle}>{title}</Text>
                <TouchableOpacity onPress={onClose}><Ionicons name="close" size={24} color="#888" /></TouchableOpacity>
              </View>
              <ScrollView style={m.modalBody}>
                <TextInput
                  style={[m.fieldInput, { minHeight: 300, textAlignVertical: 'top' }]}
                  placeholder="粘贴导入文本..."
                  placeholderTextColor="#555"
                  value={text}
                  onChangeText={setText}
                  multiline
                  textAlignVertical="top"
                  autoCapitalize="none"
                />
              </ScrollView>
              <View style={m.modalFooter}>
                <TouchableOpacity style={[m.modalBtn, m.cancelBtn]} onPress={onClose}><Text style={m.cancelBtnText}>取消</Text></TouchableOpacity>
                <TouchableOpacity style={[m.modalBtn, m.submitBtn]} onPress={handleImport}><Text style={m.submitBtnText}>导入</Text></TouchableOpacity>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

// ============== 子组件：Agent列表（写作线/评审团共用） ==============
function AgentListSection({
  title,
  agents,
  apiConfigs,
  onAdd,
  onEdit,
  onDelete,
  onToggle,
  onMoveUp,
  onMoveDown,
  onReset,
  onExport,
  onImport,
  onImportAgent,
  desc,
}: {
  title: string;
  agents: Agent[];
  apiConfigs: ApiConfig[];
  onAdd: () => void;
  onEdit: (agent: Agent) => void;
  onDelete: (agent: Agent) => void;
  onToggle: (agent: Agent) => void;
  onMoveUp: (index: number) => void;
  onMoveDown: (index: number) => void;
  onReset: () => void;
  onExport: () => void;
  onImport: () => void;
  onImportAgent: (text: string) => void;
  desc: string;
}) {
  const getApiName = (apiId?: string) => {
    if (!apiId) return '默认';
    const cfg = apiConfigs.find((c) => c.id === apiId);
    return cfg ? cfg.name : '默认';
  };

  return (
    <>
      <View style={s.sectionHeader}>
        <Text style={s.sectionTitle}>{title}</Text>
        <View style={s.sectionBtns}>
          <TouchableOpacity style={s.impExpBtn} onPress={onExport}>
            <Ionicons name="download-outline" size={16} color="#888" />
            <Text style={s.impExpBtnText}>导出</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.impExpBtn} onPress={onImport}>
            <Ionicons name="cloud-upload-outline" size={16} color="#888" />
            <Text style={s.impExpBtnText}>导入</Text>
          </TouchableOpacity>
        </View>
      </View>
      <Text style={s.sectionDesc}>{desc}</Text>

      {agents.map((agent, index) => (
        <View key={agent.id} style={[s.agentCard, !agent.enabled && s.agentCardDisabled]}>
          <View style={s.agentOrder}>
            <TouchableOpacity onPress={() => onMoveUp(index)} disabled={index === 0}>
              <Ionicons name="chevron-up" size={22} color={index === 0 ? '#333' : '#888'} />
            </TouchableOpacity>
            <Text style={[s.agentOrderNum, !agent.enabled && s.textDisabled]}>{index + 1}</Text>
            <TouchableOpacity onPress={() => onMoveDown(index)} disabled={index === agents.length - 1}>
              <Ionicons name="chevron-down" size={22} color={index === agents.length - 1 ? '#333' : '#888'} />
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={s.agentInfo} onPress={() => onEdit(agent)} activeOpacity={0.7}>
            <Text style={[s.agentName, !agent.enabled && s.textDisabled]}>{agent.name}</Text>
            <Text style={s.agentApi}>API: {getApiName(agent.apiId)}</Text>
          </TouchableOpacity>

          <View style={s.agentRightActions}>
            <Switch
              value={agent.enabled}
              onValueChange={() => onToggle(agent)}
              trackColor={{ false: '#333', true: '#666' }}
              thumbColor={agent.enabled ? '#fff' : '#555'}
            />
            <TouchableOpacity onPress={() => onDelete(agent)} style={s.iconBtn}>
              <Ionicons name="trash-outline" size={18} color="#666" />
            </TouchableOpacity>
          </View>
        </View>
      ))}

      <TouchableOpacity style={s.addBtn} onPress={onAdd}>
        <Ionicons name="add" size={20} color="#fff" />
        <Text style={s.addBtnText}>添加Agent</Text>
      </TouchableOpacity>

      <TouchableOpacity style={s.resetBtn} onPress={onReset}>
        <Text style={s.resetBtnText}>重置为默认</Text>
      </TouchableOpacity>
    </>
  );
}

// ============== 主页面 ==============
export default function AgentConfigScreen() {
  const router = useSafeRouter();

  // Tab状态
  const [activeTab, setActiveTab] = useState<'writing' | 'review' | 'api'>('writing');

  // API配置（本地存储）
  const [apiConfigs, setApiConfigs] = useState<ApiConfig[]>([]);
  const [apiModalVisible, setApiModalVisible] = useState(false);
  const [editingApi, setEditingApi] = useState<ApiConfig | null>(null);

  // 写作线Agent（本地存储）
  const [writingAgents, setWritingAgents] = useState<Agent[]>([]);
  const [agentModalVisible, setAgentModalVisible] = useState(false);
  const [editingAgent, setEditingAgent] = useState<Agent | null>(null);
  const [isAddingAgent, setIsAddingAgent] = useState(false);

  // 评审团Agent（本地存储）
  const [reviewAgents, setReviewAgents] = useState<Agent[]>([]);
  const [reviewModalVisible, setReviewModalVisible] = useState(false);
  const [editingReviewAgent, setEditingReviewAgent] = useState<Agent | null>(null);
  const [isAddingReviewAgent, setIsAddingReviewAgent] = useState(false);

  // 导入弹窗
  const [importModalVisible, setImportModalVisible] = useState(false);
  const [importType, setImportType] = useState<'api' | 'writing' | 'review'>('api');
  const [importText, setImportText] = useState('');

  // API测试
  const [testingApis, setTestingApis] = useState<Record<string, 'testing' | 'ok' | 'fail'>>({});

  // 评审配置
  const [reviewConfig, setReviewConfig] = useState<ReviewConfig>({
    focusDirection: '',
    rounds: 1,
    maxWords: 80,
  });

  // ============== 加载数据 ==============
  const loadApiConfigs = useCallback(async () => {
    try {
      const data = await AsyncStorage.getItem('apiConfigs');
      if (data) setApiConfigs(JSON.parse(data));
    } catch (_e) {}
  }, []);

  const loadWritingAgents = useCallback(async () => {
    try {
      const data = await AsyncStorage.getItem('agentConfigs');
      if (data) {
        setWritingAgents(JSON.parse(data));
      } else {
        const defaultList: Agent[] = DEFAULT_WRITING_AGENTS.map((a, i) => ({
          ...a,
          id: new Date().getTime().toString() + '_w' + i,
        }));
        setWritingAgents(defaultList);
        await AsyncStorage.setItem('agentConfigs', JSON.stringify(defaultList));
      }
    } catch (_e) {}
  }, []);

  const loadReviewAgents = useCallback(async () => {
    try {
      const data = await AsyncStorage.getItem('reviewTeamConfigs');
      if (data) {
        setReviewAgents(JSON.parse(data));
      } else {
        const defaultList: Agent[] = DEFAULT_REVIEW_AGENTS.map((a, i) => ({
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
      loadWritingAgents();
      loadReviewAgents();
      loadReviewConfig();
    }, [loadApiConfigs, loadWritingAgents, loadReviewAgents, loadReviewConfig])
  );

  // ============== 保存函数 ==============
  const saveApiConfigs = async (configs: ApiConfig[]) => {
    setApiConfigs(configs);
    await AsyncStorage.setItem('apiConfigs', JSON.stringify(configs));
  };

  const saveWritingAgents = async (list: Agent[]) => {
    setWritingAgents(list);
    await AsyncStorage.setItem('agentConfigs', JSON.stringify(list));
  };

  const saveReviewAgents = async (list: Agent[]) => {
    setReviewAgents(list);
    await AsyncStorage.setItem('reviewTeamConfigs', JSON.stringify(list));
  };

  const saveReviewConfig = async (config: ReviewConfig) => {
    setReviewConfig(config);
    await AsyncStorage.setItem('reviewConfig', JSON.stringify(config));
  };

  // ============== API导入导出 ==============
  const exportApiText = () => {
    return apiConfigs.map((cfg) =>
      `模型: ${cfg.name}\nAPI: ${cfg.baseUrl}\nKey: ${cfg.apiKey}\n模型名: ${cfg.model}`
    ).join('\n---\n');
  };

  const handleImportApi = (text: string) => {
    const blocks = text.split('---');
    const newConfigs: ApiConfig[] = [];
    for (const block of blocks) {
      const lines = block.trim().split('\n').map((l) => l.trim()).filter(Boolean);
      const getValue = (prefix: string) => {
        const line = lines.find((l) => l.startsWith(prefix));
        return line ? line.substring(prefix.length).trim() : '';
      };
      const name = getValue('模型:');
      const baseUrl = getValue('API:');
      const apiKey = getValue('Key:');
      const model = getValue('模型名:');
      if (name && apiKey && baseUrl && model) {
        newConfigs.push({ id: new Date().getTime().toString() + '_' + newConfigs.length, name, apiKey, baseUrl, model });
      }
    }
    if (newConfigs.length === 0) {
      Alert.alert('导入失败', '未识别到有效的API配置，请检查格式');
      return;
    }
    saveApiConfigs([...apiConfigs, ...newConfigs]);
    Alert.alert('导入成功', `已导入 ${newConfigs.length} 个API配置`);
  };

  // ============== Agent导入导出（通用） ==============
  const exportAgentText = (agentList: Agent[]) => {
    return agentList.map((a) =>
      `名称: ${a.name}\n规则: ${a.prompt}\nAPI: ${getApiName(a.apiId)}\n顺序: ${a.order}\n启用: ${a.enabled ? '是' : '否'}`
    ).join('\n---\n');
  };

  const handleImportAgent = (text: string, existingAgents: Agent[], saveFn: (list: Agent[]) => Promise<void>) => {
    const blocks = text.split('---');
    const newAgents: Agent[] = [];
    const maxOrder = existingAgents.length > 0 ? Math.max(...existingAgents.map((a) => a.order)) : 0;
    for (const block of blocks) {
      const lines = block.trim().split('\n').map((l) => l.trim()).filter(Boolean);
      const getValue = (prefix: string) => {
        const line = lines.find((l) => l.startsWith(prefix));
        return line ? line.substring(prefix.length).trim() : '';
      };
      const name = getValue('名称:');
      const prompt = getValue('规则:');
      const apiName = getValue('API:');
      const orderStr = getValue('顺序:');
      const enabledStr = getValue('启用:');
      if (name && prompt) {
        const apiId = apiName ? (apiConfigs.find((c) => c.name === apiName)?.id || '') : '';
        newAgents.push({
          id: new Date().getTime().toString() + '_a' + newAgents.length,
          name,
          role: 'custom',
          prompt,
          apiId,
          order: orderStr ? parseInt(orderStr, 10) : maxOrder + newAgents.length + 1,
          enabled: enabledStr !== '否',
        });
      }
    }
    if (newAgents.length === 0) {
      Alert.alert('导入失败', '未识别到有效的Agent配置，请检查格式');
      return;
    }
    saveFn([...existingAgents, ...newAgents]);
    Alert.alert('导入成功', `已导入 ${newAgents.length} 个Agent`);
  };

  // ============== API一键测试 ==============
  const testApiConnection = async (cfg: ApiConfig) => {
    setTestingApis((prev) => ({ ...prev, [cfg.id]: 'testing' }));
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);
      const baseEndpoint = cfg.baseUrl.endsWith('/v1') ? cfg.baseUrl : `${cfg.baseUrl}/v1`;
      const res = await fetch(`${baseEndpoint}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${cfg.apiKey}`,
        },
        body: JSON.stringify({
          model: cfg.model,
          messages: [{ role: 'user', content: 'hi' }],
          max_tokens: 5,
        }),
        signal: controller.signal,
      });
      clearTimeout(timeout);
      if (res.ok) {
        setTestingApis((prev) => ({ ...prev, [cfg.id]: 'ok' }));
      } else {
        const errText = await res.text().catch(() => '');
        setTestingApis((prev) => ({ ...prev, [cfg.id]: 'fail' }));
        Alert.alert('连接失败', `${cfg.name}: HTTP ${res.status}\n${errText.substring(0, 200)}`);
      }
    } catch (e: any) {
      setTestingApis((prev) => ({ ...prev, [cfg.id]: 'fail' }));
      Alert.alert('连接失败', `${cfg.name}: ${e.message || '网络错误'}`);
    }
  };

  const testAllApis = async () => {
    if (apiConfigs.length === 0) {
      Alert.alert('提示', '没有可测试的API配置');
      return;
    }
    for (const cfg of apiConfigs) {
      await testApiConnection(cfg);
    }
    const okCount = Object.values(testingApis).filter((v) => v === 'ok').length;
    Alert.alert('测试完成', `${okCount}/${apiConfigs.length} 个API连接正常`);
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
      const next = apiConfigs.map((c) => (c.id === data.id ? { ...c, ...data } : c));
      saveApiConfigs(next);
    } else {
      const newCfg: ApiConfig = { ...data, id: new Date().getTime().toString() };
      saveApiConfigs([...apiConfigs, newCfg]);
    }
  };

  // ============== 写作线Agent操作 ==============
  const handleAddWritingAgent = () => {
    setIsAddingAgent(true);
    setEditingAgent(null);
    setAgentModalVisible(true);
  };

  const handleEditWritingAgent = (agent: Agent) => {
    setIsAddingAgent(false);
    setEditingAgent(agent);
    setAgentModalVisible(true);
  };

  const handleSaveWritingAgent = (data: { name: string; prompt: string; apiId: string }) => {
    if (editingAgent && !isAddingAgent) {
      const next = writingAgents.map((a) => a.id === editingAgent.id ? { ...a, ...data } : a);
      saveWritingAgents(next);
    } else {
      const newAgent: Agent = {
        id: new Date().getTime().toString() + '_wnew',
        name: data.name,
        role: 'custom',
        prompt: data.prompt,
        apiId: data.apiId,
        enabled: true,
        order: writingAgents.length + 1,
      };
      saveWritingAgents([...writingAgents, newAgent]);
    }
  };

  const handleDeleteWritingAgent = (agent: Agent) => {
    Alert.alert('确认', `确定删除Agent "${agent.name}" 吗？`, [
      { text: '取消', style: 'cancel' },
      {
        text: '删除',
        style: 'destructive',
        onPress: () => {
          const next = writingAgents.filter((a) => a.id !== agent.id);
          saveWritingAgents(next);
        },
      },
    ]);
  };

  const handleToggleWritingAgent = (agent: Agent) => {
    const next = writingAgents.map((a) => a.id === agent.id ? { ...a, enabled: !a.enabled } : a);
    saveWritingAgents(next);
  };

  const handleMoveWritingUp = (index: number) => {
    if (index === 0) return;
    const newAgents = [...writingAgents];
    const temp = newAgents[index];
    newAgents[index] = newAgents[index - 1];
    newAgents[index - 1] = temp;
    const reordered = newAgents.map((a, i) => ({ ...a, order: i + 1 }));
    saveWritingAgents(reordered);
  };

  const handleMoveWritingDown = (index: number) => {
    if (index === writingAgents.length - 1) return;
    const newAgents = [...writingAgents];
    const temp = newAgents[index];
    newAgents[index] = newAgents[index + 1];
    newAgents[index + 1] = temp;
    const reordered = newAgents.map((a, i) => ({ ...a, order: i + 1 }));
    saveWritingAgents(reordered);
  };

  const handleResetWritingAgents = () => {
    Alert.alert('确认', '确定重置写作线Agent为默认吗？自定义Agent将丢失。', [
      { text: '取消', style: 'cancel' },
      {
        text: '重置',
        style: 'destructive',
        onPress: () => {
          const defaultList: Agent[] = DEFAULT_WRITING_AGENTS.map((a, i) => ({
            ...a,
            id: new Date().getTime().toString() + '_w' + i,
          }));
          saveWritingAgents(defaultList);
        },
      },
    ]);
  };

  // ============== 评审团Agent操作 ==============
  const handleAddReviewAgent = () => {
    setIsAddingReviewAgent(true);
    setEditingReviewAgent(null);
    setReviewModalVisible(true);
  };

  const handleEditReviewAgent = (agent: Agent) => {
    setIsAddingReviewAgent(false);
    setEditingReviewAgent(agent);
    setReviewModalVisible(true);
  };

  const handleSaveReviewAgent = (data: { name: string; prompt: string; apiId: string }) => {
    if (editingReviewAgent && !isAddingReviewAgent) {
      const next = reviewAgents.map((a) => a.id === editingReviewAgent.id ? { ...a, ...data } : a);
      saveReviewAgents(next);
    } else {
      const newAgent: Agent = {
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

  const handleDeleteReviewAgent = (agent: Agent) => {
    Alert.alert('确认', `确定删除评审Agent "${agent.name}" 吗？`, [
      { text: '取消', style: 'cancel' },
      {
        text: '删除',
        style: 'destructive',
        onPress: () => {
          const next = reviewAgents.filter((a) => a.id !== agent.id);
          saveReviewAgents(next);
        },
      },
    ]);
  };

  const handleToggleReviewAgent = (agent: Agent) => {
    const next = reviewAgents.map((a) => a.id === agent.id ? { ...a, enabled: !a.enabled } : a);
    saveReviewAgents(next);
  };

  const handleMoveReviewUp = (index: number) => {
    if (index === 0) return;
    const newAgents = [...reviewAgents];
    const temp = newAgents[index];
    newAgents[index] = newAgents[index - 1];
    newAgents[index - 1] = temp;
    const reordered = newAgents.map((a, i) => ({ ...a, order: i + 1 }));
    saveReviewAgents(reordered);
  };

  const handleMoveReviewDown = (index: number) => {
    if (index === reviewAgents.length - 1) return;
    const newAgents = [...reviewAgents];
    const temp = newAgents[index];
    newAgents[index] = newAgents[index + 1];
    newAgents[index + 1] = temp;
    const reordered = newAgents.map((a, i) => ({ ...a, order: i + 1 }));
    saveReviewAgents(reordered);
  };

  const handleResetReviewAgents = () => {
    Alert.alert('确认', '确定重置评审团Agent为默认吗？自定义Agent将丢失。', [
      { text: '取消', style: 'cancel' },
      {
        text: '重置',
        style: 'destructive',
        onPress: () => {
          const defaultList: Agent[] = DEFAULT_REVIEW_AGENTS.map((a, i) => ({
            ...a,
            id: new Date().getTime().toString() + '_r' + i,
          }));
          saveReviewAgents(defaultList);
        },
      },
    ]);
  };

  // 获取绑定的API名称
  const getApiName = (apiId?: string) => {
    if (!apiId) return '默认';
    const cfg = apiConfigs.find((c) => c.id === apiId);
    return cfg ? cfg.name : '默认';
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

        {/* Tab切换 */}
        <View style={s.tabBar}>
          {([
            { key: 'writing' as const, label: '写作线' },
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

          {/* ====== 写作线 Tab ====== */}
          {activeTab === 'writing' && (
            <AgentListSection
              title="写作线Agent"
              agents={writingAgents}
              apiConfigs={apiConfigs}
              onAdd={handleAddWritingAgent}
              onEdit={handleEditWritingAgent}
              onDelete={handleDeleteWritingAgent}
              onToggle={handleToggleWritingAgent}
              onMoveUp={handleMoveWritingUp}
              onMoveDown={handleMoveWritingDown}
              onReset={handleResetWritingAgents}
              onExport={() => {
                setImportType('writing');
                setImportText(exportAgentText(writingAgents));
                setImportModalVisible(true);
              }}
              onImport={() => {
                setImportType('writing');
                setImportText('');
                setImportModalVisible(true);
              }}
              onImportAgent={(text) => handleImportAgent(text, writingAgents, saveWritingAgents)}
              desc="从上往下依次执行，上下箭头调整顺序"
            />
          )}

          {/* ====== 评审团 Tab ====== */}
          {activeTab === 'review' && (
            <>
              <AgentListSection
                title="评审团Agent"
                agents={reviewAgents}
                apiConfigs={apiConfigs}
                onAdd={handleAddReviewAgent}
                onEdit={handleEditReviewAgent}
                onDelete={handleDeleteReviewAgent}
                onToggle={handleToggleReviewAgent}
                onMoveUp={handleMoveReviewUp}
                onMoveDown={handleMoveReviewDown}
                onReset={handleResetReviewAgents}
                onExport={() => {
                  setImportType('review');
                  setImportText(exportAgentText(reviewAgents));
                  setImportModalVisible(true);
                }}
                onImport={() => {
                  setImportType('review');
                  setImportText('');
                  setImportModalVisible(true);
                }}
                onImportAgent={(text) => handleImportAgent(text, reviewAgents, saveReviewAgents)}
                desc="只有启用的评审Agent会在AI评审时参与讨论"
              />

              {/* 评审参数配置 */}
              <View style={s.divider} />

              <Text style={s.sectionTitle}>评审参数</Text>

              <Text style={s.fieldTitle}>评审重点</Text>
              <TextInput
                style={s.reviewInput}
                placeholder="如：重点检查前后矛盾和节奏拖沓..."
                placeholderTextColor="#555"
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
                <View style={s.sectionBtns}>
                  <TouchableOpacity
                    style={s.impExpBtn}
                    onPress={() => {
                      setImportType('api');
                      setImportText(exportApiText());
                      setImportModalVisible(true);
                    }}
                  >
                    <Ionicons name="download-outline" size={16} color="#888" />
                    <Text style={s.impExpBtnText}>导出</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={s.impExpBtn}
                    onPress={() => {
                      setImportType('api');
                      setImportText('');
                      setImportModalVisible(true);
                    }}
                  >
                    <Ionicons name="cloud-upload-outline" size={16} color="#888" />
                    <Text style={s.impExpBtnText}>导入</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={s.impExpBtn} onPress={testAllApis}>
                    <Ionicons name="flash-outline" size={16} color="#888" />
                    <Text style={s.impExpBtnText}>测试</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {apiConfigs.map((cfg) => (
                <View key={cfg.id} style={s.apiCard}>
                  <View style={s.apiInfo}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <Text style={s.apiName}>{cfg.name}</Text>
                      {testingApis[cfg.id] === 'ok' && <Ionicons name="checkmark-circle" size={16} color="#4CAF50" />}
                      {testingApis[cfg.id] === 'fail' && <Ionicons name="close-circle" size={16} color="#F44336" />}
                      {testingApis[cfg.id] === 'testing' && <ActivityIndicator size={14} color="#888" />}
                    </View>
                    <Text style={s.apiDetail}>{cfg.model} · {cfg.baseUrl.replace('https://', '').replace('http://', '').split('/')[0]}</Text>
                  </View>
                  <View style={s.apiActions}>
                    <TouchableOpacity onPress={() => testApiConnection(cfg)} style={s.iconBtn}>
                      <Ionicons name="flash-outline" size={18} color="#888" />
                    </TouchableOpacity>
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
        <AgentEditModal
          visible={agentModalVisible}
          agent={editingAgent}
          apiConfigs={apiConfigs}
          onClose={() => setAgentModalVisible(false)}
          onSave={handleSaveWritingAgent}
        />
        <AgentEditModal
          visible={reviewModalVisible}
          agent={editingReviewAgent}
          apiConfigs={apiConfigs}
          onClose={() => setReviewModalVisible(false)}
          onSave={handleSaveReviewAgent}
        />
        <ImportExportModal
          visible={importModalVisible}
          title={importType === 'api' ? 'API导入导出' : importType === 'writing' ? '写作线Agent导入导出' : '评审团Agent导入导出'}
          initialValue={importText}
          onClose={() => setImportModalVisible(false)}
          onImport={importType === 'api' ? handleImportApi : (text) => handleImportAgent(text, importType === 'writing' ? writingAgents : reviewAgents, importType === 'writing' ? saveWritingAgents : saveReviewAgents)}
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

  // Tab栏
  tabBar: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginBottom: 8,
    backgroundColor: '#111',
    borderRadius: 12,
    padding: 4,
    borderWidth: 1,
    borderColor: '#333',
  },
  tabItem: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 10,
  },
  tabItemActive: {
    backgroundColor: '#fff',
  },
  tabItemText: {
    color: '#888',
    fontSize: 14,
    fontWeight: '600',
  },
  tabItemTextActive: {
    color: '#000',
  },

  scrollView: { flex: 1 },
  scrollContent: { padding: 20, paddingBottom: 100 },

  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 16 },
  sectionTitle: { color: '#888', fontSize: 13, fontWeight: '600', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 1 },
  sectionBtns: { flexDirection: 'row', gap: 12 },
  sectionDesc: { color: '#555', fontSize: 12, marginBottom: 12 },

  impExpBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 4 },
  impExpBtnText: { color: '#888', fontSize: 13 },

  divider: { height: 1, backgroundColor: '#222', marginTop: 24, marginBottom: 8 },

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
  apiActions: { flexDirection: 'row', gap: 4 },

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
  resetBtn: { alignItems: 'center', padding: 16, marginTop: 12 },
  resetBtnText: { color: '#666', fontSize: 14 },

  // 评审参数
  fieldTitle: { color: '#888', fontSize: 13, fontWeight: '600', marginTop: 18, marginBottom: 8 },
  reviewInput: {
    backgroundColor: '#1a1a1a', borderRadius: 10, padding: 14,
    color: '#fff', fontSize: 15, borderWidth: 1, borderColor: '#333',
    minHeight: 60, textAlignVertical: 'top',
  },
  roundsRow: { flexDirection: 'row', gap: 10 },
  roundBtn: {
    flex: 1, backgroundColor: '#1a1a1a', borderRadius: 10, padding: 12,
    alignItems: 'center', borderWidth: 1, borderColor: '#333',
  },
  roundBtnActive: { backgroundColor: '#fff', borderColor: '#fff' },
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
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: 20, borderBottomWidth: 1, borderBottomColor: '#333',
  },
  modalTitle: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  modalBody: { padding: 20, maxHeight: 500 },
  modalFooter: {
    flexDirection: 'row', gap: 12, padding: 20,
    borderTopWidth: 1, borderTopColor: '#333',
  },
  modalBtn: { flex: 1, padding: 14, borderRadius: 12, alignItems: 'center' },
  cancelBtn: { backgroundColor: '#1a1a1a', borderWidth: 1, borderColor: '#333' },
  cancelBtnText: { color: '#888', fontSize: 16 },
  submitBtn: { backgroundColor: '#fff' },
  submitBtnText: { color: '#000', fontSize: 16, fontWeight: '600' },

  fieldLabel: { color: '#888', fontSize: 13, marginBottom: 6, marginTop: 12 },
  sectionNum: { color: '#fff', fontSize: 15, fontWeight: '600', marginTop: 16, marginBottom: 8 },
  fieldInput: {
    backgroundColor: '#1a1a1a', borderRadius: 10, padding: 14,
    color: '#fff', fontSize: 15, borderWidth: 1, borderColor: '#333',
  },
  promptInput: { height: 160, textAlignVertical: 'top' },

  pickerWrap: {
    backgroundColor: '#1a1a1a', borderRadius: 10,
    borderWidth: 1, borderColor: '#333', maxHeight: 150,
  },
  pickerScroll: { padding: 6 },
  pickerItem: { padding: 12, borderRadius: 8, marginBottom: 4 },
  pickerItemActive: { backgroundColor: '#333' },
  pickerItemText: { color: '#888', fontSize: 14 },
  pickerItemTextActive: { color: '#fff', fontWeight: '600' },
});
