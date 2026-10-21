"""Importa la base TourVerificado (Excel) a src/data/sustainability.json.

Uso: python scripts/import-tourverificado.py <ruta al .xlsx>

- Una fila por certificación, con sus fechas y fuente. El estado (vigente, por vencer,
  vencida) NO se copia: lo calcula src/utils/sustainability.ts en cada build.
- Empresas B del sector turismo y destinos reconocidos (Green Destinations).
- Enlaza cada certificación con su ficha del directorio solo si coincide el nombre exacto
  (sin forma jurídica) o el dominio web. Nada se infiere por parecido.
- Privacidad: solo datos de empresa (nombre, rubro, ciudad, web). Ningún dato de personas.
"""
import datetime as dt
import glob
import json
import os
import re
import sys
import unicodedata

import openpyxl

OUT = 'src/data/sustainability.json'

# Enlaces revisados a mano cuando el nombre de la ficha no coincide exacto con el del Excel.
# Solo con una prueba concreta (mismo dominio web o mismo RUC); anotar cuál.
MANUAL_LINKS = {
    # Ficha "Condor Travel Machupicchu", web condortravel.com (misma marca y dominio).
    'TV-0051': ['condor-travel-machupicchu-machupicchu'],
    'TV-0052': ['condor-travel-machupicchu-machupicchu'],
    # "Explorandes Peru" en Preferred by Nature es la misma empresa que "Explorandes" en B Lab.
    'TV-0030': ['explorandes-lima'],
}


def ascii_lower(s):
    return unicodedata.normalize('NFKD', str(s or '')).encode('ascii', 'ignore').decode().lower()


def norm_name(s):
    s = re.sub(r'\(.*?\)', '', ascii_lower(s))
    s = re.sub(r'\b(s\.?\s?a\.?\s?c\.?|e\.?\s?i\.?\s?r\.?\s?l\.?|s\.?\s?r\.?\s?l\.?(tda)?|s\.?\s?a\.?)\b', '', s)
    return re.sub(r'[^a-z0-9]', '', s)


def domain(u):
    m = re.search(r'(?:https?://)?(?:www\.)?([a-z0-9.-]+\.[a-z]{2,})', str(u or '').lower())
    return m.group(1) if m else ''


def iso(v):
    if isinstance(v, (dt.datetime, dt.date)):
        return v.strftime('%Y-%m-%d')
    return None


def clean(v):
    if v is None:
        return None
    s = str(v).strip()
    return None if s in ('', '—', '-', 'None') else s


def urls(text):
    return re.findall(r'https?://[^\s)·,]+', str(text or ''))


def load_companies():
    out = []
    for f in glob.glob('src/content/companies/*.md'):
        s = open(f, encoding='utf8').read().replace('\r', '')
        title = (re.search(r'^title:\s*(.*)$', s, re.M) or [0, ''])[1].strip().strip('\'"')
        web = (re.search(r'^\s*website:\s*(.*)$', s, re.M) or [0, ''])[1]
        slug = (re.search(r'^slug:\s*(.*)$', s, re.M) or [0, ''])[1].strip()
        fid = os.path.basename(f)[:-3]
        # Solo fichas con página: el nombre de archivo coincide con su slug (ver content-dedupe.mjs).
        if slug and os.path.basename(slug) != fid:
            continue
        out.append((fid, norm_name(title), domain(web)))
    return out


def main(path):
    wb = openpyxl.load_workbook(path, read_only=True, data_only=True)
    companies = load_companies()

    readme = {str(r[0]).strip(): r[1] for r in wb.worksheets[0].iter_rows(values_only=True) if r and r[0] and len(r) > 1}
    verified = iso(readme.get('Fecha de verificación'))

    brows = list(wb['Empresas_B_Peru'].iter_rows(values_only=True))
    bhead = list(brows[0])
    bcorps = []
    for r in brows[1:]:
        rec = dict(zip(bhead, r))
        if not rec.get('Empresa') or str(rec.get('¿Relevante para turismo?') or '').lower() not in ('sí', 'si'):
            continue
        city = clean(rec.get('Ciudad publicada'))
        bcorps.append({
            'name': clean(rec['Empresa']),
            'sector': clean(rec.get('Rubro')),
            'city': None if city and city.startswith('(') else city,
            'website': clean(rec.get('Web')),
        })
    b_domains = {b['name']: domain(b['website']) for b in bcorps if b['website']}

    def match(name):
        k = norm_name(name)
        d = b_domains.get(name, '')
        ids = [fid for fid, nt, dd in companies if (nt and nt == k) or (d and dd == d)]
        return sorted(set(ids))

    rows = list(wb['Certificaciones'].iter_rows(values_only=True))
    head = list(rows[0])
    certs = []
    for r in rows[1:]:
        rec = dict(zip(head, r))
        if not rec.get('Empresa'):
            continue
        src = urls(rec.get('Fuente'))
        certs.append({
            'id': clean(rec['ID']),
            'company': clean(rec['Empresa']),
            'type': clean(rec.get('Tipo')),
            'region': clean(rec.get('Región (destino)')),
            'place': clean(rec.get('Zona / ciudad')),
            'certification': clean(rec.get('Certificación')),
            'level': clean(rec.get('Nivel / puntaje')),
            'certifier': clean(rec.get('Certificadora')),
            'code': clean(rec.get('Código de certificado')),
            'validFrom': iso(rec.get('Válido desde')),
            'validUntil': iso(rec.get('Válido hasta')),
            'sourceStatus': clean(rec.get('Estado según la fuente')),
            'registryStatus': clean(rec.get('Estado TourVerificado')),
            'placeConfidence': clean(rec.get('Confianza del destino')),
            'verifiedAt': iso(rec.get('Última verificación')) or verified,
            'source': src[-1] if src else None,
            'notes': clean(rec.get('Notas')),
            'companyIds': sorted(set(match(rec['Empresa']) + MANUAL_LINKS.get(clean(rec['ID']), []))),
        })

    drows = list(wb['Destinos_Reconocidos'].iter_rows(values_only=True))
    dhead = list(drows[0])
    destinations = []
    for r in drows[1:]:
        rec = dict(zip(dhead, r))
        if not rec.get('Destino') or not rec.get('Organización'):
            continue
        destinations.append({
            'name': clean(rec['Destino']),
            'region': clean(rec.get('Región')),
            'organization': clean(rec.get('Organización')),
            'recognition': clean(rec.get('Reconocimiento')),
            'year': int(rec['Año']) if rec.get('Año') else None,
            'source': clean(rec.get('Fuente')),
        })

    data = {
        'dataset': 'TourVerificado',
        'verifiedAt': verified,
        'certifications': certs,
        'bCorps': bcorps,
        'recognizedDestinations': destinations,
    }
    with open(OUT, 'w', encoding='utf8') as f:
        json.dump(data, f, ensure_ascii=False, indent=1)
    linked = sum(1 for c in certs if c['companyIds'])
    print(f'{len(certs)} certificaciones ({linked} enlazadas a fichas), {len(bcorps)} Empresas B, {len(destinations)} destinos -> {OUT}')


if __name__ == '__main__':
    if len(sys.argv) != 2:
        sys.exit('uso: python scripts/import-tourverificado.py <archivo.xlsx>')
    main(sys.argv[1])
