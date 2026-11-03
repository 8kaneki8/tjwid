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
const state = { surahs: [], selected: null, query: "", script: "uthmani", tajweedEnabled: false, tajweedBySurah: new Map(), tajweedLoading: new Set(), reciter: "Minshawy_Murattal_128kbps", practiceAyah: 1, practiceSurah: null, practiceWords: [], practiceRecorder: null, practiceIndex: 0, fontSize: 33, audioAyah: null, audioSurah: null, pageNumber: 1, pageAyahKeys: [], pageVerses: [], pageRequestId: 0 };
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
    !q || s.name.includes(q) || String(s.id) === q
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

function apiUrl(path, params = {}) {
  const url = new URL("https://api.quran.com/api/v4/" + path);
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, String(value)));
  return url.toString();
}
async function apiJson(path, params = {}) {
  const response = await fetch(apiUrl(path, params), { headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error("خدمة بيانات القرآن غير متاحة الآن (" + response.status + ").");
  return response.json();
}
async function ensureSurahLoaded(surah) {
  if (surah.ayahs.length === surah.verses && surah.ayahs.every(item => item.text)) return;
  const textField = state.script === "simple" ? "text_uthmani_simple" : "text_uthmani";
  const verses = [];
  const pages = Math.ceil(surah.verses / 50);
  for (let page = 1; page <= pages; page++) {
    const payload = await apiJson("verses/by_chapter/" + surah.id, {
      fields: textField + ",page_number", per_page: 50, page
    });
    if (!Array.isArray(payload.verses)) throw new Error("لم تصل آيات سورة " + surah.name + " بصيغة صحيحة.");
    verses.push(...payload.verses);
  }
  if (verses.length !== surah.verses) {
    throw new Error("لم يكتمل تحميل سورة " + surah.name + "؛ لن نعرض نصًا ناقصًا.");
  }
  const parsed = verses.map((verse, index) => {
    const number = Number(verse.verse_number || String(verse.verse_key || "").split(":")[1]);
    const text = String(verse[textField] || "").trim();
    const pageNumber = Number(verse.page_number);
    if (number !== index + 1 || !text || !Number.isInteger(pageNumber) || pageNumber < 1 || pageNumber > 604) {
      throw new Error("تعذر التحقق من ترتيب آيات سورة " + surah.name + ".");
    }
    return { number, text, pageNumber };
  });
  surah.ayahs = parsed;
}
function renderAyahs() {
  const root = $("readingContent");
  root.replaceChildren();
  const groups = [];
  for (const verse of state.pageVerses) {
    let group = groups[groups.length - 1];
    if (!group || group.surah.id !== verse.surahId) {
      group = { surah: state.surahs[verse.surahId - 1], ayahs: [] };
      groups.push(group);
    }
    group.ayahs.push(verse);
  }
  for (const group of groups) {
    if (group.ayahs[0].number === 1 && group.surah.id !== 1 && group.surah.id !== 9) {
      const basmala = document.createElement("div");
      basmala.className = "page-basmala";
      basmala.textContent = "بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ";
      root.append(basmala);
    }
    const heading = document.createElement("div");
    heading.className = "surah-heading";
    const title = document.createElement("h3");
    title.textContent = "سُورَةُ " + group.surah.name;
    const subtitle = document.createElement("p");
    subtitle.textContent = group.surah.verses + " آية";
    heading.append(title, subtitle);
    root.append(heading);
    const text = document.createElement("div");
    text.className = "ayah-text";
    for (const ayah of group.ayahs) {
      const span = document.createElement("span");
      span.className = "ayah" + (state.audioAyah === ayah.number && state.audioSurah === group.surah.id ? " audio-current" : "");
      span.dataset.ayah = String(ayah.number);
      span.dataset.surah = String(group.surah.id);
      span.setAttribute("role", "button");
      span.setAttribute("tabindex", "0");
      span.setAttribute("aria-label", "استمع إلى سورة " + group.surah.name + " الآية " + ayah.number);
      span.addEventListener("click", () => {
        state.selected = group.surah.id;
        $("surahSelect").value = String(group.surah.id);
        renderSurahs();
        playAyah(ayah.number);
      });
      span.addEventListener("keydown", event => {
        if (event.key === "Enter" || event.key === " ") { event.preventDefault(); span.click(); }
      });
      const markup = state.script === "uthmani" && state.tajweedEnabled ? state.tajweedBySurah.get(group.surah.id)?.get(ayah.number) : null;
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
  const first = state.pageVerses[0];
  const last = state.pageVerses[state.pageVerses.length - 1];
  $("currentLocation").textContent = "صفحة " + state.pageNumber;
  $("mushafEdition").textContent = first ? "سورة " + state.surahs[first.surahId - 1].name + (first.juzNumber ? " · الجزء " + first.juzNumber : "") : "مصحف المدينة";
  $("readerStatus").textContent = first && last
    ? "صفحة " + state.pageNumber + " من 604 · " + state.pageVerses.length + " آية"
    : "لا توجد آيات لهذه الصفحة";
  $("readingContent").style.setProperty("--quran-font-size", state.fontSize + "px");
  $("prevSurah").disabled = state.pageNumber <= 1;
  $("nextSurah").disabled = state.pageNumber >= 604;
  $("pageJump").value = String(state.pageNumber);
}
async function loadMushafPage(page) {
  const target = Math.max(1, Math.min(604, Number(page) || 1));
  const requestId = ++state.pageRequestId;
  $("readerStatus").textContent = "جارٍ تحميل الصفحة " + target + "…";
  $("prevSurah").disabled = true;
  $("nextSurah").disabled = true;
  try {
    const textField = state.script === "simple" ? "text_uthmani_simple" : "text_uthmani";
    const payload = await apiJson("verses/by_page/" + target, {
      fields: textField + ",page_number,juz_number,hizb_number", per_page: 50
    });
    if (requestId !== state.pageRequestId) return;
    if (!Array.isArray(payload.verses) || !payload.verses.length) throw new Error("لم تصل آيات الصفحة المطلوبة.");
    const verses = payload.verses.map(verse => {
      const parts = String(verse.verse_key || "").split(":").map(Number);
      const number = Number(verse.verse_number || parts[1]);
      const text = String(verse[textField] || "").trim();
      if (parts.length !== 2 || !Number.isInteger(parts[0]) || !Number.isInteger(number) || !text) {
        throw new Error("بيانات الصفحة غير مكتملة؛ أوقفنا العرض حفاظًا على سلامة النص.");
      }
      const chapter = state.surahs[parts[0] - 1];
      if (!chapter) throw new Error("رقم السورة الوارد من المصدر غير صالح.");
      const cached = chapter.ayahs.find(item => item.number === number);
      if (cached && cached.text !== text) throw new Error("اختلف نص الصفحة عن النص الذي تم التحقق منه للسورة؛ لم نعرض الصفحة.");
      if (!cached) chapter.ayahs.push({ number, text, pageNumber: Number(verse.page_number) || target });
      return {
        surahId: parts[0], number, text,
        pageNumber: Number(verse.page_number) || target,
        juzNumber: Number(verse.juz_number) || null,
        hizbNumber: Number(verse.hizb_number) || null
      };
    });
    state.pageNumber = target;
    state.pageVerses = verses;
    state.pageAyahKeys = verses.map(item => item.surahId + ":" + item.number);
    state.selected = verses[0].surahId;
    $("surahSelect").value = String(state.selected);
    const selectedChapter = state.surahs[state.selected - 1];
    if (state.practiceSurah !== state.selected || !selectedChapter.ayahs.some(item => item.number === state.practiceAyah)) {
      state.practiceAyah = verses.find(item => item.surahId === state.selected)?.number || 1;
      preparePracticeAyah();
    }
    renderSurahs();
    renderAyahs();
    if (state.tajweedEnabled && state.script === "uthmani") {
      const ids = [...new Set(verses.map(item => item.surahId))];
      for (const id of ids) loadTajweed(state.surahs[id - 1]);
    }
    $("bookmarkState").textContent = "♡ حفظ موضع القراءة";
  } catch (error) {
    if (requestId === state.pageRequestId) {
      $("readerStatus").textContent = error.message || "تعذر تحميل الصفحة.";
      $("prevSurah").disabled = target <= 1;
      $("nextSurah").disabled = target >= 604;
    }
  }
}
async function selectSurah(id) {
  const surah = state.surahs.find(item => item.id === Number(id));
  if (!surah) return;
  stopPractice();
  if (state.selected !== surah.id) stopRecitation();
  state.selected = surah.id;
  $("surahSelect").value = String(surah.id);
  $("currentLocation").textContent = surah.name;
  $("readerStatus").textContent = "جارٍ فتح سورة " + surah.name + "…";
  $("readingContent").innerHTML = '<div class="loading-state"><div class="loading-symbol">۞</div><h3>سورة ' + surah.name + '</h3><p>جارٍ تحميل النص والتحقق من ترتيب الآيات…</p></div>';
  try {
    await ensureSurahLoaded(surah);
    state.practiceAyah = 1;
    preparePracticeAyah();
    const firstPage = surah.ayahs[0]?.pageNumber;
    if (!Number.isInteger(firstPage)) throw new Error("بيانات صفحة بداية السورة غير متاحة.");
    await loadMushafPage(firstPage);
  } catch (error) {
    showUnavailable(error.message || "تعذر تحميل سورة " + surah.name + ".");
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
  const previousPage = state.pageNumber;
  state.script = nextScript;
  state.surahs.forEach(surah => { surah.ayahs = []; });
  state.pageVerses = [];
  state.tajweedEnabled = false;
  $("tajweedToggle").checked = false;
  $("tajweedToggle").disabled = nextScript === "simple";
  $("tajweedLegend").hidden = true;
  $("tajweedStatus").textContent = nextScript === "simple"
    ? "الرسم المبسط لا يدعم ألوان التجويد في هذه النسخة."
    : "يمكنك تفعيل ألوان أحكام التجويد أثناء القراءة.";
  await selectSurah(previousSurah);
  if (previousPage !== state.pageNumber) await loadMushafPage(previousPage);
});
async function loadQuran() {
  state.surahs = SURAH_NAMES.map((name, index) => ({
    id: index + 1, name, verses: EXPECTED_AYAHS[index], ayahs: []
  }));
  renderSurahs();
  $("readerStatus").textContent = "جاهز لتحميل المصحف من مصدره النصي.";
  let bookmark = null;
  try { bookmark = JSON.parse(localStorage.getItem("tajweed-bookmark") || "null"); } catch {}
  const savedSurah = Number(bookmark?.surah || bookmark) || 1;
  await selectSurah(Math.min(114, Math.max(1, savedSurah)));
  if (Number.isInteger(Number(bookmark?.page)) && bookmark.page >= 1 && bookmark.page <= 604) {
    await loadMushafPage(bookmark.page);
  }
}

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
function setReaderFontSize(size) {
  state.fontSize = Math.max(24, Math.min(42, Number(size) || 33));
  $("readingContent").style.setProperty("--quran-font-size", state.fontSize + "px");
  try { localStorage.setItem("tajweed-reader-font-size", String(state.fontSize)); } catch {}
}
try { setReaderFontSize(Number(localStorage.getItem("tajweed-reader-font-size")) || 33); } catch { setReaderFontSize(33); }
$("fontDecrease").addEventListener("click", () => setReaderFontSize(state.fontSize - 2));
$("fontIncrease").addEventListener("click", () => setReaderFontSize(state.fontSize + 2));
$("fullscreenReader").addEventListener("click", async () => {
  try {
    if (!document.fullscreenElement) await $("mushafPanel").requestFullscreen();
    else await document.exitFullscreen();
  } catch { $("readerStatus").textContent = "وضع ملء الشاشة غير متاح في هذا المتصفح."; }
});
$("playSurahAudio").addEventListener("click", () => playAyah(1));
document.addEventListener("keydown", event => {
  if (event.altKey || event.ctrlKey || event.metaKey) return;
  if (["INPUT", "SELECT", "TEXTAREA", "BUTTON"].includes(document.activeElement?.tagName)) return;
  if (event.key === "PageDown" && state.pageNumber < 604) { event.preventDefault(); loadMushafPage(state.pageNumber + 1); }
  if (event.key === "PageUp" && state.pageNumber > 1) { event.preventDefault(); loadMushafPage(state.pageNumber - 1); }
});
const navSections = ["home", "reader", "recitation", "practice"].map(id => $(id)).filter(Boolean);
if ("IntersectionObserver" in window) {
  const navObserver = new IntersectionObserver(entries => {
    const visible = entries.filter(entry => entry.isIntersecting).sort((a,b) => b.intersectionRatio-a.intersectionRatio)[0];
    if (!visible) return;
    document.querySelectorAll(".top-nav a").forEach(link => link.classList.toggle("active", link.getAttribute("href") === "#" + visible.target.id));
  }, { rootMargin: "-20% 0px -65% 0px", threshold: [0, .2, .5] });
  navSections.forEach(section => navObserver.observe(section));
}
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
    localStorage.setItem("tajweed-bookmark", JSON.stringify({ surah: state.selected, page: state.pageNumber }));
    $("bookmarkState").textContent = "♥ تم حفظ موضع القراءة";
  } catch { $("bookmarkState").textContent = "تعذر حفظ الموضع"; }
});
$("prevSurah").textContent = "الصفحة السابقة";
$("nextSurah").textContent = "الصفحة التالية";
$("prevSurah").addEventListener("click", () => state.pageNumber > 1 && loadMushafPage(state.pageNumber - 1));
$("nextSurah").addEventListener("click", () => state.pageNumber < 604 && loadMushafPage(state.pageNumber + 1));
$("goToPage").addEventListener("click", () => loadMushafPage($("pageJump").value));
$("pageJump").addEventListener("keydown", event => { if (event.key === "Enter") loadMushafPage($("pageJump").value); });

function normalizeArabicWord(word) {
  return String(word || "").normalize("NFKC").replace(/[\u064B-\u065F\u0670\u0640]/g, "").replace(/[أإآٱ]/g, "ا").replace(/ى/g, "ي").replace(/ؤ/g, "و").replace(/ئ/g, "ي").replace(/[^\u0621-\u064A]/g, "");
}
function currentPracticeAyah() {
  const surah = state.surahs.find(item => item.id === state.selected);
  return surah?.ayahs.find(item => item.number === state.practiceAyah) || surah?.ayahs[0] || null;
}
function practiceWordsFromAyah(ayah) {
  return ayah ? ayah.text.trim().split(/\s+/).filter(Boolean) : [];
}
function renderPracticeWords() {
  const target = $("practiceTarget");
  const words = state.practiceWords;
  if (!words.length) { target.textContent = "اختر سورة أولًا لبدء التسميع."; return; }
  target.replaceChildren();
  const hide = $("hidePracticeAyah").checked;
  words.forEach((word, index) => {
    const item = document.createElement("span");
    item.className = "practice-word";
    const status = word.status || "pending";
    if (status === "pending" && hide) {
      item.classList.add("word-hidden");
      item.textContent = "•••";
    } else {
      item.textContent = word.text;
      item.classList.add("word-" + status);
    }
    item.setAttribute("aria-label", status === "correct" ? "كلمة تم التعرف عليها" : status === "wrong" ? "اختلاف محتمل في الكلمة" : "كلمة لم يتم تسميعها بعد");
    target.append(item);
  });
}
function preparePracticeAyah() {
  const ayah = currentPracticeAyah();
  state.practiceAyah = ayah?.number || 1;
  state.practiceSurah = state.selected;
  state.practiceWords = practiceWordsFromAyah(ayah).map(text => ({text, status:"pending"}));
  state.practiceIndex = 0;
  renderPracticeWords();
  $("practiceStatus").textContent = ayah ? "جاهز لتسميع الآية " + ayah.number + " من سورة " + state.surahs[state.selected - 1].name + "." : "اختر سورة أولًا.";
}
function playPracticeErrorTone() {
  if (!$("practiceBeep").checked) return;
  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;
    const context = new AudioContextClass();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = "sine"; oscillator.frequency.value = 220;
    gain.gain.setValueAtTime(0.0001, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.12, context.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.18);
    oscillator.connect(gain); gain.connect(context.destination);
    oscillator.start(); oscillator.stop(context.currentTime + 0.2);
    oscillator.onended = () => context.close();
  } catch {}
}
function applyPracticeTranscript(transcript, alternatives = []) {
  const candidates = [transcript, ...alternatives]
    .map(value => String(value || "").trim().split(/\s+/).filter(Boolean))
    .filter(words => words.length);
  if (!candidates.length) return;
  // Alternatives are competing hypotheses for the same audio, not extra words.
  // Choose the hypothesis that best follows the next expected Quran words.
  const scoreCandidate = words => {
    let cursor = state.practiceIndex, score = 0;
    for (const token of words) {
      const heard = normalizeArabicWord(token);
      if (!heard) continue;
      let found = -1;
      for (let offset = 0; offset <= Math.min(3, state.practiceWords.length - cursor - 1); offset++) {
        if (normalizeArabicWord(state.practiceWords[cursor + offset].text) === heard) { found = cursor + offset; break; }
      }
      if (found >= 0) { score += 5 - (found - cursor); cursor = found + 1; }
      else score -= 1;
    }
    return score;
  };
  const spoken = candidates.reduce((best, candidate) => scoreCandidate(candidate) > scoreCandidate(best) ? candidate : best);
  let changed = false;
  for (const token of spoken) {
    if (state.practiceIndex >= state.practiceWords.length) break;
    const heard = normalizeArabicWord(token);
    if (!heard) continue;
    const lookAhead = Math.min(3, state.practiceWords.length - state.practiceIndex - 1);
    let matchedAt = -1;
    for (let offset = 0; offset <= lookAhead; offset++) {
      if (normalizeArabicWord(state.practiceWords[state.practiceIndex + offset].text) === heard) {
        matchedAt = state.practiceIndex + offset; break;
      }
    }
    if (matchedAt >= 0) {
      while (state.practiceIndex < matchedAt) {
        state.practiceWords[state.practiceIndex++].status = "review";
        changed = true;
      }
      const expected = state.practiceWords[state.practiceIndex++];
      expected.status = "correct";
      expected.heard = token;
      changed = true;
    } else {
      const expected = state.practiceWords[state.practiceIndex++];
      expected.status = "wrong";
      expected.heard = token;
      playPracticeErrorTone();
      changed = true;
    }
  }
  if (changed) {
    renderPracticeWords();
    const correct = state.practiceWords.filter(word => word.status === "correct").length;
    const wrong = state.practiceWords.filter(word => word.status === "wrong").length;
    const review = state.practiceWords.filter(word => word.status === "review").length;
    $("practiceStatus").textContent = "تمت مراجعة " + state.practiceIndex + " من " + state.practiceWords.length + " كلمة · مطابقة: " + correct + " · اختلاف محتمل: " + wrong + " · كلمات تحتاج مراجعة: " + review;
    if (state.practiceIndex >= state.practiceWords.length) stopPractice("انتهى التسميع. راجع الكلمات المعلّمة؛ فقد يؤثر إسقاط كلمة أو دمجها في دقة المطابقة.");
  }
}
const PRACTICE_SEGMENT_MS = 6500;

