import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import QRCode from "qrcode";
import fs from "fs";
import path from "path";

export interface CertificateData {
  studentName: string;
  courseTitle: string;
  instructorName: string;
  certificateCode: string;
  issuedAt: Date;
  verificationUrl: string;
}

/**
 * Generates a print-quality certificate PDF (landscape A4) with the official
 * Web3tribe University crest, and a QR code linking to the public
 * /verify/[code] page. Returns raw PDF bytes ready to upload to Supabase
 * Storage or stream directly to the client.
 */
export async function generateCertificatePdf(data: CertificateData): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([841.89, 595.28]); // A4 landscape in points
  const { width, height } = page.getSize();

  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);
  const fontRegular = await doc.embedFont(StandardFonts.Helvetica);

  // Brand colors sampled directly from the official crest.
  const green = rgb(7 / 255, 43 / 255, 20 / 255);
  const gold = rgb(218 / 255, 165 / 255, 51 / 255);
  const gray = rgb(0.4, 0.4, 0.42);

  // Border
  page.drawRectangle({
    x: 24,
    y: 24,
    width: width - 48,
    height: height - 48,
    borderColor: green,
    borderWidth: 3,
  });
  page.drawRectangle({
    x: 34,
    y: 34,
    width: width - 68,
    height: height - 68,
    borderColor: gold,
    borderWidth: 1,
  });

  const centerText = (text: string, y: number, font = fontRegular, size = 14, color = green) => {
    const textWidth = font.widthOfTextAtSize(text, size);
    page.drawText(text, { x: (width - textWidth) / 2, y, size, font, color });
  };

  // Official crest, embedded and centered at the top of the certificate.
  // Uses a pre-sized 300x300 asset (rather than the full 1075x1075 source
  // logo) since embedding the full-resolution image to display at 110pt
  // would needlessly bloat every generated certificate to well over 1MB.
  const logoPath = path.join(process.cwd(), "public", "logo-certificate.png");
  const logoBytes = fs.readFileSync(logoPath);
  const logoImage = await doc.embedPng(logoBytes);
  const logoSize = 110;
  page.drawImage(logoImage, {
    x: (width - logoSize) / 2,
    y: height - 130,
    width: logoSize,
    height: logoSize,
  });

  centerText("CERTIFICATE OF COMPLETION", height - 160, fontBold, 24, gold);

  centerText("This certifies that", height - 215, fontRegular, 13, gray);
  centerText(data.studentName, height - 250, fontBold, 28, green);

  centerText("has successfully completed the course", height - 295, fontRegular, 13, gray);
  centerText(data.courseTitle, height - 328, fontBold, 20, green);

  centerText(`Instructor: ${data.instructorName}`, height - 372, fontRegular, 12, gray);
  centerText(
    `Issued on ${data.issuedAt.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}`,
    height - 392,
    fontRegular,
    12,
    gray
  );

  // QR code for verification
  const qrDataUrl = await QRCode.toDataURL(data.verificationUrl, { margin: 0, width: 200 });
  const qrImageBytes = Buffer.from(qrDataUrl.split(",")[1], "base64");
  const qrImage = await doc.embedPng(qrImageBytes);
  const qrSize = 90;
  page.drawImage(qrImage, { x: width - 150, y: 60, width: qrSize, height: qrSize });

  page.drawText(`Certificate ID: ${data.certificateCode}`, {
    x: 60,
    y: 80,
    size: 10,
    font: fontRegular,
    color: gray,
  });
  page.drawText("Scan to verify", {
    x: width - 150,
    y: 50,
    size: 8,
    font: fontRegular,
    color: gray,
  });

  return doc.save();
}