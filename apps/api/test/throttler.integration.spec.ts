/**
 * Integration test: CustomThrottlerGuard returns 429 with the correct response shape
 * after the per-route limit is exceeded.
 *
 * Uses NestJS TestingModule with a real ThrottlerModule (in-memory storage) and
 * Node's built-in http module to make real HTTP requests against the test server.
 */
import { Controller, Get, INestApplication, Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { Throttle, ThrottlerModule } from '@nestjs/throttler';
import * as http from 'http';
import { CustomThrottlerGuard } from '../src/common/guards/throttler.guard';

function httpGet(server: http.Server, path: string): Promise<{ status: number; body: unknown; headers: Record<string, string | string[]> }> {
  return new Promise((resolve, reject) => {
    const address = server.address() as { port: number };
    const req = http.request({ hostname: '127.0.0.1', port: address.port, path, method: 'GET' }, (res) => {
      let raw = '';
      res.on('data', (chunk: Buffer) => { raw += chunk.toString(); });
      res.on('end', () => {
        let body: unknown;
        try { body = JSON.parse(raw); } catch { body = raw; }
        resolve({ status: res.statusCode ?? 0, body, headers: res.headers as Record<string, string | string[]> });
      });
    });
    req.on('error', reject);
    req.end();
  });
}

@Controller('probe')
class ProbeController {
  @Get('limited')
  @Throttle({ default: { ttl: 60_000, limit: 2 } })
  limited() {
    return { ok: true };
  }

  @Get('open')
  open() {
    return { ok: true };
  }
}

@Module({
  imports: [
    ThrottlerModule.forRoot({
      throttlers: [{ name: 'default', ttl: 60_000, limit: 100 }],
    }),
  ],
  controllers: [ProbeController],
  providers: [{ provide: APP_GUARD, useClass: CustomThrottlerGuard }],
})
class ProbeModule {}

describe('ThrottlerGuard — end-to-end 429 behaviour', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [ProbeModule],
    }).compile();

    app = module.createNestApplication();
    await app.listen(0); // random available port
  });

  afterAll(() => app.close());

  it('allows requests within the limit (200)', async () => {
    const server = app.getHttpServer() as http.Server;
    expect((await httpGet(server, '/probe/limited')).status).toBe(200);
    expect((await httpGet(server, '/probe/limited')).status).toBe(200);
  });

  it('returns 429 with correct body after limit exceeded', async () => {
    const server = app.getHttpServer() as http.Server;
    const res = await httpGet(server, '/probe/limited');

    expect(res.status).toBe(429);

    const body = res.body as { statusCode: number; message: string; retryAfter: number };
    expect(body.statusCode).toBe(429);
    expect(body.message).toBe('Too Many Requests');
    expect(typeof body.retryAfter).toBe('number');
    expect(body.retryAfter).toBeGreaterThan(0);

    // Retry-After header must also be present
    const retryAfterHeader = res.headers['retry-after'];
    expect(retryAfterHeader).toBeDefined();
  });

  it('route with global limit does not throttle at low traffic', async () => {
    const server = app.getHttpServer() as http.Server;
    for (let i = 0; i < 5; i++) {
      expect((await httpGet(server, '/probe/open')).status).toBe(200);
    }
  });
});
