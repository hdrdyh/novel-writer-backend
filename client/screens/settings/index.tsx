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

interface Agent {
  id: string;
  name: string;
  role: string;
  prompt: string;
  enabled: boolean;
  icon: string;
}

export default function SettingsScreen() {
  const [agents, setAgents] = useState<Agent[]>([
    {
      id: '1',
      name: '世界观架构师',
      role: 'system',
      prompt: '负责设计故事背景、世界观设定、历史文明、地理环境等宏观架构。',
      enabled: true,
      icon: 'globe',
    },
    {
      id: '2',
      name: '人物设定师',
      role: 'character',
      prompt: '负责塑造角色性格、外貌特征、行为动机、技能设定与成长轨迹。',
      enabled: true,
      icon: 'user',
    },
    {
      id: '3',
      name: '情节设计师',
      role: 'plot',
      prompt: '负责规划故事线、高潮转折、冲突设置与悬念埋设。',
      enabled: true,
      icon: 'git-branch',
    },
    {
      id: '4',
      name: '文笔润色师',
      role: 'style',
      prompt: '负责优化文字描写、对话风格、环境渲染与情感表达。',
      enabled: false,
      icon: 'edit',
    },
    {
      id: '5',
      name: '审核校对师',
      role: 'review',
      prompt: '负责检查逻辑漏洞、错别字、角色一致性与违规内容。',
      enabled: true,
      icon: 'check-circle',
    },
  ]);

  const [modalVisible, setModalVisible] = useState(false);
  const [editingAgent, setEditingAgent] = useState<Agent | null>(null);
  const [agentName, setAgentName] = useState('');
  const [agentPrompt, setAgentPrompt] = useState('');
  const [apiKeyModalVisible, setApiKeyModalVisible] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);

  const handleAddAgent = () => {
    setEditingAgent(null);
    setAgentName('');
    setAgentPrompt('');
    setModalVisible(true);
  };

  const handleEditAgent = (agent: Agent) => {
    setEditingAgent(agent);
    setAgentName(agent.name);
    setAgentPrompt(agent.prompt);
    setModalVisible(true);
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

    if (editingAgent) {
      // 编辑现有Agent
      setAgents(prev =>
        prev.map(a =>
          a.id === editingAgent.id
            ? { ...a, name: agentName.trim(), prompt: agentPrompt.trim() }
            : a
        )
      );
      Alert.alert('成功', 'Agent 已更新');
    } else {
      // 新增Agent
      const newAgent: Agent = {
        id: Date.now().toString(),
        name: agentName.trim(),
        role: 'custom',
        prompt: agentPrompt.trim(),
        enabled: true,
        icon: 'user',
      };
      setAgents(prev => [...prev, newAgent]);
      Alert.alert('成功', 'Agent 已添加');
    }
    setModalVisible(false);
  };

  const handleDeleteAgent = (agent: Agent) => {
    Alert.alert(
      '删除确认',
      `确定要删除「${agent.name}」吗？`,
      [
        { text: '取消', style: 'cancel' },
        {
          text: '删除',
          style: 'destructive',
          onPress: () => {
            setAgents(prev => prev.filter(a => a.id !== agent.id));
            Alert.alert('成功', 'Agent 已删除');
          },
        },
      ]
    );
  };

  const handleToggleAgent = (id: string) => {
    setAgents(prev =>
      prev.map(a => (a.id === id ? { ...a, enabled: !a.enabled } : a))
    );
  };

  const handleSaveApiKey = () => {
    if (!apiKey.trim()) {
      Alert.alert('提示', '请输入 API Key');
      return;
    }
    // 保存到本地存储（实际项目中应该调用API保存）
    Alert.alert('成功', 'API Key 已保存');
    setApiKeyModalVisible(false);
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

  return (
    <Screen>
      <View style={styles.header}>
        <Text style={styles.greeting}>设置</Text>
        <Text style={styles.title}>配置中心</Text>
      </View>

      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        {/* API Key 配置 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>API 配置</Text>
          <Pressable style={styles.apiCard} onPress={() => setApiKeyModalVisible(true)}>
            <View style={styles.apiIcon}>
              <Feather name="key" size={20} color="#111111" />
            </View>
            <View style={styles.apiInfo}>
              <Text style={styles.apiTitle}>API Key</Text>
              <Text style={styles.apiHint}>点击配置 LLM API Key</Text>
            </View>
            <Feather name="chevron-right" size={20} color="#CCCCCC" />
          </Pressable>
        </View>

        {/* Agent 管理 */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Agent 管理</Text>
            <Pressable style={styles.addBtn} onPress={handleAddAgent}>
              <Feather name="plus" size={16} color="#FFFFFF" />
              <Text style={styles.addBtnText}>添加</Text>
            </Pressable>
          </View>
          <Text style={styles.sectionHint}>
            配置多个写作 Agent，每个 Agent 有不同的职责和规则
          </Text>

          {agents.map(agent => (
            <View key={agent.id} style={styles.agentCard}>
              <View style={styles.agentIcon}>
                <Feather
                  name={getAgentIcon(agent.icon) as any}
                  size={20}
                  color="#111111"
                />
              </View>
              <View style={styles.agentInfo}>
                <View style={styles.agentHeader}>
                  <Text style={styles.agentName}>{agent.name}</Text>
                  <View style={[styles.statusDot, agent.enabled && styles.statusDotActive]} />
                </View>
                <Text style={styles.agentRole}>{agent.role}</Text>
              </View>
              <View style={styles.agentActions}>
                <Pressable
                  style={styles.actionBtn}
                  onPress={() => handleToggleAgent(agent.id)}
                >
                  <Text style={[styles.toggleText, agent.enabled && styles.toggleTextActive]}>
                    {agent.enabled ? '启用' : '禁用'}
                  </Text>
                </Pressable>
                <Pressable
                  style={styles.actionBtn}
                  onPress={() => handleEditAgent(agent)}
                >
                  <Feather name="edit-2" size={16} color="#888888" />
                </Pressable>
                <Pressable
                  style={styles.actionBtn}
                  onPress={() => handleDeleteAgent(agent)}
                >
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

      {/* 添加/编辑 Agent 弹窗 */}
      <Modal visible={modalVisible} transparent animationType="fade">
        <Pressable style={styles.modalOverlay} onPress={() => setModalVisible(false)}>
          <Pressable style={styles.modalContent} onPress={e => e.stopPropagation()}>
            <Text style={styles.modalTitle}>
              {editingAgent ? '编辑 Agent' : '添加 Agent'}
            </Text>

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
                numberOfLines={5}
                textAlignVertical="top"
              />
            </View>

            <View style={styles.modalActions}>
              <Pressable
                style={styles.cancelBtn}
                onPress={() => setModalVisible(false)}
              >
                <Text style={styles.cancelBtnText}>取消</Text>
              </Pressable>
              <Pressable style={styles.saveBtn} onPress={handleSaveAgent}>
                <Text style={styles.saveBtnText}>保存</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* API Key 配置弹窗 */}
      <Modal visible={apiKeyModalVisible} transparent animationType="fade">
        <Pressable style={styles.modalOverlay} onPress={() => setApiKeyModalVisible(false)}>
          <Pressable style={styles.modalContent} onPress={e => e.stopPropagation()}>
            <Text style={styles.modalTitle}>配置 API Key</Text>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>API Key</Text>
              <View style={styles.apiKeyInputWrapper}>
                <TextInput
                  style={[styles.input, styles.apiKeyInput]}
                  value={apiKey}
                  onChangeText={setApiKey}
                  placeholder="请输入 API Key"
                  placeholderTextColor="#CCCCCC"
                  secureTextEntry={!showApiKey}
                />
                <Pressable
                  style={styles.eyeBtn}
                  onPress={() => setShowApiKey(!showApiKey)}
                >
                  <Feather
                    name={showApiKey ? 'eye-off' : 'eye'}
                    size={20}
                    color="#888888"
                  />
                </Pressable>
              </View>
            </View>

            <Text style={styles.apiHintText}>
              支持 DeepSeek、Kimi、OpenAI 等主流 LLM API
            </Text>

            <View style={styles.modalActions}>
              <Pressable
                style={styles.cancelBtn}
                onPress={() => setApiKeyModalVisible(false)}
              >
                <Text style={styles.cancelBtnText}>取消</Text>
              </Pressable>
              <Pressable style={styles.saveBtn} onPress={handleSaveApiKey}>
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
    marginBottom: 12,
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
    marginBottom: 12,
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
    padding: 16,
  },
  apiIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#F7F7F7',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  apiInfo: {
    flex: 1,
  },
  apiTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111111',
    marginBottom: 2,
  },
  apiHint: {
    fontSize: 13,
    color: '#888888',
  },
  agentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#ECECEC',
    padding: 14,
    marginBottom: 10,
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
    textTransform: 'uppercase',
  },
  agentActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  actionBtn: {
    padding: 8,
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
    width: '85%',
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
    minHeight: 100,
    paddingTop: 16,
  },
  apiKeyInputWrapper: {
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
  apiHintText: {
    fontSize: 12,
    color: '#888888',
    marginBottom: 20,
    textAlign: 'center',
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
