import { useState, useEffect } from 'react';
import api from '@/services/api';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';

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
    estimatedTons?: number;
    status: string;
  };
  buyerOrg: { id: string; name: string };
  growerOrg: { id: string; name: string };
}

interface NegotiationThread extends NegotiationMessage {
  replies: Array<NegotiationMessage & { offeredByUser: { id: string; name: string } }>;
}

const statusVariant: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  pending: 'outline',
  accepted: 'default',
  rejected: 'destructive',
  countered: 'secondary',
};

export default function NegotiationsPage() {
  const { user } = useAuth();
  const [threads, setThreads] = useState<NegotiationThread[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [threadMessages, setThreadMessages] = useState<NegotiationMessage[]>([]);
  const [threadLoading, setThreadLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState('');

  // Counter form
  const [showCounter, setShowCounter] = useState(false);
  const [counterForm, setCounterForm] = useState({ pricePerTon: '', tons: '', message: '' });
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState('');

  const orgId = user?.organizationId;

  const fetchThreads = async () => {
    try {
      const params: Record<string, string> = {};
      if (statusFilter) params.status = statusFilter;
      const { data } = await api.get('/negotiations', { params });
      setThreads(data.negotiations);
    } catch {
      console.error('Failed to fetch negotiations');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchThreads();
  }, [statusFilter]);

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

  // Find the latest pending message in the current thread
  const latestPending = threadMessages.length > 0
    ? threadMessages.filter((m) => m.status === 'pending').slice(-1)[0]
    : null;

  // Can the current user act? Only if they are the receiving org (not the one who made the offer)
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

  const handleAccept = async () => {
    if (!latestPending) return;
    setActionLoading(true);
    setActionError('');
    try {
      await api.post(`/negotiations/${latestPending.id}/accept`);
      await fetchThread(selectedThreadId!);
      await fetchThreads();
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: { message?: string } } } };
      setActionError(axiosErr.response?.data?.error?.message || 'Failed to accept');
    } finally {
      setActionLoading(false);
    }
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

  // Determine latest status & price for a thread
  function threadSummary(t: NegotiationThread) {
    const latest = t.replies.length > 0 ? t.replies[0] : t;
    return {
      latestStatus: latest.status,
      latestPrice: latest.offeredPricePerTon,
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
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-semibold">Negotiations</h2>
        <div className="flex items-center gap-2">
          {['', 'pending', 'accepted', 'rejected'].map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                statusFilter === s
                  ? 'bg-accent text-accent-foreground'
                  : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
              }`}
            >
              {s === '' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Thread list */}
        <div className="lg:col-span-1 space-y-2 max-h-[calc(100vh-12rem)] overflow-y-auto">
          {threads.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                No negotiations found.
              </CardContent>
            </Card>
          ) : (
            threads.map((t) => {
              const summary = threadSummary(t);
              const counterparty = t.buyerOrgId === orgId ? t.growerOrg.name : t.buyerOrg.name;
              return (
                <Card
                  key={t.id}
                  className={`cursor-pointer transition-shadow hover:shadow-md ${
                    selectedThreadId === t.id ? 'ring-2 ring-primary' : ''
                  }`}
                  onClick={() => selectThread(t.id)}
                >
                  <CardContent className="py-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="font-semibold text-sm truncate">{t.listing.stackId}</span>
                          <Badge variant={statusVariant[summary.latestStatus] || 'outline'} className="text-[10px]">
                            {summary.latestStatus}
                          </Badge>
                        </div>
                        <div className="text-xs text-muted-foreground truncate">
                          {counterparty}
                          {t.listing.productType && ` — ${t.listing.productType}`}
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5">
                          Last by {summary.latestBy}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-sm font-semibold text-earth-brown">${summary.latestPrice}</div>
                        <div className="text-[10px] text-muted-foreground">per ton</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>

        {/* Right: Thread detail */}
        <div className="lg:col-span-2">
          {!selectedThreadId ? (
            <Card>
              <CardContent className="py-16 text-center text-muted-foreground">
                Select a negotiation to view details
              </CardContent>
            </Card>
          ) : threadLoading ? (
            <Card>
              <CardContent className="py-16 text-center text-muted-foreground">
                Loading thread...
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {/* Thread header */}
              {threadMessages.length > 0 && (
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-semibold">{threadMessages[0].listing.stackId}</h3>
                    <div className="text-sm text-muted-foreground">
                      {threadMessages[0].buyerOrg.name} &harr; {threadMessages[0].growerOrg.name}
                      {threadMessages[0].listing.productType && ` — ${threadMessages[0].listing.productType}`}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Listed at ${threadMessages[0].listing.pricePerTon}/ton
                      {threadMessages[0].listing.estimatedTons && ` — ${threadMessages[0].listing.estimatedTons} tons est.`}
                    </div>
                  </div>
                </div>
              )}

              {/* Chat bubble timeline */}
              <Card>
                <CardContent className="py-4 space-y-3 max-h-[calc(100vh-24rem)] overflow-y-auto">
                  {threadMessages.map((msg) => {
                    const isOwn = msg.offeredByOrgId === orgId;
                    return (
                      <div
                        key={msg.id}
                        className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}
                      >
                        <div
                          className={`max-w-[80%] rounded-lg px-4 py-3 ${
                            isOwn
                              ? 'bg-primary/10 border border-primary/20'
                              : 'bg-muted border border-border'
                          }`}
                        >
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs font-medium">
                              {msg.offeredByUser.name}
                            </span>
                            <Badge variant={statusVariant[msg.status] || 'outline'} className="text-[10px]">
                              {msg.status}
                            </Badge>
                          </div>
                          <div className="text-sm font-semibold">
                            ${msg.offeredPricePerTon}/ton
                            {msg.offeredTons != null && ` — ${msg.offeredTons} tons`}
                          </div>
                          {msg.message && (
                            <p className="text-sm text-muted-foreground mt-1">{msg.message}</p>
                          )}
                          <div className="text-[10px] text-muted-foreground mt-1">
                            {new Date(msg.createdAt).toLocaleString()}
                          </div>
                          {msg.status === 'accepted' && msg.purchaseOrderId && (
                            <div className="text-xs text-primary mt-1 font-medium">
                              PO created
                            </div>
                          )}
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
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Button onClick={handleAccept} disabled={actionLoading}>
                      {actionLoading ? 'Processing...' : 'Accept'}
                    </Button>
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
                      Counter
                    </Button>
                    <Button variant="destructive" onClick={handleReject} disabled={actionLoading}>
                      Reject
                    </Button>
                  </div>

                  {showCounter && (
                    <Card>
                      <CardContent className="py-4">
                        <form onSubmit={handleCounter} className="space-y-3">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div className="space-y-1">
                              <Label className="text-xs">Counter Price per Ton ($)</Label>
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
                      </CardContent>
                    </Card>
                  )}
                </div>
              )}

              {/* Info when waiting for counterparty */}
              {latestPending && latestPending.offeredByOrgId === orgId && (
                <div className="text-sm text-muted-foreground bg-muted/50 rounded-md px-4 py-3">
                  Waiting for counterparty to respond...
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
