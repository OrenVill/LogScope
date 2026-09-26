export interface NexvillBucketConfig {
  bucket: string;
  region: string;
  endpoint?: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  defaultEnv: string;
  defaultService: string;
  /** When true, also read `landing/` for hours in the query window (recent raw JSON). */
  includeLanding: boolean;
  /** Max UTC hours to scan per search (safety cap). */
  maxHoursPerQuery: number;
}

export function loadNexvillBucketConfig(): NexvillBucketConfig | null {
  const bucket = process.env.LOGS_S3_BUCKET?.trim();
  if (!bucket) return null;

  return {
    bucket,
    region: process.env.LOGS_S3_REGION?.trim() || "eu-central-1",
    endpoint: process.env.LOGS_S3_ENDPOINT?.trim() || undefined,
    accessKeyId: process.env.LOGS_S3_ACCESS_KEY_ID?.trim() || undefined,
    secretAccessKey: process.env.LOGS_S3_SECRET_ACCESS_KEY?.trim() || undefined,
    defaultEnv: process.env.LOGS_S3_DEFAULT_ENV?.trim() || "dev",
    defaultService: process.env.LOGS_S3_DEFAULT_SERVICE?.trim() || "nexvill-api",
    includeLanding: process.env.LOGS_S3_INCLUDE_LANDING !== "false",
    maxHoursPerQuery: parseInt(process.env.LOGS_S3_MAX_HOURS || "168", 10),
  };
}

export function isBucketReadMode(config: NexvillBucketConfig | null): config is NexvillBucketConfig {
  return config !== null;
}
