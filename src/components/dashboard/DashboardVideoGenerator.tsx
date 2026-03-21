'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Upload, Play, Download, AlertCircle, Trash2, X, Pause, RotateCw, SkipBack, SkipForward } from 'lucide-react';

interface ImageItem {
  id: string;
  file: File;
  url: string;
}

type LogoPosition = 'TL' | 'TC' | 'TR' | 'ML' | 'C' | 'MR' | 'BL' | 'BC' | 'BR';

const TOTAL_VIDEO_DURATION_MS = 5000;
const TRANSITION_DURATION_MS = 500;
/** Cadence fixe alignée sur captureStream / encodeur → évite saccades et « rollbacks » */
const FPS = 30;
const FRAME_MS = 1000 / FPS;

/** Résolution carrée (Etsy listing vidéo) — qualité prioritaire */
const OUTPUT_SIZE = 1080;
/** Bitrate H.264 (MP4) */
const MP4_VIDEO_BITRATE = 14_000_000;
/** Bitrate cible WebM (fallback navigateur) */
const WEBM_VIDEO_BITRATE = 12_000_000;

type SceneState =
  | { kind: 'done' }
  | {
      kind: 'frame';
      imageIndex: number;
      periodElapsed: number;
      isLastImage: boolean;
      isTransitioning: boolean;
      nextImageIndex?: number;
    };

function getSceneState(
  elapsedMs: number,
  imagesLength: number,
  imageDurationMs: number,
  transitionMs: number
): SceneState {
  if (imagesLength === 0) return { kind: 'done' };
  let acc = 0;
  for (let i = 0; i < imagesLength; i++) {
    const isLast = i === imagesLength - 1;
    const period = isLast ? imageDurationMs : imageDurationMs + transitionMs;
    if (elapsedMs < acc + period) {
      const periodElapsed = elapsedMs - acc;
      const isTransitioning = !isLast && periodElapsed > imageDurationMs;
      return {
        kind: 'frame',
        imageIndex: i,
        periodElapsed,
        isLastImage: isLast,
        isTransitioning,
        nextImageIndex: isTransitioning ? i + 1 : undefined,
      };
    }
    acc += period;
  }
  return { kind: 'done' };
}

/** Zoom en fin de phase « plein écran » (avant transition), pour enchaîner sans saut. */
function zoomAtEndOfImageHold(imageIndex: number, zoomAmount: number): number {
  if (imageIndex <= 0) return 1 + zoomAmount;
  return 1 + zoomAmount + zoomAmount;
}

