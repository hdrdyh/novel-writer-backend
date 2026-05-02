import { useState } from 'react';
import { Modal, View, ScrollView, Text, TextInput, TouchableOpacity, TouchableWithoutFeedback, Keyboard, KeyboardAvoidingView, Platform, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { m } from './agentConfigStyles';
import type { PresetAgent } from '@/utils/presetAgents';
import type { AgentConfig, ReviewAgent } from './types';

// ============== API配置编辑弹窗 ==============
export function ApiConfigModal({
  visible,
  data,
  onClose,
  onSave,
}: {
  visible: boolean;
  data: { id?: string; name: string; apiKey: string; baseUrl: string; model: string } | null;
  onClose: () => void;
  onSave: (config: { id?: string; name: string; apiKey: string; baseUrl: string; model: string }) => void;
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

// ============== 协作Agent编辑弹窗 ==============
export function CollabAgentEditModal({
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
  apiConfigs: { id: string; name: string; model: string }[];
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
  const [prevPrompt, setPrevPrompt] = useState<string>(initPrompt);
  if ((preset?.id ?? null) !== prevPresetId || initPrompt !== prevPrompt) {
    setPrevPresetId(preset?.id ?? null);
    setPrevPrompt(initPrompt);
    setName(initName);
    setPrompt(initPrompt);
    setApiId(initApiId);
  }

  const handleSave = () => {
    if (!name.trim()) {
      Alert.alert('提示', '请填写助手名称');
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
                <Text style={m.modalTitle}>编辑 {preset?.name || '助手'}</Text>
                <TouchableOpacity onPress={onClose}><Ionicons name="close" size={24} color="#8888AA" /></TouchableOpacity>
              </View>
              <ScrollView style={m.modalBody}>
                <Text style={m.fieldLabel}>名称</Text>
                <TextInput style={m.fieldInput} placeholder="助手名称" placeholderTextColor="#6B6B8D" value={name} onChangeText={setName} />

                <Text style={m.fieldLabel}>规则 Prompt</Text>
                <TextInput
                  style={[m.fieldInput, m.promptInput]}
                  placeholder="编写助手的执行规则和prompt..."
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

// ============== 评审Agent编辑弹窗 ==============
export function ReviewAgentEditModal({
  visible,
  agent,
  apiConfigs,
  onClose,
  onSave,
}: {
  visible: boolean;
  agent: ReviewAgent | null;
  apiConfigs: { id: string; name: string; model: string }[];
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
  const [prevPrompt, setPrevPrompt] = useState<string>(initPrompt);
  if ((agent?.id ?? null) !== prevAgentId || initPrompt !== prevPrompt) {
    setPrevAgentId(agent?.id ?? null);
    setPrevPrompt(initPrompt);
    setName(initName);
    setPrompt(initPrompt);
    setApiId(initApiId);
  }

  const handleSave = () => {
    if (!name.trim()) {
      Alert.alert('提示', '请填写助手名称');
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
                <Text style={m.modalTitle}>{agent ? '编辑评审助手' : '添加评审助手'}</Text>
                <TouchableOpacity onPress={onClose}><Ionicons name="close" size={24} color="#8888AA" /></TouchableOpacity>
              </View>
              <ScrollView style={m.modalBody}>
                <Text style={m.fieldLabel}>名称</Text>
                <TextInput style={m.fieldInput} placeholder="助手名称" placeholderTextColor="#6B6B8D" value={name} onChangeText={setName} />
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
