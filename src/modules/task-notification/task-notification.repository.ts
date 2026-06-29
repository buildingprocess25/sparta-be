import { getBranchScopeCandidates } from "../../common/branch-scope";
import { pool } from "../../db/pool";
import type { AuthenticatedUser } from "../auth/auth-session.service";

type SqlValue = string | number | string[] | null;

export type TaskNotificationItem = {
    id: string;
    entity_type: string;
    entity_id: number;
    id_toko?: number;
    title: string;
    subtitle: string;
    description: string;
    action_label: string;
    action_url: string;
    metadata?: Record<string, unknown>;
};

export type TaskNotificationGroup = {
    key: string;
    title: string;
    description: string;
    count: number;
    items: TaskNotificationItem[];
};

type NotificationRow = {
    entity_type: string;
    entity_id: number;
    id_toko: number | null;
    title: string | null;
    nomor_ulok: string | null;
    lingkup_pekerjaan: string | null;
    cabang: string | null;
    status: string | null;
    description: string | null;
    action_label: string;
    action_url: string;
    total_count: number | string;
};

const ITEM_LIMIT = 20;

const normalize = (value?: string | null) =>
    String(value ?? "").trim().replace(/\s+/g, " ").toUpperCase();

const hasRole = (user: AuthenticatedUser, matcher: string) =>
    user.roles.some(role => normalize(role).includes(normalize(matcher)));

const hasAnyRole = (user: AuthenticatedUser, matchers: string[]) =>
    matchers.some(matcher => hasRole(user, matcher));

const isSuperHuman = (user: AuthenticatedUser) => hasRole(user, "SUPER HUMAN");
const isRegionalManager = (user: AuthenticatedUser) => hasRole(user, "REGIONAL MANAGER");
const isHeadOffice = (user: AuthenticatedUser) => normalize(user.cabang) === "HEAD OFFICE";

const canViewAllBranches = (user: AuthenticatedUser) =>
    isHeadOffice(user)
    || hasAnyRole(user, [
        "BUILDING & MAINTENANCE SUPER HUMAN",
        "BUILDING & MAINTENANCE REGIONAL MANAGER",
        "BUILDING MAINTENANCE & ENERGY SYSTEM MANAGER",
        "BUILDING & MAINTENANCE GENERAL MANAGER",
        "STORE & BRANCH CONTROLLING SPECIALIST",
    ]);

type ApprovalStage = "KOORDINATOR" | "MANAGER" | "DIREKTUR" | "KONTRAKTOR" | "ALL" | null;

const getApprovalStage = (user: AuthenticatedUser): ApprovalStage => {
    if (isSuperHuman(user) || isRegionalManager(user)) return "ALL";
    if (hasRole(user, "DIREKTUR")) return "DIREKTUR";
    if (hasRole(user, "KONTRAKTOR")) return "KONTRAKTOR";
    if (hasRole(user, "BRANCH BUILDING & MAINTENANCE MANAGER") || hasRole(user, "MANAGER")) return "MANAGER";
    if (hasRole(user, "BRANCH BUILDING COORDINATOR") || hasRole(user, "COORDINATOR")) return "KOORDINATOR";
    return null;
};

const normalizeCompanySql = (expression: string) =>
    `regexp_replace(REPLACE(REPLACE(UPPER(COALESCE(${expression}, '')), 'PT', ''), 'CV', ''), '[^A-Z0-9]', '', 'g')`;

const addBranchScope = (user: AuthenticatedUser, values: SqlValue[], branchExpression: string): string => {
    if (canViewAllBranches(user)) return "";
    const branches = getBranchScopeCandidates(user.cabang);
    values.push(branches);
    return `AND UPPER(TRIM(COALESCE(${branchExpression}, ''))) = ANY($${values.length}::text[])`;
};

const addCompanyScope = (user: AuthenticatedUser, values: SqlValue[], companyExpression: string): string => {
    if (!hasRole(user, "KONTRAKTOR") || !user.nama_pt) return "";
    values.push(user.nama_pt);
    return `AND ${normalizeCompanySql(companyExpression)} = ${normalizeCompanySql(`$${values.length}::text`)}`;
};

const toCount = (rows: NotificationRow[]) => rows.length;

