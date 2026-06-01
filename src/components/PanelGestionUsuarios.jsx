import React, { useState } from 'react';

const PanelGestionUsuarios = ({ 
  usuarios, onToggleActivo, usuarioLogueado,
  rolesConPermisos, allPermissions, onAddRole, 
  onUpdateRolePermissions, onUpdateUserRole, onDeleteRole, tienePermiso,
  onAddUser, onDeleteUser, onUpdateUserPermissionOverrides
}) => {
  const [rolSeleccionado, setRolSeleccionado] = useState('');
  const [nuevoRol, setNuevoRol] = useState('');
  // --- NUEVO: Estado para el formulario de creación de usuario ---
  const [editingUser, setEditingUser] = useState(null); // Para el modal de permisos individuales
  const [newUserInfo, setNewUserInfo] = useState({
    nombre: '',
    user: '',
    pass: '',
    rol: ''
  });

  const handleCrearRol = (e) => {
    e.preventDefault();
    const nombreRol = nuevoRol.trim().toLowerCase().replace(/\s+/g, '_');
    if (onAddRole(nombreRol)) {
      setNuevoRol('');
    }
  };

  const handlePermissionChange = (role, permission, isChecked) => {
    const currentPermissions = rolesConPermisos[role] || [];
    let newPermissions;
    if (isChecked) {
      // Añadir permiso si no está ya
      newPermissions = [...new Set([...currentPermissions, permission])];
    } else {
      // Quitar permiso
      newPermissions = currentPermissions.filter(p => p !== permission);
    }
    onUpdateRolePermissions(role, newPermissions);
  };

  // --- NUEVO: Manejador para el formulario de creación de usuario ---
  const handleNewUserChange = (e) => {
    const { name, value } = e.target;
    setNewUserInfo(prev => ({ ...prev, [name]: value }));
  };

  const handleCrearUsuario = (e) => {
    e.preventDefault();
    if (!newUserInfo.nombre || !newUserInfo.user || !newUserInfo.pass || !newUserInfo.rol) {
      alert('❌ Por favor, completa todos los campos para crear el usuario.');
      return;
    }
    // Llamamos a la función que viene de App.jsx
    if (onAddUser(newUserInfo)) {
      // Limpiamos el formulario si el usuario se creó con éxito
      setNewUserInfo({ nombre: '', user: '', pass: '', rol: '' });
    }
  };

  const handleEliminarRol = () => {
    if (!rolSeleccionado) return;
    if (onDeleteRole(rolSeleccionado)) {
      setRolSeleccionado(''); // Limpia la selección si el rol se eliminó con éxito
    }
  };

  // --- NUEVO: Manejador para los cambios de permisos individuales ---
  const handleUserPermissionChange = (permission, newState) => {
    if (!editingUser) return;

    const currentOverrides = editingUser.permissionOverrides || { add: [], remove: [] };
    let newAdd = [...currentOverrides.add];
    let newRemove = [...currentOverrides.remove];

    // Primero, quitamos el permiso de ambas listas para resetearlo
    newAdd = newAdd.filter(p => p !== permission);
    newRemove = newRemove.filter(p => p !== permission);

    // Ahora, lo añadimos a la lista correcta según el nuevo estado
    if (newState === 'allow') {
      newAdd.push(permission);
    } else if (newState === 'deny') {
      newRemove.push(permission);
    }

    const newOverrides = { add: newAdd, remove: newRemove };
    
    // Llamamos a la función de App.jsx para persistir el cambio
    onUpdateUserPermissionOverrides(editingUser.id, newOverrides);

    // Actualizamos el estado local del modal para que el cambio se vea al instante
    setEditingUser(prev => ({ ...prev, permissionOverrides: newOverrides }));
  };

  // Estilos para hacer la tabla más delgada y con celdas más cuadradas/uniformes
  const cellStyle = {
    padding: '12px 15px', // Aumenta el padding vertical y ajusta el horizontal
    textAlign: 'left',
    verticalAlign: 'middle',
    whiteSpace: 'nowrap',
    borderBottom: '1px solid #334155'
  };

  const headerCellStyle = {
    ...cellStyle,
    color: '#94a3b8',
    fontWeight: 'bold',
    borderBottom: '2px solid #334155'
  };

  return (
    <div className="animacion-entrada-seccion">
      <h2 style={{ color: '#fff', borderBottom: '2px solid #00ff7f', paddingBottom: '10px' }}>
        Gestión de Usuarios
      </h2>
      <p style={{ color: '#aaa', marginBottom: '20px' }}>
        Activa/desactiva cuentas, cambia roles y personaliza permisos. Los cambios se guardan en este navegador.
      </p>
      <div className="table-wrapper-global">
        <table className="tabla-moderna" style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={headerCellStyle}>Nombre</th>
              <th style={headerCellStyle}>Usuario</th>
              <th style={headerCellStyle}>Rol</th>
              <th style={{...headerCellStyle, textAlign: 'center'}}>Estado</th>
              <th style={{...headerCellStyle, textAlign: 'center'}}>Acción</th>
            </tr>
          </thead>
          <tbody>
            {usuarios
              .filter(user => user.rol !== 'super_admin') // Ocultamos al super_admin de la lista para que no sea editable.
              .map(user => (
              <tr key={user.id} >
                <td style={cellStyle}>{user.nombre}</td>
                <td style={cellStyle}>{user.user}</td>
                <td style={cellStyle}>
                  {tienePermiso(allPermissions.GESTIONAR_ROLES) ? (
                    <select
                      value={user.rol}
                      onChange={(e) => onUpdateUserRole(user.id, e.target.value)}
                      disabled={usuarioLogueado.id === user.id || user.rol === 'super_admin'}
                      style={{ backgroundColor: '#020617', color: 'white', border: '1px solid #334155', borderRadius: '4px', padding: '5px' }}
                    >
                      {/* El rol de super_admin no se puede asignar, solo el que ya lo es lo tiene. */}
                      {Object.keys(rolesConPermisos)
                        .filter(rol => rol !== 'super_admin')
                        .map(rol => (
                          <option key={rol} value={rol}>{rol.replace(/_/g, ' ').toUpperCase()}</option>
                        ))
                      }
                    </select>
                  ) : (
                    user.rol.replace(/_/g, ' ').toUpperCase()
                  )}
                </td>
                <td style={{...cellStyle, textAlign: 'center'}}>
                  <span style={{
                    color: user.activo ? '#00ff7f' : '#ef4444',
                    fontWeight: 'bold'
                  }}>
                    {user.activo ? 'Activo' : 'Inactivo'}
                  </span>
                </td>
                <td style={{...cellStyle, textAlign: 'center'}}>
                  {/* No permitir que un usuario se modifique a sí mismo */}
                  {usuarioLogueado.id !== user.id && (
                    <div style={{display: 'flex', gap: '5px', justifyContent: 'center'}}>
                      <button
                        onClick={() => onToggleActivo(user.id)}
                        className="btn-accion"
                        style={{
                          backgroundColor: user.activo ? '#ef4444' : '#00ff7f',
                          color: 'white',
                          flex: 1
                        }}
                      >
                        {user.activo ? 'Desactivar' : 'Activar'}
                      </button>
                      <button
                        onClick={() => onDeleteUser(user.id)}
                        className="btn-accion"
                        title="Eliminar usuario permanentemente"
                        style={{
                          backgroundColor: '#8B0000',
                          color: 'white',
                          padding: '0 10px'
                        }}
                      >
                        🗑️
                      </button>
                      {/* --- NUEVO: Botón para abrir modal de excepciones --- */}
                      {tienePermiso(allPermissions.GESTIONAR_ROLES) && (
                        <button
                          onClick={() => setEditingUser(user)}
                          className="btn-accion"
                          title="Editar permisos individuales (excepciones)"
                          style={{ backgroundColor: '#0ea5e9', color: 'white', padding: '0 10px' }}
                        >
                          ⚙️
                        </button>
                      )}
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* SECCIÓN DE ADMINISTRACIÓN */}
      {tienePermiso(allPermissions.GESTIONAR_USUARIOS) && (
        <div style={{marginTop: '40px', padding: '20px', background: '#1a1d23', borderRadius: '8px', border: '1px solid #334155'}}>
            <h3 style={{color: '#00ff7f', borderBottom: '1px solid #334155', paddingBottom: '10px', marginBottom: '20px'}}>
              Administración del Sistema
            </h3>

            {/* --- FORMULARIO PARA CREAR USUARIO --- */}
            <div style={{ marginBottom: '40px', paddingBottom: '30px', borderBottom: '1px dashed #334155' }}>
              <h4 style={{ color: '#fff', margin: '0 0 15px 0' }}>Crear Nuevo Usuario</h4>
              <form onSubmit={handleCrearUsuario}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px', marginBottom: '15px' }}>
                  <input name="nombre" value={newUserInfo.nombre} onChange={handleNewUserChange} placeholder="Nombre completo (Ej: Juan Perez)" required style={{ padding: '10px', background: '#020617', border: '1px solid #334155', color: 'white', borderRadius: '4px' }} />
                  <input name="user" value={newUserInfo.user} onChange={handleNewUserChange} placeholder="Usuario de login (ej: jperez)" required style={{ padding: '10px', background: '#020617', border: '1px solid #334155', color: 'white', borderRadius: '4px' }} />
                  <input name="pass" value={newUserInfo.pass} onChange={handleNewUserChange} placeholder="Contraseña" required style={{ padding: '10px', background: '#020617', border: '1px solid #334155', color: 'white', borderRadius: '4px' }} />
                  <select name="rol" value={newUserInfo.rol} onChange={handleNewUserChange} required style={{ padding: '10px', background: '#020617', border: '1px solid #334155', color: 'white', borderRadius: '4px' }}>
                    <option value="">-- Asignar Rol --</option>
                    {Object.keys(rolesConPermisos).filter(r => r !== 'super_admin').map(rol => (
                      <option key={rol} value={rol}>{rol.replace(/_/g, ' ').toUpperCase()}</option>
                    ))}
                  </select>
                </div>
                <button type="submit" className="btn-accion" style={{ background: '#0ea5e9', color: 'white', width: '100%', padding: '12px' }}>
                  Crear Usuario
                </button>
              </form>
            </div>

            {/* --- GESTIÓN DE ROLES Y PERMISOS --- */}
            {tienePermiso(allPermissions.GESTIONAR_ROLES) && (
            <div>
              <h4 style={{ color: '#fff', margin: '0 0 15px 0' }}>Gestionar Roles y Permisos</h4>
              
              {/* Formulario para crear rol */}
              <form onSubmit={handleCrearRol} style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
                <input
                  type="text"
                  value={nuevoRol}
                  onChange={(e) => setNuevoRol(e.target.value)}
                  placeholder="Nombre del nuevo rol (ej: tecnico_soporte)"
                  style={{ flex: 1, padding: '10px', background: '#020617', border: '1px solid #334155', color: 'white', borderRadius: '4px' }}
                />
                <button type="submit" className="btn-accion" style={{ background: '#00ff7f', color: 'black' }}>
                  Crear Rol
                </button>
              </form>

              {/* Selector para editar rol */}
              <div style={{ display: 'flex', gap: '20px', alignItems: 'flex-start' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ color: '#aaa', fontSize: '0.9rem', display: 'block', marginBottom: '5px' }}>
                    Selecciona un rol para editar sus permisos:
                  </label>
                  <select
                    value={rolSeleccionado}
                    onChange={(e) => setRolSeleccionado(e.target.value)}
                    style={{ width: '100%', padding: '10px', background: '#020617', border: '1px solid #334155', color: 'white', borderRadius: '4px' }}
                  >
                    <option value="">-- Seleccionar Rol --</option>
                    {Object.keys(rolesConPermisos).map(rol => (
                      <option key={rol} value={rol} disabled={rol === 'super_admin'}>
                        {rol.replace(/_/g, ' ').toUpperCase()}
                      </option>
                    ))}
                  </select>
                  {/* --- NUEVO: BOTÓN PARA ELIMINAR ROL --- */}
                  {rolSeleccionado && (
                    <button
                      onClick={handleEliminarRol}
                      style={{
                        width: '100%',
                        marginTop: '10px',
                        padding: '8px',
                        background: '#5c2121',
                        color: '#ffc1c1',
                        border: '1px solid #ef4444',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontWeight: 'bold',
                        transition: 'background 0.2s'
                      }}
                      onMouseOver={(e) => e.target.style.background = '#ef4444'}
                      onMouseOut={(e) => e.target.style.background = '#5c2121'}
                    >
                      Eliminar Rol "{rolSeleccionado.replace(/_/g, ' ')}"
                    </button>
                  )}
                </div>

                {/* Checkboxes de permisos */}
                {rolSeleccionado && (
                  <div style={{ flex: 2, background: '#020617', padding: '15px', borderRadius: '4px', border: '1px solid #334155' }}>
                    <h4 style={{ margin: '0 0 15px 0', color: '#fff' }}>Permisos para: {rolSeleccionado.replace(/_/g, ' ').toUpperCase()}</h4>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '8px', maxHeight: '200px', overflowY: 'auto' }}>
                      {Object.entries(allPermissions).map(([key, value]) => (
                        <label key={key} htmlFor={`perm-${key}`} style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', background: 'rgba(255,255,255,0.05)', padding: '10px', borderRadius: '4px', transition: 'background 0.2s' }}>
                          <div style={{
                            width: '18px',
                            height: '18px',
                            border: '2px solid #334155',
                            borderRadius: '4px',
                            backgroundColor: rolesConPermisos[rolSeleccionado]?.includes(value) ? '#00ff7f' : '#020617',
                            marginRight: '10px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                            transition: 'background-color 0.2s, border-color 0.2s'
                          }}>
                            {rolesConPermisos[rolSeleccionado]?.includes(value) && (
                              <span style={{ color: 'black', fontWeight: 'bold', fontSize: '14px', lineHeight: 1 }}>✓</span>
                            )}
                          </div>
                          <input
                            type="checkbox"
                            id={`perm-${key}`}
                            checked={rolesConPermisos[rolSeleccionado]?.includes(value) || false}
                            onChange={(e) => handlePermissionChange(rolSeleccionado, value, e.target.checked)}
                            style={{ display: 'none' }}
                          />
                          <span style={{ color: '#ccc', fontSize: '0.85rem' }}>{key.replace(/_/g, ' ')}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
            )}
        </div>
      )}

      {/* --- NUEVO: MODAL PARA GESTIONAR EXCEPCIONES DE PERMISOS --- */}
      {editingUser && (
        <div style={{
          position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
          backgroundColor: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(5px)',
          display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1001
        }}>
          <div style={{
            background: '#0f172a', color: 'white', padding: '25px',
            borderRadius: '12px', border: '1px solid #334155',
            width: '90%', maxWidth: '700px',
            display: 'flex', flexDirection: 'column', gap: '20px'
          }}>
            {/* Cabecera del Modal */}
            <div>
              <h3 style={{ margin: 0, color: '#0ea5e9' }}>Excepciones para: {editingUser.nombre}</h3>
              <p style={{ margin: '5px 0 0 0', color: '#94a3b8', fontSize: '0.9rem' }}>
                Rol base: <span style={{ fontWeight: 'bold', color: '#e2e8f0' }}>{editingUser.rol.replace(/_/g, ' ')}</span>. 
                Los cambios aquí anulan los permisos del rol solo para este usuario.
              </p>
            </div>

            {/* Lista de Permisos */}
            <div style={{ 
              display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', 
              gap: '10px', maxHeight: '50vh', overflowY: 'auto',
              background: '#020617', padding: '15px', borderRadius: '8px'
            }}>
              {Object.entries(allPermissions).map(([key, permission]) => {
                const hasPermissionByRole = rolesConPermisos[editingUser.rol]?.includes(permission);
                const overrides = editingUser.permissionOverrides || { add: [], remove: [] };
                
                let currentState = 'inherit';
                if (overrides.add.includes(permission)) currentState = 'allow';
                if (overrides.remove.includes(permission)) currentState = 'deny';

                return (
                  <div key={key} style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    background: '#0f172a', padding: '10px', borderRadius: '6px', border: '1px solid #1e293b'
                  }}>
                    <span style={{ color: '#e2e8f0', fontSize: '0.85rem' }}>
                      {key.replace(/_/g, ' ')}
                      {currentState === 'inherit' && (
                        <span style={{ color: hasPermissionByRole ? '#00ff7f' : '#ef4444', marginLeft: '8px', fontSize: '0.7rem' }}>
                          ({hasPermissionByRole ? 'Heredado: SÍ' : 'Heredado: NO'})
                        </span>
                      )}
                    </span>
                    <select
                      value={currentState}
                      onChange={(e) => handleUserPermissionChange(permission, e.target.value)}
                      style={{
                        backgroundColor: 
                          currentState === 'allow' ? 'rgba(0, 255, 127, 0.2)' :
                          currentState === 'deny' ? 'rgba(239, 68, 68, 0.2)' :
                          '#334155',
                        color: 
                          currentState === 'allow' ? '#00ff7f' :
                          currentState === 'deny' ? '#ef4444' :
                          'white',
                        border: '1px solid #334155',
                        borderRadius: '4px',
                        padding: '4px 8px',
                        fontSize: '0.8rem',
                        outline: 'none'
                      }}
                    >
                      <option value="inherit" style={{color: '#94a3b8', background: '#0f172a'}}>Heredar</option>
                      <option value="allow" style={{color: '#00ff7f', background: '#0f172a'}}>✅ Permitir</option>
                      <option value="deny" style={{color: '#ef4444', background: '#0f172a'}}>❌ Denegar</option>
                    </select>
                  </div>
                );
              })}
            </div>

            {/* Botón de Cierre */}
            <button 
              onClick={() => setEditingUser(null)}
              style={{
                alignSelf: 'flex-end',
                padding: '10px 20px',
                background: '#ef4444',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontWeight: 'bold'
              }}
            >
              Cerrar
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default PanelGestionUsuarios;