import { useState, useEffect, useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, RefreshControl } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import api from '../../config/api';
import { useAuth } from '../../hooks/useAuth';
import type { NegotiationThread } from '../../types/models';
import Badge from '../../components/ui/Badge';
import FilterChip from '../../components/ui/FilterChip';
import EmptyState from '../../components/ui/EmptyState';
import LoadingScreen from '../../components/ui/LoadingScreen';

const statusBadgeVariant: Record<string, 'warning' | 'default' | 'destructive'> = {
  pending: 'warning',
  countered: 'default',
  rejected: 'destructive',
};

export default function NegotiationsScreen() {
  const { user } = useAuth();
  const navigation = useNavigation<NativeStackNavigationProp<{ NegotiationThread: { threadId: string } }>>();
  const [threads, setThreads] = useState<NegotiationThread[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [responseFilter, setResponseFilter] = useState<'all' | 'yours' | 'theirs'>('all');

  const orgId = user?.organizationId;

  const fetchThreads = useCallback(async () => {
    try {
      const { data } = await api.get('/negotiations');
      const active = (data.negotiations as NegotiationThread[]).filter((t) => {
        const latest = t.replies.length > 0 ? t.replies[0] : t;
        return latest.status !== 'accepted';
      });
      setThreads(active);
    } catch {
      // silent
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchThreads(); }, [fetchThreads]);

  const onRefresh = () => { setRefreshing(true); fetchThreads(); };

  const filtered = threads.filter((t) => {
    if (responseFilter === 'all') return true;
    const latest = t.replies.length > 0 ? t.replies[0] : t;
    const theyOffered = latest.offeredByOrgId !== orgId;
    return responseFilter === 'theirs' ? theyOffered : !theyOffered;
  });

  if (loading) return <LoadingScreen />;

  return (
    <View style={{ flex: 1, backgroundColor: '#faf8f4' }}>
      {/* Filter chips */}
      {threads.length > 0 && (
        <View style={{ flexDirection: 'row', paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4 }}>
          {(['all', 'theirs', 'yours'] as const).map((f) => {
            const label = f === 'all' ? 'All' : f === 'theirs' ? 'Needs Response' : 'Waiting';
            return (
              <FilterChip
                key={f}
                label={label}
                selected={responseFilter === f}
                onPress={() => setResponseFilter(f)}
              />
            );
          })}
        </View>
      )}

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: 16, paddingTop: 8 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#2d5a27" />}
        ListEmptyComponent={
          <EmptyState
            title="No active negotiations"
            message="Make an offer on a listing to start negotiating."
          />
        }
        renderItem={({ item: t }) => {
          const latest = t.replies.length > 0 ? t.replies[0] : t;
          const counterparty = t.buyerOrgId === orgId ? t.growerOrg.name : t.buyerOrg.name;
          const isWaiting = latest.offeredByOrgId === orgId;

          return (
            <TouchableOpacity
              onPress={() => navigation.navigate('NegotiationThread', { threadId: t.id })}
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
                      {t.listing.productType || counterparty}
                    </Text>
                    <Badge variant={statusBadgeVariant[latest.status] || 'secondary'}>
                      {latest.status}
                    </Badge>
                  </View>
                  <Text style={{ fontSize: 13, color: '#7a6a5a' }}>{counterparty}</Text>
                  <Text style={{ fontSize: 11, color: '#a09080', marginTop: 4 }}>
                    {isWaiting ? 'Waiting for response...' : 'Action needed'}
                  </Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={{ fontSize: 17, fontWeight: '700', color: '#3a2a1a' }}>${latest.offeredPricePerTon}</Text>
                  <Text style={{ fontSize: 11, color: '#7a6a5a' }}>per ton</Text>
                  {latest.offeredTons != null && (
                    <Text style={{ fontSize: 11, color: '#7a6a5a' }}>{latest.offeredTons} tons</Text>
                  )}
                </View>
              </View>
            </TouchableOpacity>
          );
        }}
      />
    </View>
  );
}
