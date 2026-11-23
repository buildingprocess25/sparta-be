const { PrismaClient } = require('./node_modules/@prisma/client');
const prisma = new PrismaClient();
async function main() {
    const rabs = await prisma.rABProjectPlanning.findMany({
        where: { ulok: 'Z001-0709-0000' },
        orderBy: { id: 'desc' },
        take: 1
    });
    if (rabs.length === 0) {
        console.log('Tidak ada data RAB untuk ulok ini.');
        return;
    }
    const rab = rabs[0];
    console.log('RAB ID: ' + rab.id);
    console.log('Lingkup: ' + rab.lingkup_pekerjaan);
    if (rab.detail_items) {
        const details = typeof rab.detail_items === 'string' ? JSON.parse(rab.detail_items) : rab.detail_items;
        console.log('Detail Items Count: ' + details.length);
        const sipilCount = details.filter(d => d.lingkup_pekerjaan === 'SIPIL').length;
        const meCount = details.filter(d => d.lingkup_pekerjaan === 'ME').length;
        const unknownCount = details.filter(d => !d.lingkup_pekerjaan).length;
        console.log('- SIPIL: ' + sipilCount);
        console.log('- ME: ' + meCount);
        console.log('- UNKNOWN: ' + unknownCount);
        console.log('\nSample Items:');
        details.slice(0, 5).forEach(d => {
            console.log('[' + (d.lingkup_pekerjaan || 'UNKNOWN') + '] ' + d.kategori_pekerjaan + ' - ' + d.jenis_pekerjaan);
        });
    }
}
main().catch(console.error).finally(() => prisma.$disconnect());
