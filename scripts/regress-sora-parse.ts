import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { parseSoraPayload, type SoraPayloadParseResult } from '../utils/parseSoraPayload.ts';
import { isVideoReadyFromText } from '../utils/isVideoReady.ts';

type Fixture = {
  name: string;
  input: string;
  expected: SoraPayloadParseResult;
};

const dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(dirname, '..');
const fixturesDir = path.join(rootDir, 'fixtures', 'sora');

const toPrintable = (value: unknown) => {
  if (value === null) return 'null';
  if (typeof value === 'string') return JSON.stringify(value);
  return String(value);
};

const listFixtureFiles = () => {
  if (!fs.existsSync(fixturesDir)) return [];
  return fs
    .readdirSync(fixturesDir)
    .filter((f) => f.toLowerCase().endsWith('.json'))
    .sort((a, b) => a.localeCompare(b));
};

const files = listFixtureFiles();
if (files.length === 0) {
  console.error(`[regress] No fixtures found under ${fixturesDir}`);
  process.exitCode = 1;
} else {
  let failed = 0;
  for (const file of files) {
    const fullPath = path.join(fixturesDir, file);
    let fixture: Fixture;
    try {
      fixture = JSON.parse(fs.readFileSync(fullPath, 'utf8')) as Fixture;
    } catch (err) {
      failed += 1;
      console.error(`[fail] ${file}: invalid JSON (${(err as any)?.message || err})`);
      continue;
    }

    const actual = parseSoraPayload(fixture.input);
    const expected = fixture.expected;
    const keys: (keyof SoraPayloadParseResult)[] = ['logsText', 'videoSrc', 'fullHtml', 'remixId'];

    const mismatches: string[] = [];
    for (const key of keys) {
      if (actual[key] !== expected[key]) {
        mismatches.push(`${key}: expected ${toPrintable(expected[key])} got ${toPrintable(actual[key])}`);
      }
    }

    const expectedVideoReady = Boolean(expected.videoSrc);
    const actualVideoReady = isVideoReadyFromText(fixture.input);
    if (actualVideoReady !== expectedVideoReady) {
      mismatches.push(`videoReady: expected ${expectedVideoReady} got ${actualVideoReady}`);
    }

    if (mismatches.length > 0) {
      failed += 1;
      console.error(`[fail] ${fixture.name || file} (${file})`);
      for (const line of mismatches) {
        console.error(`  - ${line}`);
      }
    } else {
      console.log(`[ok] ${fixture.name || file}`);
    }
  }

  if (failed > 0) {
    console.error(`[regress] Failed: ${failed}/${files.length}`);
    process.exitCode = 1;
  } else {
    console.log(`[regress] Passed: ${files.length}/${files.length}`);
    process.exitCode = 0;
  }
}
