const fs = require('fs');
let code = fs.readFileSync('src/modules/dc-development/dc-development.pdf.ts', 'utf8');

const toAppend = `
export const buildGlobalDcDocumentReportPdfBuffer = async (
    allStages: { project: any, stages: PdfStage[] }[]
): Promise<Buffer> => {
    const templatePath = await resolveTemplatePath('dc_document_report_global.njk');

    const html = await renderHtmlTemplate(templatePath, {
        allStages,
        alfamart_logo_path: staticAssetPath('Alfamart-Emblem.png'),
        sparta_logo_path: staticAssetPath('Building-Logo.png'),
        generated_at: formatDateIndonesia(new Date().toISOString())
    });

    return renderPdfFromHtml(html);
};
`;
fs.appendFileSync('src/modules/dc-development/dc-development.pdf.ts', toAppend);
console.log('Appended buildGlobalDcDocumentReportPdfBuffer');
