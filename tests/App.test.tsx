import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import App from '../src/App';
import { findQuietestDesk } from '../src/algorithm';

// Simple localStorage mock
beforeEach(() => {
  const store: Record<string, string> = {};
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation((key: string) => store[key] ?? null);
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation((key: string, value: string) => {
    store[key] = value;
  });
  vi.spyOn(Storage.prototype, 'removeItem').mockImplementation((key: string) => {
    delete store[key];
  });
});

describe('App', () => {
  it('renders the heading without a trailing period', () => {
    render(<App />);
    const heading = screen.getByRole('heading', { level: 1 });
    expect(heading.textContent).toBe('Desk Placement Calculator');
    expect(heading.textContent).not.toMatch(/\.\s*$/);
  });

  it('renders the room canvas with dynamic aria-label describing empty state', () => {
    render(<App />);
    // The canvas aria-label should mention "0 desks" and "0 windows" initially
    const canvas = screen.getByRole('img');
    expect(canvas).toBeInTheDocument();
    expect(canvas.getAttribute('aria-label')).toMatch(/room grid/i);
    expect(canvas.getAttribute('aria-label')).toMatch(/0 desks? placed/);
    expect(canvas.getAttribute('aria-label')).toMatch(/0 windows? placed/);
  });

  it('shows the "Find Quietest Desk" button', () => {
    render(<App />);
    expect(screen.getByRole('button', { name: /find quietest desk/i })).toBeInTheDocument();
  });

  it('allows adding desks and windows via buttons', () => {
    render(<App />);
    expect(screen.getByRole('button', { name: /add desk/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /add window/i })).toBeInTheDocument();
  });

  it('shows disabled Find button when no data is placed', () => {
    render(<App />);
    const findBtn = screen.getByRole('button', { name: /find quietest desk/i });
    expect(findBtn).toBeDisabled();
  });

  it('renders legend inline within the canvas section', () => {
    render(<App />);
    // Legend text should exist but not as a separate section
    expect(screen.getByText('Desk')).toBeInTheDocument();
    expect(screen.getByText('Recommended')).toBeInTheDocument();
    expect(screen.getByText('Window')).toBeInTheDocument();
    // No separate Legend section
    expect(screen.queryByRole('region', { name: /legend/i })).not.toBeInTheDocument();
  });
});

describe('Distance Profile (algorithm + display logic)', () => {
  it('computes full distance profile for the chosen desk', () => {
    const result = findQuietestDesk({
      desks: [{ id: 'desk-1', x: 5, y: 5 }],
      windows: [
        { id: 'win-1', x: 0, y: 0, label: 'South Window' },
        { id: 'win-2', x: 10, y: 0, label: 'East Window' },
        { id: 'win-3', x: 5, y: 10, label: 'North Window' },
      ],
    });

    expect(result).not.toBeNull();
    expect(result!.distances).toHaveLength(3);

    const windowLabels = result!.distances.map((d) => d.windowLabel);
    expect(windowLabels).toContain('South Window');
    expect(windowLabels).toContain('East Window');
    expect(windowLabels).toContain('North Window');

    expect(result!.distances[0].distance).toBe(result!.minDistance);
  });

  it('sorts distance profile from nearest to farthest', () => {
    const result = findQuietestDesk({
      desks: [{ id: 'desk-1', x: 5, y: 5 }],
      windows: [
        { id: 'win-1', x: 5, y: 6 },
        { id: 'win-2', x: 0, y: 0 },
        { id: 'win-3', x: 10, y: 10 },
      ],
    });

    expect(result).not.toBeNull();
    const distances = result!.distances.map((d) => d.distance);
    for (let i = 1; i < distances.length; i++) {
      expect(distances[i]).toBeGreaterThanOrEqual(distances[i - 1]);
    }
  });

  it('marks the nearest window in the distance profile', () => {
    const result = findQuietestDesk({
      desks: [
        { id: 'desk-1', x: 10, y: 10 },
        { id: 'desk-2', x: 1, y: 1 },
      ],
      windows: [
        { id: 'win-1', x: 0, y: 0 },
        { id: 'win-2', x: 20, y: 0 },
        { id: 'win-3', x: 10, y: 20 },
      ],
    });

    expect(result).not.toBeNull();
    expect(result!.distances.length).toBe(3);
    expect(result!.minDistance).toBeGreaterThan(0);
    // First entry is the closest = minDistance
    expect(result!.distances[0].distance).toBe(result!.minDistance);
  });
});
