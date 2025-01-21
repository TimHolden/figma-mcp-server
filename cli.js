#!/usr/bin/env node
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const serverPath = resolve(__dirname, './dist/index.js');

import(serverPath).catch(console.error);