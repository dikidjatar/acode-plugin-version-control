function Err(name: string, msg: string = 'Unknown Error') {
  return class extends Error {
    code: string;
    constructor(...args: Array<string>) {
      super(...args);
      this.code = name;
      if (this.message) {
        this.message = name + ": " + this.message;
      } else {
        this.message = getErrorMessage(this.code, msg);
      }
    }
  };
}

// FILE ERROR
export const EEXIST = Err("EEXIST");
export const ENOENT = Err("ENOENT");
export const ENOTDIR = Err("ENOTDIR");
export const ENOTEMPTY = Err("ENOTEMPTY");
export const ETIMEDOUT = Err("ETIMEDOUT");
export const EACCES = Err("EACCES");
export const EISDIR = Err("EISDIR");

export const REPOERROR = Err('REPOERROR');
export const NO_FOLDER_SELECTED = Err("NO_FOLDER_SELECTED");
export const MULTIPLE_FOLDER_SELECTED = Err("MULTIPLE_FOLDER_SELECTED");
export const REPO_NOT_FOUND = Err("REPO_NOT_FOUND");
export const REPO_NOT_INITIALIZED = Err("REPO_NOT_INITIALIZED");
export const REPO_HAS_INITIALIZED = Err("REPO_HAS_INITIALIZED");

export class RepoError extends Error {
  constructor(public code: string) {
    super();
    this.name = 'RepoError';
  }
  static [Symbol.hasInstance](instance: any) {
    return instance && instance.code !== undefined;
  }
}

function getErrorMessage(code: string, defalutValue: string | undefined = undefined): string {
  switch (code) {
    case 'REPOERROR':
      return 'Repository Error';
    case 'NO_FOLDER_SELECTED':
      return 'No folder is currently selected.';
    case 'MULTIPLE_FOLDER_SELECTED':
      return 'Multiple folders are selected.';
    case 'REPO_NOT_FOUND':
      return 'Git repository not found.';
    case 'REPO_NOT_INITIALIZED':
      return 'Git repository not initialized.';
    case 'REPO_HAS_INITIALIZED':
      return 'The selected folder is already a Git repository. Please refresh.';
    default:
      if (defalutValue) {
        return defalutValue;
      }
      return 'Unknown error';
  }
}

export function setError(error: any) {
  const $repoError = document.getElementById('repo-error');
  if ($repoError) {
    $repoError.style.padding = '10px'
    $repoError.innerHTML = error.message;
  }
}

export function clearError() {
  const $repoError = document.getElementById('repo-error');
  if ($repoError) {
    $repoError.style.padding = '0';
    $repoError.style.display = 'none';
    $repoError.innerHTML = '';
  }
}