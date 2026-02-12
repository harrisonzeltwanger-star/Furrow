import { useState, useEffect, useMemo } from 'react';
import { jsPDF } from 'jspdf';
import api from '@/services/api';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';

interface SignatureInfo {
  name: string;
  signatureImage: string | null;
  signedAt: string;
  signedBy: string;
}

interface ContractPO {
  id: string;
  poNumber: string | null;
  buyerOrg: { id: string; name: string };
  growerOrg: { id: string; name: string };
  destinationSite: { id: string; siteName: string } | null;
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
  poStacks: Array<{
    listing: { id: string; stackId: string; productType: string | null; baleType: string | null };
  }>;
  createdAt: string;
  buyerSignature: SignatureInfo | null;
  growerSignature: SignatureInfo | null;
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

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '--';
  return new Date(dateStr).toLocaleDateString();
}

// Earthy color palette
const EARTH = {
  brown: [101, 67, 33],       // #654321
  tan: [210, 180, 140],       // #D2B48C
  olive: [107, 142, 35],      // #6B8E23
  sage: [143, 163, 133],      // #8FA385
  cream: [255, 253, 240],     // #FFFDF0
  wheat: [245, 222, 179],     // #F5DEB3
  darkGreen: [34, 85, 51],    // #225533
  rust: [165, 82, 47],        // #A5522F
} as const;

function generateContractPDF(c: ContractPO): jsPDF {
  const doc = new jsPDF();
  const pw = doc.internal.pageSize.getWidth();
  const margin = 20;
  let y = 15;

  // Background cream tint for header area
  doc.setFillColor(...EARTH.cream);
  doc.rect(0, 0, pw, 55, 'F');

  // Header bar
  doc.setFillColor(...EARTH.brown);
  doc.rect(0, 0, pw, 8, 'F');

  // Title
  y = 20;
  doc.setFontSize(22);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...EARTH.brown);
  doc.text('HAY PURCHASE CONTRACT', pw / 2, y, { align: 'center' });
  y += 8;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...EARTH.rust);
  doc.text('Furrow - Hay Procurement & Logistics', pw / 2, y, { align: 'center' });
  y += 5;

  doc.setFontSize(9);
  doc.setTextColor(120, 100, 80);
  doc.text(`Contract ${c.poNumber || 'N/A'}  |  ${formatDate(c.signedAt || c.createdAt)}  |  Status: ${c.status}`, pw / 2, y, { align: 'center' });
  y += 8;

  // Olive accent line
  doc.setDrawColor(...EARTH.olive);
  doc.setLineWidth(1.5);
  doc.line(margin, y, pw - margin, y);
  y += 10;

  // Section helper
  const section = (title: string) => {
    doc.setFillColor(...EARTH.tan);
    doc.roundedRect(margin, y - 4, pw - 2 * margin, 9, 2, 2, 'F');
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...EARTH.darkGreen);
    doc.text(title, margin + 4, y + 2);
    y += 12;
  };

  const field = (label: string, value: string, xOffset = 0) => {
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...EARTH.brown);
    doc.text(label, margin + xOffset, y);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(60, 50, 40);
    doc.text(value, margin + xOffset + 42, y);
    y += 6;
  };

  // PARTIES
  section('PARTIES');
  field('Buyer:', c.buyerOrg.name);
  field('Grower:', c.growerOrg.name);
  if (c.destinationSite) field('Destination:', c.destinationSite.siteName);
  y += 4;

  // PRODUCT DETAILS
  section('PRODUCT DETAILS');
  const productType = c.poStacks[0]?.listing.productType || 'N/A';
  const baleType = c.poStacks[0]?.listing.baleType || 'N/A';
  const stackIds = c.poStacks.map(s => s.listing.stackId).join(', ');

  field('Product Type:', productType);
  field('Bale Type:', baleType);
  field('Stack ID(s):', stackIds);
  field('Price / Ton:', `$${c.pricePerTon.toFixed(2)}`);
  field('Contracted Tons:', `${c.contractedTons}`);
  field('Total Value:', `$${(c.pricePerTon * c.contractedTons).toLocaleString()}`);
  y += 4;

  // CONTRACT TERMS
  section('CONTRACT TERMS');
  field('Delivery Window:', `${formatDate(c.deliveryStartDate)} - ${formatDate(c.deliveryEndDate)}`);
  field('Max Moisture:', c.maxMoisturePercent != null ? `${c.maxMoisturePercent}%` : 'N/A');
  if (c.qualityNotes) {
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...EARTH.brown);
    doc.text('Quality Notes:', margin, y);
    y += 5;
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(60, 50, 40);
    const lines = doc.splitTextToSize(c.qualityNotes, pw - 2 * margin);
    doc.text(lines, margin, y);
    y += lines.length * 4.5 + 2;
  }
  y += 6;

  // Divider
  doc.setDrawColor(...EARTH.sage);
  doc.setLineWidth(0.5);
  doc.line(margin, y, pw - margin, y);
  y += 8;

  // SIGNATURES
  section('SIGNATURES');
  const sigWidth = (pw - 2 * margin - 20) / 2;

  // Buyer
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...EARTH.darkGreen);
  doc.text('BUYER', margin, y);
  doc.text('GROWER', margin + sigWidth + 20, y);
  y += 6;

  // Signature images
  if (c.buyerSignature?.signatureImage) {
    try { doc.addImage(c.buyerSignature.signatureImage, 'PNG', margin, y, 50, 18); } catch { /* skip */ }
  }
  if (c.growerSignature?.signatureImage) {
    try { doc.addImage(c.growerSignature.signatureImage, 'PNG', margin + sigWidth + 20, y, 50, 18); } catch { /* skip */ }
  }
  y += 20;

  // Signature lines
  doc.setDrawColor(...EARTH.brown);
  doc.setLineWidth(0.5);
  doc.line(margin, y, margin + sigWidth, y);
  doc.line(margin + sigWidth + 20, y, pw - margin, y);
  y += 5;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...EARTH.brown);
  doc.text(c.buyerSignature?.name || 'N/A', margin, y);
  doc.text(c.growerSignature?.name || 'N/A', margin + sigWidth + 20, y);
  y += 5;

  doc.setFontSize(8);
  doc.setTextColor(120, 100, 80);
  if (c.buyerSignature) doc.text(`Signed ${formatDate(c.buyerSignature.signedAt)}`, margin, y);
  if (c.growerSignature) doc.text(`Signed ${formatDate(c.growerSignature.signedAt)}`, margin + sigWidth + 20, y);

  // Footer bar
  const ph = doc.internal.pageSize.getHeight();
  doc.setFillColor(...EARTH.brown);
  doc.rect(0, ph - 12, pw, 12, 'F');
  doc.setFontSize(7);
  doc.setTextColor(255, 255, 255);
  doc.text(
    `Generated by Furrow on ${new Date().toLocaleDateString()} | This document is a record of the e-signed agreement.`,
    pw / 2, ph - 5, { align: 'center' }
  );

  return doc;
}

