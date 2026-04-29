import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Provider } from '@/components/Provider';
import '../global.css';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <Provider>
      <View style={styles.container}>
        {children}
      </View>
    </Provider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F0C29',
  },
});
