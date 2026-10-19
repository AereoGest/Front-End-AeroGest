import { Routes } from '@angular/router';
import { Home } from './pages/home/home';
import { RegistrationForm } from './pages/registration-form/registration-form';
import { VerPerfil } from './pages/verPerfil/verPerfil';
import { LoginForm } from './pages/login-form/login-form';


export const routes: Routes = [
    {path: "", component: Home},
    {path: "register", component: RegistrationForm},
    {path: "perfil", component: VerPerfil}
    {path: "login", component: LoginForm}
];
