import { Bottle, WineColor } from '../types/wine';
import {
  callGeminiJson,
  estimateWineTastingWindow,
  getGeminiApiKey,
} from './aiWineService';

export interface BarcodeBottleInfo {
  name: string;
  color: WineColor;
  appellation: string;
  vintage?: number;
  purchasePrice?: number;
  drinkFrom?: number;
  drinkTo?: number;
  maxKeepYears?: number;
  notes?: string;
}

export interface BarcodeLookupResult {
  found: boolean;
  source: 'cellar' | 'openfoodfacts' | 'gemini' | 'not_found';
  data?: BarcodeBottleInfo;
  message: string;
}

interface OpenFoodFactsProduct {
  product_name?: string;
  product_name_fr?: string;
  generic_name?: string;
  generic_name_fr?: string;
  brands?: string;
  categories?: string;
  categories_tags?: string[];
  origins?: string;
  manufacturing_places?: string;
  labels?: string;
  alcohol_by_volume?: number;
}

interface OpenFoodFactsResponse {
  status: number;
  product?: OpenFoodFactsProduct;
}

const KNOWN_APPELLATIONS: Array<[RegExp, string]> = [
  [/pauillac/i, 'Pauillac, Bordeaux'],
  [/saint-julien/i, 'Saint-Julien, Bordeaux'],
  [/saint-est[eè]phe/i, 'Saint-Estèphe, Bordeaux'],
  [/margaux/i, 'Margaux, Bordeaux'],
  [/pessac-l[eé]ognan/i, 'Pessac-Léognan, Bordeaux'],
  [/saint-[eé]milion/i, 'Saint-Émilion, Bordeaux'],
  [/pomerol/i, 'Pomerol, Bordeaux'],
  [/haut-m[eé]doc/i, 'Haut-Médoc, Bordeaux'],
  [/m[eé]doc/i, 'Médoc, Bordeaux'],
  [/sauternes/i, 'Sauternes, Bordeaux'],
  [/bordeaux/i, 'Bordeaux'],
  [/chablis/i, 'Chablis, Bourgogne'],
  [/puligny-montrachet/i, 'Puligny-Montrachet, Bourgogne'],
  [/meursault/i, 'Meursault, Bourgogne'],
  [/gevrey-chambertin/i, 'Gevrey-Chambertin, Bourgogne'],
  [/pommard/i, 'Pommard, Bourgogne'],
  [/bourgogne/i, 'Bourgogne'],
  [/ch[aâ]teauneuf-du-pape/i, 'Châteauneuf-du-Pape, Rhône'],
  [/c[oô]te-r[oô]tie/i, 'Côte-Rôtie, Rhône'],
  [/hermitage|crozes-hermitage/i, 'Hermitage, Rhône'],
  [/gigondas/i, 'Gigondas, Rhône'],
  [/c[oô]tes du rh[oô]ne|cotes du rhone/i, 'Côtes du Rhône'],
  [/champagne/i, 'Champagne'],
  [/cr[eé]mant d'alsace/i, "Crémant d'Alsace"],
  [/cr[eé]mant de bourgogne/i, 'Crémant de Bourgogne'],
  [/cr[eé]mant de loire/i, 'Crémant de Loire'],
  [/sancerre/i, 'Sancerre, Loire'],
  [/pouilly-fum[eé]/i, 'Pouilly-Fumé, Loire'],
  [/chinon/i, 'Chinon, Loire'],
  [/alsace|riesling|gewurztraminer/i, 'Alsace'],
  [/c[oô]tes de provence|provence/i, 'Côtes de Provence'],
  [/bandol/i, 'Bandol, Provence'],
  [/beaujolais|morgon|brouilly|fleurie/i, 'Beaujolais'],
  [/languedoc|pic saint-loup|corbi[eè]res|minervois/i, 'Languedoc'],
  [/prosecco/i, 'Prosecco, Italie'],
  [/chianti/i, 'Chianti, Italie'],
  [/barolo/i, 'Barolo, Italie'],
  [/rioja/i, 'Rioja, Espagne'],
];

function inferColorFromText(text: string, tags: string[] = []): WineColor {
  const joinedTags = tags.join(' ').toLowerCase();
  const full = `${text} ${joinedTags}`.toLowerCase();

  if (
    /champagne|sparkling|effervescent|mousseux|cr[eé]mant|prosecco|cava|p[eé]tillant/.test(full)
  ) {
    return 'champagne';
  }
  if (/\bros[eé]\b|rose-wine|vins-roses|vin ros[eé]/.test(full)) {
    return 'rose';
  }
  if (
    /\bblanc\b|white-wine|vins-blancs|chardonnay|sauvignon|riesling|gewurztraminer|chablis|sauternes|muscadet|viognier|pinot gris/.test(
      full,
    )
  ) {
    return 'blanc';
  }
  if (
    /\brouge\b|red-wine|vins-rouges|merlot|cabernet|syrah|shiraz|pinot noir|malbec|grenache|bordeaux|m[eé]doc|pauillac|chinon|beaujolais|chianti|rioja/.test(
      full,
    )
  ) {
    return 'rouge';
  }
  return 'autre';
}

function inferAppellation(product: OpenFoodFactsProduct, fullText: string): string {
  for (const [regex, label] of KNOWN_APPELLATIONS) {
    if (regex.test(fullText)) {
      return label;
    }
  }
  const origins = product.origins?.trim() || product.manufacturing_places?.trim();
  if (origins) {
    return origins.split(',')[0].trim();
  }
  return '';
}

function extractVintage(text: string): number | undefined {
  const maxYear = new Date().getFullYear() + 1;
  const matches = text.match(/\b(19[5-9]\d|20[0-3]\d)\b/g);
  if (!matches) return undefined;
  for (const m of matches) {
    const yr = Number(m);
    if (yr >= 1950 && yr <= maxYear) {
      return yr;
    }
  }
  return undefined;
}

function buildCleanBottleName(product: OpenFoodFactsProduct): string {
  const rawName = (product.product_name_fr || product.product_name || product.generic_name_fr || product.generic_name || '').trim();
  const brand = (product.brands || '').split(',')[0].trim();

  if (brand && rawName) {
    if (rawName.toLowerCase().includes(brand.toLowerCase())) {
      return rawName;
    }
    return `${brand} — ${rawName}`;
  }
  return rawName || brand;
}

export async function lookupBottleByBarcode(
  rawBarcode: string,
  existingBottles: Bottle[] = [],
): Promise<BarcodeLookupResult> {
  const barcode = rawBarcode.replace(/\s+/g, '').trim();
  if (!barcode) {
    return {
      found: false,
      source: 'not_found',
      message: 'Veuillez saisir un code-barres.',
    };
  }

  // 1. Vérifier d'abord dans la cave existante
  const existing = existingBottles.find(
    (b) => b.barcode && b.barcode.replace(/\s+/g, '').trim() === barcode,
  );
  if (existing) {
    return {
      found: true,
      source: 'cellar',
      data: {
        name: existing.name,
        color: existing.color,
        appellation: existing.appellation === 'Non précisée' ? '' : existing.appellation,
        vintage: existing.vintage,
        purchasePrice: existing.purchasePrice,
        drinkFrom: existing.drinkFrom,
        drinkTo: existing.drinkTo,
        maxKeepYears: existing.maxKeepYears,
        notes: existing.notes,
      },
      message: `Bouteille reconnue depuis votre cave (${existing.name}).`,
    };
  }

  // 2. Interroger Open Food Facts
  let offProduct: OpenFoodFactsProduct | undefined;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const url = `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(
      barcode,
    )}.json?fields=product_name,product_name_fr,generic_name,generic_name_fr,brands,categories,categories_tags,origins,manufacturing_places,labels,alcohol_by_volume`;

    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);

    if (res.ok) {
      const json = (await res.json()) as OpenFoodFactsResponse;
      if (json.status === 1 && json.product) {
        offProduct = json.product;
      }
    }
  } catch {
    // Network / CORS / timeout error handled below
  }

  if (offProduct) {
    const baseName = buildCleanBottleName(offProduct);
    if (baseName) {
      const fullText = [
        baseName,
        offProduct.generic_name_fr,
        offProduct.generic_name,
        offProduct.categories,
        offProduct.labels,
        offProduct.origins,
      ]
        .filter(Boolean)
        .join(' ');

      let name = baseName;
      let color = inferColorFromText(fullText, offProduct.categories_tags);
      let appellation = inferAppellation(offProduct, fullText);
      let vintage = extractVintage(fullText);

      // Si Gemini est configuré, affiner les infos extraites d'Open Food Facts
      const apiKey = getGeminiApiKey();
      if (apiKey) {
        try {
          const enriched = await callGeminiJson<{
            name?: string;
            color?: WineColor;
            appellation?: string;
            vintage?: number | null;
          }>(
            `Nettoie et complète ces infos de bouteille de vin issues d'un code-barres EAN (${barcode}) :
Nom brut : ${baseName}
Catégories : ${offProduct.categories || ''}
Labels / Origine : ${offProduct.labels || ''} ${offProduct.origins || ''}

Réponds uniquement en JSON valide :
{
  "name": "<nom propre du château/domaine/cuvée>",
  "color": "<rouge|blanc|rose|champagne|autre>",
  "appellation": "<appellation et région, ex: Pauillac, Bordeaux>",
  "vintage": <entier année si connu sinon null>
}`,
            apiKey,
          );

          if (enriched.name?.trim()) name = enriched.name.trim();
          if (
            enriched.color &&
            ['rouge', 'blanc', 'rose', 'champagne', 'autre'].includes(enriched.color)
          ) {
            color = enriched.color;
          }
          if (enriched.appellation?.trim()) appellation = enriched.appellation.trim();
          if (typeof enriched.vintage === 'number' && enriched.vintage > 1900) {
            vintage = Math.round(enriched.vintage);
          }
        } catch {
          // Keep OFF extraction on Gemini failure
        }
      }

      const estimation = await estimateWineTastingWindow({
        name,
        color,
        appellation,
        vintage,
      });

      return {
        found: true,
        source: 'openfoodfacts',
        data: {
          name,
          color,
          appellation,
          vintage,
          drinkFrom: estimation.drinkFrom,
          drinkTo: estimation.drinkTo,
          maxKeepYears: estimation.maxKeepYears,
          notes: estimation.notes,
        },
        message: `Infos remplies via Open Food Facts + estimation ${
          estimation.source === 'gemini' ? 'Gemini AI' : 'œnologique'
        }.`,
      };
    }
  }

  return {
    found: false,
    source: 'not_found',
    message:
      'Code-barres introuvable dans Open Food Facts. Saisissez le nom du vin puis cliquez sur « Remplir par IA ».',
  };
}
