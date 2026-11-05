// Keep this copy in sync with extension/i18n.js; npm test checks both files.
'use strict';

const LANGUAGE_STORAGE_KEY = 'lan-transfer-language';

const TRANSLATIONS = {
  en: {
    brandName: 'LAN Transfer', brandSubtitle: 'Transfer files and text between devices',
    connectingTitle: 'Connecting to helper', connectingDetail: 'Checking 127.0.0.1:34567',
    retry: 'Retry', phoneTitle: 'Open on your phone', shareHintEmpty: 'Add a file or text, then scan with your phone',
    waitingContent: 'Waiting for content', notConnected: 'Not connected', copyLink: 'Copy link', preview: 'Preview',
    sameWifi: 'Phone and computer must use the same Wi-Fi', textsTitle: 'Text', textsHint: 'Paste text to share it instantly',
    textPlaceholder: 'Paste text here...', add: 'Add', textEmpty: 'No shared text yet. Copy some text and paste it above.',
    filesTitle: 'Files', filesHint: 'Choose or drop local files', addFile: 'Add files', addText: 'Add text',
    uploading: 'Uploading', fileEmpty: 'No files yet', fileEmptyHint: 'Add files to download them or share by QR code',
    refresh: 'Refresh', items: '{count} items', textItems: '{count} items',
    noLanAddress: 'No LAN address detected. Check your Wi-Fi or click refresh.',
    addLinkPlaceholder: 'Add a file or text to generate a link', notStarted: 'Not connected',
    connectedTitle: 'Phone sharing is ready', localOnlyTitle: 'Local download only',
    localOnlyDetail: 'No Wi-Fi address detected; phone sharing is unavailable',
    disconnectedTitle: 'Helper not connected', offlineDetail: 'Start the local helper, then click Retry',
    receivingFiles: 'Receiving files', receivingFilesHint: 'A phone download link will appear when uploads finish',
    uploadingFile: 'Uploading {name}', downloadFile: 'Download {name}', deleteFile: 'Delete {name}',
    copyTextToComputer: 'Copy text to this computer', deleteText: 'Delete this text',
    chars: '{count} characters', textLimit: 'Paste to add automatically · Up to {count} characters',
    shareReadyHint: 'Download files and copy text from your phone', shareLinkCopied: 'Share link copied',
    copyLinkFailed: 'Cannot access the clipboard. Copy the URL from Preview.',
    textAdded: 'Text added. It is ready on your phone.', textCopied: 'Text copied to the clipboard',
    clipboardUnavailable: 'Cannot access the clipboard', confirmDeleteText: 'Remove this text from the phone share list?',
    textDeleted: 'Text removed', textTooLong: 'Text cannot exceed {count} characters',
    startHelperFirst: 'Start the local helper first', fileAdded: 'Added {count} files',
    filesPartiallyAdded: 'Added {count} files; {failed} failed', downloading: 'Downloading {name}',
    downloadFailed: 'Unable to download: {message}',
    confirmDeleteFile: 'Remove “{name}” from the share list?\n\nThe original file on this computer will not be deleted.',
    fileDeleted: 'Removed from the share list', uploadFailed: 'Upload failed ({status})',
    uploadDisconnected: 'Disconnected from the helper during upload', uploadCancelled: 'Upload cancelled',
    requestFailed: 'Request failed ({status})', helperUnavailable: 'Cannot connect to the local helper',
    qrLabel: 'Phone access QR code', qrFailed: 'QR code failed: {message}', downloadNotStarted: 'Download did not start',
    selectFiles: 'Select files to share', loading: 'Loading', pageTitle: 'LAN Transfer · Shared files',
    homeLabel: 'LAN Transfer home', filesSummary: '{count} files · {size} total', emptyShare: 'Nothing is shared',
    copyText: 'Copy text', copiedToPhone: 'Copied to your clipboard',
    copyFailedManual: 'Copy failed. Press and hold the text to copy it.', copyAllSuccess: 'Copied {count} text items',
    copyAllFailed: 'Copy failed. Press and hold each text item to copy it.',
    multipleDownloads: 'Your browser may ask to allow multiple downloads', summaryLoading: 'Loading files',
    connectionFailed: 'Connection failed', sharedFiles: 'Shared files', sharedText: 'Shared text',
    readyTitle: 'Content is ready', introCopy: 'Download files or copy text directly to your phone.',
    direct: 'Direct on LAN', copyAll: 'Copy all', downloadAll: 'Download all', emptyTitle: 'Nothing shared yet',
    emptyCopy: 'Add files or text in the LAN Transfer extension on your computer, then refresh this page.',
    refreshList: 'Refresh', errorTitle: 'Unable to load content',
    errorCopy: 'Make sure the LAN Transfer helper is running and both devices are on the same Wi-Fi.',
    reconnect: 'Reconnect', privacyNote: 'Only people on this network with the link can view its contents.',
    from: 'From', loadingFiles: 'Loading files', loadingText: 'Loading text',
    textSummary: '{count} items · Tap to copy', characters: '{count} characters',
    downloadNamed: 'Download {name}', loadingAria: 'Loading files'
  },
  zh: {
    brandName: '邻传', brandSubtitle: '电脑与手机之间传文件、文本',
    connectingTitle: '正在连接本机助手', connectingDetail: '检查 127.0.0.1:34567', retry: '重试',
    phoneTitle: '手机扫码取用', shareHintEmpty: '添加文件或文本后，手机扫一扫即可获取',
    waitingContent: '等待内容', notConnected: '尚未启动', copyLink: '复制链接', preview: '预览',
    sameWifi: '手机与电脑需连接同一 Wi-Fi', textsTitle: '文本', textsHint: '粘贴文本后立即添加到手机',
    textPlaceholder: '在这里粘贴文本...', add: '添加', textEmpty: '暂无文本，复制后在上方粘贴即可',
    filesTitle: '文件', filesHint: '选择或拖入本地文件', addFile: '添加文件', addText: '添加文本',
    uploading: '正在上传', fileEmpty: '还没有文件', fileEmptyHint: '添加文件后即可下载或扫码分享',
    refresh: '刷新文件', items: '{count} 项', textItems: '{count} 条',
    noLanAddress: '未检测到局域网地址，请检查 Wi-Fi 或点击刷新',
    addLinkPlaceholder: '添加文件或文本后生成链接', notStarted: '尚未启动',
    connectedTitle: '手机分享已就绪', localOnlyTitle: '本机下载可以使用', localOnlyDetail: '未检测到 Wi-Fi 地址，手机分享不可用',
    disconnectedTitle: '本机助手未连接', offlineDetail: '请先启动本地助手，然后点击重试',
    receivingFiles: '正在接收文件', receivingFilesHint: '上传完成后会自动生成手机下载链接',
    uploadingFile: '正在上传 {name}', downloadFile: '下载 {name}', deleteFile: '删除 {name}',
    copyTextToComputer: '复制文本到电脑剪贴板', deleteText: '删除这条文本',
    chars: '{count} 字符', textLimit: '粘贴后自动添加 · 最多 {count} 字符',
    shareReadyHint: '手机扫码后可下载文件、复制文本', shareLinkCopied: '分享链接已复制',
    copyLinkFailed: '无法访问剪贴板，请在预览页复制地址', textAdded: '文本已添加，手机端可复制',
    textCopied: '文本已复制到剪贴板', clipboardUnavailable: '无法访问剪贴板',
    confirmDeleteText: '从手机共享列表中删除这条文本？', textDeleted: '已删除这条文本',
    textTooLong: '文本不能超过 {count} 个字符', startHelperFirst: '请先启动本机助手',
    fileAdded: '已添加 {count} 个文件', filesPartiallyAdded: '已添加 {count} 个文件，{failed} 个失败',
    downloading: '正在下载 {name}', downloadFailed: '无法下载：{message}',
    confirmDeleteFile: '从共享列表中删除“{name}”？\n\n本机原文件不会被删除。', fileDeleted: '已从共享列表删除',
    uploadFailed: '上传失败（{status}）', uploadDisconnected: '上传时与本机助手断开连接', uploadCancelled: '上传已取消',
    requestFailed: '请求失败（{status}）', helperUnavailable: '无法连接本机助手', qrLabel: '手机下载二维码',
    qrFailed: '二维码生成失败：{message}', downloadNotStarted: '下载未开始', selectFiles: '选择要分享的文件',
    loading: '加载中', pageTitle: '邻传 · 文件下载', homeLabel: '邻传文件下载首页',
    filesSummary: '{count} 个文件 · 共 {size}', emptyShare: '共享列表为空', copyText: '复制文本',
    copiedToPhone: '已复制到手机剪贴板', copyFailedManual: '复制失败，请长按文本手动复制',
    copyAllSuccess: '已复制 {count} 条文本', copyAllFailed: '复制失败，请逐条长按复制',
    multipleDownloads: '浏览器可能询问是否允许多个下载', summaryLoading: '正在读取文件列表',
    connectionFailed: '连接失败', sharedFiles: '共享文件', sharedText: '共享文本', readyTitle: '内容已准备好',
    introCopy: '文件可点击下载，文本可一键复制到手机。', direct: '局域网直连', copyAll: '全部复制',
    downloadAll: '全部下载', emptyTitle: '暂无共享内容', emptyCopy: '请在电脑上的邻传扩展中添加文件或文本，然后刷新此页面。',
    refreshList: '刷新列表', errorTitle: '无法读取内容',
    errorCopy: '请确认电脑上的邻传助手仍在运行，且手机与电脑连接同一 Wi-Fi。', reconnect: '重新连接',
    privacyNote: '仅同一网络中的访问者可查看此链接中的内容。', from: '来自', loadingFiles: '正在读取文件列表',
    loadingText: '正在读取文本', textSummary: '{count} 条 · 点击复制', characters: '{count} 字符',
    downloadNamed: '下载 {name}', loadingAria: '正在加载文件'
  }
};

