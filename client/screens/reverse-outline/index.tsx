import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  StyleSheet,
} from 'react-native';
import { useSafeRouter } from '@/hooks/useSafeRouter';
import { Screen } from '@/components/Screen';
import AsyncStorage from '@react-native-async-storage/async-storage';

type ReverseStep = 'idle' | 'analyzing' | 'done';

export default function ReverseOutlineScreen() {
  const router = useSafeRouter();
  const [sourceText, setSourceText] = useState('');
  const [step, setStep] = useState<ReverseStep>('idle');
  const [progress, setProgress] = useState('');
  const [result, setResult] = useState({
    outline: '',
    roughOutline: '',
    detailedOutline: '',
    characters: '',
    worldview: '',
  });

  const handleReverse = async () => {
    if (!sourceText.trim()) {
      Alert.alert('提示', '请先粘贴已有小说正文');
      return;
    }

    // 读取API配置
    const apiConfigsStr = await AsyncStorage.getItem('apiConfigs');
    const apiConfigs = apiConfigsStr ? JSON.parse(apiConfigsStr) : [];
    if (apiConfigs.length === 0) {
      Alert.alert('提示', '请先在写作流水线中配置API', [
        { text: '去配置', onPress: () => router.push('/agent-config') },
        { text: '取消' },
      ]);
      return;
    }

    // 读取Agent配置
    const agentsStr = await AsyncStorage.getItem('agentConfigs');
    const agents = agentsStr ? JSON.parse(agentsStr) : [];
    const enabledAgents = agents.filter((a: any) => a.enabled);

    setStep('analyzing');

    try {
      const generated: any = {};

      // 获取Agent对应的API配置
      const getApiForAgent = (agent: any) => {
        if (agent?.apiId) {
          const cfg = apiConfigs.find((c: any) => c.id === agent.apiId);
          if (cfg) return cfg;
        }
        return apiConfigs[0];
      };

      // 第1步：提取世界观
      setProgress('正在提取世界观设定...');
      const worldAgent = enabledAgents.find((a: any) => a.role === 'worldbuilder') || enabledAgents[0];
      const worldApi = getApiForAgent(worldAgent);

      if (worldApi) {
        const worldRes = await fetch(`${worldApi.baseUrl}/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${worldApi.apiKey}`,
          },
          body: JSON.stringify({
            model: worldApi.model,
            messages: [
              { role: 'system', content: worldAgent?.systemPrompt || '你是一个精通世界观架构的小说分析师。' },
              { role: 'user', content: `请阅读以下小说片段，提取并总结其中的世界观设定（修仙体系、势力分布、历史背景、规则法则等），300字以内：\n\n${sourceText.substring(0, 3000)}` },
            ],
            max_tokens: 500,
          }),
        });
        const worldData = await worldRes.json();
        generated.worldview = worldData.choices?.[0]?.message?.content || '提取失败';
      } else {
        generated.worldview = '未配置API';
      }

      // 第2步：提取人物
      setProgress('正在提取人物设定...');
      const charAgent = enabledAgents.find((a: any) => a.role === 'character') || enabledAgents[1] || enabledAgents[0];
      const charApi = getApiForAgent(charAgent);

      if (charApi) {
        const charRes = await fetch(`${charApi.baseUrl}/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${charApi.apiKey}`,
          },
          body: JSON.stringify({
            model: charApi.model,
            messages: [
              { role: 'system', content: charAgent?.systemPrompt || '你是一个擅长塑造人物的小说分析师。' },
              { role: 'user', content: `请阅读以下小说片段，提取并总结其中的主要人物设定（姓名、性格、背景、关系网），300字以内：\n\n${sourceText.substring(0, 3000)}` },
            ],
            max_tokens: 500,
          }),
        });
        const charData = await charRes.json();
        generated.characters = charData.choices?.[0]?.message?.content || '提取失败';
      } else {
        generated.characters = '未配置API';
      }

      // 第3步：提取大纲
      setProgress('正在反推大纲...');
      const plotAgent = enabledAgents.find((a: any) => a.role === 'plotter') || enabledAgents[2] || enabledAgents[0];
      const plotApi = getApiForAgent(plotAgent);

      if (plotApi) {
        const outlineRes = await fetch(`${plotApi.baseUrl}/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${plotApi.apiKey}`,
          },
          body: JSON.stringify({
            model: plotApi.model,
            messages: [
              { role: 'system', content: plotAgent?.systemPrompt || '你是一个精通情节设计的小说分析师。' },
              { role: 'user', content: `请阅读以下小说片段，反推出整本书的大纲（起承转合、核心冲突、主要转折点），300字以内：\n\n${sourceText.substring(0, 3000)}` },
            ],
            max_tokens: 500,
          }),
        });
        const outlineData = await outlineRes.json();
        generated.outline = outlineData.choices?.[0]?.message?.content || '提取失败';
      } else {
        generated.outline = '未配置API';
      }

      // 第4步：提取粗纲
      setProgress('正在反推粗纲...');
      if (plotApi) {
        const roughRes = await fetch(`${plotApi.baseUrl}/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${plotApi.apiKey}`,
          },
          body: JSON.stringify({
            model: plotApi.model,
            messages: [
              { role: 'system', content: '你是小说分析师，擅长从正文中反推章节结构。' },
              { role: 'user', content: `请阅读以下小说片段，反推出每章的粗纲（每章一句话概括），格式为"第X章: xxx"：\n\n${sourceText.substring(0, 4000)}` },
            ],
            max_tokens: 800,
          }),
        });
        const roughData = await roughRes.json();
        generated.roughOutline = roughData.choices?.[0]?.message?.content || '提取失败';
      } else {
        generated.roughOutline = '未配置API';
      }

      // 第5步：提取细纲
      setProgress('正在反推细纲...');
      if (plotApi) {
        const detailRes = await fetch(`${plotApi.baseUrl}/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${plotApi.apiKey}`,
          },
          body: JSON.stringify({
            model: plotApi.model,
            messages: [
              { role: 'system', content: '你是小说分析师，擅长从正文中反推详细情节。' },
              { role: 'user', content: `请阅读以下小说片段，反推出每章的细纲（具体情节、场景、情绪走向、悬念），格式为"第X章细纲: xxx"：\n\n${sourceText.substring(0, 4000)}` },
            ],
            max_tokens: 1500,
          }),
        });
        const detailData = await detailRes.json();
        generated.detailedOutline = detailData.choices?.[0]?.message?.content || '提取失败';
      } else {
        generated.detailedOutline = '未配置API';
      }

      setResult(generated);
      setStep('done');
    } catch (e: any) {
      Alert.alert('反推失败', e.message || '请检查API配置');
      setStep('idle');
    }
  };

  const handleSaveToOutline = async () => {
    try {
      // 读取现有大纲数据
      const existingStr = await AsyncStorage.getItem('outline_data');
      const existing = existingStr ? JSON.parse(existingStr) : {};

      // 将反推结果合并到大纲数据结构
      const roughLines = result.roughOutline.split('\n').filter((l: string) => l.trim());
      const detailLines = result.detailedOutline.split('\n').filter((l: string) => l.trim());

      const outlineData = {
        outline: result.outline || existing.outline || '',
        rough: roughLines.length > 0 ? roughLines : existing.rough || [],
        detail: detailLines.length > 0 ? detailLines : existing.detail || [],
        stage: 'detail' as const,
        outlineLocked: true,
        roughLocked: true,
        detailLocked: true,
      };
      await AsyncStorage.setItem('outline_data', JSON.stringify(outlineData));

      // 同时保存人物和世界观到记忆库
      const memStr = await AsyncStorage.getItem('memory');
      const memories = memStr ? JSON.parse(memStr) : [];
      if (result.worldview) {
        memories.push({ id: `worldview_${new Date().getTime()}`, type: 'worldview', content: result.worldview, timestamp: new Date().getTime() });
      }
      if (result.characters) {
        memories.push({ id: `character_${new Date().getTime()}`, type: 'character', content: result.characters, timestamp: new Date().getTime() });
      }
      await AsyncStorage.setItem('memory', JSON.stringify(memories));

      Alert.alert('保存成功', '大纲已写入设计页，人物和世界观已存入记忆库', [
        { text: '去看看', onPress: () => router.replace('/') },
      ]);
    } catch {
      Alert.alert('保存失败', '请重试');
    }
  };

  return (
    <Screen>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Text style={styles.backBtnText}>← 返回</Text>
          </TouchableOpacity>
          <Text style={styles.title}>AI反推大纲</Text>
          <View style={{ width: 60 }} />
        </View>

        {step === 'idle' && (
          <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
            <Text style={styles.desc}>
              粘贴已有小说正文，AI会自动反推出大纲、粗纲、细纲、人物设定、世界观。支持续写。
            </Text>
            <TextInput
              style={styles.input}
              multiline
              placeholder="在这里粘贴已有小说正文..."
              placeholderTextColor="#666"
              value={sourceText}
              onChangeText={setSourceText}
              textAlignVertical="top"
            />
            <TouchableOpacity style={styles.startBtn} onPress={handleReverse}>
              <Text style={styles.startBtnText}>开始反推</Text>
            </TouchableOpacity>
          </ScrollView>
        )}

        {step === 'analyzing' && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#fff" />
            <Text style={styles.loadingText}>{progress}</Text>
            <Text style={styles.loadingHint}>每个Agent正在使用您配置的API分析文本...</Text>
          </View>
        )}

        {step === 'done' && (
          <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
            {/* 世界观 */}
            <View style={styles.resultSection}>
              <Text style={styles.resultLabel}>世界观设定</Text>
              <Text style={styles.resultText}>{result.worldview}</Text>
            </View>

            {/* 人物 */}
            <View style={styles.resultSection}>
              <Text style={styles.resultLabel}>人物设定</Text>
              <Text style={styles.resultText}>{result.characters}</Text>
            </View>

            {/* 大纲 */}
            <View style={styles.resultSection}>
              <Text style={styles.resultLabel}>大纲</Text>
              <Text style={styles.resultText}>{result.outline}</Text>
            </View>

            {/* 粗纲 */}
            <View style={styles.resultSection}>
              <Text style={styles.resultLabel}>粗纲</Text>
              <Text style={styles.resultText}>{result.roughOutline}</Text>
            </View>

            {/* 细纲 */}
            <View style={styles.resultSection}>
              <Text style={styles.resultLabel}>细纲</Text>
              <Text style={styles.resultText}>{result.detailedOutline}</Text>
            </View>

            <View style={styles.actionRow}>
              <TouchableOpacity style={styles.saveBtn} onPress={handleSaveToOutline}>
                <Text style={styles.saveBtnText}>写入设计页</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.reBtn} onPress={() => { setStep('idle'); setResult({ outline: '', roughOutline: '', detailedOutline: '', characters: '', worldview: '' }); }}>
                <Text style={styles.reBtnText}>重新反推</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  backBtn: { padding: 8 },
  backBtnText: { color: '#888', fontSize: 14 },
  title: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  body: { flex: 1 },
  bodyContent: { padding: 16 },
  desc: { color: '#888', fontSize: 13, marginBottom: 12, lineHeight: 20 },
  input: {
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#333',
    padding: 12,
    color: '#fff',
    fontSize: 14,
    minHeight: 300,
    marginBottom: 16,
  },
  startBtn: {
    backgroundColor: '#fff',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
  },
  startBtnText: { color: '#000', fontSize: 16, fontWeight: 'bold' },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  loadingText: { color: '#fff', fontSize: 16, marginTop: 16, textAlign: 'center' },
  loadingHint: { color: '#666', fontSize: 12, marginTop: 8, textAlign: 'center' },
  resultSection: {
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#333',
    padding: 14,
    marginBottom: 12,
  },
  resultLabel: { color: '#fff', fontSize: 15, fontWeight: 'bold', marginBottom: 8 },
  resultText: { color: '#ccc', fontSize: 14, lineHeight: 22 },
  actionRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
    marginBottom: 32,
  },
  saveBtn: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
  },
  saveBtnText: { color: '#000', fontSize: 16, fontWeight: 'bold' },
  reBtn: {
    flex: 1,
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#333',
    paddingVertical: 14,
    alignItems: 'center',
  },
  reBtnText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
});
