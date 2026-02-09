# HAY PORTAL API SPECIFICATION

## Base URL
```
Production: https://api.hayportal.com/v1
Development: http://localhost:3000/api/v1
```

## Authentication

All API requests require a Bearer token in the Authorization header:
```
Authorization: Bearer <jwt_token>
```

### Authentication Endpoints

#### POST /auth/login
Login and receive JWT token.

**Request:**
```json
{
  "email": "john@example.com",
  "password": "securepassword"
}
```

**Response:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "uuid",
    "email": "john@example.com",
    "name": "John Doe",
    "role": "FARM_ADMIN",
    "organizationId": "uuid"
  }
}
```

#### POST /auth/register
Register new user (invite-only, requires valid invite code).

#### POST /auth/refresh
Refresh expired JWT token.

#### POST /auth/logout
Invalidate current session.

---

## Organizations

### GET /organizations/:id
Get organization details.

**Response:**
```json
{
  "id": "uuid",
  "name": "ABC Feedlot",
  "type": "BUYER",
  "invoiceEmail": "billing@abc.com",
  "billingContactName": "Jane Smith",
  "billingContactPhone": "555-0100"
}
```

### PATCH /organizations/:id
Update organization details (admin only).

---

## Users

### GET /users
List users in current organization.

**Query Parameters:**
- `role`: Filter by role (FARM_ADMIN, MANAGER, VIEWER)
- `isActive`: Filter by active status

### POST /users
Create new user (admins only).

**Request:**
```json
{
  "email": "newuser@example.com",
  "name": "New User",
  "phone": "555-0123",
  "role": "MANAGER"
}
```

### PATCH /users/:id
Update user details.

### DELETE /users/:id
Deactivate user (soft delete).

---

## Buyer Sites

### GET /buyer-sites
List all sites for current buyer organization.

**Response:**
```json
{
  "sites": [
    {
      "id": "uuid",
      "siteName": "Amarillo Feedlot",
      "siteCode": "SITE-A",
      "address": "123 Ranch Rd, Amarillo, TX",
      "latitude": 35.2220,
      "longitude": -101.8313,
      "scaleLocation": {
        "id": "uuid",
        "siteName": "Scale 1",
        "connectionType": "MANUAL"
      },
      "barnCount": 3,
      "isActive": true
    }
  ]
}
```

### POST /buyer-sites
Create new buyer site (admin only).

### GET /buyer-sites/:id/barns
Get all barns for a specific site.

---

## Listings

### GET /listings
List available grower listings.

**Query Parameters:**
- `status`: available, under_contract, depleted
- `productType`: Filter by product type
- `minPrice`, `maxPrice`: Price range
- `lat`, `lng`, `radius`: Geographic search

**Response:**
```json
{
  "listings": [
    {
      "id": "uuid",
      "stackId": "STACK-001",
      "productType": "Alfalfa",
      "pricePerTon": 250.00,
      "estimatedTons": 500,
      "moisturePercent": 12.5,
      "status": "available",
      "farmLocation": {
        "id": "uuid",
        "name": "North 40",
        "latitude": 35.1234,
        "longitude": -102.5678
      },
      "grower": {
        "id": "uuid",
        "name": "Smith Farms"
      },
      "photos": [
        {
          "id": "uuid",
          "fileUrl": "https://cdn.hayportal.com/photos/..."
        }
      ]
    }
  ]
}
```

### POST /listings
Create new listing (grower only).

**Request:**
```json
{
  "farmLocationId": "uuid",
  "stackId": "STACK-001",
  "productType": "Alfalfa",
  "pricePerTon": 250.00,
  "estimatedTons": 500,
  "baleCount": 1000,
  "moisturePercent": 12.5,
  "notes": "High quality, tested last week"
}
```

### GET /listings/:id
Get listing details with photos and documents.

### PATCH /listings/:id
Update listing.

### POST /listings/:id/photos
Upload photos to listing.

### POST /listings/:id/documents
Upload documents (lab results, etc.).

---

## Purchase Orders

### GET /purchase-orders
List purchase orders.

**Query Parameters:**
- `status`: DRAFT, ACTIVE, COMPLETED, DISPUTED, CANCELLED
- `buyerOrgId`: Filter by buyer
- `growerOrgId`: Filter by grower
- `destinationSiteId`: Filter by site

**Response:**
```json
{
  "purchaseOrders": [
    {
      "id": "uuid",
      "poNumber": "PO-2024-042",
      "status": "ACTIVE",
      "buyerOrg": {
        "id": "uuid",
        "name": "ABC Feedlot"
      },
      "growerOrg": {
        "id": "uuid",
        "name": "Smith Farms"
      },
      "destinationSite": {
        "id": "uuid",
        "siteName": "Amarillo Feedlot"
      },
      "contractedTons": 500,
      "deliveredTons": 50,
      "remainingTons": 450,
      "pricePerTon": 250.00,
      "deliveryStartDate": "2024-02-01",
      "deliveryEndDate": "2024-03-31",
      "createdAt": "2024-01-15T10:00:00Z"
    }
  ]
}
```

### POST /purchase-orders
Create new purchase order.

**Request:**
```json
{
  "growerOrgId": "uuid",
  "destinationSiteId": "uuid",
  "contractedTons": 500,
  "pricePerTon": 250.00,
  "deliveryStartDate": "2024-02-01",
  "deliveryEndDate": "2024-03-31",
  "maxMoisturePercent": 15.0,
  "qualityNotes": "No mold, green color",
  "stacks": [
    {
      "listingId": "uuid",
      "allocatedTons": 500
    }
  ]
}
```

**Response:**
```json
{
  "id": "uuid",
  "poNumber": "PO-2024-042",
  "status": "DRAFT",
  "contractFileUrl": null,
  ...
}
```

### GET /purchase-orders/:id
Get PO details with all loads and stacks.

### PATCH /purchase-orders/:id
Update PO (limited fields, depends on status).

### POST /purchase-orders/:id/sign
Sign purchase order (buyer or grower admin).

**Request:**
```json
{
  "signature": "base64_encoded_signature_image",
  "agreedToTerms": true
}
```

### POST /purchase-orders/:id/close
Close PO early (requires both admins' approval).

**Request:**
```json
{
  "reason": "Grower unable to fulfill remaining tons",
  "approvedByBuyerAdmin": true,
  "approvedByGrowerAdmin": true
}
```

---

## Loads (Scale Entry)

### POST /loads
Create new load entry.

**Request:**
```json
{
  "poNumber": "PO-2024-042",
  "truckingCompanyName": "Red River Trucking",
  "driverName": "Mike Johnson",
  "truckId": "RR-4521",
  "grossWeight": 58420,
  "tareWeight": 33900,
  "totalBaleCount": 450,
  "wetBalesCount": 3,
  "moisturePercent": 12.5,
  "scaleLocationId": "uuid",
  "manualWeightEntry": false,
  "notes": "Good quality load"
}
```

**Response:**
```json
{
  "id": "uuid",
  "loadNumber": "LD-2024-00123",
  "netWeight": 24520,
  "netWeightTons": 12.26,
  "barnAssignment": {
    "barnId": "uuid",
    "barnName": "Barn #3",
    "satelliteImageUrl": "https://maps.googleapis.com/...",
    "drivingInstructions": "Exit scale, turn right. Follow road 0.3 miles...",
    "estimatedDriveTime": "2 minutes"
  },
  "isFlagged": false,
  "feedPadRedirect": false
}
```

### GET /loads
List loads with filtering.

**Query Parameters:**
- `poId`: Filter by PO
- `scaleLocationId`: Filter by scale
- `startDate`, `endDate`: Date range
- `status`: Load status

### GET /loads/:id
Get load details.

### PATCH /loads/:id
Edit load (managers can edit within 24 hours, admins always).

**Request:**
```json
{
  "moisturePercent": 13.0,
  "wetBalesCount": 4,
  "editReason": "Corrected moisture reading"
}
```

### GET /loads/:id/ticket
Generate printable load ticket (PDF).

---

## Barn Routing

### POST /barn-routing/assign
Assign barn to a load.

**Request:**
```json
{
  "poId": "uuid",
  "netWeightTons": 12.26,
  "wetBalesCount": 3,
  "productType": "Alfalfa"
}
```

**Response:**
```json
{
  "type": "barn",
  "destination": {
    "id": "uuid",
    "name": "Barn #3",
    "currentTons": 145.5,
    "capacityTons": 500,
    "satelliteImageUrl": "https://maps.googleapis.com/...",
    "drivingInstructions": "Exit scale, turn right..."
  }
}
```

If flagged:
```json
{
  "type": "feed_pad",
  "reason": "wet_bales_over_5",
  "destination": {
    "id": "uuid",
    "name": "Feed Pad #1",
    "satelliteImageUrl": "https://maps.googleapis.com/...",
    "drivingInstructions": "Exit scale, turn LEFT..."
  }
}
```

---

## Inventory

### GET /barns/:id/inventory
Get current inventory for a barn.

**Response:**
```json
{
  "barn": {
    "id": "uuid",
    "name": "Barn #3",
    "capacityTons": 500,
    "currentTons": 145.5,
    "capacityUsedPercent": 29.1
  },
  "recentTransactions": [
    {
      "id": "uuid",
      "transactionType": "inbound",
      "tons": 12.26,
      "balanceAfter": 145.5,
      "load": {
        "loadNumber": "LD-2024-00123",
        "poNumber": "PO-2024-042"
      },
      "createdAt": "2024-02-05T14:30:00Z"
    }
  ]
}
```

### GET /barns/:id/inventory/history
Get inventory transaction history with filtering.

---

## Invoices

### GET /invoices
List invoices.

**Query Parameters:**
- `paymentStatus`: PENDING, APPROVED, PROCESSING, COMPLETED, FAILED
- `buyerOrgId`, `growerOrgId`: Filter by organization
- `startDate`, `endDate`: Date range

**Response:**
```json
{
  "invoices": [
    {
      "id": "uuid",
      "invoiceNumber": "INV-2024-012",
      "po": {
        "id": "uuid",
        "poNumber": "PO-2024-042"
      },
      "growerOrg": {
        "id": "uuid",
        "name": "Smith Farms"
      },
      "totalTons": 50.5,
      "pricePerTon": 250.00,
      "totalAmount": 12625.00,
      "paymentStatus": "PENDING",
      "autoGenerated": true,
      "createdAt": "2024-02-05T10:00:00Z"
    }
  ]
}
```

### GET /invoices/:id
Get invoice details.

### POST /invoices/:id/approve
Approve invoice for payment (buyer admin only).

### POST /invoices/:id/send
Send invoice via email.

**Request:**
```json
{
  "emailTo": "billing@abc.com",
  "ccEmails": ["manager@abc.com"],
  "message": "Optional custom message"
}
```

### GET /invoices/:id/pdf
Download invoice as PDF.

---

## Disputes

### POST /disputes
Create new dispute.

**Request:**
```json
{
  "poId": "uuid",
  "loadId": "uuid",
  "disputeType": "short_load",
  "description": "Load was 2 tons short of expected weight",
  "proposedResolution": "Adjust payment accordingly"
}
```

### GET /disputes
List disputes.

### GET /disputes/:id
Get dispute details.

### POST /disputes/:id/resolve
Resolve dispute (requires both admins' approval).

**Request:**
```json
{
  "resolutionNotes": "Agreed to adjust payment by $500",
  "buyerAdminApproval": true,
  "growerAdminApproval": true
}
```

---

## Historical Data & Analytics

### GET /analytics/po-history
Get historical PO data with KPIs.

**Query Parameters:**
- `organizationId`: Required
- `year`: Filter by year
- `month`: Filter by month (1-12)
- `productType`: Filter by product
- `siteId`: Filter by site
- `vendorId`: Filter by vendor (for buyers)

**Response:**
```json
{
  "kpis": {
    "totalTons": 2450.5,
    "avgPricePerTon": 245.50,
    "priceRange": {
      "min": 220.00,
      "max": 275.00
    },
    "totalValue": 600250.00
  },
  "purchaseOrders": [
    {
      "id": "uuid",
      "poNumber": "PO-2024-042",
      "productType": "Alfalfa",
      "site": "North 40",
      "vendor": "Smith Farms",
      "tons": 500,
      "pricePerTon": 250.00,
      "status": "ACTIVE",
      "remainingTons": 450,
      "createdAt": "2024-01-15T10:00:00Z"
    }
  ]
}
```

### GET /analytics/delivery-trends
Get delivery trends over time.

### GET /analytics/price-trends
Get price trends by product type and time period.

---

## Trucking Companies & Drivers

### GET /trucking-companies
List trucking companies (autocomplete).

**Query Parameters:**
- `search`: Search by name
- `limit`: Max results (default 10)

### POST /trucking-companies
Create new trucking company.

### GET /drivers
List drivers (autocomplete).

**Query Parameters:**
- `truckingCompanyId`: Filter by company
- `search`: Search by name
- `limit`: Max results (default 10)

### POST /drivers
Create new driver.

---

## File Uploads

### POST /uploads/photo
Upload photo (for listings).

**Request:** multipart/form-data
- `file`: Image file (JPEG, PNG, max 10MB)

**Response:**
```json
{
  "fileUrl": "https://cdn.hayportal.com/photos/abc123.jpg"
}
```

### POST /uploads/document
Upload document (PDF, Excel, etc.).

**Request:** multipart/form-data
- `file`: Document file (PDF, XLSX, max 25MB)
- `documentType`: Type of document

**Response:**
```json
{
  "fileUrl": "https://cdn.hayportal.com/documents/lab-result-123.pdf"
}
```

---

## Scale Integration (Future)

### GET /scales/:id/status
Get current scale status and connection state.

### GET /scales/:id/current-weight
Get current weight reading from scale (real-time).

### POST /scales/:id/tare
Send tare command to scale.

### POST /scales/:id/capture
Capture stable weight from scale.

---

## Webhooks (Future)

### POST /webhooks/scale-reading
Receive weight data from scale (push model).

### POST /webhooks/invoice-paid
Receive payment confirmation from payment processor.

---

## Error Responses

All errors follow this format:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid PO number format",
    "details": {
      "field": "poNumber",
      "constraint": "Must match format PO-YYYY-NNN"
    }
  }
}
```

