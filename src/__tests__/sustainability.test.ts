import { describe, it, expect } from 'vitest';
import {
  certCode,
  certStatus,
  certificationsForCompany,
  currentCertifications,
  destinationForRecognized,
  recognitionsFor,
  type Certification,
} from '../utils/sustainability';
import data from '../data/sustainability.json';

const today = new Date('2026-09-29T12:00:00Z');
const base: Certification = {
  id: 'x', company: 'X', type: null, region: 'Cusco', place: null, certification: 'TourCert Certification',
  level: null, certifier: null, code: null, validFrom: null, validUntil: null, sourceStatus: null,
  registryStatus: null, placeConfidence: null, verifiedAt: null, source: null, notes: null, companyIds: [],
};

describe('certStatus', () => {
  it('calcula el estado con la fecha de fin, no con el estado copiado del Excel', () => {
    expect(certStatus({ validUntil: '2027-12-13', registryStatus: 'Vigente' }, today)).toBe('valid');
    expect(certStatus({ validUntil: '2026-12-31', registryStatus: 'Vigente' }, today)).toBe('expiring');
    expect(certStatus({ validUntil: '2025-01-01', registryStatus: 'Vigente' }, today)).toBe('expired');
  });

  it('una certificación terminada por la certificadora no es vigente aunque tenga fecha futura', () => {
    expect(certStatus({ validUntil: '2028-01-01', registryStatus: 'Terminada' }, today)).toBe('terminated');
  });

  it('sin fecha: solo "Vigente sin fecha publicada" cuenta como vigente', () => {
    expect(certStatus({ validUntil: null, registryStatus: 'Vigente sin fecha publicada' }, today)).toBe('valid-undated');
    expect(certStatus({ validUntil: null, registryStatus: 'No certificada' }, today)).toBe('not-certified');
    expect(certStatus({ validUntil: null, registryStatus: 'Solo formación' }, today)).toBe('not-certified');
    expect(certStatus({ validUntil: null, registryStatus: 'Por verificar' }, today)).toBe('not-certified');
  });
});

describe('certificaciones vigentes', () => {
  it('filtra las no vigentes', () => {
    const list = currentCertifications(
      [
        { ...base, id: 'a', validUntil: '2027-06-01' },
        { ...base, id: 'b', registryStatus: 'Terminada', validUntil: '2027-06-01' },
        { ...base, id: 'c', registryStatus: 'No certificada' },
      ],
      today,
    );
    expect(list.map((c) => c.id)).toEqual(['a']);
  });

  it('una ficha solo muestra certificaciones vigentes, nunca las vencidas o no certificadas', () => {
    const all = [
      { ...base, id: 'a', companyIds: ['arawi'], registryStatus: 'No certificada' },
      { ...base, id: 'b', companyIds: ['coltur'], validUntil: '2027-06-01' },
    ];
    expect(certificationsForCompany(all, 'arawi.md', today)).toEqual([]);
    expect(certificationsForCompany(all, 'coltur', today).map((c) => c.id)).toEqual(['b']);
  });

  it('los datos importados tienen fuente y fecha de verificación', () => {
    const certs = data.certifications as Certification[];
    expect(certs.length).toBeGreaterThan(0);
    expect(certs.every((c) => c.verifiedAt)).toBe(true);
    expect(currentCertifications(certs, today).every((c) => c.source?.startsWith('http'))).toBe(true);
  });
});

describe('fichas con certificación', () => {
  it('Condor Travel muestra su certificación vigente de Preferred by Nature', () => {
    const list = certificationsForCompany(data.certifications as Certification[], 'condor-travel-machupicchu-machupicchu', today);
    expect(list.map((c) => c.code)).toEqual(['PBN-TO-064762']);
  });

  it('toda certificación vigente tiene ficha en el directorio', () => {
    const sinFicha = currentCertifications(data.certifications as Certification[], today).filter((c) => c.companyIds.length === 0);
    expect(sinFicha.map((c) => c.company)).toEqual([]);
  });

  it('una ficha creada por su certificación también lista las terminadas', () => {
    const all = data.certifications as Certification[];
    expect(certificationsForCompany(all, 'explorandes-lima', today).map((c) => c.id)).toEqual(['TV-0029']);
    expect(certificationsForCompany(all, 'explorandes-lima', today, true).map((c) => c.id)).toEqual(['TV-0029', 'TV-0030']);
  });

  it('el código solo se muestra si está completo', () => {
    expect(certCode({ code: 'PBN-TO-064762' })).toBe('PBN-TO-064762');
    expect(certCode({ code: 'RA-TO- (código incompleto en la fuente)' })).toBeNull();
    expect(certCode({ code: null })).toBeNull();
  });
});

describe('destinos reconocidos', () => {
  it('enlaza solo lugares que están en un destino del sitio', () => {
    expect(destinationForRecognized('Kuélap - Gocta')).toBe('chachapoyas');
    expect(destinationForRecognized('Reserva Nacional Tambopata')).toBe('puerto_maldonado');
    expect(destinationForRecognized('Parque Nacional Tingo María')).toBeNull();
  });

  it('Titicaca y Colca tienen su reconocimiento', () => {
    expect(recognitionsFor(data.recognizedDestinations as any, 'puno').length).toBeGreaterThan(0);
    expect(recognitionsFor(data.recognizedDestinations as any, 'colca').length).toBeGreaterThan(0);
  });
});