const toItems = (rows: NotificationRow[]): TaskNotificationItem[] =>
    rows.map(row => ({
        id: `${row.entity_type}-${row.entity_id}`,
        entity_type: row.entity_type,
        entity_id: Number(row.entity_id),
        id_toko: row.id_toko ? Number(row.id_toko) : undefined,
        title: row.title || row.nomor_ulok || "Dokumen",
        subtitle: [row.nomor_ulok, row.lingkup_pekerjaan, row.cabang].filter(Boolean).join(" | "),
        description: row.description || row.status || "Perlu tindakan",
        action_label: row.action_label,
        action_url: row.action_url,
        metadata: {
            status: row.status,
            cabang: row.cabang,
        },
    }));

const makeGroup = (
    key: string,
    title: string,
    description: string,
    rows: NotificationRow[]
): TaskNotificationGroup | null => {
    const count = toCount(rows);
    if (count <= 0) return null;
    return {
        key,
        title,
        description,
        count,
        items: toItems(rows),
    };
};

const mergeRows = (...sources: NotificationRow[][]) => sources.flat();

const queryNotificationRows = async (sql: string, values: SqlValue[]) => {
    const result = await pool.query<NotificationRow>(sql, values);
    return result.rows;
};

const findRabApproval = async (user: AuthenticatedUser): Promise<NotificationRow[]> => {
    const stage = getApprovalStage(user);
    if (!stage || stage === "KONTRAKTOR") return [];

    const values: SqlValue[] = [];
    const statuses = stage === "ALL"
        ? ["Menunggu Persetujuan Koordinator", "Menunggu Persetujuan Manajer", "Menunggu Persetujuan Direktur Kontraktor"]
        : stage === "KOORDINATOR"
            ? ["Menunggu Persetujuan Koordinator"]
            : stage === "MANAGER"
                ? ["Menunggu Persetujuan Manajer"]
                : ["Menunggu Persetujuan Direktur Kontraktor"];

    values.push(statuses);
    const branchWhere = addBranchScope(user, values, "t.cabang");
    const companyWhere = addCompanyScope(user, values, "r.nama_pt");
    values.push(ITEM_LIMIT);

    return queryNotificationRows(`
        SELECT
            'RAB' AS entity_type,
            r.id AS entity_id,
            r.id_toko,
            COALESCE(t.nama_toko, t.nomor_ulok) AS title,
            t.nomor_ulok,
            t.lingkup_pekerjaan,
            t.cabang,
            r.status,
            'RAB menunggu approval sesuai role Anda.' AS description,
            'Buka Approval RAB' AS action_label,
            '/approval?type=RAB&id=' || r.id AS action_url,
            COUNT(*) OVER() AS total_count
        FROM rab r
        JOIN toko t ON t.id = r.id_toko
        WHERE r.status = ANY($1::text[])
          ${branchWhere}
          ${companyWhere}
        ORDER BY r.created_at DESC, r.id DESC
        LIMIT $${values.length}
    `, values);
};

const findSpkApproval = async (user: AuthenticatedUser): Promise<NotificationRow[]> => {
    if (!isSuperHuman(user) && !hasRole(user, "BRANCH MANAGER")) return [];
    const values: SqlValue[] = [];
    const branchWhere = addBranchScope(user, values, "t.cabang");
    values.push(ITEM_LIMIT);

    return queryNotificationRows(`
        SELECT
            'SPK' AS entity_type,
            p.id AS entity_id,
            p.id_toko,
            COALESCE(t.nama_toko, p.nomor_ulok) AS title,
            p.nomor_ulok,
            p.lingkup_pekerjaan,
            t.cabang,
            p.status,
            'SPK menunggu approval Branch Manager.' AS description,
            'Buka Approval SPK' AS action_label,
            '/approval?type=SPK&id=' || p.id AS action_url,
            COUNT(*) OVER() AS total_count
        FROM pengajuan_spk p
        LEFT JOIN toko t ON t.id = p.id_toko
        WHERE p.status = 'WAITING_FOR_BM_APPROVAL'
          ${branchWhere}
        ORDER BY p.created_at DESC, p.id DESC
        LIMIT $${values.length}
    `, values);
};

