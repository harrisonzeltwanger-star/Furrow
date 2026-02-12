import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuth } from '../../hooks/useAuth';
import { useDeviceType } from '../../hooks/useDeviceType';
import api from '../../config/api';
import type { Listing, FarmLocation } from '../../types/models';
import { formatCurrency } from '../../utils/formatters';
import { Card, CardContent } from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import Input from '../../components/ui/Input';
import SelectPicker from '../../components/ui/SelectPicker';
import FilterChip from '../../components/ui/FilterChip';
import LoadingScreen from '../../components/ui/LoadingScreen';
import EmptyState from '../../components/ui/EmptyState';
import ErrorBanner from '../../components/ui/ErrorBanner';
import type { ListingsStackParamList } from '../../navigation/PhoneTabNavigator';

// -- Constants --

const COLORS = {
  primary: '#2d5a27',
  foreground: '#3a2a1a',
  muted: '#7a6a5a',
  border: '#d8cebb',
  bg: '#faf8f4',
  card: '#fdfcf8',
};

const US_STATES = [
  'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA',
  'KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ',
  'NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT',
  'VA','WA','WV','WI','WY',
];

const HAY_PRODUCTS = [
  'Alfalfa Hay', 'Bermuda Hay', 'Brome Hay', 'Coastal Hay', 'Fescue Hay',
  'Grass Hay', 'Mixed Grass Hay', 'Oat Hay', 'Orchard Grass Hay', 'Prairie Hay',
  'Sudan Grass Hay', 'Timothy Hay', 'Teff Hay', 'Triticale Hay', 'Alfalfa/Grass Mix',
  'Wheat Straw', 'Barley Straw', 'Oat Straw', 'Rice Straw', 'Corn Stover',
];

type ViewMode = 'map' | 'list';

// -- Listing Card --

