import plugin from '../plugin.json';
import git from 'isomorphic-git';
import http from 'isomorphic-git/http/web';
import { Buffer } from 'buffer';
import { FileSystem } from './fs/FileSystem';
import { FsClient, FsClientPromise } from './fs/FileSystem';
import pathUtil from './fs/path';
import {
  clearError,
  ENOENT,
  MULTIPLE_FOLDER_SELECTED,
  NO_FOLDER_SELECTED,
  REPO_HAS_INITIALIZED,
  setError
} from './errors';
import {
  DomHelpers,
  FileStatus,
  FileStatusRenderer,
  Header,
  LinearProgress,
  LinearProgressIndicator,
  RepoUnavailable,
  SourceControl
} from './UIComponents';
import tag from 'html-tag-js';
import './styles/styles.scss';
import { WCPage } from 'acode/editor/page';

const alert = acode.require('alert');
const sidebarApps = acode.require('sidebarApps');
const select = acode.require('select');
const loader = acode.require('loader');
const prompt = acode.require('prompt');
const multiPrompt = acode.require('multiPrompt');
const appSettings: any = acode.require('settings');
const confirm = acode.require('confirm');
const DialogBox = acode.require('dialogBox');
const fileBrowser = acode.require('fileBrowser');
const EditorFile: any = acode.require('editorFile')

//@ts-ignore
window.Buffer = Buffer;
//@ts-ignore
window.fs = new FileSystem();
//@ts-ignore
window.pfs = window.fs.promises;

declare var fs: FsClient;
declare var pfs: FsClientPromise;

enum Settings {
  GithubToken = 'githubToken'
}

enum State {
  Idle,
  LOADING,
  ERROR
}

const CORS_PROXY = "https://cors.isomorphic-git.org";
const GIT_COMMANDS = Object.freeze(
  [
    'clone',
    'checkout',
    'pull',
    'push',
    'pullPush',
    'fetch',
    'branch',
    'remote',
    'config'
  ]
);

class VersionControl {
  public baseUrl: string | undefined;

  private $mainStyle?: HTMLLinkElement;
  private progresIndicator: LinearProgress;

  private state: State;
  private lastDir?: string;
  private pendingFileChanges: FileStatus[];
  private fileStatus: FileStatus[];

  constructor() {
    if (!appSettings.value[plugin.id]) {
      appSettings.value[plugin.id] = {
        [Settings.GithubToken]: ''
      };
      appSettings.update();
    }

    this.progresIndicator = LinearProgressIndicator();
    this.state = State.Idle;
    this.pendingFileChanges = [];
    this.fileStatus = [];
  }

  async init(
    $page: WCPage,
    cacheFile: any,
    cacheFileUrl: string
  ) {
    try {
      this.$mainStyle = tag('link', {
        rel: "stylesheet",
        href: this.baseUrl + "main.css"
      });
      document.head.append(this.$mainStyle);
      acode.addIcon('vcs-icon', this.baseUrl + 'assets/source-control.svg');

      window.addEventListener('click', this.refresh.bind(this));
      document.addEventListener("resume", this.gitStatus.bind(this), false);

      sidebarApps.add('vcs-icon', 'vcs-sidebar', 'Version Control', (app: HTMLElement) => {
        const $repoError = tag('p', { id: 'repo-error' }); // elemnt for show error

        /** HEADER */
        const $header = Header.create({
          onRefresh: this.gitStatus.bind(this),
          onMenuClick: this.handleCommandMenu.bind(this)
        });

        /** REPOSITORY UNAVAILABLE */
        const $repoUnavailable = RepoUnavailable.create({
          onInit: ({ target }: Event) => {
            const el = (target as HTMLElement);
            el.innerHTML = 'Initialize...'
            this.initializeRepository()
              .then(() => el.innerHTML = 'Initialize Repository')
              .catch(() => el.innerHTML = 'Initialize Repository')
          },
          onClone: this.gitClone.bind(this)
        });

        /** SOURCE CONTROL */
        const $sourceControl = SourceControl.create({
          onBranchClick: () => this.gitListBranches.bind(this)(false),
          onCommitClick: this.gitCommit.bind(this)
        });

        app.append(
          $header,
          this.progresIndicator,
          $repoError,
          $repoUnavailable,
          $sourceControl
        );
      });
    } catch (error: any) {
      error.caller = 'VersionControl.init()'
      console.error(error);
    }
  }

