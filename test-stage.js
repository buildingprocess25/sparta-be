const isNonWorkingDay = (date) => false; // Dummy for now

const parseDashboardDate = (value) => {
    const raw = String(value || '').trim();
    if (!raw) return null;
    const slashMatch = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (slashMatch) {
        const [, day, month, year] = slashMatch;
        return new Date(Number(year), Number(month) - 1, Number(day));
    }
    const parsed = new Date(raw);
    if (Number.isNaN(parsed.getTime())) return null;
    return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
};

const isDashboardDateEffective = (value, now = new Date()) => {
    const date = parseDashboardDate(value);
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    return Boolean(date && date.getTime() < today.getTime());
};

const getProjectStage = (project) => {
    const now = new Date();
    const hasRAB = (project.rab || []).length > 0;
    const rabData = project.rab?.[0];
    const rabStatus = (rabData?.status || '').toUpperCase();
    const isRabMenungguGantt = rabStatus === 'MENUNGGU GANTT CHART';
    const isRabDisetujui = rabData && rabStatus === 'DISETUJUI';
    const spkArray = Array.isArray(project.spk) ? project.spk : (project.spk ? [project.spk] : []);
    const hasSPK = spkArray.some((s) => ['APPROVED', 'ACTIVE', 'SPK_APPROVED', 'DISETUJUI', 'AKTIF', 'SELESAI'].includes((s.status || '').toUpperCase()));
    const hasApprovalSPK = spkArray.some((s) => (s.status || '').toUpperCase() === 'WAITING_FOR_BM_APPROVAL');
    
    const stArray = Array.isArray(project.berkas_serah_terima) ? project.berkas_serah_terima : (project.berkas_serah_terima ? [project.berkas_serah_terima] : []);
    const hasST = stArray.some((st) => isDashboardDateEffective(st?.created_at, now));
    
    const opnameArr = Array.isArray(project.opname_final) ? project.opname_final : (project.opname_final ? [project.opname_final] : []);
    const opnameData = opnameArr.find((o) => String(o?.link_pdf_opname || '').trim() && isDashboardDateEffective(o?.created_at, now));
    const hasOpnamePdf = !!opnameData;
    const isOpnameDisetujui = opnameData && (opnameData.status_opname_final || '').toUpperCase() === 'DISETUJUI';
    const hasDirectorApproval = isDashboardDateEffective(opnameData?.waktu_persetujuan_direktur, now);

    console.log("hasST:", hasST, "stArray:", stArray, "isDashboardDateEffective:", stArray.map(st => isDashboardDateEffective(st?.created_at, now)));

    if (hasOpnamePdf && isOpnameDisetujui && hasDirectorApproval) return 'Done';
    if (hasOpnamePdf && !isOpnameDisetujui) return 'Kerja Tambah Kurang';
    if (hasOpnamePdf && isOpnameDisetujui && !hasDirectorApproval) return 'Kerja Tambah Kurang';
    if (hasST) return 'Kerja Tambah Kurang';
    if (hasSPK) return 'Ongoing';
    if (hasApprovalSPK) return 'Approval SPK';
    if (isRabDisetujui) return 'Proses PJU';
    if (hasRAB && isRabMenungguGantt) return 'Proses Gantt';
    return 'Approval RAB';
};

const testProject = {
    spk: [{ status: 'APPROVED' }],
    berkas_serah_terima: [
        {
            "id": 508,
            "id_toko": 1265,
            "link_pdf": "https://drive.google.com/file/d/1aoKRkVgMqFkrbqIa4febSMlovJ-UL_RK/view?usp=drivesdk",
            "created_at": "2026-06-17T10:34:23.000Z"
        }
    ]
};

console.log("Stage:", getProjectStage(testProject));
