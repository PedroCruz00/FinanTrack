import { useCallback, useEffect, useRef, useState } from 'react';
import Brote from './Brote.jsx';
import Icon from './Icon.jsx';

/**
 * Cámara dentro de la app (getUserMedia).
 * A diferencia de <input capture>, que cada navegador interpreta a su manera (en computador abre
 * el selector de archivos), aquí se pide el permiso de cámara de forma explícita y se ve la imagen
 * en vivo. Requiere contexto seguro (https o localhost).
 */
export const cameraSupported = () => !!navigator.mediaDevices?.getUserMedia && window.isSecureContext;

const ERRORS = {
  NotAllowedError: {
    title: 'Necesito permiso para usar la cámara',
    text: 'Lo bloqueaste en el navegador. Tócalo en el candado junto a la dirección, permite la cámara y vuelve a intentarlo.',
  },
  SecurityError: {
    title: 'Necesito permiso para usar la cámara',
    text: 'El navegador no permite la cámara en esta página. Ábrela con https o desde la app instalada.',
  },
  NotFoundError: {
    title: 'No encontré una cámara',
    text: 'Este dispositivo no tiene cámara disponible. Puedes elegir la foto desde la galería.',
  },
  NotReadableError: {
    title: 'La cámara está ocupada',
    text: 'Otra app la está usando. Ciérrala y vuelve a intentarlo.',
  },
};
const errorFor = (err) =>
  ERRORS[err?.name] ?? { title: 'No pude abrir la cámara', text: err?.message || 'Intenta de nuevo o usa la galería.' };

export default function CameraCapture({ onCapture, onClose, onGallery }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [facing, setFacing] = useState('environment');
  const [canSwitch, setCanSwitch] = useState(false);
  const [torch, setTorch] = useState({ supported: false, on: false });
  const [status, setStatus] = useState('starting'); // starting | live | preview | error
  const [error, setError] = useState(null);
  const [shot, setShot] = useState(null); // { blob, url }

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  const start = useCallback(
    async (mode) => {
      stop();
      setStatus('starting');
      try {
        // Este llamado es el que hace que el navegador pida el permiso de cámara.
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: { facingMode: { ideal: mode }, width: { ideal: 1920 }, height: { ideal: 1440 } },
        });
        streamRef.current = stream;
        const video = videoRef.current;
        video.srcObject = stream;
        await video.play().catch(() => {});
        const track = stream.getVideoTracks()[0];
        const caps = track.getCapabilities?.() ?? {};
        setTorch({ supported: !!caps.torch, on: false });
        const devices = await navigator.mediaDevices.enumerateDevices();
        setCanSwitch(devices.filter((d) => d.kind === 'videoinput').length > 1);
        setStatus('live');
      } catch (err) {
        setError(errorFor(err));
        setStatus('error');
      }
    },
    [stop],
  );

  useEffect(() => {
    start(facing);
    return stop;
  }, [facing, start, stop]);

  // Cerrar con Escape y bloquear el scroll de fondo
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  useEffect(() => () => shot && URL.revokeObjectURL(shot.url), [shot]);

  async function toggleTorch() {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track) return;
    try {
      await track.applyConstraints({ advanced: [{ torch: !torch.on }] });
      setTorch((t) => ({ ...t, on: !t.on }));
    } catch {
      setTorch({ supported: false, on: false });
    }
  }

  function takePhoto() {
    const video = videoRef.current;
    if (!video?.videoWidth) return;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d').drawImage(video, 0, 0);
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        navigator.vibrate?.(15);
        setShot({ blob, url: URL.createObjectURL(blob) });
        setStatus('preview');
      },
      'image/jpeg',
      0.92,
    );
  }

  function usePhoto() {
    const file = new File([shot.blob], `factura-${Date.now()}.jpg`, { type: 'image/jpeg' });
    stop();
    onCapture(file);
  }

  function retake() {
    setShot(null);
    setStatus('live');
  }

  return (
    <div className="camera" role="dialog" aria-modal="true" aria-label="Tomar foto de la factura">
      <video
        ref={videoRef}
        className={`camera-video ${facing === 'user' ? 'mirrored' : ''}`}
        playsInline
        muted
        autoPlay
        hidden={status === 'error' || status === 'preview'}
      />
      {status === 'preview' && shot && <img src={shot.url} alt="Foto tomada" className="camera-video" />}

      {status === 'live' && <div className="camera-frame" aria-hidden="true" />}

      {status === 'starting' && (
        <div className="camera-message">
          <Brote mood="think" size={96} />
          <p>Abriendo la cámara…</p>
          <small>Si el navegador te pregunta, toca «Permitir».</small>
        </div>
      )}

      {status === 'error' && error && (
        <div className="camera-message">
          <Brote mood="worried" size={110} />
          <strong>{error.title}</strong>
          <p>{error.text}</p>
          <div className="camera-message-actions">
            <button className="btn btn-primary" onClick={() => start(facing)}>
              Intentar de nuevo
            </button>
            <button className="btn btn-ghost camera-ghost" onClick={onGallery}>
              <Icon name="image" size={18} /> Elegir de la galería
            </button>
          </div>
        </div>
      )}

      <div className="camera-top">
        <button className="camera-btn" onClick={onClose} aria-label="Cerrar cámara">
          <Icon name="close" />
        </button>
        {status === 'live' && <span className="camera-hint">Encuadra la factura completa</span>}
        {status === 'live' && torch.supported ? (
          <button className={`camera-btn ${torch.on ? 'on' : ''}`} onClick={toggleTorch} aria-label="Linterna" aria-pressed={torch.on}>
            <Icon name="bolt" />
          </button>
        ) : (
          <span className="camera-btn-spacer" />
        )}
      </div>

      <div className="camera-bottom" hidden={status === 'error'}>
        {status === 'preview' ? (
          <>
            <button key="retake" className="btn camera-ghost" onClick={retake}>
              Repetir
            </button>
            <button key="use" className="btn btn-primary btn-lg" onClick={usePhoto}>
              <Icon name="check" size={18} /> Usar foto
            </button>
          </>
        ) : (
          <>
            <button key="gallery" className="camera-btn" onClick={onGallery} aria-label="Elegir de la galería">
              <Icon name="image" />
            </button>
            <button key="shutter" className="camera-shutter" onClick={takePhoto} disabled={status !== 'live'} aria-label="Tomar foto" />
            {canSwitch ? (
              <button
                className="camera-btn"
                onClick={() => setFacing(facing === 'environment' ? 'user' : 'environment')}
                aria-label="Cambiar de cámara"
              >
                <Icon name="sync" />
              </button>
            ) : (
              <span className="camera-btn-spacer" />
            )}
          </>
        )}
      </div>
    </div>
  );
}
