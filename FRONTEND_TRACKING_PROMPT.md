You are a frontend developer integrating the auto-tracking feature for passengers in the where-you-are app. Your task is to build a real-time tracking screen that shows the user's assigned route, active trip, bus location, driver info, and all stops along the way.

## Current State
- Backend endpoint ready: `GET /api/user/tracking/active-trip`
- Returns: route, **stops**, trip, bus, driver data (all in ONE call)
- Socket.io integration: Live location updates via `JOIN_TRIP_ROOM` event
- No separate stops endpoint needed - everything comes in single response

## What You Need to Build

### 1. useTrackingData hook
- Fetches user's active trip + route + stops on mount
- Handles 3 scenarios: no route / route without trip / active trip
- Manages loading, error states
- Returns: { route, stops, trip, bus, driver, loading, error, hasRoute, hasActiveTrip }

### 2. Main Tracking Screen Component
Build `TrackingScreen` component with:
- MapContainer: Display route polyline + bus marker + stop markers
- StopsListPanel: Scrollable list of stops with status (completed/current/upcoming)
- TripStatusBanner: Shows trip status, ETA to destination
- DriverCard: Driver name, phone, rating
- ErrorFallback: When no route assigned

### 3. Socket Integration
Set up real-time updates:
- Emit `JOIN_TRIP_ROOM` when active trip loads
- Listen for `location_update` events (bus location changes)
- Listen for `trip_status_changed` events (trip ends/status changes)
- Update map in real-time when driver moves

### 4. State Management
Store in Redux/Zustand:
- route (static until logout)
- stops (static until route changes)
- trip (updates via socket - currentLat, currentLng, status)
- bus (updates via socket - currentLat, currentLng)
- driver (static)
- ui state (loading, error, selectedStop)

### 5. Error Handling
Handle scenarios:
- Token expired → redirect to login
- Network error → show retry button
- Socket disconnected → show "Connection lost"
- Trip completed/cancelled → show trip summary

## Implementation Order (Do This First → Last)

### Step 1: API Integration
[ ] Set up API client/axios service
[ ] Create function to call `GET /api/user/tracking/active-trip`
[ ] Create function to call `GET /api/admin/routes/:routeId/stops`
[ ] Test responses in isolation

### Step 2: State Management
[ ] Create Redux/Zustand store with TrackingState interface
[ ] Implement reducers/actions for: setRoute, setTrip, setStops, setLoading, setError
[ ] Create selectors: selectRoute, selectActiveTrip, selectStops, selectHasRoute

### Step 3: useTrackingData Hook
[ ] Fetch active trip data on mount
[ ] Parse response - handle null values
[ ] If trip exists, fetch stops for that route
[ ] Dispatch to Redux
[ ] Return tracking state + functions (refetch, clearData)

### Step 4: Socket Setup
[ ] Connect to Socket.io server in hook
[ ] On trip load, emit `JOIN_TRIP_ROOM` with tripId
[ ] Listen for `location_update` → update Redux trip.currentLat/Lng
[ ] Listen for `trip_status_changed` → update Redux trip.status, show notification
[ ] On unmount, emit `LEAVE_TRIP_ROOM`

### Step 5: Map Component
[ ] Set up Google Maps / Mapbox / Leaflet
[ ] Decode polyline from encodedPolyline string
[ ] Display route as polyline on map
[ ] Show bus current location as animated marker
[ ] Show all stops as markers with labels
[ ] Highlight current stop (closest to bus)
[ ] Add click handlers for stop details

### Step 6: Stops List Component
[ ] Display all stops in order
[ ] Mark stops as: completed (✓), current (→), upcoming (○)
[ ] Show distance from bus to each stop
[ ] Show estimated arrival time at each stop
[ ] Add scroll to current stop on load
[ ] Add click to center map on stop

### Step 7: Trip Status & Driver Card
[ ] Show trip status badge (color: RUNNING=green, PENDING=blue, STOPPED=gray)
[ ] Show ETA to destination
[ ] Show total distance remaining
[ ] Show driver name, phone, rating
[ ] Add call/message buttons (if available in app)

### Step 8: Error States & Loading
[ ] Show loading skeleton on initial load
[ ] Show "No route assigned" when status 400
[ ] Show "Waiting for driver to start trip" when trip is null
[ ] Show error toast when API fails
[ ] Add retry button on error

### Step 9: Responsive Design
[ ] Test on mobile screen sizes
[ ] Ensure map is touch-friendly
[ ] Test on tablet
[ ] Optimize re-renders (memoization)

### Step 10: Testing & Polish
[ ] Test scenario: No route assigned
[ ] Test scenario: Route assigned, no trip
[ ] Test scenario: Active trip with live updates
[ ] Test scenario: Trip completion
[ ] Test scenario: Socket disconnect/reconnect
[ ] Test with slow network (3G)
[ ] Performance profiling (re-renders)