const ASR_API_URL = "";

async function transcribePracticeSegment(session, blob) {
  const apiUrl = ASR_API_URL;
  if (!apiUrl) throw new Error("محرك التسميع غير متصل حاليًا.");
  const form = new FormData();
  form.append("audio", blob, "recitation-audio");
  const response = await fetch(apiUrl + "/v1/transcribe", { method: "POST", body: form });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.detail || "تعذر على محرك التسميع معالجة التسجيل.");
  const transcript = String(payload.text || "").trim();
  if (!transcript) {
    $("practiceLiveTranscript").textContent = "لم يلتقط المحرك كلمات واضحة في هذا الجزء. واصل القراءة أو أعد الآية.";
    return;
  }
  $("practiceLiveTranscript").textContent = "تم التعرف: " + transcript;
  applyPracticeTranscript(transcript);
}

function finishPracticeSession(session, message) {
  if (state.practiceRecorder !== session) return;
  session.stream.getTracks().forEach(track => track.stop());
  state.practiceRecorder = null;
  $("startPractice").disabled = false;
  $("stopPractice").disabled = true;
  $("resetPractice").disabled = false;
  $("nextPracticeAyah").disabled = false;
  if (message) $("practiceStatus").textContent = message;
}

function startPracticeSegment(session) {
  if (session.stopped || state.practiceRecorder !== session) return;
  try {
    const mimeType = ["audio/webm;codecs=opus", "audio/mp4"].find(type =>
      window.MediaRecorder && MediaRecorder.isTypeSupported(type)
    );
    const recorder = mimeType
      ? new MediaRecorder(session.stream, { mimeType })
      : new MediaRecorder(session.stream);
    session.recorder = recorder;
    session.chunks = [];
    recorder.ondataavailable = event => {
      if (event.data && event.data.size) session.chunks.push(event.data);
    };
    recorder.onerror = () => stopPractice("حدث خطأ أثناء تسجيل الصوت. تحقق من الميكروفون ثم أعد المحاولة.");
    recorder.onstop = () => {
      const blob = new Blob(session.chunks, { type: recorder.mimeType || "audio/webm" });
      if (blob.size > 700) {
        session.uploadQueue = session.uploadQueue
          .then(() => transcribePracticeSegment(session, blob))
          .catch(error => {
            $("practiceLiveTranscript").textContent = error.message || "تعذر إرسال التسجيل إلى محرك التسميع.";
            $("practiceStatus").textContent = "تعذر التعرف على هذا الجزء. تحقق من رابط المحرك واتصال الإنترنت.";
          });
      }
      if (!session.stopped) {
        startPracticeSegment(session);
      } else {
        session.uploadQueue.finally(() => finishPracticeSession(
          session,
          session.stopMessage || "تم إيقاف التسميع."
        ));
      }
    };
    recorder.start();
    session.timer = setTimeout(() => {
      if (recorder.state === "recording") recorder.stop();
    }, PRACTICE_SEGMENT_MS);
  } catch {
    stopPractice("تعذر بدء تسجيل الصوت في هذا المتصفح.");
  }
}

