const toRadians = (degrees: number): number => (degrees * Math.PI) / 180;

export const calculateDistanceMeters = (
	lat1: number,
	lng1: number,
	lat2: number,
	lng2: number
): number => {
	const earthRadiusMeters = 6371000;

	const dLat = toRadians(lat2 - lat1);
	const dLng = toRadians(lng2 - lng1);

	const a =
		Math.sin(dLat / 2) * Math.sin(dLat / 2) +
		Math.cos(toRadians(lat1)) *
			Math.cos(toRadians(lat2)) *
			Math.sin(dLng / 2) *
			Math.sin(dLng / 2);

	const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

	return earthRadiusMeters * c;
};