  private async handleCommandMenu() {
    const actionMap = {
      clone: this.gitClone,
      checkout: this.gitListBranches,
      pull: this.gitPull,
      push: this.gitPush,
      pullPush: this.gitPullPush,
      fetch: this.gitFetch,
      branch: this.gitListBranches,
      remote: this.gitRemote,
      config: this.gitConfig
    }

    //@ts-ignore
    const command: keyof typeof actionMap = await select(
      'Git Commands', GIT_COMMANDS.map(cmd => [cmd, cmd]),
      {
        hideOnSelect: true,
        textTransform: true
      }
    );

    if (!command) return;

    try {
      await actionMap[command]?.bind(this)();
    } catch (error) {
      console.error(`Error executing ${command}:`, error);
    }
  }

  private async gitStatus() {
    if (this.state === State.LOADING) return;

    const $repoUnavailable = tag.get('.repo-unavailable');
    const $sourceControl = tag.get('.source-control');
    const $sourceFileList = tag.get('.source-control .list-files')!;
    const $actionBtnMore = tag.get('.vcs-header .actions .action-button.more');

    if (this.pendingFileChanges.length > 0) {
      FileStatusRenderer.render(
        this.pendingFileChanges,
        true, {
        onFileClick: this.showFileOptions.bind(this)
      }
      );
    }

    clearError();

    try {
      const dir = pathUtil.uriToPath(this.currentFolder.url);
      if (dir !== this.lastDir) {
        $sourceFileList.innerHTML = '';
        this.lastDir = dir;
        // Needed for pathToUri operation for knowing exact base Path
        // the App has access to.
        // As Android's SAF permissions are hierarchical & scoped.
        // i.e : `/storage/emulated/0/Android/data/com.termux/files/home/test-repo` permission to this URI would allow
        // access to it's subdirectories, not out of scope(i.e: `/storage/emulated/0/Android/data/com.termux/files/home`)
        
        // Hope this gets executed before IsRepository check - UnschooledGamer.
        localStorage.setItem("gitRepoDir", dir);
      }

      if (!(await this.isRepository(dir))) {
        DomHelpers.toggleVisibility($actionBtnMore, false);
        DomHelpers.toggleVisibility($repoUnavailable, true);
        DomHelpers.toggleVisibility($sourceControl, false);
        return;
      }

      this.setLoadingState(true);
      DomHelpers.toggleVisibility($actionBtnMore, true);
      DomHelpers.toggleVisibility($repoUnavailable, false);
      DomHelpers.toggleVisibility($sourceControl, true);

      const branch = await git.currentBranch({ fs: pfs, dir });
      this.updateBranchName(branch);

      const fileStatus = await this.getAllFilesStatus(dir);

      tag.get('.commit-btn')?.classList.toggle('disabled', !fileStatus.length);

      FileStatusRenderer.render(fileStatus, false, {
        onFileClick: this.showFileOptions.bind(this)
      });

      this.fileStatus = fileStatus;
      this.setLoadingState(false);

    } catch (error: any) {
      this.state = State.ERROR;
      this.progresIndicator.hide();
      DomHelpers.toggleVisibility($repoUnavailable, true);
      DomHelpers.toggleVisibility($sourceControl, false);
      setError(error);
    }
  }

  private setLoadingState(isLoading: boolean): void {
    this.state = isLoading ? State.LOADING : State.Idle;
    isLoading ? this.progresIndicator.show() : this.progresIndicator.hide();
  }

  /**
   * Updates the branch name displayed in the UI.
   *
   * @param branch - The name of the branch to display. If undefined or void, the existing branch name will be retained.
   */
  private updateBranchName(branch: string | undefined | void) {
    const branchLabelEl = tag.get('.action-item.branch .action-label');
    if (branchLabelEl) {
      branchLabelEl.innerHTML = branch || branchLabelEl.innerHTML;
    }
  }

  private get isSidebarActive(): boolean {
    const sidebar = tag.get('#sidebar');
    const isActive = tag.get('[data-id="vcs-sidebar"]')
      ?.classList.contains('active');

    return (sidebar != null) && (isActive || false);
  }

