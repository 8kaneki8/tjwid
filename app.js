const DATA_URL = "./data/quran-uthmani.txt";
const SURAH_NAMES = [
"الفاتحة","البقرة","آل عمران","النساء","المائدة","الأنعام","الأعراف","الأنفال","التوبة","يونس",
"هود","يوسف","الرعد","إبراهيم","الحجر","النحل","الإسراء","الكهف","مريم","طه",
"الأنبياء","الحج","المؤمنون","النور","الفرقان","الشعراء","النمل","القصص","العنكبوت","الروم",
"لقمان","السجدة","الأحزاب","سبأ","فاطر","يس","الصافات","ص","الزمر","غافر",
"فصلت","الشورى","الزخرف","الدخان","الجاثية","الأحقاف","محمد","الفتح","الحجرات","ق",
"الذاريات","الطور","النجم","القمر","الرحمن","الواقعة","الحديد","المجادلة","الحشر","الممتحنة",
"الصف","الجمعة","المنافقون","التغابن","الطلاق","التحريم","الملك","القلم","الحاقة","المعارج",
"نوح","الجن","المزمل","المدثر","القيامة","الإنسان","المرسلات","النبأ","النازعات","عبس",
"التكوير","الانفطار","المطففين","الانشقاق","البروج","الطارق","الأعلى","الغاشية","الفجر","البلد",
"الشمس","الليل","الضحى","الشرح","التين","العلق","القدر","البينة","الزلزلة","العاديات",
"القارعة","التكاثر","العصر","الهمزة","الفيل","قريش","الماعون","الكوثر","الكافرون","النصر",
"المسد","الإخلاص","الفلق","الناس"
];
const EXPECTED_AYAHS = [7,286,200,176,120,165,206,75,129,109,123,111,43,52,99,128,111,110,98,135,112,78,118,64,77,227,93,88,69,60,34,30,73,54,45,83,182,88,75,85,54,53,89,59,37,35,38,29,18,45,60,49,62,55,78,96,29,22,24,13,14,11,11,18,12,12,30,52,52,44,28,28,20,56,40,31,50,40,46,42,29,19,36,25,22,17,19,26,30,20,15,21,11,8,8,19,5,8,8,11,11,8,3,9,5,4,7,3,6,3,5,4,5,6];
const state = { surahs: [], selected: null, query: "" };
const $ = id => document.getElementById(id);

function showUnavailable(message) {
  const root = $("readingContent");
  root.replaceChildren();
  const box = document.createElement("div");
  box.className = "loading-state";
  box.innerHTML = '<div class="loading-symbol">۞</div><h3>القرآن الكريم</h3><p></p><small>لن نعرض نصًا قرآنيًا قبل التحقق من مصدره وسلامته.</small>';
  box.querySelector("p").textContent = message;
  root.append(box);
  $("readerStatus").textContent = "تعذر تحميل نص المصحف";
}

function parseCorpus(raw) {
  const records = [];
  for (const line of raw.replace(/^\uFEFF/, "").split(/\r?\n/)) {
    if (!line || line.startsWith("#")) continue;
    const first = line.indexOf("|");
    const second = line.indexOf("|", first + 1);
    if (first < 1 || second < 0) throw new Error("صيغة سطر غير صحيحة في ملف المصحف.");
    const surahId = Number(line.slice(0, first));
    const ayahNumber = Number(line.slice(first + 1, second));
    const text = line.slice(second + 1);
    if (!Number.isInteger(surahId) || !Number.isInteger(ayahNumber) || !text.trim()) {
      throw new Error("بيانات آية غير صالحة في ملف المصحف.");
    }
    records.push({ surahId, number: ayahNumber, text });
  }
  if (records.length !== 6236) throw new Error(`عدد الآيات غير مطابق: ${records.length} بدلًا من 6236.`);
  const surahs = SURAH_NAMES.map((name, index) => ({
    id: index + 1, name, verses: EXPECTED_AYAHS[index], ayahs: []
  }));
  let expectedSurah = 1, expectedAyah = 1;
  for (const record of records) {
    if (record.surahId !== expectedSurah || record.number !== expectedAyah) {
      throw new Error(`ترتيب الآيات غير صحيح عند السورة ${expectedSurah}، الآية ${expectedAyah}.`);
    }
    surahs[record.surahId - 1].ayahs.push({ number: record.number, text: record.text });
    expectedAyah++;
    if (expectedAyah > EXPECTED_AYAHS[expectedSurah - 1]) {
      expectedSurah++;
      expectedAyah = 1;
    }
  }
  if (surahs.some(s => s.ayahs.length !== s.verses)) throw new Error("عدد آيات إحدى السور لا يطابق العدد المعتمد.");
  return surahs;
}

