# Frontend Tracking Integration Guide

## Overview
Integrate the auto-tracking feature into the user/passenger app. Users will see their assigned route and active trip data automatically on app load.

---

## Phase 1: API Endpoints & Response Structure

### Endpoint: Get User's Active Trip, Route & Stops
```
GET /api/user/tracking/active-trip
Headers: Authorization: Bearer <user_token>
Response Status: 200 (or 400 if no route assigned)
```

**Single API call returns everything:**
- Route details (polyline, distance, ETA)
- All stops for the route (sorted by sequence)
- Active trip data (if running)
- Bus location & info
- Driver info
```json
{
  "success": true,
  "message": "Active trip found" | "No active trip at the moment" | "No route assigned to this user",
  "data": {
    "route": {
      "id": "6a1be2a6806e253e3d340987",
      "name": "srd-bvrit",
      "startName": "srd",
      "endName": "bvrit",
      "startLat": 17.589228110339473,
      "startLng": 78.08385921577023,
      "endLat": 17.72747797745772,
      "endLng": 78.25448117834576,
      "encodedPolyline": "wkjjBwvq{M...",
      "totalDistanceMeters": 30291,
      "estimatedDurationSeconds": 3204
    },
    "stops": [
      {
        "id": "stop_1",
        "name": "Main Station",
        "latitude": 17.589228,
        "longitude": 78.083859,
        "sequenceOrder": 1,
        "radiusMeters": 100
      },
      {
        "id": "stop_2",
        "name": "City Center",
        "latitude": 17.650000,
        "longitude": 78.150000,
        "sequenceOrder": 2,
        "radiusMeters": 100
      }
    ],
    "trip": {
      "id": "trip_id",
      "status": "RUNNING", // PENDING | STARTED | RUNNING | STOPPED | COMPLETED | CANCELLED
      "currentLat": 17.60,
      "currentLng": 78.10,
      "createdAt": "2026-05-31T10:00:00Z"
    },
    "bus": {
      "id": "bus_id",
      "numberPlate": "AP-12-XYZ-1234",
      "currentLat": 17.60,
      "currentLng": 78.10
    },
    "driver": {
      "id": "driver_id",
      "name": "John Doe",
      "phone": "+91-9876543210"
    }
  }
}
```

**Response Scenarios:**
1. **No route assigned** → status 400
   ```json
   {
     "success": false,
     "message": "No route assigned to this user",
     "data": { "route": null, "stops": null, "trip": null, "bus": null, "driver": null }
   }
   ```

2. **Route assigned, no active trip** → status 200
   ```json
   {
     "success": true,
     "message": "No active trip at the moment",
     "data": { "route": {...}, "stops": [...], "trip": null, "bus": null, "driver": null }
   }
   ```

3. **Active trip running** → status 200
   ```json
   {
     "success": true,
     "message": "Active trip found",
     "data": { "route": {...}, "stops": [...], "trip": {...}, "bus": {...}, "driver": {...} }
   }
   ```

---

## Phase 2: Frontend State Management

### Redux/Zustand Store Structure
```typescript
// Tracking State
{
  // Route Data
  route: {
    id: string;
    name: string;
    startName: string;
    endName: string;
    startLat: number;
    startLng: number;
    endLat: number;
    endLng: number;
    encodedPolyline: string;
    totalDistanceMeters: number;
    estimatedDurationSeconds: number;
  } | null;

  // Stops
  stops: Array<{
    id: string;
    name: string;
    latitude: number;
    longitude: number;
    sequenceOrder: number;
    radiusMeters: number;
  }> | null;

  // Trip Data (changes frequently)
  trip: {
    id: string;
    status: 'PENDING' | 'STARTED' | 'RUNNING' | 'STOPPED' | 'COMPLETED' | 'CANCELLED';
    currentLat: number;
    currentLng: number;
    createdAt: string;
  } | null;

  // Bus Data (changes with trip)
  bus: {
    id: string;
    numberPlate: string;
    currentLat: number;
    currentLng: number;
  } | null;

  // Driver Data
  driver: {
    id: string;
    name: string;
    phone: string;
  } | null;

  // UI State
  loading: boolean;
  error: string | null;
  hasRoute: boolean;
  hasActiveTrip: boolean;
}
```

---

## Phase 3: Component Architecture

### Main Tracking Screen Component
```
TrackingScreen/
├── useTrackingData()          // Hook: fetch & manage tracking state
├── MapContainer               // Show route polyline & bus/driver location
├── TripInfoCard               // Show trip status, driver info
├── StopsListPanel             // Show all stops in order
├── DriverCard                 // Show driver name, phone, rating
├── TripStatusBanner           // Show "Active Trip", "No Trip", etc.
└── ErrorFallback              // Show "No route assigned"
```

### Key Components:

**1. useTrackingData Hook**
```typescript
const useTrackingData = () => {
  const dispatch = useDispatch();
  const trackingState = useSelector(state => state.tracking);
  
  useEffect(() => {
    // 1. Call GET /api/user/tracking/active-trip
    // 2. If route exists and trip exists, load stops via GET /api/admin/routes/:routeId/stops
    // 3. Update Redux store
    // 4. Set up socket listener for live location (see Phase 5)
  }, []);

  return trackingState;
};
```

