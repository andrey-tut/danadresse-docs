import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { run } from '../src/index';

let dir: string;
beforeEach(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), 'dda-cli-'));
    vi.spyOn(console, 'log').mockImplementation(() => {});
});
afterEach(async () => {
    vi.restoreAllMocks();
    await fs.rm(dir, { recursive: true, force: true });
});

const SRC = [
    '<script src="https://dawa.aws.dk/js/autocomplete/dawa-autocomplete2.min.js"></script>',
    '<script src="https://cdn.dataforsyningen.dk/dawa/assets/dawa-autocomplete2/1.0.2/dawa-autocomplete2.min.js"></script>',
    '<img src="https://cdn.dataforsyningen.dk/other/logo.png">',
    "fetch('https://api.dataforsyningen.dk/adresser?q=x')",
].join('\n');

describe('migrate-cli', () => {
    it('dry-run changes nothing', async () => {
        await fs.writeFile(path.join(dir, 'a.html'), SRC);
        await run([dir]);
        expect(await fs.readFile(path.join(dir, 'a.html'), 'utf-8')).toBe(SRC);
    });

    it('--write rewrites DAWA hosts and the widget CDN path, leaves other CDN files', async () => {
        await fs.writeFile(path.join(dir, 'a.html'), SRC);
        await run(['--write', dir]);
        const out = await fs.readFile(path.join(dir, 'a.html'), 'utf-8');
        expect(out).not.toContain('dawa.aws.dk');
        expect(out).not.toContain('api.dataforsyningen.dk');
        expect(out).toContain('https://api.danadresse.dk/js/autocomplete/dawa-autocomplete2.min.js');
        expect(out).toContain('https://api.danadresse.dk/dawa/assets/dawa-autocomplete2/1.0.2/');
        expect(out).toContain('https://cdn.dataforsyningen.dk/other/logo.png');
    });

    it('prints the ?key= hint when the widget is found', async () => {
        await fs.writeFile(path.join(dir, 'a.html'), SRC);
        const log = vi.spyOn(console, 'log');
        await run([dir, '--key', 'dawa_test_abc']);
        const text = log.mock.calls.map(c => String(c[0])).join('\n');
        expect(text).toContain('dawa-autocomplete2.min.js?key=dawa_test_abc');
    });

    it('accepts the documented subcommands: scan (dry-run) and rewrite --apikey', async () => {
        await fs.writeFile(path.join(dir, 'a.html'), SRC);
        await run(['scan', dir]);
        expect(await fs.readFile(path.join(dir, 'a.html'), 'utf-8')).toBe(SRC);
        await run(['rewrite', dir, '--apikey', 'dawa_live_x']);
        expect(await fs.readFile(path.join(dir, 'a.html'), 'utf-8')).not.toContain('dawa.aws.dk');
    });
});
