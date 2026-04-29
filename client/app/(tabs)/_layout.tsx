import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Platform, StyleSheet, View, Text } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

export default function TabLayout() {
  const tabBarStyle = {
    backgroundColor: 'rgba(15, 12, 41, 0.85)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
    paddingBottom: Platform.OS === 'ios' ? 20 : 8,
    paddingTop: 8,
    height: 70 + (Platform.OS === 'ios' ? 20 : 8),
  };

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle,
        tabBarActiveTintColor: '#00D2FF',
        tabBarInactiveTintColor: 'rgba(255, 255, 255, 0.35)',
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
          tabBarIcon: ({ color, focused }) => (
            <View style={styles.iconContainer}>
              <Ionicons name="document-text-outline" size={22} color={color} />
              {focused && <View style={styles.indicator} />}
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="writing"
        options={{
          title: '写作',
          tabBarIcon: ({ color, focused }) => (
            <View style={styles.iconContainer}>
              <Ionicons name="pencil" size={22} color={color} />
              {focused && <View style={styles.indicator} />}
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="memory"
        options={{
          title: '记忆',
          tabBarIcon: ({ color, focused }) => (
            <View style={styles.iconContainer}>
              <Ionicons name="cloud-outline" size={22} color={color} />
              {focused && <View style={styles.indicator} />}
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="bookshelf"
        options={{
          title: '书架',
          tabBarIcon: ({ color, focused }) => (
            <View style={styles.iconContainer}>
              <Ionicons name="library-outline" size={22} color={color} />
              {focused && <View style={styles.indicator} />}
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: '设置',
          tabBarIcon: ({ color, focused }) => (
            <View style={styles.iconContainer}>
              <Ionicons name="settings-outline" size={22} color={color} />
              {focused && <View style={styles.indicator} />}
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="test"
        options={{
          title: '测试',
          tabBarIcon: ({ color, focused }) => (
            <View style={styles.iconContainer}>
              <Ionicons name="bug-outline" size={22} color={color} />
              {focused && <View style={styles.indicator} />}
            </View>
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  iconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 32,
    height: 24,
  },
  indicator: {
    position: 'absolute',
    top: -8,
    width: 20,
    height: 2.5,
    borderRadius: 2,
    backgroundColor: '#00D2FF',
  },
});
