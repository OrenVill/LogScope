export interface ArchiveBucketConfig {
  bucket: string;
  region: string;
  endpoint?: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  defaultEnv: string;
  defaultService: string;
  /** Service folder names offered in the viewer. */
  services: string[];
  /** When true, also read `landing/` for hours in the query window (recent raw JSON). */
  includeLanding: boolean;
  /** Max UTC hours to scan per search (safety cap). */
  maxHoursPerQuery: number;
}

function parseServiceList(raw: string | undefined, fallback: string): string[] {
  const items = (raw ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
  const unique = [...new Set(items)];
  return unique.length > 0 ? unique : [fallback];
}

export function loadArchiveBucketConfig(): ArchiveBucketConfig | null {
  const bucket = process.env.LOGS_S3_BUCKET?.trim();
  if (!bucket) return null;

  const defaultService = process.env.LOGS_S3_DEFAULT_SERVICE?.trim() || "api";

  return {
    bucket,
    region: process.env.LOGS_S3_REGION?.trim() || "eu-central-1",
    endpoint: process.env.LOGS_S3_ENDPOINT?.trim() || undefined,
    accessKeyId: process.env.LOGS_S3_ACCESS_KEY_ID?.trim() || undefined,
    secretAccessKey: process.env.LOGS_S3_SECRET_ACCESS_KEY?.trim() || undefined,
    defaultEnv: process.env.LOGS_S3_DEFAULT_ENV?.trim() || "dev",
    defaultService,
    services: parseServiceList(process.env.LOGS_S3_SERVICES, defaultService),
    includeLanding: process.env.LOGS_S3_INCLUDE_LANDING !== "false",
    maxHoursPerQuery: parseInt(process.env.LOGS_S3_MAX_HOURS || "168", 10),
  };
}

export function isBucketReadMode(config: ArchiveBucketConfig | null): config is ArchiveBucketConfig {
  return config !== null;
}
