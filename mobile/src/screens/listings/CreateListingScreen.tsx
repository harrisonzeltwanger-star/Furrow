import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Image,
  Switch,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Modal,
  Dimensions,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import * as Location from 'expo-location';
import MapView, { Marker, type MapPressEvent } from 'react-native-maps';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import api from '../../config/api';
import { useAuth } from '../../hooks/useAuth';
import type { FarmLocation } from '../../types/models';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import SelectPicker from '../../components/ui/SelectPicker';
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

const HAY_PRODUCTS = [
  'Alfalfa Hay', 'Bermuda Hay', 'Brome Hay', 'Coastal Hay', 'Fescue Hay',
  'Grass Hay', 'Mixed Grass Hay', 'Oat Hay', 'Orchard Grass Hay', 'Prairie Hay',
  'Sudan Grass Hay', 'Timothy Hay', 'Teff Hay', 'Triticale Hay', 'Alfalfa/Grass Mix',
  'Wheat Straw', 'Barley Straw', 'Oat Straw', 'Rice Straw', 'Corn Stover',
];

const BALE_TYPES = [
  'Large Square',
  'Small Square',
  'Round Bale',
];

interface PhotoAsset {
  uri: string;
  fileName?: string;
  type?: string;
}

interface DocumentAsset {
  uri: string;
  name: string;
  size?: number;
  mimeType?: string;
}

// -- Main Screen --

