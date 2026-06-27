#!/usr/bin/env node
import { run } from '../dist/index.js';
run(process.argv.slice(2)).catch((e) => {
    console.error(e?.message || e);
    process.exit(1);
});
