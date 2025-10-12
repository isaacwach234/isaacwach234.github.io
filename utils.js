/* Utility helpers */
const $ = (q)=>document.querySelector(q);
const $$ = (q)=>Array.from(document.querySelectorAll(q));

function splitTags(raw){
  if(!raw) return [];
  // Split by commas but keep parentheses content intact
  // Simplify: split by comma and trim
  return raw.split(",").map(s=>s.trim()).filter(Boolean);
}

function joinTags(tags){ return tags.join(", "); }

function normalizeTag(tag, useUnderscores){
  let t = tag.trim();
  // Remove outer quotes
  if((t.startsWith('"') && t.endsWith('"')) || (t.startsWith("'") && t.endsWith("'"))){
    t = t.slice(1,-1);
  }
  if(useUnderscores){
    t = t.replace(/\s+/g,"_").replace(/__+/g,"_");
  }else{
    t = t.replace(/_/g," ").replace(/\s{2,}/g," ");
  }
  return t;
}

// Strip SD/NAI style weight syntax: (tag), (tag:1.2), {tag}, ((tag))
function stripWeights(tag){
  // remove emphasis parens ((tag)) -> tag
  let t = tag;
  // (tag:1.2) -> tag
  t = t.replace(/^\(+\s*([^)]+?)\s*:[-\d.]+\)+$/,"$1");
  // (tag) or ((tag)) -> tag
  t = t.replace(/^\(+\s*([^)]+?)\s*\)+$/,"$1");
  // {tag} -> tag
  t = t.replace(/^\{+\s*([^}]+?)\s*\}+$/,"$1");
  // [tag] -> tag (rare)
  t = t.replace(/^\[+\s*([^\]]+?)\s*\]+$/,"$1");
  return t;
}

function uniquePreserveOrder(arr){
  const seen = new Set();
  const out = [];
  for(const a of arr){
    const k = a.toLowerCase();
    if(!seen.has(k)){ seen.add(k); out.push(a); }
  }
  return out;
}

function copyToClipboard(text){
  if(navigator.clipboard && window.isSecureContext){
    return navigator.clipboard.writeText(text);
  }
  // Fallback
  const ta = document.createElement("textarea");
  ta.value = text;
  ta.style.position = "fixed";
  ta.style.left = "-9999px";
  document.body.appendChild(ta);
  ta.focus();
  ta.select();
  try{ document.execCommand("copy"); } finally{ document.body.removeChild(ta); }
}

function debug(obj){
  $("#debugOut").textContent = typeof obj==="string" ? obj : JSON.stringify(obj, null, 2);
}