export default function CreateListingScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<ListingsStackParamList>>();
  const { user } = useAuth();

  // Drop a pin
  const [showPinMap, setShowPinMap] = useState(false);
  const [pinCoord, setPinCoord] = useState<{ latitude: number; longitude: number } | null>(null);
  const [savingPin, setSavingPin] = useState(false);

  // Farm locations
  const [farmLocations, setFarmLocations] = useState<FarmLocation[]>([]);
  const [loadingLocations, setLoadingLocations] = useState(true);

  // Form state
  const [farmLocationId, setFarmLocationId] = useState('');
  const [productType, setProductType] = useState('');
  const [baleType, setBaleType] = useState('');
  const [pricePerTon, setPricePerTon] = useState('');
  const [estimatedTons, setEstimatedTons] = useState('');
  const [baleCount, setBaleCount] = useState('');
  const [moisturePercent, setMoisturePercent] = useState('');
  const [notes, setNotes] = useState('');
  const [firmPrice, setFirmPrice] = useState(false);
  const [isDeliveredPrice, setIsDeliveredPrice] = useState(false);
  const [truckingCoordinatedBy, setTruckingCoordinatedBy] = useState('');

  // Product type suggestions
  const [showProductSuggestions, setShowProductSuggestions] = useState(false);
  const filteredProducts = productType
    ? HAY_PRODUCTS.filter((p) => p.toLowerCase().includes(productType.toLowerCase()))
    : HAY_PRODUCTS;

  // File attachments
  const [photos, setPhotos] = useState<PhotoAsset[]>([]);
  const [documents, setDocuments] = useState<DocumentAsset[]>([]);

  // Current location
  const [locatingUser, setLocatingUser] = useState(false);

  // Submission
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // -- Fetch farm locations --

  useEffect(() => {
    async function load() {
      try {
        const { data } = await api.get('/farm-locations');
        setFarmLocations(data.farmLocations);
      } catch {
        // Silent - will show empty picker
      } finally {
        setLoadingLocations(false);
      }
    }
    load();
  }, []);

  // -- Use current location --

  const useCurrentLocation = useCallback(async () => {
    setLocatingUser(true);
    setError('');
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission required', 'Location access is needed to use your current location.');
        return;
      }

      const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const { latitude, longitude } = position.coords;

      // Reverse geocode to get address
      const [geo] = await Location.reverseGeocodeAsync({ latitude, longitude });
      const address = geo
        ? [geo.streetNumber, geo.street, geo.city, geo.region, geo.postalCode].filter(Boolean).join(', ')
        : `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
      const name = geo?.city ? `${geo.city} Location` : 'Current Location';

      // Create farm location via API
      const { data } = await api.post('/farm-locations', { name, address, latitude, longitude });
      setFarmLocations((prev) => [...prev, data]);
      setFarmLocationId(data.id);
    } catch {
      setError('Failed to get current location.');
    } finally {
      setLocatingUser(false);
    }
  }, []);

  // -- Use home address --

  const useHomeAddress = useCallback(async () => {
    if (!user?.organizationAddress) {
      Alert.alert('No Home Address', 'Set your home address in Account settings first.');
      return;
    }
    setError('');
    try {
      const { data } = await api.post('/farm-locations', {
        name: 'Home Address',
        address: user.organizationAddress,
        latitude: user.organizationLatitude ?? undefined,
        longitude: user.organizationLongitude ?? undefined,
      });
      setFarmLocations((prev) => [...prev, data]);
      setFarmLocationId(data.id);
    } catch {
      setError('Failed to create location from home address.');
    }
  }, [user]);

  // -- Drop a pin --

  const handleMapPress = useCallback((e: MapPressEvent) => {
    setPinCoord(e.nativeEvent.coordinate);
  }, []);

  const handleSavePin = useCallback(async () => {
    if (!pinCoord) return;
    setSavingPin(true);
    setError('');
    try {
      const [geo] = await Location.reverseGeocodeAsync(pinCoord);
      const address = geo
        ? [geo.streetNumber, geo.street, geo.city, geo.region, geo.postalCode].filter(Boolean).join(', ')
        : `${pinCoord.latitude.toFixed(5)}, ${pinCoord.longitude.toFixed(5)}`;
      const name = geo?.city ? `${geo.city} Pin` : 'Dropped Pin';

      const { data } = await api.post('/farm-locations', {
        name,
        address,
        latitude: pinCoord.latitude,
        longitude: pinCoord.longitude,
      });
      setFarmLocations((prev) => [...prev, data]);
      setFarmLocationId(data.id);
      setShowPinMap(false);
      setPinCoord(null);
    } catch {
      setError('Failed to save pin location.');
    } finally {
      setSavingPin(false);
    }
  }, [pinCoord]);

  // -- Photo picker --

  const pickPhotos = useCallback(async (source: 'camera' | 'library') => {
    try {
      if (source === 'camera') {
        const perm = await ImagePicker.requestCameraPermissionsAsync();
        if (!perm.granted) {
          Alert.alert('Permission required', 'Camera access is needed to take photos.');
          return;
        }
        const result = await ImagePicker.launchCameraAsync({
          mediaTypes: ['images'],
          quality: 0.8,
        });
        if (!result.canceled && result.assets.length > 0) {
          const asset = result.assets[0];
          setPhotos((prev) => [...prev, {
            uri: asset.uri,
            fileName: asset.fileName ?? `photo_${Date.now()}.jpg`,
            type: asset.mimeType ?? 'image/jpeg',
          }]);
        }
      } else {
        const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!perm.granted) {
          Alert.alert('Permission required', 'Photo library access is needed to select photos.');
          return;
        }
        const result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ['images'],
          allowsMultipleSelection: true,
          quality: 0.8,
        });
        if (!result.canceled && result.assets.length > 0) {
          const newPhotos = result.assets.map((asset) => ({
            uri: asset.uri,
            fileName: asset.fileName ?? `photo_${Date.now()}.jpg`,
            type: asset.mimeType ?? 'image/jpeg',
          }));
          setPhotos((prev) => [...prev, ...newPhotos]);
        }
      }
    } catch {
      Alert.alert('Error', 'Failed to pick photo.');
    }
  }, []);

  const showPhotoOptions = () => {
    Alert.alert('Add Photo', 'Choose a source', [
      { text: 'Camera', onPress: () => pickPhotos('camera') },
      { text: 'Photo Library', onPress: () => pickPhotos('library') },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const removePhoto = (index: number) => {
    setPhotos((prev) => prev.filter((_, i) => i !== index));
  };

  // -- Document picker --

  const pickDocument = useCallback(async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'image/*'],
        multiple: true,
      });
      if (!result.canceled && result.assets.length > 0) {
        const newDocs = result.assets.map((asset) => ({
          uri: asset.uri,
          name: asset.name,
          size: asset.size,
          mimeType: asset.mimeType,
        }));
        setDocuments((prev) => [...prev, ...newDocs]);
      }
    } catch {
      Alert.alert('Error', 'Failed to pick document.');
    }
  }, []);

  const removeDocument = (index: number) => {
    setDocuments((prev) => prev.filter((_, i) => i !== index));
  };

  // -- Submit --

  const handleSubmit = async () => {
    // Validation
    if (!farmLocationId) {
      setError('Please select a farm location.');
      return;
    }
    if (!pricePerTon || isNaN(parseFloat(pricePerTon))) {
      setError('Please enter a valid price per ton.');
      return;
    }
    if (!isDeliveredPrice && !truckingCoordinatedBy) {
      setError('Please specify who will coordinate trucking, or mark as delivered price.');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      // Create listing
      const { data: listing } = await api.post('/listings', {
        farmLocationId,
        productType: productType || undefined,
        baleType: baleType || undefined,
        pricePerTon: parseFloat(pricePerTon),
        estimatedTons: estimatedTons ? parseFloat(estimatedTons) : undefined,
        baleCount: baleCount ? parseInt(baleCount, 10) : undefined,
        moisturePercent: moisturePercent ? parseFloat(moisturePercent) : undefined,
        notes: notes || undefined,
        firmPrice: firmPrice || undefined,
        isDeliveredPrice: isDeliveredPrice || undefined,
        truckingCoordinatedBy: !isDeliveredPrice && truckingCoordinatedBy
          ? truckingCoordinatedBy
          : undefined,
      });

      const listingId = listing.id;

      // Upload photos
      if (photos.length > 0) {
        const photoData = new FormData();
        photos.forEach((photo) => {
          photoData.append('photos', {
            uri: photo.uri,
            name: photo.fileName || 'photo.jpg',
            type: photo.type || 'image/jpeg',
          } as unknown as Blob);
        });
        await api.post(`/listings/${listingId}/photos`, photoData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
      }

      // Upload documents
      if (documents.length > 0) {
        const docData = new FormData();
        documents.forEach((doc) => {
          docData.append('documents', {
            uri: doc.uri,
            name: doc.name,
            type: doc.mimeType || 'application/pdf',
          } as unknown as Blob);
        });
        await api.post(`/listings/${listingId}/documents`, docData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
      }

      Alert.alert('Success', 'Listing created successfully.', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: { message?: string } } } };
      setError(axiosErr.response?.data?.error?.message || 'Failed to create listing.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        style={{ flex: 1, backgroundColor: COLORS.bg }}
        contentContainerStyle={{ padding: 16, paddingBottom: 60 }}
        keyboardShouldPersistTaps="handled"
      >
        {error ? <ErrorBanner message={error} /> : null}

        {/* Farm Location */}
        <Card style={{ marginBottom: 16 }}>
          <CardHeader>
            <CardTitle style={{ fontSize: 16 }}>Location</CardTitle>
            <CardDescription>Where is the hay located?</CardDescription>
          </CardHeader>
          <CardContent>
            <SelectPicker
              label="Farm Location"
              value={farmLocationId}
              placeholder="Select location..."
              options={farmLocations.map((loc) => ({
                label: `${loc.name}${loc.state ? ` (${loc.state})` : ''}`,
                value: loc.id,
              }))}
              onValueChange={setFarmLocationId}
            />
            <TouchableOpacity
              onPress={useCurrentLocation}
              disabled={locatingUser}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                marginTop: 10,
                paddingVertical: 10,
                borderWidth: 1,
                borderColor: COLORS.primary,
                borderRadius: 8,
                backgroundColor: 'transparent',
                opacity: locatingUser ? 0.6 : 1,
              }}
            >
              {locatingUser ? (
                <ActivityIndicator size="small" color={COLORS.primary} style={{ marginRight: 8 }} />
              ) : (
                <Text style={{ fontSize: 16, marginRight: 6 }}>{'\u{1F4CD}'}</Text>
              )}
              <Text style={{ fontSize: 14, fontWeight: '500', color: COLORS.primary }}>
                {locatingUser ? 'Getting Location...' : 'Use Current Location'}
              </Text>
            </TouchableOpacity>

            {/* Use Home Address */}
            {user?.organizationAddress && (
              <TouchableOpacity
                onPress={useHomeAddress}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginTop: 8,
                  paddingVertical: 10,
                  borderWidth: 1,
                  borderColor: COLORS.primary,
                  borderRadius: 8,
                }}
              >
                <Text style={{ fontSize: 16, marginRight: 6 }}>{'\u{1F3E0}'}</Text>
                <Text style={{ fontSize: 14, fontWeight: '500', color: COLORS.primary }}>
                  Use Home Address
                </Text>
              </TouchableOpacity>
            )}

            {/* Drop a Pin */}
            <TouchableOpacity
              onPress={() => setShowPinMap(true)}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                marginTop: 8,
                paddingVertical: 10,
                borderWidth: 1,
                borderColor: COLORS.primary,
                borderRadius: 8,
              }}
            >
              <Text style={{ fontSize: 16, marginRight: 6 }}>{'\u{1F4CC}'}</Text>
              <Text style={{ fontSize: 14, fontWeight: '500', color: COLORS.primary }}>
                Drop a Pin on Map
              </Text>
            </TouchableOpacity>
          </CardContent>
        </Card>

        {/* Product Details */}
        <Card style={{ marginBottom: 16 }}>
          <CardHeader>
            <CardTitle style={{ fontSize: 16 }}>Product Details</CardTitle>
            <CardDescription>Describe the hay you are listing</CardDescription>
          </CardHeader>
          <CardContent>
            {/* Product type with suggestions */}
            <View style={{ marginBottom: 12 }}>
              <Input
                label="Product Type"
                value={productType}
                onChangeText={(text) => {
                  setProductType(text);
                  setShowProductSuggestions(text.length > 0);
                }}
                onFocus={() => setShowProductSuggestions(productType.length > 0)}
                onBlur={() => {
                  // Delay hiding so tap on suggestion registers
                  setTimeout(() => setShowProductSuggestions(false), 200);
                }}
                placeholder="Search hay/straw type..."
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
                          setProductType(p);
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

            {/* Bale type */}
            <SelectPicker
              label="Bale Type"
              value={baleType}
              placeholder="Select bale type..."
              options={[
                { label: 'Select bale type...', value: '' },
                ...BALE_TYPES.map((b) => ({ label: b, value: b })),
              ]}
              onValueChange={setBaleType}
            />

            <View style={{ marginTop: 12 }}>
              <Input
                label="Moisture %"
                value={moisturePercent}
                onChangeText={setMoisturePercent}
                placeholder="12.5"
                keyboardType="decimal-pad"
              />
            </View>
          </CardContent>
        </Card>

        {/* Pricing & Quantity */}
        <Card style={{ marginBottom: 16 }}>
          <CardHeader>
            <CardTitle style={{ fontSize: 16 }}>Pricing & Quantity</CardTitle>
          </CardHeader>
          <CardContent>
            <Input
              label="Price per Ton ($)"
              value={pricePerTon}
              onChangeText={setPricePerTon}
              placeholder="250.00"
              keyboardType="decimal-pad"
              containerStyle={{ marginBottom: 12 }}
            />

            <View style={{ flexDirection: 'row', gap: 12, marginBottom: 12 }}>
              <View style={{ flex: 1 }}>
                <Input
                  label="Estimated Tons"
                  value={estimatedTons}
                  onChangeText={setEstimatedTons}
                  placeholder="500"
                  keyboardType="decimal-pad"
                />
              </View>
              <View style={{ flex: 1 }}>
                <Input
                  label="Bale Count"
                  value={baleCount}
                  onChangeText={setBaleCount}
                  placeholder="1000"
                  keyboardType="number-pad"
                />
              </View>
            </View>

            {/* Firm price toggle */}
            <View style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingVertical: 12,
              borderTopWidth: 1,
              borderTopColor: '#f0ece4',
            }}>
              <View style={{ flex: 1, marginRight: 12 }}>
                <Text style={{ fontSize: 14, fontWeight: '500', color: COLORS.foreground }}>
                  Firm Price
                </Text>
                <Text style={{ fontSize: 12, color: COLORS.muted, marginTop: 2 }}>
                  Disables counter offers from buyers
                </Text>
              </View>
              <Switch
                value={firmPrice}
                onValueChange={setFirmPrice}
                trackColor={{ false: COLORS.border, true: '#a3d99a' }}
                thumbColor={firmPrice ? COLORS.primary : '#f4f3f4'}
              />
            </View>

            {/* Delivered price toggle */}
            <View style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingVertical: 12,
              borderTopWidth: 1,
              borderTopColor: '#f0ece4',
            }}>
              <View style={{ flex: 1, marginRight: 12 }}>
                <Text style={{ fontSize: 14, fontWeight: '500', color: COLORS.foreground }}>
                  Delivered Price
                </Text>
                <Text style={{ fontSize: 12, color: COLORS.muted, marginTop: 2 }}>
                  Price includes delivery to buyer
                </Text>
              </View>
              <Switch
                value={isDeliveredPrice}
                onValueChange={(val) => {
                  setIsDeliveredPrice(val);
                  if (val) setTruckingCoordinatedBy('');
                }}
                trackColor={{ false: COLORS.border, true: '#a3d99a' }}
                thumbColor={isDeliveredPrice ? COLORS.primary : '#f4f3f4'}
              />
            </View>

            {/* Trucking coordinated by (only if not delivered) */}
            {!isDeliveredPrice && (
              <View style={{ marginTop: 8 }}>
                <Input
                  label="Trucking Coordinated By"
                  value={truckingCoordinatedBy}
                  onChangeText={setTruckingCoordinatedBy}
                  placeholder="e.g. Buyer, Grower, Smith Trucking Co."
                />
              </View>
            )}
          </CardContent>
        </Card>

        {/* Photos */}
        <Card style={{ marginBottom: 16 }}>
          <CardHeader>
            <CardTitle style={{ fontSize: 16 }}>Photos</CardTitle>
            <CardDescription>Add photos of the hay bales</CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 8, paddingBottom: 4 }}
            >
              {photos.map((photo, index) => (
                <View key={index} style={{ position: 'relative' }}>
                  <Image
                    source={{ uri: photo.uri }}
                    style={{
                      width: 80,
                      height: 80,
                      borderRadius: 8,
                      borderWidth: 1,
                      borderColor: COLORS.border,
                    }}
                  />
                  <TouchableOpacity
                    onPress={() => removePhoto(index)}
                    style={{
                      position: 'absolute',
                      top: -6,
                      right: -6,
                      width: 22,
                      height: 22,
                      borderRadius: 11,
                      backgroundColor: '#b33a1a',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Text style={{ color: '#ffffff', fontSize: 12, fontWeight: '700' }}>X</Text>
                  </TouchableOpacity>
                </View>
              ))}

              {/* Add photo button */}
              <TouchableOpacity
                onPress={showPhotoOptions}
                style={{
                  width: 80,
                  height: 80,
                  borderRadius: 8,
                  borderWidth: 2,
                  borderStyle: 'dashed',
                  borderColor: COLORS.border,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Text style={{ fontSize: 24, color: COLORS.muted }}>+</Text>
                <Text style={{ fontSize: 10, color: COLORS.muted, marginTop: 2 }}>Add</Text>
              </TouchableOpacity>
            </ScrollView>
            <Text style={{ fontSize: 11, color: COLORS.muted, marginTop: 8 }}>
              Tap to open camera or choose from gallery
            </Text>
          </CardContent>
        </Card>

        {/* Documents */}
        <Card style={{ marginBottom: 16 }}>
          <CardHeader>
            <CardTitle style={{ fontSize: 16 }}>Documents</CardTitle>
            <CardDescription>Lab reports, hay tests, certifications</CardDescription>
          </CardHeader>
          <CardContent>
            {documents.map((doc, index) => (
              <View
                key={index}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  paddingVertical: 8,
                  borderBottomWidth: 1,
                  borderBottomColor: '#f0ece4',
                  gap: 8,
                }}
              >
                <Text style={{ fontSize: 16 }}>{'\u{1F4C4}'}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 13, color: COLORS.foreground }} numberOfLines={1}>
                    {doc.name}
                  </Text>
                  {doc.size != null && (
                    <Text style={{ fontSize: 11, color: COLORS.muted }}>
                      {(doc.size / 1024).toFixed(0)} KB
                    </Text>
                  )}
                </View>
                <TouchableOpacity onPress={() => removeDocument(index)}>
                  <Text style={{ fontSize: 13, color: '#b33a1a', fontWeight: '500' }}>Remove</Text>
                </TouchableOpacity>
              </View>
            ))}

            <Button
              size="sm"
              variant="outline"
              onPress={pickDocument}
              style={{ marginTop: documents.length > 0 ? 10 : 0 }}
            >
              Attach Document
            </Button>
          </CardContent>
        </Card>

        {/* Notes */}
        <Card style={{ marginBottom: 24 }}>
          <CardHeader>
            <CardTitle style={{ fontSize: 16 }}>Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <Input
              value={notes}
              onChangeText={setNotes}
              placeholder="Quality notes, test results, additional info..."
              multiline
              numberOfLines={4}
              style={{ height: 100, textAlignVertical: 'top' }}
            />
          </CardContent>
        </Card>

        {/* Submit */}
        <Button
          onPress={handleSubmit}
          loading={submitting}
          disabled={submitting}
          size="lg"
          style={{ marginBottom: 16 }}
        >
          {submitting ? 'Creating Listing...' : 'Create Listing'}
        </Button>

        <Button
          variant="ghost"
          onPress={() => navigation.goBack()}
          style={{ marginBottom: 16 }}
        >
          Cancel
        </Button>
      </ScrollView>

      {/* Drop a Pin Map Modal */}
      <Modal visible={showPinMap} animationType="slide">
        <View style={{ flex: 1, backgroundColor: COLORS.bg }}>
          <View style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: 16,
            paddingTop: Platform.OS === 'ios' ? 56 : 16,
            backgroundColor: COLORS.card,
            borderBottomWidth: 1,
            borderBottomColor: COLORS.border,
          }}>
            <TouchableOpacity onPress={() => { setShowPinMap(false); setPinCoord(null); }}>
              <Text style={{ fontSize: 16, color: COLORS.muted }}>Cancel</Text>
            </TouchableOpacity>
            <Text style={{ fontSize: 17, fontWeight: '600', color: COLORS.foreground }}>Drop a Pin</Text>
            <TouchableOpacity onPress={handleSavePin} disabled={!pinCoord || savingPin}>
              <Text style={{ fontSize: 16, fontWeight: '600', color: pinCoord ? COLORS.primary : COLORS.muted }}>
                {savingPin ? 'Saving...' : 'Use Pin'}
              </Text>
            </TouchableOpacity>
          </View>
          <Text style={{ textAlign: 'center', paddingVertical: 8, fontSize: 13, color: COLORS.muted }}>
            Tap the map to place a pin
          </Text>
          <MapView
            style={{ flex: 1 }}
            initialRegion={{
              latitude: user?.organizationLatitude ?? 39.5,
              longitude: user?.organizationLongitude ?? -98.0,
              latitudeDelta: user?.organizationLatitude ? 0.5 : 30,
              longitudeDelta: user?.organizationLongitude ? 0.5 : 30,
            }}
            showsUserLocation
            showsMyLocationButton
            onPress={handleMapPress}
          >
            {pinCoord && (
              <Marker coordinate={pinCoord} pinColor={COLORS.primary} />
            )}
          </MapView>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}