### Common Error Codes
- `UNAUTHORIZED`: Missing or invalid authentication
- `FORBIDDEN`: User lacks required permissions
- `NOT_FOUND`: Resource not found
- `VALIDATION_ERROR`: Request validation failed
- `CONFLICT`: Resource conflict (e.g., duplicate)
- `SCALE_OFFLINE`: Scale not responding
- `PO_CLOSED`: Cannot add loads to closed PO
- `INSUFFICIENT_PERMISSIONS`: User role lacks permission

---

## Rate Limiting

- **Authentication endpoints:** 10 requests per minute
- **Scale entry:** 60 requests per minute per scale
- **All other endpoints:** 100 requests per minute per user

Rate limit headers:
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 87
X-RateLimit-Reset: 1612345678
```

---

## Pagination

List endpoints support pagination:

**Query Parameters:**
- `page`: Page number (default 1)
- `limit`: Items per page (default 20, max 100)

**Response:**
```json
{
  "data": [...],
  "pagination": {
    "page": 1,
    "limit": 20,
    "totalPages": 5,
    "totalItems": 95
  }
}
```

---

## Offline Queue Sync

### POST /loads/batch
Submit multiple loads at once (for offline queue sync).

**Request:**
```json
{
  "loads": [
    {
      "poNumber": "PO-2024-042",
      "grossWeight": 58420,
      ...
    },
    {
      "poNumber": "PO-2024-043",
      "grossWeight": 59100,
      ...
    }
  ]
}
```

**Response:**
```json
{
  "successful": [
    {
      "loadNumber": "LD-2024-00123",
      ...
    }
  ],
  "failed": [
    {
      "error": "PO not found",
      "originalLoad": {...}
    }
  ]
}
```