function normalizeLanguage(language) { return language === 'zh' ? 'zh' : 'en'; }
function interpolate(template, values = {}) { return template.replace(/\{(\w+)\}/g, (_, key) => String(values[key] ?? '')); }
function createTranslator(language) {
  let currentLanguage = normalizeLanguage(language);
  return {
    get language() { return currentLanguage; },
    setLanguage(nextLanguage) { currentLanguage = normalizeLanguage(nextLanguage); return currentLanguage; },
    formatDate(value) {
      try {
        return new Intl.DateTimeFormat(currentLanguage === 'zh' ? 'zh-CN' : 'en-US', {
          month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit'
        }).format(new Date(value));
      } catch { return ''; }
    },
    t(key, values) { return interpolate(TRANSLATIONS[currentLanguage][key] || key, values); }
  };
}
function getUrlLanguage() {
  const language = new URLSearchParams(window.location.search).get('lang');
  return language === 'zh' || language === 'en' ? language : null;
}
function applyStaticTranslations(translator) {
  document.documentElement.lang = translator.language === 'zh' ? 'zh-CN' : 'en';
  document.querySelectorAll('[data-i18n]').forEach((element) => { element.textContent = translator.t(element.dataset.i18n); });
  document.querySelectorAll('[data-i18n-placeholder]').forEach((element) => { element.placeholder = translator.t(element.dataset.i18nPlaceholder); });
  document.querySelectorAll('[data-i18n-title]').forEach((element) => { element.title = translator.t(element.dataset.i18nTitle); });
  document.querySelectorAll('[data-i18n-aria-label]').forEach((element) => { element.setAttribute('aria-label', translator.t(element.dataset.i18nAriaLabel)); });
  document.querySelectorAll('[data-language]').forEach((button) => { button.setAttribute('aria-pressed', String(button.dataset.language === translator.language)); });
}
