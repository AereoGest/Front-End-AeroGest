import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { CheckoutService } from '../services/checkout-service';

// Solo deja entrar a /checkoutReserva/pago si el formulario de pasajeros se completó bien.
// Si no (por ejemplo, al recargar la página de pago), manda de vuelta a /checkoutReserva.
export const checkoutPagoGuard: CanActivateFn = () => {
  const checkout = inject(CheckoutService);
  const router = inject(Router);

  return checkout.pasajerosListos() || router.createUrlTree(['/checkoutReserva']);
};