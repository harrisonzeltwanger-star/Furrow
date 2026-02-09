# SCALE INTEGRATION GUIDE

This document explains how to integrate physical scale hardware with the Hay Portal once you're ready to move from manual entry to automatic weight capture.

---

## Overview

The system uses a **Scale Provider abstraction layer** that allows you to plug in any scale integration without changing application code. See `/backend/src/services/scaleService/IScaleProvider.ts` for the interface.

---

## Integration Options

### Option 1: Serial-to-WiFi Adapter (RECOMMENDED)

**Best for:** Scales with RS-232/RS-485 serial output

**Hardware Required:**
- Moxa NPort 5110 (~$250) OR
- Lantronix XPort (~$200) OR  
- Digi One IAP (~$280)

**Setup:**
1. Connect adapter to scale's serial port (usually DB9 connector)
2. Configure adapter to connect to your WiFi network
3. Set adapter to TCP Server mode on port 8080
4. Update scale configuration in database:

```sql
UPDATE scale_locations
SET connection_type = 'WEBSOCKET',
    connection_endpoint = 'ws://192.168.1.100:8080'
WHERE id = 'your-scale-id';
```

5. System will automatically use `WebSocketScaleProvider`

**Pros:**
- Works with most industrial scales
- Reliable, wired connection to scale
- WiFi flexibility for iPad placement
- No scale manufacturer cooperation needed

**Cons:**
- Requires power outlet for adapter
- Initial WiFi configuration needed

---

### Option 2: Bluetooth Scale Module

**Best for:** Scales in remote locations without WiFi

**Hardware Required:**
- Cardinal Scale CPWE Bluetooth Module (~$400) OR
- Rice Lake iRite Bluetooth Indicator (~$500) OR
- Generic HC-05 Bluetooth module (~$50, requires custom wiring)

**Setup:**
1. Install Bluetooth module on scale
2. Pair iPad with module (Settings > Bluetooth)
3. Note device MAC address
4. Update scale configuration:

```sql
UPDATE scale_locations
SET connection_type = 'BLUETOOTH',
    connection_endpoint = '00:11:22:33:44:55' -- MAC address
WHERE id = 'your-scale-id';
```

5. System will use `BluetoothScaleProvider`

**Pros:**
- No WiFi required
- Direct iPad connection
- Works in remote locations

**Cons:**
- Limited range (~30 feet)
- iPad must be near scale
- More expensive hardware

---

### Option 3: Scale with REST API

**Best for:** Modern digital scales with built-in networking

**Compatible Scales:**
- Rice Lake 920i (with Ethernet option)
- Mettler Toledo IND780
- Avery Weigh-Tronix ZM510

**Setup:**
1. Enable scale's HTTP server (consult scale manual)
2. Configure static IP on scale
3. Test API: `curl http://192.168.1.50/api/weight`
4. Update configuration:

```sql
UPDATE scale_locations
SET connection_type = 'API',
    connection_endpoint = 'http://192.168.1.50/api'
WHERE id = 'your-scale-id';
```

5. System will use `APIScaleProvider`

**Pros:**
- Native networking support
- Most reliable option
- Can support multiple clients

**Cons:**
- Scale must support API
- More expensive scales
- Requires network configuration

---

### Option 4: Direct Serial Connection (Desktop Only)

**Best for:** Desktop PCs at scale (not iPads)

**Hardware Required:**
- USB-to-Serial adapter (~$20)

**Setup:**
1. Connect scale to PC via serial cable
2. Install serial drivers
3. Update configuration:

```sql
UPDATE scale_locations
SET connection_type = 'SERIAL',
    connection_endpoint = 'COM3' -- or /dev/ttyUSB0 on Linux
WHERE id = 'your-scale-id';
```

4. Requires Node.js backend with `serialport` package

**Pros:**
- Cheapest option
- Direct connection
- Very reliable

**Cons:**
- Only works on desktop (not iPads)
- Tied to one computer
- Less flexible

---

## Scale Communication Protocols

Most scales use one of these protocols:

