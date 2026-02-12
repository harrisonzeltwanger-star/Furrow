import { useState, useEffect, useMemo } from 'react';
import api from '@/services/api';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';

interface POListing {
  id: string;
  stackId: string;
  productType?: string;
  baleType?: string;
}

interface POStack {
  id: string;
  listing: POListing;
  allocatedTons: number;
}

interface PurchaseOrder {
  id: string;
  poNumber: string | null;
  buyerOrgId: string;
  growerOrgId: string;
  buyerOrg: { id: string; name: string };
  growerOrg: { id: string; name: string };
  destinationSite: { id: string; siteName: string } | null;
  createdBy: { id: string; name: string };
  signedByBuyer: { id: string; name: string } | null;
  signedByGrower: { id: string; name: string } | null;
  signedAt: string | null;
  contractedTons: number;
  pricePerTon: number;
  deliveredTons: number;
  deliveryStartDate: string | null;
  deliveryEndDate: string | null;
  maxMoisturePercent: number | null;
  qualityNotes: string | null;
  status: string;
  center: string | null;
  hayClass: string | null;
  poStacks: POStack[];
  createdAt: string;
}

interface Delivery {
  id: string;
  loadNumber: string;
  grossWeight: number | null;
  tareWeight: number | null;
  netWeight: number;
  avgBaleWeight: number;
  totalBaleCount: number | null;
  wetBalesCount: number;
  qualityNotes: string | null;
  barn: { id: string; name: string } | null;
  feedPad: { id: string; name: string } | null;
  enteredBy: { id: string; name: string };
  deliveryDatetime: string;
  createdAt: string;
}

interface PickupInfo {
  poNumber: string;
  buyerOrg: string;
  growerOrg: string;
  contractedTons: number;
  pricePerTon: number;
  productType: string | null;
  baleType: string | null;
  baleCount: number | null;
  deliveryStartDate: string | null;
  deliveryEndDate: string | null;
  pickup: { name: string; address: string | null; state: string | null; latitude: number | null; longitude: number | null } | null;
  delivery: { name: string; address: string | null; latitude: number | null; longitude: number | null } | null;
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '--';
  return new Date(dateStr).toLocaleDateString();
}

function mapsUrl(lat: number | null, lng: number | null, label?: string): string | null {
  if (lat == null || lng == null) return null;
  return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
}

