// Schmerztagebuch – ursprünglich von Jonas als Claude-Artifact gebaut,
// hier auf GitHub Pages + Firebase (Firestore) umgezogen.
import { firebaseConfig, DIARY_ID } from "./firebase-config.js";

const $ = s => document.querySelector(s);
const ACTS = ["Sitzen","Büro / Schreibtisch","Stehen","Gehen","Fahrrad fahren","Auto fahren","Sport","Restaurant","Hausarbeit","Heben / Tragen","Liegen","Schlafen / Aufwachen","Bücken"];
const LOCS = ["Kopf","Gesicht / Kiefer","Nacken","Schulter","Oberarm","Ellbogen","Unterarm","Hand / Handgelenk","Brust","Bauch","Oberer Rücken","Mittlerer Rücken","Unterer Rücken","Hüfte","Gesäß","Leiste","Oberschenkel","Knie","Wade / Schienbein","Fuß / Knöchel"];
const SIDES = ["links","mitte","rechts","beidseitig"];
const FACES = ["Vorderseite","Rückseite","Innenseite","Außenseite"];
const QUALS = ["stechend","dumpf","ziehend","brennend","pochend","krampfartig","ausstrahlend","kribbelnd / taub"];
const HELP = ["ja, deutlich","etwas","nein","noch unklar"];
const WDAYS = ["So","Mo","Di","Mi","Do","Fr","Sa"];
const locText = e => { const a = [e.region || (e.locations||[]).join(", "), e.side].filter(Boolean).join(" "); return [a, e.face, e.locationNote].filter(Boolean).join(", "); };

const pad = n => String(n).padStart(2,"0");
const ds = d => d.getFullYear()+"-"+pad(d.getMonth()+1)+"-"+pad(d.getDate());
const parse = s => { const [y,m,d] = s.split("-").map(Number); return new Date(y,m-1,d); };
const addDays = (s,n) => { const d = parse(s); d.setDate(d.getDate()+n); return ds(d); };
const today = () => ds(new Date());
const painColor = p => `hsl(${Math.round(110 - (p-1)*12.2)} 72% 56%)`;
const clone = o => JSON.parse(JSON.stringify(o));
const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const isDay = s => /^\d{4}-\d{2}-\d{2}$/.test(s);

const S = { date: today(), days: {}, fb: null, live: false, editId: null, form: null };

/* ---------- Speicher ---------- */
// Firestore: diaries/<DIARY_ID>/days/<JJJJ-MM-TT> = { date, entries: [...], updatedAt }
// Ohne Firebase (z. B. lokal zum Testen) bleibt alles im Browser (localStorage).
const LS_KEY = "schmerztagebuch:" + DIARY_ID;
const lsLoad = () => { try { return JSON.parse(localStorage.getItem(LS_KEY) || "{}") || {}; } catch { return {}; } };
const lsSave = () => { try { localStorage.setItem(LS_KEY, JSON.stringify(S.days)); } catch {} };

const queues = {};
function writeDay(date){
  const cur = S.days[date];
  if (!S.fb){ lsSave(); return Promise.resolve(true); }
  const { fs, db } = S.fb;
  const ref = fs.doc(db, "diaries", DIARY_ID, "days", date);
  const body = cur && (cur.entries||[]).length ? { date, entries: clone(cur.entries), updatedAt: cur.updatedAt } : null;
  queues[date] = (queues[date] || Promise.resolve()).then(() => (body ? fs.setDoc(ref, body) : fs.deleteDoc(ref)).then(() => true, e => {
    setStatus(e && e.code === "permission-denied"
      ? "Speichern nicht erlaubt – die Datenbank hat den Eintrag abgelehnt."
      : "Speichern fehlgeschlagen (" + (e && e.code || "Fehler") + "). Bitte erneut versuchen.", "warn");
    return false;
  }));
  return queues[date];
}
function saveDay(date, mutate){
  const cur = clone(S.days[date] || { date, entries: [] });
  mutate(cur);
  cur.updatedAt = new Date().toISOString();
  if ((cur.entries||[]).length) S.days[date] = cur; else delete S.days[date];
  render();
  return writeDay(date);
}
function setStatus(t, kind){ const n = $("#status"); n.textContent = t; n.dataset.kind = kind || ""; n.hidden = !t; }