const findPertambahanSpkApproval = async (user: AuthenticatedUser): Promise<NotificationRow[]> => {
    if (!isSuperHuman(user) && !hasRole(user, "BRANCH MANAGER")) return [];
    const values: SqlValue[] = [];
    const branchWhere = addBranchScope(user, values, "t.cabang");
    values.push(ITEM_LIMIT);

    return queryNotificationRows(`
        SELECT
            'PERTAMBAHAN_SPK' AS entity_type,
            p.id::int AS entity_id,
            s.id_toko,
            COALESCE(t.nama_toko, s.nomor_ulok, s.nomor_spk) AS title,
            s.nomor_ulok,
            s.lingkup_pekerjaan,
            t.cabang,
            p.status_persetujuan AS status,
            'Pertambahan SPK menunggu approval Branch Manager.' AS description,
            'Buka Approval Pertambahan SPK' AS action_label,
            '/approval?type=PERTAMBAHAN_SPK&id=' || p.id AS action_url,
            COUNT(*) OVER() AS total_count
        FROM pertambahan_spk p
        JOIN pengajuan_spk s ON s.id = p.id_spk
        LEFT JOIN toko t ON t.id = s.id_toko
        WHERE p.status_persetujuan = 'Menunggu Persetujuan'
          ${branchWhere}
        ORDER BY p.created_at DESC, p.id DESC
        LIMIT $${values.length}
    `, values);
};

const findOpnameApproval = async (user: AuthenticatedUser): Promise<NotificationRow[]> => {
    const stage = getApprovalStage(user);
    if (!stage) return [];

    const values: SqlValue[] = [];
    const statuses = stage === "ALL"
        ? ["Menunggu Persetujuan Koordinator", "Menunggu Persetujuan Manajer", "Menunggu Persetujuan Direktur Kontraktor"]
        : stage === "KOORDINATOR"
            ? ["Menunggu Persetujuan Koordinator"]
            : stage === "MANAGER"
                ? ["Menunggu Persetujuan Manajer"]
                : stage === "DIREKTUR" || stage === "KONTRAKTOR"
                    ? ["Menunggu Persetujuan Direktur Kontraktor"]
                    : [];

    if (statuses.length === 0) return [];

    values.push(statuses);
    const branchWhere = addBranchScope(user, values, "t.cabang");
    const companyWhere = addCompanyScope(user, values, "t.nama_kontraktor");
    values.push(ITEM_LIMIT);

    return queryNotificationRows(`
        SELECT
            'OPNAME' AS entity_type,
            ofn.id AS entity_id,
            ofn.id_toko,
            COALESCE(t.nama_toko, t.nomor_ulok) AS title,
            t.nomor_ulok,
            t.lingkup_pekerjaan,
            t.cabang,
            ofn.status_opname_final AS status,
            'KTK menunggu approval sesuai role Anda.' AS description,
            'Buka Approval KTK' AS action_label,
            '/approval?type=OPNAME&id=' || ofn.id AS action_url,
            COUNT(*) OVER() AS total_count
        FROM opname_final ofn
        JOIN toko t ON t.id = ofn.id_toko
        WHERE ofn.aksi = 'terkunci'
          AND ofn.tipe_opname = 'OPNAME_FINAL'
          AND ofn.status_opname_final = ANY($1::text[])
          ${branchWhere}
          ${companyWhere}
        ORDER BY ofn.created_at DESC, ofn.id DESC
        LIMIT $${values.length}
    `, values);
};

const findInstruksiLapanganApproval = async (user: AuthenticatedUser): Promise<NotificationRow[]> => {
    const stage = getApprovalStage(user);
    if (!stage || stage === "DIREKTUR" || stage === "KONTRAKTOR") return [];

    const values: SqlValue[] = [];
    const statuses = stage === "ALL"
        ? ["Menunggu Persetujuan Koordinator", "Menunggu Persetujuan Manager"]
        : stage === "KOORDINATOR"
            ? ["Menunggu Persetujuan Koordinator"]
            : ["Menunggu Persetujuan Manager"];

    values.push(statuses);
    const branchWhere = addBranchScope(user, values, "t.cabang");
    values.push(ITEM_LIMIT);

    return queryNotificationRows(`
        SELECT
            'INSTRUKSI_LAPANGAN' AS entity_type,
            il.id AS entity_id,
            il.id_toko,
            COALESCE(t.nama_toko, t.nomor_ulok) AS title,
            t.nomor_ulok,
            t.lingkup_pekerjaan,
            t.cabang,
            il.status,
            'Instruksi Lapangan menunggu approval sesuai role Anda.' AS description,
            'Buka Approval IL' AS action_label,
            '/approval?type=INSTRUKSI_LAPANGAN&id=' || il.id AS action_url,
            COUNT(*) OVER() AS total_count
        FROM instruksi_lapangan il
        JOIN toko t ON t.id = il.id_toko
        WHERE il.status = ANY($1::text[])
          ${branchWhere}
        ORDER BY il.created_at DESC, il.id DESC
        LIMIT $${values.length}
    `, values);
};

