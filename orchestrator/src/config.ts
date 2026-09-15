import { z } from 'zod';

const boolFromEnv = z
  .string()
  .optional()
  .transform((v) => v === 'true' || v === '1');

const numberFromEnv = (def: number) =>
  z
    .string()
    .optional()
    .transform((v) => (v === undefined || v === '' ? def : Number(v)));

const schema = z.object({
  PORT: numberFromEnv(3000),

  LAB_IMAGE: z.string().default('docker-lab:latest'),
  LAB_NETWORK: z.string().default('lab-net'),
  LAB_HOST: z.string().default('docker-lab.areasoftccyt.com'),
  LAB_ENTRYPOINT: z.string().default('websecure'),
  LAB_CERTRESOLVER: z.string().default(''),

  LAB_MEM_LIMIT_MB: numberFromEnv(1024),
  LAB_MEM_RESERVATION_MB: numberFromEnv(256),
  LAB_CPUS: numberFromEnv(2.0),
  LAB_CPU_SHARES: numberFromEnv(512),
  LAB_PIDS_LIMIT: numberFromEnv(512),
  LAB_MAX_ACTIVE: numberFromEnv(30),
  LAB_IDLE_TIMEOUT_MIN: numberFromEnv(0),
  LAB_RECONCILE_CONCURRENCY: numberFromEnv(4),
  LAB_ACTION_CONCURRENCY: numberFromEnv(4),
  LAB_ROOTLESS: boolFromEnv,

  REGISTRY_MIRROR_URL: z.string().default(''),

  ROSTER_PATH: z.string().default('/app/data/roster.json'),
  DOCKER_SOCKET: z.string().default('/var/run/docker.sock'),

  ADMIN_USER: z.string().default('admin'),
  ADMIN_PASSWORD_HASH: z.string().default(''),
  SESSION_SECRET: z.string().default(''),
  SESSION_TTL_HOURS: numberFromEnv(12),

  NODE_ENV: z.string().default('development'),
});

export type Config = z.infer<typeof schema> & {
  labMemLimitBytes: number;
  labMemReservationBytes: number;
  labNanoCpus: number;
};

function load(): Config {
  const parsed = schema.parse(process.env);

  if (parsed.NODE_ENV === 'production') {
    if (!parsed.ADMIN_PASSWORD_HASH) {
      throw new Error(
        'ADMIN_PASSWORD_HASH es obligatorio en produccion. Generalo con: npx bcryptjs-cli hash "tu-clave" o el script scripts/hash-password.mjs',
      );
    }
    if (!parsed.SESSION_SECRET || parsed.SESSION_SECRET.length < 16) {
      throw new Error(
        'SESSION_SECRET es obligatorio en produccion (minimo 16 caracteres). Generalo con: openssl rand -hex 32',
      );
    }
  }

  return {
    ...parsed,
    labMemLimitBytes: parsed.LAB_MEM_LIMIT_MB * 1024 * 1024,
    labMemReservationBytes: parsed.LAB_MEM_RESERVATION_MB * 1024 * 1024,
    labNanoCpus: Math.round(parsed.LAB_CPUS * 1e9),
  };
}

export const config = load();
