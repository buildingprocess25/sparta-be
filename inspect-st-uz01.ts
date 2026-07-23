import { serahTerimaRepository } from "./src/modules/serah-terima/serah-terima.repository";
import { tokoRepository } from "./src/modules/toko/toko.repository";

async function run() {
  const tokos = await tokoRepository.findByNomorUlok("UZ01-2602-0012");
  for (const toko of tokos) {
     const st = await serahTerimaRepository.findByTokoId(toko.id);
     console.log("Toko:", toko.lingkup_pekerjaan, "ST:", JSON.stringify(st, null, 2));
  }
}
run().catch(console.error).finally(() => process.exit(0));