  /**
   * This method determines whether the sidebar should be loaded based on the event type,
   * 
   * @param {Event} e - The event object that triggered the refresh.
   */
  private refresh(e: Event) {
    const target = (e.target as HTMLElement);
    const dataId = target.dataset.id;
    const dataAction = target.dataset.action;
    const isSidebarActive = tag.get('[data-id="vcs-sidebar"]')
      ?.classList.contains('active');

    const shouldLoad = (
      e.type === 'touchend' && isSidebarActive ||
      (dataAction === 'sidebar-app' && dataId === 'vcs-sidebar') ||
      (target.getAttribute('action') === 'toggle-sidebar' && isSidebarActive)
    );

    if (shouldLoad) {
      this.gitStatus();
    }
  }

  private async gitURL({ dir, remote = 'origin' }: { dir: string, remote: string }) {
    // const remotes = await git.listRemotes({ fs: pfs, dir });
    // const url = remotes.find(r => r.remote === remote)?.url;
    // return url;
    return git.getConfig({ fs: pfs, dir, path: `remote.${remote}.url` });
  }

  private async showFileOptions(file: FileStatus) {
    const options = [
      file.isStaged ? ['unstage', 'Unstage changes'] : ['stage', 'Stage changes'],
      ['openfilehead', 'Open File (HEAD)']
    ];

    const action = await select(pathUtil.basename(file.filepath), options, {
      hideOnSelect: true,
      textTransform: true
    });

    if (!action) return;

    try {
      if (action === 'stage') {
        await this.stageChanges(file.filepath)
      } else if (action === 'unstage') {
        await this.unstageChanges(file.filepath);
      } else if (action === 'openfilehead') {
        await this.openFileHead(file.filepath);
      }
    } catch (error: any) {
      console.error(error);
      alert('Error', error.message);
    } finally {
      await this.gitStatus();
    }
  }

  private async unstageChanges(filepath: string) {
    await git.resetIndex({ fs: pfs, dir: this.currentDir, filepath });
  }

  private async stageChanges(filepath: string) {
    await git.add({ fs: pfs, dir: this.currentDir, filepath });
  }

  private async openFileHead(filepath: string) {
    const repo = { fs: pfs, dir: this.currentDir };
    const currentBranch = await git.currentBranch({ ...repo, fullname: false });
    const content = await this.readBranchFile({
      ...repo,
      filepath,
      branch: currentBranch || 'master'
    });
    const editorFile = new EditorFile(`${pathUtil.basename(filepath)} (HEAD)`, {
      editable: false,
      text: content
    });
    editorFile.readOnly = true;
    const { getModeForPath } = ace.require('ace/ext/modelist');
    const { name } = getModeForPath(pathUtil.basename(filepath));
    editorFile.setMode(`ace/mode/${name}`);
    //@ts-ignore
    editorFile.render();
  }

  private async readBranchFile({
    dir = this.currentDir,
    filepath,
    branch,
    isRemote
  }: {
    dir: string
    filepath: string;
    branch: string;
    isRemote?: boolean;
  }) {
    const ref = isRemote
      ? `refs/remotes/origin/${branch}`
      : `refs/heads/${branch}`;

    const sha = await git.resolveRef({ fs: pfs, dir, ref, });
    const { commit } = await git.readCommit({ fs: pfs, dir, oid: sha });
    const treeOid = commit.tree;

    const traverseTree = async (treeOid: string, pathParts: string[]): Promise<string> => {
      if (pathParts.length === 0) {
        throw new Error(`File ${filepath} not found`);
      }

      const [currentPart, ...remainingParts] = pathParts;
      const { tree } = await git.readTree({ fs: pfs, dir, oid: treeOid });
      const entry = tree.find(entry => entry.path === currentPart);
      if (!entry) {
        throw new Error(`File ${filepath} not found`);
      }

      if (entry.type === 'blob') {
        if (remainingParts.length === 0) {
          const { blob } = await git.readBlob({ fs: pfs, dir, oid: entry.oid });
          return new TextDecoder('utf8').decode(blob);
        } else {
          throw new Error(`Path ${filepath} is a file, not a directory`);
        }
      } else if (entry.type === 'tree') {
        return traverseTree(entry.oid, remainingParts);
      } else {
        throw new Error(`Unsupported entry type for ${currentPart}`);
      }
    };

    const pathParts = filepath.split('/');
    return await traverseTree(treeOid, pathParts);
  }

