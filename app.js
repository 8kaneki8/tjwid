const DATA_URL = "./data/quran.json";
const state = { surahs: [], selected: null, query: "" };
const $ = (id) => document.getElementById(id);

function showUnavailable(message = "لم تُضف بيانات المصحف الموثوقة بعد.") {
  $("readingContent").innerHTML = '<div class="loading-state"><div class="loading-symbol">۞</div><h3>القرآن الكريم</h3><p></p><small>لن نعرض نصًا قرآنيًا قبل التحقق من مصدره وسلامته.</small></div>';
  $("readingContent").querySelector("p").textContent = message;
  $("readerStatus").textContent = "بيانات المصحف غير متاحة";
}

function renderSurahs() {
  const list = $("surahList");
  const select = $("surahSelect");
  list.replaceChildren();
  select.innerHTML = '<option value="">اختر السورة</option>';
  const filtered = state.surahs.filter(s => (s.name || "").includes(state.query));
  $("surahCount").textContent = state.surahs.length ? state.surahs.length + " سورة" : "—";
  if (!filtered.length) {
    const empty = document.createElement("p"); empty.className = "muted"; empty.textContent = "لا توجد نتائج."; list.append(empty); return;
  }
  filtered.forEach(s => {
    const option = document.createElement("option"); option.value = s.id; option.textContent = s.name; select.append(option);
    const button = document.createElement("button"); button.className = "surah-item" + (state.selected === s.id ? " selected" : "");
    button.type = "button"; button.innerHTML = '<span class="surah-number"></span><span class="surah-name"></span><span class="surah-meta"></span>';
    button.querySelector(".surah-number").textContent = s.id;
    button.querySelector(".surah-name").textContent = s.name;
    button.querySelector(".surah-meta").textContent = Number.isInteger(s.verses) ? s.verses + " آية" : "";
    button.addEventListener("click", () => selectSurah(s.id)); list.append(button);
  });
}

function selectSurah(id) {
  const s = state.surahs.find(x => x.id === Number(id)); if (!s) return;
  state.selected = s.id; $("surahSelect").value = String(s.id); renderSurahs();
  $("currentLocation").textContent = s.name;
  showUnavailable("تم تحميل الفهرس، لكن ملف نص الآيات لم يُعتمد بعد.");
}

async function loadQuran() {
  try {
    const response = await fetch(DATA_URL, { cache: "no-store" });
    if (!response.ok) throw new Error("missing");
    const data = await response.json();
    if (!Array.isArray(data.surahs) || data.surahs.length !== 114) throw new Error("invalid");
    state.surahs = data.surahs;
    renderSurahs();
    $("readerStatus").textContent = "تم تحميل فهرس السور";
    showUnavailable("الفهرس جاهز. عرض الآيات سيُفعّل بعد استكمال التحقق من بيانات النص.");
  } catch {
    renderSurahs();
    showUnavailable("ملف بيانات المصحف غير موجود بعد. نجهّز إدخاله من المصدر المعتمد دون تغيير النص.");
  }
}

$("searchInput").addEventListener("input", e => { state.query = e.target.value.trim(); renderSurahs(); });
$("surahSelect").addEventListener("change", e => selectSurah(e.target.value));
$("themeToggle").addEventListener("click", () => document.body.classList.toggle("dark"));
$("bookmarkState").addEventListener("click", () => {
  if (!state.selected) { $("bookmarkState").textContent = "♡ اختر سورة أولًا"; return; }
  try { localStorage.setItem("tajweed-bookmark", String(state.selected)); $("bookmarkState").textContent = "♥ تم حفظ السورة"; }
  catch { $("bookmarkState").textContent = "تعذر حفظ الموضع"; }
});
$("prevSurah").addEventListener("click", () => state.selected > 1 && selectSurah(state.selected - 1));
$("nextSurah").addEventListener("click", () => state.selected < 114 && selectSurah(state.selected + 1));
loadQuran();