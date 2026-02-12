import { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
  StyleSheet,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import api from '../../config/api';
import type { POsStackParamList } from '../../navigation/PhoneTabNavigator';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import { Card } from '../../components/ui/Card';
import ErrorBanner from '../../components/ui/ErrorBanner';

type ScreenRouteProp = RouteProp<POsStackParamList, 'LogDelivery'>;
type NavigationProp = NativeStackNavigationProp<POsStackParamList, 'LogDelivery'>;

interface DeliveryFormState {
  totalBaleCount: string;
  wetBalesCount: string;
  grossWeight: string;
  tareWeight: string;
  location: string;
}

export default function LogDeliveryScreen() {
  const route = useRoute<ScreenRouteProp>();
  const navigation = useNavigation<NavigationProp>();
  const { poId } = route.params;

  const [form, setForm] = useState<DeliveryFormState>({
    totalBaleCount: '',
    wetBalesCount: '',
    grossWeight: '',
    tareWeight: '',
    location: '',
  });
  const [saving, setSaving] = useState<boolean>(false);
  const [error, setError] = useState<string>('');

  // Computed preview values
  const grossNum: number = parseFloat(form.grossWeight) || 0;
  const tareNum: number = parseFloat(form.tareWeight) || 0;
  const baleNum: number = parseInt(form.totalBaleCount, 10) || 0;
  const netWeight: number = grossNum - tareNum;
  const avgBaleWeight: number = baleNum > 0 && netWeight > 0 ? netWeight / baleNum : 0;

  const canSubmit: boolean = baleNum > 0 && grossNum > 0 && tareNum > 0 && netWeight > 0 && !saving;

  const updateField = useCallback(
    (field: keyof DeliveryFormState) => (value: string) => {
      setForm((prev) => ({ ...prev, [field]: value }));
    },
    [],
  );

  const handleSubmit = useCallback(async () => {
    if (!canSubmit) return;

    setSaving(true);
    setError('');

    try {
      await api.post(`/purchase-orders/${poId}/deliveries`, {
        totalBaleCount: parseInt(form.totalBaleCount, 10),
        wetBalesCount: parseInt(form.wetBalesCount || '0', 10),
        grossWeight: parseFloat(form.grossWeight),
        tareWeight: parseFloat(form.tareWeight),
        location: form.location || undefined,
      });
      navigation.goBack();
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: { message?: string } } } };
      setError(axiosErr.response?.data?.error?.message || 'Failed to log delivery');
    } finally {
      setSaving(false);
    }
  }, [canSubmit, form, poId, navigation]);

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={100}
    >
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.title}>Log Delivery</Text>
        <Text style={styles.subtitle}>
          Enter the load details. All weights are in pounds (lbs).
        </Text>

        {error ? <ErrorBanner message={error} /> : null}

        {/* Number of Bales */}
        <Input
          label="Number of Bales *"
          placeholder="24"
          keyboardType="number-pad"
          value={form.totalBaleCount}
          onChangeText={updateField('totalBaleCount')}
          containerStyle={styles.fieldSpacing}
          style={styles.largeInput}
        />

        {/* Wet Bales */}
        <Input
          label="Wet Bales"
          placeholder="0"
          keyboardType="number-pad"
          value={form.wetBalesCount}
          onChangeText={updateField('wetBalesCount')}
          containerStyle={styles.fieldSpacing}
          style={styles.largeInput}
        />

        {/* Gross Weight */}
        <Input
          label="Full Weight (lbs) *"
          placeholder="52000"
          keyboardType="numeric"
          value={form.grossWeight}
          onChangeText={updateField('grossWeight')}
          containerStyle={styles.fieldSpacing}
          style={styles.largeInput}
        />

        {/* Tare Weight */}
        <Input
          label="Empty Weight (lbs) *"
          placeholder="16000"
          keyboardType="numeric"
          value={form.tareWeight}
          onChangeText={updateField('tareWeight')}
          containerStyle={styles.fieldSpacing}
          style={styles.largeInput}
        />

        {/* Pad / Barn / Location */}
        <Input
          label="Pad / Barn #"
          placeholder="Barn or Pad name"
          value={form.location}
          onChangeText={updateField('location')}
          containerStyle={styles.fieldSpacing}
          style={styles.largeInput}
        />

        {/* Live Preview Card */}
        {grossNum > 0 && tareNum > 0 && (
          <Card style={styles.previewCard}>
            <View style={styles.previewInner}>
              <View style={styles.previewRow}>
                <View style={styles.previewItem}>
                  <Text style={styles.previewLabel}>Net Weight</Text>
                  <Text style={styles.previewValue}>
                    {netWeight > 0 ? netWeight.toLocaleString() : '--'} lbs
                  </Text>
                  {netWeight > 0 && (
                    <Text style={styles.previewSub}>
                      {(netWeight / 2000).toFixed(2)} tons
                    </Text>
                  )}
                </View>
                <View style={styles.previewItem}>
                  <Text style={styles.previewLabel}>lbs / Bale</Text>
                  <Text style={styles.previewValue}>
                    {avgBaleWeight > 0 ? Math.round(avgBaleWeight).toLocaleString() : '--'}
                  </Text>
                </View>
                <View style={styles.previewItem}>
                  <Text style={styles.previewLabel}>Bales</Text>
                  <Text style={styles.previewValue}>{baleNum || '--'}</Text>
                </View>
              </View>
            </View>
          </Card>
        )}

        {/* Net weight warning */}
        {grossNum > 0 && tareNum > 0 && netWeight <= 0 && (
          <ErrorBanner message="Net weight must be positive. Check your full and empty weights." />
        )}

        {/* Submit */}
        <View style={styles.submitRow}>
          <Button
            onPress={handleSubmit}
            disabled={!canSubmit}
            loading={saving}
            size="lg"
            style={styles.submitButton}
          >
            Save Delivery
          </Button>
          <Button
            variant="outline"
            onPress={() => navigation.goBack()}
            size="lg"
            style={styles.cancelButton}
          >
            Cancel
          </Button>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  container: {
    flex: 1,
    backgroundColor: '#faf8f4',
  },
  scrollContent: {
    padding: 20,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#3a2a1a',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 13,
    color: '#7a6a5a',
    marginBottom: 20,
  },
  fieldSpacing: {
    marginBottom: 16,
  },
  largeInput: {
    fontSize: 18,
    paddingVertical: 14,
    paddingHorizontal: 14,
  },
  previewCard: {
    marginBottom: 16,
    backgroundColor: '#f5f0e6',
    borderColor: '#d8cebb',
  },
  previewInner: {
    padding: 16,
  },
  previewRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  previewItem: {
    flex: 1,
    alignItems: 'center',
  },
  previewLabel: {
    fontSize: 11,
    color: '#7a6a5a',
    marginBottom: 2,
  },
  previewValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#3a2a1a',
  },
  previewSub: {
    fontSize: 12,
    color: '#7a6a5a',
    marginTop: 1,
  },
  submitRow: {
    gap: 10,
    marginTop: 8,
  },
  submitButton: {
    width: '100%',
  },
  cancelButton: {
    width: '100%',
  },
});
