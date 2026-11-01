import { readFile } from "node:fs/promises";

const path = new URL("../data/quran-uthmani.txt", import.meta.url);
const raw = await readFile(path, "utf8");
const lines = raw.replace(/^\uFEFF/, "").split(/\r?\n/);
const errors = [];
const expected = [7,286,200,176,120,165,206,75,129,109,123,111,43,52,99,128,111,110,98,135,112,78,118,64,77,227,93,88,69,60,34,30,73,54,45,83,182,88,75,85,54,53,89,59,37,35,38,29,18,45,60,49,62,55,78,96,29,22,24,13,14,11,11,18,12,12,30,52,52,44,28,28,20,56,40,31,50,40,46,42,29,19,36,25,22,17,19,26,30,20,15,21,11,8,8,19,5,8,8,11,11,8,3,9,5,4,7,3,6,3,5,4,5,6];

const header = lines.filter(line => line.startsWith("#")).join("\n");
if (!header.includes("Tanzil Quran Text (Uthmani, Version 1.1)")) errors.push("Missing exact Tanzil Uthmani version metadata.");
if (!header.includes("Copyright (C) 2007-2026 Tanzil Project")) errors.push("Missing original Tanzil copyright notice.");
if (!header.includes("Creative Commons Attribution 3.0")) errors.push("Missing CC BY 3.0 license notice.");

const records = [];
for (const [index, line] of lines.entries()) {
  if (!line || line.startsWith("#")) continue;
  const first = line.indexOf("|");
  const second = line.indexOf("|", first + 1);
  if (first < 1 || second < 0) {
    errors.push(`Malformed record at source line ${index + 1}.`);
    continue;
  }
  const surah = Number(line.slice(0, first));
  const ayah = Number(line.slice(first + 1, second));
  const text = line.slice(second + 1);
  if (!Number.isInteger(surah) || !Number.isInteger(ayah) || !text.trim()) {
    errors.push(`Invalid record at source line ${index + 1}.`);
    continue;
  }
  records.push({ surah, ayah, text });
}
if (records.length !== 6236) errors.push(`Expected 6236 ayahs; found ${records.length}.`);
let cursor = 0;
for (let surah = 1; surah <= 114; surah++) {
  for (let ayah = 1; ayah <= expected[surah - 1]; ayah++) {
    const record = records[cursor++];
    if (!record || record.surah !== surah || record.ayah !== ayah) {
      errors.push(`Ordering/count mismatch at surah ${surah}, ayah ${ayah}.`);
      break;
    }
  }
}
if (cursor !== records.length) errors.push("Unexpected records after the final expected ayah.");

if (errors.length) {
  console.error("Uthmani Quran corpus validation FAILED:");
  for (const error of errors) console.error(" - " + error);
  process.exit(1);
}
console.log("Uthmani Quran corpus structure checks passed (114 surahs, 6236 ayahs).");
console.log("Source metadata, copyright, and license notices are present.");
console.log("Structural checks do not replace independent textual proofreading.");
