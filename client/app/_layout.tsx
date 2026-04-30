import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View, StyleSheet } from 'react-native';
import { Provider } from '@/components/Provider';
import '../global.css';

export default function RootLayout() {
  return (
    <Provider>
      <View style={styles.container}>
        <StatusBar style="light" />
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="agent-config" />
          <Stack.Screen name="chapter-review" />
          <Stack.Screen name="outline-review" />
        </Stack>
      </View>
    </Provider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
});
