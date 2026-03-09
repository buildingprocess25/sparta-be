import { Router } from "express";
import {
    loginDoc,
    listDocuments,
    saveDocument,
    updateDocument,
    deleteDocument,
    getDocumentDetail,
} from "./document.controller";

const documentRouter = Router();

// Sama persis dg routes di document_api.py
documentRouter.post("/login", loginDoc);
documentRouter.get("/list", listDocuments);
documentRouter.post("/save", saveDocument);
documentRouter.put("/update/:kodeToko", updateDocument);
documentRouter.delete("/delete/:kodeToko", deleteDocument);
documentRouter.get("/detail/:kodeToko", getDocumentDetail);

export { documentRouter };
