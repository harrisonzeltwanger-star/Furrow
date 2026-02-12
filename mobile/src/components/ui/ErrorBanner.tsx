import { View, Text } from 'react-native';

export default function ErrorBanner({ message }: { message: string }) {
  if (!message) return null;
  return (
    <View
      style={{
        backgroundColor: '#fde8e8',
        borderRadius: 8,
        paddingHorizontal: 16,
        paddingVertical: 12,
        marginBottom: 12,
      }}
    >
      <Text style={{ fontSize: 14, color: '#b33a1a' }}>{message}</Text>
    </View>
  );
}
