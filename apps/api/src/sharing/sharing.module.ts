import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FamilyShare } from './entities/family-share.entity';
import { User } from '../users/entities/user.entity';
import { SharingService } from './sharing.service';
import { SharingController } from './sharing.controller';
import { MailModule } from '../mail/mail.module';

@Module({
  imports: [TypeOrmModule.forFeature([FamilyShare, User]), MailModule],
  controllers: [SharingController],
  providers: [SharingService],
  exports: [SharingService],
})
export class SharingModule {}
