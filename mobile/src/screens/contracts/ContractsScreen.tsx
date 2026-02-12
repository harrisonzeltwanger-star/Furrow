import { useState, useEffect, useMemo, useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, RefreshControl } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import api from '../../config/api';
import { useAuth } from '../../hooks/useAuth';
import Badge from '../../components/ui/Badge';
import SelectPicker from '../../components/ui/SelectPicker';
import EmptyState from '../../components/ui/EmptyState';
import LoadingScreen from '../../components/ui/LoadingScreen';

interface CompletedPO {
  id: string;
  poNumber: string | null;
  status: string;
  center: string | null;
  buyerOrgId: string;
  growerOrgId: string;
  buyerOrg: { id: string; name: string };
  growerOrg: { id: string; name: string };
  pricePerTon: number;
  contractedTons: number;
  deliveredTons: number;
  completedAt: string | null;
  poStacks: Array<{ listing: { stackId: string; productType: string | null } }>;
}

export default function ContractsScreen() {
  const { user } = useAuth();
  const navigation = useNavigation<NativeStackNavigationProp<{ ContractDetail: { poId: string } }>>();
  const orgId = user?.organizationId;

  const [pos, setPOs] = useState<CompletedPO[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [centerFilter, setCenterFilter] = useState('all');

  const fetchPOs = useCallback(async () => {
    try {
      const { data } = await api.get('/purchase-orders');
      const completed = (data.purchaseOrders as CompletedPO[]).filter(
        (p) => p.status === 'COMPLETED'
      );
      setPOs(completed);
    } catch {
      // silent
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchPOs(); }, [fetchPOs]);

  const onRefresh = () => { setRefreshing(true); fetchPOs(); };

  const centerOptions = useMemo(() => {
    const set = new Set<string>();
    pos.forEach((p) => { if (p.center) set.add(p.center); });
    return Array.from(set).sort();
  }, [pos]);

  const filtered = useMemo(() => {
    if (centerFilter === 'all') return pos;
    return pos.filter((p) => p.center === centerFilter);
  }, [pos, centerFilter]);

  if (loading) return <LoadingScreen />;

  return (
    <View style={{ flex: 1, backgroundColor: '#faf8f4' }}>
      {/* Center filter */}
      {pos.length > 0 && centerOptions.length > 0 && (
        <View style={{ paddingHorizontal: 16, paddingTop: 12 }}>
          <SelectPicker
            value={centerFilter}
            options={[
              { label: 'All Centers', value: 'all' },
              ...centerOptions.map((c) => ({ label: c, value: c })),
            ]}
            onValueChange={setCenterFilter}
          />
        </View>
      )}

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: 16, paddingTop: 8 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#2d5a27" />}
        ListEmptyComponent={
          <EmptyState
            title="No completed contracts"
            message={pos.length === 0
              ? 'Contracts appear here once a purchase order has been closed.'
              : 'Try adjusting your filter.'}
          />
        }
        renderItem={({ item: p }) => {
          const counterparty = p.buyerOrg.id === orgId ? p.growerOrg.name : p.buyerOrg.name;
          const productType = p.poStacks[0]?.listing.productType;

          return (
            <TouchableOpacity
              onPress={() => navigation.navigate('ContractDetail', { poId: p.id })}
              activeOpacity={0.7}
              style={{
                backgroundColor: '#fdfcf8',
                borderRadius: 12,
                borderWidth: 1,
                borderColor: '#d8cebb',
                padding: 14,
                marginBottom: 10,
              }}
            >
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <View style={{ flex: 1, marginRight: 12 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <Text style={{ fontSize: 15, fontWeight: '600', color: '#3a2a1a' }}>
                      {p.poNumber || 'PO'}
                    </Text>
                    <Badge variant="default">COMPLETED</Badge>
                  </View>
                  <Text style={{ fontSize: 13, color: '#7a6a5a' }}>
                    {productType ? `${productType} · ` : ''}{counterparty}
                  </Text>
                  {p.completedAt && (
                    <Text style={{ fontSize: 11, color: '#a09080', marginTop: 4 }}>
                      Closed {new Date(p.completedAt).toLocaleDateString()}
                    </Text>
                  )}
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={{ fontSize: 17, fontWeight: '700', color: '#3a2a1a' }}>${p.pricePerTon}</Text>
                  <Text style={{ fontSize: 11, color: '#7a6a5a' }}>per ton</Text>
                  <Text style={{ fontSize: 11, color: '#7a6a5a' }}>{p.contractedTons} tons</Text>
                </View>
              </View>
            </TouchableOpacity>
          );
        }}
      />
    </View>
  );
}
