import { SerahTerimaGabunganRepository } from './serah-terima-gabungan.repository';
import * as fs from 'fs';
import * as path from 'path';
import { GoogleProvider } from '../../common/google';

export class SerahTerimaGabunganService {
    static async checkEligibilityAndGetTemplate(nomor_ulok: string) {
        const tokos = await SerahTerimaGabunganRepository.getTokoPair(nomor_ulok);
        const sipil = tokos.find((t: any) => t.lingkup_pekerjaan === 'SIPIL');
        const me = tokos.find((t: any) => t.lingkup_pekerjaan === 'ME');

        if (!sipil || !me) {
            return { eligible: false, message: 'SIPIL or ME store not found for this ulok.' };
        }

        // Di workflow contractor_first, form ini diisi SEBELUM Opname disetujui,
        // jadi kita matikan pengecekan ketat ini agar Kontraktor bisa mengisi.
        /*
        const sipilOpname = await SerahTerimaGabunganRepository.checkOpnameApproved(sipil.id);
        const meOpname = await SerahTerimaGabunganRepository.checkOpnameApproved(me.id);
        if (!sipilOpname || !meOpname) {
            return { eligible: false, message: 'Opname Final not approved for both Sipil and ME.' };
        }

        const sipilPengawasan = await SerahTerimaGabunganRepository.checkPengawasanDone(sipil.id);
        const mePengawasan = await SerahTerimaGabunganRepository.checkPengawasanDone(me.id);
        if (!sipilPengawasan || !mePengawasan) {
            return { eligible: false, message: 'Pengawasan not fully completed for both Sipil and ME.' };
        }
        */

        // Read template from constants
        const templatePath = path.join(__dirname, '../../constants/serah-terima-items.json');
        let templateItems = [];
        if (fs.existsSync(templatePath)) {
            templateItems = JSON.parse(fs.readFileSync(templatePath, 'utf8'));
        }

        const draftState = await SerahTerimaGabunganRepository.getDraft(nomor_ulok);

        return {
            eligible: true,
            tokoData: {
                nomor_ulok,
                id_toko_sipil: sipil.id,
                id_toko_me: me.id,
                nama_toko: sipil.nama_toko,
                cabang: sipil.cabang
            },
            templateItems,
            draftState
        };
    }

    static async saveDraft(nomor_ulok: string, state: any) {
        await SerahTerimaGabunganRepository.upsertDraft(nomor_ulok, state);
    }

    static async submitForm(nomor_ulok: string) {
        await SerahTerimaGabunganRepository.submitForm(nomor_ulok);
    }

    static async uploadImage(file: Express.Multer.File, nomor_ulok: string) {
        const gp = GoogleProvider.instance;
        const drive = gp.spartaDrive;
        if (!drive) throw new Error("Google Drive (Sparta) belum terkonfigurasi");

        const tokos = await SerahTerimaGabunganRepository.getTokoPair(nomor_ulok);
        const sipil = tokos.find((t: any) => t.lingkup_pekerjaan === 'SIPIL');
        const folderId = await gp.getOrCreateProcessFolder("Serah Terima Gabungan", nomor_ulok, sipil?.nama_toko || "", sipil?.kode_toko || "");

        const filename = `STG_${nomor_ulok}_${Date.now()}_${file.originalname}`;
        const result = await gp.uploadFile(
            folderId,
            filename,
            file.mimetype,
            file.buffer,
            2,
            drive,
            { makePublic: true }
        );
        return result.webViewLink || result.id;
    }
}
