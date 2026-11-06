/** Recovered from the deployed GeneAI identity worker, 2026-11-06.
 * Ranking model, not a calibrated identity probability. See docs/identity-model.md.
 */
export type IdentityProfile = { name: string; aliases?: string[]; birthYear?: number | null; deathYear?: number | null; birthPlace?: string | null; relatives?: string[] };
export function normalize(s: string | null | undefined) {
  return (s ?? "").normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}
export function nameForms(profile2: IdentityProfile) {
  const primary = normalize(profile2.name);
  const tail = primary.split(" ").slice(1).join(" ");
  const aliases = (profile2.aliases ?? []).filter((s) => typeof s === "string").map(normalize).filter(Boolean);
  return [
    .../* @__PURE__ */ new Set([primary, ...aliases.map((s) => !s.includes(" ") && tail ? `${s} ${tail}` : s)])
  ].filter(Boolean);
}
export function similarity(a: string, b: string) {
  if (!a || !b) return 0;
  if (a === b) return 1;
  if (a.length < 2 || b.length < 2) return 0;
  const pairs = /* @__PURE__ */ new Map();
  for (let i = 1; i < a.length; i++) {
    const gram = a.slice(i - 1, i + 1);
    pairs.set(gram, (pairs.get(gram) ?? 0) + 1);
  }
  let matches = 0;
  for (let i = 1; i < b.length; i++) {
    const gram = b.slice(i - 1, i + 1);
    const count = pairs.get(gram) ?? 0;
    if (count) {
      matches++;
      pairs.set(gram, count - 1);
    }
  }
  return 2 * matches / (a.length + b.length - 2);
}
export function nameAgreement(a: IdentityProfile, b: IdentityProfile) {
  let full = 0, given = 0, family = 0, middleConflict = 0, best = -1;
  const left = nameForms(a), right = nameForms(b);
  for (const x of left)
    for (const y of right) {
      const xt = x.split(" "), yt = y.split(" ");
      if (xt.length < 2 || yt.length < 2) continue;
      const first = similarity(xt[0], yt[0]);
      const tail = similarity(xt.slice(1).join(" "), yt.slice(1).join(" "));
      const omitMiddle = Math.min(xt.length, yt.length) === 2 && xt.at(-1) === yt.at(-1);
      const last = Math.max(tail, omitMiddle ? 0.9 : 0);
      const incompatible = xt.length === yt.length && xt.length > 2 && xt[0] === yt[0] && xt.at(-1) === yt.at(-1) && xt.slice(1, -1).every((t) => !yt.slice(1, -1).includes(t));
      const quality = first * last - (incompatible ? 0.15 : 0);
      if (quality > best || quality === best && first > given) {
        best = quality;
        given = first;
        family = last;
        full = Number(x === y);
        middleConflict = Number(incompatible);
      }
    }
  return { full, given, family, middleConflict };
}
function yearDistance(left, right) {
  if (!Number.isInteger(left) || !Number.isInteger(right) || left <= 0 || right <= 0) return void 0;
  return Math.abs(left - right);
}
function yearAgreement(distance) {
  if (distance === void 0 || distance > 3) return 0;
  return [1, 0.85, 0.6, 0.4][distance];
}
export function identityFeatures(a: IdentityProfile, b: IdentityProfile) {
  const names = nameAgreement(a, b);
  const birthDifference = yearDistance(a.birthYear, b.birthYear), deathDifference = yearDistance(a.deathYear, b.deathYear);
  const placeA = normalize(a.birthPlace), placeB = normalize(b.birthPlace);
  const leftRelatives = new Set((a.relatives ?? []).map(normalize).filter(Boolean));
  const sharedRelatives = new Set((b.relatives ?? []).map(normalize).filter((r) => r && leftRelatives.has(r))).size;
  const birth = yearAgreement(birthDifference), death = yearAgreement(deathDifference);
  const birthConflict = (birthDifference ?? 0) > 5, deathConflict = (deathDifference ?? 0) > 5;
  const place = Number(Boolean(placeA && placeA === placeB));
  const impossible = [a.birthYear, b.birthYear].some(
    (born) => typeof born === "number" && born > 0 && [a.deathYear, b.deathYear].some((died) => typeof died === "number" && died > 0 && born > died)
  );
  const vector = [
    names.full,
    names.given,
    names.family,
    names.middleConflict,
    birth,
    death,
    Number(birthConflict),
    Number(deathConflict),
    place,
    Math.min(sharedRelatives, 2) / 2,
    Number(impossible)
  ];
  return { vector, ...names, birth, death, birthConflict, deathConflict, place, sharedRelatives, impossible };
}
function neuralScore(s, weights2) {
  let logit = weights2.bias;
  for (let i = 0; i < weights2.hidden.length; i++) {
    const row = weights2.hidden[i];
    let sum = weights2.hiddenBias[i];
    for (let j = 0; j < row.length; j++) sum += row[j] * s.vector[j];
    logit += weights2.output[i] * Math.tanh(sum);
  }
  const rank2 = 1 / (1 + Math.exp(-logit));
  const insufficient = s.given < 1 || s.family < 0.65 || !s.birth && !s.death && !s.sharedRelatives;
  const contradiction = s.birthConflict || s.deathConflict || s.impossible || s.middleConflict;
  return Math.min(rank2, contradiction ? 0.29 : insufficient ? 0.49 : 0.99);
}