function stopPractice(message) {
  const session = state.practiceRecorder;
  if (!session) {
    $("startPractice").disabled = false;
    $("stopPractice").disabled = true;
    if (message) $("practiceStatus").textContent = message;
    return;
  }
  session.stopped = true;
  session.stopMessage = message || "تم إيقاف التسميع.";
  clearTimeout(session.timer);
  $("stopPractice").disabled = true;
  $("practiceStatus").textContent = "جارٍ إرسال آخر جزء من التسجيل ومراجعته…";
  if (session.recorder && session.recorder.state === "recording") {
    session.recorder.stop();
  } else {
    session.uploadQueue.finally(() => finishPracticeSession(session, session.stopMessage));
  }
}

async function startPractice() {
  if (!state.selected) { $("practiceStatus").textContent = "اختر سورة أولًا."; return; }
  if (!ASR_API_URL) {
    $("practiceStatus").textContent = "محرك التسميع الصوتي لم يُربط بعد. يمكنك استخدام إخفاء الآية والتدرّب عليها، ولن نعرض نتيجة صوتية وهمية.";
    return;
  }
  if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
    $("practiceStatus").textContent = "المتصفح لا يدعم تسجيل الصوت المطلوب. جرّب Chrome أو Edge حديثًا عبر HTTPS.";
    return;
  }
  if (state.practiceRecorder) return;
  if (!state.practiceWords.length || state.practiceWords.every(word => word.status !== "pending")) preparePracticeAyah();
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: { channelCount: 1, echoCancellation: false, noiseSuppression: false, autoGainControl: false }
    });
    const session = { stream, recorder: null, chunks: [], timer: null, stopped: false, stopMessage: "", uploadQueue: Promise.resolve() };
    state.practiceRecorder = session;
    $("startPractice").disabled = true;
    $("stopPractice").disabled = false;
    $("resetPractice").disabled = true;
    $("nextPracticeAyah").disabled = true;
    $("resetPractice").disabled = true;
    $("nextPracticeAyah").disabled = true;
    $("practiceStatus").textContent = "الميكروفون يعمل. اقرأ الآية؛ ستصل المقاطع تباعًا إلى محرك القرآن.";
    $("practiceLiveTranscript").textContent = "بانتظار أول نتيجة من المحرك القرآني…";
    startPracticeSegment(session);
  } catch (error) {
    $("practiceStatus").textContent = error?.name === "NotAllowedError"
      ? "لم تسمح باستخدام الميكروفون. اسمح للموقع بالوصول إليه من إعدادات المتصفح."
      : "تعذر فتح الميكروفون. تحقق من توصيله وصلاحيات المتصفح.";
  }
}

