import { View, Text } from 'react-native';
import { Screen } from '@/components/Screen';

export default function TestScreen() {
  return (
    <Screen>
      <View style={{ flex: 1, backgroundColor: '#0f0c29', justifyContent: 'center', alignItems: 'center' }}>
        <Text style={{ color: '#fff', fontSize: 24 }}>测试页面</Text>
        <Text style={{ color: '#6c63ff', fontSize: 18, marginTop: 20 }}>如果能看到这行字，说明UI正常</Text>
      </View>
    </Screen>
  );
}