function paintVideoFrame(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  elapsedMs: number,
  loadedImages: HTMLImageElement[],
  logoImg: HTMLImageElement | null,
  logoPosition: LogoPosition,
  logoOpacity: number,
  zoomSpeed: 'slow' | 'normal' | 'fast',
  imageDurationMs: number,
  transitionMs: number
) {
  const zoomAmount = zoomSpeed === 'slow' ? 0.08 : zoomSpeed === 'fast' ? 0.25 : 0.15;
  const n = loadedImages.length;
  const state = getSceneState(elapsedMs, n, imageDurationMs, transitionMs);

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  const drawImage = (img: HTMLImageElement, alpha: number, zoom: number) => {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(width / 2, height / 2);
    ctx.scale(zoom, zoom);
    const imgRatio = img.width / img.height;
    const canvasRatio = width / height;
    let drawWidth: number;
    let drawHeight: number;
    if (imgRatio > canvasRatio) {
      drawHeight = height;
      drawWidth = height * imgRatio;
    } else {
      drawWidth = width;
      drawHeight = width / imgRatio;
    }
    ctx.drawImage(img, -drawWidth / 2, -drawHeight / 2, drawWidth, drawHeight);
    ctx.restore();
  };

  ctx.clearRect(0, 0, width, height);

  if (state.kind === 'done') {
    const last = loadedImages[n - 1];
    if (last) drawImage(last, 1, 1 + zoomAmount);
  } else if (state.kind === 'frame') {
    const currentImg = loadedImages[state.imageIndex];
    if (!currentImg) return;

    if (state.isTransitioning && state.nextImageIndex != null) {
      const nextImg = loadedImages[state.nextImageIndex];
      const transitionProgress = (state.periodElapsed - imageDurationMs) / transitionMs;
      const currentAlpha = 1 - transitionProgress;
      const nextAlpha = transitionProgress;
      // Image courante : zoom réel en fin de hold (évite décrochage quand slide > 0)
      const currentZoom = zoomAtEndOfImageHold(state.imageIndex, zoomAmount);
      // Image suivante : même courbe qu’avant (de 1 à 1+zoom) en fondu
      const nextZoom = 1 + zoomAmount * transitionProgress;
      drawImage(currentImg, currentAlpha, currentZoom);
      if (nextImg) drawImage(nextImg, nextAlpha, nextZoom);
    } else {
      const t = Math.min(1, state.periodElapsed / imageDurationMs);
      // Slide 0 : zoom 1 → 1+zoom. Slides suivantes : enchaînent à 1+zoom (fin transition) → 1+2×zoom
      const zoom =
        state.imageIndex === 0
          ? 1 + zoomAmount * t
          : (1 + zoomAmount) + zoomAmount * t;
      drawImage(currentImg, 1, zoom);
    }
  }

  if (logoImg) {
    const logoSize = 100;
    const positions: Record<LogoPosition, { x: number; y: number }> = {
      TL: { x: logoSize / 2 + 15, y: logoSize / 2 + 15 },
      TC: { x: width / 2, y: logoSize / 2 + 15 },
      TR: { x: width - logoSize / 2 - 15, y: logoSize / 2 + 15 },
      ML: { x: logoSize / 2 + 15, y: height / 2 },
      C: { x: width / 2, y: height / 2 },
      MR: { x: width - logoSize / 2 - 15, y: height / 2 },
      BL: { x: logoSize / 2 + 15, y: height - logoSize / 2 - 15 },
      BC: { x: width / 2, y: height - logoSize / 2 - 15 },
      BR: { x: width - logoSize / 2 - 15, y: height - logoSize / 2 - 15 },
    };
    const pos = positions[logoPosition];
    ctx.save();
    ctx.globalAlpha = logoOpacity / 100;
    ctx.drawImage(logoImg, pos.x - logoSize / 2, pos.y - logoSize / 2, logoSize, logoSize);
    ctx.restore();
  }
}

async function encodeMp4FromCanvas(
  canvas: HTMLCanvasElement,
  drawAtElapsedMs: (elapsedMs: number) => void
): Promise<Blob | null> {
  if (typeof VideoEncoder === 'undefined' || typeof VideoFrame === 'undefined') {
    return null;
  }

  const { Muxer, ArrayBufferTarget } = await import('mp4-muxer');
  const width = canvas.width;
  const height = canvas.height;

  const tryConfigs: VideoEncoderConfig[] = [
    {
      codec: 'avc1.640028',
      width,
      height,
      bitrate: MP4_VIDEO_BITRATE,
      bitrateMode: 'variable',
      latencyMode: 'quality',
    },
    {
      codec: 'avc1.4d002a',
      width,
      height,
      bitrate: MP4_VIDEO_BITRATE,
      bitrateMode: 'variable',
      latencyMode: 'quality',
    },
    {
      codec: 'avc1.42001f',
      width,
      height,
      bitrate: MP4_VIDEO_BITRATE,
      bitrateMode: 'variable',
      latencyMode: 'quality',
    },
  ];

  let chosen: VideoEncoderConfig | null = null;
  for (const c of tryConfigs) {
    try {
      const { supported } = await VideoEncoder.isConfigSupported(c);
      if (supported) {
        chosen = c;
        break;
      }
    } catch {
      /* continue */
    }
  }
  if (!chosen) return null;

  const target = new ArrayBufferTarget();
  const muxer = new Muxer({
    target,
    fastStart: 'in-memory',
    video: { codec: 'avc', width, height, frameRate: FPS },
    firstTimestampBehavior: 'offset',
  });

  let encodeError: Error | null = null;
  const encoder = new VideoEncoder({
    output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
    error: (e) => {
      encodeError = e;
    },
  });

  await encoder.configure(chosen);

  const frameDurationUs = Math.round(1_000_000 / FPS);
  const totalFrames = Math.round((TOTAL_VIDEO_DURATION_MS / 1000) * FPS);

  for (let i = 0; i < totalFrames; i++) {
    if (encodeError) break;
    const elapsedMs = Math.min(TOTAL_VIDEO_DURATION_MS - 0.001, (i * 1000) / FPS);
    drawAtElapsedMs(elapsedMs);
    const vf = new VideoFrame(canvas, {
      timestamp: i * frameDurationUs,
      duration: frameDurationUs,
    });
    encoder.encode(vf, { keyFrame: i % FPS === 0 });
    vf.close();
  }

  await encoder.flush();
  if (encodeError) {
    try {
      encoder.close();
    } catch {
      /* ignore */
    }
    return null;
  }
  muxer.finalize();
  encoder.close();
  const buffer = target.buffer;
  if (!buffer || buffer.byteLength === 0) return null;
  return new Blob([buffer], { type: 'video/mp4' });
}

