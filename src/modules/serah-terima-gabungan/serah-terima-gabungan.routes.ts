import { Router, Request, Response } from 'express';
import { SerahTerimaGabunganService } from './serah-terima-gabungan.service';
import multer from 'multer';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

router.get('/eligibility', async (req: Request, res: Response) => {
    try {
        const { nomor_ulok } = req.query;
        if (!nomor_ulok || typeof nomor_ulok !== 'string') {
             res.status(400).json({ success: false, error: 'nomor_ulok is required' });
             return;
        }
        const result = await SerahTerimaGabunganService.checkEligibilityAndGetTemplate(nomor_ulok);
        res.json({ success: true, data: result });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
});

router.post('/save', async (req: Request, res: Response) => {
    try {
        const { nomor_ulok } = req.query;
        const { state } = req.body;
        if (!nomor_ulok || typeof nomor_ulok !== 'string') {
             res.status(400).json({ success: false, error: 'nomor_ulok is required' });
             return;
        }
        await SerahTerimaGabunganService.saveDraft(nomor_ulok, state);
        res.json({ success: true });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
});

router.post('/upload-image', upload.single('image'), async (req: Request, res: Response) => {
    try {
        const { nomor_ulok } = req.query;
        if (!req.file) throw new Error('No file uploaded');
        const url = await SerahTerimaGabunganService.uploadImage(req.file, String(nomor_ulok || ''));
        res.json({ success: true, url });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
});

router.post('/submit', async (req: Request, res: Response) => {
    try {
        const { nomor_ulok } = req.query;
        if (!nomor_ulok || typeof nomor_ulok !== 'string') {
             res.status(400).json({ success: false, error: 'nomor_ulok is required' });
             return;
        }
        await SerahTerimaGabunganService.submitForm(nomor_ulok);
        res.json({ success: true });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
});

export const serahTerimaGabunganRouter = router;
