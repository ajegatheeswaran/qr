import { StatusBar } from 'expo-status-bar';
import { StyleSheet, View } from 'react-native';
import QRScanner from './QRScanner';

export default function App() {
  return (
    <View style={styles.container}>
      <QRScanner />
      <StatusBar style="light" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
});