async function connect(){
  if (!firebaseConfig){
    S.days = lsLoad(); render();
    setStatus("Testmodus ohne Datenbank: Einträge bleiben nur in diesem Browser.", "warn");
    return;
  }
  const V = "https://www.gstatic.com/firebasejs/10.12.2/";
  try {
    const [app, auth, fs] = await Promise.all([import(V+"firebase-app.js"), import(V+"firebase-auth.js"), import(V+"firebase-firestore.js")]);
    const fapp = app.initializeApp(firebaseConfig);
    let db;
    try { db = fs.initializeFirestore(fapp, { localCache: fs.persistentLocalCache() }); }   // Einträge auch offline möglich
    catch { db = fs.getFirestore(fapp); }
    await auth.signInAnonymously(auth.getAuth(fapp));   // Schritt 1: unsichtbare Anmeldung; Schritt 2: E-Mail + Passwort
    S.fb = { fs, db };
  } catch (e) {
    console.warn("Firebase", e);
    setStatus("Keine Verbindung zur Datenbank – bitte Seite neu laden. Einträge werden so nicht gespeichert.", "warn");
    return;
  }
  const { fs, db } = S.fb;
  const timer = setTimeout(() => { if (!S.live) setStatus("Die Datenbank antwortet gerade nicht – Einträge werden gespeichert, sobald die Verbindung steht.", "warn"); }, 10000);
  fs.onSnapshot(fs.collection(db, "diaries", DIARY_ID, "days"), { includeMetadataChanges: true }, snap => {
    const next = {};
    snap.docs.forEach(d => { next[d.id] = d.data(); });
    S.days = next;
    if (!snap.metadata.fromCache){ S.live = true; clearTimeout(timer); setStatus(""); }
    else if (!S.live && snap.size) setStatus("Offline – du siehst die zuletzt geladenen Daten. Neue Einträge werden später übertragen.");
    render();
  }, e => { clearTimeout(timer); setStatus("Verbindung zur Datenbank verloren (" + e.code + "). Seite neu öffnen.", "warn"); });
}

/* ---------- Darstellung ---------- */
function dayEntries(date){ return ((S.days[date] && S.days[date].entries) || []).slice().sort((a,b) => a.time.localeCompare(b.time)); }

