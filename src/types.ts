export interface Point {
  x: number;
  y: number;
  label?: string;
}

export interface Desk extends Point {
  id: string;
}

export interface Window_ extends Point {
  id: string;
}

export interface DistanceEntry {
  windowId: string;
  windowLabel: string;
  distance: number;
}

export interface DeskResult {
  desk: Desk;
  minDistance: number;
  distances: DistanceEntry[];
}

export interface RoomConfig {
  desks: Desk[];
  windows: Window_[];
}