const findProjectPlanningApproval = async (user: AuthenticatedUser): Promise<NotificationRow[]> => {
    const isBmManager = hasRole(user, "BRANCH BUILDING & MAINTENANCE MANAGER") || hasRole(user, "BBMM");
    const isPpSpecialist = hasRole(user, "PROJECT PLANNING & DEVELOPMENT SPECIALIST") || hasRole(user, "PP SPECIALIST");
    const isPpManager = hasRole(user, "PROJECT PLANNING & DEVELOPMENT MANAGER") || hasRole(user, "PP MANAGER");
    if (!isSuperHuman(user) && !isBmManager && !isPpSpecialist && !isPpManager) return [];

    const statusConditions: string[] = [];
    if (isSuperHuman(user)) {
        statusConditions.push("pp.status IN ('WAITING_BM_APPROVAL', 'WAITING_PP_APPROVAL_1', 'PP_DESIGN_3D_REQUIRED', 'WAITING_BM_APPROVAL_2', 'WAITING_PP_MANAGER_APPROVAL', 'WAITING_PP_APPROVAL_2')");
    } else {
        if (isBmManager) statusConditions.push("pp.status IN ('WAITING_BM_APPROVAL', 'WAITING_BM_APPROVAL_2')");
        if (isPpSpecialist) statusConditions.push("pp.status IN ('WAITING_PP_APPROVAL_1', 'PP_DESIGN_3D_REQUIRED', 'WAITING_PP_APPROVAL_2')");
        if (isPpManager) statusConditions.push("pp.status = 'WAITING_PP_MANAGER_APPROVAL'");
    }

    const values: SqlValue[] = [];
    const branchWhere = addBranchScope(user, values, "pp.cabang");
    values.push(ITEM_LIMIT);

    return queryNotificationRows(`
        SELECT
            'PROJECT_PLANNING' AS entity_type,
            pp.id AS entity_id,
            pp.id_toko,
            COALESCE(pp.nama_toko, pp.nama_lokasi, pp.nomor_ulok) AS title,
            pp.nomor_ulok,
            pp.lingkup_pekerjaan,
            pp.cabang,
            pp.status,
            'Project Planning menunggu approval sesuai role Anda.' AS description,
            'Buka Approval Project Planning' AS action_label,
            '/approval?type=PROJECT_PLANNING&id=' || pp.id AS action_url,
            COUNT(*) OVER() AS total_count
        FROM projek_planning pp
        WHERE (${statusConditions.join(" OR ")})
          ${branchWhere}
        ORDER BY pp.created_at DESC, pp.id DESC
        LIMIT $${values.length}
    `, values);
};

