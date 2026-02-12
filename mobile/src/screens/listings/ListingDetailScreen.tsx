import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  Image,
  TouchableOpacity,
  RefreshControl,
  Linking,
  Dimensions,
  Alert,
} from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuth } from '../../hooks/useAuth';
import api from '../../config/api';
import type { Listing } from '../../types/models';
import { formatCurrency, formatDate, mapsUrl } from '../../utils/formatters';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import LoadingScreen from '../../components/ui/LoadingScreen';
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

const SCREEN_WIDTH = Dimensions.get('window').width;
const PHOTO_SIZE = SCREEN_WIDTH - 32; // full-width minus padding

// -- Detail Row helper --

function DetailRow({ label, value }: { label: string; value: string | number | null | undefined }) {
  if (value == null || value === '') return null;
  return (
    <View style={{
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingVertical: 10,
      borderBottomWidth: 1,
      borderBottomColor: '#f0ece4',
    }}>
      <Text style={{ fontSize: 14, color: COLORS.muted }}>{label}</Text>
      <Text style={{ fontSize: 14, fontWeight: '500', color: COLORS.foreground }}>{String(value)}</Text>
    </View>
  );
}

// -- Main Screen --

export default function ListingDetailScreen() {
  const route = useRoute<RouteProp<ListingsStackParamList, 'ListingDetail'>>();
  const navigation = useNavigation<NativeStackNavigationProp<ListingsStackParamList>>();
  const { user } = useAuth();
  const { listingId } = route.params;

  const [listing, setListing] = useState<Listing | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [acceptLoading, setAcceptLoading] = useState(false);

  const fetchListing = useCallback(async () => {
    try {
      setError('');
      const { data } = await api.get(`/listings/${listingId}`);
      setListing(data);
    } catch {
      setError('Failed to load listing details.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [listingId]);

  useEffect(() => {
    fetchListing();
  }, [fetchListing]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchListing();
  }, [fetchListing]);

  // -- Accept Offer handler --

  const handleAcceptOffer = async () => {
    if (!listing) return;
    Alert.alert(
      'Accept Offer',
      `Accept this listing at ${formatCurrency(listing.pricePerTon)}/ton from ${listing.organization.name}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Accept',
          style: 'default',
          onPress: async () => {
            setAcceptLoading(true);
            try {
              await api.post('/purchase-orders/accept-listing', {
                listingId: listing.id,
                typedName: user?.name,
              });
              Alert.alert('Success', 'Offer accepted. A purchase order has been created.', [
                { text: 'OK', onPress: () => navigation.goBack() },
              ]);
            } catch (err: unknown) {
              const axiosErr = err as { response?: { data?: { error?: { message?: string } } } };
              Alert.alert('Error', axiosErr.response?.data?.error?.message || 'Failed to accept offer.');
            } finally {
              setAcceptLoading(false);
            }
          },
        },
      ],
    );
  };

  // -- Counter Offer handler --

  const handleCounterOffer = () => {
    if (!listing) return;
    // Navigate to negotiations or open a dialog - for now use Alert prompt
    Alert.prompt?.(
      'Counter Offer',
      `Enter your offer price per ton (listed at $${listing.pricePerTon}/ton):`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Submit',
          onPress: async (priceStr) => {
            const price = parseFloat(priceStr || '');
            if (isNaN(price) || price <= 0) {
              Alert.alert('Invalid', 'Please enter a valid price.');
              return;
            }
            try {
              await api.post('/negotiations', {
                listingId: listing.id,
                offeredPricePerTon: price,
                offeredTons: listing.estimatedTons,
              });
              Alert.alert('Success', 'Counter offer submitted.');
            } catch (err: unknown) {
              const axiosErr = err as { response?: { data?: { error?: { message?: string } } } };
              Alert.alert('Error', axiosErr.response?.data?.error?.message || 'Failed to submit offer.');
            }
          },
        },
      ],
      'plain-text',
      String(listing.pricePerTon),
      'numeric',
    );
  };

  // -- Open farm location in maps --

  const openInMaps = () => {
    if (!listing?.farmLocation.latitude || !listing?.farmLocation.longitude) return;
    const url = mapsUrl(listing.farmLocation.latitude, listing.farmLocation.longitude);
    if (url) {
      Linking.openURL(url);
    }
  };

  // -- Loading / Error --

  if (loading && !refreshing) {
    return <LoadingScreen message="Loading listing..." />;
  }

  if (!listing && !loading) {
    return (
      <View style={{ flex: 1, backgroundColor: COLORS.bg, justifyContent: 'center', alignItems: 'center', padding: 16 }}>
        <ErrorBanner message={error || 'Listing not found.'} />
        <Button onPress={() => navigation.goBack()} style={{ marginTop: 16 }}>Go Back</Button>
      </View>
    );
  }

  if (!listing) return null;

  const isOwnListing = listing.organization.id === user?.organizationId;
  const isAvailable = listing.status === 'available';
  const canAccept = !isOwnListing && isAvailable && user?.role === 'FARM_ADMIN';
  const canCounter = !isOwnListing && isAvailable && !listing.firmPrice;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: COLORS.bg }}
      contentContainerStyle={{ paddingBottom: 40 }}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />
      }
    >
      {error ? (
        <View style={{ paddingHorizontal: 16, paddingTop: 8 }}>
          <ErrorBanner message={error} />
        </View>
      ) : null}

      {/* Photo Gallery */}
      {listing.photos && listing.photos.length > 0 && (
        <View style={{ marginBottom: 16 }}>
          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            style={{ height: PHOTO_SIZE * 0.65 }}
          >
            {listing.photos.map((photo, index) => (
              <Image
                key={photo.id}
                source={{ uri: photo.fileUrl }}
                style={{
                  width: SCREEN_WIDTH,
                  height: PHOTO_SIZE * 0.65,
                  resizeMode: 'cover',
                }}
              />
            ))}
          </ScrollView>
          {listing.photos.length > 1 && (
            <View style={{
              flexDirection: 'row',
              justifyContent: 'center',
              marginTop: 8,
              gap: 6,
            }}>
              {listing.photos.map((_, i) => (
                <View
                  key={i}
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: 3,
                    backgroundColor: i === 0 ? COLORS.primary : COLORS.border,
                  }}
                />
              ))}
            </View>
          )}
        </View>
      )}

      <View style={{ paddingHorizontal: 16 }}>
        {/* Title + badges */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <Text style={{ fontSize: 22, fontWeight: '700', color: COLORS.foreground, flex: 1 }}>
            {listing.productType || 'Hay Listing'}
          </Text>
          {listing.isDeliveredPrice ? (
            <Badge variant="success">Delivered</Badge>
          ) : (
            <Badge variant="secondary">Pickup</Badge>
          )}
        </View>

        {/* Organization + date */}
        <Text style={{ fontSize: 14, color: COLORS.muted, marginBottom: 4 }}>
          {listing.organization.name}
        </Text>
        <Text style={{ fontSize: 12, color: COLORS.muted, marginBottom: 16 }}>
          Listed {formatDate(listing.createdAt)}
        </Text>

        {/* Price card */}
        <Card style={{ marginBottom: 16 }} highlighted>
          <CardContent style={{ paddingTop: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <View>
              <Text style={{ fontSize: 28, fontWeight: '700', color: COLORS.primary }}>
                {formatCurrency(listing.pricePerTon)}
              </Text>
              <Text style={{ fontSize: 13, color: COLORS.muted }}>
                per ton{listing.isDeliveredPrice ? ' (delivered)' : ''}
              </Text>
            </View>
            {listing.firmPrice && (
              <Badge variant="warning">Firm Price</Badge>
            )}
          </CardContent>
        </Card>

        {/* Details */}
        <Card style={{ marginBottom: 16 }}>
          <CardHeader>
            <CardTitle style={{ fontSize: 16 }}>Details</CardTitle>
          </CardHeader>
          <CardContent>
            <DetailRow label="Product Type" value={listing.productType} />
            <DetailRow label="Bale Type" value={listing.baleType} />
            <DetailRow
              label="Price / Ton"
              value={`${formatCurrency(listing.pricePerTon)}${listing.isDeliveredPrice ? ' (delivered)' : ''}`}
            />
            <DetailRow label="Estimated Tons" value={listing.estimatedTons} />
            <DetailRow label="Bale Count" value={listing.baleCount} />
            <DetailRow
              label="Moisture"
              value={listing.moisturePercent != null ? `${listing.moisturePercent}%` : null}
            />
            <DetailRow label="Trucking Coordinated By" value={listing.truckingCoordinatedBy} />
            <DetailRow label="Status" value={listing.status} />
            {listing.notes ? (
              <View style={{ paddingVertical: 10 }}>
                <Text style={{ fontSize: 14, color: COLORS.muted, marginBottom: 4 }}>Notes</Text>
                <Text style={{ fontSize: 14, color: COLORS.foreground, lineHeight: 20 }}>
                  {listing.notes}
                </Text>
              </View>
            ) : null}
          </CardContent>
        </Card>

        {/* Documents */}
        {listing.documents && listing.documents.length > 0 && (
          <Card style={{ marginBottom: 16 }}>
            <CardHeader>
              <CardTitle style={{ fontSize: 16 }}>Documents</CardTitle>
              <CardDescription>{listing.documents.length} document{listing.documents.length !== 1 ? 's' : ''}</CardDescription>
            </CardHeader>
            <CardContent>
              {listing.documents.map((doc) => (
                <TouchableOpacity
                  key={doc.id}
                  onPress={() => Linking.openURL(doc.fileUrl)}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    paddingVertical: 10,
                    borderBottomWidth: 1,
                    borderBottomColor: '#f0ece4',
                    gap: 8,
                  }}
                >
                  <Text style={{ fontSize: 18, color: COLORS.primary }}>
                    {'\u{1F4C4}'}
                  </Text>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 14, color: COLORS.primary, fontWeight: '500' }}>
                      {doc.documentType || 'Document'}
                    </Text>
                  </View>
                  <Text style={{ fontSize: 13, color: COLORS.muted }}>Open</Text>
                </TouchableOpacity>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Farm Location */}
        <Card style={{ marginBottom: 16 }}>
          <CardHeader>
            <CardTitle style={{ fontSize: 16 }}>Farm Location</CardTitle>
          </CardHeader>
          <CardContent>
            <Text style={{ fontSize: 15, fontWeight: '600', color: COLORS.foreground, marginBottom: 4 }}>
              {listing.farmLocation.name}
            </Text>
            {listing.farmLocation.address && (
              <Text style={{ fontSize: 14, color: COLORS.muted, marginBottom: 2 }}>
                {listing.farmLocation.address}
              </Text>
            )}
            {listing.farmLocation.state && (
              <Text style={{ fontSize: 14, color: COLORS.muted, marginBottom: 2 }}>
                {listing.farmLocation.state}
              </Text>
            )}
            {listing.farmLocation.latitude != null && listing.farmLocation.longitude != null && (
              <View style={{ marginTop: 8 }}>
                <Text style={{ fontSize: 12, color: COLORS.muted, marginBottom: 8 }}>
                  {listing.farmLocation.latitude.toFixed(4)}, {listing.farmLocation.longitude.toFixed(4)}
                </Text>
                <Button
                  size="sm"
                  variant="outline"
                  onPress={openInMaps}
                >
                  Open in Maps
                </Button>
              </View>
            )}
            {listing.distanceMiles != null && (
              <Text style={{ fontSize: 13, color: COLORS.primary, fontWeight: '500', marginTop: 8 }}>
                {listing.distanceMiles} miles away
              </Text>
            )}
          </CardContent>
        </Card>

        {/* Action Buttons */}
        {(canAccept || canCounter) && (
          <View style={{ gap: 10, marginBottom: 16 }}>
            {canAccept && (
              <Button
                onPress={handleAcceptOffer}
                loading={acceptLoading}
                size="lg"
              >
                Accept Offer
              </Button>
            )}
            {canCounter && (
              <Button
                variant="outline"
                onPress={handleCounterOffer}
                size="lg"
              >
                Counter Offer
              </Button>
            )}
          </View>
        )}

        {/* Own listing indicator */}
        {isOwnListing && (
          <Card style={{ marginBottom: 16 }}>
            <CardContent style={{ paddingTop: 16, alignItems: 'center' }}>
              <Text style={{ fontSize: 14, color: COLORS.muted }}>
                This is your organization's listing.
              </Text>
            </CardContent>
          </Card>
        )}
      </View>
    </ScrollView>
  );
}