function renderSurahs() {
  const list = $("surahList"), select = $("surahSelect");
  list.replaceChildren();
  select.innerHTML = '<option value="">اختر السورة</option>';
  const q = state.query;
  const filtered = state.surahs.filter(s =>
    !q || s.name.includes(q) || s.ayahs.some(a => a.text.includes(q))
  );
  $("surahCount").textContent = state.surahs.length ? state.surahs.length + " سورة" : "—";
  if (!filtered.length) {
    const empty = document.createElement("p"); empty.className = "muted";
    empty.textContent = "لا توجد نتائج مطابقة."; list.append(empty); return;
  }
  for (const s of state.surahs) {
    const option = document.createElement("option");
    option.value = s.id; option.textContent = s.name; select.append(option);
  }
  for (const s of filtered) {
    const button = document.createElement("button");
    button.className = "surah-item" + (state.selected === s.id ? " selected" : "");
    button.type = "button";
    button.innerHTML = '<span class="surah-number"></span><span class="surah-name"></span><span class="surah-meta"></span>';
    button.querySelector(".surah-number").textContent = s.id;
    button.querySelector(".surah-name").textContent = s.name;
    button.querySelector(".surah-meta").textContent = s.verses + " آية";
    button.addEventListener("click", () => selectSurah(s.id));
    list.append(button);
  }
}

function renderAyahs(surah) {
  const root = $("readingContent");
  root.replaceChildren();
  const heading = document.createElement("div");
  heading.className = "surah-heading";
  const title = document.createElement("h3");
  title.textContent = "سُورَةُ " + surah.name;
  const subtitle = document.createElement("p");
  subtitle.textContent = surah.verses + " آية";
  heading.append(title, subtitle);
  root.append(heading);
  const text = document.createElement("div");
  text.className = "ayah-text";
  for (const ayah of surah.ayahs) {
    const span = document.createElement("span");
    span.className = "ayah";
    span.textContent = ayah.text + " ";
    const marker = document.createElement("span");
    marker.className = "ayah-marker";
    marker.setAttribute("aria-label", "الآية " + ayah.number);
    marker.textContent = "۞" + ayah.number + " ";
    span.append(marker);
    text.append(span);
  }
  root.append(text);
}

function selectSurah(id) {
  const surah = state.surahs.find(s => s.id === Number(id));
  if (!surah) return;
  state.selected = surah.id;
  $("surahSelect").value = String(surah.id);
  $("currentLocation").textContent = surah.name;
  $("readerStatus").textContent = "تم التحقق من " + surah.verses + " آية";
  $("prevSurah").disabled = surah.id === 1;
  $("nextSurah").disabled = surah.id === 114;
  renderSurahs();
  renderAyahs(surah);
}

async function loadQuran() {
  try {
    const response = await fetch(DATA_URL, { cache: "no-store" });
    if (!response.ok) throw new Error("ملف data/quran-uthmani.txt غير موجود في المستودع.");
    const raw = await response.text();
    state.surahs = parseCorpus(raw);
    renderSurahs();
    $("readerStatus").textContent = "تم التحقق من 114 سورة و6236 آية";
    const saved = Number(localStorage.getItem("tajweed-bookmark"));
    selectSurah(Number.isInteger(saved) && saved >= 1 && saved <= 114 ? saved : 1);
  } catch (error) {
    renderSurahs();
    showUnavailable(error.message || "تعذر تحميل ملف المصحف.");
  }
}

$("searchInput").addEventListener("input", event => {
  state.query = event.target.value.trim();
  renderSurahs();
});
$("surahSelect").addEventListener("change", event => selectSurah(event.target.value));
$("themeToggle").addEventListener("click", () => document.body.classList.toggle("dark"));
$("bookmarkState").addEventListener("click", () => {
  if (!state.selected) return;
  try {
    localStorage.setItem("tajweed-bookmark", String(state.selected));
    $("bookmarkState").textContent = "♥ تم حفظ موضع القراءة";
  } catch { $("bookmarkState").textContent = "تعذر حفظ الموضع"; }
});
$("prevSurah").addEventListener("click", () => state.selected > 1 && selectSurah(state.selected - 1));
$("nextSurah").addEventListener("click", () => state.selected < 114 && selectSurah(state.selected + 1));
loadQuran();
