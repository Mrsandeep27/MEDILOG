"use client";

import { createWorker, type Worker } from "tesseract.js";

let worker: Worker | null = null;
let workerInitPromise: Promise<Worker> | null = null;

async function getWorker(): Promise<Worker> {
  if (worker) return worker;
  if (workerInitPromise) return workerInitPromise;

  workerInitPromise = createWorker("eng+hin").then((w) => {
    worker = w;
    workerInitPromise = null;
    return w;
  });

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
  const w = await getWorker();

  let source: string;
  if (typeof imageSource === "string") {
    source = imageSource;
  } else {
    source = URL.createObjectURL(imageSource);
  }

  try {
    onProgress?.(10);
    const result = await w.recognize(source);
    onProgress?.(100);
    return {
      text: result.data.text,
      confidence: result.data.confidence,
    };
  } finally {
    if (typeof imageSource !== "string") {
      URL.revokeObjectURL(source);
    }
  }
}

export async function terminateOCR(): Promise<void> {
  if (worker) {
    await worker.terminate();
    worker = null;
  }
}
