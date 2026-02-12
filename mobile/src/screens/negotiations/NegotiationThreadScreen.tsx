import { useState, useEffect, useCallback } from 'react';
import { View, Text, FlatList, Alert, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import api from '../../config/api';
import { useAuth } from '../../hooks/useAuth';
import type { NegotiationMessage } from '../../types/models';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Badge from '../../components/ui/Badge';
import ErrorBanner from '../../components/ui/ErrorBanner';
import LoadingScreen from '../../components/ui/LoadingScreen';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/Card';

type RouteParams = { NegotiationThread: { threadId: string } };

export default function NegotiationThreadScreen() {
  const route = useRoute<RouteProp<RouteParams, 'NegotiationThread'>>();
  const { threadId } = route.params;
  const { user } = useAuth();
  const orgId = user?.organizationId;
  const isAdmin = user?.role === 'FARM_ADMIN';

  const [messages, setMessages] = useState<NegotiationMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState('');
  const [showCounter, setShowCounter] = useState(false);
  const [counterPrice, setCounterPrice] = useState('');
  const [counterTons, setCounterTons] = useState('');
  const [counterMessage, setCounterMessage] = useState('');

  const fetchThread = useCallback(async () => {
    try {
      const { data } = await api.get(`/negotiations/${threadId}`);
      setMessages(data.thread);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [threadId]);

  useEffect(() => { fetchThread(); }, [fetchThread]);

  const latestPending = messages.filter((m) => m.status === 'pending').slice(-1)[0] || null;
  const canAct = latestPending && latestPending.offeredByOrgId !== orgId;

  const handleAccept = async () => {
    if (!latestPending) return;
    Alert.alert('Accept Offer', 'Accept this offer and create a purchase order?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Accept',
        onPress: async () => {
          setActionLoading(true);
          setActionError('');
          try {
            const { data } = await api.post(`/negotiations/${latestPending.id}/accept`);
            const poId = data.purchaseOrder?.id;
            if (poId) {
              await api.post(`/purchase-orders/${poId}/sign`, { typedName: user?.name });
            }
            await fetchThread();
          } catch (err: unknown) {
            const axiosErr = err as { response?: { data?: { error?: { message?: string } } } };
            setActionError(axiosErr.response?.data?.error?.message || 'Failed to accept');
          } finally {
            setActionLoading(false);
          }
        },
      },
    ]);
  };

  const handleCounter = async () => {
    if (!latestPending) return;
    setActionLoading(true);
    setActionError('');
    try {
      await api.post(`/negotiations/${latestPending.id}/counter`, {
        offeredPricePerTon: parseFloat(counterPrice),
        offeredTons: counterTons ? parseFloat(counterTons) : undefined,
        message: counterMessage || undefined,
      });
      setShowCounter(false);
      setCounterPrice('');
      setCounterTons('');
      setCounterMessage('');
      await fetchThread();
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: { message?: string } } } };
      setActionError(axiosErr.response?.data?.error?.message || 'Failed to counter');
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async () => {
    if (!latestPending) return;
    Alert.alert('Reject Offer', 'Are you sure you want to reject this offer?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Reject',
        style: 'destructive',
        onPress: async () => {
          setActionLoading(true);
          try {
            await api.post(`/negotiations/${latestPending.id}/reject`);
            await fetchThread();
          } catch (err: unknown) {
            const axiosErr = err as { response?: { data?: { error?: { message?: string } } } };
            setActionError(axiosErr.response?.data?.error?.message || 'Failed to reject');
          } finally {
            setActionLoading(false);
          }
        },
      },
    ]);
  };

  if (loading) return <LoadingScreen />;

  const header = messages[0];

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: '#faf8f4' }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <FlatList
        data={messages}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: 16 }}
        ListHeaderComponent={
          header ? (
            <Card style={{ marginBottom: 16 }}>
              <CardHeader>
                <CardTitle style={{ fontSize: 16 }}>
                  {header.listing.productType || 'Negotiation'}
                  {header.listing.baleType ? ` — ${header.listing.baleType}` : ''}
                </CardTitle>
                <CardDescription>
                  {header.buyerOrg.name} ↔ {header.growerOrg.name}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={{ fontSize: 13, color: '#7a6a5a' }}>Listed at</Text>
                  <Text style={{ fontSize: 15, fontWeight: '600', color: '#3a2a1a' }}>${header.listing.pricePerTon}/ton</Text>
                </View>
              </CardContent>
            </Card>
          ) : null
        }
        renderItem={({ item: msg }) => {
          const isOwn = msg.offeredByOrgId === orgId;
          const statusVariant = msg.status === 'pending' ? 'warning' : msg.status === 'rejected' ? 'destructive' : 'default';

          return (
            <View style={{ alignItems: isOwn ? 'flex-end' : 'flex-start', marginBottom: 10 }}>
              <View
                style={{
                  maxWidth: '80%',
                  borderRadius: 16,
                  padding: 14,
                  backgroundColor: isOwn ? '#e8f5e3' : '#fdfcf8',
                  borderWidth: 1,
                  borderColor: isOwn ? '#b8dbb0' : '#d8cebb',
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <Text style={{ fontSize: 12, fontWeight: '500', color: '#5a4a3a' }}>{msg.offeredByUser.name}</Text>
                  <Badge variant={statusVariant}>{msg.status}</Badge>
                </View>
                <Text style={{ fontSize: 16, fontWeight: '700', color: '#3a2a1a' }}>
                  ${msg.offeredPricePerTon}/ton
                  {msg.offeredTons != null && (
                    <Text style={{ fontWeight: '400', color: '#7a6a5a', fontSize: 14 }}> for {msg.offeredTons} tons</Text>
                  )}
                </Text>
                {msg.message && (
                  <Text style={{ fontSize: 14, color: '#7a6a5a', marginTop: 6 }}>{msg.message}</Text>
                )}
                <Text style={{ fontSize: 10, color: '#a09080', marginTop: 8 }}>
                  {new Date(msg.createdAt).toLocaleString()}
                </Text>
              </View>
            </View>
          );
        }}
        ListFooterComponent={
          <View style={{ marginTop: 8 }}>
            {actionError ? <ErrorBanner message={actionError} /> : null}

            {canAct && !showCounter && (
              <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
                {isAdmin && (
                  <Button onPress={handleAccept} disabled={actionLoading} style={{ flex: 1 }}>Accept</Button>
                )}
                <Button
                  variant="outline"
                  onPress={() => {
                    setCounterPrice(String(latestPending.offeredPricePerTon));
                    setCounterTons(latestPending.offeredTons != null ? String(latestPending.offeredTons) : '');
                    setShowCounter(true);
                  }}
                  disabled={actionLoading}
                  style={{ flex: 1 }}
                >
                  Counter
                </Button>
                <Button variant="destructive" onPress={handleReject} disabled={actionLoading} style={{ flex: 1 }}>
                  Reject
                </Button>
              </View>
            )}

            {showCounter && (
              <Card style={{ marginBottom: 12 }}>
                <CardContent style={{ paddingTop: 16 }}>
                  <Input label="Counter Price ($/ton)" keyboardType="decimal-pad" value={counterPrice} onChangeText={setCounterPrice} containerStyle={{ marginBottom: 12 }} />
                  <Input label="Tons (optional)" keyboardType="decimal-pad" value={counterTons} onChangeText={setCounterTons} containerStyle={{ marginBottom: 12 }} />
                  <Input label="Message (optional)" value={counterMessage} onChangeText={setCounterMessage} multiline containerStyle={{ marginBottom: 16 }} />
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <Button onPress={handleCounter} loading={actionLoading} style={{ flex: 1 }}>Send Counter</Button>
                    <Button variant="outline" onPress={() => setShowCounter(false)} style={{ flex: 1 }}>Cancel</Button>
                  </View>
                </CardContent>
              </Card>
            )}

            {latestPending && latestPending.offeredByOrgId === orgId && (
              <Card>
                <CardContent style={{ paddingVertical: 16, alignItems: 'center' }}>
                  <Text style={{ fontSize: 14, color: '#7a6a5a' }}>Waiting for counterparty to respond...</Text>
                </CardContent>
              </Card>
            )}
          </View>
        }
      />
    </KeyboardAvoidingView>
  );
}
