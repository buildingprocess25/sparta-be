const fs = require('fs');
const content = fs.readFileSync('src/modules/dc-development/dc-development.controller.ts', 'utf8');
const toAppend = `
export const exportGlobalDcDocumentsCsv = asyncHandler(async (req: Request, res: Response) => {
    const actor = withSessionActor(req, dcDocumentActorQuerySchema.parse(req.query));
    const query = dcArchiveProjectListQuerySchema.parse(req.query);
    const result = await dcDevelopmentService.exportGlobalDcDocuments(query, actor, "csv");
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", \`attachment; filename="\${result.filename}"\`);
    res.send(result.buffer);
});

export const exportGlobalDcDocumentsExcel = asyncHandler(async (req: Request, res: Response) => {
    const actor = withSessionActor(req, dcDocumentActorQuerySchema.parse(req.query));
    const query = dcArchiveProjectListQuerySchema.parse(req.query);
    const result = await dcDevelopmentService.exportGlobalDcDocuments(query, actor, "excel");
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", \`attachment; filename="\${result.filename}"\`);
    res.send(result.buffer);
});

export const exportGlobalDcDocumentsPdf = asyncHandler(async (req: Request, res: Response) => {
    const actor = withSessionActor(req, dcDocumentActorQuerySchema.parse(req.query));
    const query = dcArchiveProjectListQuerySchema.parse(req.query);
    const result = await dcDevelopmentService.exportGlobalDcDocuments(query, actor, "pdf");
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", \`attachment; filename="\${result.filename}"\`);
    res.send(result.buffer);
});
`;
fs.appendFileSync('src/modules/dc-development/dc-development.controller.ts', toAppend);
console.log("Appended");
