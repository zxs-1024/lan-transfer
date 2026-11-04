'use strict';

const TOKEN = '__SHARE_TOKEN__';
const API_PATH = `/s/${TOKEN}/api/files`;
const FILE_ICONS = {
  image: 'image',
  video: 'video',
  audio: 'audio-lines',
  archive: 'archive',
  document: 'file-text',
  default: 'file'
};

const elements = {
  fileList: document.querySelector('#fileList'),
  loadingList: document.querySelector('#loadingList'),
  emptyState: document.querySelector('#emptyState'),
  errorState: document.querySelector('#errorState'),
  summary: document.querySelector('#summary'),
  downloadAllButton: document.querySelector('#downloadAllButton'),
  emptyRefreshButton: document.querySelector('#emptyRefreshButton'),
  errorRefreshButton: document.querySelector('#errorRefreshButton'),
  toast: document.querySelector('#toast')
};

let visibleFiles = [];

function refreshIcons() {
  if (window.lucide) window.lucide.createIcons();
}

function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const unit = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / (1024 ** unit);
  return `${value >= 10 || unit === 0 ? value.toFixed(0) : value.toFixed(1)} ${units[unit]}`;
}

function formatDate(isoDate) {
  try {
    return new Intl.DateTimeFormat('zh-CN', { month: 'numeric', day: 'numeric' }).format(new Date(isoDate));
  } catch {
    return '';
  }
}

function categoryFor(file) {
  const type = file.mime || '';
  if (type.startsWith('image/')) return 'image';
  if (type.startsWith('video/')) return 'video';
  if (type.startsWith('audio/')) return 'audio';
  if (/zip|rar|7z|compressed|tar/.test(type) || /\.(zip|rar|7z|tar|gz)$/i.test(file.name)) return 'archive';
  if (/text|document|pdf|spreadsheet|presentation|json|csv/.test(type) || /\.(pdf|docx?|xlsx?|pptx?|txt|md|csv)$/i.test(file.name)) return 'document';
  return 'default';
}

function showToast(message) {
  elements.toast.textContent = message;
  elements.toast.hidden = false;
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => {
    elements.toast.hidden = true;
  }, 2400);
}

function getDownloadUrl(file) {
  return file.downloadUrl;
}

function triggerDownload(file) {
  const anchor = document.createElement('a');
  anchor.href = getDownloadUrl(file);
  anchor.download = file.name;
  anchor.rel = 'noopener';
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
}

function renderFiles() {
  elements.fileList.replaceChildren();
  const hasFiles = visibleFiles.length > 0;
  elements.emptyState.hidden = hasFiles;
  elements.downloadAllButton.disabled = !hasFiles;
  elements.summary.textContent = hasFiles
    ? `${visibleFiles.length} 个文件 · 共 ${formatBytes(visibleFiles.reduce((sum, file) => sum + file.size, 0))}`
    : '共享列表为空';

  for (const file of visibleFiles) {
    const row = document.createElement('div');
    row.className = 'file-row';
    row.setAttribute('role', 'listitem');

    const icon = document.createElement('div');
    icon.className = 'file-icon';
    const iconElement = document.createElement('i');
    iconElement.dataset.lucide = FILE_ICONS[categoryFor(file)];
    icon.append(iconElement);

    const copy = document.createElement('div');
    copy.className = 'file-copy';
    const name = document.createElement('div');
    name.className = 'file-name';
    name.textContent = file.name;
    name.title = file.name;
    const meta = document.createElement('div');
    meta.className = 'file-meta';
    const size = document.createElement('span');
    size.textContent = formatBytes(file.size);
    const date = document.createElement('span');
    date.textContent = formatDate(file.createdAt);
    meta.append(size, date);
    copy.append(name, meta);

    const download = document.createElement('a');
    download.className = 'file-download';
    download.href = getDownloadUrl(file);
    download.download = file.name;
    download.title = `下载 ${file.name}`;
    download.setAttribute('aria-label', `下载 ${file.name}`);
    const downloadIcon = document.createElement('i');
    downloadIcon.dataset.lucide = 'download';
    download.append(downloadIcon);

    row.append(icon, copy, download);
    elements.fileList.append(row);
  }

  refreshIcons();
}

async function loadFiles() {
  elements.loadingList.hidden = false;
  elements.emptyState.hidden = true;
  elements.errorState.hidden = true;
  elements.fileList.replaceChildren();
  elements.downloadAllButton.disabled = true;
  elements.summary.textContent = '正在读取文件列表';

  try {
    const response = await fetch(API_PATH, { cache: 'no-store' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const payload = await response.json();
    visibleFiles = Array.isArray(payload.files) ? payload.files : [];
    elements.loadingList.hidden = true;
    renderFiles();
  } catch {
    elements.loadingList.hidden = true;
    elements.fileList.replaceChildren();
    elements.emptyState.hidden = true;
    elements.errorState.hidden = false;
    elements.summary.textContent = '连接失败';
    refreshIcons();
  }
}

async function downloadAll() {
  if (visibleFiles.length === 0) return;
  if (visibleFiles.length > 1) {
    showToast('浏览器可能询问是否允许多个下载');
  }
  for (const [index, file] of visibleFiles.entries()) {
    triggerDownload(file);
    if (index < visibleFiles.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, 280));
    }
  }
}

elements.downloadAllButton.addEventListener('click', downloadAll);
elements.emptyRefreshButton.addEventListener('click', loadFiles);
elements.errorRefreshButton.addEventListener('click', loadFiles);

refreshIcons();
loadFiles();
