// src/index.ts
import fs from "node:fs/promises";
import path from "node:path";

const UID = {
  eon: "api::eon.eon",
  element: "api::element.element",
  era: "api::era.era",
  group: "api::group-specie.group-specie",
  species: "api::specie.specie",
  eraSpecieCond: "api::era-specie-condition.era-specie-condition",
  round: "api::round.round",
};

async function loadJSON(jsonPath) {
  const raw = await fs.readFile(jsonPath, "utf-8");
  return JSON.parse(raw);
}

async function upsertByName(strapi, uid, data) {
  const repo = strapi.db.query(uid);
  const existing = await repo.findOne({ where: { name: data.name } });
  if (existing) return repo.update({ where: { id: existing.id }, data });
  return repo.create({ data });
}

export default {
  register() {},

  async bootstrap({ strapi }) {
    if (process.env.SEED_IMPORT !== "true") {
      strapi.log.info("[seed] SEED_IMPORT != true → import ignoré.");
      return;
    }
    const defaultPath = path.resolve(process.cwd(), "data/biotop_eons_I_II_balanced_v2_clean_with_eons.json");
    const jsonPath = process.env.SEED_JSON_PATH
      ? path.resolve(process.cwd(), process.env.SEED_JSON_PATH)
      : defaultPath;

    strapi.log.info(`[seed] Chargement JSON: ${jsonPath}`);
    let ds;
    try { ds = await loadJSON(jsonPath); }
    catch (e) { strapi.log.error(`[seed] Impossible de lire le JSON: ${e.message}`); return; }

    // -- Vérifs (sections attendues)
    const need = ["elements","eras","groupSpecies","species","eraSpecieConditions"];
    for (const k of need) if (!Array.isArray(ds[k])) { strapi.log.error(`[seed] Section manquante: ${k}`); return; }
    for (const g of ds.groupSpecies) if (!("sciName" in g)) { strapi.log.error(`[seed] groupSpecies sans sciName: ${g.name}`); return; }
    for (const s of ds.species) if (!("sciName" in s)) { strapi.log.error(`[seed] species sans sciName: ${s.name}`); return; }

    // ---------- 0) EONS (nouveau) ----------
    const mapEon = {};
    if (Array.isArray(ds.eons)) {
      for (const e of ds.eons) {
        const created = await upsertByName(strapi, UID.eon, {
          name: e.name,
          level: e.level ?? null,
          startGa: e.startGa ?? null,
          endGa: e.endGa ?? null,
        });
        if (e.id != null) mapEon[e.id] = created.id;
      }
    } else {
      strapi.log.warn("[seed] Aucune section 'eons' dans le JSON — les ères ne seront pas rattachées.");
    }

    // ---------- 1) ELEMENTS ----------
    const mapElement = {};
    for (const e of ds.elements) {
      const created = await upsertByName(strapi, UID.element, { name: e.name });
      if (e.id != null) mapElement[e.id] = created.id;
    }

    // ---------- 2) ERAS (avec lien vers EON si présent) ----------
    const mapEra = {};
    for (const era of ds.eras) {
      const eonId = era.eon != null ? mapEon[era.eon] : null;
      const dataEra = {
        name: era.name,
        level: era.level,
        evByCycle: era.evByCycle,
        evMax: era.evMax,
        speciesFoundScore: era.speciesFoundScore,
        specieMaxScore: era.specieMaxScore,
      };
      if (eonId) dataEra.eon = eonId; // relation many-to-one vers Eon
      const created = await upsertByName(strapi, UID.era, dataEra);
      if (era.id != null) mapEra[era.id] = created.id;
    }

    // ---------- 3) GROUP SPECIES ----------
    const mapGroup = {};
    for (const g of ds.groupSpecies) {
      const crea
