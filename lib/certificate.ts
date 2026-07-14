import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import QRCode from "qrcode";

export interface CertificateData {
  studentName: string;
  courseTitle: string;
  instructorName: string;
  certificateCode: string;
  issuedAt: Date;
  verificationUrl: string;
}

/**
 * Generates a print-quality certificate PDF (landscape A4) with a QR code linking
 * to the public /verify/[code] page. Returns raw PDF bytes ready to upload to
 * Supabase Storage or stream directly to the client.
 */
export async function generateCertificatePdf(data: CertificateData): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([841.89, 595.28]); // A4 landscape in points
  const { width, height } = page.getSize();

  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);
  const fontRegular = await doc.embedFont(StandardFonts.Helvetica);
  const fontItalic = await doc.embedFont(StandardFonts.HelveticaOblique);

  const navy = rgb(0.06, 0.16, 0.29);
  const gold = rgb(0.69, 0.55, 0.17);
  const gray = rgb(0.4, 0.4, 0.42);

  // Border
  page.drawRectangle({
    x: 24,
    y: 24,
    width: width - 48,
    height: height - 48,
    borderColor: navy,
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

  const centerText = (text: string, y: number, font = fontRegular, size = 14, color = navy) => {
    const textWidth = font.widthOfTextAtSize(text, size);
    page.drawText(text, { x: (width - textWidth) / 2, y, size, font, color });
  };

  centerText("WEB3TRIBE UNIVERSITY", height - 100, fontBold, 22, navy);
  centerText("Learn. Build. Earn.", height - 125, fontItalic, 12, gray);

  centerText("CERTIFICATE OF COMPLETION", height - 180, fontBold, 26, gold);

  centerText("This certifies that", height - 240, fontRegular, 13, gray);
  centerText(data.studentName, height - 275, fontBold, 28, navy);

  centerText("has successfully completed the course", height - 320, fontRegular, 13, gray);
  centerText(data.courseTitle, height - 355, fontBold, 20, navy);

  centerText(`Instructor: ${data.instructorName}`, height - 400, fontRegular, 12, gray);
  centerText(
    `Issued on ${data.issuedAt.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}`,
    height - 420,
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