export default function CurrentPOsPage() {
  const { user } = useAuth();
  const [pos, setPOs] = useState<PurchaseOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState('all');
  const [centerFilter, setCenterFilter] = useState('all');

  // Center + Hay Class assignment state
  const [centerInput, setCenterInput] = useState('');
  const [hayClassInput, setHayClassInput] = useState('');
  const [centerSaving, setCenterSaving] = useState(false);
  const [editingField, setEditingField] = useState<string | null>(null);

  // Expanded PO state (keyed by PO id)
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [poDetails, setPODetails] = useState<Record<string, PurchaseOrder>>({});
  const [poDeliveries, setPODeliveries] = useState<Record<string, Delivery[]>>({});
  const [loadingId, setLoadingId] = useState<string | null>(null);

  // Log delivery form
  const [showDeliveryFormFor, setShowDeliveryFormFor] = useState<string | null>(null);
  const [deliveryForm, setDeliveryForm] = useState({
    totalBaleCount: '',
    wetBalesCount: '',
    grossWeight: '',
    tareWeight: '',
    location: '',
  });
  const [deliverySaving, setDeliverySaving] = useState(false);
  const [deliveryError, setDeliveryError] = useState('');

  // Edit delivery state
  const [editingDeliveryId, setEditingDeliveryId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ totalBaleCount: '', wetBalesCount: '', grossWeight: '', tareWeight: '', location: '' });
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState('');

  // Close contract state
  const [closingId, setClosingId] = useState<string | null>(null);

  // Trucking dialog state
  const [truckingDialog, setTruckingDialog] = useState(false);
  const [truckingEmail, setTruckingEmail] = useState('');
  const [truckingNotes, setTruckingNotes] = useState('');
  const [pickupInfo, setPickupInfo] = useState<PickupInfo | null>(null);
  const [pickupLoading, setPickupLoading] = useState(false);
  const [truckingSent, setTruckingSent] = useState(false);

  const orgId = user?.organizationId;
  const isAdmin = user?.role === 'FARM_ADMIN' || user?.role === 'MANAGER';
  const isFarmAdmin = user?.role === 'FARM_ADMIN';

  const fetchPOs = async () => {
    try {
      const { data } = await api.get('/purchase-orders');
      const active = (data.purchaseOrders as PurchaseOrder[]).filter((p) => p.status === 'ACTIVE');
      setPOs(active);
    } catch {
      console.error('Failed to fetch purchase orders');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPOs();
  }, []);

  const togglePO = async (id: string) => {
    if (expandedId === id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(id);
    setShowDeliveryFormFor(null);
    setEditingDeliveryId(null);
    setDeliveryError('');

    if (!poDetails[id]) {
      setLoadingId(id);
      try {
        const [detailRes, deliveriesRes] = await Promise.all([
          api.get(`/purchase-orders/${id}`),
          api.get(`/purchase-orders/${id}/deliveries`),
        ]);
        setPODetails(prev => ({ ...prev, [id]: detailRes.data }));
        setPODeliveries(prev => ({ ...prev, [id]: deliveriesRes.data.deliveries }));
      } catch {
        console.error('Failed to fetch PO detail');
      } finally {
        setLoadingId(null);
      }
    }
  };

  const refreshPO = async (id: string) => {
    try {
      const [detailRes, deliveriesRes] = await Promise.all([
        api.get(`/purchase-orders/${id}`),
        api.get(`/purchase-orders/${id}/deliveries`),
      ]);
      setPODetails(prev => ({ ...prev, [id]: detailRes.data }));
      setPODeliveries(prev => ({ ...prev, [id]: deliveriesRes.data.deliveries }));
      await fetchPOs();
    } catch {
      console.error('Failed to refresh PO');
    }
  };

  const handleLogDelivery = async (e: React.FormEvent, poId: string) => {
    e.preventDefault();
    setDeliverySaving(true);
    setDeliveryError('');
    try {
      await api.post(`/purchase-orders/${poId}/deliveries`, {
        totalBaleCount: parseInt(deliveryForm.totalBaleCount, 10),
        wetBalesCount: parseInt(deliveryForm.wetBalesCount || '0', 10),
        grossWeight: parseFloat(deliveryForm.grossWeight),
        tareWeight: parseFloat(deliveryForm.tareWeight),
        location: deliveryForm.location || undefined,
      });
      setShowDeliveryFormFor(null);
      setDeliveryForm({ totalBaleCount: '', wetBalesCount: '', grossWeight: '', tareWeight: '', location: '' });
      await refreshPO(poId);
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: { message?: string } } } };
      setDeliveryError(axiosErr.response?.data?.error?.message || 'Failed to log delivery');
    } finally {
      setDeliverySaving(false);
    }
  };

  const startEditDelivery = (d: Delivery) => {
    setEditingDeliveryId(d.id);
    setEditError('');
    setEditForm({
      totalBaleCount: String(d.totalBaleCount ?? ''),
      wetBalesCount: String(d.wetBalesCount ?? 0),
      grossWeight: String(d.grossWeight ?? ''),
      tareWeight: String(d.tareWeight ?? ''),
      location: d.qualityNotes || '',
    });
  };

  const saveEditDelivery = async (poId: string) => {
    if (!editingDeliveryId) return;
    setEditSaving(true);
    setEditError('');
    try {
      await api.patch(`/purchase-orders/loads/${editingDeliveryId}`, {
        totalBaleCount: parseInt(editForm.totalBaleCount, 10),
        wetBalesCount: parseInt(editForm.wetBalesCount || '0', 10),
        grossWeight: parseFloat(editForm.grossWeight),
        tareWeight: parseFloat(editForm.tareWeight),
        location: editForm.location || undefined,
      });
      setEditingDeliveryId(null);
      await refreshPO(poId);
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: { message?: string } } } };
      setEditError(axiosErr.response?.data?.error?.message || 'Failed to save changes');
    } finally {
      setEditSaving(false);
    }
  };

  const handleCloseContract = async (poId: string) => {
    if (!confirm('Are you sure you want to close this contract? This will mark it as 100% delivered and move it to Closed Contracts.')) return;
    setClosingId(poId);
    try {
      await api.post(`/purchase-orders/${poId}/close`);
      setExpandedId(null);
      setPODetails(prev => { const copy = { ...prev }; delete copy[poId]; return copy; });
      await fetchPOs();
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: { message?: string } } } };
      alert(axiosErr.response?.data?.error?.message || 'Failed to close contract');
    } finally {
      setClosingId(null);
    }
  };

  const handleSetCenter = async (poId: string) => {
    if (!centerInput.trim()) return;
    setCenterSaving(true);
    try {
      const body: { center: string; hayClass?: string } = { center: centerInput.trim() };
      if (hayClassInput.trim()) body.hayClass = hayClassInput.trim();
      await api.patch(`/purchase-orders/${poId}/center`, body);
      setPOs(prev => prev.map(p => p.id === poId ? { ...p, center: body.center, hayClass: body.hayClass || p.hayClass } : p));
      setPODetails(prev => {
        if (!prev[poId]) return prev;
        return { ...prev, [poId]: { ...prev[poId], center: body.center, hayClass: body.hayClass || prev[poId].hayClass } as PurchaseOrder };
      });
      setCenterInput('');
      setHayClassInput('');
    } catch {
      console.error('Failed to set center');
    } finally {
      setCenterSaving(false);
    }
  };

  const handleSetHayClass = async (poId: string) => {
    if (!hayClassInput.trim()) return;
    setCenterSaving(true);
    try {
      await api.patch(`/purchase-orders/${poId}/center`, { hayClass: hayClassInput.trim() });
      setPOs(prev => prev.map(p => p.id === poId ? { ...p, hayClass: hayClassInput.trim() } : p));
      setPODetails(prev => {
        if (!prev[poId]) return prev;
        return { ...prev, [poId]: { ...prev[poId], hayClass: hayClassInput.trim() } as PurchaseOrder };
      });
      setHayClassInput('');
    } catch {
      console.error('Failed to set hay class');
    } finally {
      setCenterSaving(false);
    }
  };

  const handleEditField = async (poId: string, field: 'center' | 'hayClass', value: string) => {
    if (!value.trim()) return;
    setCenterSaving(true);
    try {
      await api.patch(`/purchase-orders/${poId}/center`, { [field]: value.trim() });
      setPOs(prev => prev.map(p => p.id === poId ? { ...p, [field]: value.trim() } : p));
      setPODetails(prev => {
        if (!prev[poId]) return prev;
        return { ...prev, [poId]: { ...prev[poId], [field]: value.trim() } as PurchaseOrder };
      });
      setEditingField(null);
      setCenterInput('');
      setHayClassInput('');
    } catch {
      console.error(`Failed to update ${field}`);
    } finally {
      setCenterSaving(false);
    }
  };

  const openTruckingDialog = async (poId: string) => {
    setTruckingDialog(true);
    setTruckingEmail('');
    setTruckingNotes('');
    setTruckingSent(false);
    setPickupInfo(null);
    setPickupLoading(true);
    try {
      const { data } = await api.get(`/purchase-orders/${poId}/pickup-info`);
      setPickupInfo(data);
    } catch {
      console.error('Failed to fetch pickup info');
    } finally {
      setPickupLoading(false);
    }
  };

  const buildTruckingEmailBody = (): string => {
    if (!pickupInfo) return '';
    const lines: string[] = [];
    lines.push(`Pickup Order — ${pickupInfo.poNumber}`);
    lines.push('');
    lines.push(`Product: ${pickupInfo.productType || 'N/A'} (${pickupInfo.baleType || 'N/A'})`);
    lines.push(`Tons: ${pickupInfo.contractedTons}`);
    if (pickupInfo.baleCount) lines.push(`Bales: ${pickupInfo.baleCount}`);
    lines.push(`Delivery Window: ${formatDate(pickupInfo.deliveryStartDate)} - ${formatDate(pickupInfo.deliveryEndDate)}`);
    lines.push('');
    lines.push('--- PICKUP ---');
    lines.push(`From: ${pickupInfo.growerOrg}`);
    if (pickupInfo.pickup) {
      lines.push(`Location: ${pickupInfo.pickup.name}`);
      if (pickupInfo.pickup.address) lines.push(`Address: ${pickupInfo.pickup.address}${pickupInfo.pickup.state ? ', ' + pickupInfo.pickup.state : ''}`);
      const pUrl = mapsUrl(pickupInfo.pickup.latitude, pickupInfo.pickup.longitude);
      if (pUrl) lines.push(`Pin: ${pUrl}`);
    }
    lines.push('');
    lines.push('--- DELIVERY ---');
    lines.push(`To: ${pickupInfo.buyerOrg}`);
    if (pickupInfo.delivery) {
      lines.push(`Location: ${pickupInfo.delivery.name}`);
      if (pickupInfo.delivery.address) lines.push(`Address: ${pickupInfo.delivery.address}`);
      const dUrl = mapsUrl(pickupInfo.delivery.latitude, pickupInfo.delivery.longitude);
      if (dUrl) lines.push(`Pin: ${dUrl}`);
    }
    if (truckingNotes) {
      lines.push('');
      lines.push(`Notes: ${truckingNotes}`);
    }
    return lines.join('\n');
  };

  const handleSendTrucking = () => {
    if (!pickupInfo || !truckingEmail) return;
    const subject = encodeURIComponent(`Pickup Order — ${pickupInfo.poNumber} — ${pickupInfo.productType || 'Hay'}`);
    const body = encodeURIComponent(buildTruckingEmailBody());
    window.open(`mailto:${truckingEmail}?subject=${subject}&body=${body}`, '_blank');
    setTruckingSent(true);
  };

  const handleCopyTrucking = () => {
    const text = buildTruckingEmailBody();
    navigator.clipboard.writeText(text);
  };

  // Filter options + filtered list + summary stats
  const productTypes = useMemo(() => {
    const set = new Set<string>();
    pos.forEach((p) => {
      const pt = p.poStacks[0]?.listing.productType;
      if (pt) set.add(pt);
    });
    return Array.from(set).sort();
  }, [pos]);

  const centers = useMemo(() => {
    const set = new Set<string>();
    pos.forEach((p) => { if (p.center) set.add(p.center); });
    return Array.from(set).sort();
  }, [pos]);

  const hayClasses = useMemo(() => {
    const set = new Set<string>();
    pos.forEach((p) => { if (p.hayClass) set.add(p.hayClass); });
    return Array.from(set).sort();
  }, [pos]);

  const filteredPOs = useMemo(() => {
    return pos.filter((p) => {
      if (typeFilter !== 'all' && p.poStacks[0]?.listing.productType !== typeFilter) return false;
      if (centerFilter !== 'all' && p.center !== centerFilter) return false;
      return true;
    });
  }, [pos, typeFilter, centerFilter]);

  const totalContractedTons = useMemo(() => filteredPOs.reduce((sum, p) => sum + p.contractedTons, 0), [filteredPOs]);
  const totalDeliveredTons = useMemo(() => filteredPOs.reduce((sum, p) => sum + p.deliveredTons, 0), [filteredPOs]);
  const overallPct = useMemo(() => {
    if (filteredPOs.length === 0) return 0;
    const sum = filteredPOs.reduce((acc, p) => {
      const pct = p.contractedTons > 0 ? Math.min(100, (p.deliveredTons / p.contractedTons) * 100) : 0;
      return acc + pct;
    }, 0);
    return Math.floor(sum / filteredPOs.length);
  }, [filteredPOs]);

  // Computed previews
  const grossNum = parseFloat(deliveryForm.grossWeight) || 0;
  const tareNum = parseFloat(deliveryForm.tareWeight) || 0;
  const baleNum = parseInt(deliveryForm.totalBaleCount) || 0;
  const netWeight = grossNum - tareNum;
  const avgBaleWeight = baleNum > 0 && netWeight > 0 ? netWeight / baleNum : 0;

  const editGross = parseFloat(editForm.grossWeight) || 0;
  const editTare = parseFloat(editForm.tareWeight) || 0;
  const editBales = parseInt(editForm.totalBaleCount) || 0;
  const editNet = editGross - editTare;
  const editAvg = editBales > 0 && editNet > 0 ? editNet / editBales : 0;

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="text-muted-foreground">Loading active purchase orders...</div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="mb-4">
        <h2 className="text-2xl font-semibold">Active Purchase Orders</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Fully signed purchase orders. Log deliveries and track progress.
        </p>
      </div>

      {/* Filter + Dashboard */}
      {pos.length > 0 && (
        <>
          <div className="flex flex-wrap items-end gap-4 mb-4">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Product Type</label>
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="block w-48 rounded-md border border-border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="all">All Types</option>
                {productTypes.map((pt) => (
                  <option key={pt} value={pt}>{pt}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Center</label>
              <select
                value={centerFilter}
                onChange={(e) => setCenterFilter(e.target.value)}
                className="block w-48 rounded-md border border-border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="all">All Centers</option>
                {centers.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
            <Card>
              <CardContent className="py-3 px-4">
                <div className="text-xs font-medium text-muted-foreground">Active POs</div>
                <div className="text-2xl font-bold">{filteredPOs.length}</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="py-3 px-4">
                <div className="text-xs font-medium text-muted-foreground">Contracted Tons</div>
                <div className="text-2xl font-bold">{totalContractedTons.toLocaleString()}</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="py-3 px-4">
                <div className="text-xs font-medium text-muted-foreground">Overall % Complete</div>
                <div className="text-2xl font-bold">{overallPct}%</div>
                <div className="h-1.5 bg-muted rounded-full overflow-hidden mt-1">
                  <div className="h-full bg-green-500 rounded-full" style={{ width: `${overallPct}%` }} />
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      )}

      {filteredPOs.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <p className="text-muted-foreground text-lg mb-2">No active purchase orders</p>
            <p className="text-sm text-muted-foreground">
              {pos.length === 0
                ? 'Purchase orders appear here once both parties have signed the contract.'
                : 'Try adjusting your filter.'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredPOs.map((p) => {
            const counterparty = p.buyerOrgId === orgId ? p.growerOrg.name : p.buyerOrg.name;
            const stackIds = p.poStacks.map((s) => s.listing.stackId).join(', ');
            const productType = p.poStacks[0]?.listing.productType;
            const pctDelivered = p.contractedTons > 0 ? Math.min(100, Math.round((p.deliveredTons / p.contractedTons) * 100)) : 0;
            const isExpanded = expandedId === p.id;
            const po = poDetails[p.id];
            const deliveries = poDeliveries[p.id] || [];
            const isLoading = loadingId === p.id;

            return (
              <Card
                key={p.id}
                className={`transition-all ${isExpanded ? 'ring-2 ring-primary shadow-md' : 'hover:shadow-md'}`}
              >
                {/* Card header - always visible */}
                <div
                  className="cursor-pointer px-5 py-4 flex items-center justify-between gap-4"
                  onClick={() => togglePO(p.id)}
                >
                  <div className="flex items-center gap-4 min-w-0 flex-1">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="font-semibold">{p.poNumber || stackIds || 'PO'}</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium bg-green-100 text-green-800">
                          ACTIVE
                        </span>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {productType && <span>{productType} &middot; </span>}
                        {counterparty}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="font-semibold text-lg">${p.pricePerTon}</div>
                      <div className="text-xs text-muted-foreground">{p.contractedTons} tons</div>
                    </div>
                    {/* Progress mini */}
                    <div className="w-20 shrink-0 hidden sm:block">
                      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                        <div className="h-full bg-green-500 rounded-full" style={{ width: `${pctDelivered}%` }} />
                      </div>
                      <div className="text-[10px] text-muted-foreground text-center mt-0.5">{pctDelivered}%</div>
                    </div>
                    <div className={`transition-transform ${isExpanded ? 'rotate-180' : ''}`}>
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="6 9 12 15 18 9" />
                      </svg>
                    </div>
                  </div>
                </div>

                {/* Expanded detail */}
                {isExpanded && (
                  <div className="border-t border-border">
                    {isLoading ? (
                      <div className="px-5 py-8 text-center text-muted-foreground">Loading...</div>
                    ) : po ? (
                      <div className="px-5 py-4 space-y-5">
                        {/* Center + Hay Class assignment banner */}
                        {!p.center && (
                          <div className="rounded-lg border-2 border-amber-300 bg-amber-50 p-4">
                            <div className="text-sm font-semibold text-amber-800 mb-2">Assign Center & Hay Class</div>
                            <p className="text-xs text-amber-700 mb-3">This PO needs a center before you can track it properly.</p>
                            <div className="flex gap-2 flex-wrap">
                              <Input
                                className="h-8 w-44"
                                placeholder="Center name..."
                                value={centerInput}
                                onChange={(e) => setCenterInput(e.target.value)}
                                onKeyDown={(e) => { if (e.key === 'Enter') handleSetCenter(p.id); }}
                              />
                              <Input
                                className="h-8 w-44"
                                placeholder="Hay class (optional)..."
                                list="hayClassOptions"
                                value={hayClassInput}
                                onChange={(e) => setHayClassInput(e.target.value)}
                                onKeyDown={(e) => { if (e.key === 'Enter') handleSetCenter(p.id); }}
                              />
                              <Button size="sm" disabled={!centerInput.trim() || centerSaving} onClick={() => handleSetCenter(p.id)}>
                                {centerSaving ? 'Saving...' : 'Save'}
                              </Button>
                            </div>
                          </div>
                        )}
                        {p.center && (
                          <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
                            {/* Editable Center */}
                            {expandedId === p.id && centerInput !== '' && editingField === 'center-' + p.id ? (
                              <span className="flex items-center gap-1">
                                Center:
                                <Input
                                  className="h-6 w-32 text-xs"
                                  value={centerInput}
                                  onChange={(e) => setCenterInput(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') { handleEditField(p.id, 'center', centerInput); }
                                    if (e.key === 'Escape') { setEditingField(null); setCenterInput(''); }
                                  }}
                                  autoFocus
                                />
                                <Button size="sm" variant="outline" className="h-6 text-[10px] px-2" disabled={!centerInput.trim() || centerSaving} onClick={() => handleEditField(p.id, 'center', centerInput)}>
                                  {centerSaving ? '...' : 'Save'}
                                </Button>
                                <Button size="sm" variant="ghost" className="h-6 text-[10px] px-1" onClick={() => { setEditingField(null); setCenterInput(''); }}>
                                  Cancel
                                </Button>
                              </span>
                            ) : (
                              <span
                                className="cursor-pointer hover:text-primary"
                                onClick={() => { setEditingField('center-' + p.id); setCenterInput(p.center || ''); }}
                                title="Click to edit"
                              >
                                Center: <span className="font-medium text-foreground">{p.center}</span>
                              </span>
                            )}

                            {/* Editable Hay Class */}
                            {expandedId === p.id && editingField === 'hayClass-' + p.id ? (
                              <span className="flex items-center gap-1">
                                Hay Class:
                                <Input
                                  className="h-6 w-28 text-xs"
                                  list="hayClassOptions"
                                  value={hayClassInput}
                                  onChange={(e) => setHayClassInput(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') { handleEditField(p.id, 'hayClass', hayClassInput); }
                                    if (e.key === 'Escape') { setEditingField(null); setHayClassInput(''); }
                                  }}
                                  autoFocus
                                />
                                <Button size="sm" variant="outline" className="h-6 text-[10px] px-2" disabled={!hayClassInput.trim() || centerSaving} onClick={() => handleEditField(p.id, 'hayClass', hayClassInput)}>
                                  {centerSaving ? '...' : 'Save'}
                                </Button>
                                <Button size="sm" variant="ghost" className="h-6 text-[10px] px-1" onClick={() => { setEditingField(null); setHayClassInput(''); }}>
                                  Cancel
                                </Button>
                              </span>
                            ) : p.hayClass ? (
                              <span
                                className="cursor-pointer hover:text-primary"
                                onClick={() => { setEditingField('hayClass-' + p.id); setHayClassInput(p.hayClass || ''); }}
                                title="Click to edit"
                              >
                                Hay Class: <span className="font-medium text-foreground">{p.hayClass}</span>
                              </span>
                            ) : (
                              <span className="flex items-center gap-1">
                                Hay Class:
                                <Input
                                  className="h-6 w-28 text-xs inline"
                                  placeholder="Enter class..."
                                  list="hayClassOptions"
                                  value={hayClassInput}
                                  onChange={(e) => setHayClassInput(e.target.value)}
                                  onKeyDown={(e) => { if (e.key === 'Enter') handleSetHayClass(p.id); }}
                                />
                                <Button size="sm" variant="outline" className="h-6 text-[10px] px-2" disabled={!hayClassInput.trim() || centerSaving} onClick={() => handleSetHayClass(p.id)}>
                                  Save
                                </Button>
                              </span>
                            )}
                          </div>
                        )}

                        {/* KPI row */}
                        <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 text-sm">
                          <div>
                            <span className="text-muted-foreground text-xs">Price/Ton</span>
                            <div className="font-semibold">${po.pricePerTon}</div>
                          </div>
                          <div>
                            <span className="text-muted-foreground text-xs">Contracted</span>
                            <div className="font-semibold">{po.contractedTons} tons</div>
                          </div>
                          <div>
                            <span className="text-muted-foreground text-xs">Delivered</span>
                            <div className="font-semibold">{po.deliveredTons} tons</div>
                          </div>
                          <div>
                            <span className="text-muted-foreground text-xs">Remaining</span>
                            <div className="font-semibold">{Math.max(0, po.contractedTons - po.deliveredTons)} tons</div>
                          </div>
                          <div>
                            <span className="text-muted-foreground text-xs">Total Value</span>
                            <div className="font-semibold">${(po.pricePerTon * po.contractedTons).toLocaleString()}</div>
                          </div>
                        </div>

                        {/* Progress bar */}
                        <div>
                          <div className="h-2 bg-muted rounded-full overflow-hidden">
                            <div
                              className="h-full bg-green-500 rounded-full transition-all"
                              style={{ width: `${Math.min(100, po.contractedTons > 0 ? (po.deliveredTons / po.contractedTons) * 100 : 0)}%` }}
                            />
                          </div>
                          <div className="text-xs text-muted-foreground mt-1">
                            {po.contractedTons > 0 ? Math.round((po.deliveredTons / po.contractedTons) * 100) : 0}% delivered
                          </div>
                        </div>

                        {/* Contract terms */}
                        <div className="rounded-lg bg-muted/50 p-4">
                          <h4 className="text-sm font-semibold mb-3">Contract Terms</h4>
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                            <div>
                              <span className="text-muted-foreground text-xs">Delivery Window</span>
                              <div className="font-medium">{formatDate(po.deliveryStartDate)} &mdash; {formatDate(po.deliveryEndDate)}</div>
                            </div>
                            <div>
                              <span className="text-muted-foreground text-xs">Max Moisture</span>
                              <div className="font-medium">{po.maxMoisturePercent != null ? `${po.maxMoisturePercent}%` : '--'}</div>
                            </div>
                            <div>
                              <span className="text-muted-foreground text-xs">Signed</span>
                              <div className="font-medium">{formatDate(po.signedAt)}</div>
                            </div>
                            <div>
                              <span className="text-muted-foreground text-xs">Parties</span>
                              <div className="font-medium truncate">{po.buyerOrg.name} / {po.growerOrg.name}</div>
                            </div>
                            {po.qualityNotes && (
                              <div className="col-span-2 sm:col-span-4">
                                <span className="text-muted-foreground text-xs">Quality Notes</span>
                                <div className="font-medium">{po.qualityNotes}</div>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Log delivery button + close contract + form */}
                        <div>
                          {showDeliveryFormFor !== p.id ? (
                            <div className="flex gap-2 flex-wrap">
                              <Button size="sm" onClick={(e) => { e.stopPropagation(); setShowDeliveryFormFor(p.id); setDeliveryError(''); }}>
                                Log Delivery
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={(e) => { e.stopPropagation(); openTruckingDialog(p.id); }}
                              >
                                Send to Trucking
                              </Button>
                              {isFarmAdmin && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="text-red-600 border-red-200 hover:bg-red-50"
                                  disabled={closingId === p.id}
                                  onClick={(e) => { e.stopPropagation(); handleCloseContract(p.id); }}
                                >
                                  {closingId === p.id ? 'Closing...' : 'Close Contract'}
                                </Button>
                              )}
                            </div>
                          ) : (
                            <div className="rounded-lg border-2 border-primary/20 bg-primary/5 p-4">
                              <div className="flex items-center justify-between mb-3">
                                <h4 className="text-sm font-semibold">Log Delivery</h4>
                                <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setShowDeliveryFormFor(null)}>Cancel</Button>
                              </div>
                              {deliveryError && (
                                <div className="rounded-md bg-destructive/10 text-destructive px-3 py-2 text-sm mb-3">{deliveryError}</div>
                              )}
                              <form onSubmit={(e) => handleLogDelivery(e, p.id)} className="space-y-3">
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                  <div className="space-y-1">
                                    <Label className="text-xs">Number of Bales</Label>
                                    <Input type="number" min="1" className="h-8" value={deliveryForm.totalBaleCount} onChange={(e) => setDeliveryForm({ ...deliveryForm, totalBaleCount: e.target.value })} placeholder="24" required />
                                  </div>
                                  <div className="space-y-1">
                                    <Label className="text-xs">Wet Bales</Label>
                                    <Input type="number" min="0" className="h-8" value={deliveryForm.wetBalesCount} onChange={(e) => setDeliveryForm({ ...deliveryForm, wetBalesCount: e.target.value })} placeholder="0" />
                                  </div>
                                  <div className="space-y-1">
                                    <Label className="text-xs">Pad / Barn #</Label>
                                    <Input className="h-8" value={deliveryForm.location} onChange={(e) => setDeliveryForm({ ...deliveryForm, location: e.target.value })} placeholder="Barn/Pad" />
                                  </div>
                                  <div className="space-y-1">
                                    <Label className="text-xs">Full Weight (lbs)</Label>
                                    <Input type="number" step="1" min="1" className="h-8" value={deliveryForm.grossWeight} onChange={(e) => setDeliveryForm({ ...deliveryForm, grossWeight: e.target.value })} placeholder="52000" required />
                                  </div>
                                  <div className="space-y-1">
                                    <Label className="text-xs">Empty Weight (lbs)</Label>
                                    <Input type="number" step="1" min="1" className="h-8" value={deliveryForm.tareWeight} onChange={(e) => setDeliveryForm({ ...deliveryForm, tareWeight: e.target.value })} placeholder="16000" required />
                                  </div>
                                </div>

                                {grossNum > 0 && tareNum > 0 && (
                                  <div className="rounded-lg bg-muted/50 border border-border p-3">
                                    <div className="grid grid-cols-3 gap-3 text-sm">
                                      <div>
                                        <span className="text-muted-foreground text-xs">Net Weight</span>
                                        <div className="font-bold">{netWeight > 0 ? netWeight.toLocaleString() : '--'} lbs</div>
                                        {netWeight > 0 && <div className="text-xs text-muted-foreground">{(netWeight / 2000).toFixed(2)} tons</div>}
                                      </div>
                                      <div>
                                        <span className="text-muted-foreground text-xs">lbs/Bale</span>
                                        <div className="font-bold">{avgBaleWeight > 0 ? Math.round(avgBaleWeight).toLocaleString() : '--'}</div>
                                      </div>
                                      <div>
                                        <span className="text-muted-foreground text-xs">Bales</span>
                                        <div className="font-bold">{baleNum || '--'}</div>
                                      </div>
                                    </div>
                                  </div>
                                )}

                                <Button type="submit" size="sm" disabled={deliverySaving || netWeight <= 0}>
                                  {deliverySaving ? 'Saving...' : 'Save Delivery'}
                                </Button>
                              </form>
                            </div>
                          )}
                        </div>

                        {/* Delivery history */}
                        <div>
                          <h4 className="text-sm font-semibold mb-2">Delivery History ({deliveries.length})</h4>
                          {deliveries.length > 0 && (() => {
                            const totalBalesD = deliveries.reduce((s, d) => s + (d.totalBaleCount ?? 0), 0);
                            const totalWetD = deliveries.reduce((s, d) => s + (d.wetBalesCount ?? 0), 0);
                            const totalNetLbsD = deliveries.reduce((s, d) => s + d.netWeight, 0);
                            const avgLbsBaleD = totalBalesD > 0 ? totalNetLbsD / totalBalesD : 0;
                            const wetPctD = totalBalesD > 0 ? (totalWetD / totalBalesD) * 100 : 0;
                            return (
                              <div className="flex gap-6 text-sm mb-3">
                                <div>
                                  <span className="text-muted-foreground text-xs">Avg lbs/Bale</span>
                                  <div className="font-semibold">{avgLbsBaleD > 0 ? Math.round(avgLbsBaleD).toLocaleString() : '--'}</div>
                                </div>
                                <div>
                                  <span className="text-muted-foreground text-xs">Wet Bales</span>
                                  <div className={`font-semibold ${totalWetD > 0 ? 'text-amber-600' : ''}`}>{totalWetD.toLocaleString()}</div>
                                </div>
                                <div>
                                  <span className="text-muted-foreground text-xs">% Wet</span>
                                  <div className={`font-semibold ${wetPctD > 5 ? 'text-red-600' : wetPctD > 0 ? 'text-amber-600' : ''}`}>{wetPctD.toFixed(1)}%</div>
                                </div>
                              </div>
                            );
                          })()}
                          {deliveries.length === 0 ? (
                            <div className="text-sm text-muted-foreground py-2">No deliveries logged yet.</div>
                          ) : (
                            <div className="space-y-2">
                              {deliveries.map((d) => {
                                const isEditing = editingDeliveryId === d.id;

                                if (isEditing) {
                                  return (
                                    <div key={d.id} className="rounded-lg border-2 border-primary/30 bg-primary/5 p-3">
                                      <div className="flex items-center justify-between mb-3">
                                        <span className="font-semibold text-sm">{d.loadNumber} — Editing</span>
                                        <div className="flex gap-2">
                                          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setEditingDeliveryId(null)} disabled={editSaving}>Cancel</Button>
                                          <Button size="sm" className="h-7 text-xs" onClick={() => saveEditDelivery(p.id)} disabled={editSaving || editNet <= 0}>
                                            {editSaving ? 'Saving...' : 'Save'}
                                          </Button>
                                        </div>
                                      </div>
                                      {editError && <div className="rounded-md bg-destructive/10 text-destructive px-3 py-2 text-sm mb-3">{editError}</div>}
                                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                        <div className="space-y-1"><Label className="text-xs">Bales</Label><Input type="number" min="1" className="h-8" value={editForm.totalBaleCount} onChange={(e) => setEditForm({ ...editForm, totalBaleCount: e.target.value })} /></div>
                                        <div className="space-y-1"><Label className="text-xs">Wet Bales</Label><Input type="number" min="0" className="h-8" value={editForm.wetBalesCount} onChange={(e) => setEditForm({ ...editForm, wetBalesCount: e.target.value })} /></div>
                                        <div className="space-y-1"><Label className="text-xs">Location</Label><Input className="h-8" value={editForm.location} onChange={(e) => setEditForm({ ...editForm, location: e.target.value })} /></div>
                                        <div className="space-y-1"><Label className="text-xs">Full Weight (lbs)</Label><Input type="number" min="1" className="h-8" value={editForm.grossWeight} onChange={(e) => setEditForm({ ...editForm, grossWeight: e.target.value })} /></div>
                                        <div className="space-y-1"><Label className="text-xs">Empty Weight (lbs)</Label><Input type="number" min="1" className="h-8" value={editForm.tareWeight} onChange={(e) => setEditForm({ ...editForm, tareWeight: e.target.value })} /></div>
                                      </div>
                                      {editGross > 0 && editTare > 0 && (
                                        <div className="rounded-lg bg-muted/50 border border-border p-2 mt-3">
                                          <div className="grid grid-cols-3 gap-3 text-sm">
                                            <div><span className="text-muted-foreground text-xs">Net</span><div className="font-bold">{editNet > 0 ? editNet.toLocaleString() : '--'} lbs</div></div>
                                            <div><span className="text-muted-foreground text-xs">lbs/Bale</span><div className="font-bold">{editAvg > 0 ? Math.round(editAvg).toLocaleString() : '--'}</div></div>
                                            <div><span className="text-muted-foreground text-xs">Bales</span><div className="font-bold">{editBales || '--'}</div></div>
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  );
                                }

                                return (
                                  <div key={d.id} className="rounded-lg border border-border p-3">
                                    <div className="flex items-center justify-between mb-2">
                                      <span className="font-semibold text-sm">{d.loadNumber}</span>
                                      <div className="flex items-center gap-3">
                                        <span className="text-xs text-muted-foreground">{new Date(d.deliveryDatetime).toLocaleString()}</span>
                                        {isAdmin && (
                                          <Button size="sm" variant="ghost" className="h-6 text-xs px-2" onClick={() => startEditDelivery(d)}>Edit</Button>
                                        )}
                                      </div>
                                    </div>
                                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-sm">
                                      <div>
                                        <span className="text-muted-foreground text-xs">Net Weight</span>
                                        <div className="font-medium">{d.netWeight.toLocaleString()} lbs</div>
                                        <div className="text-xs text-muted-foreground">{(d.netWeight / 2000).toFixed(2)} tons</div>
                                      </div>
                                      <div>
                                        <span className="text-muted-foreground text-xs">Bales</span>
                                        <div className="font-medium">{d.totalBaleCount ?? '--'}</div>
                                        {d.wetBalesCount > 0 && <div className="text-xs text-amber-600">{d.wetBalesCount} wet</div>}
                                      </div>
                                      <div>
                                        <span className="text-muted-foreground text-xs">lbs/Bale</span>
                                        <div className="font-medium">{d.avgBaleWeight > 0 ? Math.round(d.avgBaleWeight).toLocaleString() : '--'}</div>
                                      </div>
                                      <div>
                                        <span className="text-muted-foreground text-xs">Location</span>
                                        <div className="font-medium">{d.qualityNotes || d.barn?.name || d.feedPad?.name || '--'}</div>
                                      </div>
                                      <div>
                                        <span className="text-muted-foreground text-xs">Entered By</span>
                                        <div className="font-medium">{d.enteredBy.name}</div>
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </div>
                    ) : null}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* Hay Class datalist for autocomplete */}
      <datalist id="hayClassOptions">
        {hayClasses.map((hc) => (
          <option key={hc} value={hc} />
        ))}
      </datalist>

      {/* Trucking Pickup Dialog */}
      <Dialog open={truckingDialog} onOpenChange={setTruckingDialog}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Send Pickup Details to Trucking</DialogTitle>
          </DialogHeader>

          {pickupLoading ? (
            <div className="py-8 text-center text-muted-foreground">Loading pickup info...</div>
          ) : truckingSent ? (
            <div className="py-6 text-center">
              <div className="text-green-600 font-semibold mb-2">Email client opened!</div>
              <p className="text-sm text-muted-foreground">
                Complete sending in your email app. The pickup details have been pre-filled.
              </p>
              <Button className="mt-4" onClick={() => setTruckingDialog(false)}>Done</Button>
            </div>
          ) : pickupInfo ? (
            <div className="space-y-4">
              {/* Pickup location */}
              <div className="rounded-lg border border-border p-3">
                <div className="text-xs font-semibold text-muted-foreground uppercase mb-2">Pickup</div>
                <div className="font-medium">{pickupInfo.growerOrg}</div>
                {pickupInfo.pickup ? (
                  <div className="text-sm mt-1">
                    <div>{pickupInfo.pickup.name}</div>
                    {pickupInfo.pickup.address && (
                      <div className="text-muted-foreground">{pickupInfo.pickup.address}{pickupInfo.pickup.state ? `, ${pickupInfo.pickup.state}` : ''}</div>
                    )}
                    {pickupInfo.pickup.latitude && pickupInfo.pickup.longitude && (
                      <a
                        href={mapsUrl(pickupInfo.pickup.latitude, pickupInfo.pickup.longitude) || '#'}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-primary text-xs mt-1 hover:underline"
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                        Open in Google Maps
                      </a>
                    )}
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground mt-1">No location on file</div>
                )}
              </div>

              {/* Delivery location */}
              <div className="rounded-lg border border-border p-3">
                <div className="text-xs font-semibold text-muted-foreground uppercase mb-2">Delivery</div>
                <div className="font-medium">{pickupInfo.buyerOrg}</div>
                {pickupInfo.delivery ? (
                  <div className="text-sm mt-1">
                    <div>{pickupInfo.delivery.name}</div>
                    {pickupInfo.delivery.address && (
                      <div className="text-muted-foreground">{pickupInfo.delivery.address}</div>
                    )}
                    {pickupInfo.delivery.latitude && pickupInfo.delivery.longitude && (
                      <a
                        href={mapsUrl(pickupInfo.delivery.latitude, pickupInfo.delivery.longitude) || '#'}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-primary text-xs mt-1 hover:underline"
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                        Open in Google Maps
                      </a>
                    )}
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground mt-1">No destination site on file</div>
                )}
              </div>

              {/* What to pick up */}
              <div className="rounded-lg bg-muted/50 p-3">
                <div className="text-xs font-semibold text-muted-foreground uppercase mb-2">Load Details</div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
                  <div>
                    <span className="text-muted-foreground text-xs">PO</span>
                    <div className="font-medium">{pickupInfo.poNumber}</div>
                  </div>
                  <div>
                    <span className="text-muted-foreground text-xs">Product</span>
                    <div className="font-medium">{pickupInfo.productType || 'N/A'}</div>
                  </div>
                  <div>
                    <span className="text-muted-foreground text-xs">Bale Type</span>
                    <div className="font-medium">{pickupInfo.baleType || 'N/A'}</div>
                  </div>
                  <div>
                    <span className="text-muted-foreground text-xs">Tons</span>
                    <div className="font-medium">{pickupInfo.contractedTons}</div>
                  </div>
                </div>
                {(pickupInfo.deliveryStartDate || pickupInfo.deliveryEndDate) && (
                  <div className="mt-2 text-sm">
                    <span className="text-muted-foreground text-xs">Delivery Window: </span>
                    <span className="font-medium">{formatDate(pickupInfo.deliveryStartDate)} — {formatDate(pickupInfo.deliveryEndDate)}</span>
                  </div>
                )}
              </div>

              {/* Email + notes */}
              <div className="space-y-3">
                <div className="space-y-1">
                  <Label className="text-sm">Trucking Company Email</Label>
                  <Input
                    type="email"
                    placeholder="trucking@example.com"
                    value={truckingEmail}
                    onChange={(e) => setTruckingEmail(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-sm">Additional Notes (optional)</Label>
                  <Input
                    placeholder="Gate code, contact person, special instructions..."
                    value={truckingNotes}
                    onChange={(e) => setTruckingNotes(e.target.value)}
                  />
                </div>
              </div>

              <DialogFooter className="gap-2">
                <Button variant="outline" size="sm" onClick={handleCopyTrucking}>
                  Copy to Clipboard
                </Button>
                <Button
                  disabled={!truckingEmail}
                  onClick={handleSendTrucking}
                >
                  Send via Email
                </Button>
              </DialogFooter>
            </div>
          ) : (
            <div className="py-8 text-center text-muted-foreground">Failed to load pickup info.</div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
