import { View, Text, StyleSheet } from 'react-native';

export default function HomeScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>写作大师</Text>
      <Text style={styles.sub}>如果看到这行字，说明渲染正常</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  text: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: 'bold',
  },
  sub: {
    color: '#888888',
    fontSize: 14,
    marginTop: 12,
  },
});
