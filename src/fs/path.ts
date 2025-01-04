function normalizePath(path: string): string {
  if (!path) return ".";

  const stack: string[] = [];
  for (const part of path.split('/')) {
    if (part === "." || !part) continue;
    if (part === "..") {
      if (stack.length === 0 || stack[stack.length - 1] === "..") {
        stack.push("..");
      } else if (stack[stack.length - 1] !== "/") {
        stack.pop();
      }
    } else {
      stack.push(part);
    }
  }

  const normalized = stack.join("/");
  return path.startsWith("/") ? "/" + normalized : normalized || ".";
}

function dirname(path: string): string {
  if (!path.includes("/")) throw new Error(`Invalid path: "${path}"`);
  return path.replace(/\/[^/]*$/, "") || "/";
}

function basename(path: string) {
  if (path === "/") throw new Error(`Cannot get basename of "${path}"`);
  const last = path.lastIndexOf("/");
  if (last === -1) return path;
  return path.slice(last + 1);
}

function joinPath(...parts: string[]) {
  if (parts.length === 0) return "";
  let path = parts.join("/");
  path = path.replace(/\/{2,}/g, "/");
  return path;
}

function splitPath(path: string): Array<string> {
  if (path.length === 0) return [];
  let parts = path.split("/");
  if (parts[parts.length - 1] === '') {
    parts.pop();
  }
  if (path[0] === "/") {
    parts[0] = "/";
  } else {
    if (parts[0] === ".") {
      parts.shift();
    }
  }
  return parts;
}

function resolvePath(...paths: string[]) {
  let resolved = "";
  for (let path of paths) {
    if (!path) continue;
    if (!resolved) {
      resolved = path;
      continue;
    }
    if (path.startsWith("/")) {
      resolved = path;
    } else {
      resolved = normalizePath(joinPath(resolved, path));
    }
  }
  return resolved;
}

function uriToPath(uri: string): string {
  if (decodeURIComponent(uri).includes('/document/primary:')) {
    uri = decodeURIComponent(uri);
    const parts = uri.split(':');
    let path = parts[parts.length - 1];
    if (!path.startsWith('/')) {
      path = '/' + path;
    }
    return path;
  }
  const [, second] = uri.split('::');
  return second.replace('primary:', '/')
}

function pathToUri(path: string): string {
  if (path.startsWith("/storage/emulated/0/")) {
    path = path.replace("/storage/emulated/0", "");
  }
  const segments = path.split("/");
  const storageId = segments[1];
  const relativePath = segments.slice(1).join("/");
  return `content://com.android.externalstorage.documents/tree/primary:${storageId}::primary:${relativePath}`;
}

export default {
  dirname,
  basename,
  join: joinPath,
  split: splitPath,
  resolve: resolvePath,
  normalize: normalizePath,
  uriToPath,
  pathToUri
};