const findSupportKtkReady = async (user: AuthenticatedUser): Promise<NotificationRow[]> => {
    if (!isSuperHuman(user) && !hasRole(user, "BRANCH BUILDING SUPPORT")) return [];

    const values: SqlValue[] = [];
    const branchWhere = addBranchScope(user, values, "t.cabang");
    values.push(ITEM_LIMIT);

    return queryNotificationRows(`
        WITH latest_active_final AS (
            SELECT DISTINCT ON (ofn.id_toko)
                ofn.id,
                ofn.id_toko,
                ofn.created_at
            FROM opname_final ofn
            WHERE COALESCE(ofn.aksi, 'active') <> 'terkunci'
              AND COALESCE(ofn.status_opname_final, '') = 'Proses KTK/Approval Kontraktor'
            ORDER BY ofn.id_toko, ofn.id DESC
        ),
        latest_approved_rab AS (
            SELECT DISTINCT ON (r.id_toko)
                r.id,
                r.id_toko
            FROM rab r
            WHERE UPPER(COALESCE(r.status, '')) IN ('DISETUJUI', 'APPROVED')
            ORDER BY r.id_toko, r.created_at DESC, r.id DESC
        ),
        expected_rab AS (
            SELECT lar.id_toko, COUNT(ri.id)::int AS expected_count
            FROM latest_approved_rab lar
            JOIN rab_item ri ON ri.id_rab = lar.id
            GROUP BY lar.id_toko
        ),
        expected_il AS (
            SELECT il.id_toko, COUNT(ili.id)::int AS expected_count
            FROM instruksi_lapangan il
            JOIN instruksi_lapangan_item ili ON ili.id_instruksi_lapangan = il.id
            WHERE UPPER(COALESCE(il.status, '')) IN ('DISETUJUI', 'APPROVED')
            GROUP BY il.id_toko
        ),
        expected_total AS (
            SELECT id_toko, SUM(expected_count)::int AS expected_count
            FROM (
                SELECT * FROM expected_rab
                UNION ALL
                SELECT * FROM expected_il
            ) expected_sources
            GROUP BY id_toko
        ),
        approved_latest_items AS (
            SELECT latest_items.id_opname_final, COUNT(*)::int AS approved_count
            FROM (
                SELECT DISTINCT ON (
                    oi.id_opname_final,
                    COALESCE('rab:' || oi.id_rab_item::text, 'il:' || oi.id_instruksi_lapangan_item::text)
                )
                    oi.id_opname_final,
                    oi.status
                FROM opname_item oi
                JOIN latest_active_final laf ON laf.id = oi.id_opname_final
                WHERE oi.id_rab_item IS NOT NULL OR oi.id_instruksi_lapangan_item IS NOT NULL
                ORDER BY
                    oi.id_opname_final,
                    COALESCE('rab:' || oi.id_rab_item::text, 'il:' || oi.id_instruksi_lapangan_item::text),
                    oi.id DESC
            ) latest_items
            WHERE LOWER(COALESCE(latest_items.status, '')) = 'disetujui'
            GROUP BY latest_items.id_opname_final
        )
        SELECT
            'OPNAME_FINAL_READY' AS entity_type,
            laf.id AS entity_id,
            laf.id_toko,
            COALESCE(t.nama_toko, t.nomor_ulok) AS title,
            t.nomor_ulok,
            t.lingkup_pekerjaan,
            t.cabang,
            'Proses KTK/Approval Kontraktor' AS status,
            COALESCE(ali.approved_count, 0)::text || '/' || COALESCE(et.expected_count, 0)::text || ' item sudah disetujui kontraktor. Support perlu proses/finalisasi KTK.' AS description,
            'Proses KTK' AS action_label,
            '/opname?id_toko=' || laf.id_toko || '&opname_final_id=' || laf.id || '&mode=finalisasi_ktk' AS action_url,
            COUNT(*) OVER() AS total_count
        FROM latest_active_final laf
        JOIN toko t ON t.id = laf.id_toko
        JOIN expected_total et ON et.id_toko = laf.id_toko
        JOIN approved_latest_items ali ON ali.id_opname_final = laf.id
        WHERE COALESCE(et.expected_count, 0) > 0
          AND COALESCE(ali.approved_count, 0) >= COALESCE(et.expected_count, 0)
          ${branchWhere}
        ORDER BY laf.created_at DESC, laf.id DESC
        LIMIT $${values.length}
    `, values);
};

