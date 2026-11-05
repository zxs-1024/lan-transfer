'use strict';

const API_BASE = 'http://127.0.0.1:34567';
const MAX_CONCURRENT_UPLOADS = 2;
const translator = createTranslator(localStorage.getItem(LANGUAGE_STORAGE_KEY));
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
  languageSwitch: document.querySelector('#languageSwitch'),
  statusPanel: document.querySelector('#statusPanel'),
  statusTitle: document.querySelector('#statusTitle'),
  statusDetail: document.querySelector('#statusDetail'),
  retryButton: document.querySelector('#retryButton'),
  refreshButton: document.querySelector('#refreshButton'),
  shareHint: document.querySelector('#shareHint'),
  shareActions: document.querySelector('.share-actions'),
  shareUrl: document.querySelector('#shareUrl'),
  fileCount: document.querySelector('#fileCount'),
  textCount: document.querySelector('#textCount'),
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
  textInput: document.querySelector('#textInput'),
  addTextButton: document.querySelector('#addTextButton'),
  textList: document.querySelector('#textList'),
  textEmpty: document.querySelector('#textEmpty'),
  textLimit: document.querySelector('#textLimit'),
  toast: document.querySelector('#toast')
};

const state = {
  info: null,
  uploading: false,
  addingText: false,
  visibleFiles: [],
  visibleTexts: [],
  maxTextLength: 20000,
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

const formatDate = (isoDate) => translator.formatDate(isoDate);
const t = (key, values) => translator.t(key, values);

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
    throw new Error(payload.error || t('requestFailed', { status: response.status }));
  }
  return payload;
}

async function apiRequest(path, options) {
  let response;
  try {
    response = await fetch(`${API_BASE}${path}`, options);
  } catch {
    const error = new Error(t('helperUnavailable'));
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
  const texts = state.visibleTexts;
  const hasContent = hasFiles || texts.length > 0;
  const shareUrl = state.info && hasContent ? absoluteShareUrl(state.info.shareUrl) : '';
  const itemCount = files.length + texts.length;
  elements.fileCount.textContent = t('items', { count: itemCount });
  elements.shareUrl.textContent = shareUrl || (state.info ? t('addLinkPlaceholder') : t('notStarted'));
  elements.copyButton.disabled = !shareUrl;
  elements.openButton.disabled = !shareUrl;
  elements.shareActions.classList.toggle('disabled', !shareUrl);
  elements.shareHint.textContent = hasContent ? t('shareReadyHint') : t('shareHintEmpty');

  const lanAvailable = Boolean(state.info?.lanAvailable);
  elements.networkNote.textContent = lanAvailable
    ? t('sameWifi') : t('noLanAddress');

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
    codeElement.setAttribute('aria-label', t('qrLabel'));
    elements.qrShell.replaceChildren(codeElement);
  } catch (error) {
    showToast(t('qrFailed', { message: error.message }), 'error');
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
    elements.emptyState.querySelector('strong').textContent = t('receivingFiles');
    elements.emptyState.querySelector('span').textContent = t('receivingFilesHint');
  } else {
    elements.emptyState.querySelector('strong').textContent = t('fileEmpty');
    elements.emptyState.querySelector('span').textContent = t('fileEmptyHint');
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
    const downloadButton = createActionButton('download-button', 'download', t('downloadFile', { name: file.name }), () => downloadFile(file));
    const deleteButton = createActionButton('delete-button', 'trash-2', t('deleteFile', { name: file.name }), () => deleteFile(file, deleteButton));
    downloadButton.disabled = state.uploading;
    deleteButton.disabled = state.uploading;
    actions.append(downloadButton, deleteButton);

    row.append(icon, copy, actions);
    elements.fileList.append(row);
  }

  refreshIcons();
  updateSharePanel();
}

