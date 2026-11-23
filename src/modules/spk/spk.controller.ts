import { assertSpkBranches, assertSpkRole } from './spk-access';
import { spkGroupRepository } from './spk-group.repository';
import { tokoRepository } from '../toko/toko.repository';
import type { AuthenticatedUser } from '../auth/auth-session.service';

import type { Request, Response } from "express";
import { AppError } from "../../common/app-error";
import { asyncHandler } from "../../common/async-handler";
import { injectBranchFilter } from "../../common/branch-filter-helper";
import { spkApprovalSchema, spkInterventionSchema, spkListQuerySchema, submitSpkSchema } from "./spk.schema";
import { spkService } from "./spk.service";

async function assertDocumentAccess(user: AuthenticatedUser | undefined, id: string) {
    if (!user) throw new AppError('User tidak terautentikasi', 401);
    const members = await spkGroupRepository.members(id);
    const toko = await Promise.all(members.map(m => tokoRepository.findById(m.id_toko)));
    await assertSpkBranches(user, toko.map(t => t?.cabang));
}

export const submitSpk = asyncHandler(async (req: Request, res: Response) => {
    const payload = submitSpkSchema.parse(req.body);
    const data = await spkService.submit(payload, req.user);

    res.status(201).json({
        status: "success",
        message: "Pengajuan SPK berhasil disimpan",
        data
    });
});

export const listSpk = asyncHandler(async (req: Request, res: Response) => {
    let query = spkListQuerySchema.parse(req.query);
    
    const user = req.user;
    if (!user) {
        throw new AppError("User tidak terautentikasi", 401);
    }

    // Enforce branch filtering di backend
    query = await injectBranchFilter(user, query);
    
    const data = await spkService.list(query);

    res.json({ status: "success", data });
});

export const getSpkById = asyncHandler(async (req: Request, res: Response) => {
    await assertDocumentAccess(req.user, req.params.id);
    const data = await spkService.getById(req.params.id);

    res.json({ status: "success", data });
});

export const downloadSpkPdf = asyncHandler(async (req: Request, res: Response) => {
    await assertDocumentAccess(req.user, req.params.id);
    const result = await spkService.generatePdf(req.params.id);

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${result.filename}"`);
    res.send(result.pdfBuffer);
});

export const handleSpkApproval = asyncHandler(async (req: Request, res: Response) => {
    assertSpkRole(req.user, 'approval');
    await assertDocumentAccess(req.user, req.params.id);
    const action = spkApprovalSchema.parse({ ...req.body, approver_email: req.user.email_sat });
    const result = await spkService.handleApproval(req.params.id, action);

    res.json({
        status: "success",
        message: "Approval SPK berhasil diproses",
        data: result
    });
});

export const handleSpkIntervention = asyncHandler(async (req: Request, res: Response) => {
    assertSpkRole(req.user, 'intervention');
    await assertDocumentAccess(req.user, req.params.id);
    const action = spkInterventionSchema.parse({ ...req.body, actor_email: req.user.email_sat,
        actor_role: req.user.roles.find(r => /SUPER HUMAN|STORE & BRANCH CONTROLLING/i.test(r)) });
    const result = await spkService.intervene(req.params.id, action);

    res.json({
        status: "success",
        message: "Intervensi SPK berhasil diproses",
        data: result
    });
});

export const listSpkCandidates = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw new AppError('User tidak terautentikasi', 401);
    res.json({ status: 'success', data: await spkService.candidates(req.user) });
});
