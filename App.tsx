import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { RoomtoneApp } from './src/app/RoomtoneApp';
import { RoomtoneProvider } from './src/app/RoomtoneContext';

export default function App() {
  return (
    <SafeAreaProvider>
      <StatusBar style="auto" />
      <RoomtoneProvider><RoomtoneApp /></RoomtoneProvider>
    </SafeAreaProvider>
  );
}
