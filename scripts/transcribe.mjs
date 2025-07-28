#!/usr/bin/env node
// transcribe.mjs

import fs from 'fs';
import path from 'path';
import os from 'os';
import { execSync, spawnSync } from 'child_process';
import OpenAI from 'openai';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';

async function main() {
  // ─── CLI OPTIONS ─────────────────────────────────────────────────────────────
  const argv = yargs(hideBin(process.argv))
    .usage('Usage: $0 -f <file> [-m <MiB>] [-t <dB>] [-d <secs>]')
    .option('file', {
      alias: 'f',
      describe: 'Path to the audio file',
      type: 'string',
      demandOption: true,
    })
    .option('maxSizeMB', {
      alias: 'm',
      describe: 'Approx max chunk size in MiB (default: 20)',
      type: 'number',
      default: 20,
    })
    .option('threshold', {
      alias: 't',
      describe: 'Silence threshold in dB (default: -30)',
      type: 'number',
      default: -30,
    })
    .option('duration', {
      alias: 'd',
      describe: 'Minimum silence duration in seconds (default: 0.5)',
      type: 'number',
      default: 0.5,
    })
    .help()
    .argv;

  // ─── VERIFY INPUT & TOOLS ────────────────────────────────────────────────────
  const input = path.resolve(argv.file);
  if (!fs.existsSync(input)) {
    console.error(`❌ File not found: ${input}`); process.exit(1);
  }
  try {
    execSync('ffmpeg -version', { stdio: 'ignore' });
    execSync('ffprobe -version', { stdio: 'ignore' });
  } catch {
    console.error('❌ ffmpeg & ffprobe must be installed and on PATH'); process.exit(1);
  }

  // ─── METADATA: DURATION & SIZE ────────────────────────────────────────────────
  const totalDuration = parseFloat(
    execSync(`ffprobe -v error -show_entries format=duration \
      -of csv=p=0 "${input}"`).toString().trim()
  );
  if (isNaN(totalDuration)) {
    console.error('❌ Could not determine duration'); process.exit(1);
  }

  const stat = fs.statSync(input);
  const totalBytes = stat.size;
  const maxBytes = argv.maxSizeMB * 1024 * 1024;
  const chunkCount = Math.ceil(totalBytes / maxBytes);
  const approxSec = totalDuration / chunkCount;

  console.error(
    `File is ${(totalBytes / 1024 / 1024).toFixed(1)} MiB → ` +
    `${chunkCount} chunks (~${approxSec.toFixed(1)} s each)`
  );

  // ─── GLOBAL SILENCE DETECTION ────────────────────────────────────────────────
  console.error('Detecting silences (once)…');
  const ff = spawnSync('ffmpeg', [
    '-i', input,
    '-af', `silencedetect=n=${argv.threshold}dB:d=${argv.duration}`,
    '-f', 'null', '-'
  ], { encoding: 'utf8', stdio: ['ignore', 'ignore', 'pipe'] });

  const silenceRe = /silence_end:\s*([0-9.]+)/g;
  const silences = [0];
  let m;
  while ((m = silenceRe.exec(ff.stderr)) !== null) {
    silences.push(parseFloat(m[1]));
  }
  silences.push(totalDuration);
  silences.sort((a, b) => a - b);

  // ─── PICK BOUNDARIES (SNAPPED TO SILENCE) ───────────────────────────────────
  function nearest(arr, tgt) {
    return arr.reduce((p, c) =>
      Math.abs(c - tgt) < Math.abs(p - tgt) ? c : p
    );
  }

  const boundaries = [0];
  for (let i = 1; i < chunkCount; i++) {
    const target = i * approxSec;
    const snap = nearest(silences, target);
    // ensure we don’t duplicate or create too-small slices
    if (snap - boundaries.at(-1) > argv.duration) {
      boundaries.push(snap);
    }
  }
  boundaries.push(totalDuration);

  console.error(
    'Final boundaries (s):',
    boundaries.map(n => n.toFixed(1)).join(', ')
  );

  // ─── SET UP OPENAI CLIENT ───────────────────────────────────────────────────
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.error('❌ Please set OPENAI_API_KEY'); process.exit(1);
  }
  const openai = new OpenAI({ apiKey });

  // ─── CUT & TRANSCRIBE EACH CHUNK ─────────────────────────────────────────────
  const rawSegments = [];
  for (let i = 0; i < boundaries.length - 1; i++) {
    const start = boundaries[i];
    const end = boundaries[i + 1];
    const dur = end - start;
    if (dur < argv.duration) continue;

    const chunkPath = path.join(
      os.tmpdir(),
      `chunk_${String(i).padStart(2, '0')}.mp3`
    );
    console.error(`Chunk ${i}: ${start.toFixed(1)}→${end.toFixed(1)} (${dur.toFixed(1)}s)`);

    execSync(
      `ffmpeg -y -i "${input}" -ss ${start} -t ${dur} -c copy "${chunkPath}"`,
      { stdio: 'ignore' }
    );

    try {
      const resp = await openai.audio.transcriptions.create({
        file: fs.createReadStream(chunkPath),
        model: 'whisper-1',
        response_format: 'text'
      });
      rawSegments.push(typeof resp === 'string' ? resp : resp.text);
    } catch (e) {
      console.error(`⚠️ Transcription failed on chunk ${i}:`, e);
      process.exit(1);
    }

    fs.unlinkSync(chunkPath);
  }

  // ─── ASSEMBLE RAW TRANSCRIPT ─────────────────────────────────────────────────
  const fullTranscript = rawSegments.join('\n\n');

  // ─── LABEL SPEAKERS WITH GPT‑4o ───────────────────────────────────────────────
  console.error('Labeling speakers via GPT‑4o…');
  const sys = [
    "You are a transcription assistant.",
    "There are exactly one speaker in this recording",
    "- DHH",
    "Prefix each utterance with the correct speaker name."
  ].join('\n');

  const chat = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      { role: 'system', content: sys },
      { role: 'user', content: fullTranscript }
    ]
  });

  const labeled = chat.choices?.[0]?.message?.content;
  if (!labeled) {
    console.error('❌ GPT‑4o did not return a labeled transcript'); process.exit(1);
  }

  // ─── OUTPUT FINAL TRANSCRIPT ─────────────────────────────────────────────────
  console.log(labeled);
}

main();
