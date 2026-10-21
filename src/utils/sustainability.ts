/**
 * Certificaciones de sostenibilidad (base TourVerificado, importada con
 * scripts/import-tourverificado.py). El estado se calcula en cada build contra la fecha del
 * día: una certificación con fecha de fin pasa sola a "por vencer" y a "vencida".
 */
import type { Locale } from './i18n';

export interface Certification {
  id: string;
  company: string;
  type: string | null;
  region: string | null;
  place: string | null;
  certification: string | null;
  level: string | null;
  certifier: string | null;
  code: string | null;
  validFrom: string | null;
  validUntil: string | null;
  sourceStatus: string | null;
  registryStatus: string | null;
  placeConfidence: string | null;
  verifiedAt: string | null;
  source: string | null;
  notes: string | null;
  companyIds: string[];
}

export interface RecognizedDestination {
  name: string;
  region: string | null;
  organization: string | null;
  recognition: string | null;
  year: number | null;
  source: string | null;
}

export type CertStatus = 'valid' | 'expiring' | 'valid-undated' | 'expired' | 'terminated' | 'not-certified';

/** Días antes del fin de vigencia en que una certificación pasa a "por vencer". */
export const EXPIRING_DAYS = 120;

export function certStatus(c: Pick<Certification, 'validUntil' | 'registryStatus'>, today = new Date()): CertStatus {
  const reg = (c.registryStatus ?? '').toLowerCase();
  if (reg.startsWith('terminada')) return 'terminated';
  if (c.validUntil) {
    const days = (Date.parse(`${c.validUntil}T23:59:59Z`) - today.getTime()) / 86_400_000;
    if (days < 0) return 'expired';
    return days <= EXPIRING_DAYS ? 'expiring' : 'valid';
  }
  if (reg.startsWith('vigente')) return 'valid-undated';
  if (reg.startsWith('vencida')) return 'expired';
  return 'not-certified';
}

export const isCurrent = (s: CertStatus) => s === 'valid' || s === 'expiring' || s === 'valid-undated';

export function currentCertifications(all: Certification[], today = new Date()) {
  return all
    .map((c) => ({ ...c, status: certStatus(c, today) }))
    .filter((c) => isCurrent(c.status))
    .sort((a, b) => (a.region ?? '').localeCompare(b.region ?? '') || a.company.localeCompare(b.company));
}

/**
 * Certificaciones vigentes de una ficha del directorio (vacío si no tiene). Con `includeAll`
 * devuelve también las vencidas o terminadas, para las fichas que existen por su certificación.
 */
export function certificationsForCompany(all: Certification[], companyId: string, today = new Date(), includeAll = false) {
  const id = companyId.replace(/\.md$/i, '');
  const list = includeAll
    ? all.map((c) => ({ ...c, status: certStatus(c, today) })).sort((a, b) => Number(isCurrent(b.status)) - Number(isCurrent(a.status)))
    : currentCertifications(all, today);
  return list.filter((c) => c.companyIds.includes(id));
}

const TYPES_EN: Record<string, string> = {
  Alojamiento: 'Lodging',
  'Operador turístico': 'Tour operator',
  'Operador de aventura': 'Adventure operator',
  'Agencia receptiva': 'Inbound agency',
  'Agencia receptiva francófona': 'French-speaking inbound agency',
  'Turismo rural comunitario': 'Community-based rural tourism',
  'Operador / DMC': 'Operator / DMC',
  'Agencia / operador': 'Agency / operator',
  'Operador de trekking': 'Trekking operator',
  'Operador receptivo': 'Inbound operator',
  Ecolodge: 'Ecolodge',
  'Turismo comunitario / lodges': 'Community tourism / lodges',
  'Agencia de turismo responsable': 'Responsible travel agency',
  'Hotel / operador de expediciones': 'Hotel / expedition operator',
  'Ecoturismo / conservación': 'Ecotourism / conservation',
  'Operador global (oficina en Lima)': 'Global operator (Lima office)',
};

