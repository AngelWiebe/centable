// Let Jest mock lazily loaded native modules without invoking its ESM loader.
module.exports = function transformDynamicImport({ template }) {
  const deferredRequire = template.expression("Promise.resolve().then(() => require(SOURCE))");
  return {
    visitor: {
      CallExpression(path) {
        if (path.node.callee.type === "Import") {
          path.replaceWith(deferredRequire({ SOURCE: path.node.arguments[0] }));
        }
      },
    },
  };
};
