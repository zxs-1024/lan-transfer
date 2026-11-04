'use strict';

const API_BASE = 'http://127.0.0.1:34567';
const MAX_CONCURRENT_UPLOADS = 2;
const FILE_ICONS = {
  image: 'image',
  video: 'video',
  audio: 'audio-lines',
  archive: 'archive',
  document: 'file-text',
  default: 'file'
};

const elements = {
  app: document.querySelector('.app'),
  statusPanel: document.querySelector('#statusPanel'),
  statusTitle: document.querySelector('#statusTitle'),
  statusDetail: document.querySelector('#statusDetail'),
  retryButton: document.querySelector('#retryButton'),
  refreshButton: document.querySelector('#refreshButton'),
  shareHint: document.querySelector('#shareHint'),
  shareActions: document.querySelector('.share-actions'),
  shareUrl: document.querySelector('#shareUrl'),
  fileCount: document.querySelector('#fileCount'),
  qrShell: document.querySelector('#qrShell'),
  qrPlaceholder: document.querySelector('#qrPlaceholder'),
  addresses: document.querySelector('#addresses'),
  networkNote: document.querySelector('#networkNote'),
  copyButton: document.querySelector('#copyButton'),
  openButton: document.querySelector('#openButton'),
  addButton: document.querySelector('#addButton'),
  fileInput: document.querySelector('#fileInput'),
  fileList: document.querySelector('#fileList'),
  emptyState: document.querySelector('#emptyState'),
  uploadState: document.querySelector('#uploadState'),
  uploadName: document.querySelector('#uploadName'),
  uploadProgress: document.querySelector('#uploadProgress'),
  progressBar: document.querySelector('#progressBar'),
  toast: document.querySelector('#toast')
};

const state = {
  info: null,
  uploading: false,
  visibleFiles: [],
  toastTimer: null
};

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
    return new Intl.DateTimeFormat('zh-CN', {
      month: 'numeric',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(new Date(isoDate));
  } catch {
    return '';
  }
}

function fileCategory(file) {
  const type = file.mime || file.type || '';
  if (type.startsWith('image/')) return 'image';
  if (type.startsWith('video/')) return 'video';
  if (type.startsWith('audio/')) return 'audio';
  if (/zip|rar|7z|compressed|tar/.test(type) || /\.(zip|rar|7z|tar|gz)$/i.test(file.name)) return 'archive';
  if (/text|document|pdf|spreadsheet|presentation|json|csv/.test(type) || /\.(pdf|docx?|xlsx?|pptx?|txt|md|csv)$/i.test(file.name)) return 'document';
  return 'default';
}

function absoluteShareUrl(relativeUrl) {
  try {
    return new URL(relativeUrl, API_BASE).href;
  } catch {
    return relativeUrl || '';
  }
}

function setStatus(kind, title, detail, canRetry = false) {
  elements.statusPanel.classList.remove('connected', 'error');
  if (kind) elements.statusPanel.classList.add(kind);
  elements.statusTitle.textContent = title;
  elements.statusDetail.textContent = detail;
  elements.retryButton.hidden = !canRetry;
  elements.addButton.disabled = state.uploading || kind !== 'connected';
  elements.refreshButton.disabled = kind !== 'connected';
}

function showToast(message, kind = 'success') {
  clearTimeout(state.toastTimer);
  elements.toast.textContent = message;
  elements.toast.classList.toggle('error', kind === 'error');
  elements.toast.hidden = false;
  state.toastTimer = setTimeout(() => {
    elements.toast.hidden = true;
  }, 2600);
}

async function parseResponse(response) {
  let payload;
  try {
    payload = await response.json();
  } catch {
    payload = {};
  }
  if (!response.ok) {
    throw new Error(payload.error || `请求失败（${response.status}）`);
  }
  return payload;
}

async function apiRequest(path, options) {
  let response;
  try {
    response = await fetch(`${API_BASE}${path}`, options);
  } catch {
    const error = new Error('无法连接本机助手');
    error.code = 'OFFLINE';
    throw error;
  }
  const payload = await parseResponse(response);
  if (response.status === 204) return null;
  return payload;
}

