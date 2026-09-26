/** Grouped archive chunk types. */

export type DeltaItem = number | [number, number];

export interface WarnGroup {
  dt: DeltaItem[];
  rid?: (string | null)[];
  [numericField: string]: (number | null)[] | (string | null)[] | DeltaItem[] | undefined;
}

export interface ErrorRecord {
  dt: number;
  k: string;
  rid?: string;
  msg?: string;
  num?: Record<string, number>;
  d?: unknown;
}

export interface GroupedChunk {
  svc: string;
  t0: number;
  pod?: string;
  Pc?: Record<string, number>;
  I?: Record<string, DeltaItem[]>;
  W?: Record<string, WarnGroup>;
  E?: ErrorRecord[];
}

export interface DecodedEvent {
  ts: number;
  level: "INFO" | "WARN" | "ERROR";
  svc: string;
  key: string;
  pod?: string;
  rid?: string;
  msg?: string;
  num?: Record<string, number>;
  data?: unknown;
}
