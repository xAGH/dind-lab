import { Module } from '@nestjs/common';
import { DockerLabController } from './docker-lab.controller';
import { DockerLabService } from './docker-lab.service';
import { RosterService } from '../roster/roster.service';

@Module({
  controllers: [DockerLabController],
  providers: [DockerLabService, RosterService],
})
export class DockerLabModule {}
