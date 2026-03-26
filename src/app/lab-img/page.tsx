'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { Loader2, Upload, Sparkles, Download, X } from 'lucide-react';

type Engine = 'flash' | 'pro';
type Status = 'idle' | 'uploading' | 'generating' | 'polling' | 'done' | 'error';

const ENGINE_LABELS: Record<Engine, string> = {
  flash: 'Nano Banana 2 (Gemini 3.1 Flash Image)',
  pro: 'Nano Banana Pro (Gemini 3 Pro Image)',
};

const compressImage = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new window.Image();
      img.onload = () => {
        const max = 1024;
        let w = img.width;
        let h = img.height;
        if (w > max) { h = (max / w) * h; w = max; }
        if (h > max) { w = (max / h) * w; h = max; }
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(w);
        canvas.height = Math.round(h);
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.8));
      };
      img.onerror = () => reject(new Error('Image load failed'));
      img.src = e.target?.result as string;
    };
    reader.onerror = () => reject(new Error('File read failed'));
    reader.readAsDataURL(file);
  });

export default function LabImgPage() {
  const searchParams = useSearchParams();
  const secretKey = searchParams.get('key') ?? '';

  const [engine, setEngine] = useState<Engine>('flash');
  const [prompt, setPrompt] = useState('');
  const [aspectRatio, setAspectRatio] = useState('1:1');
  const [sourcePreview, setSourcePreview] = useState<string | null>(null);
  const [sourceBase64, setSourceBase64] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>('idle');
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [taskId, setTaskId] = useState<string | null>(null);
  const [log, setLog] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollCountRef = useRef(0);

  const addLog = useCallback((msg: string) => {
    setLog((prev) => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev].slice(0, 30));
  }, []);

  const stopPolling = useCallback(() => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
  }, []);

  useEffect(() => () => stopPolling(), [stopPolling]);

  const startPolling = useCallback((tid: string) => {
    pollCountRef.current = 0;
    pollRef.current = setInterval(async () => {
      pollCountRef.current++;
      if (pollCountRef.current > 60) {
        stopPolling();
        setStatus('error');
        setError('Timeout : plus de 3 minutes sans résultat.');
        addLog('⏱ Timeout polling.');
        return;
      }
      try {
        const res = await fetch(`/api/check-image-status?taskId=${tid}`);
        const data = await res.json() as { status: string; url?: string; message?: string };
        addLog(`Poll #${pollCountRef.current} → ${data.status}${data.url ? ' ✅' : ''}`);
        if (data.status === 'ready' && data.url) {
          stopPolling();
          setResultUrl(data.url);
          setStatus('done');
        } else if (data.status === 'error') {
          stopPolling();
          setStatus('error');
          setError(data.message || 'Erreur NanoBanana');
        }
      } catch (e: unknown) {
        addLog(`Poll error: ${e instanceof Error ? e.message : String(e)}`);
      }
    }, 3000);
  }, [stopPolling, addLog]);

  const handleFile = async (file: File) => {
    if (!file.type.startsWith('image/')) { setError('Fichier image requis (jpg/png)'); return; }
    setStatus('uploading');
    setError(null);
    addLog(`Compression de ${file.name} (${(file.size / 1024).toFixed(0)} KB)...`);
    try {
      const b64 = await compressImage(file);
      setSourceBase64(b64);
      setSourcePreview(b64);
      addLog(`Image compressée → ${(b64.length / 1024).toFixed(0)} KB base64`);
      setStatus('idle');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Compression échouée');
      setStatus('idle');
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const generate = async () => {
    if (!sourceBase64) { setError('Choisir une image d\'abord'); return; }
    if (!secretKey) { setError('Clé secrète manquante dans l\'URL (?key=...)'); return; }
    stopPolling();
    setStatus('generating');
    setResultUrl(null);
    setTaskId(null);
    setError(null);
    addLog(`Envoi au modèle ${ENGINE_LABELS[engine]}...`);

    try {
      const res = await fetch(`/api/lab-test-img?key=${encodeURIComponent(secretKey)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sourceImage: sourceBase64, prompt: prompt.trim() || undefined, engine, aspectRatio }),
      });
      const data = await res.json() as { taskId?: string; error?: string; raw?: string };
      if (!res.ok || data.error) {
        setStatus('error');
        setError(data.error || `HTTP ${res.status}`);
        if (data.raw) addLog(`Raw: ${data.raw.slice(0, 200)}`);
        return;
      }
      const tid = data.taskId!;
      setTaskId(tid);
      addLog(`✅ Task soumise : ${tid}`);
      setStatus('polling');
      startPolling(tid);
    } catch (e: unknown) {
      setStatus('error');
      setError(e instanceof Error ? e.message : 'Erreur réseau');
    }
  };

  const reset = () => {
    stopPolling();
    setStatus('idle');
    setResultUrl(null);
    setTaskId(null);
    setError(null);
    setSourceBase64(null);
    setSourcePreview(null);
    setLog([]);
  };

  const isProcessing = status === 'generating' || status === 'polling' || status === 'uploading';

  return (
    <div className="min-h-screen bg-black text-white p-6 font-mono">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <span className="text-2xl">🔬</span>
            <h1 className="text-xl font-bold text-[#00d4ff]">Lab — Test Génération Images</h1>
          </div>
          <p className="text-xs text-zinc-500">
            Page de test interne. URL : <code className="text-zinc-400">/lab-img?key=...</code>
          </p>
          {!secretKey && (
            <div className="mt-3 p-3 bg-red-900/40 border border-red-500/50 rounded text-red-300 text-sm">
              ⚠️ Clé secrète manquante — ajoute <code>?key=VALEUR</code> à l&apos;URL
            </div>
          )}
        </div>

        <div className="space-y-6">
          {/* Image upload */}
          <div>
            <label className="block text-sm font-bold text-white mb-2">Image source</label>
            {!sourcePreview ? (
              <div
                className="border-2 border-dashed border-white/20 rounded-xl p-10 text-center cursor-pointer hover:border-[#00d4ff]/50 transition-colors"
                onClick={() => fileInputRef.current?.click()}
                onDrop={handleDrop}
                onDragOver={(e) => e.preventDefault()}
              >
                <Upload size={32} className="mx-auto mb-3 text-zinc-500" />
                <p className="text-sm text-zinc-400">Clique ou dépose une image JPG/PNG</p>
                <input ref={fileInputRef} type="file" accept="image/*" className="hidden"
                  onChange={(e) => { if (e.target.files?.[0]) handleFile(e.target.files[0]); }} />
              </div>
            ) : (
              <div className="relative inline-block">
                <img src={sourcePreview} alt="source" className="max-h-48 rounded-xl border border-white/10" />
                <button onClick={() => { setSourcePreview(null); setSourceBase64(null); }}
                  className="absolute -top-2 -right-2 bg-red-600 rounded-full p-1 hover:bg-red-500">
                  <X size={14} />
                </button>
              </div>
            )}
          </div>

          {/* Engine selector */}
          <div>
            <label className="block text-sm font-bold text-white mb-3">Modèle</label>
            <div className="grid grid-cols-2 gap-3">
              {(['flash', 'pro'] as Engine[]).map((e) => (
                <button key={e} onClick={() => setEngine(e)} type="button"
                  className={`py-3 px-4 rounded-xl text-sm font-semibold border transition-all text-left ${
                    engine === e
                      ? 'bg-gradient-to-r from-[#00d4ff] to-[#00c9b7] text-black border-transparent shadow-lg shadow-[#00d4ff]/30'
                      : 'bg-black border-white/10 text-white hover:border-white/30'
                  }`}>
                  <div className="font-bold">{e === 'flash' ? '⚡ Flash' : '💎 Pro'}</div>
                  <div className={`text-xs mt-0.5 ${engine === e ? 'text-black/70' : 'text-zinc-500'}`}>
                    {ENGINE_LABELS[e]}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Aspect ratio */}
          <div>
            <label className="block text-sm font-bold text-white mb-2">Format</label>
            <div className="flex gap-2 flex-wrap">
              {['1:1', '16:9', '9:16', '4:3', '3:4'].map((r) => (
                <button key={r} onClick={() => setAspectRatio(r)} type="button"
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                    aspectRatio === r
                      ? 'bg-[#00d4ff] text-black border-transparent'
                      : 'bg-black border-white/10 text-white hover:border-white/30'
                  }`}>
                  {r}{r === '1:1' ? ' (Etsy)' : ''}
                </button>
              ))}
            </div>
          </div>

          {/* Prompt */}
          <div>
            <label className="block text-sm font-bold text-white mb-2">
              Prompt <span className="text-zinc-500 font-normal">(optionnel)</span>
            </label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Ex: Professional product photo, white background, studio lighting..."
              rows={3}
              className="w-full bg-zinc-900 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-[#00d4ff]/50 resize-none"
            />
          </div>

          {/* Generate button */}
          <button
            onClick={generate}
            disabled={isProcessing || !sourceBase64 || !secretKey}
            className="w-full py-4 bg-gradient-to-r from-[#00d4ff] to-[#00c9b7] text-black font-bold rounded-xl hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 shadow-lg shadow-[#00d4ff]/20"
          >
            {isProcessing ? (
              <><Loader2 size={20} className="animate-spin" /> {status === 'polling' ? `Polling... (task: ${taskId?.slice(0, 12)}...)` : 'Génération...'}</>
            ) : (
              <><Sparkles size={20} /> GÉNÉRER — {ENGINE_LABELS[engine]}</>
            )}
          </button>

          {/* Error */}
          {error && (
            <div className="p-4 bg-red-900/40 border border-red-500/50 rounded-xl text-red-300 text-sm">
              ❌ {error}
            </div>
          )}

          {/* Result */}
          {resultUrl && status === 'done' && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-bold text-green-400">✅ Image générée</span>
                <div className="flex gap-2">
                  <a href={resultUrl} target="_blank" rel="noreferrer"
                    className="px-3 py-1.5 bg-zinc-800 border border-white/10 rounded-lg text-xs hover:bg-zinc-700 flex items-center gap-1">
                    <Download size={14} /> Ouvrir
                  </a>
                  <button onClick={reset}
                    className="px-3 py-1.5 bg-zinc-800 border border-white/10 rounded-lg text-xs hover:bg-zinc-700">
                    Nouveau test
                  </button>
                </div>
              </div>
              <img src={resultUrl} alt="generated" className="w-full max-w-md rounded-xl border border-white/10" />
            </div>
          )}

          {/* Debug log */}
          {log.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-bold text-zinc-500">LOG</label>
                <button onClick={() => setLog([])} className="text-xs text-zinc-600 hover:text-zinc-400">Effacer</button>
              </div>
              <div className="bg-zinc-950 border border-white/5 rounded-xl p-4 max-h-48 overflow-y-auto">
                {log.map((line, i) => (
                  <div key={i} className="text-xs text-zinc-400 leading-relaxed">{line}</div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
