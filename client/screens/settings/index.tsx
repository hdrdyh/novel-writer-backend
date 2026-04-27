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
  Switch,
  Linking,
} from 'react-native';
import { Screen } from '@/components/Screen';
import { Feather } from '@expo/vector-icons';
import { useSafeRouter } from '@/hooks/useSafeRouter';

interface Agent {
  id: string;
  name: string;
  role: string;
  prompt: string;
  enabled: boolean;
  icon: string;
}

export default function SettingsScreen() {
  const router = useSafeRouter();
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

  const [agentModalVisible, setAgentModalVisible] = useState(false);
  const [editingAgent, setEditingAgent] = useState<Agent | null>(null);
  const [agentName, setAgentName] = useState('');
  const [agentPrompt, setAgentPrompt] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);

  const handleEditAgent = (agent: Agent) => {
    setEditingAgent(agent);
    setAgentName(agent.name);
    setAgentPrompt(agent.prompt);
    setAgentModalVisible(true);
  };

  const handleSaveAgent = () => {
    if (!agentName.trim() || !agentPrompt.trim()) {
      Alert.alert('提示', '请填写名称和规则描述');
      return;
    }

    if (editingAgent) {
      setAgents(prev =>
        prev.map(a =>
          a.id === editingAgent.id
            ? { ...a, name: agentName.trim(), prompt: agentPrompt.trim() }
            : a
        )
      );
    }
    setAgentModalVisible(false);
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
    Alert.alert('保存成功', 'API Key 已保存');
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
        {/* API 配置 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>API 配置</Text>
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardLabel}>API Key</Text>
              <Pressable onPress={() => setShowApiKey(!showApiKey)}>
                <Feather
                  name={showApiKey ? 'eye-off' : 'eye'}
                  size={18}
                  color="#888888"
                />
              </Pressable>
            </View>
            <TextInput
              style={styles.input}
              value={apiKey}
              onChangeText={setApiKey}
              placeholder="输入 API Key"
              placeholderTextColor="#CCCCCC"
              secureTextEntry={!showApiKey}
            />
            <Pressable style={styles.saveKeyBtn} onPress={handleSaveApiKey}>
              <Text style={styles.saveKeyText}>保存 Key</Text>
            </Pressable>
          </View>
        </View>

        {/* Agent 管理 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Agent 管理</Text>
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
                <Text style={styles.agentName}>{agent.name}</Text>
                <Text style={styles.agentRole}>{agent.role}</Text>
              </View>
              <View style={styles.agentActions}>
                <Switch
                  value={agent.enabled}
                  onValueChange={() => handleToggleAgent(agent.id)}
                  trackColor={{ false: '#E5E5E5', true: '#111111' }}
                  thumbColor="#FFFFFF"
                />
                <Pressable
                  style={styles.editBtn}
                  onPress={() => handleEditAgent(agent)}
                >
                  <Feather name="edit-2" size={16} color="#888888" />
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

        {/* 关于 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>关于</Text>
          <View style={styles.aboutCard}>
            <View style={styles.aboutItem}>
              <Text style={styles.aboutLabel}>版本</Text>
              <Text style={styles.aboutValue}>1.0.0</Text>
            </View>
            <View style={styles.divider} />
            <Pressable style={styles.aboutItem}>
              <Text style={styles.aboutLabel}>使用帮助</Text>
              <Feather name="chevron-right" size={18} color="#CCCCCC" />
            </Pressable>
            <View style={styles.divider} />
            <Pressable style={styles.aboutItem}>
              <Text style={styles.aboutLabel}>隐私政策</Text>
              <Feather name="chevron-right" size={18} color="#CCCCCC" />
            </Pressable>
          </View>
        </View>

        <View style={styles.bottomSpacer} />
      </ScrollView>

      {/* 编辑 Agent 弹窗 */}
      <Modal visible={agentModalVisible} transparent animationType="fade">
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setAgentModalVisible(false)}
        >
          <Pressable style={styles.modalContent} onPress={e => e.stopPropagation()}>
            <Text style={styles.modalTitle}>编辑 Agent</Text>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Agent 名称</Text>
              <TextInput
                style={styles.input}
                value={agentName}
                onChangeText={setAgentName}
                placeholder="如：世界观架构师"
                placeholderTextColor="#CCCCCC"
              />
            </View>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>规则描述</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={agentPrompt}
                onChangeText={setAgentPrompt}
                placeholder="描述这个 Agent 的职责和写作规则..."
                placeholderTextColor="#CCCCCC"
                multiline
                numberOfLines={6}
                textAlignVertical="top"
              />
            </View>
            <View style={styles.modalActions}>
              <Pressable
                style={styles.cancelBtn}
                onPress={() => setAgentModalVisible(false)}
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
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#ECECEC',
    padding: 20,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  cardLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111111',
  },
  input: {
    backgroundColor: '#F7F7F7',
    borderRadius: 12,
    padding: 16,
    fontSize: 15,
    color: '#111111',
  },
  saveKeyBtn: {
    backgroundColor: '#111111',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 12,
  },
  saveKeyText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  agentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#ECECEC',
    padding: 16,
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
  agentName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111111',
    marginBottom: 2,
  },
  agentRole: {
    fontSize: 12,
    color: '#888888',
    textTransform: 'uppercase',
  },
  agentActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  editBtn: {
    padding: 4,
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
  aboutCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#ECECEC',
    padding: 4,
  },
  aboutItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  aboutLabel: {
    fontSize: 15,
    color: '#111111',
  },
  aboutValue: {
    fontSize: 15,
    color: '#888888',
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#ECECEC',
    marginHorizontal: 16,
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
  textArea: {
    minHeight: 120,
    paddingTop: 16,
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
