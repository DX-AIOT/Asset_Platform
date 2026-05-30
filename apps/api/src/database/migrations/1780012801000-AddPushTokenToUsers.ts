import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPushTokenToUsers1780012801000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE users
        ADD COLUMN IF NOT EXISTS "pushToken" VARCHAR DEFAULT NULL;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE users DROP COLUMN IF EXISTS "pushToken";
    `);
  }
}
