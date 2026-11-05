'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

function catalog(filePath) {
  const source = fs.readFileSync(filePath, 'utf8');
  const translationsMatch = /const TRANSLATIONS = (\{[\s\S]*?\n\});/.exec(source);
  assert.ok(translationsMatch, `${filePath} should define TRANSLATIONS`);
  return Function(`"use strict"; return ${translationsMatch[1]};`)();
}

test('extension and phone translation catalogs stay in sync', () => {
  const root = path.join(__dirname, '..');
  const extensionCatalog = catalog(path.join(root, 'extension/i18n.js'));
  const serverCatalog = catalog(path.join(root, 'server/public/i18n.js'));
  assert.deepEqual(serverCatalog, extensionCatalog);
  assert.deepEqual(Object.keys(extensionCatalog.zh).sort(), Object.keys(extensionCatalog.en).sort());
});

test('every static translation key used in HTML exists in both languages', () => {
  const root = path.join(__dirname, '..');
  const translations = catalog(path.join(root, 'extension/i18n.js'));
  const pages = ['extension/popup.html', 'server/public/share.html'];
  for (const page of pages) {
    const html = fs.readFileSync(path.join(root, page), 'utf8');
    for (const match of html.matchAll(/data-i18n(?:-placeholder|-title|-aria-label)?="([^"]+)"/g)) {
      assert.ok(translations.en[match[1]], `${page}: missing English key ${match[1]}`);
      assert.ok(translations.zh[match[1]], `${page}: missing Chinese key ${match[1]}`);
    }
  }
});

test('extension locale bundles identify the product in English and Chinese', () => {
  const root = path.join(__dirname, '..');
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'extension/manifest.json'), 'utf8'));
  assert.equal(manifest.default_locale, 'en');
  assert.equal(manifest.name, '__MSG_extensionName__');
  const english = JSON.parse(fs.readFileSync(path.join(root, 'extension/_locales/en/messages.json'), 'utf8'));
  const chinese = JSON.parse(fs.readFileSync(path.join(root, 'extension/_locales/zh_CN/messages.json'), 'utf8'));
  assert.equal(english.extensionName.message, 'LAN Transfer');
  assert.equal(chinese.extensionName.message, '邻传');
});
