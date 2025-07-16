const Url = acode.require('Url');
const helpers = acode.require('helpers');

enum Icons {
  REFRESH = `<svg width="24" height="24" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg"><path fill-rule="evenodd" clip-rule="evenodd" d="M5.56253 2.51577C3.46348 3.4501 2 5.55414 2 7.99999C2 11.3137 4.68629 14 8 14C11.3137 14 14 11.3137 14 7.99999C14 5.32519 12.2497 3.05919 9.83199 2.28482L9.52968 3.23832C11.5429 3.88454 13 5.7721 13 7.99999C13 10.7614 10.7614 13 8 13C5.23858 13 3 10.7614 3 7.99999C3 6.31104 3.83742 4.81767 5.11969 3.91245L5.56253 2.51577Z" fill="#FFFFFF"/><path fill-rule="evenodd" clip-rule="evenodd" d="M5 3H2V2H5.5L6 2.5V6H5V3Z" fill="#FFFFFF"/></svg>`,
  MORE_VERT = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="1"/><circle cx="12" cy="5" r="1"/><circle cx="12" cy="19" r="1"/></svg>`,
  GIT_BRANCH = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="6" y1="3" x2="6" y2="15"/><circle cx="18" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M18 9a9 9 0 0 1-9 9"/></svg>`,
  CHECK = `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M10.9788 5C10.443 4.45199 9.73865 4.09982 8.97876 4V0H7.97876V4C7.16572 4.12245 6.42174 4.52718 5.87729 5.14331C5.33284 5.75944 5.02267 6.54757 5.00119 7.36951C4.97972 8.19144 5.24832 8.99471 5.75986 9.63843C6.2714 10.2821 6.99323 10.7253 7.79877 10.89H7.97876V14.89H8.97876V10.89C9.26824 10.8535 9.55107 10.7761 9.81876 10.66C10.4607 10.399 11.0082 9.94912 11.3888 9.37C11.772 8.79546 11.9772 8.12068 11.9788 7.43005C11.9779 6.52007 11.6187 5.64698 10.9788 5V5ZM10.2788 9.23999C9.80838 9.70763 9.17204 9.97006 8.50876 9.96997C8.01463 9.9703 7.53148 9.82427 7.12034 9.55017C6.70919 9.27608 6.38851 8.8863 6.19877 8.43005C6.05515 8.08876 5.98945 7.71974 6.00647 7.34985C6.02349 6.97997 6.12281 6.61853 6.29715 6.29187C6.4715 5.96521 6.71649 5.68144 7.01432 5.46143C7.31214 5.24141 7.6553 5.09067 8.01877 5.02002C8.18177 5.00528 8.34576 5.00528 8.50876 5.02002C8.85172 5.01265 9.19241 5.07732 9.50876 5.20996C9.96501 5.39971 10.3548 5.72045 10.6289 6.13159C10.903 6.54273 11.0491 7.02589 11.0488 7.52002C11.0371 7.85 10.9604 8.17444 10.8231 8.47473C10.6858 8.77503 10.4907 9.04528 10.2488 9.27002L10.2788 9.23999Z" fill="#FFFFFF"/></svg>`
}

export type FileStatus = {
  key: string,
  filepath: string;
  symbol: string; // Single-letter representation, e.g., 'A', 'B',
  isStaged: boolean,
  desc: string
};

export interface LinearProgress extends HTMLDivElement {
  show: () => void;
  hide: () => void;
  destroy: () => void;
}

export function LinearProgressIndicator(): LinearProgress {
  const linearProgress = tag('div', { className: 'linear-progress hide' }) as LinearProgress;
  const progressBar = tag('div', { className: 'progress-bar' });
  linearProgress.append(progressBar);

  linearProgress.show = function () {
    this.classList.remove('hide');
  }
  linearProgress.hide = function () {
    this.classList.add('hide');
  }
  linearProgress.destroy = function () {
    this.remove();
  }

  return linearProgress;
}

