import { useState, useEffect } from 'react';
import api from '@/services/api';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import ContractReviewDialog, { type ContractDetails } from '@/components/ContractReviewDialog';

interface NegotiationMessage {
  id: string;
  listingId: string;
  buyerOrgId: string;
  growerOrgId: string;
  status: string;
  offeredPricePerTon: number;
  offeredTons?: number;
  message?: string;
  offeredByOrgId: string;
  offeredByUserId: string;
  offeredByUser: { id: string; name: string };
  purchaseOrderId?: string;
  parentId?: string;
  createdAt: string;
  listing: {
    id: string;
    stackId: string;
    pricePerTon: number;
    productType?: string;
    baleType?: string;
    estimatedTons?: number;
    status: string;
    isDeliveredPrice?: boolean;
    truckingCoordinatedBy?: string;
    farmLocation?: { name: string };
  };
  buyerOrg: { id: string; name: string };
  growerOrg: { id: string; name: string };
}

interface NegotiationThread extends NegotiationMessage {
  replies: Array<NegotiationMessage & { offeredByUser: { id: string; name: string } }>;
}

const statusStyles: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-800',
  countered: 'bg-blue-100 text-blue-800',
  rejected: 'bg-red-100 text-red-800',
};

export default function NegotiationsPage() {
  const { user } = useAuth();
  const [threads, setThreads] = useState<NegotiationThread[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [threadMessages, setThreadMessages] = useState<NegotiationMessage[]>([]);
  const [threadLoading, setThreadLoading] = useState(false);

  // Counter form
  const [showCounter, setShowCounter] = useState(false);
  const [counterForm, setCounterForm] = useState({ pricePerTon: '', tons: '', message: '' });
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState('');

  // Filter: 'all' | 'yours' | 'theirs'
  const [responseFilter, setResponseFilter] = useState<'all' | 'yours' | 'theirs'>('all');

  const orgId = user?.organizationId;

  const fetchThreads = async () => {
    try {
      const { data } = await api.get('/negotiations');
      // Only show non-accepted negotiations (accepted ones move to Active POs)
      const active = (data.negotiations as NegotiationThread[]).filter((t) => {
        const latest = t.replies.length > 0 ? t.replies[0] : t;
        return latest.status !== 'accepted';
      });
      setThreads(active);
    } catch {
      console.error('Failed to fetch negotiations');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchThreads();
  }, []);

  const fetchThread = async (id: string) => {
    setThreadLoading(true);
    try {
      const { data } = await api.get(`/negotiations/${id}`);
      setThreadMessages(data.thread);
    } catch {
      console.error('Failed to fetch thread');
    } finally {
      setThreadLoading(false);
    }
  };

  const selectThread = (id: string) => {
    setSelectedThreadId(id);
    setShowCounter(false);
    setActionError('');
    fetchThread(id);
  };

  const latestPending = threadMessages.length > 0
    ? threadMessages.filter((m) => m.status === 'pending').slice(-1)[0]
    : null;

  const isAdmin = user?.role === 'FARM_ADMIN';
  const canAct = latestPending && latestPending.offeredByOrgId !== orgId;

  const handleCounter = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!latestPending) return;
    setActionLoading(true);
    setActionError('');
    try {
      await api.post(`/negotiations/${latestPending.id}/counter`, {
        offeredPricePerTon: parseFloat(counterForm.pricePerTon),
        offeredTons: counterForm.tons ? parseFloat(counterForm.tons) : undefined,
        message: counterForm.message || undefined,
      });
      setShowCounter(false);
      setCounterForm({ pricePerTon: '', tons: '', message: '' });
      await fetchThread(selectedThreadId!);
      await fetchThreads();
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: { message?: string } } } };
      setActionError(axiosErr.response?.data?.error?.message || 'Failed to counter');
    } finally {
      setActionLoading(false);
    }
  };

  // Contract review dialog state
  const [showContractReview, setShowContractReview] = useState(false);

  const acceptContractDetails: ContractDetails | null = latestPending && threadMessages.length > 0 ? {
    stackId: threadMessages[0].listing.stackId,
    productType: threadMessages[0].listing.productType,
    baleType: threadMessages[0].listing.baleType,
    buyerName: threadMessages[0].buyerOrg.name,
    growerName: threadMessages[0].growerOrg.name,
    pricePerTon: latestPending.offeredPricePerTon,
    tons: latestPending.offeredTons ?? threadMessages[0].listing.estimatedTons ?? 0,
    isDeliveredPrice: threadMessages[0].listing.isDeliveredPrice,
    truckingCoordinatedBy: threadMessages[0].listing.truckingCoordinatedBy,
    farmLocationName: threadMessages[0].listing.farmLocation?.name,
  } : null;

  const handleAcceptClick = () => {
    setShowContractReview(true);
  };

  const handleAcceptAndSign = async (typedName: string, signatureImage?: string) => {
    if (!latestPending) return;
    // Accept the negotiation → creates DRAFT PO
    const { data } = await api.post(`/negotiations/${latestPending.id}/accept`);
    const poId = data.purchaseOrder?.id;

    // Sign the PO immediately
    if (poId) {
      await api.post(`/purchase-orders/${poId}/sign`, { typedName, signatureImage });
    }

    setShowContractReview(false);
    setSelectedThreadId(null);
    setThreadMessages([]);
    await fetchThreads();
  };

  const handleReject = async () => {
    if (!latestPending) return;
    setActionLoading(true);
    setActionError('');
    try {
      await api.post(`/negotiations/${latestPending.id}/reject`);
      await fetchThread(selectedThreadId!);
      await fetchThreads();
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: { message?: string } } } };
      setActionError(axiosErr.response?.data?.error?.message || 'Failed to reject');
    } finally {
      setActionLoading(false);
    }
  };

  function threadSummary(t: NegotiationThread) {
    const latest = t.replies.length > 0 ? t.replies[0] : t;
    return {
      latestStatus: latest.status,
      latestPrice: latest.offeredPricePerTon,
      latestTons: latest.offeredTons,
      latestBy: latest.offeredByUser.name,
    };
  }

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="text-muted-foreground">Loading negotiations...</div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="mb-6">
        <h2 className="text-2xl font-semibold">Negotiations</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Active offers and counter-offers. Accepted deals move to Active POs.
        </p>
      </div>

      {/* Filter buttons */}
      {threads.length > 0 && (
        <div className="flex gap-1 mb-4">
          {(['all', 'theirs', 'yours'] as const).map((f) => {
            const label = f === 'all' ? 'All' : f === 'theirs' ? 'Waiting for Your Response' : 'Waiting for Their Response';
            const count = f === 'all' ? threads.length : threads.filter((t) => {
              const latest = t.replies.length > 0 ? t.replies[0] : t;
              const theyOffered = latest.offeredByOrgId !== orgId;
              return f === 'theirs' ? theyOffered : !theyOffered;
            }).length;
            return (
              <Button
                key={f}
                size="sm"
                variant={responseFilter === f ? 'default' : 'outline'}
                onClick={() => setResponseFilter(f)}
              >
                {label} ({count})
              </Button>
            );
          })}
        </div>
      )}

      {threads.length === 0 && !selectedThreadId ? (
        <Card>
          <CardContent className="py-16 text-center">
            <p className="text-muted-foreground text-lg mb-2">No active negotiations</p>
            <p className="text-sm text-muted-foreground">
              Make an offer on a listing to start negotiating.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Thread list */}
          <div className="lg:col-span-1 space-y-2 max-h-[calc(100vh-14rem)] overflow-y-auto pr-1">
            {threads.filter((t) => {
              if (responseFilter === 'all') return true;
              const latest = t.replies.length > 0 ? t.replies[0] : t;
              const theyOffered = latest.offeredByOrgId !== orgId;
              return responseFilter === 'theirs' ? theyOffered : !theyOffered;
            }).map((t) => {
              const summary = threadSummary(t);
              const counterparty = t.buyerOrgId === orgId ? t.growerOrg.name : t.buyerOrg.name;
              const isWaiting = t.replies.length > 0
                ? t.replies[0].offeredByOrgId === orgId
                : t.offeredByOrgId === orgId;
              return (
                <Card
                  key={t.id}
                  className={`cursor-pointer transition-all hover:shadow-md ${
                    selectedThreadId === t.id ? 'ring-2 ring-primary shadow-md' : ''
                  }`}
                  onClick={() => selectThread(t.id)}
                >
                  <CardContent className="py-3 px-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-semibold text-sm">{t.listing.productType || counterparty}</span>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${statusStyles[summary.latestStatus] || 'bg-gray-100 text-gray-700'}`}>
                            {summary.latestStatus}
                          </span>
                        </div>
                        <div className="text-xs text-muted-foreground truncate">
                          {counterparty}
                        </div>
                        {t.listing.productType && (
                          <div className="text-xs text-muted-foreground truncate">
                            {t.listing.productType}
                          </div>
                        )}
                        <div className="text-[10px] text-muted-foreground mt-1">
                          {isWaiting ? 'Waiting for response...' : 'Action needed'}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="font-semibold">${summary.latestPrice}</div>
                        <div className="text-[10px] text-muted-foreground">per ton</div>
                        {summary.latestTons && (
                          <div className="text-[10px] text-muted-foreground">{summary.latestTons} tons</div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Thread detail */}
          <div className="lg:col-span-2">
            {!selectedThreadId ? (
              <Card>
                <CardContent className="py-16 text-center text-muted-foreground">
                  Select a negotiation to view the conversation
                </CardContent>
              </Card>
            ) : threadLoading ? (
              <Card>
                <CardContent className="py-16 text-center text-muted-foreground">
                  Loading...
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {/* Thread header */}
                {threadMessages.length > 0 && (
                  <Card>
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <CardTitle className="text-lg">
                            {threadMessages[0].listing.productType || 'Negotiation'}
                            {threadMessages[0].listing.baleType && (
                              <span className="text-muted-foreground font-normal text-sm ml-2">
                                {threadMessages[0].listing.baleType}
                              </span>
                            )}
                          </CardTitle>
                          <CardDescription>
                            {threadMessages[0].buyerOrg.name} &harr; {threadMessages[0].growerOrg.name}
                          </CardDescription>
                        </div>
                        <div className="text-right">
                          <div className="text-sm text-muted-foreground">Listed at</div>
                          <div className="font-semibold">${threadMessages[0].listing.pricePerTon}/ton</div>
                          {threadMessages[0].listing.estimatedTons && (
                            <div className="text-xs text-muted-foreground">{threadMessages[0].listing.estimatedTons} tons est.</div>
                          )}
                        </div>
                      </div>
                    </CardHeader>
                  </Card>
                )}

                {/* Message timeline */}
                <Card>
                  <CardContent className="py-4 space-y-3 max-h-[calc(100vh-28rem)] overflow-y-auto">
                    {threadMessages.map((msg) => {
                      const isOwn = msg.offeredByOrgId === orgId;
                      return (
                        <div
                          key={msg.id}
                          className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}
                        >
                          <div
                            className={`max-w-[75%] rounded-xl px-4 py-3 ${
                              isOwn
                                ? 'bg-primary/10 border border-primary/20'
                                : 'bg-muted border border-border'
                            }`}
                          >
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-xs font-medium">{msg.offeredByUser.name}</span>
                              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${statusStyles[msg.status] || 'bg-gray-100 text-gray-700'}`}>
                                {msg.status}
                              </span>
                            </div>
                            <div className="text-sm font-semibold">
                              ${msg.offeredPricePerTon}/ton
                              {msg.offeredTons != null && (
                                <span className="font-normal text-muted-foreground"> for {msg.offeredTons} tons</span>
                              )}
                            </div>
                            {msg.message && (
                              <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">{msg.message}</p>
                            )}
                            <div className="text-[10px] text-muted-foreground mt-2">
                              {new Date(msg.createdAt).toLocaleString()}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </CardContent>
                </Card>

                {/* Action bar */}
                {actionError && (
                  <div className="rounded-md bg-destructive/10 text-destructive px-4 py-3 text-sm">{actionError}</div>
                )}

                {canAct && (
                  <Card>
                    <CardContent className="py-4">
                      <div className="flex items-center gap-2 mb-3">
                        {isAdmin && (
                          <Button onClick={handleAcceptClick} disabled={actionLoading}>
                            Accept Offer
                          </Button>
                        )}
                        <Button
                          variant="outline"
                          onClick={() => {
                            setCounterForm({
                              pricePerTon: String(latestPending.offeredPricePerTon),
                              tons: latestPending.offeredTons != null ? String(latestPending.offeredTons) : '',
                              message: '',
                            });
                            setShowCounter(!showCounter);
                          }}
                          disabled={actionLoading}
                        >
                          Counter Offer
                        </Button>
                        <Button variant="destructive" onClick={handleReject} disabled={actionLoading}>
                          Reject
                        </Button>
                      </div>

                      {showCounter && (
                        <form onSubmit={handleCounter} className="space-y-3 pt-3 border-t border-border">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div className="space-y-1">
                              <Label className="text-xs">Counter Price ($/ton)</Label>
                              <Input
                                type="number"
                                step="0.01"
                                value={counterForm.pricePerTon}
                                onChange={(e) => setCounterForm({ ...counterForm, pricePerTon: e.target.value })}
                                required
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">Tons (optional)</Label>
                              <Input
                                type="number"
                                step="0.1"
                                value={counterForm.tons}
                                onChange={(e) => setCounterForm({ ...counterForm, tons: e.target.value })}
                              />
                            </div>
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Message (optional)</Label>
                            <Textarea
                              value={counterForm.message}
                              onChange={(e) => setCounterForm({ ...counterForm, message: e.target.value })}
                              placeholder="Notes about your counter offer..."
                              rows={2}
                            />
                          </div>
                          <div className="flex gap-2">
                            <Button type="submit" size="sm" disabled={actionLoading}>
                              {actionLoading ? 'Sending...' : 'Send Counter'}
                            </Button>
                            <Button type="button" variant="outline" size="sm" onClick={() => setShowCounter(false)}>
                              Cancel
                            </Button>
                          </div>
                        </form>
                      )}
                    </CardContent>
                  </Card>
                )}

                {latestPending && latestPending.offeredByOrgId === orgId && (
                  <Card>
                    <CardContent className="py-4 text-center">
                      <p className="text-sm text-muted-foreground">Waiting for counterparty to respond...</p>
                    </CardContent>
                  </Card>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Contract Review Dialog for accepting offers */}
      <ContractReviewDialog
        open={showContractReview}
        onClose={() => setShowContractReview(false)}
        details={acceptContractDetails}
        onSign={handleAcceptAndSign}
      />
    </div>
  );
}
