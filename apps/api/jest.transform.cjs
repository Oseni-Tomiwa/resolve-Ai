const typescript = require('typescript');

module.exports = {
  process(sourceText, sourcePath) {
    const result = typescript.transpileModule(sourceText, {
      fileName: sourcePath,
      compilerOptions: {
        module: typescript.ModuleKind.CommonJS,
        target: typescript.ScriptTarget.ES2022,
        esModuleInterop: true,
        experimentalDecorators: true,
        emitDecoratorMetadata: true,
        sourceMap: true,
      },
    });
    return { code: result.outputText, map: result.sourceMapText };
  },
};
