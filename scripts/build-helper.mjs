// Build the prebuilt helper that ships in the repo: one universal binary
// (Apple silicon and Intel, ad-hoc signed) plus the sha1 of the Swift source
// it came from. The player copies it into TechnoPlayer.app, so a new user
// needs no Xcode tools. Run it after every change to TechnoPlayer.swift;
// scripts/smoke.mjs fails while the binary is older than the source.
//   node scripts/build-helper.mjs
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import crypto from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const SOURCE = path.join(ROOT, 'player/TechnoPlayer.swift')
const OUT = path.join(ROOT, 'player/bin')
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'techno-helper-'))
const run = (cmd, args) => execFileSync(cmd, args, { stdio: 'inherit' })

for (const arch of ['arm64', 'x86_64']) run('swiftc', ['-O', '-target', `${arch}-apple-macos12`, SOURCE, '-o', path.join(tmp, arch)])
fs.mkdirSync(OUT, { recursive: true })
const bin = path.join(OUT, 'TechnoPlayer')
run('lipo', ['-create', path.join(tmp, 'arm64'), path.join(tmp, 'x86_64'), '-output', bin])
run('codesign', ['--force', '--sign', '-', '--identifier', 'com.shch.techno-player', bin])
fs.writeFileSync(bin + '.sha1', crypto.createHash('sha1').update(fs.readFileSync(SOURCE)).digest('hex'))
fs.rmSync(tmp, { recursive: true, force: true })
console.log(`built ${path.relative(ROOT, bin)}, ${Math.round(fs.statSync(bin).size / 1024)} KB`)
