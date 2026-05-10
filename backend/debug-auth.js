const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

async function main() {
  const user = await prisma.user.findUnique({ where: { email: 'client1@example.com' } });
  if (!user) {
    console.log('User not found.');
    return;
  }
  console.log('Stored hash:', user.passwordHash);
  const match = await bcrypt.compare('Client@12345', user.passwordHash);
  console.log('Password match:', match);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
