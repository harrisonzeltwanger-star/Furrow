import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuth } from '../../hooks/useAuth';
import api from '../../config/api';
import type { PurchaseOrder } from '../../types/models';
import type { POsStackParamList } from '../../navigation/PhoneTabNavigator';
import KPICard from '../../components/ui/KPICard';
import FilterChip from '../../components/ui/FilterChip';
import LoadingScreen from '../../components/ui/LoadingScreen';
import EmptyState from '../../components/ui/EmptyState';
import Badge from '../../components/ui/Badge';
import { Card } from '../../components/ui/Card';

type NavigationProp = NativeStackNavigationProp<POsStackParamList, 'ActivePOs'>;

export default function ActivePOsScreen() {
  const { user } = useAuth();
  const navigation = useNavigation<NavigationProp>();

  const [pos, setPOs] = useState<PurchaseOrder[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [centerFilter, setCenterFilter] = useState<string>('all');

  const orgId: string | undefined = user?.organizationId;

  const fetchPOs = useCallback(async () => {
    try {
      const { data } = await api.get('/purchase-orders');
      const active = (data.purchaseOrders as PurchaseOrder[]).filter(
        (p) => p.status === 'ACTIVE',
      );
      setPOs(active);
    } catch {
      // silent fail
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchPOs();
  }, [fetchPOs]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchPOs();
  }, [fetchPOs]);

  // ---------- derived data ----------

  const productTypes = useMemo<string[]>(() => {
    const set = new Set<string>();
    pos.forEach((p) => {
      const pt = p.poStacks[0]?.listing.productType;
      if (pt) set.add(pt);
    });
    return Array.from(set).sort();
  }, [pos]);

  const centers = useMemo<string[]>(() => {
    const set = new Set<string>();
    pos.forEach((p) => {
      if (p.center) set.add(p.center);
    });
    return Array.from(set).sort();
  }, [pos]);

  const filteredPOs = useMemo<PurchaseOrder[]>(() => {
    return pos.filter((p) => {
      if (typeFilter !== 'all' && p.poStacks[0]?.listing.productType !== typeFilter) return false;
      if (centerFilter !== 'all' && p.center !== centerFilter) return false;
      return true;
    });
  }, [pos, typeFilter, centerFilter]);

  const totalContractedTons = useMemo<number>(
    () => filteredPOs.reduce((sum, p) => sum + p.contractedTons, 0),
    [filteredPOs],
  );

  const overallPct = useMemo<number>(() => {
    if (filteredPOs.length === 0) return 0;
    const sum = filteredPOs.reduce((acc, p) => {
      const pct = p.contractedTons > 0 ? Math.min(100, (p.deliveredTons / p.contractedTons) * 100) : 0;
      return acc + pct;
    }, 0);
    return Math.floor(sum / filteredPOs.length);
  }, [filteredPOs]);

  // ---------- render helpers ----------

  const renderPOCard = useCallback(
    ({ item: p }: { item: PurchaseOrder }) => {
      const counterparty = p.buyerOrgId === orgId ? p.growerOrg.name : p.buyerOrg.name;
      const productType = p.poStacks[0]?.listing.productType;
      const pctDelivered =
        p.contractedTons > 0
          ? Math.min(100, Math.round((p.deliveredTons / p.contractedTons) * 100))
          : 0;

      return (
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => navigation.navigate('PODetail', { poId: p.id })}
          style={styles.cardTouchable}
        >
          <Card>
            <View style={styles.cardInner}>
              {/* Top row: PO number + badge */}
              <View style={styles.cardTopRow}>
                <View style={styles.cardTopLeft}>
                  <Text style={styles.poNumber} numberOfLines={1}>
                    {p.poNumber || 'PO'}
                  </Text>
                  <Badge variant="success">ACTIVE</Badge>
                </View>
                <View style={styles.cardTopRight}>
                  <Text style={styles.priceText}>${p.pricePerTon}</Text>
                  <Text style={styles.tonsText}>{p.contractedTons} tons</Text>
                </View>
              </View>

              {/* Subtitle */}
              <Text style={styles.subtitleText} numberOfLines={1}>
                {productType ? `${productType} \u00B7 ` : ''}
                {counterparty}
              </Text>

              {/* Progress bar */}
              <View style={styles.progressContainer}>
                <View style={styles.progressTrack}>
                  <View style={[styles.progressFill, { width: `${pctDelivered}%` }]} />
                </View>
                <Text style={styles.progressLabel}>{pctDelivered}% delivered</Text>
              </View>
            </View>
          </Card>
        </TouchableOpacity>
      );
    },
    [orgId, navigation],
  );

  // ---------- loading state ----------

  if (loading) {
    return <LoadingScreen message="Loading active purchase orders..." />;
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={filteredPOs}
        keyExtractor={(item) => item.id}
        renderItem={renderPOCard}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#2d5a27" />
        }
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <>
            {/* Title */}
            <Text style={styles.title}>Active Purchase Orders</Text>
            <Text style={styles.subtitle}>
              Fully signed purchase orders. Log deliveries and track progress.
            </Text>

            {/* Filter chips */}
            {pos.length > 0 && (
              <>
                {/* Product Type filter row */}
                <Text style={styles.filterLabel}>Product Type</Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={styles.filterRow}
                >
                  <FilterChip
                    label="All Types"
                    selected={typeFilter === 'all'}
                    onPress={() => setTypeFilter('all')}
                  />
                  {productTypes.map((pt) => (
                    <FilterChip
                      key={pt}
                      label={pt}
                      selected={typeFilter === pt}
                      onPress={() => setTypeFilter(pt)}
                    />
                  ))}
                </ScrollView>

                {/* Center filter row */}
                {centers.length > 0 && (
                  <>
                    <Text style={styles.filterLabel}>Center</Text>
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      style={styles.filterRow}
                    >
                      <FilterChip
                        label="All Centers"
                        selected={centerFilter === 'all'}
                        onPress={() => setCenterFilter('all')}
                      />
                      {centers.map((c) => (
                        <FilterChip
                          key={c}
                          label={c}
                          selected={centerFilter === c}
                          onPress={() => setCenterFilter(c)}
                        />
                      ))}
                    </ScrollView>
                  </>
                )}

                {/* KPI summary row */}
                <View style={styles.kpiRow}>
                  <View style={styles.kpiItem}>
                    <KPICard label="Active POs" value={filteredPOs.length} />
                  </View>
                  <View style={styles.kpiItem}>
                    <KPICard label="Contracted Tons" value={totalContractedTons.toLocaleString()} />
                  </View>
                  <View style={styles.kpiItem}>
                    <KPICard label="Overall % Complete" value={`${overallPct}%`} progress={overallPct} />
                  </View>
                </View>
              </>
            )}
          </>
        }
        ListEmptyComponent={
          <EmptyState
            title="No active purchase orders"
            message={
              pos.length === 0
                ? 'Purchase orders appear here once both parties have signed the contract.'
                : 'Try adjusting your filter.'
            }
          />
        }
        ListFooterComponent={<View style={{ height: 32 }} />}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#faf8f4',
  },
  listContent: {
    padding: 16,
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
    marginBottom: 16,
  },
  filterLabel: {
    fontSize: 11,
    fontWeight: '500',
    color: '#7a6a5a',
    marginBottom: 6,
    marginTop: 4,
  },
  filterRow: {
    marginBottom: 12,
  },
  kpiRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
    marginTop: 4,
  },
  kpiItem: {
    flex: 1,
  },
  cardTouchable: {
    marginBottom: 10,
  },
  cardInner: {
    padding: 16,
  },
  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  cardTopLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
    marginRight: 12,
  },
  cardTopRight: {
    alignItems: 'flex-end',
  },
  poNumber: {
    fontSize: 16,
    fontWeight: '600',
    color: '#3a2a1a',
    flexShrink: 1,
  },
  priceText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#3a2a1a',
  },
  tonsText: {
    fontSize: 12,
    color: '#7a6a5a',
    marginTop: 2,
  },
  subtitleText: {
    fontSize: 13,
    color: '#7a6a5a',
    marginTop: 6,
  },
  progressContainer: {
    marginTop: 10,
  },
  progressTrack: {
    height: 5,
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
    fontSize: 11,
    color: '#7a6a5a',
    marginTop: 4,
  },
});