$("startPractice").addEventListener("click", startPractice);
$("stopPractice").addEventListener("click", () => stopPractice("تم إيقاف التسميع."));
$("hidePracticeAyah").addEventListener("change", renderPracticeWords);
$("resetPractice").addEventListener("click", () => {
  stopPractice();
  preparePracticeAyah();
  $("practiceLiveTranscript").textContent = "تمت إعادة الآية من البداية.";
});
$("nextPracticeAyah").addEventListener("click", () => {
  const surah = state.surahs.find(item => item.id === state.selected);
  if (!surah) return;
  stopPractice();
  state.practiceAyah = Math.min((state.practiceAyah || 1) + 1, surah.verses);
  preparePracticeAyah();
});
function audioFileUrl(surahId, ayahNumber) {
  const pad = value => String(value).padStart(3, "0");
  return "https://everyayah.com/data/" + state.reciter + "/" + pad(surahId) + pad(ayahNumber) + ".mp3";
}
function updateAudioStatus(message) { $("audioAyahStatus").textContent = message; }
function stopRecitation() {
  const audio = $("recitationAudio"); audio.pause(); audio.removeAttribute("src"); audio.load();
  state.audioAyah = null; state.audioSurah = null;
  $("playSelectedAyah").textContent = "تشغيل الآية";
  document.querySelectorAll(".ayah.audio-current").forEach(node => node.classList.remove("audio-current"));
}
async function playAyah(number) {
  const surah = state.surahs.find(item => item.id === state.selected);
  if (!surah) return;
  try { await ensureSurahLoaded(surah); } catch (error) { updateAudioStatus(error.message || "تعذر تحميل الآية."); return; }
  if (!surah.ayahs.some(item => item.number === Number(number))) return;
  const audio = $("recitationAudio");
  state.audioAyah = Number(number); state.audioSurah = surah.id;
  if (state.practiceSurah !== surah.id || state.practiceAyah !== Number(number)) { stopPractice(); state.practiceAyah = Number(number); preparePracticeAyah(); }
  renderAyahs(surah);
  const active = document.querySelector('.ayah[data-ayah="' + number + '"]');
  if (active) active.scrollIntoView({ behavior: "smooth", block: "nearest" });
  $("playSelectedAyah").textContent = "إعادة تشغيل الآية";
  updateAudioStatus("الآن: سورة " + surah.name + " · الآية " + number);
  audio.pause(); audio.src = audioFileUrl(surah.id, Number(number)); audio.load();
  try { await audio.play(); } catch { updateAudioStatus("تعذر بدء الصوت تلقائيًا. اضغط زر التشغيل داخل مشغل الصوت."); }
}
function moveAudioAyah(direction) {
  const surah = state.surahs.find(item => item.id === state.selected); if (!surah) return;
  const current = state.audioSurah === surah.id && state.audioAyah ? state.audioAyah : 1;
  const next = current + direction; if (next < 1 || next > surah.verses) return;
  playAyah(next);
}
const recitationToggle = $("toggleRecitationPanel");
const recitationBody = $("recitationBody");
recitationToggle.addEventListener("click", () => {
  const willOpen = recitationBody.hidden;
  recitationBody.hidden = !willOpen;
  recitationToggle.setAttribute("aria-expanded", String(willOpen));
  recitationToggle.textContent = willOpen ? "إخفاء المشغل −" : "فتح المشغل +";
});
$("reciterSelect").addEventListener("change", event => {
  state.reciter = event.target.value;
  if (state.audioAyah && state.audioSurah === state.selected) playAyah(state.audioAyah);
  else updateAudioStatus("تم اختيار القارئ. اختر آية لبدء الاستماع.");
});
$("playSelectedAyah").addEventListener("click", () => playAyah(state.audioAyah || 1));
$("prevAyahAudio").addEventListener("click", () => moveAudioAyah(-1));
$("nextAyahAudio").addEventListener("click", () => moveAudioAyah(1));
$("recitationAudio").addEventListener("ended", () => {
  const surah = state.surahs.find(item => item.id === state.audioSurah);
  if (surah && state.audioAyah < surah.verses) playAyah(state.audioAyah + 1);
  else updateAudioStatus("انتهت تلاوة سورة " + (surah ? surah.name : "") + ".");
});
$("recitationAudio").addEventListener("play", () => { $("playSelectedAyah").textContent = "إعادة تشغيل الآية"; });
$("recitationAudio").addEventListener("pause", () => {
  if (!$("recitationAudio").ended && state.audioAyah) $("playSelectedAyah").textContent = "متابعة الآية";
});
loadQuran();
if ("serviceWorker" in navigator) window.addEventListener("load", () => navigator.serviceWorker.register("./service-worker.js").catch(() => {}));
