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
const state = { surahs: [], selected: null, query: "", script: "uthmani", tajweedEnabled: false, tajweedBySurah: new Map(), tajweedLoading: new Set(), reciter: "Minshawy_Murattal_128kbps", practiceAyah: 1, practiceWords: [], practiceRecognition: null, practiceIndex: 0, audioAyah: null, audioSurah: null };
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
    span.className = "ayah" + (state.audioAyah === ayah.number && state.audioSurah === surah.id ? " audio-current" : "");
    span.dataset.ayah = String(ayah.number);
    span.setAttribute("role", "button");
    span.setAttribute("tabindex", "0");
    span.setAttribute("aria-label", "استمع إلى الآية " + ayah.number);
    span.addEventListener("click", () => playAyah(ayah.number));
    span.addEventListener("keydown", event => {
      if (event.key === "Enter" || event.key === " ") { event.preventDefault(); playAyah(ayah.number); }
    });
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
  if (state.selected !== surah.id) stopRecitation();
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
  const selected = COLOR_THEMES.has(theme) ? theme : "blue";
  document.body.dataset.colorTheme = selected;
  $("colorThemeSelect").value = selected;
  try { localStorage.setItem("tajweed-color-theme", selected); } catch {}
}
try { setColorTheme(localStorage.getItem("tajweed-color-theme") || "blue"); }
catch { setColorTheme("blue"); }
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
function applyPracticeTranscript(transcript) {
  const spoken = String(transcript || "").trim().split(/\s+/).filter(Boolean);
  if (!spoken.length) return;
  let changed = false;
  for (const token of spoken) {
    if (state.practiceIndex >= state.practiceWords.length) break;
    const expected = state.practiceWords[state.practiceIndex];
    const heard = normalizeArabicWord(token);
    const wanted = normalizeArabicWord(expected.text);
    if (!heard) continue;
    expected.status = heard === wanted ? "correct" : "wrong";
    expected.heard = token;
    if (expected.status === "wrong") playPracticeErrorTone();
    state.practiceIndex++;
    changed = true;
  }
  if (changed) {
    renderPracticeWords();
    const correct = state.practiceWords.filter(word => word.status === "correct").length;
    const wrong = state.practiceWords.filter(word => word.status === "wrong").length;
    $("practiceStatus").textContent = "تم التعرف على " + state.practiceIndex + " من " + state.practiceWords.length + " كلمة · مطابق: " + correct + " · اختلاف محتمل: " + wrong;
    if (state.practiceIndex >= state.practiceWords.length) stopPractice("انتهى تسميع الآية. راجع الكلمات المعلّمة قبل الانتقال.");
  }
}
function stopPractice(message) {
  if (state.practiceRecognition) {
    try { state.practiceRecognition.stop(); } catch {}
    state.practiceRecognition = null;
  }
  $("startPractice").disabled = false;
  $("stopPractice").disabled = true;
  if (message) $("practiceStatus").textContent = message;
}
function startPractice() {
  const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!Recognition) {
    $("practiceStatus").textContent = "متصفحك لا يدعم التعرف على الكلام. جرّب Chrome أو Edge بأحدث إصدار.";
    return;
  }
  if (!state.selected) { $("practiceStatus").textContent = "اختر سورة أولًا."; return; }
  if (!state.practiceWords.length || state.practiceWords.every(word => word.status !== "pending")) preparePracticeAyah();
  const recognition = new Recognition();
  recognition.lang = "ar-SA";
  recognition.continuous = true;
  recognition.interimResults = true;
  state.practiceRecognition = recognition;
  $("startPractice").disabled = true;
  $("stopPractice").disabled = false;
  $("practiceStatus").textContent = "استمع الآن… اقرأ الآية بوضوح وبسرعتك الطبيعية.";
  recognition.onresult = event => {
    let finalText = "";
    for (let i = event.resultIndex; i < event.results.length; i++) {
      if (event.results[i].isFinal) finalText += event.results[i][0].transcript + " ";
    }
    if (finalText) applyPracticeTranscript(finalText);
  };
  recognition.onerror = event => {
    stopPractice(event.error === "not-allowed" ? "لم يتم السماح باستخدام الميكروفون. فعّل الإذن من إعدادات المتصفح." : "تعذر التعرف على الصوت: " + event.error);
  };
  recognition.onend = () => {
    if (state.practiceRecognition === recognition) stopPractice("توقف الاستماع. يمكنك بدء التسميع مجددًا لإكمال الكلمات المتبقية.");
  };
  try { recognition.start(); } catch { stopPractice("تعذر تشغيل الميكروفون. أعد المحاولة."); }
}
$("startPractice").addEventListener("click", startPractice);
$("stopPractice").addEventListener("click", () => stopPractice("تم إيقاف التسميع."));
$("hidePracticeAyah").addEventListener("change", renderPracticeWords);
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
  if (!surah || !surah.ayahs.some(item => item.number === Number(number))) return;
  const audio = $("recitationAudio");
  state.audioAyah = Number(number); state.audioSurah = surah.id;
  if (state.practiceAyah !== Number(number)) { stopPractice(); state.practiceAyah = Number(number); preparePracticeAyah(); }
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
