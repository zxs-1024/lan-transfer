#!/usr/bin/env node

'use strict';

const { startServer } = require('./app');
const { networkInterfaces } = require('node:os');

function parseArguments(argv) {
  const options = {
    port: Number(process.env.LAN_TRANSFER_PORT || 34567),
    host: process.env.LAN_TRANSFER_HOST || '0.0.0.0',
    dataDir: process.env.LAN_TRANSFER_DATA_DIR
  };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--port' && argv[index + 1]) {
      options.port = Number(argv[index + 1]);
      index += 1;
    } else if (argument === '--data-dir' && argv[index + 1]) {
      options.dataDir = argv[index + 1];
      index += 1;
    } else if (argument === '--help' || argument === '-h') {
      console.log('Usage: node server/index.js [--port 34567] [--data-dir /path/to/data]');
      process.exit(0);
    }
  }

  if (!Number.isInteger(options.port) || options.port < 1 || options.port > 65535) {
    throw new Error('Port must be an integer between 1 and 65535.');
  }

  return options;
}

function findLanUrls(port) {
  const urls = [];
  for (const [name, addresses] of Object.entries(networkInterfaces())) {
    for (const address of addresses || []) {
      if (address.family === 'IPv4' && !address.internal) {
        urls.push(`http://${address.address}:${port}/ (${name})`);
      }
    }
  }
  return urls;
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  const instance = await startServer(options);
  const addresses = findLanUrls(instance.port);

  console.log('');
  console.log('邻传本机助手已启动。');
  console.log(`Local: http://127.0.0.1:${instance.port}/api/info`);
  if (addresses.length > 0) {
    console.log('LAN:');
    for (const address of addresses) console.log(`  ${address}`);
  } else {
    console.log('LAN: no active IPv4 network found. Connect this computer to Wi-Fi.');
  }
  console.log('Keep this window open while downloading from your phone.');
  console.log('Press Ctrl+C to stop.');
  console.log('');

  const shutdown = async () => {
    await instance.close();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((error) => {
  console.error(`无法启动邻传：${error.message}`);
  process.exitCode = 1;
});
