"""Crea una ficha del directorio para cada empresa con certificación vigente de la base
TourVerificado que todavía no tiene ficha (fichas de origen MINCETUR).

Uso: python scripts/create-certified-profiles.py

- Solo datos publicados por la certificadora o por la propia empresa en su catálogo
  (Empresas B): nombre, tipo, ciudad y web. Sin RUC ni dirección: no se inventan.
- La ficha se enlaza a sus certificaciones por nombre exacto en import-tourverificado.py,
  así que el título debe coincidir con la columna Empresa del Excel (sin forma jurídica).
- No sobrescribe fichas existentes.
"""
import os

DIR = 'src/content/companies'

# (archivo, título, rol, tipo en inglés para el summary, ciudad, región, destinos, web)
PROFILES = [
    ('gocta-andes-lodge-cocachimba', 'Gocta Andes Lodge', 'lodging', 'Lodge', 'Cocachimba', 'Amazonas', ['chachapoyas'], None),
    ('gocta-natura-reserve-gocta', 'Gocta Natura Reserve', 'lodging', 'Ecolodge', 'Gocta', 'Amazonas', ['chachapoyas'], 'https://goctanaturareserve.com'),
    ('colca-lodge-spa-hot-springs-colca', 'Colca Lodge Spa & Hot Springs', 'lodging', 'Lodge', 'Valle del Colca', 'Arequipa', ['colca'], None),
    ('amazonas-explorer-cusco', 'Amazonas Explorer', 'tour_operator', 'Adventure tour operator', 'Cusco', 'Cusco', ['cusco'], 'https://amazonas-explorer.com'),
    ('antigua-casona-san-blas-cusco', 'Antigua Casona San Blas', 'lodging', 'Hotel', 'Cusco', 'Cusco', ['cusco'], 'https://antiguacusco.com'),
    ('cock-of-the-rock-lodge-kosnipata', 'Cock of the Rock Lodge', 'lodging', 'Lodge', 'Kosñipata', 'Cusco', ['manu'], None),
    ('explorandes-lima', 'Explorandes', 'tour_operator', 'Adventure tour operator', 'Lima', 'Lima', ['cusco', 'lima'], 'https://explorandes.com'),
    ('explorandino-cusco', 'Explorandino', 'tour_operator', 'Tour operator', 'Cusco', 'Cusco', ['cusco'], None),
    ('inca-peru-travel-cusco', 'Inca Peru Travel', 'tour_operator', 'Tour operator', 'Cusco', 'Cusco', ['cusco'], None),
    ('kawsaypaq-pisac-inn-pisac', 'Kawsaypaq - Pisac Inn', 'lodging', 'Inn', 'Pisac', 'Cusco', ['cusco'], None),
    ('terres-magiques-des-incas-cusco', 'Terres Magiques des Incas', 'tour_operator', 'Inbound travel agency', 'Cusco', 'Cusco', ['cusco'], None),
    ('intrepid-travel-lima', 'Intrepid Travel', 'tour_operator', 'Global tour operator', 'Lima', 'Lima', ['lima'], 'https://intrepidtravel.com'),
    ('nassf-travel-lima', 'Nassf Travel', 'tour_operator', 'Inbound tour operator', 'Lima', 'Lima', ['lima'], 'https://nassftravel.com'),
    ('vamos-expeditions-lima', 'Vamos Expeditions', 'tour_operator', 'Inbound tour operator', 'Lima', 'Lima', ['lima'], 'https://vamosexpeditions.com'),
    ('pumarinri-amazon-lodge-shapaja', 'Pumarinri Amazon Lodge', 'lodging', 'Lodge', 'Shapaja', 'San Martín', ['tarapoto'], None),
    ('peruvian-sacred-adventure-peru', 'Peruvian Sacred & Adventure', 'tour_operator', 'Adventure tour operator', None, None, [], None),
    ('puku-puku-travel-peru', 'Puku Puku Travel', 'tour_operator', 'Trekking tour operator', None, None, [], None),
]


def q(s):
    return "'" + s.replace("'", "''") + "'"


def main():
    made = 0
    for fid, title, role, kind, city, region, destinos, web in PROFILES:
        path = os.path.join(DIR, fid + '.md')
        if os.path.exists(path):
            continue
        where = ', '.join(x for x in (city, region, 'Peru') if x)
        lines = ['---', 'type: company', f'slug: /company/{fid}', f'title: {q(title)}',
                 f'summary: {q(f"{kind} based in {where}.")}']
        if web:
            lines += ['contact:', f'  website: {web}']
        if city or region:
            lines += ['location:'] + ([f'  city: {q(city)}'] if city else []) + ([f'  region: {q(region)}'] if region else []) + ['  country: Peru']
        if destinos:
            lines += ['destinos:'] + [f'- {d}' for d in destinos]
        lines += [f'distribution_role: {role}', 'profile_source: tourverificado', '---', '', f'# {title}', '']
        with open(path, 'w', encoding='utf8') as f:
            f.write('\n'.join(lines))
        made += 1
    print(f'{made} fichas creadas en {DIR}')


if __name__ == '__main__':
    main()
