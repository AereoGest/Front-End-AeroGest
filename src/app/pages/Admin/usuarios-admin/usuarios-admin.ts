import { Component, HostListener, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { TranslatePipe } from '../../../pipes/translate.pipe';
import type { TranslationKey } from '../../../i18n/es';
import { UsuarioService } from '../../../services/usuario-service';
import {
  ActualizarUsuarioRequest,
  CrearUsuarioRequest,
  RolUsuario,
  Sexo,
  TipoIdentificador,
  Usuario,
} from '../../../Models/Usuario';

type FiltroRol = 'TODOS' | RolUsuario;
type FiltroIdentificador = 'TODOS' | TipoIdentificador;
type Orden = 'NOMBRE_ASC' | 'NOMBRE_DESC' | 'RECIENTES' | 'ANTIGUOS';

@Component({
  selector: 'app-usuarios-admin',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslatePipe],
  templateUrl: './usuarios-admin.html',
  styleUrl: './usuarios-admin.css',
})
export class UsuariosAdmin implements OnInit {
  private usuarioService = inject(UsuarioService);

  readonly roles: RolUsuario[] = ['ROLE_USUARIO', 'ROLE_EMPLEADO', 'ROLE_ADMIN', 'ROLE_INCOMPLETO'];
  readonly rolesAsignables: RolUsuario[] = ['ROLE_USUARIO', 'ROLE_EMPLEADO', 'ROLE_ADMIN'];
  readonly tiposIdentificador: TipoIdentificador[] = ['DNI', 'PASAPORTE'];
  readonly sexos: Sexo[] = ['MASCULINO', 'FEMENINO', 'OTRO'];

  readonly ordenes: { valor: Orden; key: TranslationKey }[] = [
    { valor: 'NOMBRE_ASC', key: 'adminUsers.sortNameAsc' },
    { valor: 'NOMBRE_DESC', key: 'adminUsers.sortNameDesc' },
    { valor: 'RECIENTES', key: 'adminUsers.sortNewest' },
    { valor: 'ANTIGUOS', key: 'adminUsers.sortOldest' },
  ];

  usuarios = signal<Usuario[]>([]);
  cargando = signal(true);
  error = signal(false);

  // ── Alertas generales ──
  mensajeExito = signal<string | null>(null);
  mensajeError = signal<string | null>(null);

  // ── Filtros ──
  busqueda = signal('');
  rolFiltro = signal<FiltroRol>('TODOS');
  identificadorFiltro = signal<FiltroIdentificador>('TODOS');
  orden = signal<Orden>('NOMBRE_ASC');

  // ── Modales ──
  modalAltaAbierto = signal(false);
  modalEdicionAbierto = signal(false);
  modalBajaAbierto = signal(false);
  guardando = signal(false);
  eliminando = signal(false);
  formularioError = signal<string | null>(null);
  usuarioSeleccionado = signal<Usuario | null>(null);

  // ── Campos formulario Alta ──
  altaNombre = signal('');
  altaApellido = signal('');
  altaIdentificador = signal<TipoIdentificador>('DNI');
  altaNumeroIdentificador = signal('');
  altaFechaNacimiento = signal('');
  altaSexo = signal<Sexo>('MASCULINO');
  altaEmail = signal('');
  altaTelefono = signal('');
  altaPassword = signal('');
  altaRole = signal<RolUsuario>('ROLE_USUARIO');

  // ── Campos formulario Edición ──
  editNombre = signal('');
  editApellido = signal('');
  editIdentificador = signal<TipoIdentificador>('DNI');
  editNumeroIdentificador = signal('');
  editFechaNacimiento = signal('');
  editSexo = signal<Sexo>('MASCULINO');
  editEmail = signal('');
  editTelefono = signal('');
  editPassword = signal('');
  editRole = signal<RolUsuario>('ROLE_USUARIO');

  /** Indica si la pestaña activa es la de Empleados. */
  esVistaEmpleados = computed(() => this.rolFiltro() === 'ROLE_EMPLEADO');

  /** Filtrados por texto, tipo de documento y ordenados. */
  porTexto = computed(() => {
    const texto = this.normalizar(this.busqueda());
    const tipoDoc = this.identificadorFiltro();

    const lista = this.usuarios().filter(u => {
      const coincideTexto = !texto || this.normalizar(this.textoBuscable(u)).includes(texto);
      const coincideDoc = tipoDoc === 'TODOS' || (u.identificador ?? 'DNI') === tipoDoc;
      return coincideTexto && coincideDoc;
    });
    return this.ordenar(lista, this.orden());
  });

  /** Lo que se muestra en la tabla: texto + doc + rol + orden. */
  visibles = computed(() => {
    const rol = this.rolFiltro();
    return rol === 'TODOS' ? this.porTexto() : this.porTexto().filter(u => u.role === rol);
  });

  hayFiltros = computed(
    () =>
      !!this.busqueda() ||
      this.rolFiltro() !== 'TODOS' ||
      this.identificadorFiltro() !== 'TODOS' ||
      this.orden() !== 'NOMBRE_ASC'
  );

