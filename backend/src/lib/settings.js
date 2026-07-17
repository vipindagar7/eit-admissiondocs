import { prisma } from '../config/db.js';

const DEFAULTS = {
  fileNameFormat: '{admissionNo}_{name}_{docType}',
  idleLockMinutes: '5',
};

export async function getSetting(key) {
  const row = await prisma.setting.findUnique({ where: { key } });
  return row?.value ?? DEFAULTS[key] ?? null;
}

export async function getAllSettings() {
  const rows = await prisma.setting.findMany();
  const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  return { ...DEFAULTS, ...map };
}

export async function setSetting(key, value) {
  return prisma.setting.upsert({
    where: { key },
    update: { value: String(value) },
    create: { key, value: String(value) },
  });
}