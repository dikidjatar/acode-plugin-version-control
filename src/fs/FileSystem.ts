import { PromiseFs } from "./PromiseFs";
import once from "just-once";

export interface ReadFileOptions {
  encoding?: 'utf8'
}

export interface WriteFileOptions {
  /**
   * Posix mode permissions
   * @default 0o777
   */
  mode: number
  encoding?: 'utf8'
}

export interface MKDirOptions {
  /**
   * Posix mode permissions
   * @default 0o777
   */
  mode: number
  recursive: boolean
}

export interface Stats {
  type: 'file' | 'dir'
  mode: any
  size: number
  ino: any
  mtimeMs: any
  ctimeMs: any
  uid: 1
  gid: 1
  dev: 1
  isFile(): boolean
  isDirectory(): boolean
  isSymbolicLink(): boolean
}

export interface AcodeStat {
  exists: boolean;
  canRead: boolean;
  canWrite: boolean;
  name: string;
  length: number;
  isDirectory: boolean;
  isFile: boolean;
  isVirtual: boolean;
  lastModified: number;
  type: string;
  url: string;
  /**
   * @deprecated
   */
  uri: string;
}

export interface FsClient {
  readFile(
    path: string,
    options: ReadFileOptions | undefined,
    cb: (err: Error, data: Uint8Array | string) => void
  ): void

  writeFile(
    path: string,
    data: Uint8Array | string,
    options: WriteFileOptions | undefined | string,
    cb: (err: Error) => void
  ): void

  unlink(path: string, cb: (err: Error) => void): void
  readdir(path: string, options: undefined, cb: (err: Error, data: string[]) => void): void
  mkdir(path: string, options: MKDirOptions | undefined, cb: (err: Error) => void): void;
  rmdir(path: string, options: undefined, cb: (err: Error) => void): void
  rename(oldFilepath: string, newFilepath: string, cb: (err: Error) => void): void
  stat(path: string, options: undefined, cb: (err: Error, stats: Stats) => void): void
  lstat(path: string, options: undefined, cb: (err: Error, stats: Stats) => void): void

  symlink(target: string, path: string, cb: (err: Error) => void): void
  readlink(path: string, options: undefined, cb: (err: Error, linkString: string) => void): void

  readonly promises: FsClientPromise
}

export interface FsClientPromise {
  readFile(path: string, options?: ReadFileOptions | string): Promise<Uint8Array | string>
  writeFile(path: string, data: Uint8Array | string, options?: WriteFileOptions | string): Promise<void>
  unlink(path: string, options?: undefined): Promise<void>
  readdir(path: string, options?: undefined): Promise<string[]>
  mkdir(path: string, options?: MKDirOptions): Promise<string | undefined>
  rmdir(path: string, options?: undefined): Promise<void>
  rename(oldPath: string, newPath: string): Promise<void>
  stat(path: string, options?: undefined): Promise<Stats>
  lstat(path: string, options?: undefined): Promise<Stats>

  symlink(target: string, path: string): Promise<void>
  readlink(path: string, options?: undefined): Promise<string>

  createFile(path: string): Promise<string>
}

function wrapCallback(opts: any, cb: any = undefined) {
  if (typeof opts === "function") {
    cb = opts;
  }
  cb = once(cb);
  const resolve = (...args: any) => cb(null, ...args)
  return [resolve, cb];
}

export class FileSystem implements FsClient {
  promises: FsClientPromise;

  constructor() {
    this.promises = new PromiseFs();
    this.readFile = this.readFile.bind(this);
    this.writeFile = this.writeFile.bind(this);
    this.unlink = this.unlink.bind(this);
    this.readdir = this.readdir.bind(this);
    this.mkdir = this.mkdir.bind(this);
    this.rmdir = this.rmdir.bind(this);
    this.rename = this.rename.bind(this);
    this.stat = this.stat.bind(this);
    this.lstat = this.lstat.bind(this);
    this.symlink = this.symlink.bind(this);
    this.readlink = this.readlink.bind(this);
  }

  writeFile(path: string, data: Uint8Array | string, options: WriteFileOptions | undefined | string, cb: (err: Error) => void): void {
    const [resolve, reject] = wrapCallback(options, cb);
    this.promises.writeFile(path, data, options).then(resolve).catch(reject);
  }

  readFile(path: string, options: ReadFileOptions | undefined, cb: (err: Error, data: Uint8Array | string) => void): void {
    const [resolve, reject] = wrapCallback(options, cb);
    this.promises.readFile(path, options).then(resolve).catch(reject);
  }

  unlink(path: string, cb: (err: Error) => void): void {
    const [resolve, reject] = wrapCallback(undefined, cb);
    this.promises.unlink(path).then(resolve).catch(reject);
  }

  readdir(path: string, options: undefined, cb: (err: Error, data: string[]) => void): void {
    const [resolve, reject] = wrapCallback(options, cb);
    this.promises.readdir(path, options).then(resolve).catch(reject);
  }

  mkdir(path: string, options: MKDirOptions | undefined, cb: (err: Error) => void): void {
    const [resolve, reject] = wrapCallback(options, cb);
    this.promises.mkdir(path, options).then(resolve).catch(reject);
  }

  rmdir(path: string, options: undefined, cb: (err: Error) => void): void {
    const [resolve, reject] = wrapCallback(options, cb);
    this.promises.rmdir(path, options).then(resolve).catch(reject);
  }

  rename(oldFilepath: string, newFilepath: string, cb: (err: Error) => void): void {
    const [resolve, reject] = wrapCallback(cb);
    this.promises.rename(oldFilepath, newFilepath).then(resolve).catch(reject);
  }

  stat(path: string, options: undefined, cb: (err: Error, stats: Stats) => void): void {
    const [resolve, reject] = wrapCallback(options, cb);
    this.promises.stat(path, options).then(resolve).catch(reject);
  }

  lstat(path: string, options: undefined, cb: (err: Error, stats: Stats) => void): void {
    const [resolve, reject] = wrapCallback(options, cb);
    this.promises.lstat(path, options).then(resolve).catch(reject);
  }

  symlink(target: string, path: string, cb: (err: Error) => void): void {
    throw new Error("symlink not supported.");
  }

  readlink(path: string, options: undefined, cb: (err: Error, linkString: string) => void): void {
    throw new Error("readlink not supported.");
  }

}