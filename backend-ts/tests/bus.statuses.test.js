const test = require('node:test');
const assert = require('node:assert/strict');

const {
    FLEET_STATUS,
    TRIP_STATUS,
    LEGACY_BUS_STATUS,
} = require('../src/constants/busStatus');
const { TRACKING_STATUS } = require('../src/constants/trackingStatus');
const {
    deriveBusStatuses,
    assertValidTripStatusTransition,
} = require('../src/modules/bus/bus.status.service');
const { busService } = require('../src/modules/bus/bus.service');
const { trackingService } = require('../src/modules/tracking/tracking.service');
const { Bus } = require('../src/modules/bus/bus.model');
const { Route } = require('../src/modules/route/route.model');
const { LocationLog } = require('../src/modules/locationLog/locationLog.model');
const {
    notificationService,
} = require('../src/modules/notification/notification.service');

const cloneDate = (value) => new Date(value.getTime());

const withPatchedMethod = async (obj, methodName, replacement, run) => {
    const original = obj[methodName];
    obj[methodName] = replacement;
    try {
        await run();
    } finally {
        obj[methodName] = original;
    }
};

const withPatchedMethods = async (patches, run) => {
    const originals = patches.map((patch) => ({
        obj: patch.obj,
        methodName: patch.methodName,
        original: patch.obj[patch.methodName],
    }));

    for (const patch of patches) {
        patch.obj[patch.methodName] = patch.replacement;
    }

    try {
        await run();
    } finally {
        for (const original of originals) {
            original.obj[original.methodName] = original.original;
        }
    }
};

const createPopulateChain = (result, remainingPopulates) => {
    if (remainingPopulates <= 0) {
        return Promise.resolve(result);
    }

    return {
        populate: () => createPopulateChain(result, remainingPopulates - 1),
    };
};

test('deriveBusStatuses returns NOT_SCHEDULED and NO_SIGNAL defaults for missing route/telemetry', () => {
    const statuses = deriveBusStatuses(
        {
            status: LEGACY_BUS_STATUS.ACTIVE,
            currentLat: undefined,
            currentLng: undefined,
            lastUpdated: undefined,
        },
        { isAssigned: false },
        undefined,
        undefined,
        new Date('2026-03-16T10:00:00.000Z')
    );

    assert.equal(statuses.fleetStatus, FLEET_STATUS.IN_SERVICE);
    assert.equal(statuses.tripStatus, TRIP_STATUS.NOT_SCHEDULED);
    assert.equal(statuses.trackingStatus, TRACKING_STATUS.NO_SIGNAL);
    assert.equal(statuses.status, LEGACY_BUS_STATUS.ACTIVE);
});

test('deriveBusStatuses maps maintenance to MAINTENANCE_HOLD', () => {
    const statuses = deriveBusStatuses({
        maintenanceMode: true,
        status: LEGACY_BUS_STATUS.ACTIVE,
    });

    assert.equal(statuses.fleetStatus, FLEET_STATUS.MAINTENANCE);
    assert.equal(statuses.tripStatus, TRIP_STATUS.MAINTENANCE_HOLD);
});

test('deriveBusStatuses maps active trip delay and telemetry speed', () => {
    const now = new Date('2026-03-16T10:00:00.000Z');

    const statuses = deriveBusStatuses(
        {
            status: LEGACY_BUS_STATUS.ACTIVE,
            currentLat: 17.51,
            currentLng: 78.23,
            lastUpdated: cloneDate(now),
        },
        { isAssigned: true },
        {
            latitude: 17.51,
            longitude: 78.23,
            timestamp: cloneDate(now),
            speedMps: 6,
        },
        {
            isAssigned: true,
            isActive: true,
            delayMinutes: 20,
        },
        now
    );

    assert.equal(statuses.tripStatus, TRIP_STATUS.DELAYED);
    assert.equal(statuses.trackingStatus, TRACKING_STATUS.RUNNING);
});

test('deriveBusStatuses returns OFFLINE when tracker is explicitly offline', () => {
    const statuses = deriveBusStatuses(
        {
            status: LEGACY_BUS_STATUS.ACTIVE,
            currentLat: 17.5,
            currentLng: 78.2,
            lastUpdated: new Date('2026-03-16T10:00:00.000Z'),
        },
        { isAssigned: true },
        {
            explicitlyOffline: true,
            speedMps: 0,
            timestamp: new Date('2026-03-16T10:00:00.000Z'),
        }
    );

    assert.equal(statuses.trackingStatus, TRACKING_STATUS.OFFLINE);
});

test('transition guard blocks ON_TRIP to NOT_SCHEDULED without route removal', () => {
    assert.throws(() => {
        assertValidTripStatusTransition(TRIP_STATUS.ON_TRIP, TRIP_STATUS.NOT_SCHEDULED, {
            fleetStatus: FLEET_STATUS.IN_SERVICE,
            routeAssigned: true,
            routeRemoved: false,
        });
    }, /requires route removal/);
});

