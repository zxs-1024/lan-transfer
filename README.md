# LAN Transfer

LAN Transfer (邻传) is a Chrome extension and local Node.js helper for moving files and text between a computer and phones on the same Wi-Fi network. The extension UI and the phone share page default to English and can switch to Chinese.

Chrome extensions cannot listen on LAN ports by themselves, so the project has two parts:

- `extension/`: a Chrome Manifest V3 extension for file and text management, local downloads, QR codes, and share links.
- `server/`: a local helper built with Node.js built-in modules only. It stores shared content and serves the phone page.

## Requirements

- Chrome
- Node.js 18 or newer
- Computer and phone connected to the same Wi-Fi or LAN

No `npm install` step is required.

## Install and Run

### 1. Start the local helper

On macOS, double-click `start.command`, or run:

```bash
npm start
```

If macOS blocks the double-click action on first launch, right-click `start.command` and choose **Open**. Keep the terminal window running. Phone links stop working when the helper exits.

### 2. Load the Chrome extension

1. Open `chrome://extensions/` in Chrome.
2. Enable **Developer mode**.
3. Click **Load unpacked** and select the `extension` directory.
4. Pin LAN Transfer to the toolbar.

### 3. Share files and text

Click **Add files** or drop local files into the extension. Then:

- Click the download button beside a file to save it through Chrome.
- Click **Copy link** to send the share page to another device on the same LAN.
- Scan the QR code with a phone. The phone page supports individual downloads and **Download all**.

To share text, paste into the text box. Text is added immediately and appears in **Shared text** on the phone page, where it can be copied individually or with **Copy all**.

The UI and phone page default to English. Use **EN / 中文** to switch languages. The choice is stored in that browser. Add `?lang=zh` or `?lang=en` to the phone share URL to override the saved language for that visit. The extension's Chrome browser-surface name follows Chrome's display language.

Text sharing limits:

- Up to 20,000 characters per item.
- The most recent 20 text items are kept.
- Shared files and text are stored in `~/.lan-transfer/`.

Deleting an item removes only the shared copy. It does not delete the original file from the computer.

## Network and Safety

- Guest Wi-Fi networks may prevent devices from reaching each other.
- Sleep mode, a stopped helper, or a firewall blocking Node.js incoming connections will make the phone page unavailable.
- Anyone on the LAN who has the share link can view the shared list, download files, and read text. Do not publish the link.
- The extension uses only the loopback management API at `127.0.0.1:34567`. Phones can access the read-only share page but cannot call file or text management APIs.

## Troubleshooting

**The extension says "Helper not connected"**

Confirm the `npm start` process is still running, then click **Retry**. If you change the default port, update `API_BASE` in `extension/popup.js` and `host_permissions` in `extension/manifest.json` together.

**The QR code appears but the phone cannot connect**

Check that the phone is not on a guest network. If the extension exposes multiple LAN addresses, use **Preview** to open the share page and try another interface. Also check whether the macOS firewall allows Node.js incoming connections.

**Large file downloads**

The helper supports HTTP Range requests and streams files instead of loading them fully into memory. Downloads can be paused and resumed through the browser download manager.

## Development

```bash
npm test
```

The tests cover uploads, listing, Unicode filenames, authorization, Range downloads, HEAD requests, path sanitization, text sharing, text limits, deletion, loading-state cleanup, and bilingual catalog consistency.

## 中文说明

邻传（LAN Transfer）是一个用于 Chrome 的本地文件和文本分享扩展。它可以从电脑中选择文件、粘贴文本，也可以生成局域网二维码，让同一 Wi-Fi 下的手机下载文件和复制文本。扩展界面与手机分享页默认显示英文，可切换为中文。

Chrome 扩展不能自行监听局域网端口，所以本项目包含两个部分：

- `extension/`：Chrome Manifest V3 扩展，负责文件与文本管理、本地下载、二维码和分享链接。
- `server/`：只使用 Node.js 内置模块的本地助手，负责保存共享内容并提供手机页面。

### 运行要求

- Chrome
- Node.js 18 或更高版本
- 手机与电脑连接同一个 Wi-Fi 或局域网

无需执行 `npm install`。

### 安装和启动

#### 1. 启动本机助手

在 macOS 上双击 `start.command`，或在终端运行：

```bash
npm start
```

首次在 macOS 双击时，如果系统阻止运行，可右键 `start.command` 选择“打开”。保持终端窗口运行，关闭后手机链接将失效。

#### 2. 加载 Chrome 扩展

1. 在 Chrome 打开 `chrome://extensions/`。
2. 打开右上角“开发者模式”。
3. 点击“加载已解压的扩展程序”，选择本项目的 `extension` 文件夹。
4. 将 LAN Transfer 固定到工具栏。

#### 3. 分享文件和文本

打开扩展，点击“Add files”或拖入文件。文件出现在列表后：

- 点击文件旁的下载按钮，由 Chrome 保存到默认下载目录。
- 点击“Copy link”将局域网分享页发给同一 Wi-Fi 中的设备。
- 用手机扫描二维码。手机页支持逐个下载文件和“Download all”全部下载。

在文本框粘贴内容后，文本会立即加入共享列表。手机打开分享页后，可在“Shared text”区域逐条复制，或点击“Copy all”全部复制。

扩展和手机页默认英文，使用 **EN / 中文** 切换语言。选择会保存在当前浏览器中。在手机分享链接后添加 `?lang=zh` 或 `?lang=en`，可以用 URL 覆盖该次访问的语言。扩展在 Chrome 浏览器界面中的名称跟随 Chrome 显示语言。

文本共享限制：

- 单条最多 20,000 个字符。
- 保留最近 20 条文本。
- 共享文件和文本保存在 `~/.lan-transfer/`。

删除只会移除共享副本，不会删除电脑中的原文件。

### 网络与安全

- 访客 Wi-Fi 网络可能阻止设备互访。
- 电脑休眠、助手退出，或防火墙阻止 Node.js 入站连接时，手机无法访问分享页。
- 局域网中拿到分享链接的人可以查看列表、下载文件和读取文本。不要公开发布分享链接。
- 扩展只连接 `127.0.0.1:34567` 的回环管理接口。手机只能访问只读分享页，不能调用文件或文本管理接口。

### 常见问题

**扩展显示“Helper not connected”**

确认 `npm start` 的进程仍在运行，然后点击“Retry”。如果修改了默认端口，需要同时修改 `extension/popup.js` 中的 `API_BASE` 和 `extension/manifest.json` 中的 `host_permissions`。

**二维码出现但手机打不开**

确认手机连接的不是访客 Wi-Fi。如果扩展显示多个局域网地址，可点击“Preview”打开分享页并尝试其他网卡地址。同时检查 macOS 防火墙是否允许 Node.js 接受传入连接。

**下载大文件**

服务端支持 HTTP Range 请求，并使用流式读取而不是将整个文件读入内存。下载可通过浏览器下载管理器暂停和继续。

### 开发验证

```bash
npm test
```

测试覆盖文件上传、列表、Unicode 文件名、鉴权、Range 下载、HEAD 请求、路径清理、文本共享、文本限制、删除、加载状态清理和中英文翻译目录一致性。
