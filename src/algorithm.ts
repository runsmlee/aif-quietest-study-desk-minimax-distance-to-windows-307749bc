import type { Desk, Window_, DistanceEntry, DeskResult, RoomConfig } from './types';

function euclideanDistance(a: { x: number; y: number }, b: { x: number; y: number }): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

export function computeDistancesToWindows(desk: Desk, windows: Window_[]): DistanceEntry[] {
  return windows
    .map((w) => ({
      windowId: w.id,
      windowLabel: w.label || w.id,
      distance: Math.round(euclideanDistance(desk, w) * 100) / 100,
    }))
    .sort((a, b) => a.distance - b.distance);
}

export function findQuietestDesk(config: RoomConfig): DeskResult | null {
  const { desks, windows } = config;

  if (desks.length === 0 || windows.length === 0) {
    return null;
  }

  let bestDesk: DeskResult | null = null;
  let bestMinDistance = -1;

  for (const desk of desks) {
    const distances = computeDistancesToWindows(desk, windows);
    const minDistance = distances[0].distance; // sorted ascending, so first is closest

    if (minDistance > bestMinDistance) {
      bestMinDistance = minDistance;
      bestDesk = {
        desk,
        minDistance: Math.round(minDistance * 100) / 100,
        distances,
      };
    }
  }

  return bestDesk;
}

export { euclideanDistance };
