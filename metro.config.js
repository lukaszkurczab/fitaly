// metro.config.js
const { getDefaultConfig } = require("expo/metro-config");

module.exports = (() => {
  const config = getDefaultConfig(__dirname);
  const { assetExts, sourceExts } = config.resolver;

  if (!config.resolver.sourceExts.includes("cjs")) {
    config.resolver.sourceExts.push("cjs");
  }
  if (!config.resolver.assetExts.includes("ttf")) {
    config.resolver.assetExts.push("ttf");
  }
  if (!config.resolver.assetExts.includes("otf")) {
    config.resolver.assetExts.push("otf");
  }

  config.transformer = {
    ...config.transformer,
    babelTransformerPath: require.resolve("react-native-svg-transformer/expo"),
  };
  config.resolver.assetExts = assetExts.filter((ext) => ext !== "svg");
  config.resolver.sourceExts = [...sourceExts, "svg"];
  config.resolver.unstable_enablePackageExports = false;
  if (process.env.E2E_DISABLE_WATCHMAN === "1") {
    config.resolver.useWatchman = false;
  }
  return config;
})();
