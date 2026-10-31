import fs from "node:fs";
import path from "node:path";
import { register } from "node:module";
import { pathToFileURL, fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export async function resolve(specifier, context, nextResolve) {
  let target = specifier;

  if (
    specifier.startsWith("next/") &&
    !specifier.endsWith(".js") &&
    !specifier.endsWith(".mjs")
  ) {
    return nextResolve(`${specifier}.js`, context);
  }

  if (specifier.startsWith("@/")) {
    target = pathToFileURL(path.join(rootDir, specifier.slice(2))).href;
  } else if (
    (specifier.startsWith("./") || specifier.startsWith("../")) &&
    context.parentURL
  ) {
    const parentDir = path.dirname(fileURLToPath(context.parentURL));
    const resolvedBase = path.resolve(parentDir, specifier);
    for (const candidate of [
      resolvedBase,
      `${resolvedBase}.ts`,
      `${resolvedBase}.tsx`,
      path.join(resolvedBase, "index.ts"),
    ]) {
      if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
        return nextResolve(pathToFileURL(candidate).href, context);
      }
    }
  }

  if (target.startsWith("file://")) {
    const filePath = fileURLToPath(target);
    for (const candidate of [
      filePath,
      `${filePath}.ts`,
      `${filePath}.tsx`,
      path.join(filePath, "index.ts"),
    ]) {
      if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
        return nextResolve(pathToFileURL(candidate).href, context);
      }
    }
  }

  return nextResolve(target, context);
}

register(import.meta.url, pathToFileURL("./"));
