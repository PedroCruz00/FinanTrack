import { ipKeyGenerator, rateLimit } from 'express-rate-limit';

const tooMany = (message) => (_req, res) => res.status(429).json({ error: message });

/**
 * Intentos fallidos de contraseña: 10 cada 15 minutos por IP y correo.
 * Los inicios de sesión correctos no cuentan.
 */
export const passwordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  skipSuccessfulRequests: true,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  keyGenerator: (req) => {
    const who = req.user?.id ?? String(req.body?.email ?? '').trim().toLowerCase();
    return `${ipKeyGenerator(req.ip)}|${who}`;
  },
  handler: tooMany('Demasiados intentos. Espera unos minutos y vuelve a intentarlo.'),
});

/** Creación de cuentas: 30 por hora desde una misma IP. */
export const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 30,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  handler: tooMany('Se crearon demasiadas cuentas desde esta red. Intenta más tarde.'),
});
