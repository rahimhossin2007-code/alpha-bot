import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build as esbuild } from "esbuild";
import esbuildPluginPino from "esbuild-plugin-pino";
import { rm, readFile, writeFile } from "node:fs/promises";

// Plugins (e.g. 'esbuild-plugin-pino') may use `require` to resolve dependencies
globalThis.require = createRequire(import.meta.url);

const artifactDir = path.dirname(fileURLToPath(import.meta.url));

const FCA_BASE = new URL(
  "../../node_modules/.pnpm/fca-unofficial@1.3.10/node_modules/fca-unofficial/",
  import.meta.url
).pathname;

async function patchFcaUnofficial() {
  // ── Patch 1: utils.js — modern fb_dtsg extraction (DTSGInitData) ──────────
  try {
    const p = FCA_BASE + "utils.js";
    let src = await readFile(p, "utf8");
    const OLD = `getFrom(html, 'name="fb_dtsg" value="', '"');`;
    if (!src.includes("DTSGInitData") && src.includes(OLD)) {
      src = src.replace(
        OLD,
        `getFrom(html, 'name="fb_dtsg" value="', '"') ` +
        `|| (html.match(/\\["DTSGInitData",\\[\\],\\{"token":"([^"]+)"/) || [])[1] ` +
        `|| (html.match(/"dtsg":\\{"token":"([^"]+)"/) || [])[1] ` +
        `|| (html.match(/"token":"(AQ[A-Za-z0-9_\\-]{10,})"/) || [])[1] ` +
        `|| '';`
      );
      await writeFile(p, src, "utf8");
      console.log("[patch] fca-unofficial utils.js: fb_dtsg extraction patched");
    } else {
      console.log("[patch] fca-unofficial utils.js: already patched");
    }
  } catch (e) {
    console.warn("[patch] utils.js patch failed:", e.message);
  }

  // ── Patch 2: index.js — fallback to mbasic.facebook.com on blocked GETs ──
  try {
    const p = FCA_BASE + "index.js";
    let src = await readFile(p, "utf8");
    const OLD2 = `mainPromise = utils
      .get('https://www.facebook.com/', jar, null, globalOptions, { noRef: true })
      .then(utils.saveCookies(jar));`;
    if (!src.includes("Fallback: www.facebook.com is blocked") && src.includes(OLD2)) {
      src = src.replace(
        OLD2,
        `mainPromise = utils
      .get('https://www.facebook.com/', jar, null, globalOptions, { noRef: true })
      .then(utils.saveCookies(jar))
      .then(function(res) {
        // Fallback: www.facebook.com is blocked from datacenter IPs -> try mbasic
        if (!res || !res.body || res.body.length < 5000 || res.body.indexOf('Sorry, something went wrong') > -1) {
          return utils.get('https://mbasic.facebook.com/', jar, null, globalOptions, { noRef: true }).then(utils.saveCookies(jar));
        }
        return res;
      });`
      );
      await writeFile(p, src, "utf8");
      console.log("[patch] fca-unofficial index.js: mbasic fallback patched");
    } else {
      console.log("[patch] fca-unofficial index.js: already patched");
    }
  } catch (e) {
    console.warn("[patch] index.js patch failed:", e.message);
  }

  // ── Patch 3: listenMqtt.js — handle non-array graphqlbatch response ───────
  try {
    const p = FCA_BASE + "src/listenMqtt.js";
    let src = await readFile(p, "utf8");
    if (!src.includes("Handle both array format")) {
      const OLD3 = `        if (utils.getType(resData) != "Array") {
          throw {
            error: "Not logged in",
            res: resData
          };
        }

        if (resData && resData[resData.length - 1].error_results > 0) {
          throw resData[0].o0.errors;
        }

        if (resData[resData.length - 1].successful_results === 0) {
          throw { error: "getSeqId: there was no successful_results", res: resData };
        }

        if (resData[0].o0.data.viewer.message_threads.sync_sequence_id) {
          ctx.lastSeqId = resData[0].o0.data.viewer.message_threads.sync_sequence_id;
          listenMqtt(defaultFuncs, api, ctx, globalCallback);
        } else {
          throw { error: "getSeqId: no sync_sequence_id found.", res: resData };
        }`;
      const NEW3 = `        // Handle both array format (with fb_dtsg) and object format (without fb_dtsg)
        var seqData = null;
        if (utils.getType(resData) === "Array") {
          if (resData && resData[resData.length - 1].error_results > 0) throw resData[0].o0.errors;
          if (resData[resData.length - 1].successful_results === 0) throw { error: "getSeqId: there was no successful_results", res: resData };
          seqData = resData[0];
        } else if (resData && resData.o0) {
          seqData = resData; // non-array format when fb_dtsg missing
        } else if (resData && typeof resData.error === 'number') {
          // Facebook API error (not auth) - use fallback seqID
          log.warn("getSeqId", "Facebook API error " + resData.error + " - using fallback seqID");
          ctx.lastSeqId = String(Date.now());
          return listenMqtt(defaultFuncs, api, ctx, globalCallback);
        } else {
          throw { error: "Not logged in", res: resData };
        }
        if (seqData && seqData.o0 && seqData.o0.data && seqData.o0.data.viewer &&
            seqData.o0.data.viewer.message_threads && seqData.o0.data.viewer.message_threads.sync_sequence_id) {
          ctx.lastSeqId = seqData.o0.data.viewer.message_threads.sync_sequence_id;
          listenMqtt(defaultFuncs, api, ctx, globalCallback);
        } else {
          // seqID null/missing - use fallback
          log.warn("getSeqId", "sync_sequence_id null - using fallback seqID");
          ctx.lastSeqId = String(Date.now());
          listenMqtt(defaultFuncs, api, ctx, globalCallback);
        }`;
      if (src.includes(OLD3)) {
        src = src.replace(OLD3, NEW3);
        await writeFile(p, src, "utf8");
        console.log("[patch] fca-unofficial listenMqtt.js: non-array response patched");
      } else {
        console.log("[patch] fca-unofficial listenMqtt.js: pattern not found");
      }
    } else {
      console.log("[patch] fca-unofficial listenMqtt.js: already patched");
    }
  } catch (e) {
    console.warn("[patch] listenMqtt.js patch failed:", e.message);
  }
}

async function buildAll() {
  await patchFcaUnofficial();
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
    // Some packages may not be bundleable, so we externalize them, we can add more here as needed.
    // Some of the packages below may not be imported or installed, but we're adding them in case they are in the future.
    // Examples of unbundleable packages:
    // - uses native modules and loads them dynamically (e.g. sharp)
    // - use path traversal to read files (e.g. @google-cloud/secret-manager loads sibling .proto files)
    external: [
      "*.node",
      "fca-unofficial",
      "chokidar",
      "ws",
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
      // pino relies on workers to handle logging, instead of externalizing it we use a plugin to handle it
      esbuildPluginPino({ transports: ["pino-pretty"] })
    ],
    // Make sure packages that are cjs only (e.g. express) but are bundled continue to work in our esm output file
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
}

buildAll().catch((err) => {
  console.error(err);
  process.exit(1);
});