  private async getCredential(): Promise<{ username: any }> {
    let token = this.settings[Settings.GithubToken];
    if (!token) {
      token = await prompt('Token', '', 'text', {
        required: true,
        placeholder: 'Enter your github token',
      });
      if (token) {
        const saveToken = await confirm(
          'Info',
          'Do you want to save the token for future use?'
        );
        if (saveToken) {
          this.updateSetting(Settings.GithubToken, token);
        }
      }
    }
    return { username: token };
  }

  /**
   * This method fetches and groups the file statuses in a git repository
   * using `git.statusMatrix()`. It maps the file statuses to readable symbols
   * and groups files based on their staged and unstaged changes.
   * 
   * @see https://isomorphic-git.org/docs/en/statusMatrix
   * 
   * ⚠ WARNING:
   * - This method can be slow and inefficient, especially for large repositories.
   * - The use of `statusMatrix` involves recursive interaction with the file system,
   *   which makes it resource-intensive and time-consuming.
   * - Additionally, the caching and filtering logic here could be optimized to improve performance.
   * 
   * I'm sure that there are better ways to do this :)
   * 
   * 🤔 NOTE:
   * - If you know a better and more efficient way to group file statuses, 
   *   feel free to use it. Using a combination of other approaches like 
   *   `git.walk()` or something like that.
   * - Don’t hesitate to share your solution so we can improve this together!
   * 
   * @param dir Path to the git repository.
   * @returns A Promise resolving to an object containing grouped file statuses.
   */
  private async getAllFilesStatus(dir: string, filepath?: string[]): Promise<FileStatus[]> {
    /**
     * Mapping of file statuses from the `statusMatrix` output to readable symbols.
     * Each key is a combination of `head-workdir-stage`.
     * @see https://github.com/isomorphic-git/isomorphic-git/blob/205956cfc381a835ad7bc8f545dd0935f6cffa65/src/api/statusMatrix.js#L49
     */
    // [head-workdir-stage]
    const STATUS_MAP = new Map<string, { symbol: string; isStaged: boolean, desc: string }>([
      ['0-2-0', { symbol: 'U', isStaged: false, desc: 'New, Untracked' }],
      ['0-2-2', { symbol: 'A', isStaged: true, desc: 'Added, staged' }],
      ['0-0-3', { symbol: 'D', isStaged: true, desc: 'Added, deleted' }],
      ['0-2-3', { symbol: 'M', isStaged: true, desc: 'Added, staged, with unstaged changes' }],
      ['1-1-1', { symbol: 'UM', isStaged: false, desc: 'Unmodified' }],
      ['1-2-1', { symbol: 'M', isStaged: false, desc: 'Modified, unstaged' }],
      ['1-2-2', { symbol: 'M', isStaged: true, desc: 'Modified, staged' }],
      ['1-2-3', { symbol: 'M', isStaged: true, desc: 'Modified, staged, with unstaged changes' }],
      ['1-0-1', { symbol: 'D', isStaged: false, desc: 'Deleted, unstaged' }],
      ['1-0-0', { symbol: 'D', isStaged: true, desc: 'Deleted, staged' }],
      ['1-2-0', { symbol: 'D', isStaged: true, desc: 'Deleted, staged, with unstaged-modified changes' }],
      ['1-1-0', { symbol: 'D', isStaged: true, desc: 'Deleted, staged, with unstaged changes' }],
    ]);

    const statusMatrix = await git.statusMatrix({
      fs: pfs,
      dir: dir,
      filepaths: filepath
    });

    const files: FileStatus[] = [];

    for (let i = 0; i < statusMatrix.length; i++) {
      const [filepath, head, workdir, stage] = statusMatrix[i];
      const key = `${head}-${workdir}-${stage}`;
      const status = STATUS_MAP.get(key);

      sdcard.watchFile(pathUtil.join('/sdcard', dir, filepath), async () => {
        const updatedFiles = await this.getAllFilesStatus(dir, [filepath]);
        if (this.isSidebarActive && status?.symbol != 'UM') {
          FileStatusRenderer.render(updatedFiles, true, {
            onFileClick: this.showFileOptions.bind(this)
          });
        }
      });

      if (!status || status.symbol === 'UM') continue;

      const file: FileStatus = {
        key,
        filepath,
        symbol: status.symbol,
        isStaged: status.isStaged,
        desc: status.desc
      };

      if (!this.isSidebarActive) {
        this.pendingFileChanges.push(file);
      }

      files.push(file)
    }

    return files;
  }

