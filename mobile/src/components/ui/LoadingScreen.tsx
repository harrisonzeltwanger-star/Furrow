import { View, ActivityIndicator, Text } from 'react-native';

export default function LoadingScreen({ message }: { message?: string }) {
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#faf8f4' }}>
      <ActivityIndicator size="large" color="#2d5a27" />
      {message && (
        <Text style={{ marginTop: 12, color: '#7a6a5a', fontSize: 14 }}>{message}</Text>
      )}
    </View>
  );
}
