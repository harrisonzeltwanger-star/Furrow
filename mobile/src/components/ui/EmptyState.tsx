import { View, Text } from 'react-native';
import { Card, CardContent } from './Card';
import Button from './Button';

interface EmptyStateProps {
  title: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}

export default function EmptyState({ title, message, actionLabel, onAction }: EmptyStateProps) {
  return (
    <Card>
      <CardContent style={{ paddingVertical: 48, alignItems: 'center' }}>
        <Text style={{ fontSize: 18, color: '#7a6a5a', marginBottom: 8 }}>{title}</Text>
        <Text style={{ fontSize: 14, color: '#a09080', textAlign: 'center', paddingHorizontal: 20 }}>
          {message}
        </Text>
        {actionLabel && onAction && (
          <View style={{ marginTop: 16 }}>
            <Button onPress={onAction}>{actionLabel}</Button>
          </View>
        )}
      </CardContent>
    </Card>
  );
}
