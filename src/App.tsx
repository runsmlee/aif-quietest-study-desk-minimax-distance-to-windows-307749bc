import { useState, useCallback, useEffect, useRef } from 'react';
import { findQuietestDesk } from './algorithm';
import { useLocalStorage } from './hooks';
import { trackEvent } from './analytics';
import type { Desk, Window_, DeskResult, RoomConfig } from './types';

const CANVAS_WIDTH = 640;
const CANVAS_HEIGHT = 400;
const GRID_SIZE = 20;
const POINT_RADIUS = 12;

type PlacementMode = 'desk' | 'window' | 'none';

function maxIdNum(items: Array<{ id: string }>, prefix: string): number {
  return items.reduce((max, item) => {
    const num = parseInt(item.id.replace(prefix, ''), 10);
    return isNaN(num) ? max : Math.max(max, num);
  }, 0);
}

export default function App() {
  const [desks, setDesks] = useLocalStorage<Desk[]>('quietest-desk-desks', []);
  const [windows, setWindows] = useLocalStorage<Window_[]>('quietest-desk-windows', []);
  const [placementMode, setPlacementMode] = useState<PlacementMode>('none');
  const [result, setResult] = useState<DeskResult | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // ID counters stored in refs — avoids module-level mutable state
  const nextDeskId = useRef(maxIdNum(desks, 'desk-') + 1);
  const nextWindowId = useRef(maxIdNum(windows, 'win-') + 1);

  useEffect(() => {
    trackEvent('page_view', { path: window.location.pathname });
  }, []);

  const handleCanvasClick = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (placementMode === 'none') return;
      const canvas = canvasRef.current;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      const scaleX = CANVAS_WIDTH / rect.width;
      const scaleY = CANVAS_HEIGHT / rect.height;
      const x = Math.round(((e.clientX - rect.left) * scaleX) / GRID_SIZE) * GRID_SIZE;
      const y = Math.round(((e.clientY - rect.top) * scaleY) / GRID_SIZE) * GRID_SIZE;

      if (placementMode === 'desk') {
        const id = `desk-${nextDeskId.current++}`;
        setDesks((prev) => [...prev, { id, x, y }]);
        trackEvent('desk_placed', { x, y });
      } else if (placementMode === 'window') {
        const id = `win-${nextWindowId.current++}`;
        setWindows((prev) => [...prev, { id, x, y }]);
        trackEvent('window_placed', { x, y });
      }
    },
    [placementMode, setDesks, setWindows]
  );

  const handleAddDesk = useCallback(() => {
    setPlacementMode((prev) => (prev === 'desk' ? 'none' : 'desk'));
  }, []);

  const handleAddWindow = useCallback(() => {
    setPlacementMode((prev) => (prev === 'window' ? 'none' : 'window'));
  }, []);

  const handleFindQuietest = useCallback(() => {
    const config: RoomConfig = { desks, windows };
    const found = findQuietestDesk(config);
    setResult(found);
    setPlacementMode('none');
    trackEvent('find_quietest', {
      deskCount: desks.length,
      windowCount: windows.length,
      foundDeskId: found?.desk.id ?? null,
      minDistance: found?.minDistance ?? null,
    });
  }, [desks, windows]);

  const handleClear = useCallback(() => {
    setDesks([]);
    setWindows([]);
    setResult(null);
    setPlacementMode('none');
    nextDeskId.current = 1;
    nextWindowId.current = 1;
    trackEvent('room_cleared');
  }, [setDesks, setWindows]);

  // Draw canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear
    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Background
    ctx.fillStyle = '#FAFAFA';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Grid
    ctx.strokeStyle = '#E5E7EB';
    ctx.lineWidth = 0.5;
    for (let x = 0; x <= CANVAS_WIDTH; x += GRID_SIZE) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, CANVAS_HEIGHT);
      ctx.stroke();
    }
    for (let y = 0; y <= CANVAS_HEIGHT; y += GRID_SIZE) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(CANVAS_WIDTH, y);
      ctx.stroke();
    }

    // Highlight recommended desk lines to windows
    if (result) {
      ctx.strokeStyle = 'rgba(239, 68, 68, 0.3)';
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 4]);
      for (const entry of result.distances) {
        const win = windows.find((w) => w.id === entry.windowId);
        if (win) {
          ctx.beginPath();
          ctx.moveTo(result.desk.x, result.desk.y);
          ctx.lineTo(win.x, win.y);
          ctx.stroke();
        }
      }
      ctx.setLineDash([]);
    }

    // Draw windows (blue squares)
    for (const w of windows) {
      ctx.fillStyle = '#3B82F6';
      ctx.fillRect(w.x - POINT_RADIUS / 2, w.y - POINT_RADIUS / 2, POINT_RADIUS, POINT_RADIUS);
      ctx.strokeStyle = '#1D4ED8';
      ctx.lineWidth = 2;
      ctx.strokeRect(w.x - POINT_RADIUS / 2, w.y - POINT_RADIUS / 2, POINT_RADIUS, POINT_RADIUS);
    }

    // Draw desks (circles)
    for (const d of desks) {
      const isBest = result?.desk.id === d.id;
      ctx.beginPath();
      ctx.arc(d.x, d.y, POINT_RADIUS, 0, Math.PI * 2);
      ctx.fillStyle = isBest ? '#EF4444' : '#6B7280';
      ctx.fill();
      ctx.strokeStyle = isBest ? '#B91C1C' : '#374151';
      ctx.lineWidth = 2;
      ctx.stroke();

      if (isBest) {
        // Draw a subtle glow
        ctx.beginPath();
        ctx.arc(d.x, d.y, POINT_RADIUS + 4, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(239, 68, 68, 0.4)';
        ctx.lineWidth = 3;
        ctx.stroke();
      }
    }
  }, [desks, windows, result]);

  const hasData = desks.length > 0 && windows.length > 0;

  // Dynamic canvas description for screen readers
  const canvasAriaLabel = [
    'Room grid',
    `${desks.length} desk${desks.length !== 1 ? 's' : ''} placed`,
    `${windows.length} window${windows.length !== 1 ? 's' : ''} placed`,
    result ? `Recommended: ${result.desk.id}, ${result.minDistance} units from nearest window` : null,
    placementMode !== 'none' ? `Click to place a ${placementMode}` : null,
  ]
    .filter(Boolean)
    .join('. ');

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-3xl mx-auto px-4 py-6">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
            Quietest Desk
          </h1>
          <p className="mt-1 text-gray-500 text-sm sm:text-base">
            Place desks and windows on the grid, then find the desk farthest from every window.
          </p>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6 space-y-6">
        {/* Controls */}
        <section className="flex flex-wrap gap-3" aria-label="Room controls">
          <button
            onClick={handleAddDesk}
            className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors focus-ring ${
              placementMode === 'desk'
                ? 'bg-brand-500 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
            aria-pressed={placementMode === 'desk'}
          >
            Add Desk
          </button>
          <button
            onClick={handleAddWindow}
            className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors focus-ring ${
              placementMode === 'window'
                ? 'bg-blue-500 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
            aria-pressed={placementMode === 'window'}
          >
            Add Window
          </button>
          <button
            onClick={handleFindQuietest}
            disabled={!hasData}
            className="px-4 py-2 rounded-lg font-medium text-sm bg-brand-500 text-white hover:bg-brand-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors focus-ring"
          >
            Find Quietest Desk
          </button>
          <button
            onClick={handleClear}
            className="px-4 py-2 rounded-lg font-medium text-sm bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors focus-ring"
          >
            Clear
          </button>
        </section>

        {/* Status */}
        {placementMode !== 'none' && (
          <div
            className={`px-4 py-2 rounded-lg text-sm font-medium ${
              placementMode === 'desk'
                ? 'bg-brand-50 text-brand-700'
                : 'bg-blue-50 text-blue-700'
            }`}
            role="status"
          >
            Click on the grid to place a {placementMode === 'desk' ? 'desk' : 'window'}
          </div>
        )}

        {/* Canvas + Legend — merged into single section */}
        <section className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
          <canvas
            ref={canvasRef}
            width={CANVAS_WIDTH}
            height={CANVAS_HEIGHT}
            onClick={handleCanvasClick}
            className="w-full h-auto cursor-crosshair"
            aria-label={canvasAriaLabel}
            role="img"
          />
          <div className="flex items-center gap-6 px-4 py-3 border-t border-gray-100 text-sm text-gray-600">
            <div className="flex items-center gap-2">
              <span className="inline-block w-3 h-3 rounded-full bg-gray-500" aria-hidden="true" />
              <span>Desk</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-block w-3 h-3 rounded-full bg-brand-500" aria-hidden="true" />
              <span>Recommended</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-block w-3 h-3 bg-blue-500" aria-hidden="true" />
              <span>Window</span>
            </div>
          </div>
        </section>

        {/* Result */}
        {result && (
          <ResultDisplay result={result} />
        )}
      </main>
    </div>
  );
}