function updateSharePanel() {
  const files = state.visibleFiles;
  const hasFiles = files.length > 0;
  const shareUrl = state.info && hasFiles ? absoluteShareUrl(state.info.shareUrl) : '';
  elements.fileCount.textContent = `${files.length} 个文件`;
  elements.shareUrl.textContent = shareUrl || (state.info ? '添加文件后生成链接' : '尚未启动');
  elements.copyButton.disabled = !shareUrl;
  elements.openButton.disabled = !shareUrl;
  elements.shareActions.classList.toggle('disabled', !shareUrl);
  elements.shareHint.textContent = hasFiles ? '手机扫码后可直接下载全部文件' : '添加文件后，手机扫一扫即可获取';

  const lanAvailable = Boolean(state.info?.lanAvailable);
  elements.networkNote.textContent = lanAvailable
    ? '手机与电脑需连接同一 Wi-Fi；关闭助手后链接失效'
    : '未检测到局域网地址，请检查 Wi-Fi 或点击刷新';

  if (!shareUrl) {
    elements.qrShell.replaceChildren(elements.qrPlaceholder);
    elements.qrPlaceholder.hidden = false;
    elements.addresses.hidden = true;
    return;
  }

  drawQrCode(shareUrl);
  elements.addresses.replaceChildren();
  const alternateAddresses = (state.info.addresses || []).slice(1);
  for (const item of alternateAddresses) {
    const chip = document.createElement('span');
    chip.className = 'address-chip';
    chip.textContent = `${item.interface}: ${new URL(item.url).host}`;
    elements.addresses.append(chip);
  }
  elements.addresses.hidden = alternateAddresses.length === 0;
}

function drawQrCode(value) {
  if (typeof qrcode !== 'function') return;
  try {
    const code = qrcode(0, 'M');
    code.addData(value);
    code.make();
    const svg = code.createSvgTag({ cellSize: 4, margin: 8, scalable: true });
    const template = document.createElement('template');
    template.innerHTML = svg;
    const codeElement = template.content.firstElementChild;
    codeElement.setAttribute('role', 'img');
    codeElement.setAttribute('aria-label', '手机下载二维码');
    elements.qrShell.replaceChildren(codeElement);
  } catch (error) {
    showToast(`二维码生成失败：${error.message}`, 'error');
  }
}

function createActionButton(className, iconName, label, handler) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = className;
  button.title = label;
  button.setAttribute('aria-label', label);
  const icon = document.createElement('i');
  icon.dataset.lucide = iconName;
  button.append(icon);
  button.addEventListener('click', handler);
  return button;
}

function renderFiles() {
  elements.fileList.replaceChildren();
  elements.emptyState.hidden = state.visibleFiles.length > 0;
  elements.emptyState.classList.toggle('pending-upload', state.uploading && state.visibleFiles.length === 0);
  if (state.uploading && state.visibleFiles.length === 0) {
    elements.emptyState.querySelector('strong').textContent = '正在接收文件';
    elements.emptyState.querySelector('span').textContent = '上传完成后会自动生成手机下载链接';
  } else {
    elements.emptyState.querySelector('strong').textContent = '还没有文件';
    elements.emptyState.querySelector('span').textContent = '添加文件后即可下载或扫码分享';
  }

  for (const file of state.visibleFiles) {
    const row = document.createElement('div');
    row.className = 'file-row';
    row.setAttribute('role', 'listitem');

    const icon = document.createElement('div');
    icon.className = 'file-icon';
    const iconElement = document.createElement('i');
    iconElement.dataset.lucide = FILE_ICONS[fileCategory(file)];
    icon.append(iconElement);

    const copy = document.createElement('div');
    copy.className = 'file-copy';
    const name = document.createElement('div');
    name.className = 'file-name';
    name.textContent = file.name;
    name.title = file.name;
    const meta = document.createElement('div');
    meta.className = 'file-meta';
    meta.textContent = `${formatBytes(file.size)} · ${formatDate(file.createdAt)}`;
    copy.append(name, meta);

    const actions = document.createElement('div');
    actions.className = 'file-actions';
    const downloadButton = createActionButton('download-button', 'download', `下载 ${file.name}`, () => downloadFile(file));
    const deleteButton = createActionButton('delete-button', 'trash-2', `删除 ${file.name}`, () => deleteFile(file, deleteButton));
    downloadButton.disabled = state.uploading;
    deleteButton.disabled = state.uploading;
    actions.append(downloadButton, deleteButton);

    row.append(icon, copy, actions);
    elements.fileList.append(row);
  }

  refreshIcons();
  updateSharePanel();
}

async function connect({ quiet = false } = {}) {
  if (!quiet) setStatus('', '正在连接本机助手', '检查 127.0.0.1:34567');
  try {
    const info = await apiRequest('/api/info');
    state.info = info;
    state.visibleFiles = info.files || [];
    if (info.lanAvailable) {
      setStatus('connected', '手机分享已就绪', `${info.hostname} · ${info.addresses[0].interface}`);
    } else {
      setStatus('connected', '本机下载可以使用', '未检测到 Wi-Fi 地址，手机分享不可用');
    }
    renderFiles();
  } catch (error) {
    state.info = null;
    state.visibleFiles = [];
    const message = error.code === 'OFFLINE'
      ? '请先启动本地助手，然后点击重试'
      : error.message;
    setStatus('error', '本机助手未连接', message, true);
    renderFiles();
  }
}

function setUploading(uploading) {
  state.uploading = uploading;
  elements.addButton.disabled = uploading;
  elements.uploadState.hidden = !uploading;
  if (uploading) {
    elements.progressBar.style.width = '0%';
    elements.uploadProgress.textContent = '0%';
  }
  for (const button of document.querySelectorAll('.download-button, .delete-button')) {
    button.disabled = uploading;
  }
  renderFiles();
}