function renderTexts() {
  elements.textList.replaceChildren();
  elements.textEmpty.hidden = state.visibleTexts.length > 0;
  elements.textCount.textContent = t('textItems', { count: state.visibleTexts.length });
  elements.textLimit.textContent = t('textLimit', { count: state.maxTextLength.toLocaleString() });

  for (const textItem of state.visibleTexts) {
    const row = document.createElement('div');
    row.className = 'text-row';
    row.setAttribute('role', 'listitem');

    const copy = document.createElement('div');
    copy.className = 'file-copy';
    const preview = document.createElement('p');
    preview.className = 'text-preview';
    preview.textContent = textItem.text;
    const meta = document.createElement('div');
    meta.className = 'text-row-meta';
    meta.textContent = `${t('chars', { count: textItem.text.length.toLocaleString() })} · ${formatDate(textItem.createdAt)}`;
    copy.append(preview, meta);

    const actions = document.createElement('div');
    actions.className = 'text-row-actions';
    const copyButton = createActionButton('download-button', 'copy', t('copyTextToComputer'), () => copyTextFromComputer(textItem));
    const deleteButton = createActionButton('delete-button', 'trash-2', t('deleteText'), () => deleteText(textItem, deleteButton));
    actions.append(copyButton, deleteButton);

    row.append(copy, actions);
    elements.textList.append(row);
  }

  refreshIcons();
}

async function connect({ quiet = false } = {}) {
  if (!quiet) setStatus('', t('connectingTitle'), t('connectingDetail'));
  try {
    const info = await apiRequest('/api/info');
    state.info = info;
    state.visibleFiles = info.files || [];
    state.visibleTexts = info.texts || [];
    state.maxTextLength = Number(info.maxTextLength) || state.maxTextLength;
    if (info.lanAvailable) {
      setStatus('connected', t('connectedTitle'), `${info.hostname} · ${info.addresses[0].interface}`);
    } else {
      setStatus('connected', t('localOnlyTitle'), t('localOnlyDetail'));
    }
    renderFiles();
    renderTexts();
  } catch (error) {
    state.info = null;
    state.visibleFiles = [];
    state.visibleTexts = [];
    const message = error.code === 'OFFLINE'
      ? t('offlineDetail')
      : error.message;
    setStatus('error', t('disconnectedTitle'), message, true);
    renderFiles();
    renderTexts();
  }
}

async function addText(rawText) {
  const text = String(rawText || '');
  if (!text.trim() || state.addingText || !state.info) return;
  if (text.length > state.maxTextLength) {
    showToast(t('textTooLong', { count: state.maxTextLength.toLocaleString() }), 'error');
    return;
  }

  state.addingText = true;
  elements.addTextButton.disabled = true;
  try {
    const payload = await apiRequest('/api/texts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text })
    });
    state.visibleTexts = [payload.textItem, ...state.visibleTexts].slice(0, 20);
    elements.textInput.value = '';
    renderTexts();
    updateSharePanel();
    showToast(t('textAdded'));
  } catch (error) {
    if (error.code === 'OFFLINE') await connect({ quiet: true });
    showToast(error.message, 'error');
  } finally {
    state.addingText = false;
    elements.addTextButton.disabled = false;
    elements.textInput.focus();
  }
}

async function copyTextFromComputer(textItem) {
  try {
    await navigator.clipboard.writeText(textItem.text);
    showToast(t('textCopied'));
  } catch {
    showToast(t('clipboardUnavailable'), 'error');
  }
}

async function deleteText(textItem, button) {
  const confirmed = window.confirm(t('confirmDeleteText'));
  if (!confirmed) return;
  button.disabled = true;
  try {
    await apiRequest(`/api/texts/${textItem.id}`, { method: 'DELETE' });
    state.visibleTexts = state.visibleTexts.filter((item) => item.id !== textItem.id);
    renderTexts();
    updateSharePanel();
    showToast(t('textDeleted'));
  } catch (error) {
    button.disabled = false;
    showToast(error.message, 'error');
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
        reject(new Error(payload.error || t('uploadFailed', { status: request.status })));
      }
    });
    request.addEventListener('error', () => reject(new Error(t('uploadDisconnected'))));
    request.addEventListener('abort', () => reject(new Error(t('uploadCancelled'))));
    request.send(file);
  });
}

