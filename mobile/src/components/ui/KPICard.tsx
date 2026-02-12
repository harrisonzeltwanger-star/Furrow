import { View, Text } from 'react-native';
import { Card } from './Card';

interface KPICardProps {
  label: string;
  value: string | number;
  valueColor?: string;
  progress?: number; // 0-100
}

export default function KPICard({ label, value, valueColor, progress }: KPICardProps) {
  return (
    <Card>
      <View style={{ padding: 12 }}>
        <Text style={{ fontSize: 11, fontWeight: '500', color: '#7a6a5a' }}>{label}</Text>
        <Text
          style={{
            fontSize: 24,
            fontWeight: '700',
            color: valueColor || '#3a2a1a',
            marginTop: 2,
          }}
        >
          {value}
        </Text>
        {progress != null && (
          <View
            style={{
              height: 4,
              backgroundColor: '#ede8df',
              borderRadius: 2,
              overflow: 'hidden',
              marginTop: 6,
            }}
          >
            <View
              style={{
                height: '100%',
                width: `${Math.min(100, progress)}%`,
                backgroundColor: '#22c55e',
                borderRadius: 2,
              }}
            />
          </View>
        )}
      </View>
    </Card>
  );
}
