import { View, Text, TouchableOpacity, Modal, FlatList, SafeAreaView } from 'react-native';
import { useState } from 'react';

interface Option {
  label: string;
  value: string;
}

interface SelectPickerProps {
  label?: string;
  value: string;
  options: Option[];
  onValueChange: (value: string) => void;
  placeholder?: string;
}

export default function SelectPicker({ label, value, options, onValueChange, placeholder }: SelectPickerProps) {
  const [visible, setVisible] = useState(false);
  const selectedLabel = options.find((o) => o.value === value)?.label || placeholder || 'Select...';

  return (
    <View>
      {label && (
        <Text style={{ fontSize: 13, fontWeight: '500', color: '#3a2a1a', marginBottom: 6 }}>
          {label}
        </Text>
      )}
      <TouchableOpacity
        onPress={() => setVisible(true)}
        style={{
          borderWidth: 1,
          borderColor: '#d8cebb',
          borderRadius: 8,
          paddingHorizontal: 12,
          paddingVertical: 10,
          backgroundColor: '#ffffff',
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <Text style={{ fontSize: 15, color: value ? '#3a2a1a' : '#a09080' }}>
          {selectedLabel}
        </Text>
        <Text style={{ color: '#a09080' }}>▼</Text>
      </TouchableOpacity>

      <Modal visible={visible} transparent animationType="slide">
        <SafeAreaView style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: '#fdfcf8', borderTopLeftRadius: 16, borderTopRightRadius: 16, maxHeight: '60%' }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1, borderBottomColor: '#d8cebb' }}>
              <Text style={{ fontSize: 16, fontWeight: '600', color: '#3a2a1a' }}>{label || 'Select'}</Text>
              <TouchableOpacity onPress={() => setVisible(false)}>
                <Text style={{ fontSize: 16, color: '#2d5a27', fontWeight: '600' }}>Done</Text>
              </TouchableOpacity>
            </View>
            <FlatList
              data={options}
              keyExtractor={(item) => item.value}
              renderItem={({ item }) => (
                <TouchableOpacity
                  onPress={() => {
                    onValueChange(item.value);
                    setVisible(false);
                  }}
                  style={{
                    paddingHorizontal: 16,
                    paddingVertical: 14,
                    borderBottomWidth: 1,
                    borderBottomColor: '#f0ece4',
                    backgroundColor: item.value === value ? '#e8f5e3' : 'transparent',
                  }}
                >
                  <Text style={{ fontSize: 15, color: '#3a2a1a', fontWeight: item.value === value ? '600' : '400' }}>
                    {item.label}
                  </Text>
                </TouchableOpacity>
              )}
            />
          </View>
        </SafeAreaView>
      </Modal>
    </View>
  );
}
