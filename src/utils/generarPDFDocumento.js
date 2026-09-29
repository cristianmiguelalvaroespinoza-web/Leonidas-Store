import { jsPDF } from "jspdf";
import html2canvas from "html2canvas";

/**
 * MÁRGENES DE IMPRESIÓN DEL DOCUMENTO (BOLETA / NOTA DE VENTA / GUÍA).
 * Deben coincidir con el @page de VentasView.css:
 *   @page { size: A4; margin: 10mm 12mm 10mm 12mm; }
 * Así el PDF generado y la impresión del navegador usan la misma caja imprimible
 * y el membrete (logo + N° de documento) nunca toca el borde del papel.
 */
export const MARGEN_LATERAL_MM = 12;
export const MARGEN_SUPERIOR_MM = 10;

/**
 * Genera un PDF A4 a partir de un elemento del DOM (html2canvas + jsPDF).
 *
 * Antes el documento se insertaba como UNA sola imagen: en lotes grandes
 * (7+ equipos con especificaciones extensas) la altura superaba la hoja A4 y
 * el contenido inferior se perdía (corte brusco). Ahora, si no cabe, el
 * documento se reparte en varias páginas en franjas consecutivas, respetando
 * la escala original y los márgenes de impresión.
 *
 * @param {HTMLElement} elemento      Nodo del documento a capturar.
 * @param {object}      opciones
 * @param {string}      opciones.nombreArchivo  Nombre con el que se descarga.
 * @param {number}      [opciones.escala=2]     Escala de renderizado del canvas.
 * @param {number}      [opciones.anchoRender=800] Ancho de render (px).
 * @returns {Promise<number>} Cantidad de páginas generadas.
 */
export const generarPDFDesdeElemento = async (elemento, opciones = {}) => {
  const {
    nombreArchivo,
    escala = 2,
    anchoRender = 800
  } = opciones;

  if (!elemento) return 0;
  if (!nombreArchivo) throw new Error("generarPDFDesdeElemento: falta 'nombreArchivo'.");

  const canvas = await html2canvas(elemento, {
    scale: escala,
    useCORS: true,
    backgroundColor: "#ffffff",
    windowWidth: anchoRender
  });

  if (!canvas || !canvas.width || !canvas.height) return 0;

  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

  const pageWidth = pdf.internal.pageSize.getWidth();   // 210 mm
  const pageHeight = pdf.internal.pageSize.getHeight(); // 297 mm

  // Caja imprimible respetando los márgenes @page
  const anchoUtil = pageWidth - MARGEN_LATERAL_MM * 2;                          // 186 mm
  const altoUtilPrimera = pageHeight - MARGEN_LATERAL_MM - MARGEN_SUPERIOR_MM;  // 275 mm
  const altoUtilContinuacion = pageHeight - MARGEN_LATERAL_MM * 2;              // 273 mm

  // Escala única (mm por píxel): mantiene la proporción del documento en todas las páginas
  const escalaMmPorPx = anchoUtil / canvas.width;
  const altoTotalMm = canvas.height * escalaMmPorPx;

  // --- Caso 1: el documento completo entra en una sola hoja ---
  if (altoTotalMm <= altoUtilPrimera) {
    pdf.addImage(
      canvas.toDataURL("image/png"),
      "PNG",
      MARGEN_LATERAL_MM,
      MARGEN_SUPERIOR_MM,
      anchoUtil,
      altoTotalMm
    );
    pdf.save(nombreArchivo);
    return 1;
  }

  // --- Caso 2: documento largo -> franjas consecutivas, una por página ---
  const pxPorMm = 1 / escalaMmPorPx;
  let yPxOrigen = 0;
  let esPrimeraPagina = true;
  let paginas = 0;

  while (yPxOrigen < canvas.height - 0.5) {
    const altoDisponibleMm = esPrimeraPagina ? altoUtilPrimera : altoUtilContinuacion;
    const altoFranjaPx = Math.min(altoDisponibleMm * pxPorMm, canvas.height - yPxOrigen);

    if (altoFranjaPx > 0.5) {
      const altoLienzoPx = Math.max(1, Math.round(altoFranjaPx));

      const franja = document.createElement("canvas");
      franja.width = canvas.width;
      franja.height = altoLienzoPx;

      const ctx = franja.getContext("2d");
      // Fondo blanco: la última franja no debe quedar transparente
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, franja.width, franja.height);
      ctx.drawImage(
        canvas,
        0, yPxOrigen, canvas.width, altoFranjaPx, // recorte de origen
        0, 0, canvas.width, altoFranjaPx          // destino 1:1
      );

      if (!esPrimeraPagina) pdf.addPage();

      pdf.addImage(
        franja.toDataURL("image/png"),
        "PNG",
        MARGEN_LATERAL_MM,
        esPrimeraPagina ? MARGEN_SUPERIOR_MM : MARGEN_LATERAL_MM,
        anchoUtil,
        altoLienzoPx * escalaMmPorPx
      );

      paginas += 1;
    }

    yPxOrigen += altoFranjaPx;
    esPrimeraPagina = false;
  }

  pdf.save(nombreArchivo);
  return paginas;
};