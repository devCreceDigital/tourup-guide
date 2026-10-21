/**
 * Lógica de las landings de prompts de IA, sin dependencias de Astro para poder testearla.
 *
 * `brands_ai_mentions` debería ser la lista de marcas que un asistente de IA citó al responder
 * ese prompt. Hoy 195 de 201 prompts traen exactamente la misma lista de 10 empresas (un valor
 * por defecto del pipeline), así que esa lista NO se presenta como "mencionada por ChatGPT":
 * se detecta y se muestra como ejemplo neutro del directorio. En cuanto se regeneren las
 * menciones, las páginas pasan solas al formato de "empresas mencionadas".
 */
import { getLocalizedString, type Locale } from './i18n';
import { cityLabel, companyDescription, companyDisplayName, companyPath, companyRole, hasCompanyName } from './seo';
import { operatorsIn } from './graph';

export interface Entry {
  id: string;
  slug?: string;
  data: Record<string, any>;
}

export interface ResolvedMention {
  name: string;
  entity_type: string;
  entity_slug?: string;
  found: boolean;
  entity?: Entry;
  /** URL interna (ficha) o externa (web oficial de la marca). */
  url?: string;
  external?: boolean;
}

const stripMd = (id: string) => id.replace(/\.md$/i, '');
const norm = (s: string) => s.normalize('NFC').toLowerCase();

/**
 * Índice de fichas por nombre de archivo y por el `slug:` del frontmatter. Una misma empresa
 * puede citarse con o sin tildes (`feel-perú-travel-…` / `feel-per-travel-…`) y solo una de
 * las dos variantes existe como página.
 */
export function indexCompanies(companies: Entry[]): Map<string, Entry> {
  const map = new Map<string, Entry>();
  for (const c of companies) {
    map.set(norm(stripMd(c.id)), c);
    const fm = String(c.slug ?? c.data?.slug ?? '').split('/').filter(Boolean).pop();
    if (fm && !map.has(norm(fm))) map.set(norm(fm), c);
  }
  return map;
}

export function resolveMentions(
  mentions: unknown[] | undefined,
  companyIndex: Map<string, Entry>,
  externalBrands: Entry[],
  lang: Locale,
): ResolvedMention[] {
  return (mentions ?? []).map((m: any) => {
    const mention = typeof m === 'string' ? { name: m, entity_type: 'unknown' } : m;
    if (mention.entity_type === 'company' && mention.entity_slug) {
      const c = companyIndex.get(norm(String(mention.entity_slug)));
      const usable = !!c && hasCompanyName(getLocalizedString(c.data.title, lang));
      return usable
        ? { ...mention, found: true, entity: c, url: companyPath(lang, c!.id) }
        : { ...mention, found: false };
    }
    if (mention.entity_type === 'external_brand' && mention.entity_slug) {
      const b = externalBrands.find((e) => stripMd(e.id) === mention.entity_slug);
      return b
        ? { ...mention, found: true, entity: b, url: b.data.official_url, external: true }
        : { ...mention, found: false };
    }
    return { ...mention, found: false };
  });
}

/** Firma de la lista de empresas de un prompt, para detectar listas repetidas. */
export function mentionSignature(mentions: unknown[] | undefined): string {
  return (mentions ?? [])
    .map((m: any) => (typeof m === 'string' ? m : `${m.entity_type}:${m.entity_slug ?? m.name}`))
    .filter((s) => !/^(destino|categoria):/.test(s))
    .sort()
    .join('|');
}

/**
 * Firmas compartidas por más de `threshold` (fracción) de los prompts: no son datos de
 * menciones reales de ese prompt, son un valor por defecto.
 */
export function placeholderSignatures(allMentions: unknown[][], threshold = 0.2): Set<string> {
  const counts = new Map<string, number>();
  for (const m of allMentions) {
    const sig = mentionSignature(m);
    if (sig) counts.set(sig, (counts.get(sig) ?? 0) + 1);
  }
  const min = Math.max(2, allMentions.length * threshold);
  return new Set([...counts].filter(([, n]) => n > min).map(([sig]) => sig));
}

export interface DirectoryStats {
  total: number;
  roles: { label: string; count: number }[];
  /** Por destino (Cusco, Lima…), con la misma cuenta que muestra la página de cada destino. */
  destinations: { label: string; count: number }[];
}

const ROLE_PLURAL: Record<string, Record<Locale, string>> = {
  tour_operator: { es: 'operadores turísticos', en: 'tour operators' },
  retail_travel_agency: { es: 'agencias de viajes minoristas', en: 'retail travel agencies' },
  wholesale_travel_agency: { es: 'agencias mayoristas', en: 'wholesale travel agencies' },
  online_travel_agency: { es: 'agencias online', en: 'online travel agencies' },
  dmc: { es: 'DMC', en: 'DMCs' },
  mixed_agency: { es: 'agencias mixtas', en: 'mixed travel agencies' },
  lodging: { es: 'alojamientos', en: 'lodgings' },
};

