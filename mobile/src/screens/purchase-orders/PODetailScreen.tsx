import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  ScrollView,
  RefreshControl,
  Alert,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import { useAuth } from '../../hooks/useAuth';
import api from '../../config/api';
import type { PurchaseOrder, Delivery } from '../../types/models';
import { formatDate, formatDateTime } from '../../utils/formatters';
import type { POsStackParamList } from '../../navigation/PhoneTabNavigator';
import Button from '../../components/ui/Button';
import { Card, CardContent } from '../../components/ui/Card';
import KPICard from '../../components/ui/KPICard';
import Badge from '../../components/ui/Badge';
import Input from '../../components/ui/Input';
import LoadingScreen from '../../components/ui/LoadingScreen';
import ErrorBanner from '../../components/ui/ErrorBanner';

type ScreenRouteProp = RouteProp<POsStackParamList, 'PODetail'>;
type NavigationProp = NativeStackNavigationProp<POsStackParamList, 'PODetail'>;

export default function PODetailScreen() {
  const { user } = useAuth();
  const route = useRoute<ScreenRouteProp>();
  const navigation = useNavigation<NavigationProp>();
  const { poId } = route.params;

  const [po, setPO] = useState<PurchaseOrder | null>(null);
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [closingContract, setClosingContract] = useState<boolean>(false);

  // Center / Hay Class editing
  const [editingCenter, setEditingCenter] = useState<boolean>(false);
  const [editingHayClass, setEditingHayClass] = useState<boolean>(false);
  const [centerInput, setCenterInput] = useState<string>('');
  const [hayClassInput, setHayClassInput] = useState<string>('');
  const [centerSaving, setCenterSaving] = useState<boolean>(false);

  const orgId: string | undefined = user?.organizationId;
  const isFarmAdmin: boolean = user?.role === 'FARM_ADMIN';
  const isAdmin: boolean = user?.role === 'FARM_ADMIN' || user?.role === 'MANAGER';

  const fetchDetail = useCallback(async () => {
    try {
      const [detailRes, deliveriesRes] = await Promise.all([
        api.get(`/purchase-orders/${poId}`),
        api.get(`/purchase-orders/${poId}/deliveries`),
      ]);
      setPO(detailRes.data);
      setDeliveries(deliveriesRes.data.deliveries);
    } catch {
      // silent fail
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [poId]);

  useEffect(() => {
    fetchDetail();
  }, [fetchDetail]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchDetail();
  }, [fetchDetail]);

  // ---------- actions ----------

  const handleCloseContract = useCallback(() => {
    Alert.alert(
      'Close Contract',
      'Are you sure you want to close this contract? This will mark it as 100% delivered and move it to Closed Contracts.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Close',
          style: 'destructive',
          onPress: async () => {
            setClosingContract(true);
            try {
              await api.post(`/purchase-orders/${poId}/close`);
              navigation.goBack();
            } catch (err: unknown) {
              const axiosErr = err as { response?: { data?: { error?: { message?: string } } } };
              Alert.alert(
                'Error',
                axiosErr.response?.data?.error?.message || 'Failed to close contract',
              );
            } finally {
              setClosingContract(false);
            }
          },
        },
      ],
    );
  }, [poId, navigation]);

  const handleSaveCenter = useCallback(async () => {
    if (!centerInput.trim()) return;
    setCenterSaving(true);
    try {
      const body: { center: string; hayClass?: string } = { center: centerInput.trim() };
      if (hayClassInput.trim()) body.hayClass = hayClassInput.trim();
      await api.patch(`/purchase-orders/${poId}/center`, body);
      setPO((prev) =>
        prev
          ? { ...prev, center: body.center, hayClass: body.hayClass || prev.hayClass }
          : prev,
      );
      setEditingCenter(false);
      setCenterInput('');
      setHayClassInput('');
    } catch {
      Alert.alert('Error', 'Failed to save center');
    } finally {
      setCenterSaving(false);
    }
  }, [poId, centerInput, hayClassInput]);

  const handleSaveHayClass = useCallback(async () => {
    if (!hayClassInput.trim()) return;
    setCenterSaving(true);
    try {
      await api.patch(`/purchase-orders/${poId}/center`, { hayClass: hayClassInput.trim() });
      setPO((prev) => (prev ? { ...prev, hayClass: hayClassInput.trim() } : prev));
      setEditingHayClass(false);
      setHayClassInput('');
    } catch {
      Alert.alert('Error', 'Failed to save hay class');
    } finally {
      setCenterSaving(false);
    }
  }, [poId, hayClassInput]);

  // ---------- derived ----------

  const pctDelivered: number =
    po && po.contractedTons > 0
      ? Math.min(100, Math.round((po.deliveredTons / po.contractedTons) * 100))
      : 0;

  const counterparty: string =
    po && orgId
      ? po.buyerOrgId === orgId
        ? po.growerOrg.name
        : po.buyerOrg.name
      : '';

  const productType: string | undefined = po?.poStacks[0]?.listing.productType;

  // Delivery history aggregate stats
  const totalBalesD: number = deliveries.reduce((s, d) => s + (d.totalBaleCount ?? 0), 0);
  const totalWetD: number = deliveries.reduce((s, d) => s + (d.wetBalesCount ?? 0), 0);
  const totalNetLbsD: number = deliveries.reduce((s, d) => s + d.netWeight, 0);
  const avgLbsBaleD: number = totalBalesD > 0 ? totalNetLbsD / totalBalesD : 0;
  const wetPctD: number = totalBalesD > 0 ? (totalWetD / totalBalesD) * 100 : 0;

  // ---------- render ----------

  if (loading) {
    return <LoadingScreen message="Loading PO detail..." />;
  }

  if (!po) {
    return (
      <View style={styles.centered}>
        <Text style={styles.mutedText}>Purchase order not found.</Text>
      </View>
    );
  }

  const renderDeliveryItem = ({ item: d }: { item: Delivery }) => (
    <Card style={styles.deliveryCard}>
      <View style={styles.deliveryInner}>
        {/* Header */}
        <View style={styles.deliveryHeaderRow}>
          <Text style={styles.deliveryLoadNumber}>{d.loadNumber}</Text>
          <Text style={styles.deliveryDate}>
            {new Date(d.deliveryDatetime).toLocaleDateString()}
          </Text>
        </View>
        {/* Metrics row */}
        <View style={styles.deliveryMetrics}>
          <View style={styles.deliveryMetric}>
            <Text style={styles.metricLabel}>Net Weight</Text>
            <Text style={styles.metricValue}>{d.netWeight.toLocaleString()} lbs</Text>
            <Text style={styles.metricSub}>{(d.netWeight / 2000).toFixed(2)} tons</Text>
          </View>
          <View style={styles.deliveryMetric}>
            <Text style={styles.metricLabel}>Bales</Text>
            <Text style={styles.metricValue}>{d.totalBaleCount ?? '--'}</Text>
            {d.wetBalesCount > 0 && (
              <Text style={[styles.metricSub, { color: '#d97706' }]}>{d.wetBalesCount} wet</Text>
            )}
          </View>
          <View style={styles.deliveryMetric}>
            <Text style={styles.metricLabel}>lbs/Bale</Text>
            <Text style={styles.metricValue}>
              {d.avgBaleWeight > 0 ? Math.round(d.avgBaleWeight).toLocaleString() : '--'}
            </Text>
          </View>
          <View style={styles.deliveryMetric}>
            <Text style={styles.metricLabel}>Location</Text>
            <Text style={styles.metricValue} numberOfLines={1}>
              {d.qualityNotes || d.barn?.name || d.feedPad?.name || '--'}
            </Text>
          </View>
        </View>
        {/* Entered by */}
        <Text style={styles.enteredBy}>Entered by {d.enteredBy.name}</Text>
      </View>
    </Card>
  );

  return (
    <FlatList
      data={deliveries}
      keyExtractor={(item) => item.id}
      renderItem={renderDeliveryItem}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#2d5a27" />
      }
      style={styles.container}
      contentContainerStyle={styles.listContent}
      ListHeaderComponent={
        <>
          {/* PO Header */}
          <View style={styles.headerRow}>
            <View style={{ flex: 1 }}>
              <View style={styles.poNumberRow}>
                <Text style={styles.poTitle}>{po.poNumber || 'Purchase Order'}</Text>
                <Badge variant="success">ACTIVE</Badge>
              </View>
              <Text style={styles.poSubtitle}>
                {productType ? `${productType} \u00B7 ` : ''}
                {counterparty}
              </Text>
            </View>
          </View>

          {/* Center / Hay Class assignment banner (if no center) */}
          {!po.center && (
            <Card style={styles.warningBanner}>
              <View style={styles.warningInner}>
                <Text style={styles.warningTitle}>Assign Center & Hay Class</Text>
                <Text style={styles.warningMessage}>
                  This PO needs a center before you can track it properly.
                </Text>
                <Input
                  label="Center"
                  placeholder="Center name..."
                  value={centerInput}
                  onChangeText={setCenterInput}
                  containerStyle={styles.inputSpacing}
                />
                <Input
                  label="Hay Class (optional)"
                  placeholder="Hay class..."
                  value={hayClassInput}
                  onChangeText={setHayClassInput}
                  containerStyle={styles.inputSpacing}
                />
                <Button
                  size="sm"
                  onPress={handleSaveCenter}
                  disabled={!centerInput.trim() || centerSaving}
                  loading={centerSaving}
                  style={{ marginTop: 8 }}
                >
                  Save
                </Button>
              </View>
            </Card>
          )}

          {/* Editable Center / Hay Class (when already set) */}
          {po.center && (
            <View style={styles.centerRow}>
              {editingCenter ? (
                <View style={styles.inlineEdit}>
                  <Input
                    placeholder="Center..."
                    value={centerInput}
                    onChangeText={setCenterInput}
                    style={styles.inlineInput}
                    containerStyle={{ flex: 1 }}
                  />
                  <Button
                    size="sm"
                    onPress={() => {
                      if (centerInput.trim()) {
                        setCenterSaving(true);
                        api
                          .patch(`/purchase-orders/${poId}/center`, { center: centerInput.trim() })
                          .then(() => {
                            setPO((prev) =>
                              prev ? { ...prev, center: centerInput.trim() } : prev,
                            );
                            setEditingCenter(false);
                            setCenterInput('');
                          })
                          .catch(() => Alert.alert('Error', 'Failed to update center'))
                          .finally(() => setCenterSaving(false));
                      }
                    }}
                    disabled={!centerInput.trim() || centerSaving}
                    loading={centerSaving}
                  >
                    Save
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onPress={() => {
                      setEditingCenter(false);
                      setCenterInput('');
                    }}
                  >
                    Cancel
                  </Button>
                </View>
              ) : (
                <Text
                  style={styles.editableField}
                  onPress={() => {
                    setCenterInput(po.center || '');
                    setEditingCenter(true);
                  }}
                >
                  Center: <Text style={styles.editableValue}>{po.center}</Text>
                </Text>
              )}

              {editingHayClass ? (
                <View style={[styles.inlineEdit, { marginTop: 8 }]}>
                  <Input
                    placeholder="Hay class..."
                    value={hayClassInput}
                    onChangeText={setHayClassInput}
                    style={styles.inlineInput}
                    containerStyle={{ flex: 1 }}
                  />
                  <Button
                    size="sm"
                    onPress={handleSaveHayClass}
                    disabled={!hayClassInput.trim() || centerSaving}
                    loading={centerSaving}
                  >
                    Save
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onPress={() => {
                      setEditingHayClass(false);
                      setHayClassInput('');
                    }}
                  >
                    Cancel
                  </Button>
                </View>
              ) : (
                <Text
                  style={[styles.editableField, { marginTop: 6 }]}
                  onPress={() => {
                    setHayClassInput(po.hayClass || '');
                    setEditingHayClass(true);
                  }}
                >
                  Hay Class:{' '}
                  <Text style={styles.editableValue}>{po.hayClass || 'Tap to set'}</Text>
                </Text>
              )}
            </View>
          )}

          {/* KPI Row */}
          <View style={styles.kpiRow}>
            <View style={styles.kpiItem}>
              <KPICard label="Price/Ton" value={`$${po.pricePerTon}`} />
            </View>
            <View style={styles.kpiItem}>
              <KPICard label="Contracted" value={`${po.contractedTons} T`} />
            </View>
          </View>
          <View style={styles.kpiRow}>
            <View style={styles.kpiItem}>
              <KPICard label="Delivered" value={`${po.deliveredTons} T`} />
            </View>
            <View style={styles.kpiItem}>
              <KPICard
                label="Remaining"
                value={`${Math.max(0, po.contractedTons - po.deliveredTons)} T`}
              />
            </View>
          </View>

          {/* Progress bar */}
          <View style={styles.progressSection}>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${pctDelivered}%` }]} />
            </View>
            <Text style={styles.progressLabel}>{pctDelivered}% delivered</Text>
          </View>

          {/* Contract Terms */}
          <Card style={styles.termsCard}>
            <View style={styles.termsInner}>
              <Text style={styles.sectionTitle}>Contract Terms</Text>
              <View style={styles.termsGrid}>
                <View style={styles.termItem}>
                  <Text style={styles.termLabel}>Delivery Window</Text>
                  <Text style={styles.termValue}>
                    {formatDate(po.deliveryStartDate)} \u2014 {formatDate(po.deliveryEndDate)}
                  </Text>
                </View>
                <View style={styles.termItem}>
                  <Text style={styles.termLabel}>Max Moisture</Text>
                  <Text style={styles.termValue}>
                    {po.maxMoisturePercent != null ? `${po.maxMoisturePercent}%` : '--'}
                  </Text>
                </View>
                <View style={styles.termItem}>
                  <Text style={styles.termLabel}>Signed</Text>
                  <Text style={styles.termValue}>{formatDate(po.signedAt)}</Text>
                </View>
                <View style={styles.termItem}>
                  <Text style={styles.termLabel}>Parties</Text>
                  <Text style={styles.termValue} numberOfLines={1}>
                    {po.buyerOrg.name} / {po.growerOrg.name}
                  </Text>
                </View>
                <View style={styles.termItem}>
                  <Text style={styles.termLabel}>Total Value</Text>
                  <Text style={styles.termValue}>
                    ${(po.pricePerTon * po.contractedTons).toLocaleString()}
                  </Text>
                </View>
              </View>
              {po.qualityNotes ? (
                <View style={{ marginTop: 8 }}>
                  <Text style={styles.termLabel}>Quality Notes</Text>
                  <Text style={styles.termValue}>{po.qualityNotes}</Text>
                </View>
              ) : null}
            </View>
          </Card>

          {/* Action buttons */}
          <View style={styles.actionRow}>
            <Button
              onPress={() => navigation.navigate('LogDelivery', { poId })}
              style={{ flex: 1 }}
            >
              Log Delivery
            </Button>
            {isFarmAdmin && (
              <Button
                variant="destructive"
                onPress={handleCloseContract}
                disabled={closingContract}
                loading={closingContract}
                style={{ flex: 1 }}
              >
                Close Contract
              </Button>
            )}
          </View>

          {/* Delivery History header + aggregate stats */}
          <Text style={styles.sectionTitle}>
            Delivery History ({deliveries.length})
          </Text>
          {deliveries.length > 0 && (
            <View style={styles.deliveryStatsRow}>
              <View style={styles.deliveryStat}>
                <Text style={styles.metricLabel}>Avg lbs/Bale</Text>
                <Text style={styles.deliveryStatValue}>
                  {avgLbsBaleD > 0 ? Math.round(avgLbsBaleD).toLocaleString() : '--'}
                </Text>
              </View>
              <View style={styles.deliveryStat}>
                <Text style={styles.metricLabel}>Wet Bales</Text>
                <Text
                  style={[
                    styles.deliveryStatValue,
                    totalWetD > 0 ? { color: '#d97706' } : {},
                  ]}
                >
                  {totalWetD.toLocaleString()}
                </Text>
              </View>
              <View style={styles.deliveryStat}>
                <Text style={styles.metricLabel}>% Wet</Text>
                <Text
                  style={[
                    styles.deliveryStatValue,
                    wetPctD > 5
                      ? { color: '#dc2626' }
                      : wetPctD > 0
                      ? { color: '#d97706' }
                      : {},
                  ]}
                >
                  {wetPctD.toFixed(1)}%
                </Text>
              </View>
            </View>
          )}
        </>
      }
      ListEmptyComponent={
        <Text style={styles.emptyDeliveries}>No deliveries logged yet.</Text>
      }
      ListFooterComponent={<View style={{ height: 32 }} />}
    />
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#faf8f4',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#faf8f4',
  },
  mutedText: {
    fontSize: 14,
    color: '#7a6a5a',
  },
  listContent: {
    padding: 16,
  },
  headerRow: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  poNumberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  poTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#3a2a1a',
  },
  poSubtitle: {
    fontSize: 14,
    color: '#7a6a5a',
    marginTop: 4,
  },
  warningBanner: {
    borderColor: '#fbbf24',
    borderWidth: 2,
    backgroundColor: '#fffbeb',
    marginBottom: 16,
  },
  warningInner: {
    padding: 16,
  },
  warningTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#92400e',
    marginBottom: 4,
  },
  warningMessage: {
    fontSize: 12,
    color: '#b45309',
    marginBottom: 12,
  },
  inputSpacing: {
    marginBottom: 8,
  },
  centerRow: {
    marginBottom: 16,
  },
  editableField: {
    fontSize: 13,
    color: '#7a6a5a',
  },
  editableValue: {
    fontWeight: '600',
    color: '#3a2a1a',
  },
  inlineEdit: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  inlineInput: {
    fontSize: 13,
    paddingVertical: 6,
  },
  kpiRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  kpiItem: {
    flex: 1,
  },
  progressSection: {
    marginTop: 4,
    marginBottom: 16,
  },
  progressTrack: {
    height: 6,
    backgroundColor: '#ede8df',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#22c55e',
    borderRadius: 3,
  },
  progressLabel: {
    fontSize: 12,
    color: '#7a6a5a',
    marginTop: 4,
  },
  termsCard: {
    marginBottom: 16,
  },
  termsInner: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#3a2a1a',
    marginBottom: 12,
  },
  termsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  termItem: {
    width: '47%',
  },
  termLabel: {
    fontSize: 11,
    color: '#7a6a5a',
    marginBottom: 2,
  },
  termValue: {
    fontSize: 14,
    fontWeight: '500',
    color: '#3a2a1a',
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 20,
  },
  deliveryStatsRow: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 12,
  },
  deliveryStat: {
    alignItems: 'flex-start',
  },
  deliveryStatValue: {
    fontSize: 15,
    fontWeight: '600',
    color: '#3a2a1a',
  },
  deliveryCard: {
    marginBottom: 8,
  },
  deliveryInner: {
    padding: 14,
  },
  deliveryHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  deliveryLoadNumber: {
    fontSize: 14,
    fontWeight: '600',
    color: '#3a2a1a',
  },
  deliveryDate: {
    fontSize: 12,
    color: '#7a6a5a',
  },
  deliveryMetrics: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  deliveryMetric: {
    width: '45%',
    marginBottom: 4,
  },
  metricLabel: {
    fontSize: 11,
    color: '#7a6a5a',
    marginBottom: 1,
  },
  metricValue: {
    fontSize: 14,
    fontWeight: '500',
    color: '#3a2a1a',
  },
  metricSub: {
    fontSize: 11,
    color: '#7a6a5a',
  },
  enteredBy: {
    fontSize: 11,
    color: '#a09080',
    marginTop: 8,
  },
  emptyDeliveries: {
    fontSize: 14,
    color: '#7a6a5a',
    paddingVertical: 8,
  },
});