function uploadOne(file) {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    const params = new URLSearchParams({ name: file.name });
    request.open('POST', `${API_BASE}/api/files?${params.toString()}`);
    request.setRequestHeader('Content-Type', file.type || 'application/octet-stream');
    request.setRequestHeader('X-File-Type', file.type || 'application/octet-stream');

    request.upload.addEventListener('progress', (event) => {
      if (!event.lengthComputable) return;
      const progress = Math.round((event.loaded / event.total) * 100);
      elements.progressBar.style.width = `${progress}%`;
      elements.uploadProgress.textContent = `${progress}%`;
    });

    request.addEventListener('load', () => {
      let payload = {};
      try {
        payload = JSON.parse(request.responseText || '{}');
      } catch {
        // A malformed helper response is handled below.
      }
      if (request.status >= 200 && request.status < 300) {
        resolve(payload.file);
      } else {
        reject(new Error(payload.error || `上传失败（${request.status}）`));
      }
    });
    request.addEventListener('error', () => reject(new Error('上传时与本机助手断开连接')));
    request.addEventListener('abort', () => reject(new Error('上传已取消')));
    request.send(file);
  });
}

async function uploadFiles(fileList) {
  const files = Array.from(fileList || []);
  if (files.length === 0 || state.uploading) return;
  if (!state.info) {
    showToast('请先启动本机助手', 'error');
    return;
  }

  setUploading(true);
  let completed = 0;
  let failed = 0;
  const queue = [...files];

  async function worker() {
    while (queue.length > 0) {
      const file = queue.shift();
      elements.uploadName.textContent = `正在上传 ${file.name}`;
      try {
        await uploadOne(file);
        completed += 1;
      } catch (error) {
        failed += 1;
        showToast(`${file.name}：${error.message}`, 'error');
      }
    }
  }

  try {
    await Promise.all(Array.from({ length: Math.min(MAX_CONCURRENT_UPLOADS, files.length) }, worker));
    await connect({ quiet: true });
    if (completed > 0 && failed === 0) {
      showToast(`已添加 ${completed} 个文件`);
    } else if (completed > 0) {
      showToast(`已添加 ${completed} 个文件，${failed} 个失败`, 'error');
    }
  } finally {
    setUploading(false);
  }
}

async function downloadFile(file) {
  try {
    const url = absoluteShareUrl(file.downloadUrl);
    const downloadId = await chrome.downloads.download({
      url,
      filename: file.name,
      conflictAction: 'uniquify',
      saveAs: false
    });
    if (!downloadId) throw new Error('下载未开始');
    showToast(`正在下载 ${file.name}`);
  } catch (error) {
    showToast(`无法下载：${error.message}`, 'error');
  }
}

async function deleteFile(file, button) {
  const confirmed = window.confirm(`从共享列表中删除“${file.name}”？\n\n本机原文件不会被删除。`);
  if (!confirmed) return;
  button.disabled = true;
  try {
    await apiRequest(`/api/files/${file.id}`, { method: 'DELETE' });
    state.visibleFiles = state.visibleFiles.filter((item) => item.id !== file.id);
    renderFiles();
    showToast('已从共享列表删除');
  } catch (error) {
    button.disabled = false;
    showToast(error.message, 'error');
  }
}

async function copyShareLink() {
  if (!state.info || state.visibleFiles.length === 0) return;
  const url = absoluteShareUrl(state.info.shareUrl);
  try {
    await navigator.clipboard.writeText(url);
    showToast('分享链接已复制');
  } catch {
    showToast('无法访问剪贴板，请在预览页复制地址', 'error');
  }
}

function openSharePage() {
  if (!state.info || state.visibleFiles.length === 0) return;
  chrome.tabs.create({ url: absoluteShareUrl(state.info.shareUrl) });
}

elements.addButton.addEventListener('click', () => elements.fileInput.click());
elements.fileInput.addEventListener('change', () => {
  uploadFiles(elements.fileInput.files);
  elements.fileInput.value = '';
});
elements.retryButton.addEventListener('click', () => connect());
elements.refreshButton.addEventListener('click', () => connect({ quiet: true }));
elements.copyButton.addEventListener('click', copyShareLink);
elements.openButton.addEventListener('click', openSharePage);

for (const eventName of ['dragenter', 'dragover']) {
  document.addEventListener(eventName, (event) => {
    event.preventDefault();
    if (!state.uploading) elements.app.classList.add('dragging');
  });
}
for (const eventName of ['dragleave', 'drop']) {
  document.addEventListener(eventName, (event) => {
    event.preventDefault();
    if (eventName === 'dragleave' && event.relatedTarget) return;
    elements.app.classList.remove('dragging');
  });
}
document.addEventListener('drop', (event) => {
  if (event.dataTransfer?.files?.length) uploadFiles(event.dataTransfer.files);
});

refreshIcons();
connect();
