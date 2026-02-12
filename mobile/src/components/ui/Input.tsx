import { TextInput, View, Text, type TextInputProps, type ViewStyle } from 'react-native';

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  containerStyle?: ViewStyle;
}

export default function Input({ label, error, containerStyle, style, ...props }: InputProps) {
  return (
    <View style={containerStyle}>
      {label && (
        <Text style={{ fontSize: 13, fontWeight: '500', color: '#3a2a1a', marginBottom: 6 }}>
          {label}
        </Text>
      )}
      <TextInput
        placeholderTextColor="#a09080"
        style={[
          {
            borderWidth: 1,
            borderColor: error ? '#b33a1a' : '#d8cebb',
            borderRadius: 8,
            paddingHorizontal: 12,
            paddingVertical: 10,
            fontSize: 15,
            color: '#3a2a1a',
            backgroundColor: '#ffffff',
          },
          style,
        ]}
        {...props}
      />
      {error && (
        <Text style={{ fontSize: 12, color: '#b33a1a', marginTop: 4 }}>{error}</Text>
      )}
    </View>
  );
}
