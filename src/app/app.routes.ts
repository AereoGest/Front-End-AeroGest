import { Routes } from '@angular/router';
import { Home } from './pages/home/home';
import { RegistrationForm } from './pages/registration-form/registration-form';
import { VerPerfil } from './pages/verPerfil/verPerfil';
import { LoginForm } from './pages/login-form/login-form';
import { Vuelos } from './pages/vuelos/vuelos';
import { Verify } from './pages/verify/verify';
import { Reservas } from './pages/historialReservas/reservas';
import { MiCarrito } from './pages/carrito/carrito';
import { authGuard } from './guards/auth.guard';
import { ForgotPassword } from './pages/forgot-password/forgot-password';
import { ResetPassword } from './pages/reset-password/reset-password';
import { Reserva } from './pages/reserva/reserva';
import { Asientos } from './pages/asientos/asientos';
import { Pago } from './pages/pago/pago';
import { checkoutPagoGuard } from './guards/checkoutPagoGuard';
import { adminGuard } from './guards/admin.guard';
import { VuelosAdmin } from './pages/Admin/vuelos-admin/vuelos-admin';
import { AdminPanel } from './pages/Admin/admin-panel/admin-panel';
import { Favoritos } from './pages/favoritos/favoritos';
import { CheckinMostrador} from './pages/check-in-mostrador/check-in-mostrador';
import { AsignacionService } from './services/asignacion-service';
import { MisAsignaciones } from './pages/mis-asignaciones/mis-asignaciones';

export const routes: Routes = [
    { path: "", component: Home },
    { path: "register", component: RegistrationForm },
    { path: "perfil", component: VerPerfil, canActivate: [authGuard] },
    { path: "login", component: LoginForm },
    { path: "vuelos", component: Vuelos },
    { path: "adminPanel", component: AdminPanel, canActivate: [adminGuard] },
    { path: "vuelosAdmin", component: VuelosAdmin, canActivate: [adminGuard] },
    { path: "verify", component: Verify },
    { path: "checkoutReserva", component: Reserva, canActivate: [authGuard] },
    {path: "checkoutReserva/pago", component: Pago, canActivate: [checkoutPagoGuard, authGuard] },
    { path: "reservas", component: Reservas, canActivate: [authGuard] },
    { path: "carrito", component: MiCarrito, canActivate: [authGuard] },
    {path: "favoritos", component: Favoritos, canActivate: [authGuard]},
    {path: "forgot-password", component: ForgotPassword},
    {path: "reset-password", component: ResetPassword},
    {path: "asientos", component: Asientos},
    {path: "check-in", component: CheckinMostrador, canActivate: [authGuard]},
    {path: "mis-asignaciones", component: MisAsignaciones, canActivate: [authGuard]},
    { path: "**", redirectTo: "" }
];
