import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { UsuarioService } from './usuario-service';
import { environment } from '../../environments/environment';
import { ActualizarUsuarioRequest, CrearUsuarioRequest, FiltrosUsuarioRequest, Usuario } from '../Models/Usuario';

describe('UsuarioService', () => {
  let service: UsuarioService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        UsuarioService,
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });
    service = TestBed.inject(UsuarioService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('getTodos sends GET request to apiUrl', () => {
    const mockList: Usuario[] = [
      { id: 1, nombre: 'A', apellido: 'B', email: 'a@b.com', telefono: '123', role: 'ROLE_USUARIO' },
    ];

    service.getTodos().subscribe(res => {
      expect(res).toEqual(mockList);
    });

    const req = httpMock.expectOne(`${environment.apiUrl}/auth/usuarios`);
    expect(req.request.method).toBe('GET');
    req.flush(mockList);
  });

  it('getPorId sends GET request to apiUrl/:id', () => {
    const mockUser: Usuario = { id: 5, nombre: 'A', apellido: 'B', email: 'a@b.com', telefono: '123', role: 'ROLE_USUARIO' };

    service.getPorId(5).subscribe(res => {
      expect(res).toEqual(mockUser);
    });

    const req = httpMock.expectOne(`${environment.apiUrl}/auth/usuarios/5`);
    expect(req.request.method).toBe('GET');
    req.flush(mockUser);
  });

  it('filtrar sends GET to adminUrl/filtrar with query parameters', () => {
    const filtros: FiltrosUsuarioRequest = {
      texto: 'Carlos',
      role: 'ROLE_EMPLEADO',
      identificador: 'DNI',
      numeroIdentificador: '30111222',
      orden: 'NOMBRE_ASC',
    };

    service.filtrar(filtros).subscribe(res => {
      expect(res.length).toBe(1);
    });

    const req = httpMock.expectOne(r => r.url === `${environment.apiUrl}/admin/users/filtrar`);
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('texto')).toBe('Carlos');
    expect(req.request.params.get('role')).toBe('ROLE_EMPLEADO');
    expect(req.request.params.get('identificador')).toBe('DNI');
    expect(req.request.params.get('numeroIdentificador')).toBe('30111222');
    expect(req.request.params.get('orden')).toBe('NOMBRE_ASC');
    req.flush([{ id: 1, nombre: 'Carlos', role: 'ROLE_EMPLEADO' }]);
  });

  it('filtrarEmpleados sets role to ROLE_EMPLEADO automatically', () => {
    service.filtrarEmpleados({ texto: 'Juan' }).subscribe();

    const req = httpMock.expectOne(r => r.url === `${environment.apiUrl}/admin/users/filtrar`);
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('role')).toBe('ROLE_EMPLEADO');
    expect(req.request.params.get('texto')).toBe('Juan');
    req.flush([]);
  });

  it('crearUsuario sends POST to adminUrl', () => {
    const data: CrearUsuarioRequest = {
      nombre: 'Test',
      apellido: 'User',
      identificador: 'DNI',
      numeroIdentificador: '12345678',
      fechaNacimiento: '1990-01-01',
      sexo: 'MASCULINO',
      email: 'test@example.com',
      telefono: '112233',
      password: 'secretPassword',
      role: 'ROLE_USUARIO',
    };

    service.crearUsuario(data).subscribe(res => {
      expect(res.id).toBe(10);
    });

    const req = httpMock.expectOne(`${environment.apiUrl}/admin/users`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(data);
    req.flush({ ...data, id: 10 });
  });

  it('actualizarUsuario sends PUT to adminUrl/:id', () => {
    const data: ActualizarUsuarioRequest = {
      nombre: 'Updated',
      apellido: 'User',
      identificador: 'DNI',
      numeroIdentificador: '12345678',
      fechaNacimiento: '1990-01-01',
      sexo: 'MASCULINO',
      email: 'updated@example.com',
      telefono: '999888',
      role: 'ROLE_EMPLEADO',
    };

    service.actualizarUsuario(10, data).subscribe(res => {
      expect(res.nombre).toBe('Updated');
    });

    const req = httpMock.expectOne(`${environment.apiUrl}/admin/users/10`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual(data);
    req.flush({ ...data, id: 10 });
  });

  it('eliminarUsuario sends DELETE to adminUrl/:id', () => {
    service.eliminarUsuario(10).subscribe();

    const req = httpMock.expectOne(`${environment.apiUrl}/admin/users/10`);
    expect(req.request.method).toBe('DELETE');
    req.flush(null);
  });
});
