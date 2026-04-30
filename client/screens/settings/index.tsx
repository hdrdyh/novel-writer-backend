import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Screen } from '@/components/Screen';
import { Ionicons } from '@expo/vector-icons';
import { useSafeRouter } from '@/hooks/useSafeRouter';

interface SettingItem {
  key: string;
  label: string;
  description: string;
  type: 'toggle' | 'action';
  value: boolean;
}

export default function SettingsScreen() {
  const router = useSafeRouter();

  const [settings, setSettings] = useState<SettingItem[]>([
    {
      key: 'showAgentSteps',
      label: '显示AI创作过程',
      description: '展示多Agent协作的详细步骤',
      type: 'toggle',
      value: true,
    },
    {
      key: 'streamOutput',
      label: '流式输出',
      description: '实时显示生成内容（建议开启）',
      type: 'toggle',
      value: true,
    },
  ]);

  const [stats, setStats] = useState({
    totalChapters: 0,
    totalWords: 0,
    totalMemory: 0,
  });

  useEffect(() => {
    const loadStats = async () => {
      try {
        const novelsData = await AsyncStorage.getItem('novels');
        const memoryData = await AsyncStorage.getItem('memory');
        const novels = novelsData ? JSON.parse(novelsData) : [];
        const memory = memoryData ? JSON.parse(memoryData) : [];

        let totalWords = 0;
        novels.forEach((n: any) => {
          totalWords += (n.content || '').length;
        });

        setStats({
          totalChapters: novels.length,
          totalWords,
          totalMemory: memory.length,
        });
      } catch (e) {}
    };
    loadStats();
  }, []);

  const handleToggle = (key: string) => {
    setSettings((prev) =>
      prev.map((s) => (s.key === key ? { ...s, value: !s.value } : s))
    );
  };

  const handleClearData = () => {
    Alert.alert('确认', '确定清除所有本地数据吗？此操作不可恢复。', [
      { text: '取消', style: 'cancel' },
      {
        text: '清除',
        style: 'destructive',
        onPress: async () => {
          await AsyncStorage.multiRemove(['novels', 'memory', 'savedItems', 'apiConfigs', 'agentConfigs', 'reviewTeamConfigs', 'reviewConfig', 'outline_data']);
          setStats({ totalChapters: 0, totalWords: 0, totalMemory: 0 });
          Alert.alert('完成', '所有本地数据已清除');
        },
      },
    ]);
  };

  const handleExportData = async () => {
    try {
      const novelsData = await AsyncStorage.getItem('novels');
      const memoryData = await AsyncStorage.getItem('memory');
      const apiConfigsData = await AsyncStorage.getItem('apiConfigs');
      const agentConfigsData = await AsyncStorage.getItem('agentConfigs');
      const reviewTeamData = await AsyncStorage.getItem('reviewTeamConfigs');
      const outlineData = await AsyncStorage.getItem('outline_data');

      const exportObj = {
        novels: novelsData ? JSON.parse(novelsData) : [],
        memory: memoryData ? JSON.parse(memoryData) : [],
        apiConfigs: apiConfigsData ? JSON.parse(apiConfigsData) : [],
        agentConfigs: agentConfigsData ? JSON.parse(agentConfigsData) : [],
        reviewTeamConfigs: reviewTeamData ? JSON.parse(reviewTeamData) : [],
        outlineData: outlineData ? JSON.parse(outlineData) : null,
      };

      const exportText = JSON.stringify(exportObj, null, 2);
      Alert.alert('数据已准备', '请复制导出内容（已在控制台输出）', [{ text: '确定' }]);
      console.log('=== EXPORT_DATA_START ===');
      console.log(exportText);
      console.log('=== EXPORT_DATA_END ===');
    } catch (e) {
      Alert.alert('错误', '导出失败');
    }
  };

  return (
    <Screen>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>设置</Text>
        </View>

        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
          {/* Stats Section */}
          <Text style={styles.sectionTitle}>创作统计</Text>
          <View style={styles.statsGrid}>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{stats.totalChapters}</Text>
              <Text style={styles.statLabel}>章节</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{stats.totalWords}</Text>
              <Text style={styles.statLabel}>字数</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{stats.totalMemory}</Text>
              <Text style={styles.statLabel}>记忆</Text>
            </View>
          </View>

          {/* 写作流水线入口 */}
          <Text style={styles.sectionTitle}>核心功能</Text>
          <TouchableOpacity
            style={styles.actionCard}
            onPress={() => router.push('/agent-config')}
          >
            <Ionicons name="git-branch-outline" size={22} color="#fff" />
            <View style={styles.actionInfo}>
              <Text style={styles.actionLabel}>写作流水线</Text>
              <Text style={styles.actionDesc}>管理Agent、调整执行顺序、配置API</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#555" />
          </TouchableOpacity>

          {/* Settings Section */}
          <Text style={styles.sectionTitle}>创作偏好</Text>
          {settings.map((setting) => (
            <View key={setting.key} style={styles.settingCard}>
              <View style={styles.settingInfo}>
                <Text style={styles.settingLabel}>{setting.label}</Text>
                <Text style={styles.settingDesc}>{setting.description}</Text>
              </View>
              <TouchableOpacity
                style={[
                  styles.toggle,
                  setting.value ? styles.toggleOn : styles.toggleOff,
                ]}
                onPress={() => handleToggle(setting.key)}
              >
                <View
                  style={[
                    styles.toggleThumb,
                    setting.value ? styles.toggleThumbOn : styles.toggleThumbOff,
                  ]}
                />
              </TouchableOpacity>
            </View>
          ))}

          {/* Data Management */}
          <Text style={styles.sectionTitle}>数据管理</Text>
          <TouchableOpacity style={styles.actionCard} onPress={handleExportData}>
            <Ionicons name="download-outline" size={22} color="#fff" />
            <View style={styles.actionInfo}>
              <Text style={styles.actionLabel}>导出数据</Text>
              <Text style={styles.actionDesc}>将小说数据导出备份</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#555" />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionCard, styles.dangerCard]}
            onPress={handleClearData}
          >
            <Ionicons name="trash-outline" size={22} color="#666" />
            <View style={styles.actionInfo}>
              <Text style={styles.actionLabelDanger}>清除所有数据</Text>
              <Text style={styles.actionDesc}>删除所有本地小说和记忆</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#555" />
          </TouchableOpacity>

          {/* About */}
          <Text style={styles.sectionTitle}>关于</Text>
          <View style={styles.aboutCard}>
            <View style={styles.aboutRow}>
              <Text style={styles.aboutLabel}>应用名称</Text>
              <Text style={styles.aboutValue}>写作大师</Text>
            </View>
            <View style={styles.aboutDivider} />
            <View style={styles.aboutRow}>
              <Text style={styles.aboutLabel}>版本</Text>
              <Text style={styles.aboutValue}>1.0.0</Text>
            </View>
            <View style={styles.aboutDivider} />
            <View style={styles.aboutRow}>
              <Text style={styles.aboutLabel}>AI引擎</Text>
              <Text style={styles.aboutValue}>多Agent协作</Text>
            </View>
          </View>
        </ScrollView>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 100,
  },
  sectionTitle: {
    color: '#888',
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 12,
    marginTop: 8,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 28,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 18,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#333',
  },
  statValue: {
    color: '#fff',
    fontSize: 28,
    fontWeight: 'bold',
  },
  statLabel: {
    color: '#888',
    fontSize: 12,
    marginTop: 4,
  },
  settingCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 18,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#333',
  },
  settingInfo: {
    flex: 1,
    marginRight: 16,
  },
  settingLabel: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 4,
  },
  settingDesc: {
    color: '#888',
    fontSize: 13,
  },
  toggle: {
    width: 52,
    height: 30,
    borderRadius: 15,
    padding: 2,
    justifyContent: 'center',
  },
  toggleOn: {
    backgroundColor: '#fff',
  },
  toggleOff: {
    backgroundColor: '#333',
  },
  toggleThumb: {
    width: 26,
    height: 26,
    borderRadius: 13,
  },
  toggleThumbOn: {
    backgroundColor: '#000',
    alignSelf: 'flex-end',
  },
  toggleThumbOff: {
    backgroundColor: '#888',
  },
  actionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 18,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#333',
    gap: 14,
  },
  dangerCard: {
    borderColor: '#333',
  },
  actionInfo: {
    flex: 1,
  },
  actionLabel: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 2,
  },
  actionLabelDanger: {
    color: '#888',
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 2,
  },
  actionDesc: {
    color: '#888',
    fontSize: 13,
  },
  aboutCard: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 18,
    borderWidth: 1,
    borderColor: '#333',
  },
  aboutRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
  },
  aboutDivider: {
    height: 1,
    backgroundColor: '#333',
  },
  aboutLabel: {
    color: '#888',
    fontSize: 15,
  },
  aboutValue: {
    color: '#fff',
    fontSize: 15,
  },
});