## Key Code Patterns

### useTrackingData Hook Pattern
```typescript
export const useTrackingData = () => {
  const dispatch = useDispatch();
  const { route, stops, trip, bus, driver, loading, error } = useSelector(selectTracking);
  
  useEffect(() => {
    const fetchTrackingData = async () => {
      try {
        dispatch(setLoading(true));
        const response = await api.get('/api/user/tracking/active-trip');
        
        // Handle response scenarios - all data comes in ONE response
        if (!response.data.data.route) {
          // No route assigned
          dispatch(setError('No route assigned'));
          return;
        }
        
        // Load route, stops, and trip (if exists)
        dispatch(setRoute(response.data.data.route));
        dispatch(setStops(response.data.data.stops)); // Stops already in response
        dispatch(setTrip(response.data.data.trip));
        dispatch(setBus(response.data.data.bus));
        dispatch(setDriver(response.data.data.driver));
        
        // If active trip exists, join trip room via socket
        if (response.data.data.trip) {
          socket.emit('JOIN_TRIP_ROOM', { tripId: response.data.data.trip.id });
        }
      } catch (err) {
        dispatch(setError(err.message));
      } finally {
        dispatch(setLoading(false));
      }
    };

    fetchTrackingData();
    
    return () => {
      // Cleanup on unmount
      if (trip) {
        socket.emit('LEAVE_TRIP_ROOM', { tripId: trip.id });
      }
    };
  }, []);

  return { route, stops, trip, bus, driver, loading, error, hasRoute: !!route };
};
```

### Socket Listener Pattern
```typescript
useEffect(() => {
  socket.on('location_update', (data) => {
    dispatch(updateTripLocation(data)); // { lat, lng }
  });

  socket.on('trip_status_changed', (data) => {
    dispatch(updateTripStatus(data)); // { status, message }
    if (data.status === 'COMPLETED' || data.status === 'CANCELLED') {
      showNotification(`Trip ${data.status}`);
    }
  });

  return () => {
    socket.off('location_update');
    socket.off('trip_status_changed');
  };
}, []);
```

## API Response Examples You'll Get

### Scenario 1: No Route
```json
{
  "success": false,
  "message": "No route assigned to this user",
  "data": { "route": null, "stops": null, "trip": null, "bus": null, "driver": null }
}
```

### Scenario 2: Route + No Trip
```json
{
  "success": true,
  "message": "No active trip at the moment",
  "data": {
    "route": { "id": "...", "name": "srd-bvrit", "encodedPolyline": "..." },
    "stops": [
      { "id": "...", "name": "Stop A", "latitude": 17.58, "longitude": 78.08, "sequenceOrder": 1, "radiusMeters": 100 },
      { "id": "...", "name": "Stop B", "latitude": 17.60, "longitude": 78.10, "sequenceOrder": 2, "radiusMeters": 100 }
    ],
    "trip": null,
    "bus": null,
    "driver": null
  }
}
```

### Scenario 3: Active Trip
```json
{
  "success": true,
  "message": "Active trip found",
  "data": {
    "route": { ... },
    "stops": [ ... ],
    "trip": { "id": "...", "status": "RUNNING", "currentLat": 17.60, "currentLng": 78.10 },
    "bus": { "id": "...", "numberPlate": "AP-12-XYZ", "currentLat": 17.60, "currentLng": 78.10 },
    "driver": { "id": "...", "name": "John", "phone": "..." }
  }
}
```

## Polyline Decoding
Use `google-map-react` or `polyline` library:
```typescript
import polyline from 'polyline-encoded';
const coordinates = polyline.decode(encodedPolyline); // [[lat, lng], ...]
```

## Useful Libraries
- Maps: `google-maps-react`, `react-leaflet`, `mapbox-gl`
- State: `redux-toolkit`, `zustand`
- Socket: `socket.io-client` (already configured in backend)
- API: `axios`
- Geolocation: `geolocation-api`
- Distance: `geolib`

## Important Notes
- ✅ **ONE API call** gets everything: route + stops + trip + bus + driver
- Stops are already sorted by `sequenceOrder` (1, 2, 3...)
- `trip.currentLat/Lng` = bus location (driver sends real-time updates)
- Polyline is route path (start → end), not necessarily current trip path
- Stops are populated before trip exists (user can see all stops even if no active trip)
- Socket will only work if trip is in PENDING/STARTED/RUNNING state
- When trip status changes to COMPLETED/CANCELLED, stop listening to events

## Testing Data
- Route: srd-bvrit (Hyderabad)
- Stops: 2+ stops already in the route (returned in response)
- Test with real driver sending location updates
- Watch map update in real-time with driver location
- See stops populate immediately on app load