  private async stageAllChanges() {
    const repo = { fs: pfs, dir: this.currentDir };
    await git.statusMatrix(repo).then((status) =>
      Promise.all(
        status.map(([filepath, , workdir,]) =>
          workdir !== 0 ? git.add({ ...repo, filepath })
            : git.remove({ ...repo, filepath })
        )
      )
    )
  }

  private async gitCommit() {
    const message = tag.get<HTMLTextAreaElement>('#commit-message');
    const commitBtn = tag.get('.commit-btn');

    if (!message?.value) {
      alert('WARNING', 'Message cannot be empty!');
      return;
    }

    try {
      const hasStagedFiles = this.fileStatus.some(file => file.isStaged);

      if (!hasStagedFiles) {
        if (this.fileStatus.length === 0) {
          alert('Info', 'No changes to commit')
          return;
        }
        const addAll = await confirm(
          'Warning',
          'No changes added to commit. Would you like to stage all your changes and commit them directly?'
        );

        if (!addAll) return;

        this.setLoadingState(true);
        commitBtn?.classList.add('disabled');
        await this.stageAllChanges();
      }

      this.setLoadingState(true);
      commitBtn?.classList.add('disabled');
      await git.commit({
        fs: pfs,
        dir: this.currentDir,
        message: message.value
      });
      this.setLoadingState(false);
      await this.gitStatus();
    } catch (error: any) {
      alert('Error', error.message);
    } finally {
      message.value = '';
      commitBtn?.classList.remove('disabled');
      this.setLoadingState(false);
    }
  }

  private async gitPull(opts?: { branch?: string, remote?: string }) {
    let loading: any = null;
    try {
      //@ts-ignore
      loading = loader.create('Pull', 'Loading');

      let repo = { fs: pfs, dir: this.currentDir }

      const HEAD_before = await git.resolveRef({ ...repo, ref: 'HEAD' });

      await git.pull({
        ...repo,
        http: http,
        corsProxy: CORS_PROXY,
        ref: opts?.branch,
        remote: opts?.remote,
        onMessage: msg => loading?.setMessage(msg),
        onProgress: (progress) => {
          let msg = progress.phase + ` ${progress.loaded} / ${progress.total}`;
          loading?.setMessage(msg);
        },
        onAuth: async () => {
          loading?.hide();
          let credential = await this.getCredential();
          loading?.show();
          return credential;
        }
      });

      const HEAD_after = await git.resolveRef({ ...repo, ref: 'HEAD' });

      if (HEAD_after === HEAD_before) {
        window.toast('Already up-to-date.', 3000);
      } else {
        window.toast(`Successfully pulled`, 3000);
        console.log(`HEAD before: ${HEAD_before}`);
        console.log(`HEAD after: ${HEAD_after}`);

        // const commits = await git.log({ ...repo, ref: 'HEAD', depth: 2 });
        // const [newCommit, oldCommit] = commits;

        // const diffs = await git.walk({
        //   ...repo,
        //   trees: [git.TREE({ ref: oldCommit.oid }), git.TREE({ ref: newCommit.oid })],
        //   map: async (filepath, [oldEntry, newEntry]) => {
        //     if (oldEntry && newEntry) {
        //       const [oldContent, newContent] = await Promise.all([
        //         oldEntry.content(),
        //         newEntry.content(),
        //       ]);
        //       if (oldContent?.toString() !== newContent?.toString()) {
        //         return { path: filepath, type: 'modified' };
        //       }
        //     } else if (oldEntry && !newEntry) {
        //       return { path: filepath, type: 'deleted' };
        //     } else if (!oldEntry && newEntry) {
        //       return { path: filepath, type: 'added' };
        //     }
        //   }
        // });
        // console.log('DIFFS', diffs);
        // diffs.forEach((diff: any) => {
        //   if (diff) console.log(`${diff.type}: ${diff.path}`);
        // });
      }

      this.gitStatus();
    } catch (error: any) {
      let msg = error.message;
      if (error.code === 'HttpError') {
        const { response, statusCode } = error.data;
        msg = response + ': ' + statusCode;
      }
      alert('Error', msg);
    } finally {
      loading?.destroy();
    }
  }

