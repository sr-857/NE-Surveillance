/**
 * Seeds reference region data (states + notable districts) for Northeast India.
 * Run via: npm run db:seed (see package.json). Idempotent — safe to re-run.
 */
import { PrismaClient, RegionType } from '@prisma/client';

const prisma = new PrismaClient();

const STATES = [
  { code: 'ASM', name: 'Assam', lat: 26.1445, lon: 91.7362 },
  { code: 'MEG', name: 'Meghalaya', lat: 25.5788, lon: 91.8933 },
  { code: 'MIZ', name: 'Mizoram', lat: 23.7271, lon: 92.7176 },
  { code: 'NAG', name: 'Nagaland', lat: 25.6751, lon: 94.1086 },
  { code: 'MNP', name: 'Manipur', lat: 24.8170, lon: 93.9368 },
  { code: 'TRI', name: 'Tripura', lat: 23.8315, lon: 91.2868 },
  { code: 'ARP', name: 'Arunachal Pradesh', lat: 27.0844, lon: 93.6053 },
  { code: 'SKM', name: 'Sikkim', lat: 27.3389, lon: 88.6065 },
];

const DISTRICTS = [
  { code: 'ASM-DIBRUGARH', name: 'Dibrugarh', parent: 'ASM', lat: 27.4728, lon: 94.9120 },
  { code: 'ASM-SILCHAR', name: 'Silchar', parent: 'ASM', lat: 24.8333, lon: 92.7789 },
  { code: 'ASM-TEZPUR', name: 'Tezpur', parent: 'ASM', lat: 26.6528, lon: 92.7926 },
  { code: 'ASM-JORHAT', name: 'Jorhat', parent: 'ASM', lat: 26.7509, lon: 94.2037 },
  { code: 'MEG-TURA', name: 'Tura', parent: 'MEG', lat: 25.5138, lon: 90.2035 },
  { code: 'MIZ-LUNGLEI', name: 'Lunglei', parent: 'MIZ', lat: 22.8874, lon: 92.7343 },
  { code: 'NAG-DIMAPUR', name: 'Dimapur', parent: 'NAG', lat: 25.9091, lon: 93.7266 },
  { code: 'NAG-MOKOKCHUNG', name: 'Mokokchung', parent: 'NAG', lat: 26.3260, lon: 94.5290 },
  { code: 'MNP-CHURACHANDPUR', name: 'Churachandpur', parent: 'MNP', lat: 24.3333, lon: 93.6833 },
  { code: 'TRI-UDAIPUR', name: 'Udaipur', parent: 'TRI', lat: 23.5333, lon: 91.4833 },
  { code: 'ARP-TAWANG', name: 'Tawang', parent: 'ARP', lat: 27.5859, lon: 91.8594 },
  { code: 'ARP-PASIGHAT', name: 'Pasighat', parent: 'ARP', lat: 28.0667, lon: 95.3333 },
  { code: 'SKM-NAMCHI', name: 'Namchi', parent: 'SKM', lat: 27.1667, lon: 88.3667 },
];

async function main() {
  for (const s of STATES) {
    await prisma.region.upsert({
      where: { code: s.code },
      update: { name: s.name, lat: s.lat, lon: s.lon },
      create: { ...s, type: RegionType.STATE },
    });
  }
  for (const d of DISTRICTS) {
    await prisma.region.upsert({
      where: { code: d.code },
      update: { name: d.name, lat: d.lat, lon: d.lon, parentCode: d.parent },
      create: {
        code: d.code,
        name: d.name,
        lat: d.lat,
        lon: d.lon,
        parentCode: d.parent,
        type: RegionType.DISTRICT,
      },
    });
  }
  console.log(`Seeded ${STATES.length} states and ${DISTRICTS.length} districts.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
