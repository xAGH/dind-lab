#!/usr/bin/env node
// Genera el hash bcrypt para ADMIN_PASSWORD_HASH.
// Uso: npm run hash-password -- "mi-clave-secreta"
import bcrypt from 'bcryptjs';

const password = process.argv[2];
if (!password) {
  console.error('Uso: npm run hash-password -- "mi-clave-secreta"');
  process.exit(1);
}

const hash = bcrypt.hashSync(password, 10);
console.log(hash);
