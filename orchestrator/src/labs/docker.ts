import Docker from 'dockerode';
import { config } from '../config.js';

export const docker = new Docker({ socketPath: config.DOCKER_SOCKET });

export const MANAGED_LABEL = 'docker-lab.managed';
export const STUDENT_LABEL = 'docker-lab.student';

export function containerName(id: string): string {
  return `lab-${id}`;
}

export function dataVolumeName(id: string): string {
  return `lab-data-${id}`;
}

export function workVolumeName(id: string): string {
  return `lab-work-${id}`;
}

export async function findContainer(id: string): Promise<Docker.ContainerInfo | undefined> {
  const containers = await docker.listContainers({
    all: true,
    filters: { label: [`${STUDENT_LABEL}=${id}`] },
  });
  return containers[0];
}

export async function findManagedContainers(): Promise<Docker.ContainerInfo[]> {
  return docker.listContainers({ all: true, filters: { label: [MANAGED_LABEL] } });
}

export async function isRunning(id: string): Promise<boolean> {
  const container = await findContainer(id);
  return container?.State === 'running';
}
