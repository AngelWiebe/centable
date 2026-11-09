const { getDefaultConfig } = require("expo/metro-config");

/** @type {import("expo/metro-config").MetroConfig} */
const config = getDefaultConfig(__dirname);

// expo-sqlite's web build imports wa-sqlite.wasm.
config.resolver.assetExts.push("wasm");

// SharedArrayBuffer, which wa-sqlite needs in the browser.
config.server.enhanceMiddleware = (middleware) => {
  return (req, res, next) => {
    res.setHeader("Cross-Origin-Embedder-Policy", "credentialless");
    res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
    return middleware(req, res, next);
  };
};

module.exports = config;