function render(){
  const t = today(), d = parse(S.date);
  const diff = Math.round((parse(t) - d) / 864e5);
  $("#eyebrow").textContent = diff === 0 ? "Heute" : diff === 1 ? "Gestern" : d.toLocaleDateString("de-DE",{weekday:"long"});
  $("#dateTitle").textContent = d.toLocaleDateString("de-DE",{day:"numeric",month:"long",year:"numeric"});
  $("#datePick").value = S.date; $("#datePick").max = t;
  $("#next").disabled = S.date >= t;
  $("#toToday").hidden = S.date === t;

  // Woche (Mo–So)
  const mon = addDays(S.date, -((d.getDay()+6)%7));
  let wk = "";
  for (let i=0;i<7;i++){
    const k = addDays(mon,i), e = dayEntries(k), mx = e.length ? Math.max(...e.map(x=>x.pain)) : 0;
    wk += `<button class="wd${k===S.date?" sel":""}${k>t?" future":""}" data-d="${k}" ${k>t?"disabled":""} aria-label="${parse(k).toLocaleDateString("de-DE",{weekday:"long",day:"numeric",month:"long"})}${mx?", max. Schmerz "+mx:""}">
      <small>${WDAYS[parse(k).getDay()]}</small><b>${parse(k).getDate()}</b><i style="${mx?`background:${painColor(mx)};border:0`:""}"></i></button>`;
  }
  $("#week").innerHTML = wk;

  // Einträge
  const es = dayEntries(S.date);
  $("#sCount").textContent = es.length;
  $("#sMax").textContent = es.length ? Math.max(...es.map(x=>x.pain)) : "–";
  $("#sAvg").textContent = es.length ? (es.reduce((a,x)=>a+x.pain,0)/es.length).toFixed(1).replace(".",",") : "–";
  $("#entries").innerHTML = es.length ? es.map(e => {
    const loc = locText(e);
    const ms = [ e.mood ? "Stimmung "+e.mood+"/5" : "", e.stress ? "Stress "+e.stress+"/5" : "" ].filter(Boolean).join(" · ");
    const sub = [ e.activity, (e.qualities||[]).join(", "), e.meds ? "💊 "+e.meds : "", ms ].filter(Boolean).join(" — ");
    return `<button class="entry" data-id="${esc(e.id)}"><span class="t">${esc(e.time)}${e.timeEnd?`<small>–${esc(e.timeEnd)}</small>`:""}</span>
      <span class="pain" style="background:${painColor(e.pain)}">${e.pain}</span>
      <span class="what"><b>${esc(loc || "ohne Stelle")}</b>${sub?`<span>${esc(sub)}</span>`:""}${e.note?`<span>${esc(e.note)}</span>`:""}</span></button>`;
  }).join("") : `<div class="empty">Noch keine Einträge für diesen Tag.<br>Tippe unten auf <b>+ Eintrag</b>.</div>`;

  renderChart(es);

  if (!$("#expFrom").value){ const ks = Object.keys(S.days).sort(); $("#expFrom").value = ks[0] || addDays(t,-30); }
  if (!$("#expTo").value) $("#expTo").value = t;
}

function renderChart(es){
  const W=340,H=120,L=26,R=8,T=8,B=20, x = m => L + m/1440*(W-L-R), y = p => T + (10-p)/9*(H-T-B);
  let s = "";
  for (const p of [1,5,10]) s += `<line x1="${L}" x2="${W-R}" y1="${y(p)}" y2="${y(p)}" stroke="var(--line)" stroke-width="1"/><text x="${L-6}" y="${y(p)+4}" font-size="10" text-anchor="end">${p}</text>`;
  for (const h of [0,6,12,18,24]) s += `<text x="${x(h*60)}" y="${H-5}" font-size="10" text-anchor="${h===24?"end":h===0?"start":"middle"}">${pad(h)}:00</text>`;
  if (es.length){
    const pts = es.map(e => { const [hh,mm] = e.time.split(":").map(Number); return [x(hh*60+mm), y(e.pain), e.pain]; });
    if (pts.length > 1) s += `<polyline points="${pts.map(p=>p[0].toFixed(1)+","+p[1].toFixed(1)).join(" ")}" fill="none" stroke="var(--accent)" stroke-width="2" stroke-linejoin="round" opacity=".55"/>`;
    for (const p of pts) s += `<circle cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="6" fill="${painColor(p[2])}" stroke="var(--surface)" stroke-width="2"/>`;
  } else s += `<text x="${(W+L)/2}" y="${H/2}" font-size="12" text-anchor="middle">Kurve erscheint mit dem ersten Eintrag</text>`;
  $("#chart").innerHTML = s;
}

