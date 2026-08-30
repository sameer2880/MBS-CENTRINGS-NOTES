import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";

/** Renders a DOM node to a high-resolution canvas — shared by both export formats. */
async function captureCanvas(node: HTMLElement): Promise<HTMLCanvasElement> {
  return html2canvas(node, {
    scale: 2,
    useCORS: true,
    backgroundColor: "#ffffff",
  });
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality?: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("Could not generate the receipt file"));
    }, type, quality);
  });
}

/** Renders the receipt node to a PNG image file. */
export async function receiptToImageFile(node: HTMLElement, filename: string): Promise<File> {
  const canvas = await captureCanvas(node);
  const blob = await canvasToBlob(canvas, "image/png");
  return new File([blob], `${filename}.png`, { type: "image/png" });
}

/** Renders the receipt node to a single-page PDF file, sized to the receipt itself. */
export async function receiptToPdfFile(node: HTMLElement, filename: string): Promise<File> {
  const canvas = await captureCanvas(node);
  const imgData = canvas.toDataURL("image/png");

  const pdf = new jsPDF({
    orientation: canvas.width > canvas.height ? "landscape" : "portrait",
    unit: "px",
    format: [canvas.width, canvas.height],
  });
  pdf.addImage(imgData, "PNG", 0, 0, canvas.width, canvas.height);
  const blob = pdf.output("blob");
  return new File([blob], `${filename}.pdf`, { type: "application/pdf" });
}

export type ShareResult = "shared" | "downloaded" | "cancelled";

/**
 * Shares a file through the device's native share sheet — on a phone this
 * lets the person pick WhatsApp directly and sends the actual image/PDF,
 * not just a link. Falls back to downloading the file (most desktop
 * browsers can't share files yet) so it can be attached manually instead.
 */
export async function shareOrDownloadFile(
  file: File,
  opts: { title?: string; text?: string } = {},
): Promise<ShareResult> {
  const nav = navigator as Navigator & {
    canShare?: (data?: ShareData) => boolean;
    share?: (data: ShareData) => Promise<void>;
  };

  if (nav.canShare && nav.share && nav.canShare({ files: [file] })) {
    try {
      await nav.share({ files: [file], title: opts.title, text: opts.text });
      return "shared";
    } catch (err) {
      if ((err as Error)?.name === "AbortError") return "cancelled";
      // Sharing itself failed (rare) — fall through to a plain download.
    }
  }

  const url = URL.createObjectURL(file);
  const a = document.createElement("a");
  a.href = url;
  a.download = file.name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  return "downloaded";
}