  private async gitPush(opts?: { branch?: string, remote?: string }) {
    let loading: any = null;
    try {
      //@ts-ignore
      loading = loader.create('Push', 'Loading');
      const result = await git.push({
        fs: pfs,
        http: http,
        dir: this.currentDir,
        corsProxy: CORS_PROXY,
        ref: opts?.branch,
        remote: opts?.remote,
        onProgress: (progress) => {
          let msg = progress.phase + ` ${progress.loaded} / ${progress.total}`;
          loading?.setMessage(msg);
        },
        onMessage: (msg) => loading?.setMessage(msg),
        onAuth: async () => {
          loading?.hide();
          let credential = await this.getCredential();
          loading?.show();
          return credential;
        }
      });
      window.toast(result.ok ? 'Done.' : 'Failed to push', 3000);
    } catch (error: any) {
      let msg = error.message;
      if (error.code === 'HttpError') {
        const { response, statusCode } = error.data;
        msg = response + ': ' + statusCode;
      }
      alert('Error', msg);
    } finally {
      loading?.destroy();
    }
  }

  private async gitPullPush() {
    // TODO: Add sync
    const options = [
      ['pull-from', 'Pull from...'],
      ['push-to', 'Push to...'],
    ];
    const action = await select('Pull/Push', options, { textTransform: false });
    if (!action) return;

    await this.gitListRemotes(async remote => {
      if (action === 'pull-from') {
        await this.gitPull({ remote });
      } else if (action === 'push-to') {
        await this.gitPush({ remote });
      }
    });
  }

  private async gitFetch() {
    let loading: any = null;
    try {
      const remotes = await git.listRemotes({
        fs: pfs,
        dir: this.currentDir,
      });

      let remote: { url: string, remote: string } | undefined;

      if (remotes.length < 1) {
        throw new Error('This repository has no remotes configured to fetch from.');
      } else if (remotes.length > 1) {
        const selectedRemote = await select('Select remote',
          remotes.map(remote => [remote.remote, remote.remote]),
          {
            hideOnSelect: true,
            textTransform: false,
            onCancel: () => loading?.destroy()
          }
        );
        remote = remotes.find(remote => remote.remote === selectedRemote);
      }

      //@ts-ignore
      loading = loader.create('Fetch', 'Loading...');

      await git.fetch({
        fs: pfs,
        dir: this.currentDir,
        http: http,
        remote: remote?.remote,
        url: remote?.url,
        onMessage: (msg) => loading?.setMessage(msg),
        onProgress: (progress) => {
          let msg = progress.phase + ` ${progress.loaded} / ${progress.total}`;
          loading?.setMessage(msg);
        },
        onAuth: async () => {
          loading?.hide();
          let credential = await this.getCredential();
          loading?.show();
          return credential;
        }
      });
      window.toast('Done.', 3000);
      this.gitStatus();
    } catch (error: any) {
      let msg = error.message;
      if (error.code === 'HttpError') {
        const { response, statusCode } = error.data;
        msg = response + ': ' + statusCode;
      }
      alert('Error', msg);
    } finally {
      loading?.destroy();
    }
  }

  private async gitClone() {
    let loading: any = null;

    try {
      const urlRepo: string | null = await prompt('Repository URL', '', 'url', {
        required: true,
        placeholder: 'Enter repositories URL'
      });
      if (!urlRepo) return;

      const { url: uri } = await fileBrowser('folder', 'Select folder', true);
      let dest = pathUtil.uriToPath(uri);
      let repoDir = pathUtil.join(dest, urlRepo.match(/\/([^\/]+?)(\.git)?$/)?.[1] || '');
      fs.stat(repoDir, undefined, (err, stat) => {
        if (err && err instanceof ENOENT) {
          pfs.mkdir(repoDir).then(clone).catch(this.handleError);
        } else if (stat) {
          if (stat.isFile()) {
            alert('Error', `"${repoDir}" is a file`);
          } else {
            fs.readdir(repoDir, undefined, function (err, list) {
              if (list.length) {
                alert('Error', `"${repoDir}" exists and is not empty`);
              } else {
                clone();
              }
            })
          }
        }
      });

      const clone = async () => {
        //@ts-ignore
        loading = loader.create(`Cloning in to ${repoDir}`, `Loading...`);
        await git.clone({
          fs: pfs,
          http: http,
          url: urlRepo,
          dir: repoDir,
          corsProxy: CORS_PROXY,
          onProgress: (progress) => {
            let msg = progress.phase + ` ${progress.loaded} / ${progress.total}`;
            loading?.setMessage(msg);
          },
          onMessage: (msg) => loading?.setMessage(msg),
          onAuth: async () => {
            loading?.hide();
            let credential = await this.getCredential();
            loading?.show();
            return credential;
          }
        });
        loading?.destroy();
        window.toast('Done.', 3000);
        this.gitStatus();
      }
    } catch (error: any) {
      let msg = error.message;
      if (error.code === 'HttpError') {
        const { response, statusCode } = error.data;
        msg = response + ': ' + statusCode;
      }
      alert('Error', msg);
    } finally {
      loading?.destroy();
    }
  }

