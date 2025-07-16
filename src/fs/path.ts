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
  if (uri.startsWith('content://com.android.externalstorage.documents/tree/primary')) {
    if (uri.indexOf('::') === -1) {
      let path = decodeURIComponent(uri).split('primary:')[1];
      if (!path.startsWith('/')) path = '/' + path;

      return path;
    }

    let path = uri.split('::primary:')[1];
    if (!path.startsWith('/')) path = '/' + path;
    return path;
  } else if (uri.startsWith('content://com.termux.documents/tree')) {
    if (uri.indexOf('::') === -1) {
      /**
       * 1. Decoded URI -> content://com.termux.documents/tree//data/data/com.termux/files/home/test-repo
       * 2. splitted by "//" ->
       * [
          'content:',
          'com.termux.documents/tree',
          'data/data/com.termux/files/home/test-repo'
         ] (selected 2nd element on 0-based index array)
         3. replaces "data/data/com.termux/files/home" -> "/$HOME" (i.e: "content://com.termux.documents/tree//data/data/com.termux/files/home/test-repo" -> "/$HOME/test-repo")
       */
      const path = decodeURIComponent(uri).split('//')[2]?.replace('data/data/com.termux/files/home', '/$HOME');
      return path.length ? `${path.startsWith("/") ? path : "/" + path}` : '/$HOME';
    };
    const pathSegments = uri.split('::');
    // Used to determine if the URI's base path (The one that app has access)is the Termux home directory
    const isTermuxHomeBasePath = pathSegments[0].includes('com.termux.documents/tree/%2Fdata%2Fdata%2Fcom.termux%2Ffiles%2Fhome');
    let path = uri.split('::')[1]
      .replace('/data/data/com.termux/files/home', `/$HOME${isTermuxHomeBasePath ? '_BASEDIR' : ''}`);
    return path;
  } else if (uri.startsWith('file:///storage/emulated/0/')) {
    return uri.replace('file:///storage/emulated/0/', '');
  }
  throw new Error('Unsupported URI');
}

function pathToUri(path: string): string {
  if (path.startsWith('/$HOME')) {
    let path2 = path.replace(/\/\$HOME(_BASEDIR)?/g, '');
    if (!path2.startsWith('/')) path2 = '/' + path2;

    const storedGitRepoDir = localStorage.getItem('gitRepoDir')?.replace(/\/\$HOME(_BASEDIR)?/g, '') ?? path2.substring(0, path2.lastIndexOf('/'));

    let termuxUri = `content://com.termux.documents/tree/%2Fdata%2Fdata%2Fcom.termux%2Ffiles%2Fhome${path2.length && !path.includes("$HOME_BASEDIR") && storedGitRepoDir ? encodeURIComponent(storedGitRepoDir) : ''}::/data/data/com.termux/files/home`;
    return termuxUri + path2;
  }
  const segments = path.split("/");
  // const storedGitRepoDir = localStorage.getItem('gitRepoDir')?.slice(1)?.replace(/\//g, "%2F") || segments[1];
  const relativePath = segments.slice(1).join("/");

  const result = `content://com.android.externalstorage.documents/tree/primary:${segments[1]}::primary:${relativePath}`;
  return result;
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
