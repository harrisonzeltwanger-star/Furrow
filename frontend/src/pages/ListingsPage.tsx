import { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, LayersControl } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import api from '@/services/api';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import AddressAutocomplete from '@/components/AddressAutocomplete';

// Fix default Leaflet marker icons
const defaultIcon = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});
L.Marker.prototype.options.icon = defaultIcon;

interface FarmLocation {
  id: string;
  name: string;
  address?: string;
  latitude?: number;
  longitude?: number;
}

interface Listing {
  id: string;
  stackId: string;
  productType?: string;
  pricePerTon: number;
  estimatedTons?: number;
  baleCount?: number;
  moisturePercent?: number;
  status: string;
  firmPrice?: boolean;
  isDeliveredPrice?: boolean;
  truckingCoordinatedBy?: string;
  notes?: string;
  createdAt: string;
  farmLocation: FarmLocation;
  organization: { id: string; name: string };
  photos: Array<{ id: string; fileUrl: string }>;
  documents: Array<{ id: string; fileUrl: string; documentType?: string }>;
}

interface CreateListingForm {
  farmLocationId: string;
  productType: string;
  pricePerTon: string;
  estimatedTons: string;
  baleCount: string;
  moisturePercent: string;
  notes: string;
  firmPrice: boolean;
  isDeliveredPrice: boolean;
  truckingCoordinatedBy: string;
}

const emptyForm: CreateListingForm = {
  farmLocationId: '',
  productType: '',
  pricePerTon: '',
  estimatedTons: '',
  baleCount: '',
  moisturePercent: '',
  notes: '',
  firmPrice: false,
  isDeliveredPrice: false,
  truckingCoordinatedBy: '',
};

