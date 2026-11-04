'use strict';

const TOKEN = '__SHARE_TOKEN__';
const API_PATH = `/s/${TOKEN}/api/files`;
const TEXT_API_PATH = `/s/${TOKEN}/api/texts`;
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
  filePanel: document.querySelector('.file-panel'),
  textPanel: document.querySelector('#textPanel'),
  textList: document.querySelector('#textList'),
  textSummary: document.querySelector('#textSummary'),
  copyAllButton: document.querySelector('#copyAllButton'),
  emptyState: document.querySelector('#emptyState'),
  errorState: document.querySelector('#errorState'),
  summary: document.querySelector('#summary'),
  downloadAllButton: document.querySelector('#downloadAllButton'),
  emptyRefreshButton: document.querySelector('#emptyRefreshButton'),
  errorRefreshButton: document.querySelector('#errorRefreshButton'),
  toast: document.querySelector('#toast')
};

let visibleFiles = [];
let visibleTexts = [];

function showLoadingList() {
  if (document.querySelector('#loadingList')) return;
  const loadingList = document.createElement('div');
  loadingList.className = 'loading-list';
  loadingList.id = 'loadingList';
  loadingList.setAttribute('aria-label', '正在加载文件');

  for (let index = 0; index < 3; index += 1) {
    const row = document.createElement('div');
    row.className = 'loading-row';
    loadingList.append(row);
  }

  elements.fileList.before(loadingList);
}

function removeLoadingList() {
  document.querySelector('#loadingList')?.remove();
}

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

function copyToClipboard(text) {
  if (navigator.clipboard && window.isSecureContext) {
    return navigator.clipboard.writeText(text);
  }

  if (navigator.clipboard?.write && window.ClipboardItem) {
    return navigator.clipboard.write([
      new ClipboardItem({ 'text/plain': new Blob([text], { type: 'text/plain;charset=utf-8' }) })
    ]);
  }

  return new Promise((resolve, reject) => {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.top = '0';
    textarea.style.left = '-9999px';
    document.body.append(textarea);
    textarea.focus();
    textarea.setSelectionRange(0, text.length);
    const copied = document.execCommand('copy');
    textarea.remove();
    if (copied) resolve();
    else reject(new Error('copy failed'));
  });
}

function renderTexts() {
  elements.textList.replaceChildren();
  const hasTexts = visibleTexts.length > 0;
  elements.textPanel.hidden = !hasTexts;
  elements.copyAllButton.disabled = !hasTexts;
  elements.textSummary.textContent = `${visibleTexts.length} 条 · 点击复制`;

  for (const textItem of visibleTexts) {
    const row = document.createElement('div');
    row.className = 'text-item';
    row.setAttribute('role', 'listitem');

    const copy = document.createElement('div');
    copy.className = 'text-item-copy';
    const body = document.createElement('p');
    body.className = 'text-item-body';
    body.textContent = textItem.text;
    const meta = document.createElement('div');
    meta.className = 'file-meta';
    const length = document.createElement('span');
    length.textContent = `${textItem.text.length.toLocaleString('zh-CN')} 字符`;
    const date = document.createElement('span');
    date.textContent = formatDate(textItem.createdAt);
    meta.append(length, date);
    copy.append(body, meta);

    const copyButton = document.createElement('button');
    copyButton.type = 'button';
    copyButton.className = 'text-copy';
    copyButton.title = '复制文本';
    copyButton.setAttribute('aria-label', '复制文本');
    const copyIcon = document.createElement('i');
    copyIcon.dataset.lucide = 'copy';
    copyButton.append(copyIcon);
    copyButton.addEventListener('click', async () => {
      copyButton.disabled = true;
      try {
        await copyToClipboard(textItem.text);
        copyButton.classList.add('copied');
        showToast('已复制到手机剪贴板');
        setTimeout(() => copyButton.classList.remove('copied'), 1600);
      } catch {
        showToast('复制失败，请长按文本手动复制');
      } finally {
        copyButton.disabled = false;
      }
    });

    row.append(copy, copyButton);
    elements.textList.append(row);
  }

  refreshIcons();
}

function renderFiles() {
  elements.fileList.replaceChildren();
  const hasFiles = visibleFiles.length > 0;
  elements.filePanel.hidden = !hasFiles && visibleTexts.length > 0;
  elements.emptyState.hidden = hasFiles || visibleTexts.length > 0;
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
  showLoadingList();
  elements.emptyState.hidden = true;
  elements.errorState.hidden = true;
  elements.fileList.replaceChildren();
  elements.downloadAllButton.disabled = true;
  elements.summary.textContent = '正在读取文件列表';

  try {
    const [filesResponse, textsResponse] = await Promise.all([
      fetch(API_PATH, { cache: 'no-store' }),
      fetch(TEXT_API_PATH, { cache: 'no-store' })
    ]);
    if (!filesResponse.ok) throw new Error(`HTTP ${filesResponse.status}`);
    const payload = await filesResponse.json();
    visibleFiles = Array.isArray(payload.files) ? payload.files : [];
    visibleTexts = textsResponse.ok ? ((await textsResponse.json()).texts || []) : [];
    renderFiles();
    renderTexts();
  } catch {
    elements.fileList.replaceChildren();
    elements.emptyState.hidden = true;
    elements.errorState.hidden = false;
    elements.textPanel.hidden = true;
    elements.summary.textContent = '连接失败';
    refreshIcons();
  } finally {
    removeLoadingList();
  }
}

async function copyAllTexts() {
  if (visibleTexts.length === 0) return;
  const combined = visibleTexts.map((item) => item.text).join('\n\n');
  try {
    await copyToClipboard(combined);
    showToast(`已复制 ${visibleTexts.length} 条文本`);
  } catch {
    showToast('复制失败，请逐条长按复制');
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
elements.copyAllButton.addEventListener('click', copyAllTexts);
elements.emptyRefreshButton.addEventListener('click', loadFiles);
elements.errorRefreshButton.addEventListener('click', loadFiles);

refreshIcons();
renderTexts();
loadFiles();