/** Tipo de empresa en el idioma de la página (el dato de origen está en español). */
export function typeLabel(type: string | null, lang: Locale): string {
  if (!type) return '';
  return lang === 'en' ? TYPES_EN[type] ?? type : type;
}

export function statusLabel(s: CertStatus, lang: Locale): string {
  const es = lang === 'es';
  switch (s) {
    case 'valid': return es ? 'Vigente' : 'Valid';
    case 'expiring': return es ? 'Vigente, vence pronto' : 'Valid, expires soon';
    case 'valid-undated': return es ? 'Vigente (sin fecha publicada)' : 'Valid (no end date published)';
    case 'expired': return es ? 'Vencida' : 'Expired';
    case 'terminated': return es ? 'Terminada' : 'Terminated';
    default: return es ? 'No certificada' : 'Not certified';
  }
}

/** Nombre corto del sello (el Excel usa descripciones largas). */
export function certificationLabel(c: Pick<Certification, 'certification'>, lang: Locale): string {
  const name = c.certification ?? '';
  if (/^Sustainable Travel/i.test(name)) return lang === 'es' ? 'Sustainable Travel (reconocido por GSTC)' : 'Sustainable Travel (GSTC-recognised)';
  if (/^Empresa B/i.test(name)) return lang === 'es' ? 'Empresa B Certificada' : 'Certified B Corporation';
  return name;
}

/**
 * Código del certificado, para buscarlo en registros sin página por empresa (Preferred by
 * Nature). Null si la fuente lo publica incompleto.
 */
export function certCode(c: Pick<Certification, 'code'>): string | null {
  const code = c.code?.trim();
  return code && /^[A-Z]{2,3}-[A-Z]{2}-\d+$/.test(code) ? code : null;
}

/**
 * Destino reconocido → página de destino del sitio, solo cuando el lugar reconocido está
 * dentro del destino o se visita desde él.
 */
const RECOGNIZED_TO_DESTINATION: [RegExp, string][] = [
  [/ku[eé]lap|gocta/i, 'chachapoyas'],
  [/tambopata/i, 'puerto_maldonado'],
  [/titicaca/i, 'puno'],
  [/colca/i, 'colca'],
  [/[oó]rganos/i, 'piura'],
  [/p[oó]mac/i, 'chiclayo'],
  [/allpahuayo/i, 'iquitos'],
];

export function destinationForRecognized(name: string): string | null {
  return RECOGNIZED_TO_DESTINATION.find(([re]) => re.test(name))?.[1] ?? null;
}

/** Región del Excel → destino del sitio con ese mismo ámbito. */
const REGION_TO_DESTINATION: Record<string, string> = {
  Cusco: 'cusco',
  Lima: 'lima',
  Arequipa: 'arequipa',
  Amazonas: 'chachapoyas',
  'San Martín': 'tarapoto',
  'Madre de Dios': 'puerto_maldonado',
  Loreto: 'iquitos',
  Puno: 'puno',
};

export function destinationForRegion(region: string | null): string | null {
  return region ? REGION_TO_DESTINATION[region] ?? null : null;
}

/** Reconocimientos de un destino del sitio (para su página). */
export function recognitionsFor(all: RecognizedDestination[], destinationSlug: string) {
  return all.filter((d) => destinationForRecognized(d.name) === destinationSlug);
}

/** Certificaciones vigentes de empresas cuya región corresponde a un destino. */
export function currentCertificationsIn(all: Certification[], destinationSlug: string, today = new Date()) {
  return currentCertifications(all, today).filter((c) => destinationForRegion(c.region) === destinationSlug);
}

/** Ids de ficha con al menos una certificación vigente hoy (para la etiqueta en listados). */
export function certifiedCompanyIds(all: Certification[], today = new Date()): Set<string> {
  return new Set(currentCertifications(all, today).flatMap((c) => c.companyIds));
}
