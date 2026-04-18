const functions = require('firebase-functions');
const admin = require('firebase-admin');
const nodemailer = require('nodemailer');

admin.initializeApp();

// CONFIGURACIÓN DEL CORREO (Usa Gmail o tu servicio preferido)
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'cristianmiguelalvaroespinoza@gmail.com', // Cambia esto por tu correo
    pass: 'wqgecygilluegcvg' // Cambia esto por tu contraseña de aplicación de Google
  }
});

// FUNCIÓN AUTOMÁTICA: Se ejecuta todos los días a las 11:00 AM
exports.envioInformeDiario = functions.pubsub
  .schedule('0 11 * * *')
  .timeZone('America/Lima')
  .onRun(async (context) => {
    try {
      const db = admin.firestore();
      const hoy = new Date();
      const dia = String(hoy.getDate()).padStart(2, '0');
      const mes = String(hoy.getMonth() + 1).padStart(2, '0');
      const anio = hoy.getFullYear();
      const fechaHoy = `${dia}/${mes}/${anio}`;

      // 1. Obtener todos los registros de la base de datos
      const snapshot = await db.collection('inventario').get();
      let laptops = [];
      snapshot.forEach(doc => {
        laptops.push(doc.data());
      });

      // 2. Filtrar laptops enviadas/vendidas hoy
      const enviadasHoy = laptops.filter(l => l.fecha === fechaHoy);

      // 3. Calcular Resúmenes (como en tu imagen)
      const totalRegistradas = laptops.length;
      const lenovos = laptops.filter(l => l.marca.toUpperCase() === 'LENOVO').length;
      const asus = laptops.filter(l => l.marca.toUpperCase() === 'ASUS').length;

      // 4. Generar filas de la tabla de detalles
      let filasTabla = "";
      enviadasHoy.forEach(l => {
        filasTabla += `
          <tr style="border-bottom: 1px solid #ddd; text-align: center;">
            <td style="padding: 10px;">${l.fecha}</td>
            <td style="padding: 10px;">${l.serial || 'S/N'}</td>
            <td style="padding: 10px;">${l.marca} ${l.modelo}</td>
            <td style="padding: 10px;">${l.cliente || 'S/D'}</td>
            <td style="padding: 10px;">${l.destino || 'S/D'}</td>
            <td style="padding: 10px;">${l.categoria || 'NUEVA'}</td>
          </tr>
        `;
      });

      // 5. Diseño del correo (Inspirado en tu imagen)
      const htmlContent = `
        <div style="font-family: Arial, sans-serif; color: #333;">
          <h2 style="text-align: center;">INFORME DIARIO - LEONIDAS STORE</h2>
          <p style="text-align: right; font-weight: bold;">Fecha: ${fechaHoy}</p>
          
          <table border="1" style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
            <tr style="background-color: #f2f2f2;"><td>EQUIPOS INGRESADOS:</td><td style="text-align:center">${totalRegistradas}</td></tr>
            <tr><td>Equipos Registrados Hoy:</td><td style="text-align:center">${enviadasHoy.length}</td></tr>
            <tr style="background-color: #ffff00;"><td>Equipos Enviados Hoy:</td><td style="text-align:center">${enviadasHoy.length}</td></tr>
            <tr><td>Stock Restante (LENOVOS):</td><td style="text-align:center">${lenovos}</td></tr>
            <tr><td>Stock Restante (ASUS):</td><td style="text-align:center">${asus}</td></tr>
          </table>

          <table style="width: 100%; border-collapse: collapse; background-color: #0000FF; color: white;">
            <thead>
              <tr>
                <th style="padding: 10px;">FECHA</th>
                <th style="padding: 10px;">N° SERIE</th>
                <th style="padding: 10px;">MARCA-MODELO</th>
                <th style="padding: 10px;">CLIENTE</th>
                <th style="padding: 10px;">DESTINO</th>
                <th style="padding: 10px;">CATEGORIA</th>
              </tr>
            </thead>
            <tbody style="background-color: white; color: black;">
              ${filasTabla || '<tr><td colspan="6" style="text-align:center; padding:20px;">No hubo movimientos hoy.</td></tr>'}
            </tbody>
          </table>
        </div>
      `;

      const mailOptions = {
        from: 'Leonidas Store Reports <tu-correo@gmail.com>',
        to: 'cristianmiguelalvaroespinoza@gmail.com',
        subject: `INFORME DIARIO - ${fechaHoy}`,
        html: htmlContent
      };

      await transporter.sendMail(mailOptions);
      console.log('Informe enviado con éxito');
      return null;
    } catch (error) {
      console.error('Error al enviar informe:', error);
      return null;
    }
  });