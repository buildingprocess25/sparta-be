const fs = require('fs');
const content = fs.readFileSync('src/modules/dc-development/dc-development.service.ts', 'utf8');

const toAppend = `
    async exportGlobalDcDocuments(query: DcArchiveProjectListQuery, actor: DcDocumentActorQuery, format: 'csv' | 'excel' | 'pdf') {
        const projectsRes = await dcDevelopmentRepository.listArchiveProjects(query);
        const projects = projectsRes.data;
        if (!projects || projects.length === 0) throw new AppError('Tidak ada data arsip DC yang sesuai dengan filter', 404);

        const STAGES = ['Pembangunan', 'Renovasi', 'Perluasan'];
        const flatRows: any[] = [];
        const wb = format === 'excel' ? xlsx.utils.book_new() : null;
        const allStagesForPdf: { project: any, stages: PdfStage[] }[] = [];

        for (const project of projects) {
            // Fetch documents for each project
            const documents = await dcDevelopmentRepository.listDocuments({ project_id: project.id, actor_email: actor.actor_email, actor_role: actor.actor_role });
            
            const docMap = new Map<string, { stage: string, notes: string | null }>();
            for (const doc of documents) {
                if (doc.document_type && doc.stage) {
                    const jenisKey = doc.document_type.split('__')[0];
                    const existing = docMap.get(\`\${doc.stage}#\${jenisKey}\`);
                    if (!existing || doc.notes) {
                         docMap.set(\`\${doc.stage}#\${jenisKey}\`, { stage: doc.stage, notes: doc.notes || (existing?.notes ?? null) });
                    }
                }
            }

            const projectFlatRows: any[] = [];
            const stages: PdfStage[] = [];

            for (const stageName of STAGES) {
                const items: PdfStageItem[] = [];
                let total = 0;
                let filled = 0;

                for (const utama of DC_DOCUMENT_CONFIG) {
                    if (stageName === 'Renovasi' && utama.title !== 'Perijinan Utama' && utama.title !== 'Dokumen Asbuilt Drawing') {
                         continue;
                    }
                    for (const detail of utama.details) {
                        for (const jenis of detail.jenis) {
                            total++;
                            const mapKey = \`\${stageName}#\${jenis.key}\`;
                            const isFilled = docMap.has(mapKey);
                            if (isFilled) filled++;

                            const notes = isFilled ? docMap.get(mapKey)!.notes : null;

                            items.push({
                                kategori: utama.title,
                                jenis: jenis.title,
                                status: isFilled,
                                notes: notes
                            });

                            const rowData = {
                                'Cabang': project.branch_name,
                                'Tipe': project.archive_name,
                                'Tahap': stageName,
                                'Kategori Utama': utama.title,
                                'Jenis Dokumen': jenis.title,
                                'Status': isFilled ? 'ADA' : 'KOSONG',
                                'Catatan': notes || ''
                            };
                            projectFlatRows.push(rowData);
                            flatRows.push(rowData);
                        }
                    }
                }

                if (total > 0) {
                    stages.push({
                        stageName,
                        total,
                        filled,
                        percentage: Math.round((filled / total) * 100),
                        items
                    });
                }
            }

            allStagesForPdf.push({ project, stages });

            if (format === 'excel' && wb) {
                // sheet name length max 31
                let sheetName = project.archive_name || \`Project_\${project.id}\`;
                if (sheetName.length > 31) sheetName = sheetName.substring(0, 31);
                
                // prevent duplicate sheet names
                let count = 1;
                let finalSheetName = sheetName;
                while (wb.SheetNames.includes(finalSheetName)) {
                    finalSheetName = \`\${sheetName.substring(0, 28)}_\${count}\`;
                    count++;
                }

                const ws = xlsx.utils.json_to_sheet(projectFlatRows);
                xlsx.utils.book_append_sheet(wb, ws, finalSheetName);
            }
        }

        if (format === 'csv') {
            if (flatRows.length === 0) return { buffer: Buffer.from(''), filename: 'Export_Global_DC.csv' };
            const headers = Object.keys(flatRows[0]);
            const csvRows = [
                headers.join(','),
                ...flatRows.map(row => headers.map(h => \`"\${(row[h] || '').toString().replace(/"/g, '""')}"\`).join(','))
            ];
            return {
                buffer: Buffer.from(csvRows.join('\\n')),
                filename: 'Data_Global_DC.csv'
            };
        } else if (format === 'excel' && wb) {
            const buffer = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });
            return {
                buffer,
                filename: 'Data_Global_DC.xlsx'
            };
        } else if (format === 'pdf') {
            const buffer = await buildGlobalDcDocumentReportPdfBuffer(allStagesForPdf);
            return {
                buffer,
                filename: 'Laporan_Global_DC.pdf'
            };
        }

        throw new AppError('Format tidak didukung', 400);
    }
`;

let newContent = content.replace(/\s*\};?\s*$/, '\n' + toAppend + '\n};\n');
if (!newContent.includes('buildGlobalDcDocumentReportPdfBuffer')) {
    newContent = newContent.replace('buildDcDocumentReportPdfBuffer', 'buildDcDocumentReportPdfBuffer, buildGlobalDcDocumentReportPdfBuffer');
}
fs.writeFileSync('src/modules/dc-development/dc-development.service.ts', newContent);
console.log('Appended exportGlobalDcDocuments');
