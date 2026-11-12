/** Tipos espejados de la API del orquestador. No importar desde src/. */

export type InstanceStatus = 'activo' | 'inactivo' | 'iniciando' | 'deteniendo' | 'error';

export interface StudentStats {
  cpuPercent: number;
  memUsedMb: number;
  memLimitMb: number;
  uptimeSeconds: number;
}

export interface StudentDisk {
  dataBytes: number;
  workBytes: number;
}

export interface Student {
  id: string;
  group: string;
  password: string;
  status: InstanceStatus;
  url: string | null;
  stats: StudentStats | null;
  disk: StudentDisk | null;
}

export interface Summary {
  activeCount: number;
  maxActive: number;
}

export interface BulkResult {
  ok: string[];
  failed: Array<{ id: string; message: string }>;
}

export interface LookupResult {
  id: string;
  status: InstanceStatus;
  url: string | null;
}