### Toledo Protocol (Most Common)
```
Format: GS,+058420,lb\r\n
         ^   ^      ^
         |   |      └─ Unit (lb or kg)
         |   └─────── Weight value
         └──────────── Status (GS=Gross Stable, GU=Gross Unstable, NT=Net)

Commands:
- W: Get weight
- Z: Zero/Tare
- P: Print ticket
```

### Cardinal Protocol
```
Format: w 058420 lb\r\n
Commands similar to Toledo
```

### Fairbanks Protocol
```
Format: +058420LB\r\n
No commands, continuous stream
```

### SICS Protocol (Mettler Toledo)
```
Format: S S 24520.0 kg\r\n
         ^ ^    ^     ^
         | |    |     └─ Unit
         | |    └─────── Weight
         | └────────── Stable flag
         └──────────── Command echo
```

---

## Implementation Steps

### Step 1: Determine Your Scale Model

Run this at your scale:
```bash
# Linux/Mac
cat /dev/ttyUSB0

# Windows (use PuTTY or similar)
# Connect to COM port at 9600 baud, 8N1
```

Watch the output. You should see something like:
```
GS,+000000,lb
GU,+000123,lb
GU,+058420,lb
GS,+058420,lb
```

This tells you:
- Protocol: Toledo
- Baud rate: 9600 (most common)
- Data format: ASCII text

### Step 2: Choose Integration Method

Based on your situation:
- **Have WiFi? Good budget?** → Serial-to-WiFi adapter
- **No WiFi? Remote location?** → Bluetooth module
- **Modern scale? Large operation?** → API integration
- **Desktop PC? Tight budget?** → Direct serial

### Step 3: Order Hardware

See hardware recommendations above.

### Step 4: Update Backend Code

The abstraction layer is already in place! You just need to:

1. Uncomment the provider in `scaleService/WebSocketProvider.ts`
2. Implement protocol parsing (see examples below)
3. Test with your hardware

### Step 5: Test Integration

Use the test harness:

```typescript
// test-scale.ts

import { ScaleProviderFactory, ScaleProviderConfig } from './scaleService';

const config: ScaleProviderConfig = {
  type: 'websocket',
  scaleId: 'test-scale',
  websocket: {
    endpoint: 'ws://192.168.1.100:8080'
  }
};

const scale = ScaleProviderFactory.create(config);

async function test() {
  await scale.connect();
  
  console.log('Status:', scale.getStatus());
  
  // Subscribe to weight updates
  scale.onWeightUpdate((reading) => {
    console.log(`Weight: ${reading.weight} ${reading.unit}, Stable: ${reading.stable}`);
  });
  
  // Capture stable weight
  console.log('Waiting for stable weight...');
  const weight = await scale.captureStableWeight();
  console.log('Captured:', weight);
  
  await scale.disconnect();
}

test();
```

---

## Protocol Parser Examples

### Toledo Protocol Parser

```typescript
private parseScaleData(data: string): WeightReading | null {
  // Format: GS,+058420,lb\r\n
  const match = data.match(/([GNT][SU]),([+-]\d+),(lb|kg)/i);
  
  if (!match) return null;

  const [_, status, weightStr, unit] = match;
  const stable = status.endsWith('S'); // GS, NS, TS = stable
  const weight = parseInt(weightStr);

  return {
    weight,
    unit: unit.toLowerCase() as 'lbs' | 'kg',
    stable,
    timestamp: new Date(),
    scaleId: this.config.scaleId
  };
}
```

### Cardinal Protocol Parser

```typescript
private parseScaleData(data: string): WeightReading | null {
  // Format: w 058420 lb\r\n or W 058420 lb\r\n (capital = stable)
  const match = data.match(/([wW])\s+(\d+)\s+(lb|kg)/i);
  
  if (!match) return null;

  const [_, status, weightStr, unit] = match;
  const stable = status === 'W'; // Capital W = stable
  const weight = parseInt(weightStr);

  return {
    weight,
    unit: unit.toLowerCase() as 'lbs' | 'kg',
    stable,
    timestamp: new Date(),
    scaleId: this.config.scaleId
  };
}
```

### SICS Protocol Parser (Mettler Toledo)

