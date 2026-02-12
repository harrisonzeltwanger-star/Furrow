import { View, Text, type ViewStyle } from 'react-native';

interface CardProps {
  children: React.ReactNode;
  style?: ViewStyle;
  highlighted?: boolean;
}

export function Card({ children, style, highlighted }: CardProps) {
  return (
    <View
      style={[
        {
          backgroundColor: '#fdfcf8',
          borderRadius: 12,
          borderWidth: highlighted ? 2 : 1,
          borderColor: highlighted ? '#2d5a27' : '#d8cebb',
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: 0.05,
          shadowRadius: 3,
          elevation: highlighted ? 4 : 1,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

export function CardHeader({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  return (
    <View style={[{ padding: 16, paddingBottom: 8 }, style]}>
      {children}
    </View>
  );
}

export function CardContent({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  return (
    <View style={[{ padding: 16, paddingTop: 0 }, style]}>
      {children}
    </View>
  );
}

export function CardTitle({ children, style }: { children: React.ReactNode; style?: ViewStyle & { fontSize?: number } }) {
  return (
    <Text style={[{ fontSize: 18, fontWeight: '700', color: '#3a2a1a' }, style]}>
      {children}
    </Text>
  );
}

export function CardDescription({ children }: { children: React.ReactNode }) {
  return (
    <Text style={{ fontSize: 13, color: '#7a6a5a', marginTop: 2 }}>
      {children}
    </Text>
  );
}
