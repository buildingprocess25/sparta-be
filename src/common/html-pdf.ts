import fs from "fs/promises";
import nunjucks from "nunjucks";
import puppeteer from "puppeteer";

const env = new nunjucks.Environment(undefined, {
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
    return env.renderString(template, context);
};

export const renderPdfFromHtml = async (html: string): Promise<Buffer> => {
    const browser = await puppeteer.launch({
        headless: true,
        args: ["--no-sandbox", "--disable-setuid-sandbox"],
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
