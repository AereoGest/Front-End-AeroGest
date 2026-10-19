import { Routes } from '@angular/router';
import { Home } from './pages/home/home';
import { RegistrationForm } from './pages/registration-form/registration-form';
import { LoginForm } from './pages/login-form/login-form';


export const routes: Routes = [
    {path: "", component: Home},
    {path: "register", component: RegistrationForm},
    {path: "login", component: LoginForm}
];
