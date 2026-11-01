import { readFile } from "node:fs/promises";

const path = new URL("../data/quran.json", import.meta.url);
const data = JSON.parse(await readFile(path, "utf8"));
const errors = [];
if (data.riwayah !== "Hafs an Asim") errors.push("Unexpected riwayah metadata.");
if (!Array.isArray(data.surahs) || data.surahs.length !== 114) errors.push("Expected exactly 114 surahs.");
let totalAyahs = 0;
for (let i = 0; i < (data.surahs || []).length; i++) {
  const surah = data.surahs[i];
  if (surah.id !== i + 1) errors.push(`Surah order/id mismatch at index ${i}.`);
  if (!Array.isArray(surah.ayahs)) { errors.push(`Missing ayahs for surah ${surah.id}.`); continue; }
  if (surah.verses !== surah.ayahs.length) errors.push(`Ayah count mismatch in surah ${surah.id}.`);
  surah.ayahs.forEach((ayah, j) => {
    if (ayah.number !== j + 1) errors.push(`Ayah order mismatch in surah ${surah.id}.`);
    if (typeof ayah.text !== "string" || !ayah.text.trim()) errors.push(`Empty ayah text in surah ${surah.id}, ayah ${j + 1}.`);
  });
  totalAyahs += surah.ayahs.length;
}
if (totalAyahs !== 6236) errors.push(`Expected 6236 ayahs for the selected numbering convention; found ${totalAyahs}.`);
if (!data.source || !String(data.source).includes("Tanzil")) errors.push("Missing explicit Tanzil source metadata.");
if (errors.length) {
  console.error("Quran corpus validation FAILED:");
  for (const error of errors) console.error(" - " + error);
  process.exit(1);
}
console.log("Quran corpus structure checks passed (114 surahs, 6236 ayahs).");
console.log("Note: structural checks do not replace independent textual proofreading against the approved source.");
