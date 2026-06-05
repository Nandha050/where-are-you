# Frontend Tracking Integration

This file is the single frontend reference for integrating passenger tracking UI with the backend.

## What the backend gives you

Use one bootstrap request on screen load:

`GET /api/user/tracking/active-trip`

Headers:

`Authorization: Bearer <user_token>`

The response already includes everything needed for the tracking screen:

- route
- stops
- trip
- bus
- driver

### Response shapes

No route assigned:

```json
{
  "success": false,
  "message": "No route assigned to this user",
  "data": {
    "route": null,
    "stops": null,
    "trip": null,
    "bus": null,
    "driver": null
  }
}
```

Route exists, no active trip:

```json
{
  "success": true,
  "message": "No active trip at the moment",
  "data": {
    "route": { "id": "...", "name": "...", "encodedPolyline": "..." },
    "stops": [
      { "id": "...", "name": "Stop A", "latitude": 17.58, "longitude": 78.08, "sequenceOrder": 1, "radiusMeters": 100 }
    ],
    "trip": null,
    "bus": null,
    "driver": null
  }
}
```

Active trip running:

```json
{
  "success": true,
  "message": "Active trip found",
  "data": {
    "route": { "id": "...", "name": "...", "encodedPolyline": "..." },
    "stops": [ ... ],
    "trip": { "id": "...", "status": "RUNNING", "startedAt": "..." },
    "bus": { "id": "...", "numberPlate": "AP-12-XYZ-1234" },
    "driver": { "id": "...", "name": "John Doe", "phone": "+91-9876543210" }
  }
}
```

## Frontend flow

1. User logs in and opens the tracking screen.
2. Call `GET /api/user/tracking/active-trip` once.
3. If `route` is null, show “No route assigned”.
4. If `route` exists and `trip` is null, show route + stops + “Waiting for driver to start trip”.
5. If `trip` exists, render the full map and connect realtime sockets.
6. Keep route/stops/driver static in state, and update trip/bus coordinates live.

## State model

Use Redux, Zustand, or local component state with this shape:

```typescript
type TrackingState = {
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
  stops: Array<{
    id: string;
    name: string;
    latitude: number;
    longitude: number;
    sequenceOrder: number;
    radiusMeters: number;
  }> | null;
  trip: {
    id: string;
    status: 'PENDING' | 'STARTED' | 'RUNNING' | 'STOPPED' | 'COMPLETED' | 'CANCELLED';
    startedAt: string | null;
    currentLocation?: { latitude: number; longitude: number } | null;
  } | null;
  bus: {
    id: string;
    numberPlate: string;
    status?: string | null;
  } | null;
  driver: {
    id: string;
    name: string;
    phone: string | null;
  } | null;
  loading: boolean;
  error: string | null;
};
```

## Socket contract

Use the actual backend event names from the codebase:

- `joinTrip` to subscribe to a trip room
- `busLocationUpdate` to receive live movement
- `joinBusRoom` and `joinRoute` also exist, but for this screen you usually need `joinTrip`

Important backend detail:

- There is no `LEAVE_TRIP_ROOM` handler on the backend right now.
- On unmount, just remove listeners and disconnect the socket if you own the connection.

### Recommended client flow

```typescript
socket.emit('joinTrip', trip.id);

socket.on('busLocationUpdate', (payload) => {
  // payload shape depends on broadcaster, but you should at least expect:
  // { tripId, busId, lat, lng, currentLat, currentLng, timestamp, status }
  // Update trip/bus coordinates in state.
});
```

## Hook structure

Create one hook that owns the bootstrap fetch and socket subscription:

```typescript
export function useTrackingData() {
  // 1. fetch /api/user/tracking/active-trip on mount
  // 2. store route/stops/trip/bus/driver
  // 3. if trip exists, connect socket and emit joinTrip
  // 4. listen for busLocationUpdate and update live coordinates
  // 5. clean up listeners on unmount
}
```

Suggested behavior:

- Keep the first fetch separate from realtime updates.
- Only open the socket when `trip.id` exists.
- If the trip changes, re-join with the new trip id.
- When status becomes `COMPLETED` or `CANCELLED`, stop updating the live map marker.

## UI mapping

Your existing screens can map directly to these states:

- Loading state: show skeleton or spinner.
- No route state: show onboarding/assignment screen.
- Route but no trip: show route, stops, and waiting banner.
- Active trip: show map, trip banner, driver card, and stops list.
- Error state: show retry button and preserve old state only if it is still valid.

### Components you can wire up

- `TrackingScreen`
- `MapContainer`
- `StopsListPanel`
- `TripStatusBanner`
- `DriverCard`
- `ErrorFallback`

## Implementation notes

- The backend already returns sorted stops, so do not refetch stops separately for this flow.
- Decode `route.encodedPolyline` with a polyline library before drawing the map line.
- Use `trip.currentLocation` or the live socket coordinates as the map marker source.
- Treat route and stops as mostly static until the user logs out or changes assignment.
- Keep trip and bus coordinates in a fast-updating slice so the map can re-render without resetting the whole screen.

## Minimal integration checklist

- Fetch `/api/user/tracking/active-trip` on screen load.
- Handle the three response cases: no route, no trip, active trip.
- Join the socket room with `joinTrip` when a trip exists.
- Listen for `busLocationUpdate` and update the marker in realtime.
- Clean up listeners when the screen unmounts.
- Show the correct UI state for loading, error, inactive, and active trip modes.

## File references in backend

- Endpoint: [backend-ts/src/modules/user/user.app.routes.ts](backend-ts/src/modules/user/user.app.routes.ts#L12)
- Controller: [backend-ts/src/modules/user/user.app.controller.ts](backend-ts/src/modules/user/user.app.controller.ts#L152)
- Tracking response builder: [backend-ts/src/modules/user/user.service.ts](backend-ts/src/modules/user/user.service.ts#L487)
- Socket events: [backend-ts/src/modules/tracking/tracking.events.ts](backend-ts/src/modules/tracking/tracking.events.ts#L1)
- Socket handlers: [backend-ts/src/websocket/socket.handlers.ts](backend-ts/src/websocket/socket.handlers.ts#L1)
