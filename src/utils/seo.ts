import { getLocalizedString, type Locale } from './i18n';

export const SITE_URL = 'https://guide.tourup.co';

/**
 * Perfiles oficiales de la marca (LinkedIn, Google Business, Wikidata, Instagram…).
 * Alimentan `Organization.sameAs`, que es lo que los motores de IA usan para resolver la
 * entidad "TourUp". RELLENAR con URLs reales: no se inventan.
 */
export const ORG_SAME_AS: string[] = [];

// ── hreflang ────────────────────────────────────────────────────
export interface Alternates {
  es: string;
  en: string;
  xDefault: string;
}

/**
 * Alternates hreflang SOLO hacia URLs que existen. El inglés es el idioma principal: su
 * portada es `/` (no `/en/`, que redirige a `/`).
 * - `/`, `/en/`, `/es/`  → en `/`, es `/es/` (x-default `/`)
 * - `/es|en/...`         → mismo path en el otro idioma; `empresas` (es) ↔ `companies` (en)
 * - resto (blog)         → null: no tienen versión por idioma, así que no se emite hreflang.
 */
export function hreflangAlternates(currentPath: string, siteUrl = SITE_URL): Alternates | null {
  if (currentPath === '/' || currentPath === '/en/' || currentPath === '/es/') {
    return { es: `${siteUrl}/es/`, en: `${siteUrl}/`, xDefault: `${siteUrl}/` };
  }
  const m = currentPath.match(/^\/(?:es|en)(\/.*)?$/);
  if (!m) return null;
  const rest = m[1] ?? '/';
  const forLang = (lang: Locale) =>
    `${siteUrl}/${lang}${rest
      .replace(/^\/(empresas|companies)(?=\/|$)/, lang === 'es' ? '/empresas' : '/companies')
      .replace(/^\/(destinos|destinations)(?=\/|$)/, lang === 'es' ? '/destinos' : '/destinations')}`;
  return { es: forLang('es'), en: forLang('en'), xDefault: forLang('en') };
}

// ── Breadcrumbs ─────────────────────────────────────────────────
const LABELS: Record<string, Record<Locale, string>> = {
  peru: { es: 'Destinos', en: 'Destinations' },
  destinos: { es: 'Destinos', en: 'Destinations' },
  destinations: { es: 'Destinos', en: 'Destinations' },
  sustainability: { es: 'Sostenibilidad', en: 'Sustainability' },
  sostenibilidad: { es: 'Sostenibilidad', en: 'Sustainability' },
  empresas: { es: 'Empresas', en: 'Companies' },
  companies: { es: 'Empresas', en: 'Companies' },
  'ai-prompts': { es: 'Prompts de IA', en: 'AI prompts' },
  blog: { es: 'Blog', en: 'Blog' },
  tours: { es: 'Tours', en: 'Tours' },
};