export default function ListingsPage() {
  const { user } = useAuth();
  const [listings, setListings] = useState<Listing[]>([]);
  const [farmLocations, setFarmLocations] = useState<FarmLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState<CreateListingForm>(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [selectedListing, setSelectedListing] = useState<string | null>(null);

  // File uploads for new listing
  const [photoFiles, setPhotoFiles] = useState<File[]>([]);
  const [docFiles, setDocFiles] = useState<File[]>([]);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const docInputRef = useRef<HTMLInputElement>(null);

  // Make Offer dialog
  const [offerListing, setOfferListing] = useState<Listing | null>(null);
  const [offerForm, setOfferForm] = useState({ pricePerTon: '', tons: '', message: '' });
  const [offerSubmitting, setOfferSubmitting] = useState(false);
  const [offerError, setOfferError] = useState('');

  const isBuyer = user?.organizationType === 'BUYER';

  const handleMakeOffer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!offerListing) return;
    setOfferSubmitting(true);
    setOfferError('');
    try {
      await api.post('/negotiations', {
        listingId: offerListing.id,
        offeredPricePerTon: parseFloat(offerForm.pricePerTon),
        offeredTons: offerForm.tons ? parseFloat(offerForm.tons) : undefined,
        message: offerForm.message || undefined,
      });
      setOfferListing(null);
      setOfferForm({ pricePerTon: '', tons: '', message: '' });
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: { message?: string } } } };
      setOfferError(axiosErr.response?.data?.error?.message || 'Failed to submit offer');
    } finally {
      setOfferSubmitting(false);
    }
  };

  // New farm location form
  const [showNewLocation, setShowNewLocation] = useState(false);
  const [newLocation, setNewLocation] = useState({ name: '', address: '', latitude: 0, longitude: 0 });

  const fetchData = async () => {
    try {
      const [listingsRes, locationsRes] = await Promise.all([
        api.get('/listings', { params: statusFilter ? { status: statusFilter } : {} }),
        api.get('/farm-locations'),
      ]);
      setListings(listingsRes.data.listings);
      setFarmLocations(locationsRes.data.farmLocations);
    } catch {
      console.error('Failed to fetch listings');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [statusFilter]);

  const handleCreateListing = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      const res = await api.post('/listings', {
        farmLocationId: form.farmLocationId,
        productType: form.productType || undefined,
        pricePerTon: parseFloat(form.pricePerTon),
        estimatedTons: form.estimatedTons ? parseFloat(form.estimatedTons) : undefined,
        baleCount: form.baleCount ? parseInt(form.baleCount, 10) : undefined,
        moisturePercent: form.moisturePercent ? parseFloat(form.moisturePercent) : undefined,
        notes: form.notes || undefined,
        firmPrice: form.firmPrice || undefined,
        isDeliveredPrice: form.isDeliveredPrice || undefined,
        truckingCoordinatedBy: !form.isDeliveredPrice && form.truckingCoordinatedBy ? form.truckingCoordinatedBy : undefined,
      });
      const listingId = res.data.id;

      // Upload photos if any
      if (photoFiles.length > 0) {
        const photoData = new FormData();
        photoFiles.forEach((f) => photoData.append('photos', f));
        await api.post(`/listings/${listingId}/photos`, photoData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
      }

      // Upload documents if any
      if (docFiles.length > 0) {
        const docData = new FormData();
        docFiles.forEach((f) => docData.append('documents', f));
        await api.post(`/listings/${listingId}/documents`, docData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
      }

      setForm(emptyForm);
      setPhotoFiles([]);
      setDocFiles([]);
      setShowCreate(false);
      fetchData();
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: { message?: string } } } };
      setError(axiosErr.response?.data?.error?.message || 'Failed to create listing');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateLocation = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await api.post('/farm-locations', {
        name: newLocation.name,
        address: newLocation.address || undefined,
        latitude: newLocation.latitude || undefined,
        longitude: newLocation.longitude || undefined,
      });
      setFarmLocations([...farmLocations, res.data]);
      setForm({ ...form, farmLocationId: res.data.id });
      setShowNewLocation(false);
      setNewLocation({ name: '', address: '', latitude: 0, longitude: 0 });
    } catch {
      setError('Failed to create farm location');
    }
  };

  // Compute map markers from listings that have lat/lng
  const markers = listings.filter(
    (l) => l.farmLocation.latitude != null && l.farmLocation.longitude != null
  );

  // Default center: middle of continental US
  const mapCenter: [number, number] = markers.length > 0
    ? [markers[0].farmLocation.latitude!, markers[0].farmLocation.longitude!]
    : [35.5, -98.0];

  const statusColors: Record<string, string> = {
    available: 'bg-primary/15 text-primary',
    under_contract: 'bg-hay-gold/30 text-hay-gold-foreground',
    depleted: 'bg-muted text-muted-foreground',
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="text-muted-foreground">Loading listings...</div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-semibold">Listings</h2>
        <div className="flex items-center gap-3">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:border-ring"
          >
            <option value="">All statuses</option>
            <option value="available">Available</option>
            <option value="under_contract">Under Contract</option>
            <option value="depleted">Depleted</option>
          </select>
          {user?.role !== 'VIEWER' && (
            <Button onClick={() => setShowCreate(!showCreate)}>
              {showCreate ? 'Cancel' : 'New Listing'}
            </Button>
          )}
        </div>
      </div>

      {/* Create listing form */}
      {showCreate && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Create New Listing</CardTitle>
            <CardDescription>Add a hay stack to the marketplace</CardDescription>
          </CardHeader>
          <CardContent>
            {error && (
              <div className="rounded-md bg-destructive/10 text-destructive px-4 py-3 text-sm mb-4">{error}</div>
            )}
            <form onSubmit={handleCreateListing} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Farm Location</Label>
                <div className="flex gap-2">
                  <select
                    value={form.farmLocationId}
                    onChange={(e) => setForm({ ...form, farmLocationId: e.target.value })}
                    required
                    className="flex-1 h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:border-ring"
                  >
                    <option value="">Select location...</option>
                    {farmLocations.map((loc) => (
                      <option key={loc.id} value={loc.id}>{loc.name}</option>
                    ))}
                  </select>
                  <Button type="button" variant="outline" size="sm" onClick={() => setShowNewLocation(!showNewLocation)}>
                    +
                  </Button>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Product Type</Label>
                <Input value={form.productType} onChange={(e) => setForm({ ...form, productType: e.target.value })} placeholder="Alfalfa, Bermuda, etc." />
              </div>
              <div className="space-y-2">
                <Label>Price per Ton ($)</Label>
                <Input type="number" step="0.01" value={form.pricePerTon} onChange={(e) => setForm({ ...form, pricePerTon: e.target.value })} placeholder="250.00" required />
              </div>
              <div className="space-y-2">
                <Label>Estimated Tons</Label>
                <Input type="number" step="0.1" value={form.estimatedTons} onChange={(e) => setForm({ ...form, estimatedTons: e.target.value })} placeholder="500" />
              </div>
              <div className="space-y-2">
                <Label>Bale Count</Label>
                <Input type="number" value={form.baleCount} onChange={(e) => setForm({ ...form, baleCount: e.target.value })} placeholder="1000" />
              </div>
              <div className="space-y-2">
                <Label>Moisture %</Label>
                <Input type="number" step="0.1" value={form.moisturePercent} onChange={(e) => setForm({ ...form, moisturePercent: e.target.value })} placeholder="12.5" />
              </div>
              <div className="space-y-2">
                <Label>Notes</Label>
                <Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Quality notes, test results..." />
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="firmPrice"
                  checked={form.firmPrice}
                  onChange={(e) => setForm({ ...form, firmPrice: e.target.checked })}
                  className="h-4 w-4 rounded border-input"
                />
                <Label htmlFor="firmPrice" className="text-sm font-normal cursor-pointer">
                  Firm Price (disables counter offers from buyers)
                </Label>
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="isDeliveredPrice"
                    checked={form.isDeliveredPrice}
                    onChange={(e) => setForm({ ...form, isDeliveredPrice: e.target.checked, truckingCoordinatedBy: e.target.checked ? '' : form.truckingCoordinatedBy })}
                    className="h-4 w-4 rounded border-input"
                  />
                  <Label htmlFor="isDeliveredPrice" className="text-sm font-normal cursor-pointer">
                    Delivered Price (price includes delivery)
                  </Label>
                </div>
                {!form.isDeliveredPrice && (
                  <div className="ml-6 space-y-1">
                    <Label className="text-xs text-muted-foreground">Who will coordinate trucking?</Label>
                    <Input
                      value={form.truckingCoordinatedBy}
                      onChange={(e) => setForm({ ...form, truckingCoordinatedBy: e.target.value })}
                      placeholder="e.g. Buyer, Grower, Smith Trucking Co."
                      required
                    />
                  </div>
                )}
              </div>

              {/* Photo upload - smartphone friendly */}
              <div className="space-y-2">
                <Label>Photos</Label>
                <input
                  ref={photoInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files) setPhotoFiles((prev) => [...prev, ...Array.from(e.target.files!)]);
                  }}
                />
                <div className="flex flex-wrap gap-2">
                  {photoFiles.map((f, i) => (
                    <div key={i} className="relative group">
                      <img
                        src={URL.createObjectURL(f)}
                        alt={f.name}
                        className="h-16 w-16 object-cover rounded-md border border-border"
                      />
                      <button
                        type="button"
                        onClick={() => setPhotoFiles(photoFiles.filter((_, j) => j !== i))}
                        className="absolute -top-1.5 -right-1.5 bg-destructive text-destructive-foreground rounded-full w-5 h-5 text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        x
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => photoInputRef.current?.click()}
                    className="h-16 w-16 rounded-md border-2 border-dashed border-border flex flex-col items-center justify-center text-muted-foreground hover:border-primary hover:text-primary transition-colors"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                    <span className="text-[10px] mt-0.5">Add</span>
                  </button>
                </div>
                <p className="text-xs text-muted-foreground">Tap to open camera or choose from gallery</p>
              </div>

              {/* Document/PDF upload */}
              <div className="space-y-2">
                <Label>Documents (PDF)</Label>
                <input
                  ref={docInputRef}
                  type="file"
                  accept="application/pdf,image/*"
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files) setDocFiles((prev) => [...prev, ...Array.from(e.target.files!)]);
                  }}
                />
                <div className="space-y-1">
                  {docFiles.map((f, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm bg-muted/50 rounded px-2 py-1">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-destructive shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
                      <span className="truncate flex-1">{f.name}</span>
                      <span className="text-xs text-muted-foreground">{(f.size / 1024).toFixed(0)} KB</span>
                      <button
                        type="button"
                        onClick={() => setDocFiles(docFiles.filter((_, j) => j !== i))}
                        className="text-muted-foreground hover:text-destructive text-xs"
                      >
                        x
                      </button>
                    </div>
                  ))}
                  <Button type="button" variant="outline" size="sm" onClick={() => docInputRef.current?.click()}>
                    Attach PDF
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">Lab reports, hay tests, certifications</p>
              </div>

              <div className="md:col-span-2">
                <Button type="submit" disabled={submitting}>
                  {submitting ? 'Creating...' : 'Create Listing'}
                </Button>
              </div>
            </form>

            {/* Inline new location form */}
            {showNewLocation && (
              <form onSubmit={handleCreateLocation} className="mt-4 p-4 border border-border rounded-lg bg-muted/30">
                <h4 className="font-medium text-sm mb-3">Add Farm Location</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Name</Label>
                    <Input value={newLocation.name} onChange={(e) => setNewLocation({ ...newLocation, name: e.target.value })} placeholder="North 40" required />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Address</Label>
                    <AddressAutocomplete
                      value={newLocation.address}
                      onChange={(address, lat, lng) => setNewLocation({
                        ...newLocation,
                        address,
                        latitude: lat ?? newLocation.latitude,
                        longitude: lng ?? newLocation.longitude,
                      })}
                      placeholder="Start typing an address..."
                    />
                    {newLocation.latitude !== 0 && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Coordinates: {newLocation.latitude.toFixed(4)}, {newLocation.longitude.toFixed(4)}
                      </p>
                    )}
                  </div>
                </div>
                <Button type="submit" size="sm" className="mt-3">Save Location</Button>
              </form>
            )}
          </CardContent>
        </Card>
      )}

      {/* Map + List split view */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Map */}
        <Card className="overflow-hidden">
          <div className="h-[500px]">
            <MapContainer center={mapCenter} zoom={5} style={{ height: '100%', width: '100%' }}>
              <LayersControl position="topright">
                <LayersControl.BaseLayer checked name="Street">
                  <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  />
                </LayersControl.BaseLayer>
                <LayersControl.BaseLayer name="Satellite">
                  <TileLayer
                    attribution='Tiles &copy; Esri'
                    url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                  />
                </LayersControl.BaseLayer>
              </LayersControl>
              {markers.map((listing) => (
                <Marker
                  key={listing.id}
                  position={[listing.farmLocation.latitude!, listing.farmLocation.longitude!]}
                  eventHandlers={{
                    click: () => setSelectedListing(listing.id),
                  }}
                >
                  <Popup>
                    <div className="text-sm">
                      <strong>{listing.stackId}</strong>
                      <br />
                      {listing.productType && <>{listing.productType}<br /></>}
                      ${listing.pricePerTon}/ton
                      {listing.isDeliveredPrice && <span className="text-xs text-gray-500"> (delivered)</span>}
                      <br />
                      {listing.farmLocation.name}
                      <br />
                      <span className="text-xs text-gray-500">{listing.organization.name}</span>
                      {listing.firmPrice && (
                        <><br /><span className="text-xs font-medium text-gray-500">Firm Price</span></>
                      )}
                      {!listing.firmPrice && listing.organization.id !== user?.organizationId && listing.status === 'available' && (
                        <div className="mt-2">
                          <button
                            className="px-2 py-1 text-xs font-medium rounded border border-gray-300 hover:bg-gray-100 transition-colors"
                            onClick={(e) => {
                              e.stopPropagation();
                              setOfferForm({ pricePerTon: String(listing.pricePerTon), tons: listing.estimatedTons ? String(listing.estimatedTons) : '', message: '' });
                              setOfferListing(listing);
                            }}
                          >
                            Counter Offer
                          </button>
                        </div>
                      )}
                    </div>
                  </Popup>
                </Marker>
              ))}
            </MapContainer>
          </div>
        </Card>

        {/* Listings list */}
        <div className="space-y-3">
          {listings.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                No listings found. {user?.role !== 'VIEWER' && 'Create one to get started.'}
              </CardContent>
            </Card>
          ) : (
            listings.map((listing) => (
              <Card
                key={listing.id}
                className={`cursor-pointer transition-shadow hover:shadow-md ${
                  selectedListing === listing.id ? 'ring-2 ring-primary' : ''
                }`}
                onClick={() => setSelectedListing(listing.id === selectedListing ? null : listing.id)}
              >
                <CardContent className="py-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold">{listing.stackId}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${statusColors[listing.status] || 'bg-muted text-muted-foreground'}`}>
                          {listing.status.replace('_', ' ')}
                        </span>
                      </div>
                      {listing.productType && (
                        <div className="text-sm text-muted-foreground mb-1">{listing.productType}</div>
                      )}
                      <div className="text-sm text-muted-foreground">
                        {listing.farmLocation.name} &middot; {listing.organization.name}
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      {!listing.firmPrice && listing.organization.id !== user?.organizationId && listing.status === 'available' && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={(e) => {
                            e.stopPropagation();
                            setOfferForm({ pricePerTon: String(listing.pricePerTon), tons: listing.estimatedTons ? String(listing.estimatedTons) : '', message: '' });
                            setOfferListing(listing);
                          }}
                        >
                          Counter Offer
                        </Button>
                      )}
                      <div className="text-right">
                        <div className="text-lg font-semibold text-earth-brown">${listing.pricePerTon}</div>
                        <div className="text-xs text-muted-foreground">
                          per ton{listing.isDeliveredPrice ? ' (delivered)' : ''}
                        </div>
                        {listing.firmPrice && (
                          <span className="inline-block mt-1 text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground font-medium">
                            Firm Price
                          </span>
                        )}
                        {!listing.isDeliveredPrice && listing.truckingCoordinatedBy && (
                          <div className="text-xs text-muted-foreground mt-1">
                            Trucking: {listing.truckingCoordinatedBy}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  {selectedListing === listing.id && (
                    <div className="mt-3 pt-3 border-t border-border grid grid-cols-3 gap-3 text-sm">
                      <div>
                        <span className="text-muted-foreground">Est. Tons</span>
                        <div className="font-medium">{listing.estimatedTons ?? '-'}</div>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Bales</span>
                        <div className="font-medium">{listing.baleCount ?? '-'}</div>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Moisture</span>
                        <div className="font-medium">{listing.moisturePercent != null ? `${listing.moisturePercent}%` : '-'}</div>
                      </div>
                      {listing.notes && (
                        <div className="col-span-3">
                          <span className="text-muted-foreground">Notes:</span>{' '}
                          <span>{listing.notes}</span>
                        </div>
                      )}
                      {listing.photos && listing.photos.length > 0 && (
                        <div className="col-span-3">
                          <span className="text-muted-foreground text-xs">Photos</span>
                          <div className="flex flex-wrap gap-2 mt-1">
                            {listing.photos.map((p) => (
                              <a key={p.id} href={p.fileUrl} target="_blank" rel="noopener noreferrer">
                                <img src={p.fileUrl} alt="Listing" className="h-20 w-20 object-cover rounded-md border border-border hover:ring-2 hover:ring-primary transition-all" />
                              </a>
                            ))}
                          </div>
                        </div>
                      )}
                      {listing.documents && listing.documents.length > 0 && (
                        <div className="col-span-3">
                          <span className="text-muted-foreground text-xs">Documents</span>
                          <div className="flex flex-col gap-1 mt-1">
                            {listing.documents.map((d) => (
                              <a
                                key={d.id}
                                href={d.fileUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-2 text-sm text-primary hover:underline"
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
                                {d.documentType || 'Document'}
                              </a>
                            ))}
                          </div>
                        </div>
                      )}
                      {listing.farmLocation.latitude != null && (
                        <div className="col-span-3 text-xs text-muted-foreground">
                          Location: {listing.farmLocation.latitude?.toFixed(4)}, {listing.farmLocation.longitude?.toFixed(4)}
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>

      {/* Make Offer Dialog */}
      <Dialog open={!!offerListing} onOpenChange={(open) => { if (!open) { setOfferListing(null); setOfferError(''); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Counter Offer</DialogTitle>
            <DialogDescription>
              {offerListing && `${offerListing.stackId} — ${offerListing.organization.name} — Listed at $${offerListing.pricePerTon}/ton`}
            </DialogDescription>
          </DialogHeader>
          {offerError && (
            <div className="rounded-md bg-destructive/10 text-destructive px-4 py-3 text-sm">{offerError}</div>
          )}
          <form onSubmit={handleMakeOffer} className="space-y-4">
            <div className="space-y-2">
              <Label>Offer Price per Ton ($)</Label>
              <Input
                type="number"
                step="0.01"
                value={offerForm.pricePerTon}
                onChange={(e) => setOfferForm({ ...offerForm, pricePerTon: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Tons (optional)</Label>
              <Input
                type="number"
                step="0.1"
                value={offerForm.tons}
                onChange={(e) => setOfferForm({ ...offerForm, tons: e.target.value })}
                placeholder={offerListing?.estimatedTons ? String(offerListing.estimatedTons) : ''}
              />
            </div>
            <div className="space-y-2">
              <Label>Message (optional)</Label>
              <Textarea
                value={offerForm.message}
                onChange={(e) => setOfferForm({ ...offerForm, message: e.target.value })}
                placeholder="Any notes for the grower..."
                rows={3}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOfferListing(null)}>Cancel</Button>
              <Button type="submit" disabled={offerSubmitting}>
                {offerSubmitting ? 'Submitting...' : 'Submit Offer'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
