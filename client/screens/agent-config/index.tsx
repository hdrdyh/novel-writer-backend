import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
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
import { FontAwesome6 } from '@expo/vector-icons';
import { useSafeRouter } from '@/hooks/useSafeRouter';
import { useFocusEffect } from 'expo-router';
import { GC } from '@/utils/glassColors';
import { PRESET_AGENTS, PresetAgent } from '@/utils/presetAgents';
import { ApiConfig, AgentConfig, ReviewAgent, ReviewConfig, DEFAULT_REVIEW_AGENTS } from './types';
import { BUILTIN_TEMPLATES, parseTemplate, exportTemplate } from './agentTemplates';
import { s, m } from './agentConfigStyles';
import { ApiConfigModal, CollabAgentEditModal, ReviewAgentEditModal } from './AgentEditModals';

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

  // 测试规则
  const [testModalVisible, setTestModalVisible] = useState(false);
  const [testAgent, setTestAgent] = useState<PresetAgent | null>(null);
  const [testRuleRead, setTestRuleRead] = useState('');
  const [testLlmResult, setTestLlmResult] = useState('');
  const [testLoading, setTestLoading] = useState(false);

  // 全局铁律
  const [globalIronRules, setGlobalIronRules] = useState('');
  const [ironRulesEditing, setIronRulesEditing] = useState(false);
  const [ironRulesDraft, setIronRulesDraft] = useState('');

  // 导入模板
  const [importModalVisible, setImportModalVisible] = useState(false);
  const [importText, setImportText] = useState('');
  const [importError, setImportError] = useState('');

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

  const loadGlobalIronRules = useCallback(async () => {
    try {
      const data = await AsyncStorage.getItem('globalIronRules');
      if (data) setGlobalIronRules(data);
    } catch (_e) {}
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadApiConfigs();
      loadAgentConfigs();
      loadReviewAgents();
      loadReviewConfig();
      loadGlobalIronRules();
    }, [loadApiConfigs, loadAgentConfigs, loadReviewAgents, loadReviewConfig, loadGlobalIronRules])
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

  const saveGlobalIronRules = async (text: string) => {
    setGlobalIronRules(text);
    await AsyncStorage.setItem('globalIronRules', text);
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
    if (preset?.category === 'core') return;
    const next = agentConfigs.map((a) =>
      a.presetId === presetId ? { ...a, enabled: !a.enabled } : a
    );
    saveAgentConfigs(next);
  };

  const handleResetAgentConfigs = () => {
    Alert.alert('确认', '确定重置所有协作助手为默认配置吗？', [
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
            { role: 'system', content: '你是小说写作AI助手，负责推荐最佳助手协作方案。' },
            { role: 'user', content: `我正在写一部小说，有以下可用助手：\n${PRESET_AGENTS.map((p) => `- ${p.name}: ${p.description}`).join('\n')}\n\n请根据小说创作的最佳实践，推荐哪些助手应该启用、哪些可以关闭。格式要求：每行一个助手，格式为"启用/关闭 助手名: 理由"。限200字以内。` },
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
    const next = agentConfigs.map((a) => {
      const preset = PRESET_AGENTS.find((p) => p.id === a.presetId);
      if (!preset) return a;
      if (preset.category === 'core') return { ...a, enabled: true };
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
    Alert.alert('成功', '已根据AI建议调整助手配置');
  };

  // ============== 测试规则 ==============
  const handleTestAgent = useCallback(async (preset: PresetAgent) => {
    const savedConfig = agentConfigs.find(c => c.presetId === preset.id);
    const ruleText = savedConfig?.prompt?.trim() || preset.prompt?.trim() || '（未设置自定义规则）';

    setTestAgent(preset);
    setTestRuleRead(ruleText);
    setTestLlmResult('');
    setTestLoading(false);
    setTestModalVisible(true);

    try {
      setTestLoading(true);
      const apiData = await AsyncStorage.getItem('apiConfigs');
      const apis: ApiConfig[] = apiData ? JSON.parse(apiData) : [];
      const boundApiId = savedConfig?.apiId || '';
      const api = apis.find(a => a.id === boundApiId) || apis[0];

      if (!api?.apiKey || !api?.baseUrl) {
        setTestLlmResult('[!] 未配置API，无法测试LLM传递。但规则已读取成功（见上方）。');
        setTestLoading(false);
        return;
      }

      const userRule = ruleText !== '（未设置自定义规则）' ? `【你必须严格遵守以下规则】\n${ruleText}\n\n` : '';
      const systemMsg = `你是"${preset.name}"，你的职责是：${preset.role}`;
      const userMsg = `${userRule}请用你自己的话简述你当前的工作规则和风格要求，不要重复原文，用自己的理解表达。限100字以内。`;

      let baseUrl = api.baseUrl.trim();
      if (!baseUrl.includes('/v1') && !baseUrl.includes('/v2')) {
        baseUrl = baseUrl.replace(/\/+$/, '') + '/v1';
      }

      const response = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${api.apiKey}`,
        },
        body: JSON.stringify({
          model: api.model || 'doubao-seed-1-6-lite-251015',
          messages: [
            { role: 'system', content: systemMsg },
            { role: 'user', content: userMsg },
          ],
          max_tokens: 300,
          temperature: 0.7,
        }),
      });

      const result = JSON.parse(await response.text());
      const content = result?.choices?.[0]?.message?.content || '（LLM未返回内容）';
      setTestLlmResult(content);
    } catch (e: any) {
      setTestLlmResult(`[X] LLM调用失败：${e.message || '未知错误'}。规则读取正常（见上方）。`);
    } finally {
      setTestLoading(false);
    }
  }, [agentConfigs]);

  // ============== 模板导入导出 ==============
  const handleExportTemplate = (): string => {
    return exportTemplate(agentConfigs);
  };

  const handleImportTemplate = async () => {
    setImportError('');
    if (!importText.trim()) {
      setImportError('请粘贴模板内容');
      return;
    }

    const parsed = parseTemplate(importText);
    if (parsed.agents.length === 0) {
      setImportError('未识别到有效的助手配置。格式：=== 助手名 === 后跟启用/禁用和规则');
      return;
    }

    // 保存全局铁律
    if (parsed.globalRules) {
      await AsyncStorage.setItem('global_iron_rules', parsed.globalRules);
      setGlobalIronRules(parsed.globalRules);
    }

    const next = agentConfigs.map(a => {
      const match = parsed.agents.find(p => p.presetId === a.presetId);
      if (match) {
        return { ...a, name: match.name, prompt: match.prompt, enabled: match.enabled };
      }
      return a;
    });

    await saveAgentConfigs(next);
    setImportModalVisible(false);
    setImportText('');
    const globalMsg = parsed.globalRules ? '，已同步全局铁律' : '';
    Alert.alert('导入成功', `已更新 ${parsed.agents.length} 个助手的配置${globalMsg}`);
  };

  const doExportTemplate = () => {
    const template = handleExportTemplate();
    setImportText(template);
    setImportModalVisible(true);
    setImportError('');
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
    Alert.alert('确认', `确定删除评审助手 "${agent.name}" 吗？`, [
      { text: '取消', style: 'cancel' },
      { text: '删除', style: 'destructive', onPress: () => saveReviewAgents(reviewAgents.filter((a) => a.id !== agent.id)) },
    ]);
  };

  const handleToggleReviewAgent = (agent: ReviewAgent) => {
    const next = reviewAgents.map((a) => a.id === agent.id ? { ...a, enabled: !a.enabled } : a);
    saveReviewAgents(next);
  };

  const handleResetReviewAgents = () => {
    Alert.alert('确认', '确定重置评审团为默认吗？', [
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
          <View style={s.agentNameCol}>
            <Text style={[s.agentName, !config.enabled && s.textDisabled]}>{config.name}</Text>
            <Text style={s.agentDesc} numberOfLines={2}>{preset.description}</Text>
            <Text style={s.agentApi}>API: {getApiName(config.apiId)}</Text>
          </View>
        </TouchableOpacity>
        <View style={s.agentRightActions}>
          <TouchableOpacity
            style={s.testBtn}
            onPress={() => handleTestAgent(preset)}
            disabled={testLoading}
          >
            <FontAwesome6 name="flask" size={14} color={GC.accent} />
            <Text style={s.testBtnText}>测试</Text>
          </TouchableOpacity>
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
          <Text style={s.headerTitle}>助手配置</Text>
          <View style={{ width: 40 }} />
        </View>

        {/* Tab切换 */}
        <View style={s.tabBar}>
          {([
            { key: 'collab' as const, label: '协作助手' },
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
              <View style={s.templateBtnRow}>
                <TouchableOpacity style={s.smartMatchBtn} onPress={handleSmartMatch}>
                  <Ionicons name="sparkles" size={18} color="#7C5CFF" />
                  <Text style={s.smartMatchBtnText}>智能搭配</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.importBtn} onPress={() => { setImportText(''); setImportError(''); setImportModalVisible(true); }}>
                  <Ionicons name="download-outline" size={18} color={GC.accent} />
                  <Text style={s.importBtnText}>导入模板</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.exportBtn} onPress={doExportTemplate}>
                  <Ionicons name="share-outline" size={18} color={GC.textSecondary} />
                  <Text style={s.exportBtnText}>导出</Text>
                </TouchableOpacity>
              </View>

              {/* 全局铁律 */}
              <View style={s.ironRulesWrap}>
                <View style={s.ironRulesHeader}>
                  <FontAwesome6 name="shield-halved" size={16} color="#E5A00D" />
                  <Text style={s.ironRulesTitle}>全局铁律</Text>
                  <Text style={s.ironRulesHint}>自动追加到每个助手的规则前</Text>
                </View>
                {ironRulesEditing ? (
                  <View style={s.ironRulesEditWrap}>
                    <TextInput
                      style={s.ironRulesInput}
                      value={ironRulesDraft}
                      onChangeText={setIronRulesDraft}
                      placeholder="输入全局铁律，如：1.禁止破折号分号 2.去除AI味..."
                      placeholderTextColor={GC.textMuted}
                      multiline
                      numberOfLines={4}
                      autoFocus
                    />
                    <View style={s.ironRulesBtnRow}>
                      <TouchableOpacity style={s.ironRulesCancelBtn} onPress={() => setIronRulesEditing(false)}>
                        <Text style={s.ironRulesCancelText}>取消</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={s.ironRulesSaveBtn} onPress={async () => {
                        await saveGlobalIronRules(ironRulesDraft);
                        setIronRulesEditing(false);
                      }}>
                        <Text style={s.ironRulesSaveText}>保存</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ) : (
                  <TouchableOpacity style={s.ironRulesDisplay} onPress={() => { setIronRulesDraft(globalIronRules); setIronRulesEditing(true); }}>
                    {globalIronRules ? (
                      <Text style={s.ironRulesContent} numberOfLines={3}>{globalIronRules}</Text>
                    ) : (
                      <Text style={s.ironRulesEmpty}>点击设置全局铁律（所有助手共用）</Text>
                    )}
                    <FontAwesome6 name="pen" size={12} color={GC.textMuted} />
                  </TouchableOpacity>
                )}
              </View>

              <View style={s.categoryHeader}>
                <Text style={s.categoryTitle}>核心（不可禁用）</Text>
              </View>
              {coreAgents.map(renderAgentCard)}

              <View style={s.categoryHeader}>
                <Text style={s.categoryTitle}>推荐（默认启用）</Text>
              </View>
              {recommendedAgents.map(renderAgentCard)}

              <View style={s.categoryHeader}>
                <Text style={s.categoryTitle}>可选（默认关闭）</Text>
              </View>
              {optionalAgents.map(renderAgentCard)}

              <TouchableOpacity style={s.resetBtn} onPress={handleResetAgentConfigs}>
                <Text style={s.resetBtnText}>重置为默认</Text>
              </TouchableOpacity>
            </>
          )}

          {/* ====== 评审团 Tab ====== */}
          {activeTab === 'review' && (
            <>
              <View style={s.sectionHeader}>
                <Text style={s.sectionTitle}>评审团助手</Text>
              </View>
              <Text style={s.sectionDesc}>只有启用的评审助手会在AI评审时参与讨论</Text>

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
                <Text style={s.addBtnText}>添加评审助手</Text>
              </TouchableOpacity>

              <TouchableOpacity style={s.resetBtn} onPress={handleResetReviewAgents}>
                <Text style={s.resetBtnText}>重置为默认</Text>
              </TouchableOpacity>

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

        {/* 测试规则弹窗 */}
        <Modal visible={testModalVisible} transparent animationType="fade">
          <View style={s.testOverlay}>
            <View style={s.testModal}>
              <View style={s.testHeader}>
                <Text style={s.testTitle}>测试规则 — {testAgent?.name}</Text>
                <TouchableOpacity onPress={() => setTestModalVisible(false)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                  <Text style={s.testClose}>X</Text>
                </TouchableOpacity>
              </View>

              <ScrollView style={s.testBody} showsVerticalScrollIndicator={false}>
                <View style={s.testStepBox}>
                  <View style={s.testStepHeader}>
                    <View style={[s.testStepBadge, { backgroundColor: testRuleRead && testRuleRead !== '（未设置自定义规则）' ? GC.success : GC.disabled }]}>
                      <Text style={s.testStepBadgeText}>1</Text>
                    </View>
                    <Text style={s.testStepTitleText}>读取到的规则</Text>
                    {testRuleRead && testRuleRead !== '（未设置自定义规则）' && <Text style={s.testStepOk}>已读取</Text>}
                  </View>
                  {testRuleRead ? (
                    <View style={s.testRuleBox}>
                      <Text style={s.testRuleText}>{testRuleRead}</Text>
                    </View>
                  ) : (
                    <Text style={s.testNoRule}>未设置自定义规则（将使用默认行为）</Text>
                  )}
                </View>

                <View style={s.testStepBox}>
                  <View style={s.testStepHeader}>
                    <View style={[s.testStepBadge, { backgroundColor: testLlmResult && !testLlmResult.startsWith('[X]') && !testLlmResult.startsWith('[!]') ? GC.success : testLoading ? GC.warning : GC.disabled }]}>
                      <Text style={s.testStepBadgeText}>{testLlmResult && !testLlmResult.startsWith('[X]') && !testLlmResult.startsWith('[!]') ? 'V' : '2'}</Text>
                    </View>
                    <Text style={s.testStepTitleText}>助手复述</Text>
                    {testLoading && <ActivityIndicator size="small" color={GC.primary} />}
                    {testLlmResult && !testLlmResult.startsWith('[X]') && !testLlmResult.startsWith('[!]') && <Text style={s.testStepOk}>已验证</Text>}
                  </View>
                  {testLoading && !testLlmResult ? (
                    <Text style={s.testLoadingText}>正在调用助手，请稍候...</Text>
                  ) : testLlmResult ? (
                    <View style={s.testRuleBox}>
                      <Text style={s.testResultText}>{testLlmResult}</Text>
                    </View>
                  ) : null}
                </View>

                {testRuleRead && testRuleRead !== '（未设置自定义规则）' && testLlmResult && !testLlmResult.startsWith('[X]') && !testLlmResult.startsWith('[!]') && testLlmResult.length > 10 && (
                  <View style={s.testResultBox}>
                    <Text style={s.testResultTitle}>验证结论</Text>
                    <Text style={s.testResultPass}>规则已成功传递给助手，助手能正确理解并复述你的规则。</Text>
                  </View>
                )}
              </ScrollView>

              <View style={s.testFooter}>
                {!testLlmResult && !testLoading && testAgent && (
                  <TouchableOpacity
                    style={s.testRunBtn}
                    onPress={() => handleTestAgent(testAgent)}
                  >
                    <Text style={s.testRunBtnText}>开始测试</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  style={s.testCancelBtn}
                  onPress={() => setTestModalVisible(false)}
                >
                  <Text style={s.testCancelBtnText}>关闭</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* 导入模板弹窗 */}
        <Modal visible={importModalVisible} transparent animationType="slide">
          <TouchableWithoutFeedback onPress={Keyboard.dismiss} disabled={Platform.OS === 'web'}>
            <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
              <View style={m.modalContainer}>
                <View style={m.modalContent}>
                  <View style={m.modalHeader}>
                    <Text style={m.modalTitle}>导入/导出模板</Text>
                    <TouchableOpacity onPress={() => setImportModalVisible(false)}><Ionicons name="close" size={24} color="#8888AA" /></TouchableOpacity>
                  </View>

                  <ScrollView style={m.modalBody}>
                    <Text style={m.fieldLabel}>快速选择预设模板</Text>
                    <View style={s.presetTemplateList}>
                      {BUILTIN_TEMPLATES.map((tpl) => (
                        <TouchableOpacity
                          key={tpl.name}
                          style={s.presetTemplateBtn}
                          onPress={() => { setImportText(tpl.text); setImportError(''); }}
                        >
                          <Text style={s.presetTemplateName}>{tpl.name}</Text>
                          <Text style={s.presetTemplateDesc}>{tpl.desc}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>

                    <View style={s.templateDivider} />

                    <Text style={m.fieldLabel}>模板内容（粘贴或选择预设后可编辑）</Text>
                    <Text style={s.templateFormatHint}>格式：=== 助手名 === 换行 启用/禁用 换行 规则内容</Text>
                    <TextInput
                      style={[m.fieldInput, s.templateInput]}
                      multiline
                      placeholder={"=== 写手 ===\n启用\n你是一位经验丰富的小说写手..."}
                      placeholderTextColor="#6B6B8D"
                      value={importText}
                      onChangeText={(t) => { setImportText(t); setImportError(''); }}
                      textAlignVertical="top"
                    />

                    {importError ? (
                      <Text style={s.importError}>{importError}</Text>
                    ) : null}

                    {importText.trim() ? (() => {
                      const parsed = parseTemplate(importText);
                      return (
                        <View style={s.importPreview}>
                          <Text style={s.importPreviewTitle}>识别到 {parsed.agents.length} 个助手</Text>
                          {parsed.globalRules ? (
                            <View style={[s.importPreviewItem, { borderLeftWidth: 3, borderLeftColor: GC.accent }]}>
                              <Text style={[s.importPreviewStatus, { color: GC.accent }]}>GL</Text>
                              <Text style={s.importPreviewName}>全局铁律</Text>
                              <Text style={s.importPreviewPrompt} numberOfLines={1}>{parsed.globalRules.slice(0, 40)}...</Text>
                            </View>
                          ) : null}
                          {parsed.agents.map((p) => (
                            <View key={p.presetId} style={s.importPreviewItem}>
                              <Text style={s.importPreviewStatus}>{p.enabled ? 'ON' : 'OFF'}</Text>
                              <Text style={s.importPreviewName}>{p.name}</Text>
                              <Text style={s.importPreviewPrompt} numberOfLines={1}>{p.prompt.slice(0, 40)}...</Text>
                            </View>
                          ))}
                        </View>
                      );
                    })() : null}
                  </ScrollView>

                  <View style={m.modalFooter}>
                    <TouchableOpacity style={[m.modalBtn, m.cancelBtn]} onPress={() => setImportModalVisible(false)}>
                      <Text style={m.cancelBtnText}>取消</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[m.modalBtn, m.submitBtn]} onPress={handleImportTemplate}>
                      <Text style={m.submitBtnText}>导入</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            </KeyboardAvoidingView>
          </TouchableWithoutFeedback>
        </Modal>
      </View>
    </Screen>
  );
}
