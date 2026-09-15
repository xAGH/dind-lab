import { promises as fs } from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { config } from '../config.js';
import { createLogger } from '../lib/logger.js';

const logger = createLogger('roster');

export interface Student {
  id: string;
  password: string;
  group: string;
  /** Estado deseado: si el orquestador reinicia, reconcile.ts vuelve a encender esto. */
  desiredActive: boolean;
  createdAt: string;
}

export const ID_PATTERN = /^[a-z0-9][a-z0-9-]{1,30}$/;

// Alfabeto sin caracteres ambiguos (sin l/1/I, O/0) para que las claves se
// dicten y se tecleen sin confusiones en clase.
const PASSWORD_ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789';

function generatePassword(length = 12): string {
  const bytes = crypto.randomBytes(length);
  let out = '';
  for (let i = 0; i < length; i++) {
    out += PASSWORD_ALPHABET[bytes[i] % PASSWORD_ALPHABET.length];
  }
  return out;
}

/** Mutex simple por promesas: serializa lecturas/escrituras del archivo del roster. */
class Mutex {
  private tail: Promise<unknown> = Promise.resolve();

  run<T>(fn: () => Promise<T>): Promise<T> {
    const result = this.tail.then(fn, fn);
    // Nunca dejamos que un rechazo rompa la cadena para las siguientes tareas.
    this.tail = result.catch(() => undefined);
    return result;
  }
}

export class RosterStore {
  private readonly filePath = config.ROSTER_PATH;
  private readonly mutex = new Mutex();
  private cache: Student[] | null = null;

  private async readFromDisk(): Promise<Student[]> {
    try {
      const raw = await fs.readFile(this.filePath, 'utf-8');
      return JSON.parse(raw) as Student[];
    } catch (err: unknown) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') return [];
      throw err;
    }
  }

  private async load(): Promise<Student[]> {
    if (this.cache) return this.cache;
    this.cache = await this.readFromDisk();
    return this.cache;
  }

  /** Escritura atomica: escribe a un archivo temporal y renombra (evita roster.json a medias). */
  private async persist(list: Student[]): Promise<void> {
    await fs.mkdir(path.dirname(this.filePath), { recursive: true });
    const tmpPath = `${this.filePath}.${process.pid}.tmp`;
    await fs.writeFile(tmpPath, JSON.stringify(list, null, 2), { mode: 0o600 });
    await fs.rename(tmpPath, this.filePath);
    this.cache = list;
  }

  async findAll(): Promise<Student[]> {
    return this.mutex.run(() => this.load());
  }

  async findOne(id: string): Promise<Student | undefined> {
    const list = await this.findAll();
    return list.find((s) => s.id === id);
  }

  async add(id: string, group = 'default'): Promise<Student> {
    return this.mutex.run(async () => {
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
        password: generatePassword(),
        group,
        desiredActive: false,
        createdAt: new Date().toISOString(),
      };
      list.push(student);
      await this.persist(list);
      logger.info('aprendiz agregado', { id, group });
      return student;
    });
  }

  async addBulk(prefix: string, count: number, group = 'default'): Promise<Student[]> {
    return this.mutex.run(async () => {
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
          password: generatePassword(),
          group,
          desiredActive: false,
          createdAt: new Date().toISOString(),
        };
        list.push(student);
        created.push(student);
        existingNumbers.add(next);
        next++;
      }
      await this.persist(list);
      logger.info('aprendices generados en lote', { count: created.length, prefix, group });
      return created;
    });
  }

  async remove(id: string): Promise<void> {
    return this.mutex.run(async () => {
      const list = await this.load();
      const idx = list.findIndex((s) => s.id === id);
      if (idx === -1) throw new Error(`No existe un aprendiz con id "${id}".`);
      list.splice(idx, 1);
      await this.persist(list);
      logger.info('aprendiz eliminado', { id });
    });
  }

  async regeneratePassword(id: string): Promise<Student> {
    return this.mutex.run(async () => {
      const list = await this.load();
      const student = list.find((s) => s.id === id);
      if (!student) throw new Error(`No existe un aprendiz con id "${id}".`);
      student.password = generatePassword();
      await this.persist(list);
      return student;
    });
  }

  async setDesiredActive(id: string, desiredActive: boolean): Promise<Student> {
    return this.mutex.run(async () => {
      const list = await this.load();
      const student = list.find((s) => s.id === id);
      if (!student) throw new Error(`No existe un aprendiz con id "${id}".`);
      student.desiredActive = desiredActive;
      await this.persist(list);
      return student;
    });
  }

  async setGroup(id: string, group: string): Promise<Student> {
    return this.mutex.run(async () => {
      const list = await this.load();
      const student = list.find((s) => s.id === id);
      if (!student) throw new Error(`No existe un aprendiz con id "${id}".`);
      student.group = group;
      await this.persist(list);
      return student;
    });
  }
}

export const rosterStore = new RosterStore();
