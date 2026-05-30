module.exports = function (api) {
  const isTest = process.env.NODE_ENV === 'test';
  api.cache(!isTest);
  return {
    presets: [['babel-preset-expo']],
    // Disable metro's compile-time Platform.OS inlining during Jest runs;
    // it conflicts with jest module mocks and has no value in a test env.
    plugins: isTest ? [['metro-transform-plugins/src/inline-plugin', false]] : [],
  };
};
