const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();
const COST = 12;

// ─── Users ────────────────────────────────────────────────────────────────────

const users = [
  { email: 'admin@volcan.com',      password: 'Admin@12345',    name: 'Admin Volcan',    role: 'admin'    },
  { email: 'emp1@volcan.com',       password: 'Employee@12345', name: 'Carlos Ramirez',  role: 'employee' },
  { email: 'emp2@volcan.com',       password: 'Employee@12345', name: 'Luis Mendoza',    role: 'employee' },
  { email: 'client1@example.com',   password: 'Client@12345',   name: 'Ana Torres',      role: 'client'   },
  { email: 'client2@example.com',   password: 'Client@12345',   name: 'Pedro Gomez',     role: 'client'   },
  { email: 'client3@example.com',   password: 'Client@12345',   name: 'Maria Castillo',  role: 'client'   },
];

// ─── Services ─────────────────────────────────────────────────────────────────

const services = [
  {
    name: 'Lavado Exterior',
    description: 'Lavado a mano de carrocería, enjuague, secado y limpieza de rines y llantas.',
    durationMinutes: 30,
    prices: { sedan: 120, suv: 160, van: 200 },
  },
  {
    name: 'Lavado Completo',
    description: 'Lavado exterior más aspirado interior, limpieza de tablero, vidrios y tapetes.',
    durationMinutes: 60,
    prices: { sedan: 250, suv: 320, van: 400 },
  },
  {
    name: 'Detallado Profundo',
    description: 'Lavado completo más desengrasado de motor, limpieza de plásticos y cera de carrocería.',
    durationMinutes: 120,
    prices: { sedan: 550, suv: 750, van: 950 },
  },
  {
    name: 'Pulido y Encerado',
    description: 'Corrección de pintura, eliminación de rayones leves, encerado profesional y sellador.',
    durationMinutes: 180,
    prices: { sedan: 900, suv: 1200, van: 1500 },
  },
  {
    name: 'Detallado Premium',
    description: 'Servicio completo: pulido, encerado, ozono para interiores, acondicionador de cuero y protección de pintura.',
    durationMinutes: 240,
    prices: { sedan: 1800, suv: 2400, van: 3000 },
  },
];

// ─── Time Slots ───────────────────────────────────────────────────────────────
// dayOfWeek: 1 = Monday … 5 = Friday (matching JS Date.getDay())
// Business hours: 09:00 – 17:00 in 1-hour slots

const BUSINESS_DAYS = [1, 2, 3, 4, 5];
const SLOT_HOURS = ['09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00'];

function endTime(start) {
  const [h, m] = start.split(':').map(Number);
  return `${String(h + 1).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

const timeSlots = BUSINESS_DAYS.flatMap((day) =>
  SLOT_HOURS.map((start) => ({ dayOfWeek: day, startTime: start, endTime: endTime(start) }))
);

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('Seeding users…');
  for (const u of users) {
    const passwordHash = await bcrypt.hash(u.password, COST);
    await prisma.user.upsert({
      where: { email: u.email },
      update: {},
      create: { email: u.email, passwordHash, name: u.name, role: u.role },
    });
  }

  console.log('Seeding services…');
  await prisma.appointment.deleteMany(); // clear FK dependents before replacing services
  await prisma.service.deleteMany();
  await prisma.service.createMany({ data: services });

  console.log('Seeding time slots…');
  for (const slot of timeSlots) {
    await prisma.timeSlot.upsert({
      where: { dayOfWeek_startTime: { dayOfWeek: slot.dayOfWeek, startTime: slot.startTime } },
      update: {},
      create: slot,
    });
  }

  console.log(`Done. Seeded ${users.length} users, ${services.length} services, ${timeSlots.length} time slots.`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
