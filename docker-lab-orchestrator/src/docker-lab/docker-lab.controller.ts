import {
  Body,
  Controller,
  Delete,
  Get,
  HttpException,
  HttpStatus,
  Param,
  Post,
} from '@nestjs/common';
import { DockerLabService } from './docker-lab.service';
import { RosterService } from '../roster/roster.service';

@Controller('api/students')
export class DockerLabController {
  constructor(
    private readonly dockerLab: DockerLabService,
    private readonly roster: RosterService,
  ) {}

  @Get()
  async list() {
    try {
      return await this.dockerLab.listStudents();
    } catch (err: any) {
      throw new HttpException(
        `No se pudo consultar el estado de las instancias: ${err.message}`,
        HttpStatus.BAD_GATEWAY,
      );
    }
  }

  @Post()
  async add(@Body() body: { id?: string; prefix?: string; count?: number }) {
    try {
      if (body.count && body.count > 0) {
        return await this.roster.addBulk(body.prefix ?? 'alumno', body.count);
      }
      if (!body.id) {
        throw new Error('Debes indicar un id o un count para generar en lote.');
      }
      return await this.roster.add(body.id);
    } catch (err: any) {
      throw new HttpException(err.message, HttpStatus.BAD_REQUEST);
    }
  }

  @Post(':id/activate')
  async activate(@Param('id') id: string) {
    try {
      return await this.dockerLab.activate(id);
    } catch (err: any) {
      throw new HttpException(err.message, HttpStatus.BAD_REQUEST);
    }
  }

  @Post(':id/deactivate')
  async deactivate(@Param('id') id: string) {
    try {
      return await this.dockerLab.deactivate(id);
    } catch (err: any) {
      throw new HttpException(err.message, HttpStatus.BAD_REQUEST);
    }
  }

  @Post(':id/regenerate-password')
  async regeneratePassword(@Param('id') id: string) {
    try {
      // Si la instancia esta activa, hay que reactivarla para que tome la nueva clave.
      const student = await this.roster.regeneratePassword(id);
      return student;
    } catch (err: any) {
      throw new HttpException(err.message, HttpStatus.BAD_REQUEST);
    }
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    try {
      await this.dockerLab.deactivate(id);
      await this.roster.remove(id);
      return { ok: true };
    } catch (err: any) {
      throw new HttpException(err.message, HttpStatus.BAD_REQUEST);
    }
  }
}
