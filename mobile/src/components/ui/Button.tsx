import { TouchableOpacity, Text, ActivityIndicator, type ViewStyle, type TextStyle } from 'react-native';

type Variant = 'default' | 'outline' | 'ghost' | 'destructive';
type Size = 'default' | 'sm' | 'lg';

interface ButtonProps {
  onPress?: () => void;
  disabled?: boolean;
  loading?: boolean;
  variant?: Variant;
  size?: Size;
  children: React.ReactNode;
  style?: ViewStyle;
}

const variantStyles: Record<Variant, ViewStyle> = {
  default: { backgroundColor: '#2d5a27' },
  outline: { backgroundColor: 'transparent', borderWidth: 1, borderColor: '#d8cebb' },
  ghost: { backgroundColor: 'transparent' },
  destructive: { backgroundColor: '#b33a1a' },
};

const variantTextStyles: Record<Variant, TextStyle> = {
  default: { color: '#f0faf0' },
  outline: { color: '#3a2a1a' },
  ghost: { color: '#3a2a1a' },
  destructive: { color: '#ffffff' },
};

const sizeStyles: Record<Size, ViewStyle> = {
  default: { paddingHorizontal: 16, paddingVertical: 10 },
  sm: { paddingHorizontal: 12, paddingVertical: 6 },
  lg: { paddingHorizontal: 24, paddingVertical: 14 },
};

const sizeTextStyles: Record<Size, TextStyle> = {
  default: { fontSize: 14 },
  sm: { fontSize: 12 },
  lg: { fontSize: 16 },
};

export default function Button({
  onPress,
  disabled,
  loading,
  variant = 'default',
  size = 'default',
  children,
  style,
}: ButtonProps) {
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.7}
      style={[
        {
          borderRadius: 8,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          opacity: disabled || loading ? 0.5 : 1,
        },
        variantStyles[variant],
        sizeStyles[size],
        style,
      ]}
    >
      {loading && <ActivityIndicator size="small" color={variantTextStyles[variant].color} />}
      {typeof children === 'string' ? (
        <Text style={[{ fontWeight: '600' }, variantTextStyles[variant], sizeTextStyles[size]]}>
          {children}
        </Text>
      ) : (
        children
      )}
    </TouchableOpacity>
  );
}
