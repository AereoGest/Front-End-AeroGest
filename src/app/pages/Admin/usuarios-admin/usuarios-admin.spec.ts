import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import { UsuariosAdmin } from './usuarios-admin';
import { Usuario } from '../../../Models/Usuario';
import { environment } from '../../../../environments/environment';

describe('UsuariosAdmin', () => {
  let component: UsuariosAdmin;
  let fixture: ComponentFixture<UsuariosAdmin>;
  let httpMock: HttpTestingController;

  const mockUsuarios: Usuario[] = [
    {
      id: 1,
      personaId: 10,
      nombre: 'Carlos',
      apellido: 'Gómez',
      email: 'carlos@example.com',
      telefono: '1122334455',
      role: 'ROLE_USUARIO',
      identificador: 'DNI',
      numeroIdentificador: '30111222',
      fechaNacimiento: '1990-05-15',
      sexo: 'MASCULINO',
    },
    {
      id: 2,
      personaId: 20,
      nombre: 'Ana',
      apellido: 'Álvarez',
      email: 'ana@example.com',
      telefono: '1166778899',
      role: 'ROLE_EMPLEADO',
      identificador: 'DNI',
      numeroIdentificador: '35333444',
      fechaNacimiento: '1992-08-20',
      sexo: 'FEMENINO',
    },
    {
      id: 3,
      personaId: 30,
      nombre: 'Beatriz',
      apellido: 'Zárate',
      email: 'beatriz@example.com',
      telefono: '1199887766',
      role: 'ROLE_ADMIN',
      identificador: 'PASAPORTE',
      numeroIdentificador: 'PAS123456',
      fechaNacimiento: '1985-11-10',
      sexo: 'FEMENINO',
    },
  ];

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [UsuariosAdmin],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(UsuariosAdmin);
    component = fixture.componentInstance;
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  function expectInitialLoad(data: Usuario[] = mockUsuarios) {
    fixture.detectChanges();
    const req = httpMock.expectOne(`${environment.apiUrl}/auth/usuarios`);
    expect(req.request.method).toBe('GET');
    req.flush(data);
  }

  it('should create and load users list', () => {
    expectInitialLoad();
    expect(component).toBeTruthy();
    expect(component.usuarios().length).toBe(3);
    expect(component.cargando()).toBe(false);
    expect(component.error()).toBe(false);
  });

  it('filters users by text search', () => {
    expectInitialLoad();
    component.busqueda.set('ana');
    expect(component.visibles().length).toBe(1);
    expect(component.visibles()[0].email).toBe('ana@example.com');
  });

  it('filters users by role tab', () => {
    expectInitialLoad();
    component.rolFiltro.set('ROLE_USUARIO');
    expect(component.visibles().length).toBe(1);
    expect(component.visibles()[0].nombre).toBe('Carlos');

    component.rolFiltro.set('ROLE_ADMIN');
    expect(component.visibles().length).toBe(1);
    expect(component.visibles()[0].nombre).toBe('Beatriz');
  });

  it('sorts users by last name ascending and descending', () => {
    expectInitialLoad();
    component.orden.set('NOMBRE_ASC');
    expect(component.visibles()[0].apellido).toBe('Álvarez');

    component.orden.set('NOMBRE_DESC');
    expect(component.visibles()[0].apellido).toBe('Zárate');
  });

  it('opens and closes modal alta', () => {
    expectInitialLoad();
    component.abrirModalAlta();
    expect(component.modalAltaAbierto()).toBe(true);

    component.cerrarModalAlta();
    expect(component.modalAltaAbierto()).toBe(false);
  });

  it('creates a user successfully via modal alta', () => {
    expectInitialLoad();
    component.abrirModalAlta();

    component.altaNombre.set('Mariano');
    component.altaApellido.set('López');
    component.altaIdentificador.set('DNI');
    component.altaNumeroIdentificador.set('40123456');
    component.altaFechaNacimiento.set('1998-02-14');
    component.altaSexo.set('MASCULINO');
    component.altaEmail.set('mariano@example.com');
    component.altaTelefono.set('1133445566');
    component.altaPassword.set('clave123');
    component.altaRole.set('ROLE_USUARIO');

    component.crearUsuario();
    expect(component.guardando()).toBe(true);

    const reqPost = httpMock.expectOne(`${environment.apiUrl}/admin/users`);
    expect(reqPost.request.method).toBe('POST');
    expect(reqPost.request.body.email).toBe('mariano@example.com');
    reqPost.flush({ ...mockUsuarios[0], id: 4, email: 'mariano@example.com' });

    // Espera el reload de la tabla
    const reqReload = httpMock.expectOne(`${environment.apiUrl}/auth/usuarios`);
    reqReload.flush([...mockUsuarios, { ...mockUsuarios[0], id: 4, email: 'mariano@example.com' }]);

    expect(component.guardando()).toBe(false);
    expect(component.modalAltaAbierto()).toBe(false);
    expect(component.mensajeExito()).toBe('adminUsers.successCreated');
  });

  it('opens modal edicion with populated user data and saves update', () => {
    expectInitialLoad();
    const userToEdit = mockUsuarios[0];
    component.abrirModalEdicion(userToEdit);

    expect(component.modalEdicionAbierto()).toBe(true);
    expect(component.editNombre()).toBe('Carlos');
    expect(component.editEmail()).toBe('carlos@example.com');

    component.editNombre.set('Carlos Alberto');
    component.guardarEdicion();

    const reqPut = httpMock.expectOne(`${environment.apiUrl}/admin/users/${userToEdit.id}`);
    expect(reqPut.request.method).toBe('PUT');
    expect(reqPut.request.body.nombre).toBe('Carlos Alberto');
    reqPut.flush({ ...userToEdit, nombre: 'Carlos Alberto' });

    const reqReload = httpMock.expectOne(`${environment.apiUrl}/auth/usuarios`);
    reqReload.flush([...mockUsuarios]);

    expect(component.modalEdicionAbierto()).toBe(false);
    expect(component.mensajeExito()).toBe('adminUsers.successUpdated');
  });

  it('deletes a user successfully, closes the alert with animation and shows a toast', () => {
    vi.useFakeTimers();
    expectInitialLoad();
    const userToDelete = mockUsuarios[0];
    component.abrirModalBaja(userToDelete);

    expect(component.modalBajaAbierto()).toBe(true);
    expect(component.usuarioSeleccionado()?.id).toBe(userToDelete.id);

    component.confirmarBaja();
    expect(component.eliminando()).toBe(true);

    const reqDel = httpMock.expectOne(`${environment.apiUrl}/admin/users/${userToDelete.id}`);
    expect(reqDel.request.method).toBe('DELETE');
    reqDel.flush(null);

    const reqReload = httpMock.expectOne(`${environment.apiUrl}/auth/usuarios`);
    reqReload.flush(mockUsuarios.filter(u => u.id !== userToDelete.id));

    expect(component.eliminando()).toBe(false);
    // El aviso queda "cerrando" mientras corre la animación de salida
    expect(component.cerrandoBaja()).toBe(true);
    expect(component.toast()?.tipo).toBe('exito');

    vi.advanceTimersByTime(400);
    expect(component.modalBajaAbierto()).toBe(false);
    vi.useRealTimers();
  });

  it('shows an error toast when delete is rejected due to active reservations', () => {
    expectInitialLoad();
    const userToDelete = mockUsuarios[0];
    component.abrirModalBaja(userToDelete);

    component.confirmarBaja();
    const reqDel = httpMock.expectOne(`${environment.apiUrl}/admin/users/${userToDelete.id}`);
    reqDel.flush(
      { message: 'No se puede eliminar el usuario porque tiene reservas registradas en el sistema.' },
      { status: 400, statusText: 'Bad Request' }
    );

    expect(component.eliminando()).toBe(false);
    expect(component.toast()).toEqual({
      texto: 'No se puede eliminar el usuario porque tiene reservas registradas en el sistema.',
      tipo: 'error',
    });
  });

  it('shows an info toast when the delete is cancelled', () => {
    expectInitialLoad();
    component.abrirModalBaja(mockUsuarios[0]);
    component.cancelarBaja();

    expect(component.toast()?.tipo).toBe('info');
    expect(component.cerrandoBaja()).toBe(true);
  });

  it('closes modals on escape key press', () => {
    expectInitialLoad();
    component.abrirModalAlta();
    expect(component.modalAltaAbierto()).toBe(true);

    component.onEscape();
    expect(component.modalAltaAbierto()).toBe(false);
  });

  it('filters employees tab and updates view state and placeholder', () => {
    expectInitialLoad();
    component.rolFiltro.set('ROLE_EMPLEADO');
    expect(component.esVistaEmpleados()).toBe(true);
    expect(component.placeholderBusqueda()).toBe('adminUsers.searchEmployeesPlaceholder');
    expect(component.visibles().length).toBe(1);
    expect(component.visibles()[0].email).toBe('ana@example.com');
  });

  it('filters users by document type', () => {
    expectInitialLoad();
    component.identificadorFiltro.set('PASAPORTE');
    expect(component.visibles().length).toBe(1);
    expect(component.visibles()[0].nombre).toBe('Beatriz');

    component.identificadorFiltro.set('DNI');
    expect(component.visibles().length).toBe(2);
  });

  it('clears all applied filters including document type', () => {
    expectInitialLoad();
    component.busqueda.set('Carlos');
    component.rolFiltro.set('ROLE_USUARIO');
    component.identificadorFiltro.set('DNI');
    component.orden.set('NOMBRE_DESC');

    expect(component.hayFiltros()).toBe(true);

    component.limpiarFiltros();

    expect(component.busqueda()).toBe('');
    expect(component.rolFiltro()).toBe('TODOS');
    expect(component.identificadorFiltro()).toBe('TODOS');
    expect(component.orden()).toBe('NOMBRE_ASC');
    expect(component.hayFiltros()).toBe(false);
  });
});
