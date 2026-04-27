import { Tabs } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Platform, StyleSheet } from 'react-native';

export default function TabLayout() {
  const insets = useSafeAreaInsets();

  const tabBarStyle = {
    backgroundColor: '#FFFFFF',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#ECECEC',
    paddingBottom: Platform.OS === 'ios' ? insets.bottom : 8,
    paddingTop: 8,
    height: 60 + (Platform.OS === 'ios' ? insets.bottom : 8),
  };

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle,
        tabBarActiveTintColor: '#111111',
        tabBarInactiveTintColor: '#CCCCCC',
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '600',
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: '粗纲',
          tabBarIcon: ({ color }) => (
            <Feather name="edit-3" size={22} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="writing"
        options={{
          title: '写作台',
          tabBarIcon: ({ color }) => (
            <Feather name="pen-tool" size={22} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="memory"
        options={{
          title: '记忆库',
          tabBarIcon: ({ color }) => (
            <Feather name="database" size={22} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="bookshelf"
        options={{
          title: '书架',
          tabBarIcon: ({ color }) => (
            <Feather name="book" size={22} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: '设置',
          tabBarIcon: ({ color }) => (
            <Feather name="settings" size={22} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
