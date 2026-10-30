import { Routes } from '@angular/router';
import { Home } from './pages/home/home';
import { RegistrationForm } from './pages/registration-form/registration-form';
import { VerPerfil } from './pages/verPerfil/verPerfil';
import { LoginForm } from './pages/login-form/login-form';
import { Vuelos } from './pages/vuelos/vuelos';
import { Verify } from './pages/verify/verify';
import { Reservas } from './pages/reservas/reservas';
import { MiCarrito } from './pages/carrito/carrito';
import { authGuard } from './guards/auth.guard';
import { ForgotPassword } from './pages/forgot-password/forgot-password';
import { ResetPassword } from './pages/reset-password/reset-password';
import { Reserva } from './pages/reserva/reserva';

export const routes: Routes = [
    { path: "", component: Home },
    { path: "register", component: RegistrationForm },
    { path: "perfil", component: VerPerfil, canActivate: [authGuard] },
    { path: "login", component: LoginForm },
    { path: "vuelos", component: Vuelos },
    { path: "verify", component: Verify },
    { path: "checkoutReserva", component: Reserva, canActivate: [authGuard] },
    { path: "reservas", component: Reservas, canActivate: [authGuard] },
    { path: "carrito", component: MiCarrito, canActivate: [authGuard] },
    {path: "forgot-password", component: ForgotPassword},
    {path: "reset-password", component: ResetPassword},
    { path: "**", redirectTo: "" }
];
