export type RayBody = {
    left: number; right: number; top: number; bottom: number;
    isCircle?: boolean; halfWidth?: number; center?: { x: number; y: number };
};

/** First point on a normalized ray intersecting the actual Arcade body, not sprite art. */
export function rayBodyDistance(x: number, y: number, dx: number, dy: number, body: RayBody, range: number): number | null {
    if (body.isCircle && body.center) {
        const radius = body.halfWidth ?? (body.right - body.left) / 2;
        const ox = x - body.center.x, oy = y - body.center.y;
        const c = ox * ox + oy * oy - radius * radius;
        if (c <= 0) return 0;
        const projection = ox * dx + oy * dy;
        const discriminant = projection * projection - c;
        if (discriminant < 0) return null;
        const distance = -projection - Math.sqrt(discriminant);
        return distance >= 0 && distance <= range ? distance : null;
    }
    let start = 0, end = range;
    for (const [origin, direction, min, max] of [[x, dx, body.left, body.right], [y, dy, body.top, body.bottom]]) {
        if (Math.abs(direction) < 1e-10) {
            if (origin < min || origin > max) return null;
        } else {
            const a = (min - origin) / direction, b = (max - origin) / direction;
            start = Math.max(start, Math.min(a, b));
            end = Math.min(end, Math.max(a, b));
            if (start > end) return null;
        }
    }
    return start;
}