async function uploadFiles(fileList) {
  const files = Array.from(fileList || []);
  if (files.length === 0 || state.uploading) return;
  if (!state.info) {
    showToast(t('startHelperFirst'), 'error');
    return;
  }

  setUploading(true);
  let completed = 0;
  let failed = 0;
  const queue = [...files];

  async function worker() {
    while (queue.length > 0) {
      const file = queue.shift();
      elements.uploadName.textContent = t('uploadingFile', { name: file.name });
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
      showToast(t('fileAdded', { count: completed }));
    } else if (completed > 0) {
      showToast(t('filesPartiallyAdded', { count: completed, failed }), 'error');
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
    if (!downloadId) throw new Error(t('downloadNotStarted'));
    showToast(t('downloading', { name: file.name }));
  } catch (error) {
    showToast(t('downloadFailed', { message: error.message }), 'error');
  }
}

async function deleteFile(file, button) {
  const confirmed = window.confirm(t('confirmDeleteFile', { name: file.name }));
  if (!confirmed) return;
  button.disabled = true;
  try {
    await apiRequest(`/api/files/${file.id}`, { method: 'DELETE' });
    state.visibleFiles = state.visibleFiles.filter((item) => item.id !== file.id);
    renderFiles();
    showToast(t('fileDeleted'));
  } catch (error) {
    button.disabled = false;
    showToast(error.message, 'error');
  }
}

async function copyShareLink() {
  if (!state.info || (state.visibleFiles.length === 0 && state.visibleTexts.length === 0)) return;
  const url = absoluteShareUrl(state.info.shareUrl);
  try {
    await navigator.clipboard.writeText(url);
    showToast(t('shareLinkCopied'));
  } catch {
    showToast(t('copyLinkFailed'), 'error');
  }
}

function openSharePage() {
  if (!state.info || (state.visibleFiles.length === 0 && state.visibleTexts.length === 0)) return;
  chrome.tabs.create({ url: absoluteShareUrl(state.info.shareUrl) });
}

function renderStatus() {
  if (!state.info) return;
  if (state.info.lanAvailable) {
    setStatus('connected', t('connectedTitle'), `${state.info.hostname} · ${state.info.addresses[0].interface}`);
  } else {
    setStatus('connected', t('localOnlyTitle'), t('localOnlyDetail'));
  }
}

function applyLanguage(language, { persist = true } = {}) {
  translator.setLanguage(language);
  if (persist) localStorage.setItem(LANGUAGE_STORAGE_KEY, translator.language);
  applyStaticTranslations(translator);
  document.title = t('brandName');
  elements.textInput.placeholder = t('textPlaceholder');
  elements.textInput.setAttribute('aria-label', t('textsTitle'));
  elements.qrShell.setAttribute('aria-label', t('qrLabel'));
  elements.addTextButton.setAttribute('aria-label', t('addText'));
  elements.fileInput.setAttribute('aria-label', t('selectFiles'));
  if (state.info) {
    renderStatus();
  } else {
    elements.retryButton.textContent = t('retry');
    elements.statusTitle.textContent = t('connectingTitle');
    elements.statusDetail.textContent = t('connectingDetail');
  }
  renderFiles();
  renderTexts();
}

elements.addButton.addEventListener('click', () => elements.fileInput.click());
elements.addTextButton.addEventListener('click', () => addText(elements.textInput.value));
elements.textInput.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
    event.preventDefault();
    addText(elements.textInput.value);
  }
});
elements.textInput.addEventListener('paste', (event) => {
  const pasted = event.clipboardData?.getData('text/plain');
  if (!pasted) return;
  event.preventDefault();
  addText(pasted);
});
elements.fileInput.addEventListener('change', () => {
  uploadFiles(elements.fileInput.files);
  elements.fileInput.value = '';
});
elements.retryButton.addEventListener('click', () => connect());
elements.refreshButton.addEventListener('click', () => connect({ quiet: true }));
elements.copyButton.addEventListener('click', copyShareLink);
elements.openButton.addEventListener('click', openSharePage);
elements.languageSwitch.addEventListener('click', (event) => {
  const button = event.target.closest('[data-language]');
  if (!button) return;
  applyLanguage(button.dataset.language);
});

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

applyLanguage(translator.language, { persist: false });
connect();
