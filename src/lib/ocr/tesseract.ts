"use client";

import { createWorker, type Worker } from "tesseract.js";

let worker: Worker | null = null;
let workerInitPromise: Promise<Worker> | null = null;

async function getWorker(): Promise<Worker> {
  if (worker) return worker;
  if (workerInitPromise) return workerInitPromise;

  workerInitPromise = (async () => {
    try {
      // Tesseract.js v5+ createWorker API
      const w = await createWorker("eng+hin", 1, {
        logger: (m) => {
          if (m.status === "recognizing text") {
            // Progress is 0-1
          }
        },
      });
      worker = w;
      return w;
    } catch (err) {
      console.error("Tesseract worker init failed:", err);
      // Try English only as fallback
      try {
        const w = await createWorker("eng");
        worker = w;
        return w;
      } catch (err2) {
        console.error("Tesseract fallback also failed:", err2);
        workerInitPromise = null;
        throw err2;
      }
    }
  })();

  return workerInitPromise;
}

export interface OCRResult {
  text: string;
  confidence: number;
}

export async function extractText(
  imageSource: Blob | File | string,
  onProgress?: (progress: number) => void
): Promise<OCRResult> {
  onProgress?.(5);

  const w = await getWorker();
  onProgress?.(15);

  // Convert Blob/File to data URL for reliable cross-browser support
  let source: string;
  if (typeof imageSource === "string") {
    source = imageSource;
  } else {
    source = await blobToDataUrl(imageSource);
  }

  onProgress?.(20);

  try {
    const result = await w.recognize(source);
    onProgress?.(100);

    return {
      text: result.data.text || "",
      confidence: result.data.confidence || 0,
    };
  } catch (err) {
    console.error("OCR recognize error:", err);
    throw err;
  }
}

// Convert Blob to data URL (more reliable than object URLs for Tesseract)
function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export async function terminateOCR(): Promise<void> {
  if (worker) {
    await worker.terminate();
    worker = null;
    workerInitPromise = null;
  }
}
