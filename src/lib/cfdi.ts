import crypto from 'crypto';

// Catálogos Oficiales del SAT para CFDI 4.0
export const TAX_REGIMES = [
  { code: '601', name: '601 - General de Ley Personas Morales' },
  { code: '603', name: '603 - Personas Morales con Fines no Lucrativos' },
  { code: '605', name: '605 - Sueldos y Salarios e Ingresos Asimilados a Salarios' },
  { code: '606', name: '606 - Arrendamiento' },
  { code: '612', name: '612 - Personas Físicas con Actividades Empresariales y Profesionales' },
  { code: '616', name: '616 - Sin obligaciones fiscales' },
  { code: '621', name: '621 - Incorporación Fiscal' },
  { code: '625', name: '625 - Régimen de las Actividades Empresariales con ingresos a través de Plataformas Tecnológicas' },
  { code: '626', name: '626 - Régimen Simplificado de Confianza (RESICO)' },
];

export const CFDI_USAGES = [
  { code: 'G01', name: 'G01 - Adquisición de mercancías' },
  { code: 'G03', name: 'G03 - Gastos en general' },
  { code: 'I01', name: 'I01 - Construcciones' },
  { code: 'D01', name: 'D01 - Honorarios médicos, dentales y gastos hospitalarios' },
  { code: 'S01', name: 'S01 - Sin efectos fiscales' },
  { code: 'CP01', name: 'CP01 - Pagos' },
];

export const PAYMENT_METHODS = [
  { code: 'PUE', name: 'PUE - Pago en una sola exhibición' },
  { code: 'PPD', name: 'PPD - Pago en parcialidades o diferido' },
];

export const PAYMENT_FORMS = [
  { code: '01', name: '01 - Efectivo' },
  { code: '02', name: '02 - Cheque nominativo' },
  { code: '03', name: '03 - Transferencia electrónica de fondos' },
  { code: '04', name: '04 - Tarjeta de crédito' },
  { code: '28', name: '28 - Tarjeta de débito' },
  { code: '99', name: '99 - Por definir' },
];

/**
 * Valida si un RFC mexicano tiene la estructura reglamentaria del SAT
 * Persona Física: 4 letras + 6 dígitos fecha + 3 homoclave = 13 caracteres
 * Persona Moral: 3 letras + 6 dígitos fecha + 3 homoclave = 12 caracteres
 * Genérico Nacional: XAXX010101000
 * Genérico Extranjero: XEXX010101000
 */
export function validateRfc(rfc: string): boolean {
  if (!rfc) return false;
  const cleanRfc = rfc.trim().toUpperCase();
  const rfcRegex = /^[A-Z&Ñ]{3,4}\d{6}[A-Z\d]{3}$/;
  return rfcRegex.test(cleanRfc);
}

export interface EmisorFiscal {
  rfc: string;
  nombre: string;
  regimenFiscal: string;
  codigoPostal: string;
}

export interface ReceptorFiscal {
  rfc: string;
  nombre: string;
  codigoPostal: string;
  regimenFiscal: string;
  usoCfdi: string;
  email?: string | null;
}

export interface ConceptoFiscal {
  claveProdServ?: string;
  claveUnidad?: string;
  unidad?: string;
  descripcion: string;
  cantidad: number;
  valorUnitario: number;
  importe: number;
  descuento?: number;
  baseIva: number;
  importeIva: number;
}

export interface ComprobanteParams {
  serie?: string;
  folio: number;
  emisor: EmisorFiscal;
  receptor: ReceptorFiscal;
  conceptos: ConceptoFiscal[];
  formaPago?: string;
  metodoPago?: string;
  subtotal: number;
  descuento?: number;
  iva: number;
  total: number;
}

export interface TimbreFiscalResult {
  uuid: string;
  fechaEmision: string;
  fechaTimbrado: string;
  noCertificadoEmisor: string;
  noCertificadoSat: string;
  selloDigital: string;
  selloSat: string;
  cadenaOriginalSat: string;
  qrSatUrl: string;
  xmlContent: string;
}

/**
 * Genera el XML estructurado en versión CFDI 4.0 conforme al Anexo 20 del SAT
 * y realiza el timbrado digital con sellos criptográficos.
 */
