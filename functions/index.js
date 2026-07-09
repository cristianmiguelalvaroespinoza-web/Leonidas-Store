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

// FUNCIÓN AUTOMÁTICA 1: Informe de Tabla Diario (ENVIAR GMAIL TABLA)
// Se ejecuta de Lunes a Sábado a las 10:00 PM (22:00)
exports.envioInformeDiario = functions.pubsub
  .schedule("0 22 * * 1-6")
  .timeZone('America/Lima')
  .onRun(async (context) => {
    try {
      const db = admin.firestore();
      const fechaHoy = new Date().toLocaleDateString("es-PE", {timeZone: "America/Lima"});

      // 1. Obtener todos los registros de la base de datos
      const snapshot = await db.collection('inventario').get();
      const allLaptops = snapshot.docs.map((doc) => doc.data());

      // 2. Filtrar por equipos registrados o vendidos hoy
      const stockItemsToday = allLaptops.filter(
          (l) => l.fecha === fechaHoy && (l.estado || "STOCK").toUpperCase() === "STOCK",
      );
      const soldItemsToday = allLaptops.filter(
          (l) => l.fecha_venta === fechaHoy && l.estado?.toUpperCase() === "VENDIDO",
      );

      if (stockItemsToday.length === 0 && soldItemsToday.length === 0) {
        console.log("No hubo movimientos hoy para el informe de tabla. No se enviará correo.");
        return null;
      }

      // 3. Lógica de agrupación (adaptada de App.jsx)
      const agruparStock = (lista) => {
        const grupos = {};
        lista.forEach((l) => {
          const llave = `${l.marca} ${l.modelo}`.trim().toUpperCase();
          if (!grupos[llave]) grupos[llave] = {...l, cantidad: 0, seriales: []};
          grupos[llave].cantidad += 1;
          if (l.serial) grupos[llave].seriales.push(l.serial);
        });
        return Object.values(grupos).sort((a, b) => a.marca.localeCompare(b.marca));
      };

      const agruparVendidos = (lista) => {
        const grupos = {};
        lista.forEach((l) => {
          const llave = `${l.marca} ${l.modelo}`.trim().toUpperCase();
          if (!grupos[llave]) {
            grupos[llave] = {...l, cantidad: 0, clientes: new Set(), destinos: new Set()};
          }
          grupos[llave].cantidad += 1;
          if (l.cliente) grupos[llave].clientes.add(l.cliente);
          if (l.destino) grupos[llave].destinos.add(l.destino);
        });
        return Object.values(grupos).sort((a, b) => a.marca.localeCompare(b.marca));
      };

      const filasStock = agruparStock(stockItemsToday).map((item) => {
        const marcaModelo = `${item.marca || ""} ${item.modelo || ""}`;
        const serialesListados = item.seriales.join(", ") || "S/N";
        return `<tr style="background-color: #1e293b; color: #e2e8f0;"><td style="padding: 6px; border: 1px solid #334155;">${marcaModelo}</td><td style="padding: 6px; border: 1px solid #334155; font-weight: bold; text-align: center;">${item.cantidad}</td><td style="padding: 6px; border: 1px solid #334155; font-family: monospace; font-size: 10px;">${serialesListados}</td></tr>`;
      }).join("");

      const filasVendidos = agruparVendidos(soldItemsToday).map((item) => {
        const marcaModelo = `${item.marca || ""} ${item.modelo || ""}`;
        const clientes = [...item.clientes].join(", ") || "N/A";
        const destinos = [...item.destinos].join(", ") || "N/A";
        return `<tr style="background-color: #1e293b; color: #e2e8f0;"><td style="padding: 6px; border: 1px solid #334155;">${marcaModelo}</td><td style="padding: 6px; border: 1px solid #334155; font-weight: bold;">${item.cantidad}</td><td style="padding: 6px; border: 1px solid #334155;">${clientes}</td><td style="padding: 6px; border: 1px solid #334155;">${destinos}</td></tr>`;
      }).join("");

      const tablaStockHtml = stockItemsToday.length > 0 ? `<tr><td colspan="7" align="center" style="padding: 10px 0 20px 0; border: none;"><font size="5" color="#00ff7f" style="letter-spacing: 1px;"><b>EQUIPOS EN STOCK (LOTES)</b></font></td></tr><tr><td colspan="7" style="padding: 0; border: none;"><table border="1" cellpadding="6" cellspacing="0" width="100%" style="border-collapse: collapse; border: 1px solid #334155; font-size: 10px; text-align: left; color: #ffffff;"><thead><tr bgcolor="#0f172a"><th width="50%"><font color="#00ff7f">MARCA / MODELO</font></th><th width="10%" style="text-align: center;"><font color="#00ff7f">CANT.</font></th><th width="40%"><font color="#00ff7f">N° DE SERIE(S)</font></th></tr></thead><tbody>${filasStock}</tbody></table></td></tr>` : "";
      const tablaVendidosHtml = soldItemsToday.length > 0 ? `<tr><td colspan="7" style="padding: 20px 0; border: none;"><div style="width: 100%; height: 1px; background: #334155;"></div></td></tr><tr><td colspan="7" align="center" style="padding-bottom: 20px; border: none;"><font size="5" color="#ef4444" style="letter-spacing: 1px;"><b>EQUIPOS VENDIDOS (LOTES)</b></font></td></tr><tr><td colspan="7" style="padding: 0; border: none;"><table border="1" cellpadding="6" cellspacing="0" width="100%" style="border-collapse: collapse; border: 1px solid #334155; font-size: 10px; text-align: center; color: #ffffff;"><thead><tr bgcolor="#0f172a"><th width="40%"><font color="#ef4444">MARCA / MODELO</font></th><th width="10%"><font color="#ef4444">CANT.</font></th><th width="25%"><font color="#ef4444">CLIENTE(S)</font></th><th width="25%"><font color="#ef4444">DESTINO(S)</font></th></tr></thead><tbody>${filasVendidos}</tbody></table></td></tr>` : "";

      // 4. Resumen y envío
      const stockTotal = allLaptops.filter((l) => (l.estado || "STOCK") === "STOCK").length;

      const htmlContent = `
        <html><body style="background-color: #020617; color: #cbd5e1; font-family: Arial, sans-serif; padding: 20px;">
        <table width="100%" border="0" cellspacing="0" cellpadding="0">
          <tr><td align="center"><h1 style="color: #00ff7f;">FINPRO STORE - INFORME DE TABLA</h1></td></tr>
          <tr><td align="right" style="padding-bottom: 20px;"><b>Fecha:</b> ${fechaHoy}</td></tr>
          <tr><td>
            <table border="1" cellpadding="8" cellspacing="0" width="100%" style="border-collapse: collapse; border: 1px solid #334155; font-size: 12px; margin-bottom: 30px;">
              <tr bgcolor="#0f172a"><td style="color: #e2e8f0;">Equipos Registrados Hoy:</td><td align="center" style="color: #e2e8f0;">${stockItemsToday.length}</td></tr>
              <tr bgcolor="#0f172a"><td style="color: #e2e8f0;">Equipos Vendidos Hoy:</td><td align="center" style="color: #e2e8f0;">${soldItemsToday.length}</td></tr>
              <tr bgcolor="#0f172a"><td style="color: #e2e8f0; font-weight: bold;">Stock Total Restante:</td><td align="center" style="color: #00ff7f; font-weight: bold;">${stockTotal}</td></tr>
            </table>
          </td></tr>
          ${tablaStockHtml}
          ${tablaVendidosHtml}
        </table></body></html>`;

      const mailOptions = {
        from: "FINPRO Store Reports <cristianmiguelalvaroespinoza@gmail.com>",
        to: "Percycuentas33@gmail.com, cristianmiguelalvaroespinoza@gmail.com",
        subject: `Informe de Tabla Diario - ${fechaHoy}`,
        html: htmlContent
      };

      await transporter.sendMail(mailOptions);
      console.log('Informe de tabla diario enviado con éxito.');
      return null;
    } catch (error) {
      console.error('Error al enviar informe de tabla:', error);
      return null;
    }
  });