  @HostListener('window:keydown.escape')
  onEscape(): void {
    if (this.modalAltaAbierto()) this.cerrarModalAlta();
    if (this.modalEdicionAbierto()) this.cerrarModalEdicion();
    if (this.modalBajaAbierto()) this.cerrarModalBaja();
  }

  ngOnInit(): void {
    this.cargar();
  }

  cargar(): void {
    this.cargando.set(true);
    this.error.set(false);

    this.usuarioService.getTodos().subscribe({
      next: lista => {
        this.usuarios.set(lista);
        this.cargando.set(false);
      },
      error: () => {
        this.error.set(true);
        this.cargando.set(false);
      },
    });
  }

  limpiarFiltros(): void {
    this.busqueda.set('');
    this.rolFiltro.set('TODOS');
    this.identificadorFiltro.set('TODOS');
    this.orden.set('NOMBRE_ASC');
  }

  // ── Handlers de filtros ──
  valor(event: Event): string {
    return (event.target as HTMLInputElement | HTMLSelectElement).value;
  }

  onRol(event: Event): void {
    this.rolFiltro.set(this.valor(event) as FiltroRol);
  }

  onIdentificador(event: Event): void {
    this.identificadorFiltro.set(this.valor(event) as FiltroIdentificador);
  }

  onOrden(event: Event): void {
    this.orden.set(this.valor(event) as Orden);
  }

  // ── Gestión Modal Alta ──
  abrirModalAlta(): void {
    this.limpiarAlertas();
    this.formularioError.set(null);
    this.altaNombre.set('');
    this.altaApellido.set('');
    this.altaIdentificador.set('DNI');
    this.altaNumeroIdentificador.set('');
    this.altaFechaNacimiento.set('');
    this.altaSexo.set('MASCULINO');
    this.altaEmail.set('');
    this.altaTelefono.set('');
    this.altaPassword.set('');
    this.altaRole.set(this.rolFiltro() === 'ROLE_EMPLEADO' ? 'ROLE_EMPLEADO' : 'ROLE_USUARIO');
    this.modalAltaAbierto.set(true);
  }

  cerrarModalAlta(): void {
    this.modalAltaAbierto.set(false);
    this.formularioError.set(null);
  }

  crearUsuario(): void {
    if (
      !this.altaNombre().trim() ||
      !this.altaApellido().trim() ||
      !this.altaNumeroIdentificador().trim() ||
      !this.altaFechaNacimiento() ||
      !this.altaEmail().trim() ||
      !this.altaTelefono().trim() ||
      !this.altaPassword().trim()
    ) {
      this.formularioError.set('Por favor completá todos los campos obligatorios.');
      return;
    }

    if (this.altaPassword().trim().length < 6) {
      this.formularioError.set('La contraseña debe tener al menos 6 caracteres.');
      return;
    }

    const payload: CrearUsuarioRequest = {
      nombre: this.altaNombre().trim(),
      apellido: this.altaApellido().trim(),
      identificador: this.altaIdentificador(),
      numeroIdentificador: this.altaNumeroIdentificador().trim(),
      fechaNacimiento: this.altaFechaNacimiento(),
      sexo: this.altaSexo(),
      email: this.altaEmail().trim().toLowerCase(),
      telefono: this.altaTelefono().trim(),
      password: this.altaPassword().trim(),
      role: this.altaRole(),
    };

    this.guardando.set(true);
    this.formularioError.set(null);

    this.usuarioService.crearUsuario(payload).subscribe({
      next: () => {
        this.guardando.set(false);
        this.cerrarModalAlta();
        this.mensajeExito.set('adminUsers.successCreated');
        this.cargar();
      },
      error: (err: HttpErrorResponse) => {
        this.guardando.set(false);
        const msg = err.error?.message || err.error?.error || 'adminUsers.errorGeneric';
        this.formularioError.set(msg);
      },
    });
  }

  // ── Gestión Modal Edición ──
  abrirModalEdicion(u: Usuario): void {
    this.limpiarAlertas();
    this.formularioError.set(null);
    this.usuarioSeleccionado.set(u);

    this.editNombre.set(u.nombre === 'Pendiente' ? '' : u.nombre);
    this.editApellido.set(u.apellido === 'Pendiente' ? '' : u.apellido);
    this.editIdentificador.set(u.identificador ?? 'DNI');
    this.editNumeroIdentificador.set(u.numeroIdentificador ?? '');
    this.editFechaNacimiento.set(u.fechaNacimiento ?? '');
    this.editSexo.set(u.sexo ?? 'MASCULINO');
    this.editEmail.set(u.email);
    this.editTelefono.set(u.telefono === 'Pendiente' ? '' : u.telefono);
    this.editPassword.set('');
    this.editRole.set(u.role === 'ROLE_INCOMPLETO' ? 'ROLE_USUARIO' : u.role);

    this.modalEdicionAbierto.set(true);
  }

  cerrarModalEdicion(): void {
    this.modalEdicionAbierto.set(false);
    this.usuarioSeleccionado.set(null);
    this.formularioError.set(null);
  }

