// Dashboard
export interface AvgPrice {
  productType: string;
  avgPricePerTon: number;
  totalTons: number;
  poCount: number;
}

export interface DashboardStats {
  activePOs: number;
  openNegotiations: number;
  todaysLoads: number;
  periodTons: number;
  periodLoadsCount: number;
  avgPriceByProduct: AvgPrice[];
  centers: string[];
}

// Purchase Orders
export interface POListing {
  id: string;
  stackId: string;
  productType?: string;
  baleType?: string;
}

export interface POStack {
  id: string;
  listing: POListing;
  allocatedTons: number;
}

export interface PurchaseOrder {
  id: string;
  poNumber: string | null;
  buyerOrgId: string;
  growerOrgId: string;
  buyerOrg: { id: string; name: string };
  growerOrg: { id: string; name: string };
  destinationSite: { id: string; siteName: string } | null;
  createdBy: { id: string; name: string };
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
  center: string | null;
  hayClass: string | null;
  poStacks: POStack[];
  createdAt: string;
  completedAt?: string | null;
  buyerSignature?: SignatureInfo | null;
  growerSignature?: SignatureInfo | null;
}

export interface Delivery {
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

export interface PickupInfo {
  poNumber: string;
  buyerOrg: string;
  growerOrg: string;
  contractedTons: number;
  pricePerTon: number;
  productType: string | null;
  baleType: string | null;
  baleCount: number | null;
  deliveryStartDate: string | null;
  deliveryEndDate: string | null;
  pickup: {
    name: string;
    address: string | null;
    state: string | null;
    latitude: number | null;
    longitude: number | null;
  } | null;
  delivery: {
    name: string;
    address: string | null;
    latitude: number | null;
    longitude: number | null;
  } | null;
}

// Loads
export interface LoadEntry {
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

// Listings
export interface FarmLocation {
  id: string;
  name: string;
  address?: string;
  state?: string;
  latitude?: number;
  longitude?: number;
}

export interface Listing {
  id: string;
  stackId: string;
  productType?: string;
  baleType?: string;
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
  distanceMiles?: number;
  farmLocation: FarmLocation;
  organization: { id: string; name: string };
  photos: Array<{ id: string; fileUrl: string }>;
  documents: Array<{ id: string; fileUrl: string; documentType?: string }>;
}

// Negotiations
export interface NegotiationMessage {
  id: string;
  listingId: string;
  buyerOrgId: string;
  growerOrgId: string;
  status: string;
  offeredPricePerTon: number;
  offeredTons?: number;
  message?: string;
  offeredByOrgId: string;
  offeredByUserId: string;
  offeredByUser: { id: string; name: string };
  purchaseOrderId?: string;
  parentId?: string;
  createdAt: string;
  listing: {
    id: string;
    stackId: string;
    pricePerTon: number;
    productType?: string;
    baleType?: string;
    estimatedTons?: number;
    status: string;
    isDeliveredPrice?: boolean;
    truckingCoordinatedBy?: string;
    farmLocation?: { name: string };
  };
  buyerOrg: { id: string; name: string };
  growerOrg: { id: string; name: string };
}

export interface NegotiationThread extends NegotiationMessage {
  replies: Array<NegotiationMessage & { offeredByUser: { id: string; name: string } }>;
}

// Contracts
export interface SignatureInfo {
  name: string;
  signatureImage: string | null;
  signedAt: string;
  signedBy: string;
}

export interface ContractDetails {
  stackId: string;
  productType?: string;
  baleType?: string;
  buyerName: string;
  growerName: string;
  pricePerTon: number;
  tons: number;
  moisturePercent?: number;
  notes?: string;
  isDeliveredPrice?: boolean;
  truckingCoordinatedBy?: string;
  farmLocationName?: string;
}

// Account / Team
export interface TeamMember {
  id: string;
  email: string;
  name: string;
  role: 'FARM_ADMIN' | 'MANAGER' | 'VIEWER';
  isActive: boolean;
  lastLogin: string | null;
  createdAt: string;
}

export interface PendingInvite {
  id: string;
  email: string;
  role: string;
  type: string;
  token: string;
  link: string;
  expiresAt: string;
  createdAt: string;
}
