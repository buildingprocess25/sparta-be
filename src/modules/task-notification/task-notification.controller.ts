import type { Request, Response } from "express";
import { asyncHandler } from "../../common/async-handler";
import { taskNotificationRepository } from "./task-notification.repository";

export const getTaskNotifications = asyncHandler(async (req: Request, res: Response) => {
    const user = req.user;
    if (!user) {
        res.status(401).json({
            status: "error",
            message: "Sesi tidak valid atau sudah berakhir."
        });
        return;
    }

    const supportKtkReady = await taskNotificationRepository.findSupportKtkReady(user);

    res.json({
        status: "success",
        data: {
            groups: [
                {
                    key: "support_ktk_ready",
                    title: "KTK Siap Difinalisasi",
                    description: "Proyek yang semua item opname-nya sudah disetujui kontraktor.",
                    count: supportKtkReady.length,
                    items: supportKtkReady.map((item) => ({
                        id: `support-ktk-${item.opname_final_id}`,
                        entity_type: "OPNAME_FINAL_READY",
                        entity_id: item.opname_final_id,
                        id_toko: item.id_toko,
                        title: item.nama_toko || item.nomor_ulok || "Proyek",
                        subtitle: [item.nomor_ulok, item.lingkup_pekerjaan, item.cabang].filter(Boolean).join(" | "),
                        description: `${item.approved_item_count}/${item.expected_item_count} item disetujui kontraktor`,
                        action_label: "Proses KTK",
                        action_url: `/opname?id_toko=${item.id_toko}&opname_final_id=${item.opname_final_id}`,
                        metadata: item
                    }))
                }
            ]
        }
    });
});
