import { View, Text } from 'react-native';

export default function TestScreen() {
  return (
    <View style={{ flex: 1, backgroundColor: '#1a1a2e', justifyContent: 'center', alignItems: 'center' }}>
      <Text style={{ color: '#ffffff', fontSize: 28, fontWeight: 'bold' }}>测试成功</Text>
      <Text style={{ color: '#6c63ff', fontSize: 20, marginTop: 16 }}>如果你看到这行字，渲染正常</Text>
    </View>
  );
}
