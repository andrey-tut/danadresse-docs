#!/usr/bin/env node
/**
 * @danadresse/migrate-cli
 *
 * Scans a project for DAWA URLs (dawa.aws.dk, api.dataforsyningen.dk) and
 * either prints a diff or writes replacements.
 *
 * Usage:
 *   npx @danadresse/migrate-cli                  # dry-run, show diff
 *   npx @danadresse/migrate-cli --write          # apply changes
 *   npx @danadresse/migrate-cli --target src/    # restrict scan
 *   npx @danadresse/migrate-cli --key dawa_test_...  # set X-Api-Key reminder
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fg from 'fast-glob';
import pc from 'picocolors';

const SOURCE_PATTERNS = [
    /https?:\/\/dawa\.aws\.dk/g,
    /https?:\/\/api\.dataforsyningen\.dk/g,
];
const TARGET_URL = 'https://api.danadresse.dk';

const DEFAULT_GLOBS = [
    '**/*.{js,ts,jsx,tsx,mjs,cjs}',
    '**/*.{py,php,rb,go,java,cs,kt,swift,rs}',
    '**/*.{html,vue,svelte,astro}',
    '**/*.{json,yaml,yml,env,toml,ini,conf,cfg}',
    '**/*.{md,rst,txt}',
    '!**/node_modules/**',
    '!**/.git/**',
    '!**/.venv/**',
    '!**/venv/**',
    '!**/dist/**',
    '!**/build/**',
    '!**/__pycache__/**',
    '!**/.next/**',
    '!**/vendor/**',
];

interface CliOptions {
    write: boolean;
    target: string;
    keyHint: string | null;
    showHelp: boolean;
}

function parseArgs(argv: string[]): CliOptions {
    const opts: CliOptions = { write: false, target: '.', keyHint: null, showHelp: false };
    for (let i = 0; i < argv.length; i++) {
        const a = argv[i];
        switch (a) {
            case '--write': case '-w': opts.write = true; break;
            case '--target': case '-t': opts.target = argv[++i] ?? '.'; break;
            case '--key':              opts.keyHint = argv[++i] ?? null; break;
            case '--help': case '-h':  opts.showHelp = true; break;
            default:
                if (a.startsWith('--')) console.warn(pc.yellow(`Unknown flag: ${a}`));
                else opts.target = a;
        }
    }
    return opts;
}

function help(): void {
    console.log(`
${pc.bold('@danadresse/migrate-cli')} — Migrate codebase from DAWA → Danadresse

${pc.bold('Usage:')}
    npx @danadresse/migrate-cli [options] [path]

${pc.bold('Options:')}
    -w, --write              Apply changes (default: dry-run with diff)
    -t, --target <path>      Project root to scan (default: current dir)
        --key <api_key>      Show reminder code with this X-Api-Key
    -h, --help               Show this help

${pc.bold('Examples:')}
    npx @danadresse/migrate-cli                    # show what would change
    npx @danadresse/migrate-cli --write            # apply
    npx @danadresse/migrate-cli --target src/      # scan only src/
    npx @danadresse/migrate-cli --key dawa_test_xxx # show example header

${pc.dim('What it replaces:')}
    https://dawa.aws.dk           → https://api.danadresse.dk
    https://api.dataforsyningen.dk → https://api.danadresse.dk

${pc.dim('Remember:')} after migration, add ${pc.cyan('X-Api-Key')} header to your requests.
Get a free key at ${pc.cyan('https://danadresse.dk/dashboard/keys')}
`);
}

interface ScanHit {
    file: string;
    line: number;
    matched: string;
    context: string;
}

async function scanFiles(target: string): Promise<{ file: string; hits: ScanHit[] }[]> {
    const files = await fg(DEFAULT_GLOBS, {
        cwd: target, absolute: true, dot: false,
    });

    const results: { file: string; hits: ScanHit[] }[] = [];
    for (const file of files) {
        let content: string;
        try {
            content = await fs.readFile(file, 'utf-8');
        } catch {
            continue;
        }
        const hits: ScanHit[] = [];
        const lines = content.split('\n');
        for (let i = 0; i < lines.length; i++) {
            for (const pat of SOURCE_PATTERNS) {
                pat.lastIndex = 0;
                const m = pat.exec(lines[i]);
                if (m) {
                    hits.push({
                        file: path.relative(target, file),
                        line: i + 1,
                        matched: m[0],
                        context: lines[i].trim(),
                    });
                }
            }
        }
        if (hits.length) results.push({ file, hits });
    }
    return results;
}

async function rewriteFile(file: string): Promise<number> {
    let content = await fs.readFile(file, 'utf-8');
    let count = 0;
    for (const pat of SOURCE_PATTERNS) {
        content = content.replace(pat, () => { count++; return TARGET_URL; });
    }
    if (count) await fs.writeFile(file, content, 'utf-8');
    return count;
}

export async function run(argv: string[]): Promise<void> {
    const opts = parseArgs(argv);
    if (opts.showHelp) { help(); return; }

    const target = path.resolve(opts.target);
    console.log(pc.bold(`\n🔍 Scanning ${pc.cyan(target)}...\n`));

    const scan = await scanFiles(target);
    const totalFiles = scan.length;
    const totalHits = scan.reduce((s, f) => s + f.hits.length, 0);

    if (!totalHits) {
        console.log(pc.green('✓ No DAWA URLs found. Your code may already be migrated, or it doesn\'t use DAWA.\n'));
        return;
    }

    console.log(pc.bold(`Found ${pc.yellow(String(totalHits))} occurrence(s) in ${pc.yellow(String(totalFiles))} file(s):\n`));

    for (const { file, hits } of scan) {
        console.log(pc.bold(pc.cyan(`  ${hits[0].file}`)));
        for (const h of hits) {
            console.log(`    ${pc.dim(`${h.line}:`)} ${h.context}`);
            const newContext = h.context
                .replace(h.matched, pc.green(TARGET_URL))
                .replace(h.matched, pc.green(TARGET_URL));
            console.log(`    ${pc.dim('  →')} ${newContext}`);
        }
        console.log();
    }

    if (opts.write) {
        console.log(pc.bold(pc.yellow('\n✏️  Applying changes...\n')));
        let totalReplaced = 0;
        for (const { file } of scan) {
            const n = await rewriteFile(file);
            if (n) {
                totalReplaced += n;
                console.log(pc.green(`  ✓ ${path.relative(target, file)} (${n} replacement${n === 1 ? '' : 's'})`));
            }
        }
        console.log(pc.bold(pc.green(`\n✓ Done. ${totalReplaced} replacement(s) across ${scan.length} file(s).\n`)));
    } else {
        console.log(pc.dim('Run with ') + pc.bold('--write') + pc.dim(' to apply changes.'));
    }

    // Reminder про API key
    const keyHint = opts.keyHint ?? 'dawa_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx';
    console.log(`
${pc.bold(pc.cyan('⚠ Next step:'))} add an ${pc.cyan('X-Api-Key')} header to your requests.

${pc.dim('// Example (TypeScript):')}
const r = await fetch('${TARGET_URL}/autocomplete?q=R%C3%A5d', {
    headers: { 'X-Api-Key': '${keyHint}' }
});

${pc.dim('// Example (Python):')}
import httpx
r = httpx.get('${TARGET_URL}/autocomplete', params={'q': 'Råd'},
              headers={'X-Api-Key': '${keyHint}'})

${pc.bold('Free 1000 calls/month:')} ${pc.cyan('https://danadresse.dk/dashboard/keys')}
`);
}
