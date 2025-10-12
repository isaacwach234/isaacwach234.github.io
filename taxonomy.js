/* Category inference + adapters (Danbooru/e621) */

import { orderTagsByMode } from "./ordering.js";

export const FACETS = [
  "Artist/Style","Characters","Subject & Creatures","Subject","Counts",
  "Body Parts","Face","Eyes","Hair","Attire","Accessories",
  "Held Items & Objects","Actions & Poses","Expression",
  "Setting & Environment","Background","Composition","Lighting",
  "Style & Meta","Effects","Quality","Uncategorized"
];


// Basic facet rules: regex-driven; extensible and low-maintenance
const facetRules = [
  { facet: "Quality", rx: /^(masterpiece|best quality|ultra[-\s]?detailed|8k|4k|highres|absurdres|1girl|2girls|1boy|2boys)$/i },
  { facet: "Characters", rx: /^([a-z0-9_.:'-]+)\((series|game|anime|manga|movie)\)$/i }, // e.g., 2b_(nier:automata)
  { facet: "Hair", rx: /(hair|ahoge|bangs|ponytail|braid|fringe|bob_cut|drill_hair)$/i },
  { facet: "Eyes", rx: /(eyes?|pupils?|eyelashes|eyebags|contacts?)$/i },
  { facet: "Face", rx: /(smile|blush|frown|mouth|lips?|teeth|tongue|ahegao|anger_vein|cheeks?)$/i },
  { facet: "Body Parts", rx: /(breasts?|nipples?|areolae?|navel|armpits?|thighs?|legs?|arms?|hands?|fingers?|fingernails?|feet|toes|penis|vagina|anus|tail|wings?)$/i },
  { facet: "Attire", rx: /(dress|skirt|shirt|jacket|hoodie|kimono|buruma|panties|pantyhose|thighhighs|stockings|bodysuit|lingerie|apron|armor)$/i },
  { facet: "Accessories", rx: /(choker|necklace|ribbon|bow|bracelet|earrings?|gloves|belt|brooch|crown|hat|headwear|garter|glasses|eyewear)$/i },
  { facet: "Held Items & Objects", rx: /(sword|weapon|phone|umbrella|broom|book|cup|mug|camera|flower|ball|bag|brush|bottle)$/i },
  { facet: "Actions & Poses", rx: /(pose|posing|sitting|standing|running|jumping|peace_sign|middle_finger|kneeling|reaching|leaning|crouching|hug|kiss|handjob|breast_hold)$/i },
  { facet: "Expression", rx: /(smiling|crying|angry|aroused|blushing|confused|closed_eyes|open_mouth)$/i },
  { facet: "Setting & Environment", rx: /(indoors|outdoors|cafe|bedroom|bath|sky|beach|forest|city|school|classroom|night|day|snow|rain|sunset)$/i },
  { facet: "Composition", rx: /(close[-_ ]?up|bokeh|depth_of_field|tilt|fisheye|rule_of_thirds|monochrome|chromatic_aberration)$/i },
  { facet: "Lighting", rx: /(dramatic_lighting|rimlight|backlighting|sun_rays|godrays|bloom|lens_flare|soft_lighting|high_contrast)$/i },
  { facet: "Style & Meta", rx: /(artist_name|style|90s_anime|semi[-_ ]?realistic|sketch|watercolor|pixel_art|comic|commentary|signature)$/i },
  { facet: "Subject & Creatures", rx: /(girl|boy|woman|man|animal|cat|dog|dragon|demon|angel|oni|android|cyborg|elf|mermaid|anthro)$/i },
  { facet: "Background", rx: /^background$/i },
  { facet: "Counts", rx: /^(solo|duo|trio|quartet|\d+(girls|boys|people))$/i },
  { facet: "Effects", rx: /(particles?|sparkles?|motion_blur|trail|mist|smoke)$/i },
];

// e621 adapter: typical tag types used on e621
// Expected form for incoming maps: { tag: "general"|"artist"|"copyright"|"character"|"species"|"meta" }
const E621_LS_KEY = "tagHelper.e621Map.v1";
const E621_TYPE_TO_FACET = {
  artist: "Artist/Style",
  character: "Characters",
  copyright: "Style & Meta",
  species: "Subject & Creatures",
  general: "Uncategorized", // will be re-routed by heuristics
  meta: "Style & Meta",
};

// Local learning store (reduces manual fixes over time)
const LEARNED_KEY = "tagHelper.learnedMap.v1";
function loadLearned(){
  try{ return JSON.parse(localStorage.getItem(LEARNED_KEY)||"{}"); }catch{ return {}; }
}
function saveLearned(obj){
  localStorage.setItem(LEARNED_KEY, JSON.stringify(obj));
}

// Co-occurrence counts (lightweight)
const COOCCUR_KEY = "tagHelper.cooccurrence.v1";
function loadCooccur(){
  try{ return JSON.parse(localStorage.getItem(COOCCUR_KEY)||"{}"); }catch{ return {}; }
}
function saveCooccur(obj){
  localStorage.setItem(COOCCUR_KEY, JSON.stringify(obj));
}
function bumpCooccur(tags){
  const co = loadCooccur();
  for(const a of tags){
    const k = a.toLowerCase();
    co[k] = co[k] || { n:0, with:{} };
    co[k].n++;
    for(const b of tags){
      if(a===b) continue;
      const kb = b.toLowerCase();
      co[k].with[kb] = (co[k].with[kb]||0)+1;
    }
  }
  saveCooccur(co);
}

// Fast lexical inference
function inferByRules(tag){
  for(const rule of facetRules){
    if(rule.rx.test(tag)) return rule.facet;
  }
  return null;
}

// Co-occurrence inference: if tag frequently appears with many hair/eyes etc tags, infer that facet
function inferByCooccurrence(tag){
  const co = loadCooccur()[tag.toLowerCase()];
  if(!co) return null;
  const votes = new Map();
  // naive: count matches against our rule-set using neighbors
  const neighbors = Object.entries(co.with).sort((a,b)=>b[1]-a[1]).slice(0, 15);
  for(const [t,_] of neighbors){
    const f = inferByRules(t);
    if(f){ votes.set(f,(votes.get(f)||0)+1); }
  }
  let best = null, bestN = 0;
  for(const [f,n] of votes){
    if(n>bestN){ best=f; bestN=n; }
  }
  return best;
}

// Public API used by app.js
export const Taxonomy = {
  // Load the chosen taxonomy maps. Paths kept small; big JSON stays external.
  async loadMaps(source){
    const out = { map:{}, e621:{} };
    try{
      // Danbooru-style category map (your existing huge JSON)
      const res = await fetch("./data/tags.danbooru.json");
      if(res.ok){ out.map = await res.json(); }
    }catch{}
    try{
      // Optional e621 type map (small example file)
      const r2 = await fetch("./data/tags.e621.json");
      if(r2.ok){ out.e621 = await r2.json(); }
    }catch{}
    // merge local persisted e621
    try{
      const local = JSON.parse(localStorage.getItem(E621_LS_KEY)||"{}");
      out.e621 = Object.assign({}, out.e621||{}, local||{});
    }catch{}
    return out;
  },

  // Categorize a single tag using: learned -> explicit map -> e621 type -> rules -> co-occurrence -> Uncategorized
  categorize(tag, maps, source){
    const learned = loadLearned();

    // Auto-mode: detect e621 style prefixes like "artist:name"
    if(source==="auto"){
      const m = /^(artist|character|copyright|species|meta):(.+)$/i.exec(tag);
      if(m){
        const t = (m[1]||'').toLowerCase();
        const facet = E621_TYPE_TO_FACET[t] || null;
        if(facet && facet!=="Uncategorized") return facet;
      }
    }

    const k = tag.toLowerCase();
    if(learned[k]) return learned[k];

    if(maps.map && maps.map[tag]) return maps.map[tag];

    if(source!=="danbooru" && maps.e621 && maps.e621[tag]){
      const type = maps.e621[tag];
      const facet = E621_TYPE_TO_FACET[type] || null;
      if(facet && facet!=="Uncategorized") return facet;
    }

    const ruleFacet = inferByRules(tag);
    if(ruleFacet) return ruleFacet;

    const coFacet = inferByCooccurrence(tag);
    if(coFacet) return coFacet;

    return "Uncategorized";
  },

  // Group tags by facet name
  group(tags, maps, source){
    const groups = {};
    for(const t of tags){
      const facet = this.categorize(t, maps, source);
      groups[facet] = groups[facet] || [];
      groups[facet].push(t);
    }
    return groups;
  },

  // Allow the user to correct a tag's facet; we store locally
  learn(tag, facet){
    const learned = loadLearned();

    // Auto-mode: detect e621 style prefixes like "artist:name"
    if(source==="auto"){
      const m = /^(artist|character|copyright|species|meta):(.+)$/i.exec(tag);
      if(m){
        const t = (m[1]||'').toLowerCase();
        const facet = E621_TYPE_TO_FACET[t] || null;
        if(facet && facet!=="Uncategorized") return facet;
      }
    }

    learned[tag.toLowerCase()] = facet;
    saveLearned(learned);
  },

  // Build prompt according to an ordering mode
  buildPrompt(tagsByFacet, mode){
    const ordered = orderTagsByMode(tagsByFacet, mode);
    return ordered;
  },

  // Update co-occurrence memory
  rememberCooccurrence(tags){
    bumpCooccur(tags);
  }
};