test('integration: bus listing returns fleet/trip/tracking statuses and stale telemetry NO_SIGNAL', async () => {
    const staleDate = new Date(Date.now() - 2 * 60 * 1000);
    const buses = [
        {
            _id: 'bus-1',
            numberPlate: 'TS09AB1234',
            status: LEGACY_BUS_STATUS.ACTIVE,
            fleetStatus: FLEET_STATUS.IN_SERVICE,
            tripStatus: TRIP_STATUS.ON_TRIP,
            trackingStatus: TRACKING_STATUS.RUNNING,
            currentLat: 17.5,
            currentLng: 78.2,
            currentSpeedMps: 0,
            lastUpdated: staleDate,
            trackerOnline: true,
            maintenanceMode: false,
            routeId: { _id: 'route-1', name: 'Route 1' },
            driverId: { _id: 'driver-1', name: 'Driver One', memberId: 'D1001' },
            tripStartedAt: new Date(staleDate.getTime() - 60000),
        },
    ];

    await withPatchedMethod(Bus, 'find', () => createPopulateChain(buses, 2), async () => {
        const result = await busService.getBusesByOrganization('org-1');
        assert.equal(result.length, 1);
        assert.equal(result[0].fleetStatus, FLEET_STATUS.IN_SERVICE);
        assert.equal(result[0].tripStatus, TRIP_STATUS.ON_TRIP);
        assert.equal(result[0].trackingStatus, TRACKING_STATUS.NO_SIGNAL);
        assert.equal(result[0].status, LEGACY_BUS_STATUS.ACTIVE);
    });
});

test('integration: assign route updates tripStatus to TRIP_NOT_STARTED', async () => {
    const bus = {
        _id: 'bus-2',
        numberPlate: 'TS09XY7777',
        status: LEGACY_BUS_STATUS.ACTIVE,
        fleetStatus: FLEET_STATUS.IN_SERVICE,
        tripStatus: TRIP_STATUS.NOT_SCHEDULED,
        trackingStatus: TRACKING_STATUS.IDLE,
        trackerOnline: true,
        maintenanceMode: false,
        routeId: null,
        currentLat: 17.5,
        currentLng: 78.2,
        currentSpeedMps: 0,
        lastUpdated: new Date(),
        tripStartedAt: undefined,
        tripEndedAt: undefined,
        tripCancelledAt: undefined,
        tripDelayMinutes: undefined,
        save: async () => bus,
        toObject: () => ({ ...bus }),
    };

    const route = { _id: 'route-2', name: 'Route 2' };

    await withPatchedMethods(
        [
            {
                obj: Bus,
                methodName: 'findOne',
                replacement: async (query) => {
                    if (query && query._id === 'bus-2') {
                        return bus;
                    }
                    return null;
                },
            },
            {
                obj: Route,
                methodName: 'findOne',
                replacement: async () => route,
            },
        ],
        async () => {
            const updated = await busService.updateRouteForBus('org-1', 'bus-2', 'Route 2');
            assert.equal(updated.routeId, 'route-2');
            assert.equal(updated.routeName, 'Route 2');
            assert.equal(updated.tripStatus, TRIP_STATUS.TRIP_NOT_STARTED);
        }
    );
});

test('integration: telemetry update recomputes trackingStatus and tripStatus', async () => {
    const oldTimestamp = new Date(Date.now() - 10000);
    const bus = {
        _id: 'bus-3',
        organizationId: 'org-1',
        numberPlate: 'TS09TELE01',
        status: LEGACY_BUS_STATUS.ACTIVE,
        fleetStatus: FLEET_STATUS.IN_SERVICE,
        tripStatus: TRIP_STATUS.TRIP_NOT_STARTED,
        trackingStatus: TRACKING_STATUS.IDLE,
        routeId: 'route-3',
        trackerOnline: true,
        maintenanceMode: false,
        currentLat: 17.5,
        currentLng: 78.2,
        currentSpeedMps: 0,
        lastUpdated: oldTimestamp,
        tripStartedAt: undefined,
        tripEndedAt: undefined,
        tripCancelledAt: undefined,
        tripDelayMinutes: undefined,
        save: async () => bus,
    };

    await withPatchedMethods(
        [
            {
                obj: Bus,
                methodName: 'findById',
                replacement: async () => bus,
            },
            {
                obj: LocationLog,
                methodName: 'create',
                replacement: async () => ({}),
            },
            {
                obj: notificationService,
                methodName: 'processBusLocationUpdate',
                replacement: async () => ({}),
            },
        ],
        async () => {
            const result = await trackingService.updateBusLocation('bus-3', 17.502, 78.202);
            assert.equal(result.trackingStatus, TRACKING_STATUS.RUNNING);
            assert.equal(result.tripStatus, TRIP_STATUS.ON_TRIP);
        }
    );
});

test('integration: maintenance mode forces MAINTENANCE_HOLD', async () => {
    const bus = {
        _id: 'bus-4',
        numberPlate: 'TS09MAIN01',
        status: LEGACY_BUS_STATUS.ACTIVE,
        fleetStatus: FLEET_STATUS.IN_SERVICE,
        tripStatus: TRIP_STATUS.TRIP_NOT_STARTED,
        trackingStatus: TRACKING_STATUS.IDLE,
        routeId: 'route-4',
        trackerOnline: true,
        maintenanceMode: false,
        currentLat: 17.5,
        currentLng: 78.2,
        currentSpeedMps: 0,
        lastUpdated: new Date(),
        tripStartedAt: undefined,
        tripEndedAt: undefined,
        tripCancelledAt: undefined,
        tripDelayMinutes: undefined,
        save: async () => bus,
    };

    await withPatchedMethod(
        Bus,
        'findOne',
        async (query) => (query && query._id === 'bus-4' ? bus : null),
        async () => {
            const updated = await busService.setMaintenanceMode('org-1', 'bus-4', true);
            assert.equal(updated.fleetStatus, FLEET_STATUS.MAINTENANCE);
            assert.equal(updated.tripStatus, TRIP_STATUS.MAINTENANCE_HOLD);
        }
    );
});