function downloadContractPDF(c: ContractPO) {
  const doc = generateContractPDF(c);
  doc.save(`${c.poNumber || 'contract'}.pdf`);
}

export default function ContractsPage() {
  const { user } = useAuth();
  const [pos, setPOs] = useState<Array<{ id: string; poNumber: string | null; status: string; center: string | null; buyerOrgId: string; growerOrgId: string; buyerOrg: { id: string; name: string }; growerOrg: { id: string; name: string }; pricePerTon: number; contractedTons: number; deliveredTons: number; completedAt: string | null; poStacks: Array<{ listing: { stackId: string; productType: string | null } }> }>>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [contracts, setContracts] = useState<Record<string, ContractPO>>({});
  const [loadingId, setLoadingId] = useState<string | null>(null);

  // Deliveries per PO
  const [poDeliveries, setPODeliveries] = useState<Record<string, Delivery[]>>({});

  // Edit delivery state
  const [editingDeliveryId, setEditingDeliveryId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ totalBaleCount: '', wetBalesCount: '', grossWeight: '', tareWeight: '', location: '' });
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState('');

  // Email dialog
  const [emailDialog, setEmailDialog] = useState(false);
  const [emailTo, setEmailTo] = useState('');
  const [emailSending, setEmailSending] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [emailContract, setEmailContract] = useState<ContractPO | null>(null);

  // Top-level center filter
  const [centerFilter, setCenterFilter] = useState('all');

  // Delivery filters (per expanded PO)
  const [vendorFilter, setVendorFilter] = useState('all');
  const [productFilter, setProductFilter] = useState('all');

  const orgId = user?.organizationId;
  const isAdmin = user?.role === 'FARM_ADMIN' || user?.role === 'MANAGER';

  useEffect(() => {
    const fetchPOs = async () => {
      try {
        const { data } = await api.get('/purchase-orders');
        const completed = data.purchaseOrders.filter(
          (p: { status: string }) => p.status === 'COMPLETED'
        );
        setPOs(completed);
      } catch {
        console.error('Failed to fetch POs');
      } finally {
        setLoading(false);
      }
    };
    fetchPOs();
  }, []);

  const toggleContract = async (id: string) => {
    if (expandedId === id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(id);
    setEditingDeliveryId(null);
    setEditError('');
    setVendorFilter('all');
    setProductFilter('all');

    if (!contracts[id]) {
      setLoadingId(id);
      try {
        const [contractRes, deliveriesRes] = await Promise.all([
          api.get(`/purchase-orders/${id}/contract`),
          api.get(`/purchase-orders/${id}/deliveries`),
        ]);
        setContracts(prev => ({ ...prev, [id]: contractRes.data }));
        setPODeliveries(prev => ({ ...prev, [id]: deliveriesRes.data.deliveries }));
      } catch {
        console.error('Failed to fetch contract');
      } finally {
        setLoadingId(null);
      }
    }
  };

  const openEmailDialog = (c: ContractPO) => {
    setEmailContract(c);
    setEmailTo('');
    setEmailSent(false);
    setEmailDialog(true);
  };

  const sendEmail = async () => {
    if (!emailContract || !emailTo) return;
    setEmailSending(true);
    try {
      const doc = generateContractPDF(emailContract);
      const pdfBase64 = doc.output('datauristring').split(',')[1];
      await api.post('/purchase-orders/send-contract-email', {
        to: emailTo,
        poNumber: emailContract.poNumber,
        pdfBase64,
      });
      setEmailSent(true);
    } catch {
      // Fallback: download the PDF since email backend may not be set up
      downloadContractPDF(emailContract);
      setEmailSent(true);
    } finally {
      setEmailSending(false);
    }
  };

  // Edit delivery handlers
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
      // Refresh deliveries
      try {
        const { data } = await api.get(`/purchase-orders/${poId}/deliveries`);
        setPODeliveries(prev => ({ ...prev, [poId]: data.deliveries }));
      } catch { /* ignore */ }
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: { message?: string } } } };
      setEditError(axiosErr.response?.data?.error?.message || 'Failed to save changes');
    } finally {
      setEditSaving(false);
    }
  };

  // Edit form computed
  const editGross = parseFloat(editForm.grossWeight) || 0;
  const editTare = parseFloat(editForm.tareWeight) || 0;
  const editBales = parseInt(editForm.totalBaleCount) || 0;
  const editNet = editGross - editTare;
  const editAvg = editBales > 0 && editNet > 0 ? editNet / editBales : 0;

  // Center filter options + filtered list
  const centerOptions = useMemo(() => {
    const set = new Set<string>();
    pos.forEach((p) => { if (p.center) set.add(p.center); });
    return Array.from(set).sort();
  }, [pos]);

  const filteredPOs = useMemo(() => {
    if (centerFilter === 'all') return pos;
    return pos.filter((p) => p.center === centerFilter);
  }, [pos, centerFilter]);

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="text-muted-foreground">Loading completed contracts...</div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="mb-6">
        <h2 className="text-2xl font-semibold">Completed Contracts</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Closed purchase order contracts with delivery history and signatures.
        </p>
      </div>

      {pos.length > 0 && (
        <div className="flex flex-wrap items-end gap-4 mb-4">
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
        </div>
      )}

      {filteredPOs.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <p className="text-muted-foreground text-lg mb-2">No completed contracts yet</p>
            <p className="text-sm text-muted-foreground">
              {pos.length === 0
                ? 'Contracts appear here once a purchase order has been closed.'
                : 'Try adjusting your filter.'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredPOs.map((p) => {
            const counterparty = p.buyerOrg.id === orgId ? p.growerOrg.name : p.buyerOrg.name;
            const productType = p.poStacks[0]?.listing.productType;
            const isExpanded = expandedId === p.id;
            const contract = contracts[p.id];
            const deliveries = poDeliveries[p.id] || [];
            const isLoading = loadingId === p.id;

            // Filter deliveries for expanded view
            const filteredDeliveries = deliveries.filter((_d) => {
              if (vendorFilter !== 'all') {
                // We don't have vendor on individual deliveries here so skip vendor filter
                // (deliveries are already scoped to this PO)
              }
              if (productFilter !== 'all') {
                // same—scoped to PO
              }
              return true;
            });

            // Summary stats for deliveries
            const totalNetTons = filteredDeliveries.reduce((sum, d) => sum + d.netWeight / 2000, 0);
            const totalBales = filteredDeliveries.reduce((sum, d) => sum + (d.totalBaleCount ?? 0), 0);

            return (
              <Card
                key={p.id}
                className={`transition-all ${isExpanded ? 'ring-2 ring-primary shadow-md' : 'hover:shadow-md'}`}
              >
                {/* Card header - always visible, clickable */}
                <div
                  className="cursor-pointer px-5 py-4 flex items-center justify-between gap-4"
                  onClick={() => toggleContract(p.id)}
                >
                  <div className="flex items-center gap-4 min-w-0 flex-1">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="font-semibold">{p.poNumber || 'PO'}</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium bg-blue-100 text-blue-800">
                          COMPLETED
                        </span>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {productType && <span>{productType} &middot; </span>}
                        {counterparty}
                        {p.completedAt && <span className="ml-2 text-xs">&middot; Closed {formatDate(p.completedAt)}</span>}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="font-semibold text-lg">${p.pricePerTon}</div>
                      <div className="text-xs text-muted-foreground">{p.contractedTons} tons</div>
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
                      <div className="px-5 py-8 text-center text-muted-foreground">Loading contract details...</div>
                    ) : contract ? (
                      <div className="px-5 py-4 space-y-5">
                        {/* Actions row */}
                        <div className="flex gap-2 justify-end">
                          <Button size="sm" variant="outline" onClick={() => openEmailDialog(contract)}>
                            Send via Email
                          </Button>
                          <Button size="sm" onClick={() => downloadContractPDF(contract)}>
                            Download PDF
                          </Button>
                        </div>

                        {/* Contract details grid */}
                        <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 text-sm">
                          <div>
                            <span className="text-muted-foreground text-xs">Buyer</span>
                            <div className="font-medium">{contract.buyerOrg.name}</div>
                          </div>
                          <div>
                            <span className="text-muted-foreground text-xs">Grower</span>
                            <div className="font-medium">{contract.growerOrg.name}</div>
                          </div>
                          <div>
                            <span className="text-muted-foreground text-xs">Total Value</span>
                            <div className="font-semibold">${(contract.pricePerTon * contract.contractedTons).toLocaleString()}</div>
                          </div>
                          <div>
                            <span className="text-muted-foreground text-xs">Delivered</span>
                            <div className="font-semibold">{contract.deliveredTons} tons</div>
                          </div>
                          <div>
                            <span className="text-muted-foreground text-xs">Contract Date</span>
                            <div className="font-medium">{formatDate(contract.signedAt || contract.createdAt)}</div>
                          </div>
                        </div>

                        {/* Terms */}
                        <div className="rounded-lg bg-muted/50 p-4">
                          <h4 className="text-sm font-semibold mb-3">Contract Terms</h4>
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                            <div>
                              <span className="text-muted-foreground text-xs">Delivery Window</span>
                              <div className="font-medium">{formatDate(contract.deliveryStartDate)} &mdash; {formatDate(contract.deliveryEndDate)}</div>
                            </div>
                            <div>
                              <span className="text-muted-foreground text-xs">Max Moisture</span>
                              <div className="font-medium">{contract.maxMoisturePercent != null ? `${contract.maxMoisturePercent}%` : '--'}</div>
                            </div>
                            <div>
                              <span className="text-muted-foreground text-xs">Product / Bale</span>
                              <div className="font-medium">
                                {contract.poStacks[0]?.listing.productType || 'N/A'} / {contract.poStacks[0]?.listing.baleType || 'N/A'}
                              </div>
                            </div>
                            <div>
                              <span className="text-muted-foreground text-xs">Signed</span>
                              <div className="font-medium">{formatDate(contract.signedAt)}</div>
                            </div>
                            {contract.qualityNotes && (
                              <div className="col-span-2 sm:col-span-4">
                                <span className="text-muted-foreground text-xs">Quality Notes</span>
                                <div className="font-medium">{contract.qualityNotes}</div>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Signatures */}
                        <div>
                          <h4 className="text-sm font-semibold mb-3">Signatures</h4>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {/* Buyer */}
                            <div className="rounded-lg border border-border p-4 bg-white">
                              <div className="text-xs font-medium text-muted-foreground mb-2">Buyer — {contract.buyerOrg.name}</div>
                              {contract.buyerSignature?.signatureImage && (
                                <div className="mb-2 pb-2 border-b border-border">
                                  <img src={contract.buyerSignature.signatureImage} alt="Buyer signature" className="h-16 w-auto" />
                                </div>
                              )}
                              <div className="font-semibold">{contract.buyerSignature?.name || 'N/A'}</div>
                              {contract.buyerSignature && (
                                <div className="text-xs text-muted-foreground">
                                  Signed by {contract.buyerSignature.signedBy} on {formatDate(contract.buyerSignature.signedAt)}
                                </div>
                              )}
                            </div>

                            {/* Grower */}
                            <div className="rounded-lg border border-border p-4 bg-white">
                              <div className="text-xs font-medium text-muted-foreground mb-2">Grower — {contract.growerOrg.name}</div>
                              {contract.growerSignature?.signatureImage && (
                                <div className="mb-2 pb-2 border-b border-border">
                                  <img src={contract.growerSignature.signatureImage} alt="Grower signature" className="h-16 w-auto" />
                                </div>
                              )}
                              <div className="font-semibold">{contract.growerSignature?.name || 'N/A'}</div>
                              {contract.growerSignature && (
                                <div className="text-xs text-muted-foreground">
                                  Signed by {contract.growerSignature.signedBy} on {formatDate(contract.growerSignature.signedAt)}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Delivery History */}
                        <div>
                          <div className="flex items-center justify-between mb-3">
                            <h4 className="text-sm font-semibold">Delivery History ({deliveries.length} loads)</h4>
                            <div className="flex gap-4 text-sm">
                              <div className="text-right">
                                <div className="text-muted-foreground text-xs">Total Bales</div>
                                <div className="font-semibold">{totalBales.toLocaleString()}</div>
                              </div>
                              <div className="text-right">
                                <div className="text-muted-foreground text-xs">Total Tons</div>
                                <div className="font-semibold">{totalNetTons.toFixed(2)}</div>
                              </div>
                            </div>
                          </div>

                          {deliveries.length === 0 ? (
                            <div className="text-sm text-muted-foreground py-2">No deliveries were logged for this contract.</div>
                          ) : (
                            <Card>
                              <CardContent className="p-0">
                                <div className="overflow-x-auto">
                                  <table className="w-full text-sm">
                                    <thead>
                                      <tr className="border-b border-border bg-muted/50">
                                        <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Load #</th>
                                        <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Date</th>
                                        <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">Bales</th>
                                        <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">Wet</th>
                                        <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">Net lbs</th>
                                        <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">Tons</th>
                                        <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">lbs/Bale</th>
                                        <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Location</th>
                                        <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Entered By</th>
                                        {isAdmin && <th className="text-right px-4 py-2.5 font-medium text-muted-foreground"></th>}
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {filteredDeliveries.map((d) => {
                                        const isEditing = editingDeliveryId === d.id;

                                        if (isEditing) {
                                          return (
                                            <tr key={d.id} className="border-b border-border bg-primary/5">
                                              <td className="px-4 py-2 font-medium">{d.loadNumber}</td>
                                              <td className="px-4 py-2 text-muted-foreground">{new Date(d.deliveryDatetime).toLocaleDateString()}</td>
                                              <td className="px-2 py-2">
                                                <Input type="number" min="1" className="w-20 h-8 text-right text-sm" value={editForm.totalBaleCount} onChange={(e) => setEditForm({ ...editForm, totalBaleCount: e.target.value })} />
                                              </td>
                                              <td className="px-2 py-2">
                                                <Input type="number" min="0" className="w-16 h-8 text-right text-sm" value={editForm.wetBalesCount} onChange={(e) => setEditForm({ ...editForm, wetBalesCount: e.target.value })} />
                                              </td>
                                              <td className="px-2 py-2" colSpan={2}>
                                                <div className="flex gap-1 items-center">
                                                  <Input type="number" min="1" className="w-24 h-8 text-right text-sm" value={editForm.grossWeight} onChange={(e) => setEditForm({ ...editForm, grossWeight: e.target.value })} placeholder="Full" />
                                                  <span className="text-muted-foreground text-xs">-</span>
                                                  <Input type="number" min="1" className="w-24 h-8 text-right text-sm" value={editForm.tareWeight} onChange={(e) => setEditForm({ ...editForm, tareWeight: e.target.value })} placeholder="Empty" />
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
                                                <Input className="w-24 h-8 text-sm" value={editForm.location} onChange={(e) => setEditForm({ ...editForm, location: e.target.value })} placeholder="Barn/Pad" />
                                              </td>
                                              <td className="px-4 py-2">{d.enteredBy.name}</td>
                                              {isAdmin && (
                                                <td className="px-4 py-2 text-right">
                                                  <div className="flex gap-1 justify-end">
                                                    <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setEditingDeliveryId(null)} disabled={editSaving}>Cancel</Button>
                                                    <Button size="sm" className="h-7 text-xs" onClick={() => saveEditDelivery(p.id)} disabled={editSaving || editNet <= 0}>
                                                      {editSaving ? 'Saving...' : 'Save'}
                                                    </Button>
                                                  </div>
                                                  {editError && <div className="text-xs text-destructive mt-1">{editError}</div>}
                                                </td>
                                              )}
                                            </tr>
                                          );
                                        }

                                        return (
                                          <tr key={d.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                                            <td className="px-4 py-2.5 font-medium">{d.loadNumber}</td>
                                            <td className="px-4 py-2.5 text-muted-foreground">{new Date(d.deliveryDatetime).toLocaleDateString()}</td>
                                            <td className="px-4 py-2.5 text-right">{d.totalBaleCount ?? '--'}</td>
                                            <td className="px-4 py-2.5 text-right">
                                              {d.wetBalesCount > 0 ? (
                                                <span className="text-amber-600">{d.wetBalesCount}</span>
                                              ) : '0'}
                                            </td>
                                            <td className="px-4 py-2.5 text-right font-medium">{d.netWeight.toLocaleString()}</td>
                                            <td className="px-4 py-2.5 text-right">{(d.netWeight / 2000).toFixed(2)}</td>
                                            <td className="px-4 py-2.5 text-right">{d.avgBaleWeight > 0 ? Math.round(d.avgBaleWeight).toLocaleString() : '--'}</td>
                                            <td className="px-4 py-2.5 text-muted-foreground">{d.qualityNotes || d.barn?.name || d.feedPad?.name || '--'}</td>
                                            <td className="px-4 py-2.5">{d.enteredBy.name}</td>
                                            {isAdmin && (
                                              <td className="px-4 py-2.5 text-right">
                                                <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => startEditDelivery(d)}>Edit</Button>
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
                      </div>
                    ) : null}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* Email dialog */}
      <Dialog open={emailDialog} onOpenChange={setEmailDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Send Contract via Email</DialogTitle>
          </DialogHeader>
          {emailSent ? (
            <div className="py-6 text-center">
              <div className="text-green-600 font-semibold mb-2">PDF downloaded!</div>
              <p className="text-sm text-muted-foreground">
                Attach the downloaded PDF to your email client to send.
              </p>
              <Button className="mt-4" onClick={() => setEmailDialog(false)}>Done</Button>
            </div>
          ) : (
            <>
              <div className="space-y-3 py-2">
                <div className="space-y-1">
                  <Label className="text-sm">Recipient Email</Label>
                  <Input
                    type="email"
                    placeholder="recipient@example.com"
                    value={emailTo}
                    onChange={(e) => setEmailTo(e.target.value)}
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  The contract PDF will be generated and downloaded for you to attach in your email client.
                </p>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setEmailDialog(false)}>Cancel</Button>
                <Button
                  disabled={!emailTo || emailSending}
                  onClick={sendEmail}
                >
                  {emailSending ? 'Generating...' : 'Download & Send'}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