```typescript
private parseScaleData(data: string): WeightReading | null {
  // Format: S S 24520.0 kg\r\n
  const match = data.match(/S\s+([SD])\s+([\d.]+)\s+(kg|lb)/i);
  
  if (!match) return null;

  const [_, status, weightStr, unit] = match;
  const stable = status === 'S'; // S = stable, D = dynamic
  const weight = parseFloat(weightStr);

  return {
    weight,
    unit: unit.toLowerCase() as 'lbs' | 'kg',
    stable,
    timestamp: new Date(),
    scaleId: this.config.scaleId
  };
}
```

---

## Hardware Wiring Guides

### RS-232 Serial Connection

Most scales use DB9 connector:

```
Scale (DB9 Female)    Adapter (DB9 Male)
Pin 2 (TX) ────────── Pin 2 (RX)
Pin 3 (RX) ────────── Pin 3 (TX)
Pin 5 (GND) ───────── Pin 5 (GND)
```

**Settings:**
- Baud Rate: 9600 (sometimes 4800 or 19200)
- Data Bits: 8 (sometimes 7)
- Stop Bits: 1
- Parity: None (sometimes Even)
- Flow Control: None

### RS-485 Connection

Some scales use RS-485 (2-wire):

```
Scale            Adapter
A/+ ──────────── A/+
B/- ──────────── B/-
GND ──────────── GND
```

Configure adapter for RS-485 mode (consult adapter manual).

---

## Troubleshooting

### No Data Received

1. **Check baud rate:** Most scales are 9600, try 4800 or 19200
2. **Check wiring:** TX/RX might be swapped
3. **Check scale output mode:** Enable continuous output mode on scale
4. **Check scale power:** Some scales have separate power for serial output

### Garbled Data

1. **Wrong baud rate:** Try different rates
2. **Wrong parity/data bits:** Try 7E1 (7 data, even parity, 1 stop)
3. **Cable too long:** RS-232 limited to ~50 feet

### Weight Not Stabilizing

1. **Increase stability threshold:** Default is 3 seconds, try 5
2. **Check scale calibration:** Scale may need calibration
3. **Environmental factors:** Wind, vibration, uneven ground

### Connection Drops

1. **Check WiFi signal:** Move adapter or add access point
2. **Check power:** Ensure stable power supply
3. **Update firmware:** Check for adapter firmware updates

---

## Testing Without Hardware

During development, use the ManualEntryProvider:

```typescript
const config: ScaleProviderConfig = {
  type: 'manual',
  scaleId: 'test-scale',
  manualEntry: {
    requireConfirmation: true,
    defaultUnit: 'lbs'
  }
};

const scale = ScaleProviderFactory.create(config);

// Simulate weight entry in UI
(scale as ManualEntryProvider).setManualWeight(58420, 'lbs');
```

This is what the system uses **right now** - it's already built and working!

---

## Cost Estimates

### Budget Setup (~$250)
- Generic serial-to-WiFi adapter: $150
- Installation: DIY
- **Total: $150-250**

### Standard Setup (~$500)
- Name-brand serial-to-WiFi (Moxa): $250
- Professional installation: $200
- **Total: $450-500**

### Premium Setup (~$1,500)
- Bluetooth scale module: $500
- Professional installation: $300
- Multiple iPads: $700
- **Total: $1,500**

### Enterprise Setup (~$3,000+)
- Scale with native API: $2,000
- Network configuration: $500
- Multiple locations: varies
- **Total: $2,500+**

---

## Recommendation for Your Setup

Based on typical feedlot operations:

**Phase 1 (Now):** Manual entry with tablet
- Cost: $0 (built-in)
- Time to deploy: Immediate

**Phase 2 (3-6 months):** Add serial-to-WiFi adapters
- Cost: $200-300 per scale
- Time to deploy: 1-2 days per scale
- Use `WebSocketScaleProvider`

**Phase 3 (Optional):** Bluetooth for remote scales
- Cost: $400-500 per remote scale
- Use `BluetoothScaleProvider`

---

## Next Steps

When you're ready to integrate scales:

1. **Identify scale model** - Check manufacturer plate
2. **Test scale output** - Connect laptop, see what data looks like
3. **Order hardware** - Based on findings above
4. **Contact us** - We'll help with implementation

The code is **already built to support this** - you just need to:
- Choose hardware
- Update database configuration
- Test!

No application code changes required! 🎉
