import { Taxonomy } from "./taxonomy.js";

// State
const state = {
  useUnderscores: false, // default OFF as requested
  stripWeights: true,
  taxonomy: "danbooru",
  promptOrder: "illustrious",
  maxTags: 0,
  sortMode: "keep",
  maps: { map:{}, e621:{} },
};

// DOM refs
const elInput = document.getElementById("inputTags");
const elFinal = document.getElementById("finalPrompt");
const elBlacklist = document.getElementById("blacklist");
const elMax = document.getElementById("maxTags");
const elSort = document.getElementById("sortMode");
const elTax = document.getElementById("taxonomySource");
const elOrder = document.getElementById("promptOrder");
const elUnd = document.getElementById("useUnderscores");
const elStrip = document.getElementById("stripWeights");
const elUnknownList = document.getElementById("unknownList");
const btnLoadUnknown = document.getElementById("btnLoadUnknown");
const btnSaveAllLearned = document.getElementById("btnSaveAllLearned");
const btnClearFixer = document.getElementById("btnClearFixer");
const teachTag = document.getElementById("teachTag");
const teachFacet = document.getElementById("teachFacet");
const btnTeachAdd = document.getElementById("btnTeachAdd");
const e621File = document.getElementById("e621File");
const btnExportE621 = document.getElementById("btnExportE621");
const btnClearE621 = document.getElementById("btnClearE621");


const LAST_UNKNOWN_KEY = "tagHelper.lastUnknown.v1";
// Stats
const sIn = document.getElementById("statInput");
const sProc = document.getElementById("statProcessed");
const sRem = document.getElementById("statRemoved");

function readControls(){
  state.taxonomy = elTax.value;
  state.promptOrder = elOrder.value === "illustrious" ? "illustrious" : "danbooruClassic";
  state.useUnderscores = !!elUnd.checked;
  state.stripWeights = !!elStrip.checked;
  state.maxTags = Math.max(0, parseInt(elMax.value||"0",10));
  state.sortMode = elSort.value;
}

function preprocess(raw){
  let tags = splitTags(raw);
  sIn.textContent = `${tags.length}`;

  // Strip weights if chosen
  if(state.stripWeights){
    tags = tags.map(stripWeights);
  }

  // Normalize underscores/spaces
  tags = tags.map(t=>normalizeTag(t, state.useUnderscores));

  // Dedup
  tags = uniquePreserveOrder(tags);

  // Blacklist
  const bl = splitTags(elBlacklist.value.toLowerCase());
  const before = tags.length;
  if(bl.length){
    tags = tags.filter(t => !bl.some(b => t.toLowerCase().includes(b)));
  }
  const removed = before - tags.length;

  // Sort
  if(state.sortMode==="az") tags = [...tags].sort((a,b)=>a.localeCompare(b));
  else if(state.sortMode==="za") tags = [...tags].sort((a,b)=>b.localeCompare(a));

  // Max
  if(state.maxTags>0) tags = tags.slice(0, state.maxTags);

  return { tags, removed };
}

async function processNow(){
  readControls();
  const { tags, removed } = preprocess(elInput.value);

  // Group by facets via taxonomy (learned->map->e621->rules->cooccur)
  const grouped = Taxonomy.group(tags, state.maps, state.taxonomy);

  // Build prompt by order
  const ordered = Taxonomy.buildPrompt(grouped, state.promptOrder==="illustrious" ? "illustrious" : "danbooruClassic");

  // Remember co-occurrence for better future inference
  Taxonomy.rememberCooccurrence(tags);

  // Join
  const finalStr = joinTags(ordered);
  elFinal.value = finalStr;

  const LAST_UNKNOWN_KEY = "tagHelper.lastUnknown.v1";
// Stats
  sProc.textContent = `${ordered.length}`;
  sRem.textContent = `${removed}`;

  // Unknowns
  const unknown = (grouped["Uncategorized"] || []).slice(0);
  localStorage.setItem(LAST_UNKNOWN_KEY, JSON.stringify(unknown));

  // Debug
  debug({ state, grouped, unknown });
}

document.getElementById("btnProcess").addEventListener("click", processNow);

btnLoadUnknown.addEventListener("click", loadUnknownIntoUI);
btnClearFixer.addEventListener("click", ()=>{ elUnknownList.innerHTML = ""; });

btnSaveAllLearned.addEventListener("click", ()=>{
  const items = Array.from(elUnknownList.querySelectorAll(".unknown-item"));
  items.forEach(it=>{
    const tag = it.querySelector(".tag").textContent;
    const facet = it.querySelector("select").value;
    Taxonomy.learn(tag, facet);
    it.style.opacity = .6;
  });
});

btnTeachAdd.addEventListener("click", ()=>{
  const tag = (teachTag.value||"").trim();
  const facet = teachFacet.value;
  if(!tag) return;
  Taxonomy.learn(tag, facet);
  // Show it in the list quickly
  elUnknownList.prepend(makeUnknownItem(tag));
  teachTag.value = "";
});