  guardarEdicion(): void {
    const usuario = this.usuarioSeleccionado();
    if (!usuario) return;

    if (
      !this.editNombre().trim() ||
      !this.editApellido().trim() ||
      !this.editNumeroIdentificador().trim() ||
      !this.editFechaNacimiento() ||
      !this.editEmail().trim() ||
      !this.editTelefono().trim()
    ) {
      this.formularioError.set('Por favor completá todos los campos obligatorios.');
      return;
    }

    if (this.editPassword().trim() && this.editPassword().trim().length < 6) {
      this.formularioError.set('La nueva contraseña debe tener al menos 6 caracteres.');
      return;
    }

    const payload: ActualizarUsuarioRequest = {
      nombre: this.editNombre().trim(),
      apellido: this.editApellido().trim(),
      identificador: this.editIdentificador(),
      numeroIdentificador: this.editNumeroIdentificador().trim(),
      fechaNacimiento: this.editFechaNacimiento(),
      sexo: this.editSexo(),
      email: this.editEmail().trim().toLowerCase(),
      telefono: this.editTelefono().trim(),
      password: this.editPassword().trim() ? this.editPassword().trim() : undefined,
      role: this.editRole(),
    };

    this.guardando.set(true);
    this.formularioError.set(null);

    this.usuarioService.actualizarUsuario(usuario.id, payload).subscribe({
      next: () => {
        this.guardando.set(false);
        this.cerrarModalEdicion();
        this.mensajeExito.set('adminUsers.successUpdated');
        this.cargar();
      },
      error: (err: HttpErrorResponse) => {
        this.guardando.set(false);
        const msg = err.error?.message || err.error?.error || 'adminUsers.errorGeneric';
        this.formularioError.set(msg);
      },
    });
  }

  // ── Gestión Modal Baja ──
  abrirModalBaja(u: Usuario): void {
    this.limpiarAlertas();
    this.formularioError.set(null);
    this.usuarioSeleccionado.set(u);
    this.modalBajaAbierto.set(true);
  }

  cerrarModalBaja(): void {
    this.modalBajaAbierto.set(false);
    this.usuarioSeleccionado.set(null);
    this.formularioError.set(null);
  }

  confirmarBaja(): void {
    const usuario = this.usuarioSeleccionado();
    if (!usuario) return;

    this.eliminando.set(true);
    this.formularioError.set(null);

    this.usuarioService.eliminarUsuario(usuario.id).subscribe({
      next: () => {
        this.eliminando.set(false);
        this.cerrarModalBaja();
        this.mensajeExito.set('adminUsers.successDeleted');
        this.cargar();
      },
      error: (err: HttpErrorResponse) => {
        this.eliminando.set(false);
        const msg = err.error?.message || err.error?.error || 'adminUsers.errorGeneric';
        this.formularioError.set(msg);
      },
    });
  }

  limpiarAlertas(): void {
    this.mensajeExito.set(null);
    this.mensajeError.set(null);
  }

  // ── Helpers de renderizado ──
  cantidad(rol: RolUsuario): number {
    return this.porTexto().filter(u => u.role === rol).length;
  }

  rolKey(rol: string): TranslationKey {
    return `role.${rol}` as TranslationKey;
  }

  tabKey(rol: string): TranslationKey {
    return `adminUsers.role.${rol}` as TranslationKey;
  }

  perfilIncompleto(u: Usuario): boolean {
    return u.role === 'ROLE_INCOMPLETO' || (u.nombre === 'Pendiente' && u.apellido === 'Pendiente');
  }

  nombreCompleto(u: Usuario): string {
    if (this.perfilIncompleto(u)) return u.email;
    return `${u.apellido}, ${u.nombre}`;
  }

  iniciales(u: Usuario): string {
    if (this.perfilIncompleto(u)) return u.email.charAt(0).toUpperCase();
    return `${u.nombre.charAt(0)}${u.apellido.charAt(0)}`.toUpperCase();
  }

  placeholderBusqueda(): string {
    return this.esVistaEmpleados()
      ? 'adminUsers.searchEmployeesPlaceholder'
      : 'adminUsers.searchPlaceholder';
  }

  private ordenar(lista: Usuario[], orden: Orden): Usuario[] {
    const porNombre = (a: Usuario, b: Usuario) =>
      `${a.apellido} ${a.nombre}`.localeCompare(`${b.apellido} ${b.nombre}`);

    switch (orden) {
      case 'NOMBRE_DESC': return [...lista].sort((a, b) => porNombre(b, a));
      case 'RECIENTES':   return [...lista].sort((a, b) => b.id - a.id);
      case 'ANTIGUOS':    return [...lista].sort((a, b) => a.id - b.id);
      default:            return [...lista].sort(porNombre);
    }
  }

  private textoBuscable(u: Usuario): string {
    return `${u.nombre} ${u.apellido} ${u.email} ${u.telefono} ${u.numeroIdentificador ?? ''} ${u.id}`;
  }

  private normalizar(s: string): string {
    return (s ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
  }
}
