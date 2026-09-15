import { Injectable, Logger } from '@nestjs/common';
import Docker from 'dockerode';
import { RosterService, Student } from '../roster/roster.service';

export type InstanceStatus = 'activo' | 'inactivo' | 'iniciando' | 'error';

export interface StudentInstance extends Student {
  status: InstanceStatus;
  url: string | null;
}

const MANAGED_LABEL = 'docker-lab.managed';
const STUDENT_LABEL = 'docker-lab.student';

@Injectable()
export class DockerLabService {
  private readonly logger = new Logger(DockerLabService.name);
  private readonly docker = new Docker({
    socketPath: process.env.DOCKER_SOCKET ?? '/var/run/docker.sock',
  });

  private readonly image = process.env.LAB_IMAGE ?? 'docker-lab:latest';
  private readonly network = process.env.LAB_NETWORK ?? 'public';
  // Subdominio unico bajo el que viven TODOS los laboratorios (path por alumno).
  private readonly labHost = process.env.LAB_HOST ?? 'docker-lab.areasoftccyt.com';
  private readonly memLimitMb = parseInt(process.env.LAB_MEM_LIMIT_MB ?? '1024', 10);
  private readonly cpus = parseFloat(process.env.LAB_CPUS ?? '1.0');

  constructor(private readonly roster: RosterService) {}

  private containerName(id: string): string {
    return `lab-${id}`;
  }

  private async findContainer(id: string): Promise<Docker.ContainerInfo | undefined> {
    const containers = await this.docker.listContainers({
      all: true,
      filters: { label: [`${STUDENT_LABEL}=${id}`] },
    });
    return containers[0];
  }

  async listStudents(): Promise<StudentInstance[]> {
    const [students, containers] = await Promise.all([
      this.roster.findAll(),
      this.docker.listContainers({ all: true, filters: { label: [MANAGED_LABEL] } }),
    ]);

    const byId = new Map(containers.map((c) => [c.Labels[STUDENT_LABEL], c]));

    return students.map((s) => {
      const container = byId.get(s.id);
      let status: InstanceStatus = 'inactivo';
      if (container) {
        status = container.State === 'running' ? 'activo' : 'inactivo';
      }
      return {
        ...s,
        status,
        url: status === 'activo' ? `https://${this.labHost}/${s.id}/` : null,
      };
    });
  }

  async activate(id: string): Promise<StudentInstance> {
    const student = await this.roster.findOne(id);
    if (!student) throw new Error(`No existe un aprendiz con id "${id}".`);

    const existing = await this.findContainer(id);

    if (existing) {
      if (existing.State !== 'running') {
        await this.docker.getContainer(existing.Id).start();
      }
    } else {
      await this.createAndStart(student);
    }

    return { ...student, status: 'activo', url: `https://${this.labHost}/${id}/` };
  }

  async deactivate(id: string): Promise<StudentInstance> {
    const student = await this.roster.findOne(id);
    if (!student) throw new Error(`No existe un aprendiz con id "${id}".`);

    const existing = await this.findContainer(id);
    if (existing) {
      const container = this.docker.getContainer(existing.Id);
      if (existing.State === 'running') {
        await container.stop({ t: 5 });
      }
      // Se elimina para que cada activacion arranque con un entorno limpio.
      await container.remove({ v: true, force: true });
    }

    return { ...student, status: 'inactivo', url: null };
  }

  private async createAndStart(student: Student): Promise<void> {
    this.logger.log(`Creando contenedor para ${student.id}`);

    const routerName = `lab-${student.id}`;

    const container = await this.docker.createContainer({
      name: this.containerName(student.id),
      Image: this.image,
      Env: [
        `STUDENT=${student.id}`,
        `PASSWORD=${student.password}`,
        `BASE_PATH=${student.id}`,
      ],
      Labels: {
        [MANAGED_LABEL]: 'true',
        [STUDENT_LABEL]: student.id,
        'traefik.enable': 'true',
        [`traefik.http.routers.${routerName}.rule`]: `Host(\`${this.labHost}\`) && PathPrefix(\`/${student.id}\`)`,
        [`traefik.http.routers.${routerName}.entrypoints`]: 'web',
        [`traefik.http.services.${routerName}.loadbalancer.server.port`]: '7681',
      },
      HostConfig: {
        Privileged: true,
        RestartPolicy: { Name: 'unless-stopped' },
        Memory: this.memLimitMb * 1024 * 1024,
        NanoCpus: Math.round(this.cpus * 1e9),
        NetworkMode: this.network,
      },
    });

    await container.start();
  }
}
