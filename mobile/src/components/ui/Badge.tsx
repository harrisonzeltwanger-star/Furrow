import { View, Text, type ViewStyle } from 'react-native';

type Variant = 'default' | 'secondary' | 'destructive' | 'success' | 'warning';

const variantStyles: Record<Variant, ViewStyle> = {
  default: { backgroundColor: '#2d5a27' },
  secondary: { backgroundColor: '#e8dcc8' },
  destructive: { backgroundColor: '#fde8e8' },
  success: { backgroundColor: '#dcfce7' },
  warning: { backgroundColor: '#fef3c7' },
};

const variantTextColors: Record<Variant, string> = {
  default: '#f0faf0',
  secondary: '#5a4a3a',
  destructive: '#b33a1a',
  success: '#166534',
  warning: '#92400e',
};

interface BadgeProps {
  children: string;
  variant?: Variant;
  style?: ViewStyle;
}

export default function Badge({ children, variant = 'default', style }: BadgeProps) {
  return (
    <View
      style={[
        {
          paddingHorizontal: 8,
          paddingVertical: 2,
          borderRadius: 100,
          alignSelf: 'flex-start',
        },
        variantStyles[variant],
        style,
      ]}
    >
      <Text style={{ fontSize: 11, fontWeight: '600', color: variantTextColors[variant] }}>
        {children}
      </Text>
    </View>
  );
}
