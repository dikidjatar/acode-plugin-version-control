import * as FileSystem from "./FileSystem";
import pathUtil from './path';
import { EEXIST, ENOENT, ENOTDIR } from '../errors';

const fileSystem = acode.require('fsOperation');

type FileOptions = {
  encoding?: string;
  [key: string]: any;
};

function cleanParamsFilepathOpts(
  filepath: string,
  opts?: FileOptions | string | Function,
  ...rest: any[]
): [string, FileOptions, ...any[]] {

  filepath = pathUtil.normalize(filepath);

  // Strip out callbacks
  if (typeof opts === "undefined" || typeof opts === "function") {
    opts = {};
  }

  if (typeof opts === "string") {
    opts = {
      encoding: opts,
    };
  }

  return [filepath, opts as FileOptions, ...rest];
}

function cleanParamsFilepathDataOpts(
  filepath: string,
  data: any,
  opts?: FileOptions | string | Function,
  ...rest: any[]
): [string, any, FileOptions, ...any[]] {

  filepath = pathUtil.normalize(filepath);

  if (typeof opts === "undefined" || typeof opts === "function") {
    opts = {};
  }

  if (typeof opts === "string") {
    opts = {
      encoding: opts,
    };
  }

  return [filepath, data, opts as FileOptions, ...rest];
}

function cleanParamsFilepathFilepath(
  oldFilepath: string,
  newFilepath: string,
  ...rest: any[]
): [string, string, ...any[]] {
  return [
    pathUtil.normalize(oldFilepath),
    pathUtil.normalize(newFilepath),
    ...rest
  ];
}

function convertAcodeToGitStat(acodeStat: FileSystem.AcodeStat): FileSystem.Stats {
  return {
    type: acodeStat.isDirectory ? 'dir' : 'file',
    mode: 0o777, // Default mode
    size: acodeStat.length,
    ino: 0, // Acode stat doesn't provide inode
    mtimeMs: acodeStat.lastModified,
    ctimeMs: acodeStat.lastModified, // Acode API doesn't have creation time, reuse modified time
    uid: 1, // not provided by Acode API
    gid: 1, // not provided by Acode API
    dev: 1, // not provided by Acode API
    isFile: () => acodeStat.isFile,
    isDirectory: () => acodeStat.isDirectory,
    isSymbolicLink: () => false, // Acode API doesn't support symbolic links
  };
}

function encode(data: string): Uint8Array<ArrayBuffer> {
  return new Uint8Array(Buffer.from(data, 'utf8'));
}

function decode(data: ArrayBuffer) {
  return Buffer.from(data).toString('utf8');
}

// TODO: remake it better
export class PromiseFs implements FileSystem.FsClientPromise {

  constructor() {
    this.readFile = this._wrap(this.readFile, cleanParamsFilepathDataOpts);
    this.writeFile = this._wrap(this.writeFile, cleanParamsFilepathDataOpts);
    this.unlink = this._wrap(this.unlink, cleanParamsFilepathOpts);
    this.readdir = this._wrap(this.readdir, cleanParamsFilepathOpts);
    this.mkdir = this._wrap(this.mkdir, cleanParamsFilepathOpts);
    this.rmdir = this._wrap(this.rmdir, cleanParamsFilepathOpts);
    this.rename = this._wrap(this.rename, cleanParamsFilepathFilepath);
    this.stat = this._wrap(this.stat, cleanParamsFilepathOpts);
    this.lstat = this._wrap(this.lstat, cleanParamsFilepathOpts);
    this.readlink = this._wrap(this.readlink, cleanParamsFilepathOpts);
    this.symlink = this._wrap(this.symlink, cleanParamsFilepathFilepath);
  }

  private _wrap<T>(
    fn: (...args: any[]) => Promise<T>,
    paramCleaner: (...args: any[]) => any[]
  ) {
    return async (...args: any[]): Promise<T> => {
      args = paramCleaner(...args);
      try {
        return await fn.apply(this, args);
      } finally { }
    };
  }

