import { useState } from 'react';
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
}

export default function SettingsScreen() {
  // API配置列表
  const [apis, setApis] = useState<APIConfig[]>([
    { id: '1', name: 'DeepSeek', provider: 'deepseek', apiKey: 'sk-xxx...xxx' },
    { id: '2', name: 'Kimi', provider: 'kimi', apiKey: 'sk-xxx...xxx' },
  ]);

  // Agent列表
  const [agents, setAgents] = useState<Agent[]>([
    { id: '1', name: '世界观架构师', role: 'system', prompt: '负责设计故事背景、世界观设定、历史文明、地理环境等宏观架构。', enabled: true, icon: 'globe', apiId: '1' },
    { id: '2', name: '人物设定师', role: 'character', prompt: '负责塑造角色性格、外貌特征、行为动机、技能设定与成长轨迹。', enabled: true, icon: 'user', apiId: '1' },
    { id: '3', name: '情节设计师', role: 'plot', prompt: '负责规划故事线、高潮转折、冲突设置与悬念埋设。', enabled: true, icon: 'git-branch', apiId: '2' },
    { id: '4', name: '文笔润色师', role: 'style', prompt: '负责优化文字描写、对话风格、环境渲染与情感表达。', enabled: false, icon: 'edit', apiId: '2' },
    { id: '5', name: '审核校对师', role: 'review', prompt: '负责检查逻辑漏洞、错别字、角色一致性与违规内容。', enabled: true, icon: 'check-circle', apiId: '1' },
  ]);

  // 弹窗状态
  const [apiModalVisible, setApiModalVisible] = useState(false);
  const [editingApi, setEditingApi] = useState<APIConfig | null>(null);
  const [apiName, setApiName] = useState('');
  const [apiProvider, setApiProvider] = useState('');
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);

  const [agentModalVisible, setAgentModalVisible] = useState(false);
  const [editingAgent, setEditingAgent] = useState<Agent | null>(null);
  const [agentName, setAgentName] = useState('');
  const [agentPrompt, setAgentPrompt] = useState('');
  const [selectedApiId, setSelectedApiId] = useState<string | null>(null);

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

  const handleSaveApi = () => {
    if (!apiName.trim()) {
      Alert.alert('提示', '请输入 API 名称');
      return;
    }
    if (!apiProvider.trim()) {
      Alert.alert('提示', '请输入 API Provider（如 deepseek、kimi）');
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
      const newAgent: Agent = {
        id: Date.now().toString(),
        name: agentName.trim(),
        role: 'custom',
        prompt: agentPrompt.trim(),
        enabled: true,
        icon: 'user',
        apiId: selectedApiId,
      };
      setAgents(prev => [...prev, newAgent]);
      Alert.alert('成功', 'Agent 已添加');
    }
    setAgentModalVisible(false);
  };

  const handleDeleteAgent = (agent: Agent) => {
    Alert.alert('删除确认', `确定要删除「${agent.name}」吗？`, [
      { text: '取消', style: 'cancel' },
      {
        text: '删除',
        style: 'destructive',
        onPress: () => {
          setAgents(prev => prev.filter(a => a.id !== agent.id));
          Alert.alert('成功', 'Agent 已删除');
        },
      },
    ]);
  };

  const handleToggleAgent = (id: string) => {
    setAgents(prev =>
      prev.map(a => (a.id === id ? { ...a, enabled: !a.enabled } : a))
    );
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
          <Text style={styles.sectionHint}>每个Agent独立选择API</Text>

          {agents.map(agent => (
            <View key={agent.id} style={styles.agentCard}>
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
                <Pressable style={styles.actionBtn} onPress={() => handleToggleAgent(agent.id)}>
                  <Text style={[styles.toggleText, agent.enabled && styles.toggleTextActive]}>
                    {agent.enabled ? '启用' : '禁用'}
                  </Text>
                </Pressable>
                <Pressable style={styles.actionBtn} onPress={() => handleEditAgent(agent)}>
                  <Feather name="edit-2" size={16} color="#888888" />
                </Pressable>
                <Pressable style={styles.actionBtn} onPress={() => handleDeleteAgent(agent)}>
                  <Feather name="trash-2" size={16} color="#DC2626" />
                </Pressable>
              </View>
            </View>
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

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Provider *</Text>
              <TextInput
                style={styles.input}
                value={apiProvider}
                onChangeText={setApiProvider}
                placeholder="如：deepseek"
                placeholderTextColor="#CCCCCC"
              />
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

            <View style={styles.modalActions}>
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
    gap: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#ECECEC',
    paddingTop: 12,
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
});