interface HeaderOptions {
  onRefresh?: (clearCache: boolean) => void;
  onMenuClick?: () => void;
}

export class Header {
  static create(options?: HeaderOptions): HTMLDivElement {
    const $header = tag('div', { className: 'vcs-header' });
    const $title = tag('div', { className: 'title', innerText: 'Version Control' });
    const $actions = tag('div', { className: 'actions' });

    const $refresButton = tag('span', {
      className: 'action-button refresh',
      innerHTML: Icons.REFRESH,
      onclick: () => { options?.onRefresh?.(false) },
      ondblclick: () => { options?.onRefresh?.(true) }
    });
    const $menuButton = tag('span', {
      className: 'action-button more',
      innerHTML: Icons.MORE_VERT,
      onclick: options?.onMenuClick
    });

    $actions.append($refresButton, $menuButton);
    $header.append($title, $actions);

    return $header;
  }
}

export class RepoUnavailable {
  static create(
    {
      onInit,
      onClone
    }: {
      onInit?: (this: HTMLElement, event: MouseEvent) => void,
      onClone?: () => void,
    }
  ): HTMLElement {
    const $container = tag('section', { className: 'repo-unavailable' });
    const $message = tag('p', {
      innerText:
        "The folder currently open doesn't have a Git repository. You can initialize a repository which will enable source control features."
    });
    const $initializeBtn = tag('button', {
      className: 'initialize-button',
      innerText: 'Initialize Repository',
      onclick: onInit
    });
    const $cloneBtn = tag('button', {
      className: 'clone-button',
      innerText: 'Clone Repository',
      onclick: onClone
    });

    $container.append(
      $message,
      $initializeBtn,
      $cloneBtn
    );
    return $container;
  }
}

export class SourceControl {
  static create(
    options?: {
      onBranchClick?: () => void,
      onCommitClick?: () => void
    }
  ): HTMLElement {
    const $sourceControl = tag('div', { className: 'container source-control' });
    const $repositories = tag('ul', {
      className: 'repositories',
      children: [
        SourceControl.ActionItem({
          icon: Icons.GIT_BRANCH,
          label: 'branch',
          onClick: options?.onBranchClick
        })
      ]
    });

    const $commitArea = tag('div', { className: 'commit-area' });
    const $commitMsg = tag('textarea', {
      id: 'commit-message',
      placeholder: 'Commit message',
      rows: 1,
      style: {
        width: '100%',
        border: 'none',
        borderRadius: '2px',
        outline: '1px solid var(--button-background-color)'
      },
      oninput: () => {
        $commitMsg.style.height = 'auto';
        $commitMsg.style.height = $commitMsg.scrollHeight + 'px';
      },
    });
    const $commitBtn = tag('button', {
      className: 'commit-btn',
      onclick: options?.onCommitClick,
      innerText: 'Commit'
    });
    $commitArea.append($commitMsg, $commitBtn);

    const $listFiles = tag('div', { className: 'container list-files' });

    $sourceControl.append(
      $repositories,
      $commitArea,
      $listFiles
    );

    return $sourceControl;
  }

  private static ActionItem(
    opts: { icon: Icons; label?: string; onClick?: () => void }
  ): HTMLLIElement {
    const $item = tag('li', { className: `action-item ${opts.label ?? ''}`, onclick: opts.onClick });
    const $icon = tag('span', { className: 'action-icon', innerHTML: opts.icon });
    const $label = tag('span', { className: 'action-label', innerText: opts.label });
    $item.append($icon, opts.label ? $label : '');

    return $item;
  }
}

interface HTMLDivElementWithUl extends HTMLDivElement {
  $ul: HTMLUListElement;
}