  async readFile(
    path: string,
    options?: FileSystem.ReadFileOptions | string
  ): Promise<Uint8Array | string> {
    const encoding = typeof options == 'string' ? options : options?.encoding;
    if (encoding && encoding != 'utf8') {
      throw new Error('Only "utf8" encoding is supported in readFile');
    }

    let data: Uint8Array;
    let stat: FileSystem.AcodeStat | null = null;

    try {
      stat = await this._stat(path);
      const result: ArrayBuffer = await fileSystem(pathUtil.pathToUri(path)).readFile();
      data = new Uint8Array(result);
    } catch (err) {
      if (typeof err == 'string' && err.includes('EISDIR')) {
        throw new ENOENT(path);
      }
      throw err;
    }

    if (encoding === 'utf8') {
      return decode(data);
    } else {
      data.toString = () => decode(data);
    }

    return data;
  }

  async writeFile(
    path: string,
    data: Uint8Array | string,
    options?: FileSystem.WriteFileOptions | string
  ): Promise<void> {
    if (typeof data === 'string') {
      data = encode(data);
    }

    try {
      path = pathUtil.pathToUri(path);
      if (!await fileSystem(path).exists()) {
        await this.createFile(path)
      }
      await fileSystem(path).writeFile(data.buffer);
    } catch (err) {
      throw err;
    }
  }

  async unlink(path: string, options?: undefined): Promise<void> {
    try {
      const stat = await this._stat(path);
      if (stat.exists) {
        await fileSystem(pathUtil.pathToUri(path)).delete();
      }
    } catch (err: any) {
      err.caller = 'PromiseFs.unlink()'
      console.error(err);
    }
  }

  async readdir(path: string, options?: undefined): Promise<string[]> {
    const stat = await this._stat(path);
    if (!stat.isDirectory) throw new ENOTDIR();
    const dirs = await fileSystem(pathUtil.pathToUri(path)).lsDir();
    const dirnames = dirs.map((obj: any) => obj.name);
    return dirnames;
  }

  async mkdir(path: string, options?: FileSystem.MKDirOptions): Promise<string | undefined> {
    const stat = await this._stat(path);
    if (stat.exists) throw new EEXIST();

    path = pathUtil.pathToUri(path);
    const dirname = pathUtil.dirname(path);
    const basename = pathUtil.basename(path);

    try {
      return await fileSystem(dirname).createDirectory(basename);
    } catch (error) {
      if (typeof error === 'string' && error.includes('java.io.FileNotFoundException')) {
        throw new ENOENT();
      }
    }
  }

  async rmdir(path: string, options?: undefined): Promise<void> {
    return await this.unlink(path, options);
  }

  async rename(oldPath: string, newPath: string): Promise<void> {
    const basename = pathUtil.basename(newPath);
    const entry = await this._stat(oldPath);
    await fileSystem(entry.url).renameTo(basename);
  }

  private async _stat(path: string): Promise<FileSystem.AcodeStat> {
    const stat: FileSystem.AcodeStat = fileSystem(pathUtil.pathToUri(path)).stat();
    return stat;
  }

  async stat(path: string, options?: undefined): Promise<FileSystem.Stats> {
    const acodeStat = await this._stat(path);
    if (!acodeStat.exists) throw new ENOENT();
    return convertAcodeToGitStat(acodeStat);
  }

  async lstat(path: string, options?: undefined): Promise<FileSystem.Stats> {
    return await this.stat(path);
  }

  symlink(target: string, path: string): Promise<void> {
    throw new Error("symlink not supported.");
  }

  readlink(path: string, options?: undefined): Promise<string> {
    throw new Error("readlink not supported");
  }

  async createFile(path: string): Promise<string> {
    const dirname = pathUtil.dirname(path);
    const filename = pathUtil.basename(path);
    return await fileSystem(dirname).createFile(filename, '');
  }
}