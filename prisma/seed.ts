import 'dotenv/config';

import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import * as argon2 from 'argon2';

import { PrismaClient } from '../src/generated/prisma/client.js';
import { AdminRole } from '../src/generated/prisma/enums.js';

const adapter: PrismaMariaDb = new PrismaMariaDb({
  host: process.env.DATABASE_HOST,
  port: Number(process.env.DATABASE_PORT),
  user: process.env.DATABASE_USER,
  password: process.env.DATABASE_PASSWORD,
  database: process.env.DATABASE_NAME,
  connectionLimit: Number(process.env.DATABASE_CONNECTION_LIMIT),
});

const prisma: PrismaClient = new PrismaClient({
  adapter: adapter,
});

async function seedAdmin(): Promise<void> {

  const username: string = process.env.SEED_ADMIN_USERNAME!.trim().toLowerCase();
  const password: string = process.env.SEED_ADMIN_PASSWORD!;

  const existingAdmin = await prisma.adminUser.findUnique({
    where: {
      username: username,
    },
  });

  if (existingAdmin !== null) {

    return;

  }

  const passwordHash: string = await argon2.hash(password, {
    type: argon2.argon2id,
  });

  await prisma.adminUser.create({
    data: {
      username: username,
      passwordHash: passwordHash,
      role: AdminRole.OWNER,
      isActive: true,
      mustChangePassword: true,
    },
  });

}

async function seedProfile(): Promise<void> {

  const existingProfile = await prisma.profile.findUnique({
    where: {
      id: 'default',
    },
  });

  if (existingProfile !== null) {

    return;

  }

  await prisma.profile.create({
    data: {
      id: 'default',
      name: 'Portfolio',
    },
  });

}

async function main(): Promise<void> {

  await seedAdmin();
  await seedProfile();

}

try {

  await main();

} finally {

  await prisma.$disconnect();

}