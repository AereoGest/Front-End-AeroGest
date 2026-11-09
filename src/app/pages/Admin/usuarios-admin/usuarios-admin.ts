import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { TranslatePipe } from '../../../pipes/translate.pipe';
import type { TranslationKey } from '../../../i18n/es';
import { UsuarioService } from '../../../services/usuario-service';
import { RolUsuario, Usuario } from '../../../Models/Usuario';

type FiltroRol = 'TODOS' | RolUsuario;
type Orden = 'NOMBRE_ASC' | 'NOMBRE_DESC' | 'RECIENTES' | 'ANTIGUOS';

@Component({
  selector: 'app-usuarios-admin',
  standalone: true,
  imports: [TranslatePipe],
  templateUrl: './usuarios-admin.html',
  styleUrl: './usuarios-admin.css',
})
export class UsuariosAdmin implements OnInit {
  private usuarioService = inject(UsuarioService);

  /** Orden de las pestañas y del select: primero los clientes. */
  readonly roles: RolUsuario[] = ['ROLE_USUARIO', 'ROLE_EMPLEADO', 'ROLE_ADMIN', 'ROLE_INCOMPLETO'];

  readonly ordenes: { valor: Orden; key: TranslationKey }[] = [
    { valor: 'NOMBRE_ASC', key: 'adminUsers.sortNameAsc' },
    { valor: 'NOMBRE_DESC', key: 'adminUsers.sortNameDesc' },
    { valor: 'RECIENTES', key: 'adminUsers.sortNewest' },
    { valor: 'ANTIGUOS', key: 'adminUsers.sortOldest' },
  ];

  usuarios = signal<Usuario[]>([]);
  cargando = signal(true);
  error = signal(false);

  // ---- Filtros ----
  busqueda = signal('');
  rolFiltro = signal<FiltroRol>('TODOS');
  orden = signal<Orden>('NOMBRE_ASC');

  /** Filtrados por texto y ordenados (sin el rol), para los contadores de las pestañas. */
  porTexto = computed(() => {
    const texto = this.normalizar(this.busqueda());
    const lista = this.usuarios().filter(
      u => !texto || this.normalizar(this.textoBuscable(u)).includes(texto)
    );
    return this.ordenar(lista, this.orden());
  });

  /** Lo que se muestra en la tabla: texto + rol + orden. */
  visibles = computed(() => {
    const rol = this.rolFiltro();
    return rol === 'TODOS' ? this.porTexto() : this.porTexto().filter(u => u.role === rol);
  });

  hayFiltros = computed(
    () => !!this.busqueda() || this.rolFiltro() !== 'TODOS' || this.orden() !== 'NOMBRE_ASC'
  );

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
    this.orden.set('NOMBRE_ASC');
  }

  // ---- Handlers ----
  valor(event: Event): string {
    return (event.target as HTMLInputElement | HTMLSelectElement).value;
  }

  onRol(event: Event): void {
    this.rolFiltro.set(this.valor(event) as FiltroRol);
  }

  onOrden(event: Event): void {
    this.orden.set(this.valor(event) as Orden);
  }

  // ---- Helpers ----
  cantidad(rol: RolUsuario): number {
    return this.porTexto().filter(u => u.role === rol).length;
  }

  /** Singular para el badge ("Usuario", "Empleado"...). */
  rolKey(rol: string): TranslationKey {
    return `role.${rol}` as TranslationKey;
  }

  /** Plural para pestañas y select ("Clientes", "Empleados"...). */
  tabKey(rol: string): TranslationKey {
    return `adminUsers.role.${rol}` as TranslationKey;
  }

  /** Al registrarse, el back crea la persona como "Pendiente Pendiente" hasta que completa el perfil. */
  perfilIncompleto(u: Usuario): boolean {
    return u.role === 'ROLE_INCOMPLETO' || (u.nombre === 'Pendiente' && u.apellido === 'Pendiente');
  }

  iniciales(u: Usuario): string {
    if (this.perfilIncompleto(u)) return u.email.charAt(0).toUpperCase();
    return `${u.nombre.charAt(0)}${u.apellido.charAt(0)}`.toUpperCase();
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
    return `${u.nombre} ${u.apellido} ${u.email} ${u.telefono} ${u.id}`;
  }

  /** Minúsculas y sin tildes, para que "martin" encuentre "Martín". */
  private normalizar(s: string): string {
    return (s ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
  }
}