function scale5(sel, val, onPick){
  const el = $(sel);
  el.innerHTML = [1,2,3,4,5].map(v => `<button type="button" data-v="${v}" aria-pressed="${val===v}">${v}</button>`).join("");
  el.onclick = e => { const b = e.target.closest("button"); if (b) onPick(+b.dataset.v); };
}
function chips(sel, list, selected, multi, onChange){
  const el = $(sel);
  el.innerHTML = list.map(v => `<button type="button" class="chip" aria-pressed="${selected.includes(v)}">${esc(v)}</button>`).join("");
  el.onclick = e => {
    const b = e.target.closest("button"); if (!b) return;
    const v = b.textContent; let next;
    if (multi) next = selected.includes(v) ? selected.filter(x=>x!==v) : [...selected, v];
    else next = selected[0] === v ? [] : [v];
    selected = next;
    el.querySelectorAll("button").forEach(x => x.setAttribute("aria-pressed", next.includes(x.textContent)));
    onChange(next);
  };
}

/* ---------- Formular ---------- */
function openForm(entry, carry){
  const now = new Date();
  const f = S.form = entry ? clone(entry) : {
    id: "e" + Date.now().toString(36) + Math.random().toString(36).slice(2,6),
    time: pad(now.getHours()) + ":" + pad(now.getMinutes()),
    timeEnd: "", pain: null, mood: null, stress: null, activity: "", region: "", side: "", face: "", locationNote: "", qualities: [], duration: "", meds: "", helped: "", note: ""
  };
  f.qualities = f.qualities || [];
  if (carry){ f.time = carry.time; f.timeEnd = carry.timeEnd; f.activity = carry.activity; f.mood = carry.mood; f.stress = carry.stress; }
  S.editId = entry ? entry.id : null;
  $("#formErr").hidden = true; $("#saveMore").hidden = !!entry;
  $("#formTitle").textContent = entry ? "Eintrag bearbeiten" : carry ? "Weitere Stelle" : "Neuer Eintrag";
  $("#fTime").value = f.time;
  $("#fTimeEnd").value = f.timeEnd || "";
  const pe = $("#fPain");
  pe.innerHTML = Array.from({length:10},(_,i)=>i+1).map(v => `<button type="button" data-v="${v}" style="background:${painColor(v)}" aria-pressed="${f.pain===v}">${v}</button>`).join("");
  pe.onclick = e => { const b = e.target.closest("button"); if (!b) return; f.pain = +b.dataset.v; pe.querySelectorAll("button").forEach(x => x.setAttribute("aria-pressed", +x.dataset.v===f.pain)); };
  const pick5 = (sel, key) => scale5(sel, f[key], v => { f[key] = f[key] === v ? null : v; $(sel).querySelectorAll("button").forEach(x => x.setAttribute("aria-pressed", +x.dataset.v === f[key])); });
  pick5("#fMood","mood"); pick5("#fStress","stress");
  const isStd = ACTS.includes(f.activity);
  chips("#fAct", ACTS, isStd ? [f.activity] : [], false, s => { f.activity = s[0] || ""; if (s[0]) $("#fActOther").value = ""; });
  $("#fActOther").value = isStd ? "" : (f.activity || "");
  chips("#fLoc", LOCS, f.region ? [f.region] : [], false, s => f.region = s[0] || "");
  chips("#fSide", SIDES, f.side ? [f.side] : [], false, s => f.side = s[0] || "");
  chips("#fFace", FACES, f.face ? [f.face] : [], false, s => f.face = s[0] || "");
  $("#fLocOther").value = f.locationNote || "";
  chips("#fQual", QUALS, f.qualities, true, s => f.qualities = s);
  $("#fMed").value = f.meds || "";
  chips("#fHelp", HELP, f.helped ? [f.helped] : [], false, s => f.helped = s[0] || "");
  $("#fNote").value = f.note || "";
  const del = $("#del"); del.hidden = !entry; del.classList.remove("armed"); del.textContent = "Löschen";
  $(".actions").style.gridTemplateColumns = entry ? "1fr 1fr 2fr" : "1fr 2fr";
  $("#overlay").hidden = false; document.body.style.overflow = "hidden";
  $("#form").scrollTop = 0;
}
function closeForm(){ $("#overlay").hidden = true; document.body.style.overflow = ""; S.form = null; }