  private async gitListBranches(deleted: boolean = false) {
    let loading: any = null;
    try {
      const repo = { fs: pfs, dir: pathUtil.uriToPath(this.currentFolder.url) };

      // const dir = pathUtil.uriToPath(this.currentFolder.url);
      const listBranches = await git.listBranches(repo);
      const options = listBranches.map((branch) => [branch, branch]);
      if (!deleted) {
        options.unshift(['delete branch', 'Delete branch', 'delete']);
        options.unshift(['create new branch', 'Create branch', 'add']);
      }

      const title = (deleted ? 'Delete' : 'Checkout') + ' branch';
      const branch = await select(title, options, {
        hideOnSelect: true,
        textTransform: true,
      });

      if (branch && branch === 'create new branch') {
        const branchName = await prompt('Branch name', '', 'text', {
          required: true,
          placeholder: 'Enter branch name'
        });
        if (!branchName) return;
        await git.branch({ ...repo, ref: branchName });
        await this.gitListBranches();
        return;
      } else if (branch === 'delete branch') {
        await this.gitListBranches(true);
        return;
      }

      if (branch) {
        if (deleted) {
          await git.deleteBranch({ ...repo, ref: branch });
          window.toast('Deleted branch ' + branch, 3000);
          await this.gitListBranches(false);
          return;
        }

        //@ts-ignore
        loading = loader.create('Checkout', 'Loading...');
        loading?.show();
        const currentBranch = await git.currentBranch({
          ...repo,
          fullname: false
        });
        if (branch !== currentBranch) {
          loading?.setTitle(`Checkout (${branch})`);
          await git.checkout({
            ...repo,
            ref: branch,
            onProgress: (progress) => {
              let msg = progress.phase + ` ${progress.loaded} / ${progress.total}`;
              loading?.setMessage(msg);
            }
          });
          window.toast('Checkout branch ' + branch, 3000);
          this.gitStatus();
        }
      }
    } catch (error: any) {
      alert('Error', error.message);
    } finally {
      loading?.destroy();
    }
  }

  private async gitConfig() {
    try {
      const options = [
        ['setConfig', 'Set Config'],
        ['getConfig', 'Get Config'],
        ['getAllConfig', 'Get All Config']
      ];
      const configAction = await select('Git Config', options, { hideOnSelect: true });
      if (configAction === 'setConfig') {
        const config: any = await multiPrompt('Enter path & value',
          [
            {
              type: 'text',
              id: 'path',
              placeholder: 'user.name',
              required: true
            },
            {
              type: 'text',
              id: 'value',
              placeholder: 'Enter value',
              required: true
            }
          ],
          "config will be an object like { path: 'user.name', value: 'John Doe' }"
        );
        if (!config) return;
        await git.setConfig({
          fs: pfs,
          dir: this.currentDir,
          path: config['path'],
          value: config['value']
        });
      } else {
        const path = await prompt('Enter path', '', 'text', {
          required: true,
          placeholder: 'Enter path',
        });

        if (!path) return;

        if (configAction === 'getConfig') {
          const config = await git.getConfig({
            fs: pfs,
            dir: this.currentDir,
            path: path
          });
          //@ts-ignore
          DialogBox(path, `<p>${config}</p>`);
        } else {
          const configs = await git.getConfigAll({
            fs: pfs,
            dir: this.currentDir,
            path: path
          });
          //@ts-ignore
          DialogBox(path, configs.map(config => `<p>${config}</p>`).join(''));
        }
      }
    } catch (error: any) {
      alert('Error', error.message);
    }
  }

