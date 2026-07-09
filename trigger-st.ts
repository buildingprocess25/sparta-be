import { serahTerimaService } from './src/modules/serah-terima/serah-terima.service';
import { GoogleProvider } from './src/common/google';

async function main() {
  console.log('Initializing Google Provider...');
  await GoogleProvider.initialize();
  
  const nomorUlok = '2JZ1-2603-0003';
  console.log(`Re-generating Unified PDF for ULOK: ${nomorUlok}...`);
  try {
    const res = await serahTerimaService.createPdfSerahTerimaUnified(nomorUlok);
    console.log('Success:', JSON.stringify(res, null, 2));
  } catch (err: any) {
    console.error('Error:', err?.message ?? err);
  }
}

main().then(() => {
  console.log('Done');
  process.exit(0);
});
