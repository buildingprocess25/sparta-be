import fs from "fs/promises";
import path from "path";
import nunjucks from "nunjucks";
import puppeteer from "puppeteer";
import { env } from "../config/env";

const nunjucksEnv = new nunjucks.Environment(undefined, {
    autoescape: false,
    throwOnUndefined: false,
    trimBlocks: true,
    lstripBlocks: true,
});

export const renderHtmlTemplate = async (
    templatePath: string,
    context: Record<string, unknown>
): Promise<string> => {
    const template = await fs.readFile(templatePath, "utf-8");
    return nunjucksEnv.renderString(template, context);
};

export const resolveTemplatePath = async (templateFilename: string): Promise<string> => {
    const candidates = [
        path.resolve(__dirname, "../templates", templateFilename),
        path.resolve(__dirname, "../../src/templates", templateFilename),
    ];

    for (const candidate of candidates) {
        try {
            await fs.access(candidate);
            return candidate;
        } catch {
            // Continue to next candidate path.
        }
    }

    throw new Error(`Template not found: ${templateFilename}. Checked: ${candidates.join(", ")}`);
};

export const renderPdfFromHtml = async (html: string): Promise<Buffer> => {
    const executablePath = env.PUPPETEER_EXECUTABLE_PATH?.trim() || undefined;
    const browser = await puppeteer.launch({
        headless: true,
        args: ["--no-sandbox", "--disable-setuid-sandbox"],
        executablePath,
    });

    try {
        const page = await browser.newPage();
        await page.setContent(html, { waitUntil: "networkidle0" });
        const pdf = await page.pdf({
            format: "A4",
            printBackground: true,
            preferCSSPageSize: true,
        });
        return Buffer.from(pdf);
    } finally {
        await browser.close();
    }
};