  private async gitListRemotes(onclick: (remote: string) => void) {
    const listRemotes = await git.listRemotes({ fs: pfs, dir: this.currentDir });
    const remoteOptions = listRemotes.map(remote => {
      return [remote.remote, `
        <p><strong>${remote.remote}</strong></p>
        <p><i><small>${remote.url}</small></i></p>
      `];
    });
    const remote = await select('Remotes', remoteOptions, { textTransform: false });
    onclick(remote);
  }

  private async gitRemote() {
    const options = [
      ['add', 'Add Remote', 'add'],
      ['remove', 'Remove Remote', 'delete']
    ];
    const action = await select('Remote', options);
    try {
      let repo = { fs: pfs, dir: this.currentDir };
      if (action === 'add') {
        //@ts-ignore
        const remote: any = await multiPrompt('Enter url and name',
          [
            { type: 'url', id: 'url', placeholder: 'Remote url', required: true },
            { type: 'text', id: 'name', placeholder: 'Remote name', required: true }
          ]
        );
        if (!remote || (!remote.url && !remote.name)) return;
        await git.addRemote({
          ...repo,
          remote: remote.name,
          url: remote.url
        });
      } else if (action === 'remove') {
        await this.gitListRemotes(async remote => {
          await git.deleteRemote({ ...repo, remote });
          window.toast('Deleted remote ' + remote, 3000);
        });
      }
    } catch (error: any) {
      alert('Error', error.message);
    }
  }

  private async initializeRepository() {
    try {
      const dir = pathUtil.uriToPath(this.currentFolder.url);
      if (await this.isRepository(dir)) {
        throw new REPO_HAS_INITIALIZED();
      }
      await git.init({
        fs: pfs,
        dir,
      });
      this.gitStatus();
    } catch (error: any) {
      alert('Error', error.message);
    }
  }

  private get currentFolder() {
    const folders = window.addedFolder;
    if (!folders || folders.length < 1) {
      localStorage.setItem("gitRepoDir", '')
      throw new NO_FOLDER_SELECTED();
    }
    if (folders.length > 1) {
      throw new MULTIPLE_FOLDER_SELECTED();
    }
    return folders[0];
  }

  private get currentDir(): string {
    try {
      return pathUtil.uriToPath(this.currentFolder.url);
    } catch (error) {
      return '';
    }
  }

  private async isRepository(dir: string): Promise<boolean> {
    try {
      const gitFolder = await pfs.stat(pathUtil.join(dir, '.git'));
      return gitFolder.type === 'dir';
    } catch (error) {
      return false;
    }
  }

  private updateSetting(key: Settings, newValue: any) {
    this.settings[key] = newValue;
    appSettings.update();
  }

  private handleError(error: any) {
    alert('Error', error.message || error);
  }

  private get settings() {
    return appSettings.value[plugin.id];
  }

  get getSettingsObj() {
    return {
      list: [
        {
          key: Settings.GithubToken,
          text: 'Github Token',
          info: 'Github token for authentication',
          value: this.settings[Settings.GithubToken],
          prompt: 'Github Token',
          promptType: 'text',
          promptOption: [{ require: true }]
        }
      ],
      cb: (key: any, value: any) => {
        this.settings[key] = value;
        appSettings.update();
      }
    }
  }

  async destroy() {
    this.$mainStyle?.remove();
    this.progresIndicator.destroy();
    sidebarApps.remove('vcs-sidebar');
    localStorage.removeItem('gitRepoDir');
  }
}

if (window.acode) {
  const versionControl = new VersionControl();
  acode.setPluginInit(
    plugin.id,
    async (baseUrl: string, $page: WCPage, { cacheFileUrl, cacheFile }: any) => {
      if (!baseUrl.endsWith('/')) {
        baseUrl += '/';
      }
      versionControl.baseUrl = baseUrl;
      await versionControl.init($page, cacheFile, cacheFileUrl);
    }, versionControl.getSettingsObj);
  acode.setPluginUnmount(plugin.id, () => {
    versionControl.destroy();
  });
}