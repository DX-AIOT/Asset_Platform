import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Item } from './entities/item.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Item])],
  exports: [TypeOrmModule],
})
export class ItemsModule {}