const findRevisionRequired = async (user: AuthenticatedUser): Promise<NotificationRow[]> => {
    const rows: NotificationRow[][] = [];
    const userEmail = normalize(user.email_sat);

    if (isSuperHuman(user) || hasRole(user, "KONTRAKTOR")) {
        const values: SqlValue[] = [];
        const companyWhere = addCompanyScope(user, values, "r.nama_pt");
        let emailCondition = "TRUE";
        if (!isSuperHuman(user)) {
            values.push(userEmail);
            const emailPlaceholder = `$${values.length}`;
            emailCondition = `(UPPER(TRIM(COALESCE(r.email_pembuat, ''))) = ${emailPlaceholder} ${companyWhere ? `OR ${companyWhere.replace(/^AND\s+/, "")}` : ""})`;
        }
        values.push(ITEM_LIMIT);
        rows.push(await queryNotificationRows(`
            SELECT
                'RAB_REJECTED' AS entity_type,
                r.id AS entity_id,
                r.id_toko,
                COALESCE(t.nama_toko, t.nomor_ulok) AS title,
                t.nomor_ulok,
                t.lingkup_pekerjaan,
                t.cabang,
                r.status,
                COALESCE('Alasan: ' || NULLIF(r.alasan_penolakan, ''), 'RAB perlu direvisi dan diajukan ulang.') AS description,
                'Revisi RAB' AS action_label,
                '/rab?revision_id=' || r.id AS action_url,
                COUNT(*) OVER() AS total_count
            FROM rab r
            JOIN toko t ON t.id = r.id_toko
            WHERE r.status IN ('Ditolak oleh Koordinator', 'Ditolak oleh Manajer', 'Ditolak oleh Direktur Kontraktor')
              AND ${emailCondition}
            ORDER BY r.created_at DESC, r.id DESC
            LIMIT $${values.length}
        `, values));
    }

    if (isSuperHuman(user) || hasRole(user, "BRANCH BUILDING COORDINATOR") || hasRole(user, "BRANCH BUILDING & MAINTENANCE MANAGER")) {
        const values: SqlValue[] = [];
        const branchWhere = addBranchScope(user, values, "t.cabang");
        values.push(ITEM_LIMIT);
        rows.push(await queryNotificationRows(`
            SELECT
                'SPK_REJECTED' AS entity_type,
                p.id AS entity_id,
                p.id_toko,
                COALESCE(t.nama_toko, p.nomor_ulok) AS title,
                p.nomor_ulok,
                p.lingkup_pekerjaan,
                t.cabang,
                p.status,
                COALESCE('Alasan: ' || NULLIF(p.alasan_penolakan, ''), 'SPK perlu diperbaiki/diajukan ulang.') AS description,
                'Revisi SPK' AS action_label,
                '/spk?nomor_ulok=' || COALESCE(p.nomor_ulok, '') || '&lingkup=' || COALESCE(p.lingkup_pekerjaan, '') || '&id_toko=' || COALESCE(p.id_toko::text, '') AS action_url,
                COUNT(*) OVER() AS total_count
            FROM pengajuan_spk p
            LEFT JOIN toko t ON t.id = p.id_toko
            WHERE p.status = 'SPK_REJECTED'
              ${branchWhere}
            ORDER BY p.created_at DESC, p.id DESC
            LIMIT $${values.length}
        `, values));
    }

    if (isSuperHuman(user) || hasRole(user, "BRANCH BUILDING & MAINTENANCE MANAGER") || hasRole(user, "BRANCH BUILDING SUPPORT DOKUMENTASI")) {
        const values: SqlValue[] = [];
        const branchWhere = addBranchScope(user, values, "t.cabang");
        values.push(ITEM_LIMIT);
        rows.push(await queryNotificationRows(`
            SELECT
                'PERTAMBAHAN_SPK_REJECTED' AS entity_type,
                p.id::int AS entity_id,
                s.id_toko,
                COALESCE(t.nama_toko, s.nomor_ulok, s.nomor_spk) AS title,
                s.nomor_ulok,
                s.lingkup_pekerjaan,
                t.cabang,
                p.status_persetujuan AS status,
                COALESCE('Alasan: ' || NULLIF(p.alasan_penolakan, ''), 'Pertambahan SPK perlu diperbaiki.') AS description,
                'Revisi Pertambahan SPK' AS action_label,
                '/tambahspk?spk_id=' || p.id_spk || '&pertambahan_id=' || p.id AS action_url,
                COUNT(*) OVER() AS total_count
            FROM pertambahan_spk p
            JOIN pengajuan_spk s ON s.id = p.id_spk
            LEFT JOIN toko t ON t.id = s.id_toko
            WHERE p.status_persetujuan = 'Ditolak BM'
              ${branchWhere}
            ORDER BY p.created_at DESC, p.id DESC
            LIMIT $${values.length}
        `, values));
    }

    if (isSuperHuman(user) || hasRole(user, "BRANCH BUILDING SUPPORT")) {
        const values: SqlValue[] = [];
        const branchWhere = addBranchScope(user, values, "t.cabang");
        let emailCondition = "TRUE";
        if (!isSuperHuman(user)) {
            values.push(userEmail);
            emailCondition = `UPPER(TRIM(COALESCE(il.email_pembuat, ''))) = $${values.length}`;
        }
        values.push(ITEM_LIMIT);
        rows.push(await queryNotificationRows(`
            SELECT
                'INSTRUKSI_LAPANGAN_REJECTED' AS entity_type,
                il.id AS entity_id,
                il.id_toko,
                COALESCE(t.nama_toko, t.nomor_ulok) AS title,
                t.nomor_ulok,
                t.lingkup_pekerjaan,
                t.cabang,
                il.status,
                COALESCE('Alasan: ' || NULLIF(il.alasan_penolakan, ''), 'Instruksi Lapangan perlu diperbaiki.') AS description,
                'Revisi Instruksi Lapangan' AS action_label,
                '/instruksi-lapangan?revision_id=' || il.id || '&id_toko=' || il.id_toko AS action_url,
                COUNT(*) OVER() AS total_count
            FROM instruksi_lapangan il
            JOIN toko t ON t.id = il.id_toko
            WHERE UPPER(COALESCE(il.status, '')) LIKE '%DITOLAK%'
              ${branchWhere}
              AND ${emailCondition}
            ORDER BY il.created_at DESC, il.id DESC
            LIMIT $${values.length}
        `, values));
    }

    if (isSuperHuman(user) || hasRole(user, "BRANCH BUILDING SUPPORT")) {
        const values: SqlValue[] = [];
        const branchWhere = addBranchScope(user, values, "t.cabang");
        let emailCondition = "TRUE";
        if (!isSuperHuman(user)) {
            values.push(userEmail);
            emailCondition = `UPPER(TRIM(COALESCE(ofn.email_pembuat, ''))) = $${values.length}`;
        }
        values.push(ITEM_LIMIT);
        rows.push(await queryNotificationRows(`
            SELECT
                'OPNAME_FINAL_REJECTED' AS entity_type,
                ofn.id AS entity_id,
                ofn.id_toko,
                COALESCE(t.nama_toko, t.nomor_ulok) AS title,
                t.nomor_ulok,
                t.lingkup_pekerjaan,
                t.cabang,
                ofn.status_opname_final AS status,
                COALESCE('Alasan: ' || NULLIF(ofn.alasan_penolakan, ''), 'KTK perlu diperbaiki.') AS description,
                'Revisi KTK' AS action_label,
                '/opname?id_toko=' || ofn.id_toko || '&opname_final_id=' || ofn.id || '&mode=revisi_ktk' AS action_url,
                COUNT(*) OVER() AS total_count
            FROM opname_final ofn
            JOIN toko t ON t.id = ofn.id_toko
            WHERE ofn.tipe_opname = 'OPNAME_FINAL'
              AND ofn.status_opname_final IN ('Ditolak oleh Koordinator', 'Ditolak oleh Manajer', 'Ditolak oleh Direktur Kontraktor')
              ${branchWhere}
              AND ${emailCondition}
            ORDER BY ofn.created_at DESC, ofn.id DESC
            LIMIT $${values.length}
        `, values));
    }

    return mergeRows(...rows);
};

