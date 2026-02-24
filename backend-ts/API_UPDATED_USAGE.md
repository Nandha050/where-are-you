# Updated Bus Assignment APIs

## Changes Summary
- **Driver Assignment**: Now uses `memberId` instead of `driverId`
- **Route Assignment**: Now uses `routeName` instead of `routeId`

---

## Assign Driver to Bus

**Endpoint:** `PUT /api/buses/:busId/driver`

**Auth Required:** Yes (Admin only)

**Previous Request Body:**
```json
{
  "driverId": "699c5e5d194c60d83f155462"
}
```

**New Request Body:**
```json
{
  "memberId": "D2002"
}
```

**Response:**
```json
{
  "bus": {
    "id": "699c82fd3ababdd7d2502190",
    "numberPlate": "ABC123",
    "driverId": "699c5e5d194c60d83f155462",
    "driverMemberId": "D2002",
    "driverName": "John Doe",
    "status": "inactive"
  }
}
```

**Example cURL:**
```bash
curl -X PUT http://localhost:3000/api/buses/699c82fd3ababdd7d2502190/driver \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"memberId":"D2002"}'
```

---

## Assign Route to Bus

**Endpoint:** `PUT /api/buses/:busId/route`

**Auth Required:** Yes (Admin only)

**Previous Request Body:**
```json
{
  "routeId": "699c9b849386a3c2d14fb35e"
}
```

**New Request Body:**
```json
{
  "routeName": "Route 1"
}
```

**Response:**
```json
{
  "bus": {
    "id": "699c82fd3ababdd7d2502190",
    "numberPlate": "ABC123",
    "routeId": "699c9b849386a3c2d14fb35e",
    "routeName": "Route 1",
    "status": "inactive",
    "trackingStatus": "idle"
  }
}
```

**Example cURL:**
```bash
curl -X PUT http://localhost:3000/api/buses/699c82fd3ababdd7d2502190/route \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"routeName":"Route 1"}'
```

---

## Error Responses

### Driver Not Found
```json
{
  "message": "Driver with memberId 'D2002' not found"
}
```
**Status Code:** 400

### Route Not Found
```json
{
  "message": "Route with name 'Non-Existent Route' not found"
}
```
**Status Code:** 404

### Bus Not Found
```json
{
  "message": "Bus not found"
}
```
**Status Code:** 404

### Missing Field
```json
{
  "message": "memberId is required"
}
```
or
```json
{
  "message": "routeName is required"
}
```
**Status Code:** 400

---

## Notes

1. **Driver `memberId`** is unique per organization and created when admin creates a driver (e.g., "D2002", "D1001")
2. **Route `name`** is unique per organization and set when admin creates a route
3. Both endpoints automatically handle:
   - Removing previous driver assignment
   - Updating bidirectional relationships (Driver.assignedBusId ↔ Bus.driverId)
   - Organization-scoped lookups (no cross-org assignments)
4. Names and IDs are case-sensitive
5. Whitespace is automatically trimmed from input
