import { Injectable, Logger } from '@nestjs/common';
import { promises as fs } from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

export interface Student {
  id: string;
  password: string;
  createdAt: string;
}

const ID_PATTERN = /^[a-z0-9][a-z0-9-]{1,30}$/;

@Injectable()
export class RosterService {
  private readonly logger = new Logger(RosterService.name);
  private readonly filePath =
    process.env.ROSTER_PATH ?? path.join(process.cwd(), 'data', 'roster.json');

  private cache: Student[] | null = null;

  private async load(): Promise<Student[]> {
    if (this.cache) return this.cache;
    try {
      const raw = await fs.readFile(this.filePath, 'utf-8');
      this.cache = JSON.parse(raw) as Student[];
    } catch (err: any) {
      if (err.code === 'ENOENT') {
        this.cache = [];
      } else {
        throw err;
      }
    }
    return this.cache!;
  }

  private async persist(): Promise<void> {
    await fs.mkdir(path.dirname(this.filePath), { recursive: true });
    await fs.writeFile(this.filePath, JSON.stringify(this.cache, null, 2), 'utf-8');
  }

  async findAll(): Promise<Student[]> {
    return this.load();
  }

  async findOne(id: string): Promise<Student | undefined> {
    const list = await this.load();
    return list.find((s) => s.id === id);
  }

  async add(id: string): Promise<Student> {
    if (!ID_PATTERN.test(id)) {
      throw new Error(
        'El identificador solo puede tener minusculas, numeros y guiones (2-31 caracteres).',
      );
    }
    const list = await this.load();
    if (list.find((s) => s.id === id)) {
      throw new Error(`Ya existe un aprendiz con id "${id}".`);
    }
    const student: Student = {
      id,
      password: crypto.randomBytes(4).toString('hex'),
      createdAt: new Date().toISOString(),
    };
    list.push(student);
    await this.persist();
    this.logger.log(`Aprendiz agregado: ${id}`);
    return student;
  }

  async addBulk(prefix: string, count: number): Promise<Student[]> {
    const list = await this.load();
    const existingNumbers = new Set(
      list
        .filter((s) => s.id.startsWith(prefix))
        .map((s) => parseInt(s.id.slice(prefix.length), 10))
        .filter((n) => !isNaN(n)),
    );
    const created: Student[] = [];
    let next = 1;
    while (created.length < count) {
      while (existingNumbers.has(next)) next++;
      const id = `${prefix}${next}`;
      const student: Student = {
        id,
        password: crypto.randomBytes(4).toString('hex'),
        createdAt: new Date().toISOString(),
      };
      list.push(student);
      created.push(student);
      existingNumbers.add(next);
      next++;
    }
    await this.persist();
    this.logger.log(`${created.length} aprendices generados con prefijo "${prefix}"`);
    return created;
  }

  async remove(id: string): Promise<void> {
    const list = await this.load();
    const idx = list.findIndex((s) => s.id === id);
    if (idx === -1) {
      throw new Error(`No existe un aprendiz con id "${id}".`);
    }
    list.splice(idx, 1);
    await this.persist();
    this.logger.log(`Aprendiz eliminado: ${id}`);
  }

  async regeneratePassword(id: string): Promise<Student> {
    const list = await this.load();
    const student = list.find((s) => s.id === id);
    if (!student) {
      throw new Error(`No existe un aprendiz con id "${id}".`);
    }
    student.password = crypto.randomBytes(4).toString('hex');
    await this.persist();
    return student;
  }
}
