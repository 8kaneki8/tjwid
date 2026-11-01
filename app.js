const DATA_URLS = { uthmani: "./data/quran-uthmani.txt", simple: "./data/quran-simple.txt" };
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
const state = { surahs: [], selected: null, query: "", script: "uthmani", tajweedEnabled: false, tajweedBySurah: new Map(), tajweedLoading: new Set() };
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
  for (const s of state.surahs) {
    const option = document.createElement("option");
    option.value = s.id; option.textContent = s.name; select.append(option);
  }
  if (!filtered.length) {
    const empty = document.createElement("p"); empty.className = "muted";
    empty.textContent = "لا توجد نتائج مطابقة."; list.append(empty); return;
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

function tajweedFragment(markup, expectedText) {
  const template = document.createElement("template");
  template.innerHTML = markup;
  template.content.querySelectorAll(".end").forEach(node => node.remove());
  if (template.content.textContent !== expectedText) return null;
  const fragment = document.createDocumentFragment();
  const allowed = new Set(["ham_wasl","laam_shamsiyah","silent","madda_normal","madda_permissible","madda_necessary","madda_obligatory","madda_6","ghunnah","idgham_ghunnah","idgham_no_ghunnah","idgham_shafawi","ikhafa","ikhafa_shafawi","iqlab","qalqalah","qalaqah"]);
  const copyNode = (node, parent) => {
    if (node.nodeType === Node.TEXT_NODE) { parent.append(document.createTextNode(node.nodeValue)); return; }
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    if (node.tagName.toLowerCase() === "tajweed") {
      const rule = [...node.classList].find(name => allowed.has(name));
      if (rule) {
        const span = document.createElement("span");
        span.className = "tajweed-word " + rule;
        for (const child of node.childNodes) copyNode(child, span);
        parent.append(span);
        return;
      }
    }
    for (const child of node.childNodes) copyNode(child, parent);
  };
  for (const node of template.content.childNodes) copyNode(node, fragment);
  return fragment;
}

async function loadTajweed(surah) {
  if (state.script !== "uthmani") return;
  if (state.tajweedBySurah.has(surah.id) || state.tajweedLoading.has(surah.id)) return;
  state.tajweedLoading.add(surah.id);
  $("tajweedStatus").textContent = "جارٍ تحميل ألوان التجويد والتحقق من مطابقة النص…";
  try {
    const response = await fetch("https://api.quran.com/api/v4/quran/verses/uthmani_tajweed?chapter_number=" + surah.id);
    if (!response.ok) throw new Error("خدمة ألوان التجويد غير متاحة الآن.");
    const payload = await response.json();
    if (!Array.isArray(payload.verses) || payload.verses.length !== surah.verses) throw new Error("لم تكتمل بيانات التجويد لهذه السورة.");
    const annotated = new Map();
    for (const verse of payload.verses) {
      const parts = String(verse.verse_key || "").split(":").map(Number);
      if (parts[0] !== surah.id || !Number.isInteger(parts[1]) || !verse.text_uthmani_tajweed) continue;
      const localAyah = surah.ayahs.find(item => item.number === parts[1]);
      if (localAyah && tajweedFragment(verse.text_uthmani_tajweed, localAyah.text)) annotated.set(parts[1], verse.text_uthmani_tajweed);
    }
    state.tajweedBySurah.set(surah.id, annotated);
    $("tajweedStatus").textContent = annotated.size === surah.verses
      ? "تم تحميل ألوان التجويد ومطابقة جميع آيات السورة مع النص العثماني."
      : "تم تلوين " + annotated.size + " من " + surah.verses + " آية بعد المطابقة الحرفية؛ تُركت الآيات غير المتطابقة دون تلوين حفاظًا على النص.";
  } catch (error) {
    $("tajweedStatus").textContent = error.message || "تعذر تحميل ألوان التجويد. يمكنك متابعة القراءة بالنص العثماني المعتاد.";
  } finally {
    state.tajweedLoading.delete(surah.id);
    if (state.selected === surah.id) renderAyahs(surah);
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
    const markup = state.script === "uthmani" && state.tajweedEnabled ? state.tajweedBySurah.get(surah.id)?.get(ayah.number) : null;
    const colored = markup ? tajweedFragment(markup, ayah.text) : null;
    if (colored) span.append(colored); else span.append(document.createTextNode(ayah.text));
    span.append(document.createTextNode(" "));
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
  if (!surah.ayahs.length) {
    state.selected = surah.id;
    $("surahSelect").value = String(surah.id);
    $("currentLocation").textContent = surah.name;
    $("prevSurah").disabled = surah.id === 1;
    $("nextSurah").disabled = surah.id === 114;
    renderSurahs();
    showUnavailable("نص سورة " + surah.name + " غير متاح حاليًا؛ لم يتم إدراج نص بديل.");
    return;
  }
  state.selected = surah.id;
  $("surahSelect").value = String(surah.id);
  $("currentLocation").textContent = surah.name;
  $("readerStatus").textContent = state.script === "simple"
    ? "الرسم المبسط · " + surah.verses + " آية (فحص بنيوي)"
    : "تم التحقق من " + surah.verses + " آية";
  $("prevSurah").disabled = surah.id === 1;
  $("nextSurah").disabled = surah.id === 114;
  renderSurahs();
  renderAyahs(surah);
  if (state.tajweedEnabled && state.script === "uthmani") loadTajweed(surah);
}

async function loadQuran(preferredSurah = null) {
  try {
    const response = await fetch(DATA_URLS[state.script], { cache: "no-store" });
    if (!response.ok) throw new Error("ملف " + DATA_URLS[state.script] + " غير موجود في المستودع.");
    const raw = await response.text();
    state.surahs = parseCorpus(raw);
    renderSurahs();
    $("readerStatus").textContent = "تم التحقق من 114 سورة و6236 آية";
    let saved = preferredSurah || 1;
    if (!preferredSurah) {
      try { const stored = Number(localStorage.getItem("tajweed-bookmark")); if (Number.isInteger(stored) && stored >= 1 && stored <= 114) saved = stored; } catch {}
    }
    selectSurah(saved);
  } catch (error) {
    state.surahs = SURAH_NAMES.map((name, index) => ({
      id: index + 1, name, verses: EXPECTED_AYAHS[index], ayahs: []
    }));
    renderSurahs();
    showUnavailable(error.message || "تعذر تحميل ملف المصحف.");
  }
}

$("searchInput").addEventListener("input", event => {
  state.query = event.target.value.trim();
  renderSurahs();
});
$("surahSelect").addEventListener("change", event => selectSurah(event.target.value));
$("scriptSelect").addEventListener("change", async event => {
  const nextScript = event.target.value === "simple" ? "simple" : "uthmani";
  if (nextScript === state.script) return;
  const previousSurah = state.selected || 1;
  state.script = nextScript;
  state.tajweedEnabled = false;
  $("tajweedToggle").checked = false;
  $("tajweedToggle").disabled = nextScript === "simple";
  $("tajweedLegend").hidden = true;
  $("tajweedStatus").textContent = nextScript === "simple"
    ? "الرسم المبسط لا يدعم ألوان التجويد في هذه النسخة."
    : "يمكنك تفعيل ألوان أحكام التجويد أثناء القراءة.";
  await loadQuran(previousSurah);
});
function setTheme(dark) {
  document.body.classList.toggle("dark", dark);
  $("themeToggle").textContent = dark ? "☀" : "◐";
  $("themeToggle").setAttribute("aria-label", dark ? "تفعيل الثيم الفاتح" : "تفعيل الثيم الأسود");
  try { localStorage.setItem("tajweed-theme", dark ? "dark" : "light"); } catch {}
}
try { setTheme(localStorage.getItem("tajweed-theme") === "dark"); } catch { setTheme(false); }

const COLOR_THEMES = new Set(["green", "blue", "red", "yellow"]);
function setColorTheme(theme) {
  const selected = COLOR_THEMES.has(theme) ? theme : "green";
  document.body.dataset.colorTheme = selected;
  $("colorThemeSelect").value = selected;
  try { localStorage.setItem("tajweed-color-theme", selected); } catch {}
}
try { setColorTheme(localStorage.getItem("tajweed-color-theme") || "green"); }
catch { setColorTheme("green"); }
$("colorThemeSelect").addEventListener("change", event => setColorTheme(event.target.value));
$("themeToggle").addEventListener("click", () => setTheme(!document.body.classList.contains("dark")));
$("tajweedToggle").addEventListener("change", async event => {
  state.tajweedEnabled = event.target.checked;
  $("tajweedLegend").hidden = !state.tajweedEnabled;
  if (!state.tajweedEnabled) {
    $("tajweedStatus").textContent = "تم إيقاف ألوان التجويد؛ النص العثماني الأصلي معروض كما هو.";
    if (state.selected) renderAyahs(state.surahs[state.selected - 1]);
    return;
  }
  if (state.selected) await loadTajweed(state.surahs[state.selected - 1]);
});
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
