"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export function cameraError(error: unknown): string {
  const name = (error as { name?: string })?.name;
  if (name === "NotAllowedError" || name === "SecurityError") return "Habilitá el permiso de cámara y micrófono en la barra de direcciones y volvé a intentar.";
  if (name === "NotFoundError" || name === "OverconstrainedError") return "No encontramos ese dispositivo. Conectá una cámara o elegí otra y volvé a intentar.";
  if (name === "NotReadableError" || name === "AbortError") return "No pudimos abrir el dispositivo. Cerrá otras apps que lo usen y probá otra cámara o micrófono.";
  return "No pudimos prender la cámara. Revisá los dispositivos y volvé a intentar.";
}

/** Una solicitud tardía nunca deja dispositivos encendidos al salir o cancelar. */
export function useCamera(audio: boolean) {
  const streamRef = useRef<MediaStream | null>(null);
  const nodeRef = useRef<HTMLVideoElement | null>(null);
  const requestRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [active, setActive] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [cameraId, setCameraId] = useState("");
  const [microphoneId, setMicrophoneId] = useState("");

  const attach = useCallback(() => {
    const video = nodeRef.current;
    if (!video || !streamRef.current) return;
    video.srcObject = streamRef.current;
    void video.play().catch(() => setError("Tocá la vista previa para ver la cámara."));
  }, []);
  const videoRef = useCallback((node: HTMLVideoElement | null) => {
    nodeRef.current = node;
    attach();
  }, [attach]);

  const release = useCallback(() => {
    requestRef.current++;
    if (timerRef.current) clearTimeout(timerRef.current);
    streamRef.current?.getTracks().forEach((track) => { track.onended = null; track.stop(); });
    streamRef.current = null;
    if (nodeRef.current) nodeRef.current.srcObject = null;
  }, []);
  const stop = useCallback(() => {
    release();
    setActive(false);
    setPending(false);
  }, [release]);
  useEffect(() => release, [release]);

  async function start(nextCamera = cameraId, nextMic = microphoneId): Promise<boolean> {
    release();
    const request = requestRef.current;
    setActive(false);
    setPending(true);
    setError("");
    if (!navigator.mediaDevices?.getUserMedia) {
      setPending(false);
      setError("Tu navegador no permite usar la cámara. Abrí Maru por HTTPS con Chrome, Edge o Safari actualizado.");
      return false;
    }
    timerRef.current = setTimeout(() => {
      if (request !== requestRef.current) return;
      requestRef.current++;
      setPending(false);
      setError("La cámara sigue sin responder. Revisá el permiso en la barra de direcciones y probá otra vez.");
    }, 20000);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { ...(nextCamera ? { deviceId: { exact: nextCamera } } : { facingMode: "user" }), width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: audio ? { ...(nextMic ? { deviceId: { exact: nextMic } } : {}), echoCancellation: true, noiseSuppression: true } : false,
      });
      if (request !== requestRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        return false;
      }
      if (timerRef.current) clearTimeout(timerRef.current);
      streamRef.current = stream;
      setCameraId(stream.getVideoTracks()[0]?.getSettings().deviceId ?? nextCamera);
      setMicrophoneId(stream.getAudioTracks()[0]?.getSettings().deviceId ?? nextMic);
      stream.getTracks().forEach((track) => { track.onended = () => { stop(); setError("El dispositivo se desconectó. Elegí otro o volvé a prender la cámara."); }; });
      setPending(false);
      setActive(true);
      attach();
      // La enumeración es auxiliar: un dispositivo que ya funciona no falla por no poder listarlos.
      void navigator.mediaDevices.enumerateDevices().then((list) => {
        if (request === requestRef.current) setDevices(list);
      }).catch(() => undefined);
      return true;
    } catch (e) {
      if (request !== requestRef.current) return false;
      if (timerRef.current) clearTimeout(timerRef.current);
      setPending(false);
      setError(cameraError(e));
      return false;
    }
  }
  return { streamRef, videoRef, active, pending, error, start, stop, devices, cameraId, microphoneId };
}
