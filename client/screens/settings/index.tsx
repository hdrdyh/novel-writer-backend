import { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  Modal,
  TextInput,
  Alert,
} from 'react-native';
import { Screen } from '@/components/Screen';
import { Feather } from '@expo/vector-icons';

const EXPO_PUBLIC_BACKEND_BASE_URL = 'https://novel-writer-backend-production-24e9.up.railway.app';

interface APIConfig {
  id: string;
  name: string;
  provider: string;
  apiKey: string;
}

interface Agent {
  id: string;
  name: string;
  role: string;
  prompt: string;
  enabled: boolean;
  icon: string;
  apiId: string | null;
  order: number;
}

export default function SettingsScreen() {
  // API配置列表
  const [apis, setApis] = useState<APIConfig[]>([
    { id: '1', name: 'DeepSeek', provider: 'deepseek', apiKey: 'sk-xxx...xxx' },
    { id: '2', name: 'Kimi', provider: 'kimi', apiKey: 'sk-xxx...xxx' },
  ]);

  // Agent列表（从后端获取）
  const [agents, setAgents] = useState<Agent[]>([]);
  const [agentsLoaded, setAgentsLoaded] = useState(false);

  // 加载Agent列表
  useEffect(() => {
    fetchAgents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchAgents = async () => {
    try {
      const res = await fetch(`${EXPO_PUBLIC_BACKEND_BASE_URL}/api/v1/agents`);
      const data = await res.json();
      if (data.agents) {
        const mappedAgents: Agent[] = data.agents.map((a: any) => ({
          id: a.id,
          name: a.name,
          role: a.role,
          prompt: a.prompt,
          enabled: a.enabled,
          order: a.order || 0, // 确保有order字段
          icon: getIconByRole(a.role),
          apiId: a.apiId || null,
        }));
        setAgents(mappedAgents);
        setAgentsLoaded(true);
      }
    } catch (e) {
      console.error('加载Agent失败:', e);
    }
  };

  const getIconByRole = (role: string): string => {
    const icons: Record<string, string> = {
      system: 'globe',
      character: 'user',
      plot: 'git-branch',
      style: 'edit',
      review: 'check-circle',
      memory: 'database',
    };
    return icons[role] || 'user';
  };

  // 弹窗状态
  const [apiModalVisible, setApiModalVisible] = useState(false);
  const [editingApi, setEditingApi] = useState<APIConfig | null>(null);
  const [apiName, setApiName] = useState('');
  const [apiProvider, setApiProvider] = useState('deepseek');
  const [apiModel, setApiModel] = useState('');
  const [apiBaseUrl, setApiBaseUrl] = useState('');
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [isTestingApi, setIsTestingApi] = useState(false);
  const [apiTestResult, setApiTestResult] = useState<{success: boolean; message: string} | null>(null);

  // Provider选项
  const providerOptions = [
    { value: 'deepseek', label: 'DeepSeek', endpoint: 'https://api.deepseek.com', keyFormat: 'sk-' },
    { value: 'openai', label: 'OpenAI', endpoint: 'https://api.openai.com', keyFormat: 'sk-' },
    { value: 'kimi', label: 'Kimi', endpoint: 'https://api.moonshot.cn', keyFormat: 'sk-' },
    { value: 'zhipu', label: '智谱AI', endpoint: 'https://open.bigmodel.cn', keyFormat: '' },
    { value: 'custom', label: '自定义', endpoint: '', keyFormat: '' },
  ];

  const [agentModalVisible, setAgentModalVisible] = useState(false);
  const [editingAgent, setEditingAgent] = useState<Agent | null>(null);
  const [agentName, setAgentName] = useState('');
  const [agentPrompt, setAgentPrompt] = useState('');
  const [selectedApiId, setSelectedApiId] = useState<string | null>(null);
  const [detailAgent, setDetailAgent] = useState<Agent | null>(null);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [moveModalVisible, setMoveModalVisible] = useState(false);
  const [selectedAgentForMove, setSelectedAgentForMove] = useState<Agent | null>(null);
  const [actionMenuAgent, setActionMenuAgent] = useState<Agent | null>(null);
  const [actionMenuModalVisible, setActionMenuModalVisible] = useState(false);

  // ============== Agent详情 ==============
  const handleViewAgentDetail = (agent: Agent) => {
    setDetailAgent(agent);
    setDetailModalVisible(true);
  };

  // ============== API管理 ==============
  const handleAddApi = () => {
    setEditingApi(null);
    setApiName('');
    setApiProvider('');
    setApiKeyInput('');
    setShowApiKey(false);
    setApiModalVisible(true);
  };

  const handleEditApi = (api: APIConfig) => {
    setEditingApi(api);
    setApiName(api.name);
    setApiProvider(api.provider);
    setApiKeyInput(api.apiKey);
    setShowApiKey(false);
    setApiModalVisible(true);
  };

  const handleTestApi = async () => {
    if (!apiProvider.trim()) {
      Alert.alert('提示', '请先选择 API Provider');
      return;
    }
    if (!apiKeyInput.trim()) {
      Alert.alert('提示', '请先输入 API Key');
      return;
    }

    setIsTestingApi(true);
    setApiTestResult(null);

    try {
      const provider = providerOptions.find(p => p.value === apiProvider);
      const endpoint = provider?.endpoint || '';

      if (!endpoint) {
        throw new Error('该 Provider 需要配置自定义端点');
      }

      const response = await fetch(`${endpoint}/v1/models`, {
        headers: {
          'Authorization': `Bearer ${apiKeyInput.trim()}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        setApiTestResult({ success: true, message: '连接成功！API Key 有效' });
      } else {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error?.message || `错误码: ${response.status}`);
      }
    } catch (error: any) {
      setApiTestResult({ success: false, message: error.message || '连接失败' });
    } finally {
      setIsTestingApi(false);
    }
  };

  const handleSaveApi = () => {
    if (!apiName.trim()) {
      Alert.alert('提示', '请输入 API 名称');
      return;
    }
    if (!apiProvider.trim()) {
      Alert.alert('提示', '请选择 API Provider');
      return;
    }
    if (!apiKeyInput.trim()) {
      Alert.alert('提示', '请输入 API Key');
      return;
    }

    if (editingApi) {
      setApis(prev =>
        prev.map(a =>
          a.id === editingApi.id
            ? { ...a, name: apiName.trim(), provider: apiProvider.trim(), apiKey: apiKeyInput.trim() }
            : a
        )
      );
      Alert.alert('成功', 'API 配置已更新');
    } else {
      const newApi: APIConfig = {
        id: Date.now().toString(),
        name: apiName.trim(),
        provider: apiProvider.trim(),
        apiKey: apiKeyInput.trim(),
      };
      setApis(prev => [...prev, newApi]);
      Alert.alert('成功', 'API 配置已添加');
    }
    setApiModalVisible(false);
  };

  const handleDeleteApi = (api: APIConfig) => {
    // 检查是否有Agent正在使用此API
    const usedBy = agents.filter(a => a.apiId === api.id);
    if (usedBy.length > 0) {
      Alert.alert('无法删除', `该API正被以下Agent使用：${usedBy.map(a => a.name).join('、')}`);
      return;
    }

    Alert.alert('删除确认', `确定要删除「${api.name}」吗？`, [
      { text: '取消', style: 'cancel' },
      {
        text: '删除',
        style: 'destructive',
        onPress: () => {
          setApis(prev => prev.filter(a => a.id !== api.id));
          Alert.alert('成功', 'API 配置已删除');
        },
      },
    ]);
  };

  // ============== Agent管理 ==============
  const handleAddAgent = () => {
    setEditingAgent(null);
    setAgentName('');
    setAgentPrompt('');
    setSelectedApiId(apis.length > 0 ? apis[0].id : null);
    setAgentModalVisible(true);
  };

  const handleEditAgent = (agent: Agent) => {
    setEditingAgent(agent);
    setAgentName(agent.name);
    setAgentPrompt(agent.prompt);
    setSelectedApiId(agent.apiId);
    setAgentModalVisible(true);
  };

  const handleSaveAgent = () => {
    if (!agentName.trim()) {
      Alert.alert('提示', '请输入 Agent 名称');
      return;
    }
    if (!agentPrompt.trim()) {
      Alert.alert('提示', '请输入 Agent 规则描述');
      return;
    }
    if (!selectedApiId) {
      Alert.alert('提示', '请选择关联的 API');
      return;
    }

    if (editingAgent) {
      setAgents(prev =>
        prev.map(a =>
          a.id === editingAgent.id
            ? { ...a, name: agentName.trim(), prompt: agentPrompt.trim(), apiId: selectedApiId }
            : a
        )
      );
      Alert.alert('成功', 'Agent 已更新');
    } else {
      const maxOrder = agents.reduce((max, a) => Math.max(max, a.order), 0);
      const newAgent: Agent = {
        id: Date.now().toString(),
        name: agentName.trim(),
        role: 'custom',
        prompt: agentPrompt.trim(),
        enabled: true,
        icon: 'user',
        apiId: selectedApiId,
        order: maxOrder + 1,
      };
      setAgents(prev => [...prev, newAgent]);
      Alert.alert('成功', 'Agent 已添加');
    }
    setAgentModalVisible(false);
  };

  const handleDeleteAgent = (agent: Agent) => {
    // 先显示确认框
    Alert.alert('删除确认', `确定要删除「${agent.name}」吗？`, [
      { text: '取消', style: 'cancel' },
      {
        text: '删除',
        style: 'destructive',
        onPress: () => {
          // 删除前端
          const newList = agents.filter(a => a.id !== agent.id);
          setAgents(newList);
          
          // 调用API删除
          const deleteUrl = `${EXPO_PUBLIC_BACKEND_BASE_URL}/api/v1/agents/${agent.id}`;
          fetch(deleteUrl, { method: 'DELETE' })
            .then(res => res.json())
            .then(() => {
              Alert.alert('成功', 'Agent 已删除');
            })
            .catch(() => {
              Alert.alert('提示', '前端已删除，后台同步失败');
            });
        },
      },
    ]);
  };

  const handleToggleAgent = (id: string) => {
    setAgents(prev =>
      prev.map(a => (a.id === id ? { ...a, enabled: !a.enabled } : a))
    );
  };

  // 显示移动位置对话框
  const handleShowMoveDialog = (agent: Agent) => {
    setSelectedAgentForMove(agent);
    setMoveModalVisible(true);
  };

  // 移动到指定位置
  const handleMoveToOrder = async (targetOrder: number) => {
    if (!selectedAgentForMove) return;
    
    const currentOrder = selectedAgentForMove.order;
    if (currentOrder === targetOrder) {
      setMoveModalVisible(false);
      return;
    }

    const sorted = [...agents].sort((a, b) => a.order - b.order);
    let newOrder: Agent[];

    if (targetOrder < currentOrder) {
      // 向上移动：目标位置之后的往前移
      newOrder = sorted.map(a => {
        if (a.id === selectedAgentForMove.id) {
          return { ...a, order: targetOrder };
        }
        if (a.order >= targetOrder && a.order < currentOrder) {
          return { ...a, order: a.order + 1 };
        }
        return a;
      });
    } else {
      // 向下移动：当前位置到目标位置之间的往后移
      newOrder = sorted.map(a => {
        if (a.id === selectedAgentForMove.id) {
          return { ...a, order: targetOrder };
        }
        if (a.order > currentOrder && a.order <= targetOrder) {
          return { ...a, order: a.order - 1 };
        }
        return a;
      });
    }

    setAgents(newOrder);
    setMoveModalVisible(false);
    
      // 同步到后端
      try {
        const response = await fetch(`${EXPO_PUBLIC_BACKEND_BASE_URL}/api/v1/agents/reorder`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ orders: newOrder.map(a => ({ id: a.id, order: a.order })) }),
        });
        if (!response.ok) {
          throw new Error('保存失败');
        }
      } catch (e) {
        Alert.alert('错误', '调整顺序失败');
      }
  };

  const getAgentIcon = (iconName: string) => {
    const iconMap: Record<string, string> = {
      globe: 'globe',
      user: 'user',
      'git-branch': 'git-branch',
      edit: 'edit-3',
      'check-circle': 'check-circle',
    };
    return iconMap[iconName] || 'user';
  };

  const getApiName = (apiId: string | null) => {
    if (!apiId) return '未配置';
    const api = apis.find(a => a.id === apiId);
    return api?.name || '未知';
  };

  return (
    <Screen>
      <View style={styles.header}>
        <Text style={styles.greeting}>设置</Text>
        <Text style={styles.title}>配置中心</Text>
      </View>

      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        {/* API管理 */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>API 配置</Text>
            <Pressable style={styles.addBtn} onPress={handleAddApi}>
              <Feather name="plus" size={16} color="#FFFFFF" />
              <Text style={styles.addBtnText}>添加</Text>
            </Pressable>
          </View>
          <Text style={styles.sectionHint}>管理多个API配置，每个Agent可独立选择</Text>

          {apis.map(api => (
            <Pressable key={api.id} style={styles.apiCard} onPress={() => handleEditApi(api)}>
              <View style={styles.apiIcon}>
                <Feather name="key" size={18} color="#111111" />
              </View>
              <View style={styles.apiInfo}>
                <Text style={styles.apiName}>{api.name}</Text>
                <Text style={styles.apiProvider}>{api.provider} · {api.apiKey.slice(0, 10)}...</Text>
              </View>
              <Pressable onPress={() => handleDeleteApi(api)} hitSlop={10}>
                <Feather name="trash-2" size={16} color="#DC2626" />
              </Pressable>
            </Pressable>
          ))}

          {apis.length === 0 && (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyText}>暂无API配置</Text>
              <Text style={styles.emptyHint}>点击上方按钮添加</Text>
            </View>
          )}
        </View>

        {/* Agent管理 */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Agent 管理</Text>
            <Pressable style={styles.addBtn} onPress={handleAddAgent}>
              <Feather name="plus" size={16} color="#FFFFFF" />
              <Text style={styles.addBtnText}>添加</Text>
            </Pressable>
          </View>
          {/* 按 order 排序显示 */}
          {agents.sort((a, b) => a.order - b.order).map(agent => (
            <Pressable key={agent.id} style={styles.agentCard} onPress={() => handleViewAgentDetail(agent)} onLongPress={() => handleShowMoveDialog(agent)}>
              <View style={styles.agentMain}>
                <View style={styles.agentIcon}>
                  <Feather name={getAgentIcon(agent.icon) as any} size={18} color="#111111" />
                </View>
                <View style={styles.agentInfo}>
                  <View style={styles.agentHeader}>
                    <Text style={styles.agentName}>{agent.name}</Text>
                    <View style={[styles.statusDot, agent.enabled && styles.statusDotActive]} />
                  </View>
                  <Text style={styles.agentRole}>{agent.role} · {getApiName(agent.apiId)}</Text>
                </View>
              </View>
              <View style={styles.agentActions}>
                <Pressable 
                  style={styles.moreBtn} 
                  onPress={(e) => { e.stopPropagation(); setActionMenuAgent(agent); setActionMenuModalVisible(true); }}
                >
                  <Feather name="more-vertical" size={20} color="#888888" />
                </Pressable>
              </View>
            </Pressable>
          ))}
        </View>

        {/* 写作规则 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>写作铁律</Text>
          <View style={styles.rulesCard}>
            <View style={styles.ruleItem}>
              <Feather name="x-circle" size={16} color="#DC2626" />
              <Text style={styles.ruleText}>禁用破折号、分号</Text>
            </View>
            <View style={styles.ruleItem}>
              <Feather name="x-circle" size={16} color="#DC2626" />
              <Text style={styles.ruleText}>外貌描写不超过20字</Text>
            </View>
            <View style={styles.ruleItem}>
              <Feather name="x-circle" size={16} color="#DC2626" />
              <Text style={styles.ruleText}>连续对话必须有动作描写</Text>
            </View>
            <View style={styles.ruleItem}>
              <Feather name="x-circle" size={16} color="#DC2626" />
              <Text style={styles.ruleText}>心理活动写身体反应</Text>
            </View>
            <View style={styles.ruleItem}>
              <Feather name="x-circle" size={16} color="#DC2626" />
              <Text style={styles.ruleText}>禁用「感到」「觉得」「意识到」</Text>
            </View>
            <View style={styles.ruleItem}>
              <Feather name="x-circle" size={16} color="#DC2626" />
              <Text style={styles.ruleText}>打斗描写不超过200字</Text>
            </View>
          </View>
        </View>

        <View style={styles.bottomSpacer} />
      </ScrollView>

      {/* API配置弹窗 */}
      <Modal visible={apiModalVisible} transparent animationType="fade">
        <Pressable style={styles.modalOverlay} onPress={() => setApiModalVisible(false)}>
          <Pressable style={styles.modalContent} onPress={e => e.stopPropagation()}>
            <Text style={styles.modalTitle}>{editingApi ? '编辑 API' : '添加 API'}</Text>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>API 名称 *</Text>
              <TextInput
                style={styles.input}
                value={apiName}
                onChangeText={setApiName}
                placeholder="如：DeepSeek"
                placeholderTextColor="#CCCCCC"
              />
            </View>

            {/* Provider 选择 */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Provider *</Text>
              <View style={styles.providerGroup}>
                {['openai', 'deepseek', 'kimi', 'siliconflow', 'custom'].map((p) => (
                  <Pressable
                    key={p}
                    style={[styles.providerBtn, apiProvider === p && styles.providerBtnActive]}
                    onPress={() => {
                      setApiProvider(p);
                      // 根据Provider自动填充Base URL和Model
                      if (p === 'deepseek') {
                        setApiBaseUrl('https://api.deepseek.com');
                        setApiModel('deepseek-chat');
                      } else if (p === 'openai') {
                        setApiBaseUrl('https://api.openai.com/v1');
                        setApiModel('gpt-4o-mini');
                      } else if (p === 'kimi') {
                        setApiBaseUrl('https://api.moonshot.cn/v1');
                        setApiModel('moonshot-v1-8k');
                      } else if (p === 'siliconflow') {
                        setApiBaseUrl('https://api.siliconflow.cn/v1');
                        setApiModel('Qwen/Qwen2.5-7B-Instruct');
                      }
                    }}
                  >
                    <Text style={[styles.providerBtnText, apiProvider === p && styles.providerBtnTextActive]}>
                      {p === 'openai' ? 'OpenAI' : p === 'deepseek' ? 'DeepSeek' : p === 'kimi' ? 'Kimi' : p === 'siliconflow' ? '硅基流动' : '自定义'}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            {/* Base URL 输入 */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Base URL</Text>
              <TextInput
                style={styles.input}
                value={apiBaseUrl}
                onChangeText={setApiBaseUrl}
                placeholder={apiProvider === 'deepseek' ? 'https://api.deepseek.com' : 'https://api.openai.com/v1'}
                placeholderTextColor="#CCCCCC"
              />
            </View>

            {/* Model 输入 */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>模型名称 *</Text>
              <TextInput
                style={styles.input}
                value={apiModel}
                onChangeText={setApiModel}
                placeholder={apiProvider === 'deepseek' ? 'deepseek-chat' : apiProvider === 'openai' ? 'gpt-4o-mini' : '请输入模型名称'}
                placeholderTextColor="#CCCCCC"
              />
              <Text style={styles.inputHint}>
                {apiProvider === 'deepseek' && '推荐: deepseek-chat'}
                {apiProvider === 'openai' && '推荐: gpt-4o-mini'}
                {apiProvider === 'kimi' && '推荐: moonshot-v1-8k'}
                {apiProvider === 'siliconflow' && '推荐: Qwen/Qwen2.5-7B-Instruct'}
              </Text>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>API Key *</Text>
              <View style={styles.apiKeyWrapper}>
                <TextInput
                  style={[styles.input, styles.apiKeyInput]}
                  value={apiKeyInput}
                  onChangeText={setApiKeyInput}
                  placeholder="请输入 API Key"
                  placeholderTextColor="#CCCCCC"
                  secureTextEntry={!showApiKey}
                />
                <Pressable style={styles.eyeBtn} onPress={() => setShowApiKey(!showApiKey)}>
                  <Feather name={showApiKey ? 'eye-off' : 'eye'} size={20} color="#888888" />
                </Pressable>
              </View>
            </View>

            {/* 测试结果提示 */}
            {apiTestResult && (
              <View style={[styles.testResult, apiTestResult.success ? styles.testSuccess : styles.testError]}>
                <Text style={[styles.testResultText, apiTestResult.success ? styles.testSuccessText : styles.testErrorText]}>
                  {apiTestResult.success ? '✓ ' : '✗ '}{apiTestResult.message}
                </Text>
              </View>
            )}

            <View style={styles.modalActions}>
              <Pressable style={styles.testBtn} onPress={handleTestApi} disabled={isTestingApi}>
                <Text style={styles.testBtnText}>{isTestingApi ? '测试中...' : '测试连接'}</Text>
              </Pressable>
              <Pressable style={styles.cancelBtn} onPress={() => setApiModalVisible(false)}>
                <Text style={styles.cancelBtnText}>取消</Text>
              </Pressable>
              <Pressable style={styles.saveBtn} onPress={handleSaveApi}>
                <Text style={styles.saveBtnText}>保存</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Agent配置弹窗 */}
      <Modal visible={agentModalVisible} transparent animationType="fade">
        <Pressable style={styles.modalOverlay} onPress={() => setAgentModalVisible(false)}>
          <Pressable style={styles.modalContent} onPress={e => e.stopPropagation()}>
            <Text style={styles.modalTitle}>{editingAgent ? '编辑 Agent' : '添加 Agent'}</Text>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Agent 名称 *</Text>
              <TextInput
                style={styles.input}
                value={agentName}
                onChangeText={setAgentName}
                placeholder="请输入 Agent 名称"
                placeholderTextColor="#CCCCCC"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>规则描述 *</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={agentPrompt}
                onChangeText={setAgentPrompt}
                placeholder="请输入 Agent 的职责和写作规则..."
                placeholderTextColor="#CCCCCC"
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>关联 API *</Text>
              <View style={styles.apiSelector}>
                {apis.map(api => (
                  <Pressable
                    key={api.id}
                    style={[styles.apiOption, selectedApiId === api.id && styles.apiOptionSelected]}
                    onPress={() => setSelectedApiId(api.id)}
                  >
                    <Text style={[styles.apiOptionText, selectedApiId === api.id && styles.apiOptionTextSelected]}>
                      {api.name}
                    </Text>
                    {selectedApiId === api.id && <Feather name="check" size={16} color="#FFFFFF" />}
                  </Pressable>
                ))}
              </View>
              {apis.length === 0 && (
                <Text style={styles.noApiHint}>暂无API配置，请先在「API配置」中添加</Text>
              )}
            </View>

            <View style={styles.modalActions}>
              <Pressable style={styles.cancelBtn} onPress={() => setAgentModalVisible(false)}>
                <Text style={styles.cancelBtnText}>取消</Text>
              </Pressable>
              <Pressable style={styles.saveBtn} onPress={handleSaveAgent}>
                <Text style={styles.saveBtnText}>保存</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Agent详情弹窗 */}
      <Modal visible={detailModalVisible} transparent animationType="fade">
        <Pressable style={styles.modalOverlay} onPress={() => setDetailModalVisible(false)}>
          <Pressable style={[styles.modalContent, styles.detailModalContent]} onPress={e => e.stopPropagation()}>
            <View style={styles.detailHeader}>
              <Text style={styles.detailTitle}>{detailAgent?.name}</Text>
              <Pressable onPress={() => setDetailModalVisible(false)}>
                <Feather name="x" size={24} color="#888888" />
              </Pressable>
            </View>
            <View style={styles.detailInfo}>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>角色类型：</Text>
                <Text style={styles.detailValue}>{detailAgent?.role}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>状态：</Text>
                <Text style={[styles.detailValue, detailAgent?.enabled ? styles.textGreen : styles.textRed]}>
                  {detailAgent?.enabled ? '已启用' : '已禁用'}
                </Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>关联API：</Text>
                <Text style={styles.detailValue}>{getApiName(detailAgent?.apiId || null)}</Text>
              </View>
            </View>
            <View style={styles.detailDivider} />
            <Text style={styles.detailSectionTitle}>规则详情</Text>
            <ScrollView style={styles.detailScroll} showsVerticalScrollIndicator={false}>
              <Text style={styles.detailRules}>{detailAgent?.prompt}</Text>
            </ScrollView>
            <Pressable style={styles.detailCloseBtn} onPress={() => setDetailModalVisible(false)}>
              <Text style={styles.detailCloseText}>关闭</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      {/* 移动位置选择对话框 */}
      <Modal visible={moveModalVisible} transparent animationType="fade">
        <Pressable style={styles.modalOverlay} onPress={() => setMoveModalVisible(false)}>
          <Pressable style={styles.moveModalContent} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.moveModalTitle}>移动到第几位</Text>
            <Text style={styles.moveModalSubtitle}>当前：第 {selectedAgentForMove?.order} 位</Text>
            <View style={styles.moveGrid}>
              {[...agents].sort((a, b) => a.order - b.order).map((agent, index) => (
                agent.enabled && (
                  <Pressable
                    key={agent.id}
                    style={[
                      styles.moveItem,
                      agent.order === selectedAgentForMove?.order && styles.moveItemActive,
                    ]}
                    onPress={() => handleMoveToOrder(agent.order)}
                  >
                    <Text style={[
                      styles.moveItemText,
                      agent.order === selectedAgentForMove?.order && styles.moveItemTextActive,
                    ]}>
                      {index + 1}
                    </Text>
                  </Pressable>
                )
              ))}
            </View>
            <Pressable style={styles.moveCancelBtn} onPress={() => setMoveModalVisible(false)}>
              <Text style={styles.moveCancelText}>取消</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      {/* 操作菜单 */}
      <Modal visible={actionMenuModalVisible} transparent animationType="fade" onRequestClose={() => setActionMenuModalVisible(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setActionMenuModalVisible(false)}>
          <Pressable style={styles.actionMenuModal} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.actionMenuTitle}>{actionMenuAgent?.name}</Text>
            <Pressable style={styles.actionMenuItem} onPress={() => { setActionMenuModalVisible(false); handleShowMoveDialog(actionMenuAgent!); }}>
              <Feather name="move" size={18} color="#333333" />
              <Text style={styles.actionMenuText}>调整顺序</Text>
            </Pressable>
            <Pressable style={styles.actionMenuItem} onPress={() => { setActionMenuModalVisible(false); handleToggleAgent(actionMenuAgent!.id); }}>
              <Feather name={actionMenuAgent?.enabled ? "pause-circle" : "play-circle"} size={18} color="#333333" />
              <Text style={styles.actionMenuText}>{actionMenuAgent?.enabled ? '禁用' : '启用'}</Text>
            </Pressable>
            <Pressable style={styles.actionMenuItem} onPress={() => { setActionMenuModalVisible(false); handleEditAgent(actionMenuAgent!); }}>
              <Feather name="edit-2" size={18} color="#333333" />
              <Text style={styles.actionMenuText}>编辑</Text>
            </Pressable>
            <View style={styles.actionMenuDivider} />
            <Pressable style={styles.actionMenuItem} onPress={() => { setActionMenuModalVisible(false); handleDeleteAgent(actionMenuAgent!); }}>
              <Feather name="trash-2" size={18} color="#DC2626" />
              <Text style={[styles.actionMenuText, {color: '#DC2626'}]}>删除</Text>
            </Pressable>
            <View style={styles.actionMenuDivider} />
            <Pressable style={styles.actionMenuCancel} onPress={() => setActionMenuModalVisible(false)}>
              <Text style={styles.actionMenuCancelText}>取消</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
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
  section: {
    marginBottom: 32,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#888888',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  sectionHint: {
    fontSize: 13,
    color: '#CCCCCC',
    marginBottom: 16,
    marginTop: -8,
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#111111',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
  },
  addBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  apiCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#ECECEC',
    padding: 14,
    marginBottom: 10,
  },
  apiIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F7F7F7',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  apiInfo: {
    flex: 1,
  },
  apiName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111111',
    marginBottom: 2,
  },
  apiProvider: {
    fontSize: 12,
    color: '#888888',
  },
  emptyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#ECECEC',
    padding: 24,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: '#111111',
    marginBottom: 4,
  },
  emptyHint: {
    fontSize: 12,
    color: '#888888',
  },
  agentCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#ECECEC',
    padding: 14,
    marginBottom: 10,
    overflow: 'visible',
  },
  agentMain: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  agentIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F7F7F7',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  agentInfo: {
    flex: 1,
  },
  agentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  agentName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111111',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#CCCCCC',
  },
  statusDotActive: {
    backgroundColor: '#059669',
  },
  agentRole: {
    fontSize: 12,
    color: '#888888',
  },
  agentActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  moreBtn: {
    padding: 4,
  },
  actionMenu: {
    position: 'absolute',
    right: 8,
    top: 50,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E5E5',
    paddingVertical: 8,
    paddingHorizontal: 12,
    zIndex: 9999,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 20,
    minWidth: 120,
  },
  orderBtn: {
    padding: 6,
    backgroundColor: '#F7F7F7',
    borderRadius: 6,
  },
  orderBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666666',
  },
  actionBtn: {
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  toggleText: {
    fontSize: 12,
    color: '#888888',
    fontWeight: '600',
  },
  toggleTextActive: {
    color: '#059669',
  },
  rulesCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#ECECEC',
    padding: 16,
  },
  ruleItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
  },
  ruleText: {
    fontSize: 14,
    color: '#111111',
  },
  bottomSpacer: {
    height: 100,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionMenuModal: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingVertical: 8,
    paddingHorizontal: 16,
    minWidth: 200,
    maxWidth: 280,
  },
  actionMenuTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111111',
    textAlign: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#EEEEEE',
    marginBottom: 8,
  },
  actionMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    gap: 14,
  },
  actionMenuText: {
    fontSize: 15,
    color: '#333333',
  },
  actionMenuDivider: {
    height: 1,
    backgroundColor: '#EEEEEE',
    marginVertical: 4,
  },
  actionMenuCancel: {
    alignItems: 'center',
    paddingVertical: 14,
    marginTop: 4,
  },
  actionMenuCancelText: {
    fontSize: 15,
    color: '#888888',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    width: '90%',
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111111',
    marginBottom: 24,
    textAlign: 'center',
  },
  inputGroup: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#888888',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  input: {
    backgroundColor: '#F7F7F7',
    borderRadius: 12,
    padding: 16,
    fontSize: 15,
    color: '#111111',
  },
  textArea: {
    minHeight: 80,
    paddingTop: 16,
  },
  apiKeyWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  apiKeyInput: {
    flex: 1,
    borderTopRightRadius: 0,
    borderBottomRightRadius: 0,
  },
  eyeBtn: {
    backgroundColor: '#E5E5E5',
    padding: 16,
    borderTopRightRadius: 12,
    borderBottomRightRadius: 12,
  },
  apiSelector: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  apiOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 16,
    backgroundColor: '#F7F7F7',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#ECECEC',
  },
  apiOptionSelected: {
    backgroundColor: '#111111',
    borderColor: '#111111',
  },
  apiOptionText: {
    fontSize: 14,
    color: '#111111',
    fontWeight: '500',
  },
  apiOptionTextSelected: {
    color: '#FFFFFF',
  },
  noApiHint: {
    fontSize: 13,
    color: '#DC2626',
    marginTop: 8,
  },
  testResult: {
    marginTop: 12,
    padding: 12,
    borderRadius: 8,
  },
  testSuccess: {
    backgroundColor: '#D1FAE5',
  },
  testError: {
    backgroundColor: '#FEE2E2',
  },
  testResultText: {
    fontSize: 14,
  },
  testSuccessText: {
    color: '#065F46',
  },
  testErrorText: {
    color: '#991B1B',
  },
  testBtn: {
    flex: 1,
    backgroundColor: '#3B82F6',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  testBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  cancelBtn: {
    flex: 1,
    backgroundColor: '#F7F7F7',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  cancelBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111111',
  },
  saveBtn: {
    flex: 1,
    backgroundColor: '#111111',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  saveBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  // Agent详情弹窗样式
  detailModalContent: {
    maxHeight: '80%',
    padding: 24,
  },
  detailHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  detailTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111111',
  },
  detailInfo: {
    backgroundColor: '#F7F7F7',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  detailRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  detailLabel: {
    fontSize: 14,
    color: '#888888',
  },
  detailValue: {
    fontSize: 14,
    color: '#111111',
    fontWeight: '500',
  },
  textGreen: {
    color: '#059669',
  },
  textRed: {
    color: '#DC2626',
  },
  detailDivider: {
    height: 1,
    backgroundColor: '#ECECEC',
    marginBottom: 16,
  },
  detailSectionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111111',
    marginBottom: 12,
  },
  detailScroll: {
    maxHeight: 300,
  },
  detailRules: {
    fontSize: 14,
    color: '#444444',
    lineHeight: 22,
  },
  detailCloseBtn: {
    backgroundColor: '#111111',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 16,
  },
  detailCloseText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  // 移动位置对话框
  moveModalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    width: '80%',
    maxWidth: 320,
  },
  moveModalTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#111111',
    textAlign: 'center',
    marginBottom: 8,
  },
  moveModalSubtitle: {
    fontSize: 13,
    color: '#888888',
    textAlign: 'center',
    marginBottom: 16,
  },
  moveGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 10,
  },
  moveItem: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#FFFFFF', // 白色背景
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#D1D5DB', // 灰色细边框
    margin: 4,
  },
  moveItemActive: {
    backgroundColor: '#F3F4F6', // 浅灰色背景
    borderColor: '#9CA3AF', // 深灰边框
  },
  moveItemText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#374151', // 深灰色数字
  },
  moveItemTextActive: {
    color: '#111827',
  },
  moveCancelBtn: {
    marginTop: 16,
    paddingVertical: 12,
    alignItems: 'center',
  },
  providerGroup: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  providerBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  providerBtnActive: {
    backgroundColor: '#111827',
    borderColor: '#111827',
  },
  providerBtnText: {
    fontSize: 13,
    color: '#666666',
  },
  providerBtnTextActive: {
    fontSize: 13,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  inputHint: {
    fontSize: 12,
    color: '#888888',
    marginTop: 4,
    marginBottom: 8,
  },
  moveCancelText: {
    fontSize: 15,
    color: '#888888',
  },
});