// FUNCIÓN AUTOMÁTICA 2: Informe de Resumen Diario (GMAIL REPORT EXCEL)
// Se ejecuta de Lunes a Sábado a las 10:00 PM (22:00)
exports.envioInformeResumenDiario = functions.pubsub
  .schedule("0 22 * * 1-6")
  .timeZone("America/Lima")
  .onRun(async (context) => {
    try {
      const db = admin.firestore();
      const fechaHoy = new Date().toLocaleDateString("es-PE", {timeZone: "America/Lima"});

      const snapshot = await db.collection("inventario").get();
      const allLaptops = snapshot.docs.map((doc) => doc.data());

      const registradosHoy = allLaptops.filter((lap) => lap.fecha === fechaHoy);
      const vendidosHoy = allLaptops.filter((lap) => lap.estado === "VENDIDO" && lap.fecha_venta === fechaHoy);

      if (registradosHoy.length === 0 && vendidosHoy.length === 0) {
        console.log("No hubo movimientos hoy para el informe de resumen. No se enviará correo.");
        return null;
      }

      // Lógica de cálculo y agrupación de App.jsx
      const totalGanado = vendidosHoy.reduce((acc, curr) => acc + Number(curr.precio || 0), 0);
      const gananciaNeta = vendidosHoy.reduce((acc, curr) => acc + (Number(curr.utilidad) || 0), 0);

      const agruparLotes = (lista, esVenta = false) => {
        const grupos = {};
        lista.forEach((l) => {
          const llave = `${l.marca} ${l.modelo}`.trim().toUpperCase();
          if (!grupos[llave]) {
            grupos[llave] = {cantidad: 0, precio: 0, info: new Set()};
          }
          grupos[llave].cantidad++;
          grupos[llave].precio += Number(l.precio || 0);
          if (esVenta) {
            if (l.cliente) grupos[llave].info.add(l.cliente);
          } else {
            if (l.responsable) grupos[llave].info.add(l.responsable);
          }
        });
        return Object.keys(grupos).sort().map((nombre) => {
          const data = grupos[nombre];
          const cantidadStr = data.cantidad > 1 ? ` <b>(${data.cantidad})</b>` : "";
          const infoStr = [...data.info].join(", ");
          if (esVenta) {
            return `• ${nombre}${cantidadStr} - S/ ${data.precio.toFixed(2)}${infoStr ? ` | ${infoStr}` : ""}`;
          } else {
            return `• ${nombre}${cantidadStr}${infoStr ? ` | Reg: ${infoStr}` : ""}`;
          }
        }).join("<br/>");
      };

      const listaIngresos = registradosHoy.length > 0 ? agruparLotes(registradosHoy) : "Sin ingresos hoy.";
      const listaVentas = vendidosHoy.length > 0 ? agruparLotes(vendidosHoy, true) : "Sin ventas hoy.";
      const stockTotal = allLaptops.filter((l) => (l.estado || "STOCK").toUpperCase() === "STOCK").length;

      const htmlContent = `
        <div style="font-family: Arial, sans-serif; background-color: #0f172a; color: #e2e8f0; padding: 20px; border-radius: 10px;">
          <h2 style="color: #00ff7f;">Resumen Diario - FINPRO Store</h2>
          <p><b>Fecha:</b> ${fechaHoy}</p>
          <div style="background-color: #1e293b; padding: 15px; border-radius: 8px; margin-bottom: 15px;">
            <p><b>Total Vendido:</b> <span style="color: #60a5fa; font-weight: bold;">S/ ${totalGanado.toFixed(2)}</span></p>
            <p><b>Ganancia Neta:</b> <span style="color: #00ff7f; font-weight: bold;">S/ ${gananciaNeta.toFixed(2)}</span></p>
            <p><b>Equipos Registrados:</b> ${registradosHoy.length}</p>
            <p><b>Equipos Vendidos:</b> ${vendidosHoy.length}</p>
            <p><b>Stock Total Actual:</b> ${stockTotal}</p>
          </div>
          <h3 style="color: #00ff7f; border-top: 1px solid #334155; padding-top: 15px;">Detalle de Ingresos:</h3>
          <div style="background-color: #1e293b; padding: 15px; border-radius: 8px; margin-bottom: 15px; font-size: 14px;">${listaIngresos}</div>
          <h3 style="color: #00ff7f;">Detalle de Ventas:</h3>
          <div style="background-color: #1e293b; padding: 15px; border-radius: 8px; font-size: 14px;">${listaVentas}</div>
        </div>`;

      const mailOptions = {
        from: "FINPRO Store Reports <cristianmiguelalvaroespinoza@gmail.com>",
        to: "Percycuentas33@gmail.com, cristianmiguelalvaroespinoza@gmail.com",
        subject: `Resumen de Operaciones - ${fechaHoy}`,
        html: htmlContent,
      };

      await transporter.sendMail(mailOptions);
      console.log("Informe de resumen diario enviado con éxito.");
      return null;
    } catch (error) {
      console.error("Error al enviar informe de resumen:", error);
      return null;
    }
  });