$("#fActOther").addEventListener("input", e => {
  if (!S.form) return;
  if (e.target.value.trim()){ S.form.activity = e.target.value.trim(); $("#fAct").querySelectorAll("button").forEach(x => x.setAttribute("aria-pressed","false")); }
});
function commit(){
  const f = S.form; if (!f) return null;
  f.time = $("#fTime").value || f.time;
  const other = $("#fActOther").value.trim(); if (other) f.activity = other;
  f.locationNote = $("#fLocOther").value.trim();
  f.timeEnd = $("#fTimeEnd").value; f.meds = $("#fMed").value.trim(); f.note = $("#fNote").value.trim();
  const miss = [];
  if (!f.pain) miss.push("Schmerzstärke");
  if (!f.region && !f.locationNote) miss.push("Körperstelle");
  if (!f.activity) miss.push("Aktion");
  if (!miss.length && f.timeEnd && f.timeEnd < f.time){ const n = $("#formErr"); n.hidden = false; n.textContent = "„bis“ liegt vor „von“ – bitte Uhrzeit prüfen."; n.scrollIntoView({block:"center",behavior:"smooth"}); return null; }
  if (miss.length){ const n = $("#formErr"); n.hidden = false; n.textContent = "Bitte noch angeben: " + miss.join(", ") + "."; n.scrollIntoView({block:"center",behavior:"smooth"}); return null; }
  delete f.locations;
  const id = S.editId;
  saveDay(S.date, d => { d.entries = (d.entries||[]).filter(x => x.id !== (id || f.id)); d.entries.push(f); });
  return f;
}
$("#form").addEventListener("submit", e => { e.preventDefault(); if (commit()) closeForm(); });
$("#saveMore").onclick = () => { const f = commit(); if (f){ const carry = { time: f.time, timeEnd: f.timeEnd, activity: f.activity, mood: f.mood, stress: f.stress }; openForm(null, carry); } };
$("#del").onclick = () => {
  const b = $("#del");
  if (!b.classList.contains("armed")){ b.classList.add("armed"); b.textContent = "Wirklich?"; return; }
  const id = S.editId; saveDay(S.date, d => d.entries = (d.entries||[]).filter(x => x.id !== id)); closeForm();
};
$("#cancel").onclick = closeForm; $("#close").onclick = closeForm;
$("#overlay").addEventListener("click", e => { if (e.target.id === "overlay") closeForm(); });
document.addEventListener("keydown", e => { if (e.key === "Escape" && !$("#overlay").hidden) closeForm(); });

/* ---------- Navigation ---------- */
const go = d => { if (d > today()) return; S.date = d; render(); window.scrollTo({top:0}); };
$("#prev").onclick = () => go(addDays(S.date,-1));
$("#next").onclick = () => go(addDays(S.date,1));
$("#toToday").onclick = () => go(today());
$("#datePick").addEventListener("change", e => e.target.value && go(e.target.value));
$("#week").addEventListener("click", e => { const b = e.target.closest("button"); if (b && !b.disabled) go(b.dataset.d); });
$("#entries").addEventListener("click", e => { const b = e.target.closest(".entry"); if (b) openForm(dayEntries(S.date).find(x => x.id === b.dataset.id)); });
$("#add").onclick = () => openForm(null);

// Seite nach längerer Pause wieder öffnen → auf den aktuellen Tag springen
let lastToday = today();
document.addEventListener("visibilitychange", () => { if (!document.hidden && today() !== lastToday){ if (S.date === lastToday) S.date = today(); lastToday = today(); render(); } });

