// Minimal no-op stub for openai used in Jest unit tests.
// The real SDK is never invoked in unit tests (services are mocked).
class OpenAI {
  constructor() {}
  chat = { completions: { create: async () => ({}) } };
  beta = { chat: { completions: { stream: () => ({ finalChatCompletion: async () => ({}) }) } } };
}

module.exports = OpenAI;
module.exports.default = OpenAI;
module.exports.OpenAI = OpenAI;
