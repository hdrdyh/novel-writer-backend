import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Platform, StyleSheet, View } from 'react-native';

export default function TabLayout() {
  const tabBarStyle = {
    backgroundColor: '#000000',
    borderTopWidth: 1,
    borderTopColor: '#333333',
    paddingBottom: Platform.OS === 'ios' ? 20 : 8,
    paddingTop: 8,
    height: 70 + (Platform.OS === 'ios' ? 20 : 8),
  };

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle,
        tabBarActiveTintColor: '#ffffff',
        tabBarInactiveTintColor: '#888888',
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '600',
          marginTop: 2,
        },
        tabBarIconStyle: {
          marginBottom: -2,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: '粗纲',
          tabBarIcon: ({ color }) => (
            <Ionicons name="document-text-outline" size={22} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="writing"
        options={{
          title: '写作',
          tabBarIcon: ({ color }) => (
            <Ionicons name="pencil" size={22} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="memory"
        options={{
          title: '记忆',
          tabBarIcon: ({ color }) => (
            <Ionicons name="cloud-outline" size={22} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="bookshelf"
        options={{
          title: '书架',
          tabBarIcon: ({ color }) => (
            <Ionicons name="library-outline" size={22} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: '设置',
          tabBarIcon: ({ color }) => (
            <Ionicons name="settings-outline" size={22} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
