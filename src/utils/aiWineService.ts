import { getAI, getGenerativeModel, GoogleAIBackend, type Part } from 'firebase/ai';
import { WineColor } from '../types/wine';
import { app } from './firebase';

const GEMINI_KEY_STORAGE = 'la-cave-a-vin:gemini-api-key';
const GEMINI_MODEL = 'gemini-2.5-flash';

function getFirebaseAiJsonModel() {
  if (!app) return null;
  const ai = getAI(app, { backend: new GoogleAIBackend() });
  return getGenerativeModel(ai, {
    model: GEMINI_MODEL,
    generationConfig: {
      temperature: 0.2,
      responseMimeType: 'application/json',
    },
  });
}

export interface WineEstimationInput {
  name: string;
  color: WineColor;
  appellation?: string;
  vintage?: number;
  purchasePrice?: number;
}

export interface WineEstimationResult {
  drinkFrom: number;
  drinkTo: number;
  maxKeepYears: number;
  estimatedCurrentPrice: number;
  foodPairings: string[];
  notes: string;
  explanation: string;
  source: 'gemini' | 'local';
  warning?: string;
}

export interface LabelIdentificationResult {
  name: string;
  color: WineColor;
  appellation: string;
  vintage?: number;
  estimatedCurrentPrice?: number;
  drinkFrom?: number;
  drinkTo?: number;
  maxKeepYears?: number;
  foodPairings?: string[];
  notes?: string;
  confidenceNote: string;
}

export function getGeminiApiKey(): string {
  try {
    return localStorage.getItem(GEMINI_KEY_STORAGE)?.trim() ?? '';
  } catch {
    return '';
  }
}

export function setGeminiApiKey(key: string): void {
  try {
    const trimmed = key.trim();
    if (trimmed) {
      localStorage.setItem(GEMINI_KEY_STORAGE, trimmed);
    } else {
      localStorage.removeItem(GEMINI_KEY_STORAGE);
    }
  } catch {
    // Ignore storage errors
  }
}

export function hasGeminiApiKey(): boolean {
  return Boolean(app) || getGeminiApiKey().length > 0;
}

interface AgingRule {
  pattern: RegExp;
  fromOffset: number;
  toOffset: number;
  maxKeep: number;
  label: string;
  note: string;
}

const RED_AGING_RULES: AgingRule[] = [
  {
    pattern: /pauillac|saint-julien|saint-estephe|saint-estèphe|margaux|pessac-leognan|pessac-léognan|pomerol|saint-emilion|saint-émilion|hermitage|cote-rotie|côte-rôtie|barolo|brunello|chateauneuf|châteauneuf/i,
    fromOffset: 5,
    toOffset: 16,
    maxKeep: 20,
    label: 'Grand vin de garde',
    note: 'Carafer 1 à 2h avant service (16-18°C). Idéal sur viandes rouges, gibiers ou fromages affinés.',
  },
  {
    pattern: /gevrey|chambertin|pommard|volnay|nuits-saint-georges|vosne|chambolle|morey|meursault|corton|bourgogne|bordeaux|haut-medoc|haut-médoc|medoc|médoc|graves|gigondas|vacqueyras|cornas|bandol|madiran|cahors|rioja|ribera|chianti/i,
    fromOffset: 3,
    toOffset: 11,
    maxKeep: 14,
    label: 'Vin rouge structuré',
    note: 'Ouvrir 1h avant dégustation (16-17°C). Parfait avec viandes rôties, magret ou plats mijotés.',
  },
  {
    pattern: /beaujolais|morgon|fleurie|brouilly|moulin-a-vent|moulin-à-vent|chinon|bourgueil|saumur|pinot noir|gamay|cotes du rhone|côtes du rhône|languedoc|pic saint-loup|minervois|corbieres|corbières/i,
    fromOffset: 1,
    toOffset: 5,
    maxKeep: 6,
    label: 'Rouge fruité / souple',
    note: 'Servir légèrement rafraîchi (14-16°C) sur charcuterie, volaille ou grillades.',
  },
];

const WHITE_AGING_RULES: AgingRule[] = [
  {
    pattern: /sauternes|barsac|monbazillac|coteaux du layon|bonnezeaux|vendanges tardives|selection de grains|sélection de grains/i,
    fromOffset: 4,
    toOffset: 20,
    maxKeep: 25,
    label: 'Blanc liquoreux de garde',
    note: 'Servir frais (10-12°C) avec foie gras, fromages persillés ou desserts aux fruits.',
  },
  {
    pattern: /puligny|chassagne|meursault|montrachet|chablis|corton-charlemagne|condrieu|pessac|hermitage|savennieres|savennières|riesling|gewurztraminer|alsace grand cru|jura|vin jaune|arbois/i,
    fromOffset: 2,
    toOffset: 9,
    maxKeep: 12,
    label: 'Grand blanc de garde',
    note: 'Servir entre 10 et 12°C sur poissons nobles, crustacés, volailles à la crème ou comté.',
  },
];