// e621 import/export/clear
e621File.addEventListener("change", async (e)=>{
  const file = e.target.files && e.target.files[0];
  if(!file) return;
  const text = await file.text();
  let map = {};
  try{
    // Try JSON first
    const data = JSON.parse(text);
    if(Array.isArray(data)){
      // assume e621 tag index format: [{name, category}, ...]
      data.forEach(row=>{
        if(!row || !row.name) return;
        const t = Taxonomy.e621CategoryToType(row.category);
        map[row.name] = t;
      });
    }else{
      // assume simple mapping { "tag":"artist", ... }
      Object.assign(map, data);
    }
  }catch{
    // Fallback: CSV with name,category
    const lines = text.split(/[\r\n]+/).filter(Boolean);
    for(const line of lines){
      const parts = line.split(",").map(s=>s.trim());
      if(parts.length>=2){
        const name = parts[0];
        const cat = parts[1];
        const t = Taxonomy.e621CategoryToType(cat);
        map[name] = t;
      }
    }
  }
  const merged = Taxonomy.mergeE621Map(map);
  debug({ imported: Object.keys(map).length, mergedCount: Object.keys(merged).length });
  // Reload maps to use new e621
  state.maps = await Taxonomy.loadMaps(state.taxonomy);
});

btnExportE621.addEventListener("click", ()=>{
  try{
    const cur = JSON.parse(localStorage.getItem("tagHelper.e621Map.v1")||"{}");
    const blob = new Blob([JSON.stringify(cur,null,2)], {type:"application/json"});
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "e621_merged_map.json";
    a.click();
    URL.revokeObjectURL(url);
  }catch(e){
    debug(String(e));
  }
});

btnClearE621.addEventListener("click", async ()=>{
  Taxonomy.clearE621Map();
  state.maps = await Taxonomy.loadMaps(state.taxonomy);
  debug("Cleared e621 map.");
});

document.getElementById("btnCopy").addEventListener("click", ()=> copyToClipboard(elFinal.value));
document.getElementById("btnClear").addEventListener("click", ()=>{
  elInput.value = "";
  elFinal.value = "";
  sIn.textContent = "0";
  sProc.textContent = "0";
  sRem.textContent = "0";
  debug("Cleared.");
});

// Learning map export/clear
document.getElementById("btnExportLearned").addEventListener("click", ()=>{
  const learned = localStorage.getItem("tagHelper.learnedMap.v1") || "{}";
  const blob = new Blob([learned], {type:"application/json"});
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "learned_tag_map.json";
  a.click();
  URL.revokeObjectURL(url);
});
document.getElementById("btnClearLearned").addEventListener("click", ()=>{
  localStorage.removeItem("tagHelper.learnedMap.v1");
  debug("Learned map cleared.");
});


function buildFacetOptions(sel){
  // Import FACETS from module via dynamic import or mirror list
  const facets = ["Artist/Style","Characters","Subject & Creatures","Subject","Counts","Body Parts",
    "Face","Eyes","Hair","Attire","Accessories","Held Items & Objects","Actions & Poses","Expression",
    "Setting & Environment","Background","Composition","Lighting","Style & Meta","Effects","Quality","Uncategorized"];
  sel.innerHTML = facets.map(f=>`<option value="${f}">${f}</option>`).join("");
}
buildFacetOptions(teachFacet);

function makeUnknownItem(tag){
  const li = document.createElement("li");
  li.className = "unknown-item";
  const badge = document.createElement("span");
  badge.className = "tag";
  badge.textContent = tag;
  const sel = document.createElement("select");
  sel.className = "input-base";
  buildFacetOptions(sel);
  sel.value = "Subject"; // sane default
  const btn = document.createElement("button");
  btn.textContent = "Learn";
  btn.addEventListener("click", ()=>{
    Taxonomy.learn(tag, sel.value);
    li.style.opacity = .6;
  });
  li.appendChild(badge);
  li.appendChild(sel);
  li.appendChild(btn);
  return li;
}

function loadUnknownIntoUI(){
  elUnknownList.innerHTML = "";
  let arr = [];
  try{ arr = JSON.parse(localStorage.getItem(LAST_UNKNOWN_KEY)||"[]"); }catch{ arr = []; }
  if(!arr.length){
    const li = document.createElement("li");
    li.className = "text-sm text-slate-400";
    li.textContent = "No unknown tags from last run.";
    elUnknownList.appendChild(li);
    return;
  }
  arr.forEach(t => elUnknownList.appendChild(makeUnknownItem(t)));
}


// Initial load
(async function init(){
  // default toggles
  elUnd.checked = false;        // underscores OFF by default
  elStrip.checked = true;       // strip weights ON by default
  elOrder.value = "illustrious";
  elTax.value = "danbooru";

  // load maps
  state.maps = await Taxonomy.loadMaps(state.taxonomy);
  debug("Ready.");
})();
