import React from 'react';

const MenuMobile = ({
  usuarioLogueado,
  pestanaActual,
  setPestanaActual,
  handleLogout,
  cargando,
  tienePermiso, // Nueva prop para verificar permisos
  isEditing    // NUEVO: para bloquear la navegación
}) => {

  const NavButton = ({ pestana, icono, texto, disabled }) => {
    const isActive = pestanaActual === pestana;
    return (
      <button
        onClick={() => setPestanaActual(pestana)}
        disabled={disabled}
        style={{
          background: 'transparent',
          border: 'none',
          color: isActive ? '#00ff7f' : '#94a3b8',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '4px',
          flex: 1,
          padding: '5px 0',
          cursor: disabled ? 'not-allowed' : 'pointer',
          opacity: disabled && !isActive ? 0.5 : 1,
          transition: 'color 0.2s ease',
        }}
      >
        <span style={{ fontSize: '1.8rem' }}>{icono}</span>
        <span style={{ fontSize: '0.65rem', fontWeight: '600', textTransform: 'uppercase' }}>{texto}</span>
      </button>
    );
  };

  return (
    <>
      {/* Barra Superior Fija */}
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '60px',
        backgroundColor: '#0F172A',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 20px',
        borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
        zIndex: 99999,
        boxSizing: 'border-box'
      }}>
        <h1 style={{ margin: 0, fontSize: '1.2rem', color: '#fff', fontWeight: 'bold' }}>
          FINPRO STORE
        </h1>
        <button
          onClick={handleLogout}
          style={{
            background: '#ef4444',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            padding: '8px 15px',
            fontWeight: 'bold',
            fontSize: '0.8rem',
            cursor: 'pointer'
          }}
        >
          SALIR
        </button>
      </div>

      {/* Barra de Navegación Inferior Fija */}
      <nav style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        width: '100%',
        height: '70px',
        backgroundColor: '#0F172A',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-around',
        borderTop: '1px solid rgba(255, 255, 255, 0.1)',
        zIndex: 99999,
        boxSizing: 'border-box',
        paddingBottom: 'env(safe-area-inset-bottom)',
        boxShadow: '0 -5px 20px rgba(0, 0, 0, 0.5)'
      }}>
        {tienePermiso('VER_TABLA_GENERAL') && <NavButton pestana="excel_interno" icono="📊" texto="General" disabled={isEditing} />}
{(() => {
  const tienePermisoDespachos = tienePermiso('VER_DESPACHOS');
  console.log("--- DEBUG MENU ---");
  console.log("Rol:", usuarioLogueado?.rol);
  console.log("¿Tiene permiso VER_DESPACHOS?:", tienePermisoDespachos);
  return null;
})()}
        {/* Reemplaza tu bloque actual de la línea 98 por este: */}
{(tienePermiso('VER_DESPACHOS') || usuarioLogueado?.rol === 'super_admin') && (
  <NavButton pestana="despachos" icono="🚚" texto="Salidas" disabled={isEditing} />
)}
        {tienePermiso('VER_VENTAS') && <NavButton pestana="ventas" icono="💰" texto="Ventas" disabled={isEditing} />}
        {tienePermiso('VER_ALMACEN') && (
          <NavButton pestana="almacen" icono="📖" texto="Almacén" disabled={isEditing} />
        )}
        {tienePermiso('REGISTRAR') && (
          <NavButton pestana="registro" icono="➕" texto={isEditing ? 'Editando' : 'Registrar'} disabled={isEditing} />
        )}
        {tienePermiso('GESTIONAR_USUARIOS') && (
          <NavButton pestana="gestion_usuarios" icono="👤" texto="Admin" disabled={isEditing} />
        )}
      </nav>
    </>
  );
};

export default MenuMobile;