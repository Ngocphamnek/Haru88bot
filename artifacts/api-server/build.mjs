import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build as esbuild } from "esbuild";
import esbuildPluginPino from "esbuild-plugin-pino";
import { rm, cp, mkdir, access } from "node:fs/promises";
import { constants as fsConstants } from "node:fs";

// Plugins (e.g. 'esbuild-plugin-pino') may use `require` to resolve dependencies
globalThis.require = createRequire(import.meta.url);

const artifactDir = path.dirname(fileURLToPath(import.meta.url));

async function exists(p) {
  try {
    await access(p, fsConstants.F_OK);
    return true;
  } catch {
    return false;
  }
}

async function copyIfExists(src, dest) {
  if (!(await exists(src))) {
    console.warn(`[build] skip missing asset: ${src}`);
    return;
  }
  await mkdir(path.dirname(dest), { recursive: true });
  await cp(src, dest, { recursive: true, force: true });
  console.log(`[build] copied ${path.relative(artifactDir, src)} → ${path.relative(artifactDir, dest)}`);
}

async function copyRuntimeAssets(distDir) {
  // Public game HTML/assets (both legacy nested and flat layouts)
  await copyIfExists(
    path.resolve(artifactDir, "public"),
    path.resolve(distDir, "public"),
  );
  await copyIfExists(
    path.resolve(artifactDir, "src/public"),
    path.resolve(distDir, "public"),
  );

  // OCR model — place next to bundle and under corebank/
  const modelSrc = path.resolve(artifactDir, "src/corebank/model.onnx");
  await copyIfExists(modelSrc, path.resolve(distDir, "model.onnx"));
  await copyIfExists(modelSrc, path.resolve(distDir, "corebank/model.onnx"));
  await copyIfExists(modelSrc, path.resolve(distDir, "lib/model.onnx"));

  // HDBank vendor crypto scripts
  await copyIfExists(
    path.resolve(artifactDir, "src/vendor"),
    path.resolve(distDir, "vendor"),
  );

  // Ensure data dir placeholder exists at runtime cwd expectation
  await mkdir(path.resolve(artifactDir, "data"), { recursive: true });
}

async function buildAll() {
  const distDir = path.resolve(artifactDir, "dist");
  await rm(distDir, { recursive: true, force: true });

  await esbuild({
    entryPoints: [path.resolve(artifactDir, "src/index.ts")],
    platform: "node",
    bundle: true,
    format: "esm",
    outdir: distDir,
    outExtension: { ".js": ".mjs" },
    logLevel: "info",
    external: [
      "*.node",
      "sharp",
      "better-sqlite3",
      "sqlite3",
      "canvas",
      "bcrypt",
      "argon2",
      "fsevents",
      "re2",
      "farmhash",
      "xxhash-addon",
      "bufferutil",
      "utf-8-validate",
      "ssh2",
      "cpu-features",
      "dtrace-provider",
      "isolated-vm",
      "lightningcss",
      "pg-native",
      "oracledb",
      "mongodb-client-encryption",
      "nodemailer",
      "handlebars",
      "knex",
      "typeorm",
      "protobufjs",
      "onnxruntime-node",
      "@tensorflow/*",
      "@prisma/client",
      "@mikro-orm/*",
      "@grpc/*",
      "@swc/*",
      "@aws-sdk/*",
      "@azure/*",
      "@opentelemetry/*",
      "@google-cloud/*",
      "@google/*",
      "googleapis",
      "firebase-admin",
      "@parcel/watcher",
      "@sentry/profiling-node",
      "@tree-sitter/*",
      "aws-sdk",
      "classic-level",
      "dd-trace",
      "ffi-napi",
      "grpc",
      "hiredis",
      "kerberos",
      "leveldown",
      "miniflare",
      "mysql2",
      "newrelic",
      "odbc",
      "piscina",
      "realm",
      "ref-napi",
      "rocksdb",
      "sass-embedded",
      "sequelize",
      "serialport",
      "snappy",
      "tinypool",
      "usb",
      "workerd",
      "wrangler",
      "zeromq",
      "zeromq-prebuilt",
      "playwright",
      "puppeteer",
      "puppeteer-core",
      "electron",
    ],
    sourcemap: "linked",
    plugins: [
      esbuildPluginPino({ transports: ["pino-pretty"] })
    ],
    banner: {
      js: `import { createRequire as __bannerCrReq } from 'node:module';
import __bannerPath from 'node:path';
import __bannerUrl from 'node:url';

globalThis.require = __bannerCrReq(import.meta.url);
globalThis.__filename = __bannerUrl.fileURLToPath(import.meta.url);
globalThis.__dirname = __bannerPath.dirname(globalThis.__filename);
    `,
    },
  });

  await copyRuntimeAssets(distDir);
  console.log("[build] runtime assets copied");
}

buildAll().catch((err) => {
  console.error(err);
  process.exit(1);
});
