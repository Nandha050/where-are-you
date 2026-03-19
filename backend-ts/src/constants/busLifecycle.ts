export const BUS_LIFECYCLE_STATUS = {
    ACTIVE: 'ACTIVE',
    INACTIVE: 'INACTIVE',
} as const;

export type BusLifecycleStatus = (typeof BUS_LIFECYCLE_STATUS)[keyof typeof BUS_LIFECYCLE_STATUS];

export const BUS_LIFECYCLE_STATUS_VALUES: BusLifecycleStatus[] = Object.values(BUS_LIFECYCLE_STATUS);