export function DashboardVideoGenerator() {
  const [images, setImages] = useState<ImageItem[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isGenerating, setIsGenerating] = useState(false);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [videoMimeType, setVideoMimeType] = useState<string>('video/mp4');
  const [error, setError] = useState<string | null>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [logoPosition, setLogoPosition] = useState<LogoPosition>('BR');
  const [logoOpacity, setLogoOpacity] = useState<number>(70);
  const [zoomSpeed, setZoomSpeed] = useState<'slow' | 'normal' | 'fast'>('normal');
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const logoInputRef = useRef<HTMLInputElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const dropZoneRef = useRef<HTMLDivElement | null>(null);

  const handleFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const items: ImageItem[] = [];
    Array.from(files).forEach((file) => {
      if (!file.type.startsWith('image/')) return;
      const url = URL.createObjectURL(file);
      items.push({
        id: `${file.name}-${file.size}-${file.lastModified}`,
        file,
        url,
      });
    });

    if (items.length === 0) {
      setError('Veuillez sélectionner uniquement des images (JPG, PNG, WebP).');
      return;
    }

    const limitedItems = items.slice(0, 10);
    if (items.length > 10) {
      setError(`Seulement les 10 premières images ont été ajoutées (${items.length} au total).`);
    }

    images.forEach((img) => URL.revokeObjectURL(img.url));

    setImages(limitedItems);
    setSelectedIndex(0);
    setVideoUrl(null);
    setVideoMimeType('video/mp4');
    setError(null);
  };

  const handleLogoUpload = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const file = files[0];
    if (file.type.startsWith('image/')) {
      if (logoUrl) URL.revokeObjectURL(logoUrl);
      const url = URL.createObjectURL(file);
      setLogoFile(file);
      setLogoUrl(url);
    }
  };

  const handleRemoveImage = (index: number) => {
    const newImages = images.filter((_, i) => i !== index);
    URL.revokeObjectURL(images[index].url);
    setImages(newImages);
    if (selectedIndex >= newImages.length && newImages.length > 0) {
      setSelectedIndex(newImages.length - 1);
    } else if (newImages.length === 0) {
      setSelectedIndex(0);
      setVideoUrl(null);
      setVideoMimeType('video/mp4');
    }
  };

  const handleClearAll = () => {
    images.forEach((img) => URL.revokeObjectURL(img.url));
    setImages([]);
    setSelectedIndex(0);
    setVideoUrl(null);
    setVideoMimeType('video/mp4');
    setError(null);
  };

  const handleRemoveLogo = () => {
    if (logoUrl) URL.revokeObjectURL(logoUrl);
    setLogoFile(null);
    setLogoUrl(null);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      handleFiles(files);
    }
  };

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  useEffect(() => {
    return () => {
      images.forEach((img) => URL.revokeObjectURL(img.url));
      if (videoUrl) URL.revokeObjectURL(videoUrl);
      if (logoUrl) URL.revokeObjectURL(logoUrl);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const style = document.createElement('style');
    style.textContent = `
      .opacity-slider::-webkit-slider-thumb {
        appearance: none;
        width: 12px;
        height: 12px;
        border-radius: 50%;
        background: white;
        cursor: pointer;
      }
      .opacity-slider::-moz-range-thumb {
        width: 12px;
        height: 12px;
        border-radius: 50%;
        background: white;
        cursor: pointer;
        border: none;
      }
    `;
    document.head.appendChild(style);
    return () => {
      document.head.removeChild(style);
    };
  }, []);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const totalDuration = TOTAL_VIDEO_DURATION_MS / 1000;

  const handleGenerate = async () => {
    try {
      setError(null);

      if (typeof window === 'undefined') return;

      if (images.length === 0) {
        setError('Ajoutez au moins une image avant de générer une vidéo.');
        return;
      }

      setIsGenerating(true);
      setVideoUrl(null);
      setVideoMimeType('video/mp4');

      const width = OUTPUT_SIZE;
      const height = OUTPUT_SIZE;
      const canvas = canvasRef.current;
      if (!canvas) return;

      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d', { alpha: false });
      if (!ctx) {
        setError('Canvas non supporté.');
        setIsGenerating(false);
        return;
      }

      const loadedImages: HTMLImageElement[] = [];
      for (const imgItem of images) {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        await new Promise<void>((resolve, reject) => {
          img.onload = () => resolve();
          img.onerror = () => reject(new Error("Impossible de charger l'image."));
          img.src = imgItem.url;
        });
        loadedImages.push(img);
      }

      let logoImg: HTMLImageElement | null = null;
      if (logoUrl && logoFile) {
        logoImg = new Image();
        logoImg.crossOrigin = 'anonymous';
        await new Promise<void>((resolve) => {
          logoImg!.onload = () => resolve();
          logoImg!.onerror = () => resolve();
          logoImg!.src = logoUrl;
        });
      }

      const imageDurationMs =
        images.length > 0
          ? (TOTAL_VIDEO_DURATION_MS - (images.length - 1) * TRANSITION_DURATION_MS) / images.length
          : 0;

      const drawAtElapsedMs = (elapsedMs: number) => {
        paintVideoFrame(
          ctx,
          width,
          height,
          elapsedMs,
          loadedImages,
          logoImg,
          logoPosition,
          logoOpacity,
          zoomSpeed,
          imageDurationMs,
          TRANSITION_DURATION_MS
        );
      };

      let blob: Blob | null = await encodeMp4FromCanvas(canvas, drawAtElapsedMs);

      if (!blob && typeof (window as unknown as { MediaRecorder?: typeof MediaRecorder }).MediaRecorder !== 'undefined') {
        const MediaRecorderCtor = (window as unknown as { MediaRecorder: typeof MediaRecorder }).MediaRecorder;
        const stream = canvas.captureStream(FPS);
        if (!stream) {
          setError("La capture vidéo n'est pas supportée.");
          setIsGenerating(false);
          return;
        }

        const supportedTypes = [
          'video/webm;codecs=vp9',
          'video/webm;codecs=vp8',
          'video/webm',
          'video/mp4',
        ];
        let mimeType: string | undefined;
        for (const type of supportedTypes) {
          try {
            if (MediaRecorderCtor.isTypeSupported?.(type)) {
              mimeType = type;
              break;
            }
          } catch {
            /* ignore */
          }
        }
        if (!mimeType) mimeType = 'video/webm';

        const chunks: BlobPart[] = [];
        let recorder: MediaRecorder;
        try {
          recorder = new MediaRecorderCtor(stream, {
            mimeType,
            videoBitsPerSecond: WEBM_VIDEO_BITRATE,
          } as MediaRecorderOptions);
        } catch {
          try {
            recorder = new MediaRecorderCtor(stream);
            mimeType = recorder.mimeType || 'video/webm';
          } catch {
            setError('MP4 indisponible et enregistrement WebM impossible sur ce navigateur.');
            setIsGenerating(false);
            return;
          }
        }

        recorder.ondataavailable = (e: BlobEvent) => {
          if (e.data?.size) chunks.push(e.data);
        };

        const recordPromise = new Promise<Blob>((resolve) => {
          recorder.onstop = () => {
            resolve(new Blob(chunks, { type: mimeType || 'video/webm' }));
          };
        });

        recorder.start(200);

        const startTime = performance.now();
        let lastFrameAt = startTime;

        const tick = (now: number) => {
          const elapsed = now - startTime;
          if (elapsed >= TOTAL_VIDEO_DURATION_MS) {
            recorder.stop();
            return;
          }
          if (now - lastFrameAt >= FRAME_MS) {
            lastFrameAt = now - ((now - lastFrameAt) % FRAME_MS);
            drawAtElapsedMs(Math.min(elapsed, TOTAL_VIDEO_DURATION_MS - 0.001));
          }
          requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);

        blob = await recordPromise;
        setVideoMimeType(mimeType || 'video/webm');
      }

      if (!blob) {
        setError(
          'Export MP4 impossible (navigateur trop ancien ou codec indisponible). Essaie Chrome ou Edge à jour.'
        );
        setIsGenerating(false);
        return;
      }

      const url = URL.createObjectURL(blob);
      setVideoUrl(url);
      setDuration(totalDuration);
    } catch (e: unknown) {
      console.error('[VideoGenerator] Error:', e);
      setError(e instanceof Error ? e.message : 'Erreur pendant la génération de la vidéo.');
    } finally {
      setIsGenerating(false);
    }
  };

  const currentImage = images[selectedIndex];
  const downloadExt = videoMimeType.includes('mp4') ? 'mp4' : 'webm';

  return (
    <div className="min-h-screen bg-black">
      <div className="max-w-[1100px] mx-auto px-4 sm:px-6 py-8 sm:py-10">
        {/* Header */}
        <div className="mb-8 flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#00d4ff] to-[#00c9b7] flex items-center justify-center shadow-lg shadow-[#00d4ff]/25 flex-shrink-0">
            <Play className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-white mb-1">Générateur de Vidéo</h1>
            <p className="text-sm sm:text-base text-white/70 max-w-xl">
              Transformez vos photos de produits en vidéos professionnelles prêtes pour Etsy : logo, position, opacité et
              aperçu en direct.
            </p>
            <p className="text-xs text-[#00d4ff] mt-2 font-medium">
              Export <strong className="text-white/90">MP4 (H.264)</strong> haute qualité — compatible Etsy • Gratuit • 0
              crédits pour tester
            </p>
          </div>
        </div>

        {/* Main layout - 2 columns forced */}
        <div className="grid gap-5" style={{ gridTemplateColumns: '1.8fr 1fr' }}>
          {/* LEFT COLUMN - Video Preview */}
          <div className="bg-white/[0.02] border border-white/10 rounded-2xl p-5 sm:p-6">
            <h2 className="text-white font-semibold text-base mb-4">Aperçu Vidéo</h2>

            {/* Drop zone / Preview */}
            <div
              ref={dropZoneRef}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={!videoUrl && !currentImage ? handleClick : undefined}
              className={`relative w-full rounded-2xl border-2 border-dashed transition-all cursor-pointer ${
                isDragging
                  ? 'border-[#00d4ff] bg-[#00d4ff]/5'
                  : videoUrl || currentImage
                    ? 'border-transparent bg-black'
                    : 'border-[#00d4ff]/40 bg-black/40'
              }`}
              style={{ minHeight: '380px' }}
            >
              {videoUrl ? (
                <video
                  ref={videoRef}
                  src={videoUrl}
                  className="w-full rounded-xl"
                  style={{ minHeight: '380px', objectFit: 'contain' }}
                  onPlay={() => setIsPlaying(true)}
                  onPause={() => setIsPlaying(false)}
                  onTimeUpdate={(e) => {
                    const video = e.currentTarget;
                    setCurrentTime(video.currentTime);
                    setDuration(video.duration || totalDuration);
                  }}
                  onLoadedMetadata={(e) => {
                    setDuration(e.currentTarget.duration || totalDuration);
                  }}
                />
              ) : currentImage ? (
                <>
                  <img
                    src={currentImage.url}
                    alt="Preview"
                    className="w-full rounded-xl"
                    style={{ minHeight: '380px', objectFit: 'contain' }}
                  />
                  {logoUrl && (
                    <div
                      className="absolute"
                      style={{
                        ...(logoPosition === 'TL' && { top: '20px', left: '20px' }),
                        ...(logoPosition === 'TC' && { top: '20px', left: '50%', transform: 'translateX(-50%)' }),
                        ...(logoPosition === 'TR' && { top: '20px', right: '20px' }),
                        ...(logoPosition === 'ML' && { top: '50%', left: '20px', transform: 'translateY(-50%)' }),
                        ...(logoPosition === 'C' && { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }),
                        ...(logoPosition === 'MR' && { top: '50%', right: '20px', transform: 'translateY(-50%)' }),
                        ...(logoPosition === 'BL' && { bottom: '20px', left: '20px' }),
                        ...(logoPosition === 'BC' && { bottom: '20px', left: '50%', transform: 'translateX(-50%)' }),
                        ...(logoPosition === 'BR' && { bottom: '20px', right: '20px' }),
                        opacity: logoOpacity / 100,
                      }}
                    >
                      <img src={logoUrl} alt="Logo" className="w-[100px] h-[100px] object-contain" />
                    </div>
                  )}
                </>
              ) : (
                <div className="flex flex-col items-center justify-center p-8 text-center" style={{ minHeight: '380px' }}>
                  <div className="w-16 h-16 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center mb-4">
                    <Upload className="w-9 h-9 text-[#00c9b7]" />
                  </div>
                  <p className="text-sm text-white/80 mb-1">Glissez vos images ou cliquez pour télécharger</p>
                  <p className="text-xs text-white/50 mb-4">JPG, PNG, WebP • 30 Mo max</p>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      fileInputRef.current?.click();
                    }}
                    className="px-5 py-2 bg-[#00d4ff] text-white text-sm font-medium rounded-lg hover:bg-[#00c9b7] transition-colors"
                  >
                    Télécharger des images
                  </button>
                </div>
              )}
              <canvas ref={canvasRef} className="hidden" />
            </div>

            {/* Video controls bar */}
            {videoUrl && (
              <div className="mt-3 flex items-center gap-2 bg-[#0a0e14] rounded-lg px-3 py-2">
                <button
                  onClick={() => {
                    const v = videoRef.current;
                    if (!v) return;
                    if (isPlaying) void v.pause();
                    else void v.play();
                  }}
                  className="w-8 h-8 flex items-center justify-center text-white/60 hover:text-white rounded transition-colors"
                >
                  {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                </button>
                <button
                  onClick={() => {
                    if (videoRef.current) videoRef.current.currentTime = 0;
                  }}
                  className="w-8 h-8 flex items-center justify-center text-white/60 hover:text-white rounded transition-colors"
                >
                  <RotateCw className="w-4 h-4" />
                </button>
                <button
                  onClick={() => {
                    if (videoRef.current) videoRef.current.currentTime = Math.max(0, videoRef.current.currentTime - 5);
                  }}
                  className="w-8 h-8 flex items-center justify-center text-white/60 hover:text-white rounded transition-colors"
                >
                  <SkipBack className="w-4 h-4" />
                </button>
                <div
                  className="flex-1 relative h-1.5 bg-white/10 rounded-full overflow-hidden cursor-pointer"
                  onClick={(e) => {
                    if (videoRef.current && duration > 0) {
                      const rect = e.currentTarget.getBoundingClientRect();
                      videoRef.current.currentTime = ((e.clientX - rect.left) / rect.width) * duration;
                    }
                  }}
                >
                  <div
                    className="absolute inset-y-0 left-0 bg-[#00d4ff] rounded-full transition-all"
                    style={{ width: `${duration > 0 ? (currentTime / duration) * 100 : 0}%` }}
                  />
                  <div
                    className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-[#00d4ff] rounded-full border-2 border-white shadow-md transition-all"
                    style={{ left: `calc(${duration > 0 ? (currentTime / duration) * 100 : 0}% - 6px)` }}
                  />
                </div>
                <button
                  onClick={() => {
                    if (videoRef.current)
                      videoRef.current.currentTime = Math.min(duration, videoRef.current.currentTime + 5);
                  }}
                  className="w-8 h-8 flex items-center justify-center text-white/60 hover:text-white rounded transition-colors"
                >
                  <SkipForward className="w-4 h-4" />
                </button>
                <span className="text-xs text-white/50 font-mono min-w-[70px] text-right">
                  {formatTime(currentTime)} / {formatTime(duration)}
                </span>
              </div>
            )}

            {/* Download */}
            {videoUrl && (
              <div className="mt-3 space-y-1">
                <a
                  href={videoUrl}
                  download={`etsmart-video-etsy.${downloadExt}`}
                  className="inline-flex items-center gap-2 text-sm text-[#00d4ff] hover:text-[#00c9b7] transition-colors"
                >
                  <Download className="w-4 h-4" /> Télécharger la vidéo ({downloadExt.toUpperCase()})
                </a>
                {downloadExt === 'webm' && (
                  <p className="text-[11px] text-white/45">
                    Ton navigateur a utilisé WebM en secours. Pour un MP4 compatible Etsy, ouvre l’outil dans{' '}
                    <strong className="text-white/60">Chrome ou Edge</strong> à jour.
                  </p>
                )}
              </div>
            )}

            {error && (
              <div className="mt-3 flex items-start gap-2 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2">
                <AlertCircle className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />
                <p className="text-xs text-red-100">{error}</p>
              </div>
            )}
          </div>

          {/* RIGHT COLUMN - Sidebar */}
          <div className="flex flex-col gap-4">
            {/* Images Section */}
            <div className="bg-white/[0.02] border border-white/10 rounded-2xl p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <h3 className="text-white font-semibold text-base">Images</h3>
                  <span className="text-xs text-white/40 bg-white/5 px-2 py-0.5 rounded-full">
                    {images.length} image{images.length > 1 ? 's' : ''}
                  </span>
                </div>
                {images.length > 0 && (
                  <button
                    onClick={handleClearAll}
                    className="flex items-center gap-1 text-xs text-white/40 hover:text-white/70 border border-white/10 rounded-lg px-2 py-1 hover:bg-white/5 transition-colors"
                  >
                    <Trash2 className="w-3 h-3" /> Effacer
                  </button>
                )}
              </div>

              {images.length === 0 ? (
                <div
                  className="border-2 border-dashed border-white/10 rounded-xl p-6 text-center bg-white/[0.02] cursor-pointer hover:border-white/20 transition-colors"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="w-8 h-8 mx-auto mb-2 text-white/20" />
                  <p className="text-sm text-white/40">Ajouter des images</p>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    {images.map((img, index) => (
                      <div
                        key={img.id}
                        className={`relative aspect-square rounded-lg overflow-hidden border-2 cursor-pointer group transition-all ${
                          index === selectedIndex
                            ? 'border-[#00d4ff] shadow-[0_0_10px_rgba(0,212,255,0.2)]'
                            : 'border-white/10 hover:border-white/20'
                        }`}
                      >
                        <button onClick={() => setSelectedIndex(index)} className="absolute inset-0 w-full h-full">
                          <img src={img.url} alt={img.file.name} className="w-full h-full object-cover" />
                        </button>
                        {index === selectedIndex && (
                          <div className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-[#00d4ff] flex items-center justify-center">
                            <div className="w-2 h-2 rounded-full bg-white" />
                          </div>
                        )}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRemoveImage(index);
                          }}
                          className="absolute top-1 left-1 w-5 h-5 rounded-full bg-black/70 hover:bg-red-500/80 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all"
                        >
                          <X className="w-3 h-3 text-white" />
                        </button>
                      </div>
                    ))}
                  </div>
                  <div
                    className="border-2 border-dashed border-white/10 rounded-lg p-3 text-center bg-white/[0.02] cursor-pointer hover:border-white/20 transition-colors"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Upload className="w-5 h-5 mx-auto mb-1 text-white/30" />
                    <p className="text-xs text-white/40">Ajouter des images</p>
                  </div>
                </div>
              )}
            </div>

            {/* Logo + Position + Opacity — combined card */}
            <div className="bg-white/[0.02] border border-white/10 rounded-2xl p-4">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <h3 className="text-white font-semibold text-base mb-3">Logo</h3>
                  {logoUrl ? (
                    <div className="relative rounded-xl overflow-hidden border border-white/10 bg-white/[0.02]" style={{ aspectRatio: '1' }}>
                      <img src={logoUrl} alt="Logo" className="w-full h-full object-contain p-3" />
                      <button
                        onClick={handleRemoveLogo}
                        className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-black/70 hover:bg-red-500/80 flex items-center justify-center transition-colors"
                      >
                        <X className="w-3 h-3 text-white" />
                      </button>
                    </div>
                  ) : (
                    <div
                      className="border-2 border-dashed border-white/10 rounded-xl text-center bg-white/[0.02] cursor-pointer hover:border-white/20 transition-colors flex flex-col items-center justify-center"
                      style={{ aspectRatio: '1' }}
                      onClick={() => logoInputRef.current?.click()}
                    >
                      <Upload className="w-8 h-8 mb-2 text-white/20" />
                      <p className="text-sm text-white/50">Télécharger un logo</p>
                      <p className="text-xs text-white/30 mt-1">PNG, SVG, WebP, JPG</p>
                      <input ref={logoInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => handleLogoUpload(e.target.files)} />
                    </div>
                  )}
                </div>

                <div>
                  <h3 className="text-white font-semibold text-base mb-3">Position</h3>
                  <div className="grid grid-cols-3 gap-1.5" style={{ aspectRatio: '1' }}>
                    {(['TL', 'TC', 'TR', 'ML', 'C', 'MR', 'BL', 'BC', 'BR'] as LogoPosition[]).map((pos) => (
                      <button
                        key={pos}
                        onClick={() => setLogoPosition(pos)}
                        className={`rounded-lg border-2 flex items-center justify-center text-xs font-medium transition-all ${
                          logoPosition === pos
                            ? 'border-[#00d4ff] bg-[#00d4ff]/10 text-[#00d4ff] shadow-[0_0_8px_rgba(0,212,255,0.15)]'
                            : 'border-white/10 text-white/40 hover:border-white/20 hover:text-white/60 bg-white/[0.02]'
                        }`}
                      >
                        {pos}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="mt-4 pt-4 border-t border-white/5 space-y-5">
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-white font-semibold text-base">Opacité du logo</h3>
                    <span className="text-sm text-white/50">{logoOpacity}%</span>
                  </div>
                  <div className="relative">
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={logoOpacity}
                      onChange={(e) => setLogoOpacity(Number(e.target.value))}
                      className="w-full h-1.5 rounded-full appearance-none cursor-pointer opacity-slider"
                      style={{
                        background: `linear-gradient(to right, #00d4ff 0%, #00d4ff ${logoOpacity}%, rgba(255,255,255,0.1) ${logoOpacity}%, rgba(255,255,255,0.1) 100%)`,
                      }}
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-white font-semibold text-base">Vitesse du zoom</h3>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {(['slow', 'normal', 'fast'] as Array<'slow' | 'normal' | 'fast'>).map((mode) => (
                      <button
                        key={mode}
                        onClick={() => setZoomSpeed(mode)}
                        className={`py-2 rounded-lg text-xs font-medium transition-all ${
                          zoomSpeed === mode
                            ? 'bg-gradient-to-r from-[#00d4ff] to-[#00c9b7] text-white shadow-[0_0_10px_rgba(0,212,255,0.2)]'
                            : 'bg-white/5 border border-white/10 text-white/70 hover:border-white/20 hover:text-white'
                        }`}
                      >
                        {mode === 'slow' && 'Lent'}
                        {mode === 'normal' && 'Normal'}
                        {mode === 'fast' && 'Rapide'}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {images.length > 0 && (
              <button
                onClick={handleGenerate}
                disabled={isGenerating}
                className="w-full px-4 py-3 bg-gradient-to-r from-[#00d4ff] to-[#00c9b7] text-white font-semibold text-sm rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-[#00d4ff]/10"
              >
                {isGenerating ? 'Génération en cours...' : 'Générer la vidéo (MP4)'}
              </button>
            )}
          </div>
        </div>

        <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => handleFiles(e.target.files)} />
      </div>
    </div>
  );
}
