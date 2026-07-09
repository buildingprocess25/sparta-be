import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const ulok = await prisma.uLOK.findFirst({
    where: { no_ulok: '2JZ1-2603-0003' },
    include: {
      opnameFinalHeaders: true,
      serahTerimaHeaders: true,
      pengawasanHeaders: true,
      spk: true
    }
  });
  console.log(JSON.stringify(ulok, null, 2));
}
main().catch(console.error).finally(() => prisma.$disconnect());
