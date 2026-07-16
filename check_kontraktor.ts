import { GoogleProvider } from './src/common/google';
import { env } from './src/config/env';
import * as path from 'path';

async function test() {
    try {
        await GoogleProvider.initialize();
        const google = GoogleProvider.instance;
        
        const allValues = await google.getAllValues(
            google['spartaSheets']!,
            env.KONTRAKTOR_SHEET_ID,
            env.KONTRAKTOR_SHEET_NAME,
        );

        const headers = allValues[1] || [];
        const records = allValues.slice(2).map((row) => {
            const record: Record<string, string> = {};
            headers.forEach((header, index) => {
                record[String(header || "")] = String(row[index] || "");
            });
            return record;
        });

        console.log("Total records:", records.length);
        const cvSat = records.filter(r => (r['NAMA KONTRAKTOR'] || '').toUpperCase().includes('BERKAH'));
        console.log("Records matching 'BERKAH':", JSON.stringify(cvSat, null, 2));

        const karawangKontraktor = await google.getKontraktorByCabang('KARAWANG');
        console.log("Kontraktor for KARAWANG:", karawangKontraktor);
    } catch (e) {
        console.error(e);
    }
}

test();
