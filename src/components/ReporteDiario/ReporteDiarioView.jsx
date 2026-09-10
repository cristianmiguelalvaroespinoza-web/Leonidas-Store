import React, { useState, useMemo } from 'react';
import { DollarSign, Package, TrendingUp, Calendar, Printer } from 'lucide-react';
import styles from './ReporteDiarioView.module.css';
// --- NUEVO: Imports para el gráfico ---
import { Pie } from 'react-chartjs-2';
import { Chart as ChartJS, ArcElement, Tooltip, Legend, Title } from 'chart.js';

// --- NUEVO: Registrar los componentes del gráfico ---
ChartJS.register(ArcElement, Tooltip, Legend, Title);

// Componente para una tarjeta de estadística
const StatCard = ({ icon, title, value, color }) => (
  <div className={styles.statCard} style={{ '--card-color': color }}>
    <div className={styles.cardIcon}>{icon}</div>
    <div className={styles.cardInfo}>
      <span className={styles.cardTitle}>{title}</span>
      <span className={styles.cardValue}>{value}</span>
    </div>
  </div>
);

// Componente para la tabla de laptops
const LaptopsTable = ({ title, laptops, esVenta = false, tienePermisoFinanzas }) => (
  <div className={styles.tableContainer}>
    <h3 className={styles.tableTitle}>{title} ({laptops.length})</h3>
    <div className={styles.tableWrapper}>
      <table className={styles.reportTable}>
        <thead>
          <tr>
            <th>#</th>
            <th>Equipo</th>
            {esVenta && <th>Cliente</th>}
            <th>Especificaciones</th>
            <th>Serial</th>
            {esVenta && tienePermisoFinanzas && <th>Costo</th>}
            {esVenta && <th>Precio Venta</th>}
            {esVenta && tienePermisoFinanzas && <th>Utilidad</th>}
            <th>Registrado Por</th>
          </tr>
        </thead>
        <tbody>
          {laptops.length > 0 ? (
            laptops.map((lap, index) => (
              <tr key={lap.fireId || index}>
                <td>{index + 1}</td>
                <td>{lap.marca} {lap.modelo}</td>
                <td>{lap.procesador} / {lap.ram} / {lap.almacenamiento || lap.disco}</td>
                {esVenta && <td>{lap.cliente || 'N/A'}</td>}
                <td>{lap.serial}</td>
                {esVenta && tienePermisoFinanzas && <td>S/ {Number(lap.precio_costo || 0).toFixed(2)}</td>}
                {esVenta && <td>S/ {Number(lap.precio || 0).toFixed(2)}</td>}
                {esVenta && tienePermisoFinanzas && <td>S/ {Number(lap.utilidad || 0).toFixed(2)}</td>}
                <td>{lap.responsable_venta || lap.responsable}</td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={esVenta ? (tienePermisoFinanzas ? 9 : 7) : 4}>No hay registros para la fecha seleccionada.</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  </div>
);

// --- NUEVO: Componente para el gráfico de pastel ---
const MarcasChart = ({ data }) => (
  <div className={styles.chartContainer}>
    <h3 className={styles.tableTitle}>Marcas más Vendidas</h3>
    <div className={styles.chartWrapper}>
      {data.labels.length > 0 ? (
        <Pie 
          data={data}
          options={{
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: {
                position: 'top',
                labels: {
                  color: '#e2e8f0',
                  font: {
                    size: 12
                  }
                }
              }
            }
          }}
        />
      ) : (
        <div className={styles.noChartData}>No hay datos de ventas para mostrar el gráfico.</div>
      )}
    </div>
  </div>
);

const ReporteDiarioView = ({ laptops, usuarioLogueado, tienePermiso }) => {
  const [fechaReporte, setFechaReporte] = useState(new Date().toISOString().split('T')[0]);

  const tienePermisoFinanzas = tienePermiso('VER_FINANZAS');

  const datosDelDia = useMemo(() => {
    if (!fechaReporte) {
      return { registrados: [], vendidos: [], totalVendido: 0, totalGanancia: 0, totalInvertido: 0 };
    }

    const [year, month, day] = fechaReporte.split('-');
    const fechaFormato1 = `${parseInt(day, 10)}/${parseInt(month, 10)}/${year}`;
    const fechaFormato2 = `${day}/${month}/${year}`;

    const registrados = laptops.filter(lap => {
      const fechaRegistro = lap.fecha || "";
      return fechaRegistro === fechaFormato1 || fechaRegistro === fechaFormato2;
    });

    const vendidos = laptops.filter(lap => {
      const fechaVenta = lap.fecha_venta || "";
      return fechaVenta === fechaFormato1 || fechaVenta === fechaFormato2;
    });

    const totalVendido = vendidos.reduce((sum, lap) => sum + (Number(lap.precio) || 0), 0);
    const totalInvertido = vendidos.reduce((sum, lap) => sum + (Number(lap.precio_costo) || 0), 0);
    const totalGanancia = vendidos.reduce((sum, lap) => sum + (Number(lap.utilidad) || 0), 0);

    return { registrados, vendidos, totalVendido, totalGanancia, totalInvertido };
  }, [laptops, fechaReporte]);

  // --- NUEVO: useMemo para procesar los datos del gráfico ---
  const chartData = useMemo(() => {
    const brandCounts = {};
    datosDelDia.vendidos.forEach(lap => {
      const brand = lap.marca || 'SIN MARCA';
      brandCounts[brand] = (brandCounts[brand] || 0) + 1;
    });

    const labels = Object.keys(brandCounts);
    const data = Object.values(brandCounts);

    return {
      labels,
      datasets: [
        {
          label: '# de Ventas',
          data,
          backgroundColor: [
            'rgba(59, 130, 246, 0.7)', 'rgba(16, 185, 129, 0.7)',
            'rgba(234, 179, 8, 0.7)', 'rgba(239, 68, 68, 0.7)',
            'rgba(168, 85, 247, 0.7)', 'rgba(236, 72, 153, 0.7)',
            'rgba(22, 163, 74, 0.7)', 'rgba(14, 165, 233, 0.7)',
          ],
          borderColor: [
            '#3b82f6', '#10b981', '#eab308', '#ef4444',
            '#a855f7', '#ec4899', '#16a34a', '#0ea5e9',
          ],
          borderWidth: 1,
        },
      ],
    };
  }, [datosDelDia.vendidos]);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className={`${styles.reporteContainer} fade-in`}>
      <header className={styles.reportHeader}>
        <div>
          <h1 className={styles.mainTitle}>Reporte Diario de Operaciones</h1>
          <p className={styles.subTitle}>Resumen de actividad para el día seleccionado.</p>
        </div>
        <div className={styles.headerControls}>
          <input 
            type="date" 
            value={fechaReporte}
            onChange={(e) => setFechaReporte(e.target.value)}
            className={styles.datePicker}
          />
          <button onClick={handlePrint} className={styles.printButton}>
            <Printer size={18} />
            Imprimir
          </button>
        </div>
      </header>

      <section className={styles.statsGrid}>
        <StatCard 
          icon={<DollarSign size={24} />}
          title="Total Vendido"
          value={`S/ ${datosDelDia.totalVendido.toFixed(2)}`}
          color="#10b981"
        />
        {tienePermisoFinanzas && (
          <StatCard 
            icon={<TrendingUp size={24} />}
            title="Ganancia Neta"
            value={`S/ ${datosDelDia.totalGanancia.toFixed(2)}`}
            color="#3b82f6"
          />
        )}
        <StatCard 
          icon={<Package size={24} />}
          title="Laptops Registradas"
          value={datosDelDia.registrados.length}
          color="#f59e0b"
        />
        <StatCard 
          icon={<Package size={24} />}
          title="Laptops Vendidas"
          value={datosDelDia.vendidos.length}
          color="#ef4444"
        />
      </section>

      <section className={styles.fullWidthTableSection}>
        <LaptopsTable 
          title="Laptops Vendidas Hoy" 
          laptops={datosDelDia.vendidos} 
          esVenta={true}
          tienePermisoFinanzas={tienePermisoFinanzas}
        />
      </section>

      <section className={styles.bottomGridSection}>
        <LaptopsTable 
          title="Laptops Registradas Hoy" 
          laptops={datosDelDia.registrados}
        />
        <MarcasChart data={chartData} />
      </section>
    </div>
  );
};

export default ReporteDiarioView;