export class CollapsableList {
  static create(options: HTMLElementAttributes & object): HTMLDivElementWithUl {
    const $ul = tag('ul', { className: 'scroll' });
    options.className = `list collapsible ${options.className}`;
    options.children = [$ul];

    const $wrapper = tag('div', options) as HTMLDivElementWithUl;
    Object.defineProperty($wrapper, '$ul', { get: () => $ul });

    return $wrapper;
  }
}

export class FileStatusRenderer {
  static render(
    fileStatus: FileStatus[],
    isPending: boolean = false,
    options?: {
      onFileClick: (file: FileStatus) => void,
      onFileLongClick?: (file: FileStatus) => void
    }
  ): void {
    const $sourceFileList = tag.get('.source-control .list-files')!;

    if (isPending) {
      fileStatus.forEach((file) => {
        const $el = tag.get(`[data-url="${file.filepath}"]`);
        if ($el) {
          $el.replaceWith(FileStatusRenderer.createListItem(file, options?.onFileClick, options?.onFileLongClick));
        } else {
          let $item = FileStatusRenderer.createListItem(file, options?.onFileClick, options?.onFileLongClick);
          if (file.isStaged) {
            tag.get('.stage-change ul')?.appendChild($item);
          } else {
            tag.get('.change ul')?.appendChild($item);
          }
        }
      });
      return;
    }

    $sourceFileList.innerHTML = '';

    const $stageChanges = CollapsableList.create({ className: 'stage-changes' });
    const $changes = CollapsableList.create({ className: 'changes' });

    FileStatusRenderer.populateList(
      $stageChanges.$ul,
      fileStatus.filter(file => file.isStaged),
      options
    );
    FileStatusRenderer.populateList(
      $changes.$ul,
      fileStatus.filter(file => !file.isStaged),
      options
    );

    FileStatusRenderer.addTitle($stageChanges, 'Stage Changes');
    FileStatusRenderer.addTitle($changes, 'Changes');

    $sourceFileList.append($stageChanges, $changes);
  }

  private static populateList(
    $ul: HTMLUListElement,
    files: FileStatus[],
    options?: {
      onFileClick: (file: FileStatus) => void,
      onFileLongClick?: (file: FileStatus) => void
    }
  ): void {
    files.forEach(file => {
      const $item = FileStatusRenderer.createListItem(
        file,
        options?.onFileClick,
        options?.onFileLongClick
      );
      $ul.appendChild($item);
    });
  }

  private static addTitle(
    $list: HTMLDivElementWithUl,
    title: string,
    oncontextmenu?: () => void
  ): void {
    const $tile = tag('div', {
      className: 'tile light',
      dataset: { 'type': 'root' },
      onclick: () => $list.classList.toggle('hidden'),
      oncontextmenu
    });

    const icon = tag('span', { className: 'icon indicator' });
    const label = tag('span', {
      className: 'text',
      innerText: title,
      style: {
        overflow: 'hidden',
        whiteSpace: 'nowrap',
        textOverflow: 'ellipsis'
      }
    });
    $tile.append(icon, label);

    $list.insertBefore($tile, $list.firstChild);
  }

  private static createListItem(
    file: FileStatus,
    onClick?: (file: FileStatus) => void,
    onLongClick?: (file: FileStatus) => void
  ): HTMLLIElement {
    const $item = tag('li', {
      className: 'tile',
      onclick: () => onClick?.(file),
      oncontextmenu: () => onLongClick?.(file),
      dataset: {
        url: file.filepath
      }
    });

    const $icon = tag('span', {
      className: helpers.getIconForFile(Url.basename(file.filepath)!)
    });
    const $status = tag('span', { className: `status ${file.symbol}`, innerText: file.symbol });
    const $label = tag('span', { className: 'text', innerText: Url.basename(file.filepath)! });

    $item.append($icon, $label, $status);
    return $item;
  }
}

export class DomHelpers {
  static toggleVisibility(element: Element | null, isVisible: boolean): void {
    if (element) {
      element.classList.toggle('hide', !isVisible);
    }
  }
}