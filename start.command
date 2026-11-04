#!/bin/zsh
set -e

cd "$(dirname "$0")"

if ! command -v node >/dev/null 2>&1; then
  echo "未找到 Node.js。请先安装 Node.js 18 或更高版本：https://nodejs.org/"
  read -r "?按回车键关闭..."
  exit 1
fi

echo "正在启动邻传本机助手..."
node server/index.js
