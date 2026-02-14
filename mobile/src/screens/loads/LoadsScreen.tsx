import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  ScrollView,
  RefreshControl,
  Alert,
  StyleSheet,
} from 'react-native';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as XLSX from 'xlsx';
import { useAuth } from '../../hooks/useAuth';
import api from '../../config/api';
import type { LoadEntry } from '../../types/models';
import KPICard from '../../components/ui/KPICard';
import FilterChip from '../../components/ui/FilterChip';
import SelectPicker from '../../components/ui/SelectPicker';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import { Card, CardContent } from '../../components/ui/Card';
import LoadingScreen from '../../components/ui/LoadingScreen';
import EmptyState from '../../components/ui/EmptyState';
import ErrorBanner from '../../components/ui/ErrorBanner';

interface EditForm {
  totalBaleCount: string;
  wetBalesCount: string;
  grossWeight: string;
  tareWeight: string;
  location: string;
}

export default function LoadsScreen() {
  const { user } = useAuth();

  const [loads, setLoads] = useState<LoadEntry[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [vendorFilter, setVendorFilter] = useState<string>('all');
  const [productFilter, setProductFilter] = useState<string>('all');
  const [baleTypeFilter, setBaleTypeFilter] = useState<string>('all');
  const [centerFilter, setCenterFilter] = useState<string>('all');

  // Edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<EditForm>({
    totalBaleCount: '',
    wetBalesCount: '',
    grossWeight: '',
    tareWeight: '',
    location: '',
  });
  const [editSaving, setEditSaving] = useState<boolean>(false);
  const [editError, setEditError] = useState<string>('');
  const [exporting, setExporting] = useState<boolean>(false);

  const orgId: string | undefined = user?.organizationId;
  const isAdmin: boolean = user?.role === 'FARM_ADMIN' || user?.role === 'MANAGER';

  const fetchLoads = useCallback(async () => {
    try {
      const { data } = await api.get('/purchase-orders/loads');
      setLoads(data.loads);
    } catch {
      // silent fail
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchLoads();
  }, [fetchLoads]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchLoads();
  }, [fetchLoads]);

  // ---------- edit logic ----------

  const startEdit = useCallback((l: LoadEntry) => {
    setEditingId(l.id);
    setEditError('');
    setEditForm({
      totalBaleCount: String(l.totalBaleCount ?? ''),
      wetBalesCount: String(l.wetBalesCount ?? 0),
      grossWeight: String(l.grossWeight ?? ''),
      tareWeight: String(l.tareWeight ?? ''),
      location: l.qualityNotes || '',
    });
  }, []);

  const cancelEdit = useCallback(() => {
    setEditingId(null);
    setEditError('');
  }, []);

  const saveEdit = useCallback(async () => {
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
  }, [editingId, editForm, fetchLoads]);

  // Edit form computed previews
  const editGross: number = parseFloat(editForm.grossWeight) || 0;
  const editTare: number = parseFloat(editForm.tareWeight) || 0;
  const editBales: number = parseInt(editForm.totalBaleCount, 10) || 0;
  const editNet: number = editGross - editTare;
  const editAvg: number = editBales > 0 && editNet > 0 ? editNet / editBales : 0;

  // ---------- filter options ----------

  const vendors = useMemo<string[]>(() => {
    const set = new Set<string>();
    loads.forEach((l) => {
      const name = l.po.buyerOrg.id === orgId ? l.po.growerOrg.name : l.po.buyerOrg.name;
      set.add(name);
    });
    return Array.from(set).sort();
  }, [loads, orgId]);

  const productTypes = useMemo<string[]>(() => {
    const set = new Set<string>();
    loads.forEach((l) => {
      if (l.listing.productType) set.add(l.listing.productType);
    });
    return Array.from(set).sort();
  }, [loads]);

  const baleTypes = useMemo<string[]>(() => {
    const set = new Set<string>();
    loads.forEach((l) => {
      if (l.listing.baleType) set.add(l.listing.baleType);
    });
    return Array.from(set).sort();
  }, [loads]);

  const centerOptions = useMemo<string[]>(() => {
    const set = new Set<string>();
    loads.forEach((l) => {
      if (l.po.center) set.add(l.po.center);
    });
    return Array.from(set).sort();
  }, [loads]);

  // ---------- filtered + summary ----------

  const filtered = useMemo<LoadEntry[]>(() => {
    return loads.filter((l) => {
      if (vendorFilter !== 'all') {
        const vendor = l.po.buyerOrg.id === orgId ? l.po.growerOrg.name : l.po.buyerOrg.name;
        if (vendor !== vendorFilter) return false;
      }
      if (productFilter !== 'all') {
        if (l.listing.productType !== productFilter) return false;
      }
      if (baleTypeFilter !== 'all') {
        if (l.listing.baleType !== baleTypeFilter) return false;
      }
      if (centerFilter !== 'all') {
        if (l.po.center !== centerFilter) return false;
      }
      return true;
    });
  }, [loads, vendorFilter, productFilter, baleTypeFilter, centerFilter, orgId]);

  const totalNetTons = useMemo<number>(
    () => filtered.reduce((sum, l) => sum + l.netWeight / 2000, 0),
    [filtered],
  );
  const totalBales = useMemo<number>(
    () => filtered.reduce((sum, l) => sum + (l.totalBaleCount ?? 0), 0),
    [filtered],
  );
  const totalWetBales = useMemo<number>(
    () => filtered.reduce((sum, l) => sum + (l.wetBalesCount ?? 0), 0),
    [filtered],
  );
  const wetBalesPct: number = totalBales > 0 ? (totalWetBales / totalBales) * 100 : 0;
  const totalNetLbs = useMemo<number>(
    () => filtered.reduce((sum, l) => sum + l.netWeight, 0),
    [filtered],
  );
  const avgLbsPerBale: number = totalBales > 0 ? totalNetLbs / totalBales : 0;

  // ---------- Excel export ----------

  const exportToExcel = useCallback(async () => {
    setExporting(true);
    try {
      const rows = filtered.map((l) => {
        const vendor = l.po.buyerOrg.id === orgId ? l.po.growerOrg.name : l.po.buyerOrg.name;
        return {
          'Load #': l.loadNumber,
          Date: new Date(l.deliveryDatetime).toLocaleDateString(),
          PO: l.po.poNumber,
          Center: l.po.center || '',
          Vendor: vendor,
          Product: l.listing.productType || '',
          'Bale Type': l.listing.baleType || '',
          Bales: l.totalBaleCount ?? 0,
          'Wet Bales': l.wetBalesCount ?? 0,
          'Gross lbs': l.grossWeight ?? 0,
          'Tare lbs': l.tareWeight ?? 0,
          'Net lbs': l.netWeight,
          Tons: Number((l.netWeight / 2000).toFixed(2)),
          'lbs/Bale': l.avgBaleWeight > 0 ? Math.round(l.avgBaleWeight) : 0,
          Location: l.qualityNotes || l.barn?.name || l.feedPad?.name || '',
        };
      });

      // Totals row
      rows.push({
        'Load #': '',
        Date: '',
        PO: '',
        Center: '',
        Vendor: '',
        Product: '',
        'Bale Type': 'TOTALS',
        Bales: totalBales,
        'Wet Bales': totalWetBales,
        'Gross lbs': 0,
        'Tare lbs': 0,
        'Net lbs': totalNetLbs,
        Tons: Number(totalNetTons.toFixed(2)),
        'lbs/Bale': avgLbsPerBale > 0 ? Math.round(avgLbsPerBale) : 0,
        Location: '',
      });

      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Loads');

      const wbout = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });
      const today = new Date().toISOString().split('T')[0];
      const filename = `Loads_Export_${today}.xlsx`;
      const fileUri = `${FileSystem.cacheDirectory}${filename}`;

      await FileSystem.writeAsStringAsync(fileUri, wbout, {
        encoding: FileSystem.EncodingType.Base64,
      });

      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(fileUri, {
          mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          dialogTitle: 'Export Loads',
          UTI: 'org.openxmlformats.spreadsheetml.sheet',
        });
      } else {
        Alert.alert('Export', `File saved to ${fileUri}`);
      }
    } catch (err) {
      Alert.alert('Error', 'Failed to export to Excel');
    } finally {
      setExporting(false);
    }
  }, [filtered, orgId, totalBales, totalWetBales, totalNetLbs, totalNetTons, avgLbsPerBale]);

  // ---------- render ----------

  const renderLoadCard = useCallback(
    ({ item: l }: { item: LoadEntry }) => {
      const vendor =
        l.po.buyerOrg.id === orgId ? l.po.growerOrg.name : l.po.buyerOrg.name;
      const isEditing: boolean = editingId === l.id;

      if (isEditing) {
        return (
          <Card style={styles.editCard} highlighted>
            <View style={styles.cardInner}>
              <View style={styles.editHeaderRow}>
                <Text style={styles.loadNumber}>{l.loadNumber} \u2014 Editing</Text>
              </View>

              {editError ? <ErrorBanner message={editError} /> : null}

              <Input
                label="Bales"
                keyboardType="number-pad"
                value={editForm.totalBaleCount}
                onChangeText={(v: string) => setEditForm((f) => ({ ...f, totalBaleCount: v }))}
                containerStyle={styles.editFieldSpacing}
              />
              <Input
                label="Wet Bales"
                keyboardType="number-pad"
                value={editForm.wetBalesCount}
                onChangeText={(v: string) => setEditForm((f) => ({ ...f, wetBalesCount: v }))}
                containerStyle={styles.editFieldSpacing}
              />
              <View style={styles.weightRow}>
                <Input
                  label="Full Weight (lbs)"
                  keyboardType="numeric"
                  value={editForm.grossWeight}
                  onChangeText={(v: string) => setEditForm((f) => ({ ...f, grossWeight: v }))}
                  containerStyle={styles.weightInput}
                />
                <Input
                  label="Empty Weight (lbs)"
                  keyboardType="numeric"
                  value={editForm.tareWeight}
                  onChangeText={(v: string) => setEditForm((f) => ({ ...f, tareWeight: v }))}
                  containerStyle={styles.weightInput}
                />
              </View>

              {editGross > 0 && editTare > 0 && (
                <View style={styles.editPreviewRow}>
                  <Text style={styles.editPreviewText}>
                    Net: {editNet > 0 ? editNet.toLocaleString() : '--'} lbs (
                    {editNet > 0 ? (editNet / 2000).toFixed(2) : '--'}T)
                  </Text>
                  <Text style={styles.editPreviewText}>
                    lbs/Bale: {editAvg > 0 ? Math.round(editAvg).toLocaleString() : '--'}
                  </Text>
                </View>
              )}

              <Input
                label="Location"
                value={editForm.location}
                onChangeText={(v: string) => setEditForm((f) => ({ ...f, location: v }))}
                placeholder="Barn/Pad"
                containerStyle={styles.editFieldSpacing}
              />

              <View style={styles.editActions}>
                <Button
                  variant="outline"
                  size="sm"
                  onPress={cancelEdit}
                  disabled={editSaving}
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onPress={saveEdit}
                  disabled={editSaving || editNet <= 0}
                  loading={editSaving}
                >
                  Save
                </Button>
              </View>
            </View>
          </Card>
        );
      }

      return (
        <Card style={styles.loadCard}>
          <View style={styles.cardInner}>
            {/* Header row */}
            <View style={styles.loadHeaderRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.loadNumber}>{l.loadNumber}</Text>
                <Text style={styles.loadDate}>
                  {new Date(l.deliveryDatetime).toLocaleDateString()}
                </Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={styles.netWeightText}>{l.netWeight.toLocaleString()} lbs</Text>
                <Text style={styles.tonsText}>{(l.netWeight / 2000).toFixed(2)} tons</Text>
              </View>
            </View>

            {/* Details grid */}
            <View style={styles.detailsGrid}>
              <View style={styles.detailItem}>
                <Text style={styles.detailLabel}>PO</Text>
                <Text style={styles.detailValue}>{l.po.poNumber}</Text>
              </View>
              <View style={styles.detailItem}>
                <Text style={styles.detailLabel}>Vendor</Text>
                <Text style={styles.detailValue} numberOfLines={1}>
                  {vendor}
                </Text>
              </View>
              <View style={styles.detailItem}>
                <Text style={styles.detailLabel}>Product</Text>
                <Text style={styles.detailValue}>
                  {l.listing.productType || '--'}
                  {l.listing.baleType ? ` (${l.listing.baleType})` : ''}
                </Text>
              </View>
              <View style={styles.detailItem}>
                <Text style={styles.detailLabel}>Bales</Text>
                <Text style={styles.detailValue}>{l.totalBaleCount ?? '--'}</Text>
              </View>
              <View style={styles.detailItem}>
                <Text style={styles.detailLabel}>Wet</Text>
                <Text
                  style={[
                    styles.detailValue,
                    l.wetBalesCount > 0 ? { color: '#d97706' } : {},
                  ]}
                >
                  {l.wetBalesCount > 0 ? l.wetBalesCount : '0'}
                </Text>
              </View>
              <View style={styles.detailItem}>
                <Text style={styles.detailLabel}>lbs/Bale</Text>
                <Text style={styles.detailValue}>
                  {l.avgBaleWeight > 0 ? Math.round(l.avgBaleWeight).toLocaleString() : '--'}
                </Text>
              </View>
              <View style={styles.detailItem}>
                <Text style={styles.detailLabel}>Location</Text>
                <Text style={styles.detailValue} numberOfLines={1}>
                  {l.qualityNotes || l.barn?.name || l.feedPad?.name || '--'}
                </Text>
              </View>
            </View>

            {/* Edit button */}
            {isAdmin && (
              <View style={styles.editBtnRow}>
                <Button variant="ghost" size="sm" onPress={() => startEdit(l)}>
                  Edit
                </Button>
              </View>
            )}
          </View>
        </Card>
      );
    },
    [orgId, isAdmin, editingId, editForm, editSaving, editError, editGross, editTare, editBales, editNet, editAvg, startEdit, cancelEdit, saveEdit],
  );

  if (loading) {
    return <LoadingScreen message="Loading deliveries..." />;
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        renderItem={renderLoadCard}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#2d5a27" />
        }
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <>
            {/* Title */}
            <Text style={styles.title}>Loads</Text>
            <Text style={styles.subtitle}>
              All deliveries across your active purchase orders.
            </Text>

            {/* Filters */}
            {loads.length > 0 && (
              <>
                {/* Vendor filter */}
                {vendors.length > 0 && (
                  <>
                    <Text style={styles.filterLabel}>Vendor</Text>
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      style={styles.filterRow}
                    >
                      <FilterChip
                        label="All Vendors"
                        selected={vendorFilter === 'all'}
                        onPress={() => setVendorFilter('all')}
                      />
                      {vendors.map((v) => (
                        <FilterChip
                          key={v}
                          label={v}
                          selected={vendorFilter === v}
                          onPress={() => setVendorFilter(v)}
                        />
                      ))}
                    </ScrollView>
                  </>
                )}

                {/* Product type filter */}
                {productTypes.length > 0 && (
                  <>
                    <Text style={styles.filterLabel}>Product Type</Text>
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      style={styles.filterRow}
                    >
                      <FilterChip
                        label="All Products"
                        selected={productFilter === 'all'}
                        onPress={() => setProductFilter('all')}
                      />
                      {productTypes.map((p) => (
                        <FilterChip
                          key={p}
                          label={p}
                          selected={productFilter === p}
                          onPress={() => setProductFilter(p)}
                        />
                      ))}
                    </ScrollView>
                  </>
                )}

                {/* Bale type filter */}
                {baleTypes.length > 0 && (
                  <>
                    <Text style={styles.filterLabel}>Bale Type</Text>
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      style={styles.filterRow}
                    >
                      <FilterChip
                        label="All Bale Types"
                        selected={baleTypeFilter === 'all'}
                        onPress={() => setBaleTypeFilter('all')}
                      />
                      {baleTypes.map((b) => (
                        <FilterChip
                          key={b}
                          label={b}
                          selected={baleTypeFilter === b}
                          onPress={() => setBaleTypeFilter(b)}
                        />
                      ))}
                    </ScrollView>
                  </>
                )}

                {/* Center filter */}
                {centerOptions.length > 0 && (
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
                      {centerOptions.map((c) => (
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

                {/* Export button */}
                <Button
                  variant="outline"
                  size="sm"
                  onPress={exportToExcel}
                  disabled={filtered.length === 0 || exporting}
                  loading={exporting}
                  style={styles.exportButton}
                >
                  Export to Excel
                </Button>
              </>
            )}

            {/* KPI Summary */}
            <View style={styles.kpiRow}>
              <View style={styles.kpiItem}>
                <KPICard label="Loads" value={filtered.length} />
              </View>
              <View style={styles.kpiItem}>
                <KPICard label="Total Bales" value={totalBales.toLocaleString()} />
              </View>
            </View>
            <View style={styles.kpiRow}>
              <View style={styles.kpiItem}>
                <KPICard
                  label="Wet Bales"
                  value={totalWetBales.toLocaleString()}
                  valueColor="#d97706"
                />
              </View>
              <View style={styles.kpiItem}>
                <KPICard
                  label="% Wet"
                  value={`${wetBalesPct.toFixed(1)}%`}
                  valueColor={
                    wetBalesPct > 5 ? '#dc2626' : wetBalesPct > 0 ? '#d97706' : undefined
                  }
                />
              </View>
            </View>
            <View style={styles.kpiRow}>
              <View style={styles.kpiItem}>
                <KPICard label="Total Tons" value={totalNetTons.toFixed(2)} />
              </View>
              <View style={styles.kpiItem}>
                <KPICard
                  label="Avg lbs/Bale"
                  value={avgLbsPerBale > 0 ? Math.round(avgLbsPerBale).toLocaleString() : '--'}
                />
              </View>
            </View>
          </>
        }
        ListEmptyComponent={
          <EmptyState
            title="No deliveries found"
            message={
              loads.length === 0
                ? 'Deliveries will appear here once loads are logged against active POs.'
                : 'Try adjusting your filters.'
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
    marginBottom: 10,
  },
  exportButton: {
    alignSelf: 'flex-end',
    marginBottom: 12,
  },
  kpiRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  kpiItem: {
    flex: 1,
  },
  loadCard: {
    marginBottom: 10,
  },
  editCard: {
    marginBottom: 10,
  },
  cardInner: {
    padding: 14,
  },
  loadHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  loadNumber: {
    fontSize: 15,
    fontWeight: '600',
    color: '#3a2a1a',
  },
  loadDate: {
    fontSize: 12,
    color: '#7a6a5a',
    marginTop: 2,
  },
  netWeightText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#3a2a1a',
  },
  tonsText: {
    fontSize: 12,
    color: '#7a6a5a',
  },
  detailsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  detailItem: {
    width: '30%',
    minWidth: 80,
    marginBottom: 4,
  },
  detailLabel: {
    fontSize: 11,
    color: '#7a6a5a',
    marginBottom: 1,
  },
  detailValue: {
    fontSize: 13,
    fontWeight: '500',
    color: '#3a2a1a',
  },
  editBtnRow: {
    alignItems: 'flex-end',
    marginTop: 8,
  },
  editHeaderRow: {
    marginBottom: 12,
  },
  editFieldSpacing: {
    marginBottom: 10,
  },
  weightRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
  },
  weightInput: {
    flex: 1,
  },
  editPreviewRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#f5f0e6',
    borderRadius: 8,
    padding: 10,
    marginBottom: 10,
  },
  editPreviewText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#3a2a1a',
  },
  editActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 8,
  },
});