const titleCase = (slug: string) => slug.replace(/[-_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

/** Quita el sufijo de marca (" | TourUp…") del <title> para usarlo como nombre de miga. */
export function shortTitle(title: string): string {
  return title.replace(/[ ]*[|][ ]*TourUp.*$/i, '').trim() || title;
}

export interface Crumb {
  name: string;
  url: string;
}

/**
 * Migas de pan con etiquetas legibles y en el idioma de la página. El segmento de idioma
 * no es una miga ("En"): la raíz es Home → `/` (inglés) o Inicio → `/es/`. El segmento
 * `peru` apunta al índice de destinos (/en/destinations/, /es/destinos/).
 */
export function breadcrumbTrail(currentPath: string, lang: Locale, title?: string, siteUrl = SITE_URL): Crumb[] {
  const parts = currentPath.split('/').filter(Boolean);
  const prefixed = parts[0] === 'es' || parts[0] === 'en';
  const segs = prefixed ? parts.slice(1) : parts;
  const base = prefixed ? `/${parts[0]}/` : '/';
  const home = prefixed && parts[0] === 'es' ? '/es/' : '/';

  const crumbs: Crumb[] = [{ name: lang === 'en' ? 'Home' : 'Inicio', url: `${siteUrl}${home}` }];
  let acc = base;
  segs.forEach((seg, i) => {
    acc += `${seg}/`;
    const isLast = i === segs.length - 1;
    // /{lang}/peru/ no es una página: la miga "Destinos" apunta al índice de destinos.
    const hub = lang === 'es' ? '/es/destinos/' : '/en/destinations/';
    const url = `${siteUrl}${seg === 'peru' && i === 0 && prefixed ? hub : acc}`;
    const name = isLast && title ? title : LABELS[seg]?.[lang] ?? titleCase(seg);
    const prev = crumbs[crumbs.length - 1];
    if (prev.url === url) {
      if (isLast) prev.name = name; // p. ej. /en/peru/peru/: una sola miga
    } else {
      crumbs.push({ name, url });
    }
  });
  return crumbs;
}

// ── Empresas ────────────────────────────────────────────────────
const ROLES: Record<string, Record<Locale, string>> = {
  tour_operator: { es: 'Operador turístico', en: 'Tour operator' },
  retail_travel_agency: { es: 'Agencia de viajes minorista', en: 'Retail travel agency' },
  wholesale_travel_agency: { es: 'Agencia de viajes mayorista', en: 'Wholesale travel agency' },
  online_travel_agency: { es: 'Agencia de viajes online', en: 'Online travel agency' },
  dmc: { es: 'DMC (gestor de destino)', en: 'Destination management company' },
  mixed_agency: { es: 'Agencia mixta', en: 'Mixed travel agency' },
  lodging: { es: 'Alojamiento', en: 'Lodging' },
};

/** Hay fichas cuyo nombre es "-" o está vacío (dato de origen): no tienen ninguna letra ni número. */
export function hasCompanyName(name: string): boolean {
  return /[\p{L}\p{N}]/u.test(name);
}

/**
 * Nombre visible de la ficha. Si el dato de origen no trae nombre real, se usa una etiqueta
 * descriptiva (rol + ciudad) en lugar de inventar un nombre comercial.
 */
export function companyDisplayName(d: any, lang: Locale): string {
  const title = getLocalizedString(d.title, lang).trim();
  if (hasCompanyName(title)) return title;
  const city = getLocalizedString(d.nap?.city ?? d.location?.city, lang).trim();
  const role = ROLES[d.distribution_role]?.[lang] ?? ROLES.tour_operator[lang];
  return lang === 'en' ? `${role} in ${city || 'Peru'}` : `${role} en ${city || 'Perú'}`;
}

/**
 * Meta description de una ficha de empresa. El `summary` de origen es genérico
 * ("Travel Company based in CUSCO, CUSCO, Peru.") y lo comparten cientos de fichas, así que
 * se antepone el nombre para que cada descripción sea única. Sin summary se genera una
 * descripción veraz con datos reales, sin afirmar verificación, licencias ni reseñas.
 */
export function companyDescription(d: any, lang: Locale): string {
  const summary = getLocalizedString(d.summary, lang).trim();
  const name = companyDisplayName(d, lang);
  const named = hasCompanyName(getLocalizedString(d.title, lang).trim());
  // El summary de origen es texto en inglés ('... based in CITY, ...'): en /es/ se usa la descripción generada en español.
  const englishBoilerplate = lang === 'es' && /based in/i.test(summary);
  if (summary && !englishBoilerplate) {
    if (!named || summary.toLowerCase().includes(name.toLowerCase())) return summary;
    return `${name} — ${summary}`;
  }
  const city = getLocalizedString(d.nap?.city ?? d.location?.city, lang).trim();
  const role = ROLES[d.distribution_role]?.[lang] ?? ROLES.tour_operator[lang];
  return lang === 'en'
    ? `${name} — ${role.toLowerCase()} in ${city || 'Peru'}. B2B profile in the TourUp directory of Peru travel operators.`
    : `${name} — ${role.toLowerCase()} en ${city || 'Perú'}. Ficha B2B en el directorio de operadores turísticos de TourUp.`;
}

/**
 * Ruta de la ficha en el idioma de la página. Única fuente de esta URL: antes cada página la
 * construía a su manera y varias generaban `/empresas/x/` sin idioma, que redirigía a /en/.
 */
export function companyPath(lang: Locale, id: string): string {
  const slug = id.replace(/\.md$/i, '');
  return lang === 'es' ? `/es/empresas/${slug}/` : `/en/companies/${slug}/`;
}

export function companyRole(d: any, lang: Locale): string {
  return ROLES[d?.distribution_role]?.[lang] ?? ROLES.tour_operator[lang];
}

/** "WANCHAQ" → "Wanchaq", "SAN JERÓNIMO" → "San Jerónimo". El dato de origen viene en mayúsculas. */
export function cityLabel(raw: unknown): string {
  const s = String(raw ?? '').trim();
  if (!s) return '';
  return s.toLocaleLowerCase('es').replace(/(^|[\s-])(\p{L})/gu, (_, sep, ch) => sep + ch.toLocaleUpperCase('es'));
}