/* ---------- Export ---------- */
function rangeDays(){
  const a = $("#expFrom").value || "0000-00-00", b = $("#expTo").value || "9999-99-99";
  return Object.keys(S.days).filter(k => k >= a && k <= b && (S.days[k].entries||[]).length).sort().map(k => S.days[k]);
}
function toCsv(days){
  const c = v => { v = v == null ? "" : String(v); return /[;"\n\r]/.test(v) ? '"' + v.replace(/"/g,'""') + '"' : v; };
  const head = ["Datum","Wochentag","Uhrzeit von","Uhrzeit bis","Schmerz (1-10)","Körperregion","Seite","Fläche","Genauer","Aktion","Schmerzart","Dauer","Medikament/Maßnahme","Geholfen","Stimmung (1-5)","Stress (1-5)","Notiz"];
  const rows = [head];
  for (const d of days){
    const wd = parse(d.date).toLocaleDateString("de-DE",{weekday:"short"});
    const es = (d.entries||[]).slice().sort((a,b)=>a.time.localeCompare(b.time));
    for (const e of es) rows.push([d.date, wd, e.time, e.timeEnd || "", e.pain, e.region || (e.locations||[]).join(", "), e.side, e.face || "", e.locationNote, e.activity, (e.qualities||[]).join(", "), e.duration, e.meds, e.helped, e.mood ?? "", e.stress ?? "", e.note]);
  }
  return "﻿" + rows.map(r => r.map(c).join(";")).join("\r\n");
}
function download(name, data, type){
  const url = URL.createObjectURL(new Blob([data], { type }));
  const a = Object.assign(document.createElement("a"), { href: url, download: name });
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
function doExport(kind){
  const days = rangeDays(), msg = $("#expMsg"), out = $("#expOut");
  out.hidden = true;
  if (!days.length){ msg.hidden = false; msg.textContent = "Im gewählten Zeitraum gibt es keine Einträge."; return; }
  const data = kind === "csv" ? toCsv(days) : JSON.stringify({ exportiert: new Date().toISOString(), tage: days }, null, 2);
  const name = `schmerztagebuch_${$("#expFrom").value}_bis_${$("#expTo").value}.${kind}`;
  try { download(name, data, kind === "csv" ? "text/csv;charset=utf-8" : "application/json"); msg.hidden = false; msg.textContent = `Gespeichert: ${name}`; }
  catch { msg.hidden = false; msg.textContent = "Download nicht möglich – Text unten markieren und kopieren:"; out.hidden = false; out.textContent = data; }
}
$("#expCsv").onclick = () => doExport("csv");
$("#expJson").onclick = () => doExport("json");

/* ---------- Import (JSON-Export der alten Artifact-Version oder dieser Version) ---------- */
$("#impFile").addEventListener("change", async e => {
  const file = e.target.files[0]; e.target.value = "";
  const msg = $("#impMsg"); msg.hidden = false; msg.dataset.kind = "";
  if (!file) return;
  let tage;
  try { const j = JSON.parse(await file.text()); tage = Array.isArray(j) ? j : j.tage; if (!Array.isArray(tage)) throw 0; }
  catch { msg.dataset.kind = "warn"; msg.textContent = "Die Datei ist kein Schmerztagebuch-Export (JSON)."; return; }
  let added = 0, days = 0;
  const writes = [];
  for (const d of tage){
    if (!d || !isDay(d.date) || !Array.isArray(d.entries)) continue;
    const have = new Set(dayEntries(d.date).map(x => x.id));
    const fresh = d.entries.filter(x => x && x.id && x.time && x.pain && !have.has(x.id));
    if (!fresh.length) continue;
    added += fresh.length; days++;
    writes.push(saveDay(d.date, cur => { cur.entries = (cur.entries||[]).concat(clone(fresh)); }));
  }
  msg.textContent = added ? `Übertrage ${added} Einträge an ${days} Tagen …` : "Nichts Neues gefunden – alle Einträge sind schon vorhanden.";
  if (added){
    const ok = (await Promise.all(writes)).every(Boolean);
    msg.dataset.kind = ok ? "" : "warn";
    msg.textContent = ok ? `Fertig: ${added} Einträge an ${days} Tagen übernommen.` : "Import nicht vollständig gespeichert – bitte Datei noch einmal einlesen.";
  }
});

render();
connect();