/** Cifras reales del directorio (solo fichas con nombre, que son las indexables). */
export function directoryStats(companies: Entry[], lang: Locale, destinos: Entry[] = []): DirectoryStats {
  const named = companies.filter((c) => hasCompanyName(getLocalizedString(c.data.title, lang)));
  const tally = (key: (c: Entry) => string) => {
    const m = new Map<string, number>();
    for (const c of named) {
      const k = key(c);
      if (k) m.set(k, (m.get(k) ?? 0) + 1);
    }
    return [...m].sort((a, b) => b[1] - a[1]).map(([label, count]) => ({ label, count }));
  };
  return {
    total: named.length,
    roles: tally((c) => ROLE_PLURAL[c.data.distribution_role]?.[lang] ?? companyRole(c.data, lang)),
    destinations: destinos
      .map((d) => ({ slug: d.id.replace(/\.md$/i, ''), label: getLocalizedString(d.data.name, lang) }))
      .filter((d) => d.slug !== 'peru' && d.label)
      .map((d) => ({ label: d.label, count: operatorsIn(companies, d.slug, lang).length }))
      .filter((d) => d.count > 0)
      .sort((a, b) => b.count - a.count),
  };
}

const listJoin = (items: string[], lang: Locale) =>
  items.length <= 1 ? items.join('') : `${items.slice(0, -1).join(', ')} ${lang === 'es' ? 'y' : 'and'} ${items[items.length - 1]}`;

/** Una respuesta de ejemplo del directorio: "Nombre (Ciudad)". */
export function mentionLabel(m: ResolvedMention, lang: Locale): string {
  if (m.entity_type !== 'company' || !m.entity) return m.name;
  const city = cityLabel(m.entity.data.location?.city ?? m.entity.data.nap?.city);
  const name = companyDisplayName(m.entity.data, lang);
  return city ? `${name} (${city})` : name;
}

/**
 * Respuesta directa para la cabecera de la landing. Nunca afirma que una IA citó algo que el
 * dato no respalda: con menciones reales las nombra; con la lista por defecto responde con
 * las cifras del directorio.
 */
export function quickAnswer(opts: {
  question: string;
  lang: Locale;
  mentions: ResolvedMention[];
  realMentions: boolean;
  platforms: string[];
  stats: DirectoryStats;
}): string {
  const { question, lang, mentions, realMentions, platforms, stats } = opts;
  const cited = mentions.filter((m) => m.entity_type === 'company' || m.entity_type === 'external_brand');
  const es = lang === 'es';
  if (realMentions && cited.length) {
    const who = platforms.length ? listJoin(platforms, lang) : es ? 'asistentes de IA' : 'AI assistants';
    // Todas las marcas citadas, tengan o no ficha: la afirmación es "la IA las mencionó".
    const names = listJoin(cited.slice(0, 6).map((m) => mentionLabel(m, lang)), lang);
    const more = cited.length > 6 ? (es ? `, entre ${cited.length} marcas` : `, among ${cited.length} brands`) : '';
    return es
      ? `Para la pregunta «${question}», las respuestas de ${who} mencionan a ${names}${more}. Cada empresa del directorio TourUp tiene una ficha con su RUC, dirección y contacto.`
      : `For “${question}”, ${who} answers mention ${names}${more}. Each company in the TourUp directory has a profile with its tax ID (RUC), address and contact details.`;
  }
  const roles = listJoin(stats.roles.slice(0, 3).map((r) => `${r.count} ${r.label}`), lang);
  const places = listJoin(stats.destinations.slice(0, 3).map((c) => `${c.label} (${c.count})`), lang);
  return es
    ? `El directorio TourUp reúne ${stats.total} empresas de turismo registradas en Perú (${roles}), sobre todo en los destinos de ${places}. Cada ficha muestra el RUC, la dirección y los datos de contacto de la empresa para comprobarla antes de reservar.`
    : `The TourUp directory lists ${stats.total} registered travel companies in Peru (${roles}), mostly in the destinations of ${places}. Each profile shows the company's tax ID (RUC), address and contact details so you can check it before booking.`;
}

/** Texto de apoyo de una tarjeta de empresa: descripción veraz en el idioma de la página. */
export function mentionSummary(m: ResolvedMention, lang: Locale): string {
  if (m.entity_type === 'company' && m.entity) return companyDescription(m.entity.data, lang);
  return getLocalizedString(m.entity?.data.summary, lang);
}

/** Una página /es/ de prompt solo se indexa si está traducida (título distinto al inglés). */
export function isTranslated(esTitle: string, enTitle: string | undefined): boolean {
  if (!enTitle) return true;
  return norm(esTitle.trim()) !== norm(enTitle.trim());
}
