#!/usr/bin/env node
/**
 * Copies sw.template.js → public/sw.js with a unique build ID injected.
 *
 * Runs automatically as part of `npm run build`.
 *
 * The browser byte-compares the SW file to decide whether to install a new one.
 * By injecting a fresh build ID every time, we guarantee that every build
 * triggers a SW update — no manual version bumping needed.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { randomBytes } from "node:crypto";

const __dirname = dirname(fileURLToPath(import.meta.url));
const templatePath = resolve(__dirname, "../public/sw.template.js");
const outputPath = resolve(__dirname, "../public/sw.js");

const buildId = `${Date.now()}-${randomBytes(4).toString("hex")}`;

let content = readFileSync(templatePath, "utf-8");
content = content.replace(/__BUILD_ID__/g, buildId);

writeFileSync(outputPath, content, "utf-8");

console.log(`[sw] Injected build ID: ${buildId}`);
