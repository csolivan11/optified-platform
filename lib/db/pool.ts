import "server-only";
import { Pool, PoolConfig } from "pg";

/**
 * secureDbPool is a singleton database connection pool for Google Cloud SQL PostgreSQL.
 *
 * It is configured to satisfy FedRAMP Moderate and HIPAA requirements:
 * 1. Requires SSL/TLS (rejects unencrypted database traffic).
 * 2. Integrates with IAM Database Authentication (instead of static DB passwords).
 *    In a GKE environment, the Cloud SQL Auth Proxy is typically run as a sidecar,
 *    allowing secure local connections on localhost (127.0.0.1:5432) that are encrypted
 *    and authenticated automatically using the pod's Workload Identity service account.
 */

let pool: Pool | null = null;

export function getDbPool(): Pool {
  if (pool) return pool;

  const dbHost = process.env.DB_HOST || "127.0.0.1";
  const dbPort = parseInt(process.env.DB_PORT || "5432", 10);
  const dbName = process.env.DB_NAME || "optified";
  const dbUser = process.env.DB_USER || "optified-app-k8s@optified-prod.iam"; // IAM DB User

  const isProduction = process.env.NODE_ENV === "production";

  const config: PoolConfig = {
    host: dbHost,
    port: dbPort,
    database: dbName,
    user: dbUser,
    max: 20, // Limit maximum connections per container pod
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
  };

  // Enforce SSL/TLS for all database traffic in production
  if (isProduction) {
    config.ssl = {
      rejectUnauthorized: true,
      // Root certificate for Google Cloud SQL Authority can be mounted into the pod
      ca: process.env.DB_SSL_CA_CERT || "/etc/ssl/certs/gcp-cloud-sql-ca.pem",
    };
  }

  pool = new Pool(config);

  pool.on("error", (err) => {
    console.error("Unexpected error on idle PostgreSQL client:", err);
  });

  return pool;
}

/**
 * Helper to execute queries safely with automatic client acquisition and release.
 */
export async function query(text: string, params?: any[]) {
  const dbPool = getDbPool();
  const start = Date.now();
  try {
    const res = await dbPool.query(text, params);
    const duration = Date.now() - start;
    
    // Performance audit logging for long-running compliance queries
    if (duration > 500) {
      console.warn(`[Slow Query Audit] duration: ${duration}ms, query: ${text}`);
    }
    
    return res;
  } catch (error) {
    console.error("[Database Query Error]", { query: text, error });
    throw error;
  }
}
