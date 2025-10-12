/* Prompt ordering modes */

export const ORDER_ILLUSTRIOUS = [
  "Artist/Style",
  "Subject",
  "Pose/Action/Expression",
  "Scene/Background",
  "Effects",
  "Quality"
];

export const ORDER_DANBOORU = [
  // Reasonable classic grouping
  "Subject",
  "Body",
  "Face/Eyes/Hair",
  "Attire/Accessories",
  "Held/Props",
  "Pose/Action/Expression",
  "Scene/Background",
  "Composition/Lighting",
  "Style/Meta",
  "Quality"
];

export function orderTagsByMode(facetMap, mode){
  // facetMap: { facetName: string[] }
  const order = mode==="illustrious" ? ORDER_ILLUSTRIOUS : ORDER_DANBOORU;
  const pick = (k)=>facetMap[k]||[];
  const illu = {
    "Artist/Style": pick("Artist/Style"),
    "Subject": [...pick("Characters"), ...pick("Subject & Creatures"), ...pick("Subject"), ...pick("Counts")],
    "Pose/Action/Expression": [...pick("Actions & Poses"), ...pick("Expression"), ...pick("Face"), ...pick("Eyes")],
    "Scene/Background": [...pick("Setting & Environment"), ...pick("Background")],
    "Effects": [...pick("Effects"), ...pick("Composition"), ...pick("Lighting")],
    "Quality": pick("Quality"),
  };
  const classic = {
    "Subject": [...pick("Characters"), ...pick("Subject & Creatures"), ...pick("Subject"), ...pick("Counts")],
    "Body": [...pick("Body Parts")],
    "Face/Eyes/Hair": [...pick("Face"), ...pick("Eyes"), ...pick("Hair")],
    "Attire/Accessories": [...pick("Attire"), ...pick("Accessories")],
    "Held/Props": [...pick("Held Items & Objects")],
    "Pose/Action/Expression": [...pick("Actions & Poses"), ...pick("Expression")],
    "Scene/Background": [...pick("Setting & Environment"), ...pick("Background")],
    "Composition/Lighting": [...pick("Composition"), ...pick("Lighting")],
    "Style/Meta": [...pick("Style & Meta"), ...pick("Artist/Style")],
    "Quality": pick("Quality"),
  };
  const table = mode==="illustrious" ? illu : classic;
  return order.flatMap(key => table[key] || []);
}
