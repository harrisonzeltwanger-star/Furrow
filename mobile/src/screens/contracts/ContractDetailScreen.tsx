import { useState, useEffect } from 'react';
import { View, Text, ScrollView, Image, Alert } from 'react-native';
import { useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import api from '../../config/api';
import { useAuth } from '../../hooks/useAuth';
import type { ContractDetails, SignatureInfo } from '../../types/models';
import Button from '../../components/ui/Button';
import LoadingScreen from '../../components/ui/LoadingScreen';
import ErrorBanner from '../../components/ui/ErrorBanner';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';

type RouteParams = { ContractDetail: { poId: string } };

interface ContractPO {
  id: string;
  poNumber: string | null;
  buyerOrg: { id: string; name: string };
  growerOrg: { id: string; name: string };
  destinationSite: { id: string; siteName: string } | null;
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
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '--';
  return new Date(dateStr).toLocaleDateString();
}

function generateContractHTML(c: ContractPO): string {
  const productType = c.poStacks[0]?.listing.productType || 'N/A';
  const baleType = c.poStacks[0]?.listing.baleType || 'N/A';
  const stackIds = c.poStacks.map((s) => s.listing.stackId).join(', ');
  const totalValue = (c.pricePerTon * c.contractedTons).toLocaleString();

  return `
    <html>
    <head><style>
      body { font-family: Helvetica, Arial, sans-serif; padding: 20px; color: #3a2a1a; }
      .header { text-align: center; border-bottom: 3px solid #654321; padding-bottom: 16px; margin-bottom: 20px; }
      .header h1 { color: #654321; font-size: 22px; margin: 0; }
      .header p { color: #a5522f; font-size: 12px; margin: 4px 0; }
      .section { margin-bottom: 16px; }
      .section-title { background: #d2b48c; padding: 6px 12px; border-radius: 4px; font-weight: bold; color: #225533; font-size: 13px; margin-bottom: 8px; }
      .field { display: flex; margin-bottom: 4px; font-size: 12px; }
      .field-label { font-weight: bold; color: #654321; width: 140px; }
      .signatures { display: flex; gap: 20px; }
      .sig-box { flex: 1; border: 1px solid #d8cebb; border-radius: 8px; padding: 12px; }
      .sig-label { font-size: 11px; color: #7a6a5a; margin-bottom: 8px; }
      .sig-img { height: 60px; }
      .footer { text-align: center; margin-top: 30px; padding-top: 12px; border-top: 2px solid #654321; font-size: 9px; color: #7a6a5a; }
    </style></head>
    <body>
      <div class="header">
        <h1>HAY PURCHASE CONTRACT</h1>
        <p>Furrow - Hay Procurement & Logistics</p>
        <p style="font-size:10px; color:#7a6a5a;">Contract ${c.poNumber || 'N/A'} | ${formatDate(c.signedAt || c.createdAt)} | Status: ${c.status}</p>
      </div>
      <div class="section">
        <div class="section-title">PARTIES</div>
        <div class="field"><span class="field-label">Buyer:</span><span>${c.buyerOrg.name}</span></div>
        <div class="field"><span class="field-label">Grower:</span><span>${c.growerOrg.name}</span></div>
        ${c.destinationSite ? `<div class="field"><span class="field-label">Destination:</span><span>${c.destinationSite.siteName}</span></div>` : ''}
      </div>
      <div class="section">
        <div class="section-title">PRODUCT DETAILS</div>
        <div class="field"><span class="field-label">Product Type:</span><span>${productType}</span></div>
        <div class="field"><span class="field-label">Bale Type:</span><span>${baleType}</span></div>
        <div class="field"><span class="field-label">Stack ID(s):</span><span>${stackIds}</span></div>
        <div class="field"><span class="field-label">Price / Ton:</span><span>$${c.pricePerTon.toFixed(2)}</span></div>
        <div class="field"><span class="field-label">Contracted Tons:</span><span>${c.contractedTons}</span></div>
        <div class="field"><span class="field-label">Total Value:</span><span>$${totalValue}</span></div>
      </div>
      <div class="section">
        <div class="section-title">CONTRACT TERMS</div>
        <div class="field"><span class="field-label">Delivery Window:</span><span>${formatDate(c.deliveryStartDate)} - ${formatDate(c.deliveryEndDate)}</span></div>
        <div class="field"><span class="field-label">Max Moisture:</span><span>${c.maxMoisturePercent != null ? `${c.maxMoisturePercent}%` : 'N/A'}</span></div>
        ${c.qualityNotes ? `<div class="field"><span class="field-label">Quality Notes:</span><span>${c.qualityNotes}</span></div>` : ''}
      </div>
      <div class="section">
        <div class="section-title">SIGNATURES</div>
        <div class="signatures">
          <div class="sig-box">
            <div class="sig-label">BUYER - ${c.buyerOrg.name}</div>
            ${c.buyerSignature?.signatureImage ? `<img class="sig-img" src="${c.buyerSignature.signatureImage}" />` : ''}
            <div style="font-weight:bold;margin-top:8px;">${c.buyerSignature?.name || 'N/A'}</div>
            ${c.buyerSignature ? `<div style="font-size:10px;color:#7a6a5a;">Signed ${formatDate(c.buyerSignature.signedAt)}</div>` : ''}
          </div>
          <div class="sig-box">
            <div class="sig-label">GROWER - ${c.growerOrg.name}</div>
            ${c.growerSignature?.signatureImage ? `<img class="sig-img" src="${c.growerSignature.signatureImage}" />` : ''}
            <div style="font-weight:bold;margin-top:8px;">${c.growerSignature?.name || 'N/A'}</div>
            ${c.growerSignature ? `<div style="font-size:10px;color:#7a6a5a;">Signed ${formatDate(c.growerSignature.signedAt)}</div>` : ''}
          </div>
        </div>
      </div>
      <div class="footer">Generated by Furrow on ${new Date().toLocaleDateString()} | This document is a record of the e-signed agreement.</div>
    </body>
    </html>
  `;
}

export default function ContractDetailScreen() {
  const route = useRoute<RouteProp<RouteParams, 'ContractDetail'>>();
  const { poId } = route.params;
  const { user } = useAuth();

  const [contract, setContract] = useState<ContractPO | null>(null);
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const [contractRes, deliveriesRes] = await Promise.all([
          api.get(`/purchase-orders/${poId}/contract`),
          api.get(`/purchase-orders/${poId}/deliveries`),
        ]);
        setContract(contractRes.data);
        setDeliveries(deliveriesRes.data.deliveries);
      } catch {
        setError('Failed to load contract details');
      } finally {
        setLoading(false);
      }
    })();
  }, [poId]);

  const handleSharePDF = async () => {
    if (!contract) return;
    try {
      const html = generateContractHTML(contract);
      const { uri } = await Print.printToFileAsync({ html });
      await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: `Contract ${contract.poNumber || ''}` });
    } catch {
      Alert.alert('Error', 'Failed to generate PDF');
    }
  };

  if (loading) return <LoadingScreen />;
  if (error) return (
    <View style={{ flex: 1, padding: 16, backgroundColor: '#faf8f4' }}>
      <ErrorBanner message={error} />
    </View>
  );
  if (!contract) return null;

  const totalValue = contract.pricePerTon * contract.contractedTons;
  const totalNetTons = deliveries.reduce((sum, d) => sum + d.netWeight / 2000, 0);
  const totalBales = deliveries.reduce((sum, d) => sum + (d.totalBaleCount ?? 0), 0);

  return (
    <ScrollView style={{ flex: 1, backgroundColor: '#faf8f4' }} contentContainerStyle={{ padding: 16 }}>
      {/* Actions */}
      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
        <Button onPress={handleSharePDF} style={{ flex: 1 }}>Share PDF</Button>
        <Button variant="outline" onPress={async () => {
          if (!contract) return;
          const html = generateContractHTML(contract);
          await Print.printAsync({ html });
        }} style={{ flex: 1 }}>Print</Button>
      </View>

      {/* Contract Details */}
      <Card style={{ marginBottom: 16 }}>
        <CardHeader>
          <CardTitle style={{ fontSize: 16 }}>Contract Details</CardTitle>
        </CardHeader>
        <CardContent>
          <View style={{ gap: 8 }}>
            <DetailRow label="Buyer" value={contract.buyerOrg.name} />
            <DetailRow label="Grower" value={contract.growerOrg.name} />
            <DetailRow label="Total Value" value={`$${totalValue.toLocaleString()}`} />
            <DetailRow label="Delivered" value={`${contract.deliveredTons} tons`} />
            <DetailRow label="Contract Date" value={formatDate(contract.signedAt || contract.createdAt)} />
          </View>
        </CardContent>
      </Card>

      {/* Terms */}
      <Card style={{ marginBottom: 16 }}>
        <CardHeader>
          <CardTitle style={{ fontSize: 16 }}>Contract Terms</CardTitle>
        </CardHeader>
        <CardContent>
          <View style={{ gap: 8 }}>
            <DetailRow label="Delivery Window" value={`${formatDate(contract.deliveryStartDate)} — ${formatDate(contract.deliveryEndDate)}`} />
            <DetailRow label="Max Moisture" value={contract.maxMoisturePercent != null ? `${contract.maxMoisturePercent}%` : '--'} />
            <DetailRow label="Product / Bale" value={`${contract.poStacks[0]?.listing.productType || 'N/A'} / ${contract.poStacks[0]?.listing.baleType || 'N/A'}`} />
            <DetailRow label="Signed" value={formatDate(contract.signedAt)} />
            {contract.qualityNotes && <DetailRow label="Quality Notes" value={contract.qualityNotes} />}
          </View>
        </CardContent>
      </Card>

      {/* Signatures */}
      <Card style={{ marginBottom: 16 }}>
        <CardHeader>
          <CardTitle style={{ fontSize: 16 }}>Signatures</CardTitle>
        </CardHeader>
        <CardContent>
          <View style={{ gap: 12 }}>
            <SignatureBox
              label={`Buyer — ${contract.buyerOrg.name}`}
              signature={contract.buyerSignature}
            />
            <SignatureBox
              label={`Grower — ${contract.growerOrg.name}`}
              signature={contract.growerSignature}
            />
          </View>
        </CardContent>
      </Card>

      {/* Delivery History */}
      <Card style={{ marginBottom: 16 }}>
        <CardHeader>
          <CardTitle style={{ fontSize: 16 }}>Delivery History ({deliveries.length} loads)</CardTitle>
        </CardHeader>
        <CardContent>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 }}>
            <View>
              <Text style={{ fontSize: 11, color: '#7a6a5a' }}>Total Bales</Text>
              <Text style={{ fontSize: 15, fontWeight: '600', color: '#3a2a1a' }}>{totalBales.toLocaleString()}</Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={{ fontSize: 11, color: '#7a6a5a' }}>Total Tons</Text>
              <Text style={{ fontSize: 15, fontWeight: '600', color: '#3a2a1a' }}>{totalNetTons.toFixed(2)}</Text>
            </View>
          </View>

          {deliveries.length === 0 ? (
            <Text style={{ fontSize: 14, color: '#7a6a5a' }}>No deliveries were logged for this contract.</Text>
          ) : (
            deliveries.map((d) => (
              <View
                key={d.id}
                style={{
                  borderTopWidth: 1,
                  borderTopColor: '#f0ece4',
                  paddingVertical: 10,
                }}
              >
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                  <Text style={{ fontSize: 14, fontWeight: '600', color: '#3a2a1a' }}>{d.loadNumber}</Text>
                  <Text style={{ fontSize: 12, color: '#7a6a5a' }}>{new Date(d.deliveryDatetime).toLocaleDateString()}</Text>
                </View>
                <View style={{ flexDirection: 'row', gap: 16 }}>
                  <MiniStat label="Bales" value={d.totalBaleCount?.toString() ?? '--'} />
                  <MiniStat label="Net lbs" value={d.netWeight.toLocaleString()} />
                  <MiniStat label="Tons" value={(d.netWeight / 2000).toFixed(2)} />
                  <MiniStat label="lbs/Bale" value={d.avgBaleWeight > 0 ? Math.round(d.avgBaleWeight).toLocaleString() : '--'} />
                </View>
                {d.wetBalesCount > 0 && (
                  <Text style={{ fontSize: 11, color: '#c4a035', marginTop: 2 }}>Wet bales: {d.wetBalesCount}</Text>
                )}
              </View>
            ))
          )}
        </CardContent>
      </Card>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
      <Text style={{ fontSize: 13, color: '#7a6a5a' }}>{label}</Text>
      <Text style={{ fontSize: 14, fontWeight: '500', color: '#3a2a1a', flexShrink: 1, textAlign: 'right', marginLeft: 12 }}>{value}</Text>
    </View>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <View>
      <Text style={{ fontSize: 10, color: '#a09080' }}>{label}</Text>
      <Text style={{ fontSize: 13, fontWeight: '500', color: '#3a2a1a' }}>{value}</Text>
    </View>
  );
}

function SignatureBox({ label, signature }: { label: string; signature: SignatureInfo | null }) {
  return (
    <View style={{
      borderWidth: 1,
      borderColor: '#d8cebb',
      borderRadius: 8,
      padding: 12,
      backgroundColor: '#ffffff',
    }}>
      <Text style={{ fontSize: 11, color: '#7a6a5a', marginBottom: 8 }}>{label}</Text>
      {signature?.signatureImage && (
        <Image
          source={{ uri: signature.signatureImage }}
          style={{ height: 50, width: 150, resizeMode: 'contain', marginBottom: 8 }}
        />
      )}
      <Text style={{ fontSize: 14, fontWeight: '600', color: '#3a2a1a' }}>{signature?.name || 'N/A'}</Text>
      {signature && (
        <Text style={{ fontSize: 11, color: '#7a6a5a' }}>
          Signed by {signature.signedBy} on {formatDate(signature.signedAt)}
        </Text>
      )}
    </View>
  );
}
