import { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, RefreshControl } from 'react-native';
import { useAuth } from '../../hooks/useAuth';
import { useDeviceType } from '../../hooks/useDeviceType';
import api from '../../config/api';
import type { DashboardStats } from '../../types/models';
import { getMonthRange, formatDate } from '../../utils/formatters';
import KPICard from '../../components/ui/KPICard';
import Button from '../../components/ui/Button';
import SelectPicker from '../../components/ui/SelectPicker';
import LoadingScreen from '../../components/ui/LoadingScreen';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/Card';
import DateTimePicker from '@react-native-community/datetimepicker';

const DATE_PRESETS = [
  { label: 'This Month', months: 0 },
  { label: 'Last Month', months: 1 },
  { label: '3 Months', months: 3 },
  { label: '6 Months', months: 6 },
  { label: 'YTD', months: -1 }, // special
];

export default function DashboardScreen() {
  const { user } = useAuth();
  const { isTablet } = useDeviceType();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [centerFilter, setCenterFilter] = useState('all');
  const [rangeLabel, setRangeLabel] = useState('This Month');

  const currentMonth = getMonthRange(0);
  const [startDate, setStartDate] = useState(currentMonth.start);
  const [endDate, setEndDate] = useState(currentMonth.end);
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);

  const fetchStats = useCallback(async (start?: string, end?: string, center?: string) => {
    try {
      const params: Record<string, string> = {};
      if (start) params.startDate = start;
      if (end) params.endDate = end;
      const c = center ?? centerFilter;
      if (c && c !== 'all') params.center = c;
      const { data } = await api.get('/purchase-orders/dashboard-stats', { params });
      setStats(data);
    } catch {
      // silent fail
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [centerFilter]);

  useEffect(() => {
    fetchStats(startDate, endDate);
  }, []);

  const applyPreset = (months: number, label: string) => {
    setRangeLabel(label);
    if (months === -1) {
      // YTD
      const start = `${new Date().getFullYear()}-01-01`;
      setStartDate(start);
      setEndDate(new Date().toISOString().split('T')[0]);
      fetchStats(start);
    } else if (months === 3 || months === 6) {
      const start = getMonthRange(months - 1).start;
      setStartDate(start);
      setEndDate(new Date().toISOString().split('T')[0]);
      fetchStats(start);
    } else {
      const range = getMonthRange(months);
      setStartDate(range.start);
      setEndDate(months === 0 ? new Date().toISOString().split('T')[0] : range.end);
      fetchStats(range.start, months === 0 ? undefined : range.end);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchStats(startDate, endDate);
  };

  if (loading) return <LoadingScreen />;

  const kpiCols = isTablet ? 4 : 2;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: '#faf8f4' }}
      contentContainerStyle={{ padding: 16 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#2d5a27" />}
    >
      {/* Header */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 16 }}>
        <Text style={{ fontSize: 24, fontWeight: '700', color: '#3a2a1a' }}>Dashboard</Text>
        {stats?.centers && stats.centers.length > 0 && (
          <SelectPicker
            value={centerFilter}
            options={[
              { label: 'All Centers', value: 'all' },
              ...stats.centers.map((c) => ({ label: c, value: c })),
            ]}
            onValueChange={(v) => {
              setCenterFilter(v);
              fetchStats(startDate, endDate, v);
            }}
          />
        )}
      </View>

      {/* KPI Cards */}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
        <View style={{ width: `${100 / kpiCols - 2}%` as unknown as number, flexBasis: isTablet ? '23%' : '48%', flexGrow: 1 }}>
          <KPICard label="Active POs" value={stats?.activePOs ?? 0} />
        </View>
        <View style={{ flexBasis: isTablet ? '23%' : '48%', flexGrow: 1 }}>
          <KPICard label="Today's Loads" value={stats?.todaysLoads ?? 0} />
        </View>
        <View style={{ flexBasis: isTablet ? '23%' : '48%', flexGrow: 1 }}>
          <KPICard label={`Tons (${rangeLabel})`} value={stats?.periodTons ?? 0} />
        </View>
        <View style={{ flexBasis: isTablet ? '23%' : '48%', flexGrow: 1 }}>
          <KPICard label="Open Negotiations" value={stats?.openNegotiations ?? 0} />
        </View>
      </View>

      {/* Date Range */}
      <Card style={{ marginBottom: 16 }}>
        <CardContent style={{ paddingTop: 16 }}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
            {DATE_PRESETS.map((p) => (
              <Button
                key={p.label}
                size="sm"
                variant={rangeLabel === p.label ? 'default' : 'outline'}
                onPress={() => applyPreset(p.months, p.label)}
                style={{ marginRight: 8 }}
              >
                {p.label}
              </Button>
            ))}
          </ScrollView>

          <View style={{ flexDirection: 'row', gap: 8 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 11, color: '#7a6a5a', marginBottom: 4 }}>From</Text>
              <Button variant="outline" size="sm" onPress={() => setShowStartPicker(true)}>
                {startDate}
              </Button>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 11, color: '#7a6a5a', marginBottom: 4 }}>To</Text>
              <Button variant="outline" size="sm" onPress={() => setShowEndPicker(true)}>
                {endDate}
              </Button>
            </View>
            <View style={{ justifyContent: 'flex-end' }}>
              <Button size="sm" onPress={() => { setRangeLabel(`${startDate} to ${endDate}`); fetchStats(startDate, endDate); }}>
                Apply
              </Button>
            </View>
          </View>
        </CardContent>
      </Card>

      {showStartPicker && (
        <DateTimePicker
          value={new Date(startDate)}
          mode="date"
          onChange={(_, date) => {
            setShowStartPicker(false);
            if (date) setStartDate(date.toISOString().split('T')[0]);
          }}
        />
      )}
      {showEndPicker && (
        <DateTimePicker
          value={new Date(endDate)}
          mode="date"
          onChange={(_, date) => {
            setShowEndPicker(false);
            if (date) setEndDate(date.toISOString().split('T')[0]);
          }}
        />
      )}

      {/* Average Price by Product */}
      <Card style={{ marginBottom: 16 }}>
        <CardHeader>
          <CardTitle style={{ fontSize: 15 }}>Average Price by Product</CardTitle>
          <CardDescription>Weighted average across active contracts ({rangeLabel})</CardDescription>
        </CardHeader>
        <CardContent>
          {!stats?.avgPriceByProduct || stats.avgPriceByProduct.length === 0 ? (
            <Text style={{ fontSize: 14, color: '#7a6a5a' }}>No contract data for this period.</Text>
          ) : (
            <>
              <View style={{ flexDirection: 'row', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#d8cebb' }}>
                <Text style={{ flex: 2, fontSize: 12, fontWeight: '500', color: '#7a6a5a' }}>Product</Text>
                <Text style={{ flex: 1, fontSize: 12, fontWeight: '500', color: '#7a6a5a', textAlign: 'right' }}>Avg $/Ton</Text>
                <Text style={{ flex: 1, fontSize: 12, fontWeight: '500', color: '#7a6a5a', textAlign: 'right' }}>Tons</Text>
                <Text style={{ flex: 1, fontSize: 12, fontWeight: '500', color: '#7a6a5a', textAlign: 'right' }}>POs</Text>
              </View>
              {stats.avgPriceByProduct.map((row) => (
                <View key={row.productType} style={{ flexDirection: 'row', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#f0ece4' }}>
                  <Text style={{ flex: 2, fontSize: 14, fontWeight: '500', color: '#3a2a1a' }}>{row.productType}</Text>
                  <Text style={{ flex: 1, fontSize: 14, fontWeight: '600', color: '#3a2a1a', textAlign: 'right' }}>${Math.round(row.avgPricePerTon)}</Text>
                  <Text style={{ flex: 1, fontSize: 14, color: '#3a2a1a', textAlign: 'right' }}>{row.totalTons}</Text>
                  <Text style={{ flex: 1, fontSize: 14, color: '#3a2a1a', textAlign: 'right' }}>{row.poCount}</Text>
                </View>
              ))}
            </>
          )}
        </CardContent>
      </Card>

      {/* Welcome card */}
      <Card>
        <CardHeader>
          <CardTitle>Welcome to Furrow</CardTitle>
          <CardDescription>Your hay procurement and logistics management system.</CardDescription>
        </CardHeader>
        <CardContent>
          <Text style={{ fontSize: 14, color: '#7a6a5a' }}>Signed in as <Text style={{ fontWeight: '600', color: '#3a2a1a' }}>{user?.email}</Text></Text>
          <Text style={{ fontSize: 14, color: '#7a6a5a', marginTop: 4 }}>Role: <Text style={{ fontWeight: '600', color: '#3a2a1a' }}>{user?.role}</Text></Text>
          <Text style={{ fontSize: 14, color: '#7a6a5a', marginTop: 4 }}>Organization: <Text style={{ fontWeight: '600', color: '#3a2a1a' }}>{user?.organizationName}</Text></Text>
        </CardContent>
      </Card>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}
