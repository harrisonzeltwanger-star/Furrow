import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import api from '@/services/api';

interface AvgPrice {
  productType: string;
  avgPricePerTon: number;
  totalTons: number;
  poCount: number;
}

interface DashboardStats {
  activePOs: number;
  openNegotiations: number;
  todaysLoads: number;
  periodTons: number;
  periodLoadsCount: number;
  avgPriceByProduct: AvgPrice[];
  centers: string[];
}

// Preset date range helpers
function getMonthRange(monthsBack: number): { start: string; end: string; label: string } {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() - monthsBack, 1);
  const end = monthsBack === 0
    ? now
    : new Date(now.getFullYear(), now.getMonth() - monthsBack + 1, 0);
  return {
    start: start.toISOString().split('T')[0],
    end: end.toISOString().split('T')[0],
    label: start.toLocaleString('default', { month: 'short', year: 'numeric' }),
  };
}

export default function DashboardPage() {
  const { user } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [centerFilter, setCenterFilter] = useState('all');

  // Date range
  const currentMonth = getMonthRange(0);
  const [startDate, setStartDate] = useState(currentMonth.start);
  const [endDate, setEndDate] = useState(currentMonth.end);
  const [rangeLabel, setRangeLabel] = useState('This Month');

  const fetchStats = async (start?: string, end?: string, center?: string) => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (start) params.startDate = start;
      if (end) params.endDate = end;
      const c = center ?? centerFilter;
      if (c && c !== 'all') params.center = c;
      const { data } = await api.get('/purchase-orders/dashboard-stats', { params });
      setStats(data);
    } catch {
      console.error('Failed to fetch dashboard stats');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats(startDate, endDate);
  }, []);

  const applyPreset = (monthsBack: number, label: string) => {
    const range = getMonthRange(monthsBack);
    setStartDate(range.start);
    setEndDate(monthsBack === 0 ? new Date().toISOString().split('T')[0] : range.end);
    setRangeLabel(label);
    fetchStats(range.start, monthsBack === 0 ? undefined : range.end);
  };

  const applyCustomRange = () => {
    setRangeLabel(`${startDate} to ${endDate}`);
    fetchStats(startDate, endDate, centerFilter);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="flex items-end justify-between mb-6">
        <h2 className="text-2xl font-semibold">Dashboard</h2>
        {stats?.centers && stats.centers.length > 0 && (
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Center</label>
            <select
              value={centerFilter}
              onChange={(e) => {
                setCenterFilter(e.target.value);
                fetchStats(startDate, endDate, e.target.value);
              }}
              className="block w-48 rounded-md border border-border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="all">All Centers</option>
              {stats.centers.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardHeader>
            <CardDescription>Active POs</CardDescription>
            <CardTitle className="text-3xl">{loading ? '...' : stats?.activePOs ?? 0}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Today's Loads</CardDescription>
            <CardTitle className="text-3xl">{loading ? '...' : stats?.todaysLoads ?? 0}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Tons ({rangeLabel})</CardDescription>
            <CardTitle className="text-3xl">{loading ? '...' : stats?.periodTons ?? 0}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Open Negotiations</CardDescription>
            <CardTitle className="text-3xl">{loading ? '...' : stats?.openNegotiations ?? 0}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Date Range Filters */}
      <Card className="mb-6">
        <CardContent className="py-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex gap-1">
              <Button size="sm" variant={rangeLabel === 'This Month' ? 'default' : 'outline'} onClick={() => applyPreset(0, 'This Month')}>
                This Month
              </Button>
              <Button size="sm" variant={rangeLabel === 'Last Month' ? 'default' : 'outline'} onClick={() => applyPreset(1, 'Last Month')}>
                Last Month
              </Button>
              <Button size="sm" variant={rangeLabel === '3 Months' ? 'default' : 'outline'} onClick={() => {
                const start = getMonthRange(2).start;
                setStartDate(start);
                setEndDate(new Date().toISOString().split('T')[0]);
                setRangeLabel('3 Months');
                fetchStats(start);
              }}>
                3 Months
              </Button>
              <Button size="sm" variant={rangeLabel === '6 Months' ? 'default' : 'outline'} onClick={() => {
                const start = getMonthRange(5).start;
                setStartDate(start);
                setEndDate(new Date().toISOString().split('T')[0]);
                setRangeLabel('6 Months');
                fetchStats(start);
              }}>
                6 Months
              </Button>
              <Button size="sm" variant={rangeLabel === 'YTD' ? 'default' : 'outline'} onClick={() => {
                const start = `${new Date().getFullYear()}-01-01`;
                setStartDate(start);
                setEndDate(new Date().toISOString().split('T')[0]);
                setRangeLabel('YTD');
                fetchStats(start);
              }}>
                YTD
              </Button>
            </div>
            <div className="flex items-end gap-2 ml-auto">
              <div className="space-y-1">
                <Label className="text-xs">From</Label>
                <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="h-8 w-36" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">To</Label>
                <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="h-8 w-36" />
              </div>
              <Button size="sm" onClick={applyCustomRange}>Apply</Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Average Price by Product */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-base">Average Price by Product</CardTitle>
          <CardDescription>Weighted average across active contracts ({rangeLabel})</CardDescription>
        </CardHeader>
        <CardContent className="pt-0">
          {loading ? (
            <div className="space-y-3 py-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex justify-between items-center">
                  <div className="h-4 w-24 bg-gray-200 rounded animate-pulse" />
                  <div className="h-4 w-16 bg-gray-200 rounded animate-pulse" />
                </div>
              ))}
            </div>
          ) : !stats?.avgPriceByProduct || stats.avgPriceByProduct.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">No contract data for this period.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/50">
                    <th className="text-left px-4 py-2 font-medium text-muted-foreground">Product Type</th>
                    <th className="text-right px-4 py-2 font-medium text-muted-foreground">Avg $/Ton</th>
                    <th className="text-right px-4 py-2 font-medium text-muted-foreground">Total Tons</th>
                    <th className="text-right px-4 py-2 font-medium text-muted-foreground">Contracts</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.avgPriceByProduct.map((row) => (
                    <tr key={row.productType} className="border-b border-border last:border-0">
                      <td className="px-4 py-2 font-medium">{row.productType}</td>
                      <td className="px-4 py-2 text-right font-semibold">${Math.round(row.avgPricePerTon)}</td>
                      <td className="px-4 py-2 text-right">{row.totalTons}</td>
                      <td className="px-4 py-2 text-right">{row.poCount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Welcome to Furrow</CardTitle>
          <CardDescription>
            Your hay procurement and logistics management system is ready.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm text-muted-foreground">
            <p>Signed in as <strong>{user?.email}</strong></p>
            <p>Role: <strong>{user?.role}</strong></p>
            <p>Organization: <strong>{user?.organizationName}</strong></p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
