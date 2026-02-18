'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Upload, Play, Download, AlertCircle, Trash2, X, Pause, RotateCw, SkipBack, SkipForward } from 'lucide-react';

interface ImageItem {
  id: string;
  file: File;
  url: string;
}

type LogoPosition = 'TL' | 'TC' | 'TR' | 'ML' | 'C' | 'MR' | 'BL' | 'BC' | 'BR';

const TOTAL_VIDEO_DURATION_MS = 5000; // 5 secondes total pour toute la vidéo
const TRANSITION_DURATION_MS = 500; // 0.5s de transition entre images
const FPS = 30;

export function DashboardVideoGenerator() {
  const [images, setImages] = useState<ImageItem[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isGenerating, setIsGenerating] = useState(false);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [videoMimeType, setVideoMimeType] = useState<string>('video/webm');
  const [error, setError] = useState<string | null>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [logoPosition, setLogoPosition] = useState<LogoPosition>('BR');
  const [logoOpacity, setLogoOpacity] = useState<number>(70);
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
    setVideoMimeType('video/webm');
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
      setVideoMimeType('video/webm');
    }
  };

  const handleClearAll = () => {
    images.forEach((img) => URL.revokeObjectURL(img.url));
    setImages([]);
    setSelectedIndex(0);
    setVideoUrl(null);
    setVideoMimeType('video/webm');
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

  // Ajouter les styles pour le slider d'opacité
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

  // Durée totale fixe de 5 secondes
  const totalDuration = TOTAL_VIDEO_DURATION_MS / 1000; // 5 secondes

  const handleGenerate = async () => {
    try {
      setError(null);

      if (typeof window === 'undefined') return;

      if (typeof (window as any).MediaRecorder === 'undefined') {
        setError("La génération de vidéo n'est pas supportée par ce navigateur.");
        return;
      }

      if (images.length === 0) {
        setError('Ajoutez au moins une image avant de générer une vidéo.');
        return;
      }

      setIsGenerating(true);
      setVideoUrl(null);
      setVideoMimeType('video/webm');

      const width = 1080;
      const height = 1080;
      const canvas = canvasRef.current;
      if (!canvas) return;

      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        setError('Canvas non supporté.');
        setIsGenerating(false);
        return;
      }

      const stream = (canvas as any).captureStream
        ? (canvas as HTMLCanvasElement).captureStream(FPS)
        : null;

      if (!stream) {
        setError("La capture vidéo n'est pas supportée.");
        setIsGenerating(false);
        return;
      }

      const MediaRecorderCtor: any = (window as any).MediaRecorder;
      const supportedTypes = [
        'video/webm;codecs=vp9',
        'video/webm;codecs=vp8',
        'video/webm',
        'video/mp4',
      ];

      let mimeType: string | undefined;
      for (const type of supportedTypes) {
        try {
          if (MediaRecorderCtor.isTypeSupported && MediaRecorderCtor.isTypeSupported(type)) {
            mimeType = type;
            break;
          }
        } catch (e) {
          // Ignorer
        }
      }

      if (!mimeType) {
        mimeType = 'video/webm';
      }

      const chunks: BlobPart[] = [];
      let recorder: MediaRecorder;

      try {
        recorder = new MediaRecorderCtor(stream, { mimeType });
      } catch (e: any) {
        try {
          recorder = new MediaRecorderCtor(stream);
          mimeType = recorder.mimeType || 'video/webm';
        } catch (e2: any) {
          setError('Format vidéo non supporté.');
          setIsGenerating(false);
          return;
        }
      }

      // Précharger toutes les images
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

      // Précharger le logo si présent
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

      recorder.ondataavailable = (e: BlobEvent) => {
        if (e.data && e.data.size > 0) {
          chunks.push(e.data);
        }
      };

      const recordPromise = new Promise<Blob>((resolve) => {
        recorder.onstop = () => {
          const blob = new Blob(chunks, { type: mimeType || 'video/webm' });
          resolve(blob);
        };
      });

      recorder.start();

      const startTime = performance.now();
      
      // Calculer la durée de chaque image pour que la vidéo totale fasse 5 secondes
      const imageDurationMs = images.length > 0
        ? (TOTAL_VIDEO_DURATION_MS - (images.length - 1) * TRANSITION_DURATION_MS) / images.length
        : 0;
      const totalImageDurationMs = imageDurationMs + TRANSITION_DURATION_MS;

      const renderFrame = (now: number) => {
        const elapsed = now - startTime;
        
        // Calculer l'index de l'image actuelle de manière cumulative
        let imageIndex = 0;
        let accumulatedTime = 0;
        
        for (let i = 0; i < images.length; i++) {
          const isLastImage = i === images.length - 1;
          const periodDuration = isLastImage ? imageDurationMs : totalImageDurationMs;
          
          if (elapsed < accumulatedTime + periodDuration) {
            imageIndex = i;
            break;
          }
          accumulatedTime += periodDuration;
        }
        
        if (imageIndex >= images.length) {
          recorder.stop();
          return;
        }

        const currentImg = loadedImages[imageIndex];
        if (!currentImg) {
          recorder.stop();
          return;
        }

        // Temps écoulé dans la période actuelle
        // Pour la dernière image, on utilise seulement imageDurationMs (pas de transition après)
        const isLastImage = imageIndex === images.length - 1;
        const periodDuration = isLastImage ? imageDurationMs : totalImageDurationMs;
        
        // Calculer le temps écoulé depuis le début de cette période
        let periodStartTime = 0;
        for (let i = 0; i < imageIndex; i++) {
          const isLast = i === images.length - 1;
          periodStartTime += isLast ? imageDurationMs : totalImageDurationMs;
        }
        const periodElapsed = elapsed - periodStartTime;
        
        // Déterminer si on est en transition ou en affichage normal
        // Pas de transition pour la dernière image
        const isTransitioning = !isLastImage && periodElapsed > imageDurationMs;
        const nextImageIndex = imageIndex + 1;
        const nextImg = nextImageIndex < loadedImages.length ? loadedImages[nextImageIndex] : null;

        ctx.clearRect(0, 0, width, height);

        // Fonction helper pour dessiner une image avec zoom
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

        if (isTransitioning && nextImg) {
          // Transition entre deux images (fade cross)
          const transitionProgress = (periodElapsed - imageDurationMs) / TRANSITION_DURATION_MS;
          const currentAlpha = 1 - transitionProgress;
          const nextAlpha = transitionProgress;
          
          // Zoom pour l'image actuelle (continue le zoom)
          const currentZoom = 1 + 0.15;
          // Zoom pour la prochaine image (commence à 1)
          const nextZoom = 1 + 0.15 * transitionProgress;

          // Dessiner l'image actuelle qui disparaît
          drawImage(currentImg, currentAlpha, currentZoom);
          
          // Dessiner la prochaine image qui apparaît
          drawImage(nextImg, nextAlpha, nextZoom);
        } else {
          // Affichage normal avec zoom progressif
          const t = periodElapsed / imageDurationMs;
          const zoom = 1 + 0.15 * Math.min(1, t);
          drawImage(currentImg, 1, zoom);
        }

        // Ajouter le logo si présent (toujours au-dessus)
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

        if (elapsed < totalDuration * 1000) {
          requestAnimationFrame(renderFrame);
        } else {
          recorder.stop();
        }
      };

      requestAnimationFrame(renderFrame);

      const videoBlob = await recordPromise;
      const url = URL.createObjectURL(videoBlob);
      setVideoUrl(url);
      setVideoMimeType(mimeType || 'video/webm');
      setDuration(totalDuration);
    } catch (e: any) {
      console.error('[VideoGenerator] Error:', e);
      setError(e?.message || 'Erreur pendant la génération de la vidéo.');
    } finally {
      setIsGenerating(false);
    }
  };

  const currentImage = images[selectedIndex];

  return (
    <div className="min-h-screen bg-black">
      <div className="max-w-[1100px] mx-auto p-4 sm:p-6">
        {/* Header */}
        <div className="mb-4">
          <h1 className="text-xl font-semibold text-white mb-1">Générateur de Vidéo</h1>
          <p className="text-sm text-white/60">
            Transformez vos photos de produits en vidéos professionnelles prêtes pour Etsy.
          </p>
          <p className="text-xs text-[#00d4ff] mt-1 font-medium">
            Gratuit • 0 crédits
          </p>
        </div>

        {/* Main layout - 2 columns forced */}
        <div style={{ display: 'grid', gridTemplateColumns: '1.8fr 1fr', gap: '20px' }}>
          {/* LEFT COLUMN - Video Preview */}
          <div className="bg-[#0d1117] border border-white/10 rounded-xl p-5">
            <h2 className="text-white font-semibold text-base mb-4">Aperçu Vidéo</h2>
            
            {/* Drop zone / Preview */}
            <div 
              ref={dropZoneRef}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={!videoUrl && !currentImage ? handleClick : undefined}
              className={`relative w-full rounded-xl border-2 border-dashed transition-all cursor-pointer ${
                isDragging
                  ? 'border-[#00d4ff] bg-[#00d4ff]/5'
                  : videoUrl || currentImage
                    ? 'border-transparent bg-black'
                    : 'border-[#00d4ff]/40 bg-[#0a0e14]'
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
                  <Upload className="w-10 h-10 text-[#00d4ff]/50 mb-4" />
                  <p className="text-sm text-white/70 mb-1">Glissez vos images ou cliquez pour télécharger</p>
                  <p className="text-xs text-white/40 mb-4">JPG, PNG, WebP • 30 Mo max</p>
                  <button
                    onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}
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
                <button onClick={() => { if (videoRef.current) { isPlaying ? videoRef.current.pause() : videoRef.current.play(); } }}
                  className="w-8 h-8 flex items-center justify-center text-white/60 hover:text-white rounded transition-colors">
                  {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                </button>
                <button onClick={() => { if (videoRef.current) videoRef.current.currentTime = 0; }}
                  className="w-8 h-8 flex items-center justify-center text-white/60 hover:text-white rounded transition-colors">
                  <RotateCw className="w-4 h-4" />
                </button>
                <button onClick={() => { if (videoRef.current) videoRef.current.currentTime = Math.max(0, videoRef.current.currentTime - 5); }}
                  className="w-8 h-8 flex items-center justify-center text-white/60 hover:text-white rounded transition-colors">
                  <SkipBack className="w-4 h-4" />
                </button>
                <div className="flex-1 relative h-1.5 bg-white/10 rounded-full overflow-hidden cursor-pointer"
                  onClick={(e) => { if (videoRef.current && duration > 0) { const rect = e.currentTarget.getBoundingClientRect(); videoRef.current.currentTime = ((e.clientX - rect.left) / rect.width) * duration; } }}>
                  <div className="absolute inset-y-0 left-0 bg-[#00d4ff] rounded-full transition-all" style={{ width: `${duration > 0 ? (currentTime / duration) * 100 : 0}%` }} />
                  <div className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-[#00d4ff] rounded-full border-2 border-white shadow-md transition-all" style={{ left: `calc(${duration > 0 ? (currentTime / duration) * 100 : 0}% - 6px)` }} />
                </div>
                <button onClick={() => { if (videoRef.current) videoRef.current.currentTime = Math.min(duration, videoRef.current.currentTime + 5); }}
                  className="w-8 h-8 flex items-center justify-center text-white/60 hover:text-white rounded transition-colors">
                  <SkipForward className="w-4 h-4" />
                </button>
                <span className="text-xs text-white/50 font-mono min-w-[70px] text-right">
                  {formatTime(currentTime)} / {formatTime(duration)}
                </span>
              </div>
            )}

            {/* Download */}
            {videoUrl && (
              <a href={videoUrl} download={`etsmart-video.${videoMimeType.includes('mp4') ? 'mp4' : 'webm'}`}
                className="inline-flex items-center gap-2 mt-3 text-sm text-[#00d4ff] hover:text-[#00c9b7] transition-colors">
                <Download className="w-4 h-4" /> Télécharger la vidéo
              </a>
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
            <div className="bg-[#0d1117] border border-white/10 rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <h3 className="text-white font-semibold text-base">Images</h3>
                  <span className="text-xs text-white/40 bg-white/5 px-2 py-0.5 rounded-full">{images.length} image{images.length > 1 ? 's' : ''}</span>
                </div>
                {images.length > 0 && (
                  <button onClick={handleClearAll}
                    className="flex items-center gap-1 text-xs text-white/40 hover:text-white/70 border border-white/10 rounded-lg px-2 py-1 hover:bg-white/5 transition-colors">
                    <Trash2 className="w-3 h-3" /> Effacer
                  </button>
                )}
              </div>

              {images.length === 0 ? (
                <div className="border-2 border-dashed border-white/10 rounded-xl p-6 text-center bg-white/[0.02] cursor-pointer hover:border-white/20 transition-colors"
                  onClick={() => fileInputRef.current?.click()}>
                  <Upload className="w-8 h-8 mx-auto mb-2 text-white/20" />
                  <p className="text-sm text-white/40">Ajouter des images</p>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    {images.map((img, index) => (
                      <div key={img.id}
                        className={`relative aspect-square rounded-lg overflow-hidden border-2 cursor-pointer group transition-all ${
                          index === selectedIndex ? 'border-[#00d4ff] shadow-[0_0_10px_rgba(0,212,255,0.2)]' : 'border-white/10 hover:border-white/20'
                        }`}>
                        <button onClick={() => setSelectedIndex(index)} className="absolute inset-0 w-full h-full">
                          <img src={img.url} alt={img.file.name} className="w-full h-full object-cover" />
                        </button>
                        {index === selectedIndex && (
                          <div className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-[#00d4ff] flex items-center justify-center">
                            <div className="w-2 h-2 rounded-full bg-white" />
                          </div>
                        )}
                        <button onClick={(e) => { e.stopPropagation(); handleRemoveImage(index); }}
                          className="absolute top-1 left-1 w-5 h-5 rounded-full bg-black/70 hover:bg-red-500/80 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all">
                          <X className="w-3 h-3 text-white" />
                        </button>
                      </div>
                    ))}
                  </div>
                  <div className="border-2 border-dashed border-white/10 rounded-lg p-3 text-center bg-white/[0.02] cursor-pointer hover:border-white/20 transition-colors"
                    onClick={() => fileInputRef.current?.click()}>
                    <Upload className="w-5 h-5 mx-auto mb-1 text-white/30" />
                    <p className="text-xs text-white/40">Ajouter des images</p>
                  </div>
                </div>
              )}
            </div>

            {/* Logo + Position + Opacity — combined card */}
            <div className="bg-[#0d1117] border border-white/10 rounded-xl p-4">
              {/* Logo + Position side by side */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                {/* Logo */}
                <div>
                  <h3 className="text-white font-semibold text-base mb-3">Logo</h3>
                  {logoUrl ? (
                    <div className="relative rounded-xl overflow-hidden border border-white/10 bg-white/[0.02]" style={{ aspectRatio: '1' }}>
                      <img src={logoUrl} alt="Logo" className="w-full h-full object-contain p-3" />
                      <button onClick={handleRemoveLogo}
                        className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-black/70 hover:bg-red-500/80 flex items-center justify-center transition-colors">
                        <X className="w-3 h-3 text-white" />
                      </button>
                    </div>
                  ) : (
                    <div className="border-2 border-dashed border-white/10 rounded-xl text-center bg-white/[0.02] cursor-pointer hover:border-white/20 transition-colors flex flex-col items-center justify-center"
                      style={{ aspectRatio: '1' }}
                      onClick={() => logoInputRef.current?.click()}>
                      <Upload className="w-8 h-8 mb-2 text-white/20" />
                      <p className="text-sm text-white/50">Télécharger un logo</p>
                      <p className="text-xs text-white/30 mt-1">PNG, SVG, WebP, JPG</p>
                      <input ref={logoInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => handleLogoUpload(e.target.files)} />
                    </div>
                  )}
                </div>

                {/* Position */}
                <div>
                  <h3 className="text-white font-semibold text-base mb-3">Position</h3>
                  <div className="grid grid-cols-3 gap-1.5" style={{ aspectRatio: '1' }}>
                    {(['TL', 'TC', 'TR', 'ML', 'C', 'MR', 'BL', 'BC', 'BR'] as LogoPosition[]).map((pos) => (
                      <button key={pos} onClick={() => setLogoPosition(pos)}
                        className={`rounded-lg border-2 flex items-center justify-center text-xs font-medium transition-all ${
                          logoPosition === pos
                            ? 'border-[#00d4ff] bg-[#00d4ff]/10 text-[#00d4ff] shadow-[0_0_8px_rgba(0,212,255,0.15)]'
                            : 'border-white/10 text-white/40 hover:border-white/20 hover:text-white/60 bg-white/[0.02]'
                        }`}>
                        {pos}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Opacity — below Logo+Position */}
              <div className="mt-4 pt-4 border-t border-white/5">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-white font-semibold text-base">Opacité</h3>
                  <span className="text-sm text-white/50">{logoOpacity}%</span>
                </div>
                <div className="relative">
                  <input type="range" min="0" max="100" value={logoOpacity}
                    onChange={(e) => setLogoOpacity(Number(e.target.value))}
                    className="w-full h-1.5 rounded-full appearance-none cursor-pointer opacity-slider"
                    style={{
                      background: `linear-gradient(to right, #00d4ff 0%, #00d4ff ${logoOpacity}%, rgba(255,255,255,0.1) ${logoOpacity}%, rgba(255,255,255,0.1) 100%)`,
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Generate Button */}
            {images.length > 0 && (
              <button onClick={handleGenerate} disabled={isGenerating}
                className="w-full px-4 py-3 bg-gradient-to-r from-[#00d4ff] to-[#00c9b7] text-white font-semibold text-sm rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-[#00d4ff]/10">
                {isGenerating ? 'Génération en cours...' : 'Générer la vidéo'}
              </button>
            )}
          </div>
        </div>

        {/* Hidden file input */}
        <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => handleFiles(e.target.files)} />
      </div>
    </div>
  );
}
