    async commitMigrationExcel(buffer: Buffer, emailPembuat: string, limit?: number) {
        const workbook = xlsx.read(buffer, { type: "buffer" });
        
        const sheetGantt = workbook.Sheets['gantt_chart'] || workbook.Sheets[workbook.SheetNames[0]];
        const sheetDay = workbook.Sheets['day_gantt_chart'];
        const sheetDep = workbook.Sheets['dependency_gantt'];

        if (!sheetGantt) {
            throw new AppError("File Excel kosong atau sheet gantt_chart tidak ditemukan", 400);
        }

        const ganttRows = xlsx.utils.sheet_to_json<any>(sheetGantt, { defval: "", raw: false });
        const dayRows = sheetDay ? xlsx.utils.sheet_to_json<any>(sheetDay, { defval: "", raw: false }) : [];
        const depRows = sheetDep ? xlsx.utils.sheet_to_json<any>(sheetDep, { defval: "", raw: false }) : [];

        const parseDateString = (val: any): string => {
            if (!val) return "";
            if (typeof val === 'number') {
                const date = new Date((val - 25569) * 86400 * 1000);
                const yyyy = date.getFullYear();
                const mm = String(date.getMonth() + 1).padStart(2, '0');
                const dd = String(date.getDate()).padStart(2, '0');
                return `${yyyy}-${mm}-${dd}`;
            }
            let dateStr = String(val).trim();
            if (dateStr.includes("/")) {
                const parts = dateStr.split("/");
                if (parts.length === 3) {
                    let yyyy = parts[2];
                    if (yyyy.length === 2) yyyy = `20${yyyy}`;
                    return `${yyyy}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
                }
            }
            if (dateStr.includes("-")) {
                const parts = dateStr.split("-");
                if (parts.length === 3 && parts[0].length <= 2) {
                    let yyyy = parts[2];
                    if (yyyy.length === 2) yyyy = `20${yyyy}`;
                    return `${yyyy}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
                }
            }
            return dateStr;
        };

        let insertedCount = 0;
        let skippedCount = 0;

        for (const gRow of ganttRows) {
            if (limit !== undefined && insertedCount >= limit) {
                break;
            }

            const noUlok = String(gRow["Nomor Ulok"] || "").trim();
            const lingkup = String(gRow["Lingkup_Pekerjaan"] || "").trim();
            
            if (!noUlok) continue;

            const existingToko = await tokoRepository.findByNomorUlokAndLingkup(noUlok, lingkup);
            if (existingToko) {
                const activeGantt = await ganttRepository.findLatestActiveByTokoId(existingToko.id);
                if (activeGantt) {
                    skippedCount++;
                    continue;
                }
            }

            // Kumpulkan Kategori Pekerjaan berurutan
            const kategoriPekerjaan: string[] = [];
            for (let i = 1; i <= 30; i++) {
                const kName = String(gRow[`Kategori_${i}`] || "").trim();
                if (kName && !kategoriPekerjaan.includes(kName)) {
                    kategoriPekerjaan.push(kName);
                }
            }

            // Cari dayRows yang cocok
            const groupDayRows = dayRows.filter(r => 
                String(r["Nomor Ulok"] || "").trim() === noUlok && 
                String(r["Lingkup_Pekerjaan"] || "").trim() === lingkup
            );

            const rawItems = groupDayRows.map((row) => {
                return {
                    kategori_pekerjaan: String(row["Kategori"] || "").trim(),
                    raw_h_awal: parseDateString(row["h_awal"]),
                    raw_h_akhir: parseDateString(row["h_akhir"]),
                    keterlambatan: row["keterlambatan"] !== undefined && row["keterlambatan"] !== "" ? String(row["keterlambatan"]) : null,
                    kecepatan: row["kecepatan"] !== undefined && row["kecepatan"] !== "" ? String(row["kecepatan"]) : null,
                };
            }).filter(item => item.kategori_pekerjaan && item.raw_h_awal && item.raw_h_akhir);

            if (rawItems.length === 0) {
                skippedCount++;
                continue;
            }

            const isDatePattern = /^\d{4}-\d{2}-\d{2}$/;
            const allAwalAreDates = rawItems.every(r => isDatePattern.test(r.raw_h_awal));
            let dayItems: any[] = [];
            let minDate: Date | null = null;

            if (allAwalAreDates) {
                minDate = new Date(rawItems[0].raw_h_awal);
                for (const item of rawItems) {
                    const d = new Date(item.raw_h_awal);
                    if (d < minDate) minDate = d;
                }
                dayItems = rawItems.map(item => {
                    const startD = new Date(item.raw_h_awal);
                    const endD = new Date(item.raw_h_akhir);
                    const diffAwal = Math.floor((startD.getTime() - minDate!.getTime()) / (1000 * 60 * 60 * 24));
                    const diffAkhir = Math.floor((endD.getTime() - minDate!.getTime()) / (1000 * 60 * 60 * 24));
                    return {
                        kategori_pekerjaan: item.kategori_pekerjaan,
                        h_awal: String(diffAwal + 1),
                        h_akhir: String(diffAkhir + 1),
                        keterlambatan: item.keterlambatan,
                        kecepatan: item.kecepatan
                    };
                });
            } else {
                dayItems = rawItems.map(item => ({
                    kategori_pekerjaan: item.kategori_pekerjaan,
                    h_awal: item.raw_h_awal,
                    h_akhir: item.raw_h_akhir,
                    keterlambatan: item.keterlambatan,
                    kecepatan: item.kecepatan
                }));
            }

            // Pastikan kategori dari dayItems ada di kategoriPekerjaan utama
            dayItems.forEach(d => {
                if (!kategoriPekerjaan.includes(d.kategori_pekerjaan)) {
                    kategoriPekerjaan.push(d.kategori_pekerjaan);
                }
            });

            // Pengawasan
            const pengawasanItems: any[] = [];
            for (let i = 1; i <= 20; i++) {
                const pVal = String(gRow[`Pengawasan_${i}`] || "").trim();
                if (pVal) {
                    if (isDatePattern.test(pVal) || pVal.includes('/')) {
                        pengawasanItems.push({ tanggal_pengawasan: parseDateString(pVal) });
                    } else if (!isNaN(Number(pVal)) && minDate) {
                        // Konversi dari day index ke tanggal riil
                        const pDate = new Date(minDate.getTime());
                        pDate.setDate(pDate.getDate() + (Number(pVal) - 1));
                        const yyyy = pDate.getFullYear();
                        const mm = String(pDate.getMonth() + 1).padStart(2, '0');
                        const dd = String(pDate.getDate()).padStart(2, '0');
                        pengawasanItems.push({ tanggal_pengawasan: `${yyyy}-${mm}-${dd}` });
                    }
                }
            }

            // Dependencies
            const depItems: any[] = [];
            const groupDepRows = depRows.filter(r => 
                String(r["Nomor Ulok"] || "").trim() === noUlok && 
                String(r["Lingkup_Pekerjaan"] || "").trim() === lingkup
            );
            groupDepRows.forEach(r => {
                const k1 = String(r["Kategori"] || "").trim();
                const k2 = String(r["Kategori_Terikat"] || "").trim();
                if (k1 && k2) {
                    depItems.push({
                        kategori_pekerjaan: k1,
                        kategori_pekerjaan_terikat: k2
                    });
                }
            });

            const ganttData = await ganttRepository.createWithDetails({
                nomor_ulok: noUlok,
                lingkup_pekerjaan: lingkup,
                nama_toko: String(gRow["Nama_Toko"] || "").trim() || "Data Toko",
                kode_toko: String(gRow["Kode_Toko"] || "").trim(),
                proyek: String(gRow["Proyek"] || "").trim(),
                cabang: String(gRow["Cabang"] || "").trim(),
                email_pembuat: String(gRow["Email_Pembuat"] || emailPembuat).trim(),
                status: String(gRow["Status"] || GANTT_STATUS.ACTIVE).trim().toLowerCase(),
                kategori_pekerjaan: kategoriPekerjaan,
                day_items: dayItems,
                pengawasan: pengawasanItems,
                dependencies: depItems
            });

            await releaseRabApprovalAfterGantt(ganttData.toko_id, "MIGRASI_SUPER_HUMAN");
            insertedCount++;
        }

        return {
            inserted_count: insertedCount,
            skipped_count: skippedCount,
            total_groups: ganttRows.length,
            limit_applied: limit
        };
    }
};
