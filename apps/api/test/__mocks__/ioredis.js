// Minimal no-op stub for ioredis used in Jest unit tests.
class Redis {
  constructor() {}
  get = async () => null;
  set = async () => 'OK';
  del = async () => 0;
  quit = async () => 'OK';
  on = () => this;
  disconnect = () => {};
}

module.exports = Redis;
module.exports.default = Redis;
module.exports.Redis = Redis;