export function estimateWinePriceLocally(input: WineEstimationInput): number {
  const currentYear = new Date().getFullYear();
  const searchText = `${input.name} ${input.appellation ?? ''}`;
  const isGrandCru = /grand cru|1er cru|premier cru|cru class[eé]|pauillac|pomerol|puligny|meursault|ch[aâ]teauneuf|hermitage|c[oô]te-r[oô]tie|barolo|brunello|sauternes/i.test(
    searchText,
  );
  const isPrestige = /cuv[eé]e prestige|mill[eé]sim|r[eé]serve|vieilles vignes|champagne/i.test(
    searchText,
  );

  const baseByColor: Record<WineColor, number> = {
    rouge: 24,
    blanc: 22,
    rose: 14,
    champagne: 42,
    autre: 18,
  };

  let base = input.purchasePrice && input.purchasePrice > 0 ? input.purchasePrice : baseByColor[input.color];
  if (!input.purchasePrice) {
    if (isGrandCru) base *= 2.4;
    else if (isPrestige) base *= 1.45;
  }

  const age = input.vintage && input.vintage > 1900 ? Math.max(0, currentYear - input.vintage) : 0;
  // Progressive appreciation for age-worthy wines, slight cap
  const appreciationRate =
    input.color === 'rose' ? 0 : isGrandCru ? 0.055 : input.color === 'rouge' || input.color === 'champagne' ? 0.03 : 0.02;
  const multiplier = 1 + Math.min(age, 20) * appreciationRate;

  return Math.round(base * multiplier);
}

export function suggestFoodPairingsLocally(input: WineEstimationInput): string[] {
  const searchText = `${input.name} ${input.appellation ?? ''}`.toLowerCase();

  if (input.color === 'champagne') {
    return ['Apéritif', 'Huîtres & fruits de mer', 'Sushis', 'Tarte aux fruits'];
  }
  if (input.color === 'rose') {
    return ['Salade estivale', 'Grillades', 'Cuisine méditerranéenne', 'Tapas'];
  }
  if (input.color === 'blanc') {
    if (/sauternes|barsac|monbazillac|liquoreux|vendanges tardives/.test(searchText)) {
      return ['Foie gras', 'Roquefort', 'Tarte Tatin'];
    }
    if (/puligny|meursault|chassagne|montrachet|chablis|bourgogne/.test(searchText)) {
      return ['Turbot rôti', 'Homard grillé', 'Volaille à la crème', 'Comté affiné'];
    }
    return ['Poissons grillés', 'Fruits de mer', 'Fromage de chèvre'];
  }
  if (input.color === 'rouge') {
    if (/pauillac|margaux|saint-julien|pomerol|bordeaux|m[eé]doc|hermitage|ch[aâ]teauneuf/.test(searchText)) {
      return ['Côte de bœuf', 'Magret de canard', 'Gibier', 'Fromages affinés'];
    }
    if (/beaujolais|morgon|fleurie|pinot noir|chinon|bourgueil/.test(searchText)) {
      return ['Charcuterie fine', 'Volaille rôtie', 'Veau aux champignons'];
    }
    return ['Viandes rouges', 'Plats mijotés', 'Fromages à pâte dure'];
  }
  return ['Apéritif', 'Fromages', 'Cuisine du monde'];
}