const findPicAssignmentRequired = async (user: AuthenticatedUser): Promise<NotificationRow[]> => {
    if (!isSuperHuman(user) && !hasRole(user, "BRANCH BUILDING COORDINATOR") && !hasRole(user, "BRANCH BUILDING & MAINTENANCE MANAGER")) {
        return [];
    }

    const values: SqlValue[] = [];
    const branchWhere = addBranchScope(user, values, "t.cabang");
    values.push(ITEM_LIMIT);

    return queryNotificationRows(`
        SELECT
            'PIC_PENGAWASAN_MISSING' AS entity_type,
            p.id AS entity_id,
            p.id_toko,
            COALESCE(t.nama_toko, p.nomor_ulok) AS title,
            p.nomor_ulok,
            p.lingkup_pekerjaan,
            t.cabang,
            p.status,
            'SPK sudah approved, tetapi PIC pengawasan belum ditentukan.' AS description,
            'Input PIC' AS action_label,
            '/inputpic?id_toko=' || p.id_toko AS action_url,
            COUNT(*) OVER() AS total_count
        FROM pengajuan_spk p
        LEFT JOIN toko t ON t.id = p.id_toko
        WHERE p.status = 'SPK_APPROVED'
          ${branchWhere}
          AND NOT EXISTS (
              SELECT 1
              FROM pic_pengawasan pic
              WHERE pic.id_spk = p.id
                 OR pic.id_toko = p.id_toko
          )
        ORDER BY p.created_at DESC, p.id DESC
        LIMIT $${values.length}
    `, values);
};