// shared/neuralIdentityWeights.ts
const weights = { "hidden": [[1.3573498, 3.0999536, 1.4647962, 0.1092106, -1.2344928, -0.7714924, -0.4554975, -0.2573096, 0.0548872, -0.5576202, -0.2736542], [0.5226041, 2.749194, -1.777022, -0.1601967, 0.8079783, 1.0704456, -1.4554906, -1.4430605, 0.1043191, 1.3031343, 0.3459679], [-0.7110696, 0.8802381, 0.5300645, 0.3828779, 0.6498895, -0.7139445, -0.6238583, -0.4601504, -0.1782508, -0.015393, 0.0729637], [0.2921643, 3.4109208, 2.0512262, 0.2525874, -0.1927416, -0.1206105, -2.1573001, -2.3183384, -0.1447604, -0.4849591, -0.1891241], [-0.7642109, 0.9984101, -0.7760923, -0.0203869, 2.8869333, 2.9218924, -2.0371443, -1.6474659, 0.0643912, 3.7578341, -0.3196491], [-0.5254447, 0.2190181, -0.1377198, 0.3944985, -0.4166854, -0.1114988, 0.0401559, -0.4536359, -0.1764241, -91421e-7, 0.1274118], [0.3685767, -0.7846105, 0.4630468, 0.1994982, -0.777344, -0.8016959, 0.0396595, 0.4862504, 0.0209232, -0.3017333, 0.3915599], [-0.1191072, 0.5554506, 0.0781777, -0.2253625, -0.1943316, 0.0431898, -0.3883751, -0.6094452, -1.0148447, 0.5167829, -0.3398319]], "hiddenBias": [-1.916582, -2.0351844, -1.554483, -3.9799151, -0.4783476, -0.9585662, 0.5303493, -1.4001802], "output": [4.7479763, 4.6130813, 3.0680679, 6.5169142, 6.4651546, 1.3990996, -1.1387598, 2.7078342], "bias": -3.6888653 };

// shared/neuralIdentity.ts
export const MODEL_VERSION = "geneai-identidad-1.0.0";
export function compareIdentity(a: IdentityProfile, b: IdentityProfile) {
  const s = identityFeatures(a, b);
  const reasons = [], conflicts = [];
  if (s.full) reasons.push("Coincide el nombre completo o una variante registrada.");
  else if (s.given === 1 && s.family >= 0.65)
    reasons.push("Coinciden el nombre de pila y parte de la graf\xEDa del apellido.");
  if (s.birth) reasons.push(s.birth === 1 ? "Mismo a\xF1o de nacimiento." : "A\xF1os de nacimiento pr\xF3ximos.");
  if (s.death) reasons.push(s.death === 1 ? "Mismo a\xF1o de defunci\xF3n." : "A\xF1os de defunci\xF3n pr\xF3ximos.");
  if (s.place) reasons.push("Coincide el lugar de nacimiento.");
  if (s.sharedRelatives)
    reasons.push(
      `${s.sharedRelatives} ${s.sharedRelatives === 1 ? "familiar en com\xFAn" : "familiares en com\xFAn"}.`
    );
  if (s.birthConflict) conflicts.push("Los a\xF1os de nacimiento difieren en m\xE1s de cinco a\xF1os.");
  if (s.deathConflict) conflicts.push("Los a\xF1os de defunci\xF3n difieren en m\xE1s de cinco a\xF1os.");
  if (s.impossible) conflicts.push("La cronolog\xEDa sit\xFAa una defunci\xF3n antes del nacimiento.");
  if (s.middleConflict || s.family >= 0.65 && s.given < 1)
    conflicts.push("Las formas registradas del nombre difieren.");
  return { score: neuralScore(s, weights), reasons, conflicts };
}

