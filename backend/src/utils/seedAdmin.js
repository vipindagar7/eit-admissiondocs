import readline from 'node:readline/promises';
import bcrypt from 'bcryptjs';
import { prisma } from '../config/db.js';

// Run with: npm run seed:admin
// Prompts for email/password so credentials never sit in shell history or a file.
async function main() {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const email = await rl.question('Admin email: ');
  const password = await rl.question('Admin password (min 8 chars): ');
  rl.close();

  if (password.length < 8) {
    console.error('Password must be at least 8 characters.');
    process.exit(1);
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const staff = await prisma.staffUser.upsert({
    where: { email },
    update: { passwordHash, role: 'ADMIN', active: true },
    create: { email, passwordHash, role: 'ADMIN' },
  });

  console.log(`Admin ready: ${staff.email} (role: ${staff.role})`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