export function estimateWineWindowLocally(input: WineEstimationInput): WineEstimationResult {
  const currentYear = new Date().getFullYear();
  const baseYear = input.vintage && input.vintage > 1900 ? input.vintage : currentYear;
  const searchText = `${input.name} ${input.appellation ?? ''}`;
  const estimatedCurrentPrice = estimateWinePriceLocally(input);
  const foodPairings = suggestFoodPairingsLocally(input);

  const isPrestige =
    /grand cru|1er cru|premier cru|cru classe|cru classé|cuvee prestige|cuvée prestige|millesim|millésim|reserve|réserve|vieilles vignes|hors d'age/i.test(
      searchText,
    );
  const prestigeBonus = isPrestige ? 3 : 0;

  if (input.color === 'champagne') {
    const isVintageChamp = Boolean(input.vintage && input.vintage > 1900);
    const fromOffset = isVintageChamp ? 4 : 0;
    const toOffset = (isVintageChamp ? 10 : 4) + prestigeBonus;
    const maxKeep = toOffset + 2;
    return {
      drinkFrom: Math.max(currentYear, baseYear + fromOffset),
      drinkTo: baseYear + toOffset,
      maxKeepYears: maxKeep,
      estimatedCurrentPrice,
      foodPairings,
      notes: 'Servir bien frais (8-10°C). Idéal à l’apéritif, sur huîtres, sushis ou desserts fins.',
      explanation: isVintageChamp
        ? 'Champagne millésimé : potentiel de garde prolongé.'
        : 'Champagne / effervescent non millésimé : à boire sur sa fraîcheur.',
      source: 'local',
    };
  }

  if (input.color === 'rose') {
    const maxKeep = isPrestige ? 4 : 2;
    return {
      drinkFrom: baseYear,
      drinkTo: baseYear + maxKeep,
      maxKeepYears: maxKeep,
      estimatedCurrentPrice,
      foodPairings,
      notes: 'Servir frais (8-10°C). Parfait avec salades estivales, grillades ou cuisine méditerranéenne.',
      explanation: 'Vin rosé : à déguster jeune pour préserver ses arômes fruités.',
      source: 'local',
    };
  }

  if (input.color === 'blanc') {
    const matched = WHITE_AGING_RULES.find((r) => r.pattern.test(searchText));
    if (matched) {
      return {
        drinkFrom: baseYear + matched.fromOffset,
        drinkTo: baseYear + matched.toOffset + prestigeBonus,
        maxKeepYears: matched.maxKeep + prestigeBonus,
        estimatedCurrentPrice,
        foodPairings,
        notes: matched.note,
        explanation: `${matched.label}${isPrestige ? ' (cuvée/cru de garde)' : ''}.`,
        source: 'local',
      };
    }
    const toOffset = 3 + prestigeBonus;
    return {
      drinkFrom: baseYear,
      drinkTo: baseYear + toOffset,
      maxKeepYears: toOffset + 1,
      estimatedCurrentPrice,
      foodPairings,
      notes: 'Servir frais (9-11°C). Idéal avec fruits de mer, poissons grillés ou fromage de chèvre.',
      explanation: `Vin blanc sec${isPrestige ? ' de belle structure' : ' à boire sur sa fraîcheur'}.`,
      source: 'local',
    };
  }

  if (input.color === 'rouge') {
    const matched = RED_AGING_RULES.find((r) => r.pattern.test(searchText));
    if (matched) {
      return {
        drinkFrom: baseYear + matched.fromOffset,
        drinkTo: baseYear + matched.toOffset + prestigeBonus,
        maxKeepYears: matched.maxKeep + prestigeBonus,
        estimatedCurrentPrice,
        foodPairings,
        notes: matched.note,
        explanation: `${matched.label}${isPrestige ? ' (mention cru/réserve)' : ''}.`,
        source: 'local',
      };
    }
    const toOffset = 5 + prestigeBonus;
    return {
      drinkFrom: baseYear + 1,
      drinkTo: baseYear + toOffset,
      maxKeepYears: toOffset + 2,
      estimatedCurrentPrice,
      foodPairings,
      notes: 'Servir à 15-17°C. Accompagne très bien viandes rouges, volailles rôties et fromages.',
      explanation: `Vin rouge polyvalent${isPrestige ? ' avec potentiel de garde renforcé' : ''}.`,
      source: 'local',
    };
  }

  return {
    drinkFrom: baseYear,
    drinkTo: baseYear + 5 + prestigeBonus,
    maxKeepYears: 6 + prestigeBonus,
    estimatedCurrentPrice,
    foodPairings,
    notes: 'À déguster à température adaptée selon le style du vin.',
    explanation: 'Estimation générale basée sur le millésime.',
    source: 'local',
  };
}

function sanitizeJsonResponse(rawText: string): string {
  return rawText
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
}

export async function callGeminiJson<T>(prompt: string, apiKey = ''): Promise<T> {
  const aiModel = getFirebaseAiJsonModel();
  if (aiModel) {
    const result = await aiModel.generateContent(prompt);
    const text = result.response.text();
    if (!text) {
      throw new Error('Réponse Gemini vide.');
    }
    return JSON.parse(sanitizeJsonResponse(text)) as T;
  }

  if (!apiKey) {
    throw new Error('Firebase AI Logic non initialisé et aucune clé API fournie.');
  }

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.2,
          responseMimeType: 'application/json',
        },
      }),
    });

    if (!response.ok) {
      const errBody = await response.text().catch(() => '');
      throw new Error(`Erreur API Gemini (${response.status}): ${errBody.slice(0, 140)}`);
    }

    const payload = (await response.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    const text = payload.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
      throw new Error('Réponse Gemini vide.');
    }

    return JSON.parse(sanitizeJsonResponse(text)) as T;
  } finally {
    clearTimeout(timeout);
  }
}