export function generateCfdi40(params: ComprobanteParams): TimbreFiscalResult {
  const uuid = crypto.randomUUID().toUpperCase();
  const now = new Date();
  const fechaIso = now.toISOString().slice(0, 19);

  const noCertificadoEmisor = '30001000000500003415';
  const noCertificadoSat = '30001000000500003416';
  const rfcProvCertif = 'SAT970701NN3';

  const formaPago = params.formaPago || '01';
  const metodoPago = params.metodoPago || 'PUE';
  const serie = params.serie || 'FAC';

  // Format currency values with 2 decimals
  const subtotalStr = params.subtotal.toFixed(2);
  const totalStr = params.total.toFixed(2);
  const ivaStr = params.iva.toFixed(2);
  const descStr = (params.descuento || 0).toFixed(2);

  // Generate fake/sandbox cryptographic signature for CFD
  const preDigest = `${params.emisor.rfc}|${params.receptor.rfc}|${subtotalStr}|${totalStr}|${fechaIso}`;
  const selloDigital = crypto.createHash('sha256').update(preDigest + uuid).digest('base64');
  const selloSat = crypto.createHash('sha256').update(selloDigital + noCertificadoSat).digest('base64');

  // Cadena Original del Complemento de Certificación Digital del SAT
  const cadenaOriginalSat = `||1.1|${uuid}|${fechaIso}|${rfcProvCertif}|${selloDigital}|${noCertificadoSat}||`;

  // Construcción de la URL de verificación QR del SAT
  const selloEnd8 = selloDigital.slice(-8);
  const qrSatUrl = `https://verificacfdi.facturaelectronica.sat.gob.mx/default.aspx?id=${uuid}&re=${encodeURIComponent(
    params.emisor.rfc
  )}&rr=${encodeURIComponent(params.receptor.rfc)}&tt=${totalStr}&fe=${encodeURIComponent(selloEnd8)}`;

  // Construcción de los nodos XML Conceptos
  const conceptosXml = params.conceptos
    .map((c) => {
      const cSub = c.importe.toFixed(2);
      const cVal = c.valorUnitario.toFixed(2);
      const cIva = c.importeIva.toFixed(2);
      const cBase = c.baseIva.toFixed(2);
      const claveProd = c.claveProdServ || '90101503';
      const claveUni = c.claveUnidad || 'E48';
      const uni = c.unidad || 'Servicio';

      return `    <cfdi:Concepto ClaveProdServ="${claveProd}" Cantidad="${c.cantidad.toFixed(2)}" ClaveUnidad="${claveUni}" Unidad="${uni}" Descripcion="${escapeXml(
        c.descripcion
      )}" ValorUnitario="${cVal}" Importe="${cSub}" ObjetoImp="02">
      <cfdi:Impuestos>
        <cfdi:Traslados>
          <cfdi:Traslado Base="${cBase}" Impuesto="002" TipoFactor="Tasa" TasaOCuota="0.160000" Importe="${cIva}" />
        </cfdi:Traslados>
      </cfdi:Impuestos>
    </cfdi:Concepto>`;
    })
    .join('\n');

  // XML Completo CFDI 4.0 con TimbreFiscalDigital
  const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<cfdi:Comprobante xmlns:cfdi="http://www.sat.gob.mx/cfd/4" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:tfd="http://www.sat.gob.mx/TimbreFiscalDigital" xsi:schemaLocation="http://www.sat.gob.mx/cfd/4 http://www.sat.gob.mx/sitio_internet/cfd/4/cfdv40.xsd http://www.sat.gob.mx/TimbreFiscalDigital http://www.sat.gob.mx/sitio_internet/cfd/TimbreFiscalDigital/TimbreFiscalDigitalv11.xsd" Version="4.0" Serie="${serie}" Folio="${params.folio}" Fecha="${fechaIso}" Sello="${selloDigital}" FormaPago="${formaPago}" NoCertificado="${noCertificadoEmisor}" Certificado="${noCertificadoEmisor}" SubTotal="${subtotalStr}" Descuento="${descStr}" Moneda="MXN" Total="${totalStr}" TipoDeComprobante="I" Exportacion="01" MetodoPago="${metodoPago}" LugarExpedicion="${params.emisor.codigoPostal}">
  <cfdi:Emisor Rfc="${params.emisor.rfc.toUpperCase()}" Nombre="${escapeXml(params.emisor.nombre.toUpperCase())}" RegimenFiscal="${params.emisor.regimenFiscal}" />
  <cfdi:Receptor Rfc="${params.receptor.rfc.toUpperCase()}" Nombre="${escapeXml(params.receptor.nombre.toUpperCase())}" DomicilioFiscalReceptor="${params.receptor.codigoPostal}" RegimenFiscalReceptor="${params.receptor.regimenFiscal}" UsoCFDI="${params.receptor.usoCfdi}" />
  <cfdi:Conceptos>
${conceptosXml}
  </cfdi:Conceptos>
  <cfdi:Impuestos TotalImpuestosTrasladados="${ivaStr}">
    <cfdi:Traslados>
      <cfdi:Traslado Base="${subtotalStr}" Impuesto="002" TipoFactor="Tasa" TasaOCuota="0.160000" Importe="${ivaStr}" />
    </cfdi:Traslados>
  </cfdi:Impuestos>
  <cfdi:Complemento>
    <tfd:TimbreFiscalDigital Version="1.1" UUID="${uuid}" FechaTimbrado="${fechaIso}" RfcProvCertif="${rfcProvCertif}" SelloCFD="${selloDigital}" NoCertificadoSAT="${noCertificadoSat}" SelloSAT="${selloSat}" />
  </cfdi:Complemento>
</cfdi:Comprobante>`;

  return {
    uuid,
    fechaEmision: fechaIso,
    fechaTimbrado: fechaIso,
    noCertificadoEmisor,
    noCertificadoSat,
    selloDigital,
    selloSat,
    cadenaOriginalSat,
    qrSatUrl,
    xmlContent,
  };
}

function escapeXml(unsafe: string): string {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
