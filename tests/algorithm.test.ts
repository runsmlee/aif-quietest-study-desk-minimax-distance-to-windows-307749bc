import { describe, it, expect } from 'vitest';
import { findQuietestDesk, computeDistancesToWindows, euclideanDistance } from '../src/algorithm';
import type { RoomConfig } from '../src/types';

describe('euclideanDistance', () => {
  it('computes distance between two points', () => {
    expect(euclideanDistance({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5);
  });

  it('returns 0 for same point', () => {
    expect(euclideanDistance({ x: 5, y: 5 }, { x: 5, y: 5 })).toBe(0);
  });

  it('computes distance for non-integer coordinates', () => {
    const dist = euclideanDistance({ x: 1, y: 1 }, { x: 4, y: 5 });
    expect(dist).toBeCloseTo(5, 1);
  });
});

describe('computeDistancesToWindows', () => {
  it('returns distances from a desk to all windows sorted by distance', () => {
    const desk = { id: 'd1', x: 5, y: 5 };
    const windows = [
      { id: 'w1', x: 1, y: 1 },
      { id: 'w2', x: 10, y: 10 },
      { id: 'w3', x: 5, y: 6 },
    ];

    const distances = computeDistancesToWindows(desk, windows);

    expect(distances).toHaveLength(3);
    expect(distances[0].windowId).toBe('w3'); // closest: distance=1
    expect(distances[0].distance).toBe(1);
    expect(distances[1].windowId).toBe('w1');
    expect(distances[2].windowId).toBe('w2');
  });

  it('uses window label when provided', () => {
    const desk = { id: 'd1', x: 0, y: 0 };
    const windows = [{ id: 'w1', x: 3, y: 4, label: 'North Window' }];

    const distances = computeDistancesToWindows(desk, windows);

    expect(distances[0].windowLabel).toBe('North Window');
  });

  it('falls back to window id when no label', () => {
    const desk = { id: 'd1', x: 0, y: 0 };
    const windows = [{ id: 'w1', x: 3, y: 4 }];

    const distances = computeDistancesToWindows(desk, windows);

    expect(distances[0].windowLabel).toBe('w1');
  });
});

describe('findQuietestDesk', () => {
  it('returns null when there are no desks', () => {
    const config: RoomConfig = { desks: [], windows: [{ id: 'w1', x: 0, y: 0 }] };
    expect(findQuietestDesk(config)).toBeNull();
  });

  it('returns null when there are no windows', () => {
    const config: RoomConfig = { desks: [{ id: 'd1', x: 5, y: 5 }], windows: [] };
    expect(findQuietestDesk(config)).toBeNull();
  });

  it('finds the desk with the maximum minimum distance to any window', () => {
    const config: RoomConfig = {
      desks: [
        { id: 'd1', x: 1, y: 1 },  // close to window
        { id: 'd2', x: 5, y: 5 },  // far from window
        { id: 'd3', x: 3, y: 3 },  // medium distance
      ],
      windows: [
        { id: 'w1', x: 0, y: 0 },
      ],
    };

    const result = findQuietestDesk(config);

    expect(result).not.toBeNull();
    expect(result!.desk.id).toBe('d2');
    expect(result!.minDistance).toBeCloseTo(7.07, 1);
  });

  it('computes maximin with multiple windows', () => {
    const config: RoomConfig = {
      desks: [
        { id: 'd1', x: 5, y: 5 },
        { id: 'd2', x: 2, y: 2 },
      ],
      windows: [
        { id: 'w1', x: 0, y: 0 },
        { id: 'w2', x: 10, y: 10 },
      ],
    };

    const result = findQuietestDesk(config);

    expect(result).not.toBeNull();
    expect(result!.desk.id).toBe('d1');
    // d1 is at (5,5), distance to w1(0,0) = ~7.07, distance to w2(10,10) = ~7.07
    // d2 is at (2,2), distance to w1(0,0) = ~2.83, distance to w2(10,10) = ~11.31
    // d2's min distance = 2.83, d1's min distance = 7.07 → d1 wins
    expect(result!.minDistance).toBeCloseTo(7.07, 1);
  });

  it('includes full distance profile for the chosen desk', () => {
    const config: RoomConfig = {
      desks: [{ id: 'd1', x: 5, y: 5 }],
      windows: [
        { id: 'w1', x: 0, y: 0, label: 'South Window' },
        { id: 'w2', x: 10, y: 0, label: 'East Window' },
        { id: 'w3', x: 5, y: 10, label: 'North Window' },
      ],
    };

    const result = findQuietestDesk(config);

    expect(result).not.toBeNull();
    expect(result!.distances).toHaveLength(3);

    // All windows should appear in the profile, sorted by distance
    const windowIds = result!.distances.map((d) => d.windowId);
    expect(windowIds).toContain('w1');
    expect(windowIds).toContain('w2');
    expect(windowIds).toContain('w3');

    // The first entry should be the closest (minimum distance)
    expect(result!.distances[0].distance).toBe(result!.minDistance);
  });

  it('rounds distances to 2 decimal places', () => {
    const config: RoomConfig = {
      desks: [{ id: 'd1', x: 1, y: 1 }],
      windows: [{ id: 'w1', x: 0, y: 0 }],
    };

    const result = findQuietestDesk(config);

    expect(result).not.toBeNull();
    // sqrt(2) ≈ 1.41421356... should round to 1.41
    const decimalPlaces = result!.minDistance.toString().split('.')[1]?.length ?? 0;
    expect(decimalPlaces).toBeLessThanOrEqual(2);
  });
});