function ListingCard({
  listing,
  onPress,
}: {
  listing: Listing;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
      <Card style={{ marginBottom: 10 }}>
        <CardContent style={{ paddingTop: 14, paddingBottom: 14 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            {/* Left side */}
            <View style={{ flex: 1, marginRight: 12 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <Text style={{ fontSize: 15, fontWeight: '600', color: COLORS.foreground }} numberOfLines={1}>
                  {listing.productType || listing.organization.name}
                </Text>
                {listing.isDeliveredPrice ? (
                  <Badge variant="success">Delivered</Badge>
                ) : (
                  <Badge variant="secondary">Pickup</Badge>
                )}
              </View>
              {(listing.productType || listing.baleType) && (
                <Text style={{ fontSize: 13, color: COLORS.muted, marginBottom: 2 }}>
                  {listing.productType}
                  {listing.productType && listing.baleType ? ' - ' : ''}
                  {listing.baleType}
                </Text>
              )}
              <Text style={{ fontSize: 13, color: COLORS.muted }} numberOfLines={1}>
                {listing.farmLocation.name} {'\u00B7'} {listing.organization.name}
                {listing.distanceMiles != null && (
                  <Text style={{ color: COLORS.primary, fontWeight: '500' }}>
                    {' \u00B7 '}{listing.distanceMiles} mi
                  </Text>
                )}
              </Text>
            </View>

            {/* Right side: price */}
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={{ fontSize: 18, fontWeight: '700', color: COLORS.foreground }}>
                {formatCurrency(listing.pricePerTon)}
              </Text>
              <Text style={{ fontSize: 11, color: COLORS.muted }}>
                per ton{listing.isDeliveredPrice ? ' (delivered)' : ''}
              </Text>
              {listing.firmPrice && (
                <Badge variant="secondary" style={{ marginTop: 4 }}>Firm Price</Badge>
              )}
            </View>
          </View>

          {/* Extra details row */}
          <View style={{ flexDirection: 'row', marginTop: 8, gap: 16 }}>
            {listing.estimatedTons != null && (
              <Text style={{ fontSize: 12, color: COLORS.muted }}>
                <Text style={{ fontWeight: '500' }}>{listing.estimatedTons}</Text> tons
              </Text>
            )}
            {listing.baleCount != null && (
              <Text style={{ fontSize: 12, color: COLORS.muted }}>
                <Text style={{ fontWeight: '500' }}>{listing.baleCount}</Text> bales
              </Text>
            )}
            {listing.moisturePercent != null && (
              <Text style={{ fontSize: 12, color: COLORS.muted }}>
                <Text style={{ fontWeight: '500' }}>{listing.moisturePercent}%</Text> moisture
              </Text>
            )}
          </View>
        </CardContent>
      </Card>
    </TouchableOpacity>
  );
}

// -- Main Screen --

export default function ListingsScreen() {
  const { user } = useAuth();
  const { isTablet, width } = useDeviceType();
  const navigation = useNavigation<NativeStackNavigationProp<ListingsStackParamList>>();

  // Data
  const [listings, setListings] = useState<Listing[]>([]);
  const [farmLocations, setFarmLocations] = useState<FarmLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  // View mode (phone only -- tablet shows both side-by-side)
  const [viewMode, setViewMode] = useState<ViewMode>('list');

  // Filters
  const [showFilters, setShowFilters] = useState(false);
  const [searchAddress, setSearchAddress] = useState('');
  const [stateFilter, setStateFilter] = useState('');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [productTypeFilter, setProductTypeFilter] = useState('');
  const [showProductSuggestions, setShowProductSuggestions] = useState(false);

  // -- Fetch --

  const fetchData = useCallback(async (params?: Record<string, string>) => {
    try {
      setError('');
      const queryParams: Record<string, string> = params ?? {};
      if (!params) {
        if (stateFilter) queryParams.state = stateFilter;
        if (minPrice) queryParams.minPrice = minPrice;
        if (maxPrice) queryParams.maxPrice = maxPrice;
        if (productTypeFilter) queryParams.productType = productTypeFilter;
      }

      const [listingsRes, locationsRes] = await Promise.all([
        api.get('/listings', { params: queryParams }),
        api.get('/farm-locations'),
      ]);
      setListings(listingsRes.data.listings);
      setFarmLocations(locationsRes.data.farmLocations);
    } catch {
      setError('Failed to load listings. Pull to retry.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [stateFilter, minPrice, maxPrice, productTypeFilter]);

  useEffect(() => {
    fetchData();
  }, []);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchData();
  }, [fetchData]);

  const handleSearch = () => {
    setLoading(true);
    fetchData();
  };

  const handleClearFilters = () => {
    setStateFilter('');
    setMinPrice('');
    setMaxPrice('');
    setProductTypeFilter('');
    setSearchAddress('');
    setLoading(true);
    fetchData({});
  };

  // Markers for the map
  const markers = listings.filter(
    (l) => l.farmLocation.latitude != null && l.farmLocation.longitude != null,
  );

  // Default map region (continental US center)
  const defaultRegion = {
    latitude: markers.length > 0 ? markers[0].farmLocation.latitude! : 35.5,
    longitude: markers.length > 0 ? markers[0].farmLocation.longitude! : -98.0,
    latitudeDelta: markers.length > 0 ? 10 : 30,
    longitudeDelta: markers.length > 0 ? 10 : 30,
  };

  // Product type suggestions based on typed input
  const filteredProducts = productTypeFilter
    ? HAY_PRODUCTS.filter((p) => p.toLowerCase().includes(productTypeFilter.toLowerCase()))
    : HAY_PRODUCTS;

  // -- Loading state --

  if (loading && !refreshing) {
    return <LoadingScreen message="Loading listings..." />;
  }

  // -- Render filter panel --

  const renderFilters = () => (
    <Card style={{ marginHorizontal: 16, marginBottom: 12 }}>
      <CardContent style={{ paddingTop: 14 }}>
        {/* Address search */}
        <Input
          label="Search near address"
          value={searchAddress}
          onChangeText={setSearchAddress}
          placeholder="Type address..."
          containerStyle={{ marginBottom: 10 }}
        />

        {/* State picker */}
        <SelectPicker
          label="State"
          value={stateFilter}
          placeholder="Any state"
          options={[
            { label: 'Any state', value: '' },
            ...US_STATES.map((s) => ({ label: s, value: s })),
          ]}
          onValueChange={setStateFilter}
        />

        {/* Price range */}
        <Text style={{ fontSize: 13, fontWeight: '500', color: COLORS.foreground, marginTop: 10, marginBottom: 6 }}>
          Price range ($/ton)
        </Text>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <View style={{ flex: 1 }}>
            <Input
              value={minPrice}
              onChangeText={setMinPrice}
              placeholder="Min"
              keyboardType="numeric"
            />
          </View>
          <View style={{ flex: 1 }}>
            <Input
              value={maxPrice}
              onChangeText={setMaxPrice}
              placeholder="Max"
              keyboardType="numeric"
            />
          </View>
        </View>

        {/* Product type with suggestions */}
        <View style={{ marginTop: 10 }}>
          <Input
            label="Crop / Product type"
            value={productTypeFilter}
            onChangeText={(text) => {
              setProductTypeFilter(text);
              setShowProductSuggestions(text.length > 0);
            }}
            onFocus={() => setShowProductSuggestions(productTypeFilter.length > 0)}
            placeholder="Alfalfa, Bermuda..."
          />
          {showProductSuggestions && filteredProducts.length > 0 && (
            <View style={{
              backgroundColor: '#ffffff',
              borderWidth: 1,
              borderColor: COLORS.border,
              borderRadius: 8,
              maxHeight: 150,
              marginTop: 4,
            }}>
              <ScrollView nestedScrollEnabled keyboardShouldPersistTaps="handled">
                {filteredProducts.map((p) => (
                  <TouchableOpacity
                    key={p}
                    onPress={() => {
                      setProductTypeFilter(p);
                      setShowProductSuggestions(false);
                    }}
                    style={{
                      paddingHorizontal: 12,
                      paddingVertical: 10,
                      borderBottomWidth: 1,
                      borderBottomColor: '#f0ece4',
                    }}
                  >
                    <Text style={{ fontSize: 14, color: COLORS.foreground }}>{p}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}
        </View>

        {/* Search / Clear buttons */}
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 14 }}>
          <Button size="sm" onPress={handleSearch} style={{ flex: 1 }}>
            Search
          </Button>
          <Button size="sm" variant="outline" onPress={handleClearFilters} style={{ flex: 1 }}>
            Clear
          </Button>
        </View>
      </CardContent>
    </Card>
  );

  // -- Render map --

  const renderMap = (height: number) => (
    <View style={{ height, marginHorizontal: isTablet ? 0 : 16, marginBottom: 12, borderRadius: 12, overflow: 'hidden', borderWidth: 1, borderColor: COLORS.border }}>
      <MapView
        style={{ flex: 1 }}
        initialRegion={defaultRegion}
        showsUserLocation
        showsMyLocationButton
      >
        {markers.map((listing) => (
          <Marker
            key={listing.id}
            coordinate={{
              latitude: listing.farmLocation.latitude!,
              longitude: listing.farmLocation.longitude!,
            }}
            title={listing.productType || listing.organization.name}
            description={`$${listing.pricePerTon}/ton - ${listing.farmLocation.name}`}
            onCalloutPress={() => navigation.navigate('ListingDetail', { listingId: listing.id })}
            pinColor={COLORS.primary}
          />
        ))}
      </MapView>
    </View>
  );

  // -- Render segmented control (phone only) --

  const renderSegmentedControl = () => (
    <View style={{
      flexDirection: 'row',
      marginHorizontal: 16,
      marginBottom: 12,
      backgroundColor: '#e8dcc8',
      borderRadius: 8,
      padding: 3,
    }}>
      <TouchableOpacity
        onPress={() => setViewMode('map')}
        style={{
          flex: 1,
          paddingVertical: 8,
          borderRadius: 6,
          backgroundColor: viewMode === 'map' ? '#ffffff' : 'transparent',
          alignItems: 'center',
        }}
      >
        <Text style={{
          fontSize: 13,
          fontWeight: '600',
          color: viewMode === 'map' ? COLORS.foreground : COLORS.muted,
        }}>
          Map
        </Text>
      </TouchableOpacity>
      <TouchableOpacity
        onPress={() => setViewMode('list')}
        style={{
          flex: 1,
          paddingVertical: 8,
          borderRadius: 6,
          backgroundColor: viewMode === 'list' ? '#ffffff' : 'transparent',
          alignItems: 'center',
        }}
      >
        <Text style={{
          fontSize: 13,
          fontWeight: '600',
          color: viewMode === 'list' ? COLORS.foreground : COLORS.muted,
        }}>
          List
        </Text>
      </TouchableOpacity>
    </View>
  );

  // -- Render listing list --

  const renderList = () => (
    <FlatList
      data={listings}
      keyExtractor={(item) => item.id}
      contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />
      }
      ListEmptyComponent={
        <EmptyState
          title="No listings found"
          message={user?.role !== 'VIEWER' ? 'Create a listing to get started.' : 'No hay listings match your filters.'}
          actionLabel={user?.role !== 'VIEWER' ? 'New Listing' : undefined}
          onAction={user?.role !== 'VIEWER' ? () => navigation.navigate('CreateListing') : undefined}
        />
      }
      renderItem={({ item }) => (
        <ListingCard
          listing={item}
          onPress={() => navigation.navigate('ListingDetail', { listingId: item.id })}
        />
      )}
    />
  );

  // -- Tablet: side-by-side layout --

  if (isTablet) {
    return (
      <View style={{ flex: 1, backgroundColor: COLORS.bg }}>
        {/* Header */}
        <View style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          paddingHorizontal: 16,
          paddingTop: 8,
          paddingBottom: 8,
        }}>
          <Text style={{ fontSize: 22, fontWeight: '700', color: COLORS.foreground }}>Listings</Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Button size="sm" variant="outline" onPress={() => setShowFilters(!showFilters)}>
              {showFilters ? 'Hide Filters' : 'Filters'}
            </Button>
            {user?.role !== 'VIEWER' && (
              <Button size="sm" onPress={() => navigation.navigate('CreateListing')}>
                New Listing
              </Button>
            )}
          </View>
        </View>

        {error ? <ErrorBanner message={error} /> : null}
        {showFilters && renderFilters()}

        {/* Side-by-side: map + list */}
        <View style={{ flex: 1, flexDirection: 'row', paddingHorizontal: 16, gap: 12 }}>
          <View style={{ flex: 1 }}>
            {renderMap(width * 0.35)}
          </View>
          <View style={{ flex: 1 }}>
            {renderList()}
          </View>
        </View>
      </View>
    );
  }

  // -- Phone layout --

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.bg }}>
      {/* Header */}
      <View style={{
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingTop: 8,
        paddingBottom: 8,
      }}>
        <Text style={{ fontSize: 22, fontWeight: '700', color: COLORS.foreground }}>Listings</Text>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Button size="sm" variant="outline" onPress={() => setShowFilters(!showFilters)}>
            {showFilters ? 'Hide' : 'Filters'}
          </Button>
          {user?.role !== 'VIEWER' && (
            <Button size="sm" onPress={() => navigation.navigate('CreateListing')}>
              New Listing
            </Button>
          )}
        </View>
      </View>

      {error ? (
        <View style={{ paddingHorizontal: 16 }}>
          <ErrorBanner message={error} />
        </View>
      ) : null}

      {showFilters && renderFilters()}

      {/* Segmented control */}
      {renderSegmentedControl()}

      {/* Content based on view mode */}
      {viewMode === 'map' ? (
        <ScrollView
          style={{ flex: 1 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />
          }
        >
          {renderMap(350)}
          {/* Summary below map */}
          <Text style={{ fontSize: 13, color: COLORS.muted, textAlign: 'center', marginBottom: 8 }}>
            {markers.length} listing{markers.length !== 1 ? 's' : ''} on map {'\u00B7'} {listings.length} total
          </Text>
        </ScrollView>
      ) : (
        renderList()
      )}
    </View>
  );
}
