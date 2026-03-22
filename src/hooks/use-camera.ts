"use client";

import { useState, useRef, useCallback, useEffect } from "react";

interface UseCameraOptions {
  facingMode?: "user" | "environment";
}

export function useCamera(options: UseCameraOptions = {}) {
  const { facingMode = "environment" } = options;
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const isActiveRef = useRef(false);
  const [isActive, setIsActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);

  const start = useCallback(async () => {
    try {
      setError(null);

      // Request camera with fallback constraints for mobile
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode,
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          },
        });
      } catch {
        // Fallback: simpler constraints if ideal fails
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode },
        });
      }

      streamRef.current = stream;

      if (videoRef.current) {
        const video = videoRef.current;
        video.srcObject = stream;

        // Wait for video metadata to load before playing
        await new Promise<void>((resolve, reject) => {
          video.onloadedmetadata = () => {
            video.play()
              .then(() => resolve())
              .catch(reject);
          };
          // Timeout fallback — if metadata never fires
          setTimeout(() => {
            video.play().then(() => resolve()).catch(reject);
          }, 2000);
        });
      }

      isActiveRef.current = true;
      setIsActive(true);
      setHasPermission(true);
    } catch (err) {
      const message = (err as Error).message || "";
      if (message.includes("Permission") || message.includes("NotAllowed")) {
        setError("Camera permission denied. Please allow camera access in your browser settings.");
        setHasPermission(false);
      } else if (message.includes("NotFound") || message.includes("DevicesNotFound")) {
        setError("No camera found on this device.");
      } else if (message.includes("NotReadable") || message.includes("TrackStartError")) {
        setError("Camera is in use by another app. Close it and try again.");
      } else {
        setError("Failed to access camera. Please try again.");
      }
      console.error("Camera error:", err);
      isActiveRef.current = false;
      setIsActive(false);
    }
  }, [facingMode]);

  const stop = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    isActiveRef.current = false;
    setIsActive(false);
  }, []);

  const captureAsync = useCallback((): Promise<Blob | null> => {
    return new Promise((resolve) => {
      if (!videoRef.current || !isActiveRef.current) {
        console.warn("Camera not active for capture");
        resolve(null);
        return;
      }

      const video = videoRef.current;

      // Wait a frame for the video to be fully rendered
      requestAnimationFrame(() => {
        if (video.videoWidth === 0 || video.videoHeight === 0) {
          console.warn("Video dimensions are 0, cannot capture");
          resolve(null);
          return;
        }

        const canvas = document.createElement("canvas");
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;

        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve(null);
          return;
        }
        ctx.drawImage(video, 0, 0);

        canvas.toBlob(
          (blob) => resolve(blob),
          "image/jpeg",
          0.85
        );
      });
    });
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => stop();
  }, [stop]);

  return {
    videoRef,
    isActive,
    error,
    hasPermission,
    start,
    stop,
    captureAsync,
  };
}
