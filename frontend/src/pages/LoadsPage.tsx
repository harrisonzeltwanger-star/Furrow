import { useState, useEffect, useMemo } from 'react';
import api from '@/services/api';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
// Label removed - unused
import { Card, CardContent } from '@/components/ui/card';
import * as XLSX from 'xlsx';

interface LoadEntry {
  id: string;
  loadNumber: string;
  grossWeight: number | null;
  tareWeight: number | null;
  netWeight: number;
  avgBaleWeight: number;
  totalBaleCount: number | null;
  wetBalesCount: number;
  qualityNotes: string | null;
  deliveryDatetime: string;
  po: {
    id: string;
    poNumber: string;
    pricePerTon: number;
    center: string | null;
    buyerOrg: { id: string; name: string };
    growerOrg: { id: string; name: string };
  };
  listing: {
    id: string;
    stackId: string;
    productType: string | null;
    baleType: string | null;
    organization: { id: string; name: string };
  };
  barn: { id: string; name: string } | null;
  feedPad: { id: string; name: string } | null;
  enteredBy: { id: string; name: string };
}

interface EditForm {
  totalBaleCount: string;
  wetBalesCount: string;
  grossWeight: string;
  tareWeight: string;
  location: string;
}

export default function LoadsPage() {
  const { user } = useAuth();
  const [loads, setLoads] = useState<LoadEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [vendorFilter, setVendorFilter] = useState('all');
  const [productFilter, setProductFilter] = useState('all');
  const [centerFilter, setCenterFilter] = useState('all');

  // Edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<EditForm>({ totalBaleCount: '', wetBalesCount: '', grossWeight: '', tareWeight: '', location: '' });
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState('');

  const orgId = user?.organizationId;
  const isAdmin = user?.role === 'FARM_ADMIN' || user?.role === 'MANAGER';

  const fetchLoads = async () => {
    try {
      const { data } = await api.get('/purchase-orders/loads');
      setLoads(data.loads);
    } catch {
      console.error('Failed to fetch loads');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLoads();
  }, []);

  const startEdit = (l: LoadEntry) => {
    setEditingId(l.id);
    setEditError('');
    setEditForm({
      totalBaleCount: String(l.totalBaleCount ?? ''),
      wetBalesCount: String(l.wetBalesCount ?? 0),
      grossWeight: String(l.grossWeight ?? ''),
      tareWeight: String(l.tareWeight ?? ''),
      location: l.qualityNotes || '',
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditError('');
  };

  const saveEdit = async () => {
    if (!editingId) return;
    setEditSaving(true);
    setEditError('');
    try {
      await api.patch(`/purchase-orders/loads/${editingId}`, {
        totalBaleCount: parseInt(editForm.totalBaleCount, 10),
        wetBalesCount: parseInt(editForm.wetBalesCount || '0', 10),
        grossWeight: parseFloat(editForm.grossWeight),
        tareWeight: parseFloat(editForm.tareWeight),
        location: editForm.location || undefined,
      });
      setEditingId(null);
      await fetchLoads();
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: { message?: string } } } };
      setEditError(axiosErr.response?.data?.error?.message || 'Failed to save changes');
    } finally {
      setEditSaving(false);
    }
  };

  // Build unique filter options
  const vendors = useMemo(() => {
    const set = new Set<string>();
    loads.forEach((l) => {
      const name = l.po.buyerOrg.id === orgId ? l.po.growerOrg.name : l.po.buyerOrg.name;
      set.add(name);
    });
    return Array.from(set).sort();
  }, [loads, orgId]);

  const productTypes = useMemo(() => {
    const set = new Set<string>();
    loads.forEach((l) => {
      if (l.listing.productType) set.add(l.listing.productType);
    });
    return Array.from(set).sort();
  }, [loads]);

  const centerOptions = useMemo(() => {
    const set = new Set<string>();
    loads.forEach((l) => { if (l.po.center) set.add(l.po.center); });
    return Array.from(set).sort();
  }, [loads]);

  // Filter
  const filtered = useMemo(() => {
    return loads.filter((l) => {
      if (vendorFilter !== 'all') {
        const vendor = l.po.buyerOrg.id === orgId ? l.po.growerOrg.name : l.po.buyerOrg.name;
        if (vendor !== vendorFilter) return false;
      }
      if (productFilter !== 'all') {
        if (l.listing.productType !== productFilter) return false;
      }
      if (centerFilter !== 'all') {
        if (l.po.center !== centerFilter) return false;
      }
      return true;
    });
  }, [loads, vendorFilter, productFilter, centerFilter, orgId]);

  // Summary stats
  const totalNetTons = useMemo(() => filtered.reduce((sum, l) => sum + l.netWeight / 2000, 0), [filtered]);
  const totalBales = useMemo(() => filtered.reduce((sum, l) => sum + (l.totalBaleCount ?? 0), 0), [filtered]);
  const totalWetBales = useMemo(() => filtered.reduce((sum, l) => sum + (l.wetBalesCount ?? 0), 0), [filtered]);
  const wetBalesPct = totalBales > 0 ? (totalWetBales / totalBales) * 100 : 0;
  const totalNetLbs = useMemo(() => filtered.reduce((sum, l) => sum + l.netWeight, 0), [filtered]);
  const avgLbsPerBale = totalBales > 0 ? totalNetLbs / totalBales : 0;

  // Export to Excel
  const exportToExcel = () => {
    const rows = filtered.map((l) => {
      const vendor = l.po.buyerOrg.id === orgId ? l.po.growerOrg.name : l.po.buyerOrg.name;
      return {
        'Load #': l.loadNumber,
        'Date': new Date(l.deliveryDatetime).toLocaleDateString(),
        'PO': l.po.poNumber,
        'Center': l.po.center || '',
        'Vendor': vendor,
        'Product': l.listing.productType || '',
        'Bale Type': l.listing.baleType || '',
        'Bales': l.totalBaleCount ?? 0,
        'Wet Bales': l.wetBalesCount ?? 0,
        'Gross lbs': l.grossWeight ?? 0,
        'Tare lbs': l.tareWeight ?? 0,
        'Net lbs': l.netWeight,
        'Tons': Number((l.netWeight / 2000).toFixed(2)),
        'lbs/Bale': l.avgBaleWeight > 0 ? Math.round(l.avgBaleWeight) : 0,
        'Location': l.qualityNotes || l.barn?.name || l.feedPad?.name || '',
      };
    });

    // Add summary row
    rows.push({
      'Load #': '',
      'Date': '',
      'PO': '',
      'Center': '',
      'Vendor': '',
      'Product': '',
      'Bale Type': 'TOTALS',
      'Bales': totalBales,
      'Wet Bales': totalWetBales,
      'Gross lbs': 0,
      'Tare lbs': 0,
      'Net lbs': totalNetLbs,
      'Tons': Number(totalNetTons.toFixed(2)),
      'lbs/Bale': avgLbsPerBale > 0 ? Math.round(avgLbsPerBale) : 0,
      'Location': '',
    });

    const ws = XLSX.utils.json_to_sheet(rows);

    // Auto-size columns
    const colWidths = Object.keys(rows[0] || {}).map((key) => {
      const maxLen = Math.max(
        key.length,
        ...rows.map((r) => String((r as Record<string, unknown>)[key] ?? '').length)
      );
      return { wch: Math.min(maxLen + 2, 30) };
    });
    ws['!cols'] = colWidths;

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Loads');

    const today = new Date().toISOString().split('T')[0];
    XLSX.writeFile(wb, `Loads_Export_${today}.xlsx`);
  };

  // Edit form computed
  const editGross = parseFloat(editForm.grossWeight) || 0;
  const editTare = parseFloat(editForm.tareWeight) || 0;
  const editBales = parseInt(editForm.totalBaleCount) || 0;
  const editNet = editGross - editTare;
  const editAvg = editBales > 0 && editNet > 0 ? editNet / editBales : 0;

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="text-muted-foreground">Loading deliveries...</div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="mb-6">
        <h2 className="text-2xl font-semibold">Loads</h2>
        <p className="text-sm text-muted-foreground mt-1">
          All deliveries across your active purchase orders.
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-end gap-4 mb-4">
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Vendor</label>
          <select
            value={vendorFilter}
            onChange={(e) => setVendorFilter(e.target.value)}
            className="block w-48 rounded-md border border-border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="all">All Vendors</option>
            {vendors.map((v) => (
              <option key={v} value={v}>{v}</option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Product Type</label>
          <select
            value={productFilter}
            onChange={(e) => setProductFilter(e.target.value)}
            className="block w-48 rounded-md border border-border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="all">All Products</option>
            {productTypes.map((p) => (
              <option key={p} value={p}>{p}</option>
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
            {centerOptions.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={exportToExcel}
          disabled={filtered.length === 0}
          className="ml-auto"
        >
          Export to Excel
        </Button>
      </div>

      {/* Dashboard KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
        <Card>
          <CardContent className="py-3 px-4">
            <div className="text-xs font-medium text-muted-foreground">Loads</div>
            <div className="text-2xl font-bold">{filtered.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-3 px-4">
            <div className="text-xs font-medium text-muted-foreground">Total Bales</div>
            <div className="text-2xl font-bold">{totalBales.toLocaleString()}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-3 px-4">
            <div className="text-xs font-medium text-muted-foreground">Total Wet Bales</div>
            <div className="text-2xl font-bold text-amber-600">{totalWetBales.toLocaleString()}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-3 px-4">
            <div className="text-xs font-medium text-muted-foreground">% Wet Bales</div>
            <div className={`text-2xl font-bold ${wetBalesPct > 5 ? 'text-red-600' : wetBalesPct > 0 ? 'text-amber-600' : ''}`}>
              {wetBalesPct.toFixed(1)}%
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-3 px-4">
            <div className="text-xs font-medium text-muted-foreground">Total Tons</div>
            <div className="text-2xl font-bold">{totalNetTons.toFixed(2)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-3 px-4">
            <div className="text-xs font-medium text-muted-foreground">Avg lbs/Bale</div>
            <div className="text-2xl font-bold">{avgLbsPerBale > 0 ? Math.round(avgLbsPerBale).toLocaleString() : '--'}</div>
          </CardContent>
        </Card>
      </div>

      {/* Loads table */}
      {filtered.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <p className="text-muted-foreground text-lg mb-2">No deliveries found</p>
            <p className="text-sm text-muted-foreground">
              {loads.length === 0
                ? 'Deliveries will appear here once loads are logged against active POs.'
                : 'Try adjusting your filters.'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/50">
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Load #</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Date</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">PO</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Vendor</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Product</th>
                    <th className="text-right px-4 py-3 font-medium text-muted-foreground">Bales</th>
                    <th className="text-right px-4 py-3 font-medium text-muted-foreground">Wet</th>
                    <th className="text-right px-4 py-3 font-medium text-muted-foreground">Net lbs</th>
                    <th className="text-right px-4 py-3 font-medium text-muted-foreground">Tons</th>
                    <th className="text-right px-4 py-3 font-medium text-muted-foreground">lbs/Bale</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Location</th>
                    {isAdmin && <th className="text-right px-4 py-3 font-medium text-muted-foreground"></th>}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((l) => {
                    const vendor = l.po.buyerOrg.id === orgId ? l.po.growerOrg.name : l.po.buyerOrg.name;
                    const isEditing = editingId === l.id;

                    if (isEditing) {
                      return (
                        <tr key={l.id} className="border-b border-border bg-primary/5">
                          <td className="px-4 py-2 font-medium">{l.loadNumber}</td>
                          <td className="px-4 py-2 text-muted-foreground">
                            {new Date(l.deliveryDatetime).toLocaleDateString()}
                          </td>
                          <td className="px-4 py-2">{l.po.poNumber}</td>
                          <td className="px-4 py-2">{vendor}</td>
                          <td className="px-4 py-2">{l.listing.productType || '--'}</td>
                          <td className="px-2 py-2">
                            <Input
                              type="number"
                              min="1"
                              className="w-20 h-8 text-right text-sm"
                              value={editForm.totalBaleCount}
                              onChange={(e) => setEditForm({ ...editForm, totalBaleCount: e.target.value })}
                            />
                          </td>
                          <td className="px-2 py-2">
                            <Input
                              type="number"
                              min="0"
                              className="w-16 h-8 text-right text-sm"
                              value={editForm.wetBalesCount}
                              onChange={(e) => setEditForm({ ...editForm, wetBalesCount: e.target.value })}
                            />
                          </td>
                          <td className="px-2 py-2" colSpan={2}>
                            <div className="flex gap-1 items-center">
                              <Input
                                type="number"
                                min="1"
                                className="w-24 h-8 text-right text-sm"
                                value={editForm.grossWeight}
                                onChange={(e) => setEditForm({ ...editForm, grossWeight: e.target.value })}
                                placeholder="Full"
                              />
                              <span className="text-muted-foreground text-xs">-</span>
                              <Input
                                type="number"
                                min="1"
                                className="w-24 h-8 text-right text-sm"
                                value={editForm.tareWeight}
                                onChange={(e) => setEditForm({ ...editForm, tareWeight: e.target.value })}
                                placeholder="Empty"
                              />
                            </div>
                            {editNet > 0 && (
                              <div className="text-xs text-muted-foreground mt-0.5 text-right">
                                = {editNet.toLocaleString()} lbs ({(editNet / 2000).toFixed(2)}T)
                              </div>
                            )}
                          </td>
                          <td className="px-2 py-2 text-right text-xs text-muted-foreground">
                            {editAvg > 0 ? Math.round(editAvg).toLocaleString() : '--'}
                          </td>
                          <td className="px-2 py-2">
                            <Input
                              className="w-24 h-8 text-sm"
                              value={editForm.location}
                              onChange={(e) => setEditForm({ ...editForm, location: e.target.value })}
                              placeholder="Barn/Pad"
                            />
                          </td>
                          <td className="px-4 py-2 text-right">
                            <div className="flex gap-1 justify-end">
                              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={cancelEdit} disabled={editSaving}>
                                Cancel
                              </Button>
                              <Button size="sm" className="h-7 text-xs" onClick={saveEdit} disabled={editSaving || editNet <= 0}>
                                {editSaving ? 'Saving...' : 'Save'}
                              </Button>
                            </div>
                            {editError && (
                              <div className="text-xs text-destructive mt-1">{editError}</div>
                            )}
                          </td>
                        </tr>
                      );
                    }

                    return (
                      <tr key={l.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                        <td className="px-4 py-3 font-medium">{l.loadNumber}</td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {new Date(l.deliveryDatetime).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-3">{l.po.poNumber}</td>
                        <td className="px-4 py-3">{vendor}</td>
                        <td className="px-4 py-3">
                          {l.listing.productType || '--'}
                          {l.listing.baleType && (
                            <span className="text-muted-foreground text-xs ml-1">({l.listing.baleType})</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">{l.totalBaleCount ?? '--'}</td>
                        <td className="px-4 py-3 text-right">
                          {l.wetBalesCount > 0 ? (
                            <span className="text-amber-600">{l.wetBalesCount}</span>
                          ) : (
                            '0'
                          )}
                        </td>
                        <td className="px-4 py-3 text-right font-medium">{l.netWeight.toLocaleString()}</td>
                        <td className="px-4 py-3 text-right">{(l.netWeight / 2000).toFixed(2)}</td>
                        <td className="px-4 py-3 text-right">{l.avgBaleWeight > 0 ? Math.round(l.avgBaleWeight).toLocaleString() : '--'}</td>
                        <td className="px-4 py-3 text-muted-foreground">{l.qualityNotes || l.barn?.name || l.feedPad?.name || '--'}</td>
                        {isAdmin && (
                          <td className="px-4 py-3 text-right">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 text-xs"
                              onClick={() => startEdit(l)}
                            >
                              Edit
                            </Button>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
