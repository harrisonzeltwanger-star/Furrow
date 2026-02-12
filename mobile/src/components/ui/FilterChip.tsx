import { TouchableOpacity, Text } from 'react-native';

interface FilterChipProps {
  label: string;
  selected: boolean;
  onPress: () => void;
}

export default function FilterChip({ label, selected, onPress }: FilterChipProps) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      style={{
        paddingHorizontal: 14,
        paddingVertical: 7,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: selected ? '#2d5a27' : '#d8cebb',
        backgroundColor: selected ? '#2d5a27' : 'transparent',
        marginRight: 8,
      }}
    >
      <Text
        style={{
          fontSize: 13,
          fontWeight: '500',
          color: selected ? '#f0faf0' : '#5a4a3a',
        }}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}