export async function estimateWineTastingWindow(
  input: WineEstimationInput,
): Promise<WineEstimationResult> {
  const localEstimate = estimateWineWindowLocally(input);
  const apiKey = getGeminiApiKey();
  if (!app && !apiKey) {
    return localEstimate;
  }

  const currentYear = new Date().getFullYear();
  const prompt = `Tu es un sommelier expert. Estime la fenêtre de dégustation, le prix actuel et les accords mets-vins pour cette bouteille :
- Nom / Domaine : ${input.name || 'Non précisé'}
- Couleur : ${input.color}
- Appellation / Région : ${input.appellation || 'Non précisée'}
- Millésime : ${input.vintage ? input.vintage : 'Non millésimé / inconnu'}
- Prix d'achat : ${input.purchasePrice ? `${input.purchasePrice} EUR` : 'Inconnu'}
- Année actuelle : ${currentYear}

Réponds UNIQUEMENT en JSON valide avec ces champs exacts :
{
  "drinkFrom": <entier, année de début d'apogée>,
  "drinkTo": <entier, année de fin d'apogée / limite à boire>,
  "maxKeepYears": <entier, durée de garde totale en années depuis le millésime ou aujourd'hui>,
  "estimatedCurrentPrice": <nombre entier, estimation du prix actuel de marché en EUR>,
  "foodPairings": ["<accord 1>", "<accord 2>", "<accord 3>"],
  "notes": "<conseil court de service, carafage et dégustation en français, max 130 caractères>",
  "explanation": "<explication courte en 1 phrase en français>"
}`;

  try {
    const ai = await callGeminiJson<{
      drinkFrom?: number;
      drinkTo?: number;
      maxKeepYears?: number;
      estimatedCurrentPrice?: number;
      foodPairings?: string[];
      notes?: string;
      explanation?: string;
    }>(prompt, apiKey);

    const drinkFrom =
      typeof ai.drinkFrom === 'number' && ai.drinkFrom >= 1950 && ai.drinkFrom <= 2150
        ? Math.round(ai.drinkFrom)
        : localEstimate.drinkFrom;
    const rawDrinkTo =
      typeof ai.drinkTo === 'number' && ai.drinkTo >= 1950 && ai.drinkTo <= 2150
        ? Math.round(ai.drinkTo)
        : localEstimate.drinkTo;
    const drinkTo = Math.max(drinkFrom, rawDrinkTo);
    const maxKeepYears =
      typeof ai.maxKeepYears === 'number' && ai.maxKeepYears >= 1 && ai.maxKeepYears <= 100
        ? Math.round(ai.maxKeepYears)
        : Math.max(1, drinkTo - (input.vintage || currentYear));
    const estimatedCurrentPrice =
      typeof ai.estimatedCurrentPrice === 'number' && ai.estimatedCurrentPrice > 0
        ? Math.round(ai.estimatedCurrentPrice)
        : localEstimate.estimatedCurrentPrice;
    const foodPairings =
      Array.isArray(ai.foodPairings) && ai.foodPairings.length > 0
        ? ai.foodPairings.filter((x) => typeof x === 'string' && x.trim()).slice(0, 5)
        : localEstimate.foodPairings;

    return {
      drinkFrom,
      drinkTo,
      maxKeepYears,
      estimatedCurrentPrice,
      foodPairings,
      notes: typeof ai.notes === 'string' && ai.notes.trim() ? ai.notes.trim() : localEstimate.notes,
      explanation:
        typeof ai.explanation === 'string' && ai.explanation.trim()
          ? ai.explanation.trim()
          : 'Fenêtre estimée par Gemini AI.',
      source: 'gemini',
    };
  } catch (err) {
    return {
      ...localEstimate,
      warning:
        err instanceof Error
          ? `Gemini indisponible (${err.message}). Estimation locale utilisée.`
          : 'Gemini indisponible. Estimation locale utilisée.',
    };
  }
}

function parseDataUrl(dataUrl: string): { mimeType: string; base64: string } {
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) {
    throw new Error("Format d'image invalide.");
  }
  return { mimeType: match[1], base64: match[2] };
}