function ResultDisplay({ result }: { result: DeskResult }) {
  return (
    <section className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm" aria-label="Results">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">
        Recommended: {result.desk.id}
      </h2>

      <div className="mb-4">
        <p className="text-sm text-gray-600">
          Minimum distance to nearest window:
        </p>
        <p className="text-2xl font-bold text-brand-500">
          {result.minDistance} units
        </p>
      </div>

      {/* Full Distance Profile — the sharpen improvement */}
      <div>
        <h3 className="text-sm font-semibold text-gray-700 mb-3">
          Distance Profile
        </h3>
        <p className="text-xs text-gray-500 mb-3">
          Distance from {result.desk.id} to every window, sorted nearest to farthest. The closest window determines the noise level.
        </p>
        <ul className="space-y-2" aria-label="Distance profile">
          {result.distances.map((entry, idx) => (
            <li
              key={entry.windowId}
              className={`flex items-center justify-between px-4 py-2 rounded-lg text-sm ${
                idx === 0
                  ? 'bg-brand-50 border border-brand-200'
                  : 'bg-gray-50 border border-gray-100'
              }`}
            >
              <span className="font-medium text-gray-700">
                {entry.windowLabel}
                {idx === 0 && (
                  <span className="ml-2 text-xs text-brand-600 font-normal">(nearest)</span>
                )}
              </span>
              <span className={`font-mono font-semibold ${idx === 0 ? 'text-brand-600' : 'text-gray-900'}`}>
                {entry.distance} units
              </span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