**2. MapContainer Component**
```typescript
// Use Google Maps / Mapbox / Leaflet
// Display:
// - Route polyline (from encodedPolyline)
// - Current bus location (trip.currentLat, trip.currentLng)
// - All stops as markers
// - User current location (optional)
// - Distance to next stop
```

**3. StopsListPanel Component**
```typescript
// Show stops in scrollable list
// Mark current stop (closest to bus)
// Show completed stops with checkmark
// Show upcoming stops
// Each stop shows: name, distance from bus
```

**4. TripStatusBanner Component**
```typescript
// Show trip status badge
// Color: RUNNING = green, PENDING = blue, STOPPED = gray
// Show ETA to destination
// Show total distance remaining
```

---

## Phase 4: Integration Flow

### On App Load (User Logs In)
```
1. User logs in → Get user token
2. Call GET /api/user/tracking/active-trip with token (ONE CALL GETS EVERYTHING)
3. Parse response:
   - If no route: Show "No route assigned" message
   - If route + no trip: Show route details + stops list, "Waiting for driver to start trip"
   - If route + active trip: 
     a. Load route on map
     b. Show stops list (already in response)
     c. Connect to Socket.io (see Phase 5)
4. Store all data in Redux
5. Render TrackingScreen component
```

### On Trip Status Change (Socket Event)
```
Listen for: trip_updated event
Update Redux: trip status, trip location
Refresh map marker position
```

---

## Phase 5: Socket.io Integration

### Join Trip Room
```typescript
// After getting active trip from endpoint
socket.emit('JOIN_TRIP_ROOM', {
  tripId: trip.id
});

// Listen for live location updates
socket.on('location_update', (data) => {
  // data: { tripId, latitude, longitude, timestamp }
  // Update Redux trip.currentLat/Lng
  // Update map marker in real-time
});

// Listen for trip status changes
socket.on('trip_status_changed', (data) => {
  // data: { tripId, status, message }
  // Update Redux trip.status
  // Show notification if status changed to COMPLETED/CANCELLED
});
```

### Leave Trip Room
```typescript
// On component unmount or when trip ends
socket.emit('LEAVE_TRIP_ROOM', {
  tripId: trip.id
});
```

---

## Phase 6: Error Handling

### Network Errors
```
GET /api/user/tracking/active-trip fails
→ Show retry button
→ Log error
→ Store error in Redux
```

### Validation Errors
```
Token invalid/expired
→ Redirect to login
→ Clear tracking data
```

### UI States
```
1. Loading: Show spinner while fetching
2. No Route: Show onboarding screen "Awaiting route assignment"
3. No Trip: Show route details, "Trip not started yet"
4. Active Trip: Show full tracking UI
5. Trip Ended: Show trip summary, "Trip completed"
6. Error: Show error banner with retry
```

---

## Phase 7: Checklist for Frontend

- [ ] Set up Redux/Zustand store structure
- [ ] Create useTrackingData hook
- [ ] Create TrackingScreen component
- [ ] Implement MapContainer (show route polyline)
- [ ] Implement StopsListPanel
- [ ] Implement TripStatusBanner
- [ ] Implement DriverCard
- [ ] Add Socket.io listeners (JOIN_TRIP_ROOM, location_update, trip_status_changed)
- [ ] Handle all 3 response scenarios (no route, no trip, active trip)
- [ ] Add error handling & retry logic
- [ ] Test with real trip data
- [ ] Optimize map performance (re-renders)
- [ ] Add geolocation permission handling (if showing user location)

---

## Phase 8: Testing Checklist

### Test Case 1: No Route Assigned
```
Prerequisites: User without route assignment
Expected: "No route assigned" message
```

### Test Case 2: Route Assigned, No Trip
```
Prerequisites: User with route, no active trip
Expected: Route shown, stops listed, "Waiting for trip" message
```

### Test Case 3: Active Trip with Live Updates
```
Prerequisites: Active trip running
Expected:
1. Route + stops + trip displayed
2. Driver location updates in real-time via socket
3. Trip status updates when trip ends
```

### Test Case 4: Socket Disconnection
```
Prerequisites: Active trip, then disconnect socket
Expected: Show "Connection lost" message, retry button
```

### Test Case 5: Switch Routes
```
Prerequisites: Log out and log in with different user
Expected: Old route/trip cleared, new route loaded
```

---

## API Reference Summary

| Endpoint | Method | Auth | Purpose |
|----------|--------|------|---------|
| `/api/user/tracking/active-trip` | GET | User Token | Get route + stops + trip + bus + driver (ONE CALL) |
| Socket: `JOIN_TRIP_ROOM` | Event | User Token | Subscribe to live trip updates |
| Socket: `location_update` | Event | - | Receive live bus location |
| Socket: `trip_status_changed` | Event | - | Receive trip status updates |

---

## Notes

- ✅ **Single API call** - Get route, stops, trip, bus, driver all in one response
- Stops are sorted by `sequenceOrder` (ascending order along the route)
- Polyline is encoded using Google's polyline algorithm - use library to decode
- All coordinates are in format: latitude, longitude
- Trip status flow: PENDING → STARTED → RUNNING → STOPPED → COMPLETED/CANCELLED
- Socket events broadcast to all users in trip room, not just driver
- When user has no route assigned: response status is 400, but data structure still includes `stops: null`
- When route exists but no trip: stops are returned, trip/bus/driver are null