const findRabProjectPlanningRequests = async (user: AuthenticatedUser): Promise<NotificationRow[]> => {
    if (!hasRole(user, "KONTRAKTOR") || !user.email_sat) return [];

    const values: SqlValue[] = [user.email_sat, ITEM_LIMIT];
    return queryNotificationRows(`
        SELECT
            'RAB_PROJECT_PLANNING_REQUEST' AS entity_type,
            pp.id AS entity_id,
            pp.id_toko,
            COALESCE(pp.nama_toko, pp.nama_lokasi, pp.nomor_ulok) AS title,
            pp.nomor_ulok,
            scope.lingkup_pekerjaan,
            pp.cabang,
            pp.status,
            'Project Planning membutuhkan penawaran RAB.' AS description,
            'Buat Penawaran' AS action_label,
            '/rab?projek_planning_id=' || pp.id || '&lingkup=' || scope.lingkup_pekerjaan AS action_url,
            COUNT(*) OVER() AS total_count
        FROM projek_planning pp
        CROSS JOIN (VALUES ('SIPIL'::text), ('ME'::text)) AS scope(lingkup_pekerjaan)
        WHERE pp.status = 'WAITING_RAB_UPLOAD'
          AND EXISTS (
              SELECT 1
              FROM user_cabang uc
              WHERE LOWER(TRIM(uc.email_sat)) = LOWER(TRIM($1))
                AND LOWER(TRIM(uc.cabang)) = LOWER(TRIM(pp.cabang))
                AND UPPER(COALESCE(uc.jabatan, '')) LIKE '%KONTRAKTOR%'
          )
          AND NOT EXISTS (
              SELECT 1
              FROM toko t
              JOIN rab r ON r.id_toko = t.id
              WHERE t.nomor_ulok = pp.nomor_ulok
                AND UPPER(TRIM(COALESCE(t.lingkup_pekerjaan, ''))) = scope.lingkup_pekerjaan
          )
        ORDER BY pp.created_at ASC, pp.id ASC, scope.lingkup_pekerjaan DESC
        LIMIT $2
    `, values);
};

export const taskNotificationRepository = {
    async getGroups(user: AuthenticatedUser): Promise<TaskNotificationGroup[]> {
        const [
            rabApproval,
            spkApproval,
            pertambahanSpkApproval,
            opnameApproval,
            instruksiLapanganApproval,
            projectPlanningApproval,
            supportKtkReady,
            revisionRequired,
            picAssignmentRequired,
            rabProjectPlanningRequests,
        ] = await Promise.all([
            findRabApproval(user),
            findSpkApproval(user),
            findPertambahanSpkApproval(user),
            findOpnameApproval(user),
            findInstruksiLapanganApproval(user),
            findProjectPlanningApproval(user),
            findSupportKtkReady(user),
            findRevisionRequired(user),
            findPicAssignmentRequired(user),
            findRabProjectPlanningRequests(user),
        ]);

        return [
            makeGroup(
                "approval_pending",
                "Approval Menunggu",
                "Dokumen yang menunggu persetujuan role Anda.",
                mergeRows(rabApproval, spkApproval, pertambahanSpkApproval, opnameApproval, instruksiLapanganApproval, projectPlanningApproval)
            ),
            makeGroup(
                "support_ktk_ready",
                "KTK Siap Diproses",
                "Proyek yang semua item opname-nya sudah disetujui kontraktor dan perlu diproses support.",
                supportKtkReady
            ),
            makeGroup(
                "revision_required",
                "Revisi / Ditolak",
                "Dokumen yang dikembalikan dan perlu diperbaiki oleh role Anda.",
                revisionRequired
            ),
            makeGroup(
                "pic_pengawasan_missing",
                "PIC Pengawasan",
                "Proyek yang perlu penentuan PIC pengawasan.",
                picAssignmentRequired
            ),
            makeGroup(
                "rab_project_planning_request",
                "Permintaan RAB Project Planning",
                "ULOK dari FPD yang membutuhkan penawaran RAB.",
                rabProjectPlanningRequests
            ),
        ].filter((group): group is TaskNotificationGroup => Boolean(group));
    },
};