export async function identifyWineFromLabelImage(
  imageDataUrl: string,
): Promise<LabelIdentificationResult> {
  const apiKey = getGeminiApiKey();
  const aiModel = getFirebaseAiJsonModel();
  if (!aiModel && !apiKey) {
    throw new Error(
      'Service Firebase AI Logic indisponible. Vérifiez votre connexion internet.',
    );
  }

  const { mimeType, base64 } = parseDataUrl(imageDataUrl);
  const currentYear = new Date().getFullYear();
  const prompt = `Tu es un sommelier expert en reconnaissance d'étiquettes de vin. Analyse cette photo d'étiquette et extrais les informations de la bouteille. Année actuelle : ${currentYear}.
Réponds UNIQUEMENT en JSON valide :
{
  "name": "<nom du domaine / château / cuvée>",
  "color": "<rouge|blanc|rose|champagne|autre>",
  "appellation": "<appellation et région, ex: Saint-Émilion Grand Cru, Bordeaux>",
  "vintage": <entier millésime ou null si non millésimé/illisible>,
  "estimatedCurrentPrice": <entier prix moyen estimé en EUR ou null>,
  "drinkFrom": <entier année début apogée>,
  "drinkTo": <entier année fin apogée>,
  "maxKeepYears": <entier durée de garde en années>,
  "foodPairings": ["<accord 1>", "<accord 2>", "<accord 3>"],
  "notes": "<conseil court de service en français>",
  "confidenceNote": "<courte phrase sur ce qui a été lu sur l'étiquette>"
}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 16000);

  try {
    let text: string | undefined;
    if (aiModel) {
      const imagePart: Part = { type: 'inlineData', inlineData: { mimeType, data: base64 } };
      const result = await aiModel.generateContent([prompt, imagePart]);
      text = result.response.text();
    } else {
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${encodeURIComponent(apiKey)}`;
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { text: prompt },
                { inlineData: { mimeType, data: base64 } },
              ],
            },
          ],
          generationConfig: {
            temperature: 0.2,
            responseMimeType: 'application/json',
          },
        }),
      });

      if (!response.ok) {
        const errBody = await response.text().catch(() => '');
        throw new Error(`Erreur API Gemini (${response.status}): ${errBody.slice(0, 140)}`);
      }

      const payload = (await response.json()) as {
        candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
      };
      text = payload.candidates?.[0]?.content?.parts?.[0]?.text;
    }

    if (!text) {
      throw new Error('Réponse Gemini vide.');
    }

    const parsed = JSON.parse(sanitizeJsonResponse(text)) as {
      name?: string;
      color?: string;
      appellation?: string;
      vintage?: number | null;
      estimatedCurrentPrice?: number | null;
      drinkFrom?: number;
      drinkTo?: number;
      maxKeepYears?: number;
      foodPairings?: string[];
      notes?: string;
      confidenceNote?: string;
    };

    const validColors: WineColor[] = ['rouge', 'blanc', 'rose', 'champagne', 'autre'];
    const color: WineColor = validColors.includes(parsed.color as WineColor)
      ? (parsed.color as WineColor)
      : 'rouge';
    const name = parsed.name?.trim() || 'Cuvée identifiée';
    const appellation = parsed.appellation?.trim() || '';
    const vintage =
      typeof parsed.vintage === 'number' && parsed.vintage >= 1900 && parsed.vintage <= currentYear + 1
        ? Math.round(parsed.vintage)
        : undefined;

    const fallback = estimateWineWindowLocally({ name, color, appellation, vintage });

    return {
      name,
      color,
      appellation,
      vintage,
      estimatedCurrentPrice:
        typeof parsed.estimatedCurrentPrice === 'number' && parsed.estimatedCurrentPrice > 0
          ? Math.round(parsed.estimatedCurrentPrice)
          : fallback.estimatedCurrentPrice,
      drinkFrom:
        typeof parsed.drinkFrom === 'number' ? Math.round(parsed.drinkFrom) : fallback.drinkFrom,
      drinkTo:
        typeof parsed.drinkTo === 'number' ? Math.round(parsed.drinkTo) : fallback.drinkTo,
      maxKeepYears:
        typeof parsed.maxKeepYears === 'number'
          ? Math.round(parsed.maxKeepYears)
          : fallback.maxKeepYears,
      foodPairings:
        Array.isArray(parsed.foodPairings) && parsed.foodPairings.length > 0
          ? parsed.foodPairings.filter((x) => typeof x === 'string' && x.trim()).slice(0, 5)
          : fallback.foodPairings,
      notes: parsed.notes?.trim() || fallback.notes,
      confidenceNote:
        parsed.confidenceNote?.trim() || 'Étiquette analysée automatiquement par Gemini Vision.',
    };
  } finally {
    clearTimeout(timeout);
  }
}
