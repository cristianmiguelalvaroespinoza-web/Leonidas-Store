import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import emailjs from '@emailjs/browser';

/**
 * Genera el documento PDF (Actualizado con registradosHoy dinámico)
 */
export const generarPDFInforme = (laptops) => {
  const doc = new jsPDF();
  const hoy = new Date();
  const hoyString = hoy.toLocaleDateString('es-ES');
  
  const fechaTextoRaw = hoy.toLocaleDateString('es-ES', { 
    weekday: 'short', year: 'numeric', month: '2-digit', day: '2-digit' 
  }).replace('.', '');
  const fechaTexto = fechaTextoRaw.charAt(0).toUpperCase() + fechaTextoRaw.slice(1);

  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text(fechaTexto, 15, 15);
  doc.setFontSize(18);
  doc.text("INFORME DIARIO", 105, 30, { align: "center" });

  // Cálculos
  const totalIngresados = laptops.length;
  const enviadosHoy = laptops.filter(l => l.estado === 'VENDIDO').length;
  const registradosHoy = laptops.filter(l => l.fecha === hoyString).length; // <--- Dinámico
  const stockLenovo = laptops.filter(l => l.marca?.toUpperCase().includes('LENOVO')).length;
  const stockAsus = laptops.filter(l => l.marca?.toUpperCase().includes('ASUS')).length;

  autoTable(doc, {
    startY: 40,
    margin: { right: 100 }, 
    theme: 'grid',
    styles: { fontSize: 9, fontStyle: 'bold', textColor: [0, 0, 0], lineColor: [0, 0, 0], lineWidth: 0.2 },
    body: [
      ['EQUIPOS INGRESADOS:', totalIngresados],
      ['Equipos Registrados Hoy:', registradosHoy], // <--- Ahora muestra el valor real
      ['Equipos Envíados Hoy:', enviadosHoy],
      [`Stock Restante (LENOVOS):`, stockLenovo],
      [`Stock Restante (ASUS):`, stockAsus],
      ['Stock Restante TOTAL:', totalIngresados - enviadosHoy]
    ],
    columnStyles: { 1: { halign: 'center' } },
    didParseCell: (data) => {
      if ((data.row.index === 2 || data.row.index === 5) && data.column.index === 1) {
          data.cell.styles.fillColor = [255, 255, 0];
      }
    }
  });

  const xCuadro = 135;
  const yCuadro = 40;
  doc.setDrawColor(0);
  doc.rect(xCuadro, yCuadro, 45, 18);
  doc.setFontSize(10);
  doc.text("N° Pedidos:", xCuadro + 22.5, yCuadro + 7, { align: 'center' });
  doc.setFillColor(0, 0, 0);
  doc.rect(xCuadro, yCuadro + 10, 45, 8, 'F');
  doc.setTextColor(255, 255, 255);
  doc.text(enviadosHoy.toString(), xCuadro + 22.5, yCuadro + 16, { align: 'center' }); 
  doc.setTextColor(0, 0, 0);

  const columns = ["FECHA", "N° SERIE", "MARCA - MODELO", "CLIENTE", "DESTINO", "CATEGORÍA"];
  const rows = laptops.map(l => [
    l.fecha || hoy.toLocaleDateString(),
    l.serie || l.serial || '-',
    `${l.marca || ''} - ${l.modelo || ''}`,
    l.cliente || '-',
    l.destino || '-',
    "NUEVA"
  ]);

  autoTable(doc, {
    startY: 85,
    head: [columns],
    body: rows,
    theme: 'plain',
    headStyles: { fillColor: [0, 0, 0], textColor: [255, 255, 255], halign: 'center', fontSize: 8 },
    styles: { fontSize: 7, halign: 'center', lineColor: [200, 200, 200], lineWidth: 0.1 },
    columnStyles: { 2: { halign: 'left' } }
  });

  return doc;
};

/**
 * Envío de informe por EmailJS (100% Gratuito y Dinámico)
 */
export const enviarInformeGmailPDF = async (laptops, usuario) => {
  try {
    const hoy = new Date();
    const hoyString = hoy.toLocaleDateString('es-ES'); 
    
    const totalIngresados = laptops.length;
    const enviadosHoy = laptops.filter(l => l.estado === 'VENDIDO').length;
    const registradosHoy = laptops.filter(l => l.fecha === hoyString).length; 
    const stockLenovo = laptops.filter(l => l.marca?.toUpperCase().includes('LENOVO')).length;
    const stockAsus = laptops.filter(l => l.marca?.toUpperCase().includes('ASUS')).length;

    const tablaHtml = laptops.map(l => `
      <tr style="text-align: center;">
        <td style="border: 1px solid #000; padding: 5px;">${l.fecha || hoy.toLocaleDateString()}</td>
        <td style="border: 1px solid #000; padding: 5px;">${l.serie || l.serial || '-'}</td>
        <td style="border: 1px solid #000; padding: 5px; text-align: left;">${l.marca} - ${l.modelo}</td>
        <td style="border: 1px solid #000; padding: 5px;">${l.cliente || '-'}</td>
        <td style="border: 1px solid #000; padding: 5px;">${l.destino || '-'}</td>
        <td style="border: 1px solid #000; padding: 5px;">NUEVA</td>
      </tr>
    `).join('');

    const templateParams = {
      subject_date: hoy.toLocaleDateString('es-ES', { weekday: 'short', year: 'numeric', month: '2-digit', day: '2-digit' }).replace('.', ''),
      total_ingresados: totalIngresados,
      registrados_hoy: registradosHoy, 
      enviados_hoy: enviadosHoy,
      stock_lenovo: stockLenovo,
      stock_asus: stockAsus,
      stock_total: totalIngresados - enviadosHoy,
      num_pedidos: enviadosHoy, // Sincronizado con enviados hoy
      tabla_html: tablaHtml,
      from_name: usuario
    };

    const response = await emailjs.send(
      'service_5aye42e', 
      'template_k83jrub', 
      templateParams,
      'LYMd0YBJQ-9sBWLxQ'
    );

    return response;
  } catch (error) {
    console.error("Error al enviar el informe:", error);
    throw error;
  }
};