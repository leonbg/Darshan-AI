import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  RotateCcw,
  Repeat,
  Download,
  Image as ImageIcon,
  Film,
  Sparkles,
  ExternalLink,
  BookOpen,
  Youtube,
  Maximize2,
  X,
  AlertTriangle,
  Loader2,
  Wand2,
  Clapperboard,
  SlidersHorizontal,
  ShieldAlert,
  CheckCircle2,
} from 'lucide-react';
import {
  YouTubeVisualAnalysisResult,
  YouTubeVisualIllustration,
  YouTubeAnimationScene,
  YouTubeVisualStyle,
  YouTubeOutputMode,
  YouTubeAspectRatio,
  YouTubeImageQualityTier,
  YouTubeGeneratedVideoClip,
  YouTubeRitualTradition,
} from '../../types';
import {
  requestAnalyzeYouTubeVisuals,
  requestRegenerateYouTubeIllustration,
  requestGenerateYouTubeAnimation,
} from '../../services';

interface YouTubeVisualStudioProps {
  initialYoutubeUrl?: string | null;
  autoTriggerSignal?: number;
  onSendTopicToDerasha?: (topic: string) => void;
}

const STYLE_OPTIONS: Array<{
  id: YouTubeVisualStyle;
  label: string;
  subtitle: string;
}> = [
  {
    id: 'editorial_iluminado',
    label: 'Editorial Iluminado',
    subtitle: 'Azul nocturno, oro y luz clásica',
  },
  {
    id: 'diagrama_filosofico',
    label: 'Diagrama Filosófico',
    subtitle: 'Ejes analíticos, polos y síntesis',
  },
  {
    id: 'acuarela_pergamino',
    label: 'Pergamino y Tinta',
    subtitle: 'Tonos ámbar cálidos y caligrafía',
  },
  {
    id: 'geometria_cabalistica',
    label: 'Geometría Sagrada',
    subtitle: 'Círculos concéntricos y Sefirot',
  },
];

const MODE_OPTIONS: Array<{ id: YouTubeOutputMode; label: string }> = [
  { id: 'both', label: 'Ilustraciones y Animación' },
  { id: 'illustrations', label: 'Solo Ilustraciones' },
  { id: 'animation', label: 'Solo Animación' },
];

const EXAMPLE_VIDEOS: Array<{ label: string; url: string; focus: string }> = [
  {
    label: 'Rabbi Jonathan Sacks · Embajadores de Dios: Responsabilidad Universal',
    url: 'https://www.youtube.com/watch?v=955EjG_97gg',
    focus: 'Ilustrar la tensión entre identidad particular y responsabilidad universal',
  },
];

function sanitizeClientSvg(rawSvg: string): string {
  const match = String(rawSvg || '').match(/<svg[\s\S]*?<\/svg>/i);
  if (!match) return '';
  return match[0]
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<foreignObject[\s\S]*?<\/foreignObject>/gi, '')
    .replace(/<(iframe|object|embed|link|meta)[^>]*>[\s\S]*?<\/\1>/gi, '')
    .replace(/<(iframe|object|embed|link|meta)[^>]*\/?>/gi, '')
    .replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/javascript:/gi, '');
}

function wrapCanvasText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
): string[] {
  const words = String(text || '').split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (ctx.measureText(candidate).width <= maxWidth) {
      current = candidate;
    } else {
      if (current) lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines;
}

function drawAnimatedSceneFrame(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  scene: YouTubeAnimationScene,
  progress: number,
  globalTimeSec: number
) {
  const cx = width / 2;
  const cy = height * 0.43;
  const minDim = Math.min(width, height);

  const bgGrad = ctx.createRadialGradient(cx, cy, minDim * 0.05, cx, cy, minDim * 0.85);
  bgGrad.addColorStop(0, `${scene.secondaryColor}44`);
  bgGrad.addColorStop(0.55, scene.primaryColor || '#0b1120');
  bgGrad.addColorStop(1, '#050814');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, width, height);

  const fadeAlpha =
    progress < 0.12
      ? progress / 0.12
      : progress > 0.88
      ? (1 - progress) / 0.12
      : 1;

  ctx.save();
  ctx.globalAlpha = Math.max(0.15, Math.min(1, fadeAlpha));

  const t = globalTimeSec;
  const baseRadius = minDim * 0.24;

  if (scene.motionPattern === 'radiant_rays') {
    const rayCount = 16;
    for (let i = 0; i < rayCount; i++) {
      const angle = (i / rayCount) * Math.PI * 2 + t * 0.18;
      const pulse = 0.75 + 0.25 * Math.sin(t * 2 + i);
      const rOuter = baseRadius * (1.45 * pulse);
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(angle) * 28, cy + Math.sin(angle) * 28);
      ctx.lineTo(cx + Math.cos(angle) * rOuter, cy + Math.sin(angle) * rOuter);
      ctx.strokeStyle = i % 2 === 0 ? `${scene.accentColor}88` : `${scene.secondaryColor}77`;
      ctx.lineWidth = i % 2 === 0 ? 2.5 : 1.4;
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.arc(cx, cy, baseRadius * 0.55, 0, Math.PI * 2);
    ctx.strokeStyle = scene.accentColor;
    ctx.lineWidth = 2.5;
    ctx.stroke();
  } else if (scene.motionPattern === 'orbiting_spheres') {
    for (let ring = 1; ring <= 3; ring++) {
      const r = baseRadius * (0.45 * ring);
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.strokeStyle = `${scene.secondaryColor}55`;
      ctx.setLineDash([6, 6]);
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.setLineDash([]);

      const orbitAngle = t * (0.7 / ring) + ring * 1.4;
      const ox = cx + Math.cos(orbitAngle) * r;
      const oy = cy + Math.sin(orbitAngle) * r;
      ctx.beginPath();
      ctx.arc(ox, oy, 7 + ring * 2, 0, Math.PI * 2);
      ctx.fillStyle = ring === 2 ? scene.accentColor : scene.secondaryColor;
      ctx.fill();
    }
  } else if (scene.motionPattern === 'scroll_unfold') {
    const openW = minDim * 0.52 * (0.45 + 0.55 * Math.min(1, progress * 1.6));
    const scrollH = minDim * 0.34;
    ctx.fillStyle = `${scene.secondaryColor}1e`;
    ctx.strokeStyle = scene.accentColor;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(cx - openW / 2, cy - scrollH / 2, openW, scrollH, 12);
    ctx.fill();
    ctx.stroke();

    for (const side of [-1, 1]) {
      ctx.fillStyle = scene.accentColor;
      ctx.beginPath();
      ctx.roundRect(cx + side * (openW / 2) - 6, cy - scrollH / 2 - 14, 12, scrollH + 28, 6);
      ctx.fill();
    }
  } else if (scene.motionPattern === 'ascending_sparks') {
    for (let i = 0; i < 24; i++) {
      const seed = i * 137.5;
      const x = cx + Math.sin(seed + t * 0.6) * (width * 0.32);
      const cycle = (progress * 1.2 + i * 0.08) % 1;
      const y = height * 0.68 - cycle * (height * 0.56);
      const r = 2.5 + (i % 4) * 1.4;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fillStyle = i % 3 === 0 ? scene.accentColor : scene.secondaryColor;
      ctx.fill();
    }
  } else {
    const span = minDim * 0.38;
    const leftX = cx - span;
    const rightX = cx + span;
    ctx.beginPath();
    ctx.arc(leftX, cy, 44, 0, Math.PI * 2);
    ctx.strokeStyle = scene.secondaryColor;
    ctx.lineWidth = 2.5;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(rightX, cy, 44, 0, Math.PI * 2);
    ctx.strokeStyle = scene.accentColor;
    ctx.lineWidth = 2.5;
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(leftX + 44, cy);
    ctx.quadraticCurveTo(cx, cy - 85 - Math.sin(t * 2) * 14, rightX - 44, cy);
    ctx.strokeStyle = '#f8fafc';
    ctx.lineWidth = 2.5;
    ctx.stroke();
  }

  const haloR = minDim * 0.14;
  ctx.beginPath();
  ctx.arc(cx, cy, haloR, 0, Math.PI * 2);
  ctx.fillStyle = '#070c18cc';
  ctx.fill();
  ctx.strokeStyle = `${scene.accentColor}aa`;
  ctx.lineWidth = 1.8;
  ctx.stroke();

  ctx.fillStyle = scene.accentColor || '#fbbf24';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `700 ${Math.round(minDim * 0.068)}px "Frank Ruhl Libre", Georgia, serif`;
  ctx.fillText(scene.hebrewMotif || 'אוֹר', cx, cy);

  const elems = (scene.keyElements || []).slice(0, 3);
  elems.forEach((el, idx) => {
    const angle =
      -Math.PI / 2 + ((idx + 1) * (Math.PI * 2)) / (elems.length + 1) + Math.sin(t + idx) * 0.08;
    const ex = cx + Math.cos(angle) * (baseRadius * 1.28);
    const ey = cy + Math.sin(angle) * (baseRadius * 0.85);
    ctx.fillStyle = '#0f172ad9';
    ctx.strokeStyle = `${scene.secondaryColor}88`;
    ctx.lineWidth = 1;
    const labelText = el.label.slice(0, 26);
    ctx.font = `600 ${Math.round(minDim * 0.028)}px "Plus Jakarta Sans", sans-serif`;
    const tw = ctx.measureText(labelText).width + 22;
    ctx.beginPath();
    ctx.roundRect(ex - tw / 2, ey - 14, tw, 28, 6);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#e2e8f0';
    ctx.fillText(labelText, ex, ey);
  });

  const scrimGrad = ctx.createLinearGradient(0, height * 0.56, 0, height);
  scrimGrad.addColorStop(0, 'rgba(5, 8, 20, 0)');
  scrimGrad.addColorStop(0.42, 'rgba(5, 8, 20, 0.82)');
  scrimGrad.addColorStop(1, 'rgba(5, 8, 20, 0.96)');
  ctx.fillStyle = scrimGrad;
  ctx.fillRect(0, height * 0.56, width, height * 0.44);

  ctx.fillStyle = scene.secondaryColor || '#38bdf8';
  ctx.font = `600 ${Math.round(minDim * 0.026)}px "Plus Jakarta Sans", monospace`;
  ctx.fillText(`Escena ${scene.sceneNumber}  ·  ${scene.timestampRange}`, cx, height * 0.72);

  ctx.fillStyle = '#ffffff';
  ctx.font = `700 ${Math.round(minDim * 0.048)}px "Frank Ruhl Libre", Georgia, serif`;
  const headlineLines = wrapCanvasText(ctx, scene.headline, width * 0.84).slice(0, 2);
  headlineLines.forEach((line, lIdx) => {
    ctx.fillText(line, cx, height * 0.785 + lIdx * (minDim * 0.056));
  });

  ctx.fillStyle = '#cbd5e1';
  ctx.font = `400 ${Math.round(minDim * 0.03)}px "Plus Jakarta Sans", sans-serif`;
  const captionLines = wrapCanvasText(ctx, scene.narrationCaption, width * 0.84).slice(0, 2);
  const captionStartY =
    height * 0.785 + headlineLines.length * (minDim * 0.056) + minDim * 0.02;
  captionLines.forEach((line, lIdx) => {
    ctx.fillText(line, cx, captionStartY + lIdx * (minDim * 0.038));
  });

  ctx.restore();
}

function parseDataUrlParts(dataUrl: string): { mimeType: string; data: string } | null {
  const match = String(dataUrl || '').match(/^data:([^;]+);base64,(.+)$/);
  if (!match) return null;
  return { mimeType: match[1], data: match[2] };
}

export const YouTubeVisualStudio: React.FC<YouTubeVisualStudioProps> = React.memo(
  ({ initialYoutubeUrl, autoTriggerSignal, onSendTopicToDerasha }) => {
    const [youtubeUrl, setYoutubeUrl] = useState(initialYoutubeUrl || '');
    const [customFocus, setCustomFocus] = useState('');
    const [outputMode, setOutputMode] = useState<YouTubeOutputMode>('both');
    const [visualStyle, setVisualStyle] = useState<YouTubeVisualStyle>('editorial_iluminado');
    const [aspectRatio, setAspectRatio] = useState<YouTubeAspectRatio>('16:9');
    const [imageQuality, setImageQuality] = useState<YouTubeImageQualityTier>('flash_lite');

    const [isLoading, setIsLoading] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [result, setResult] = useState<YouTubeVisualAnalysisResult | null>(null);
    const [thumbnailFailed, setThumbnailFailed] = useState(false);

    // Gallery & Illustration layer toggles
    const [activeStudioTab, setActiveStudioTab] = useState<'illustrations' | 'animation'>(
      'illustrations'
    );
    const [selectedIllustration, setSelectedIllustration] =
      useState<YouTubeVisualIllustration | null>(null);
    const [viewModeByCard, setViewModeByCard] = useState<Record<string, 'raster' | 'svg'>>({});
    const [regeneratingId, setRegeneratingId] = useState<string | null>(null);

    // Canvas 60fps Animation Player state
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const [isPlaying, setIsPlaying] = useState(true);
    const [isLooping, setIsLooping] = useState(true);
    const [playbackSpeed, setPlaybackSpeed] = useState<0.5 | 1 | 1.5>(1);
    const [activeSceneIndex, setActiveSceneIndex] = useState(0);
    const [sceneProgress, setSceneProgress] = useState(0);
    const [isRecordingWebm, setIsRecordingWebm] = useState(false);

    // Omni Flash AI MP4 Video state
    const [animationStageView, setAnimationStageView] = useState<'canvas' | 'ai_video'>('canvas');
    const [videoPromptInput, setVideoPromptInput] = useState('');
    const [videoDuration, setVideoDuration] = useState<'6s' | '10s'>('6s');
    const [videoResolution, setVideoResolution] = useState<'720p' | '1080p'>('720p');
    const [useReferenceKeyframes, setUseReferenceKeyframes] = useState(true);
    const [isGeneratingVideo, setIsGeneratingVideo] = useState(false);
    const [videoError, setVideoError] = useState<string | null>(null);
    const [generatedVideo, setGeneratedVideo] = useState<YouTubeGeneratedVideoClip | null>(null);

    // Ritual Tradition Gate state (ask before showing close-up wrapping details)
    const [selectedTradition, setSelectedTradition] = useState<YouTubeRitualTradition | null>(
      null
    );
    const [isApplyingTradition, setIsApplyingTradition] = useState(false);

    const animStateRef = useRef({
      sceneIndex: 0,
      elapsedInScene: 0,
      globalTime: 0,
    });

    const handleAnalyze = useCallback(
      async (overrideUrl?: string, overrideFocus?: string) => {
        const targetUrl = (overrideUrl ?? youtubeUrl).trim();
        if (!targetUrl) {
          setErrorMessage('Ingresa una URL válida de YouTube para iniciar el análisis.');
          return;
        }
        setIsLoading(true);
        setErrorMessage(null);
        setThumbnailFailed(false);
        setGeneratedVideo(null);
        setVideoError(null);
        setAnimationStageView('canvas');
        setSelectedTradition(null);
        try {
          const data = await requestAnalyzeYouTubeVisuals({
            youtubeUrl: targetUrl,
            outputMode,
            visualStyle,
            aspectRatio,
            imageQuality,
            customFocus: (overrideFocus ?? customFocus).trim(),
          });
          setResult(data);
          setViewModeByCard({});
          setVideoPromptInput(data.animationStoryboard?.videoPrompt || '');
          setActiveSceneIndex(0);
          setSceneProgress(0);
          animStateRef.current = { sceneIndex: 0, elapsedInScene: 0, globalTime: 0 };
          setIsPlaying(true);
          if (outputMode === 'animation') {
            setActiveStudioTab('animation');
          } else {
            setActiveStudioTab('illustrations');
          }
        } catch (err: any) {
          setErrorMessage(
            err?.message || 'No se pudo analizar el video de YouTube en este momento.'
          );
        } finally {
          setIsLoading(false);
        }
      },
      [youtubeUrl, outputMode, visualStyle, aspectRatio, imageQuality, customFocus]
    );

    const handleSelectTradition = useCallback(
      async (tradId: YouTubeRitualTradition) => {
        if (!result) return;
        setSelectedTradition(tradId);
        setIsApplyingTradition(true);
        setErrorMessage(null);
        setGeneratedVideo(null);
        try {
          const updated = await requestAnalyzeYouTubeVisuals({
            youtubeUrl: result.canonicalUrl,
            outputMode: result.outputMode,
            visualStyle: result.visualStyle,
            aspectRatio: result.aspectRatio,
            imageQuality: result.imageQuality || imageQuality,
            traditionPreference: tradId,
            customFocus: customFocus.trim(),
          });
          setResult(updated);
          setVideoPromptInput(updated.animationStoryboard?.videoPrompt || '');
        } catch (err: any) {
          setErrorMessage(
            err?.message || 'No se pudo adaptar el close-up a la tradición seleccionada.'
          );
        } finally {
          setIsApplyingTradition(false);
        }
      },
      [result, imageQuality, customFocus]
    );

    useEffect(() => {
      if (initialYoutubeUrl && autoTriggerSignal) {
        setYoutubeUrl(initialYoutubeUrl);
        handleAnalyze(initialYoutubeUrl);
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [autoTriggerSignal]);

    const scenes = useMemo(
      () => result?.animationStoryboard?.scenes || [],
      [result]
    );

    // Canvas 60fps Animation Loop (with 10Hz UI progress bar sync)
    useEffect(() => {
      const canvas = canvasRef.current;
      if (
        !canvas ||
        scenes.length === 0 ||
        activeStudioTab !== 'animation' ||
        animationStageView !== 'canvas'
      ) {
        return;
      }
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      let rafId = 0;
      let lastTs = performance.now();
      let lastUiSync = lastTs;

      const renderLoop = (now: number) => {
        const dt = Math.min((now - lastTs) / 1000, 0.1);
        lastTs = now;

        const st = animStateRef.current;
        const currentScene = scenes[st.sceneIndex] || scenes[0];
        const duration = Math.max(currentScene?.durationSec || 5, 2);

        if (isPlaying) {
          st.globalTime += dt * playbackSpeed;
          st.elapsedInScene += dt * playbackSpeed;
          let sceneChanged = false;
          if (st.elapsedInScene >= duration) {
            if (st.sceneIndex + 1 < scenes.length) {
              st.sceneIndex += 1;
              st.elapsedInScene = 0;
              sceneChanged = true;
              setActiveSceneIndex(st.sceneIndex);
            } else if (isLooping) {
              st.sceneIndex = 0;
              st.elapsedInScene = 0;
              sceneChanged = true;
              setActiveSceneIndex(0);
            } else {
              st.elapsedInScene = duration;
              sceneChanged = true;
              setIsPlaying(false);
            }
          }
          if (sceneChanged || now - lastUiSync >= 100) {
            lastUiSync = now;
            setSceneProgress(Math.min(1, st.elapsedInScene / duration));
          }
        }

        const active = scenes[st.sceneIndex] || scenes[0];
        const prog = Math.min(1, st.elapsedInScene / Math.max(active?.durationSec || 5, 2));
        drawAnimatedSceneFrame(ctx, canvas.width, canvas.height, active, prog, st.globalTime);

        rafId = requestAnimationFrame(renderLoop);
      };

      rafId = requestAnimationFrame(renderLoop);
      return () => cancelAnimationFrame(rafId);
    }, [scenes, activeStudioTab, animationStageView, isPlaying, isLooping, playbackSpeed]);

    const handleSelectScene = useCallback((idx: number) => {
      animStateRef.current.sceneIndex = idx;
      animStateRef.current.elapsedInScene = 0;
      setActiveSceneIndex(idx);
      setSceneProgress(0);
      setAnimationStageView('canvas');
    }, []);

    const handleRegenerateIllustration = useCallback(
      async (ill: YouTubeVisualIllustration, targetQuality: YouTubeImageQualityTier) => {
        if (!result) return;
        setRegeneratingId(ill.id);
        try {
          const updated = await requestRegenerateYouTubeIllustration({
            prompt: ill.imagePrompt || `${ill.title}: ${ill.visualConcept}`,
            visualStyle: result.visualStyle,
            aspectRatio: result.aspectRatio,
            imageQuality: targetQuality,
            traditionPreference: selectedTradition || result.selectedTradition,
            title: ill.title,
          });
          setResult((prev) => {
            if (!prev) return prev;
            return {
              ...prev,
              illustrations: prev.illustrations.map((item) =>
                item.id === ill.id
                  ? {
                      ...item,
                      imageDataUrl: updated.imageDataUrl,
                      imageModelUsed: updated.imageModelUsed,
                    }
                  : item
              ),
            };
          });
          setViewModeByCard((prev) => ({ ...prev, [ill.id]: 'raster' }));
          if (selectedIllustration?.id === ill.id) {
            setSelectedIllustration((prev) =>
              prev
                ? {
                    ...prev,
                    imageDataUrl: updated.imageDataUrl,
                    imageModelUsed: updated.imageModelUsed,
                  }
                : prev
            );
          }
        } catch (err: any) {
          setErrorMessage(err?.message || 'No se pudo regenerar la ilustración solicitada.');
        } finally {
          setRegeneratingId(null);
        }
      },
      [result, selectedIllustration]
    );

    const handleDownloadSvg = useCallback((ill: YouTubeVisualIllustration) => {
      const clean = sanitizeClientSvg(ill.svgMarkup);
      const blob = new Blob([clean], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `darshan-ilustracion-escena-${ill.sceneNumber}.svg`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    }, []);

    const handleDownloadPng = useCallback(
      (ill: YouTubeVisualIllustration, preferRaster = true) => {
        if (preferRaster && ill.imageDataUrl) {
          const a = document.createElement('a');
          a.href = ill.imageDataUrl;
          a.download = `darshan-ilustracion-ia-escena-${ill.sceneNumber}.png`;
          document.body.appendChild(a);
          a.click();
          a.remove();
          return;
        }
        const clean = sanitizeClientSvg(ill.svgMarkup);
        const w = result?.aspectRatio === '9:16' ? 900 : 1600;
        const h = result?.aspectRatio === '9:16' ? 1600 : 900;
        const svgBlob = new Blob([clean], { type: 'image/svg+xml;charset=utf-8' });
        const url = URL.createObjectURL(svgBlob);
        const img = new Image();
        img.onload = () => {
          const offscreen = document.createElement('canvas');
          offscreen.width = w;
          offscreen.height = h;
          const ctx = offscreen.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0, w, h);
            offscreen.toBlob((pngBlob) => {
              if (!pngBlob) return;
              const pngUrl = URL.createObjectURL(pngBlob);
              const a = document.createElement('a');
              a.href = pngUrl;
              a.download = `darshan-ilustracion-escena-${ill.sceneNumber}.png`;
              document.body.appendChild(a);
              a.click();
              a.remove();
              URL.revokeObjectURL(pngUrl);
            }, 'image/png');
          }
          URL.revokeObjectURL(url);
        };
        img.src = url;
      },
      [result?.aspectRatio]
    );

    const handleExportAnimationWebm = useCallback(async () => {
      const canvas = canvasRef.current;
      if (!canvas || scenes.length === 0 || typeof MediaRecorder === 'undefined') return;
      setIsRecordingWebm(true);
      setIsPlaying(false);

      try {
        const stream = canvas.captureStream(30);
        const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
          ? 'video/webm;codecs=vp9'
          : 'video/webm';
        const recorder = new MediaRecorder(stream, { mimeType });
        const chunks: BlobPart[] = [];
        recorder.ondataavailable = (ev) => {
          if (ev.data.size > 0) chunks.push(ev.data);
        };

        const ctx = canvas.getContext('2d');
        recorder.start();

        let globalT = 0;
        for (let sIdx = 0; sIdx < scenes.length; sIdx++) {
          const sc = scenes[sIdx];
          const dur = Math.min(Math.max(sc.durationSec || 4, 3), 6);
          const totalFrames = Math.round(dur * 30);
          for (let f = 0; f < totalFrames; f++) {
            const prog = f / totalFrames;
            globalT += 1 / 30;
            if (ctx) {
              drawAnimatedSceneFrame(ctx, canvas.width, canvas.height, sc, prog, globalT);
            }
            await new Promise((r) => setTimeout(r, 33));
          }
        }

        await new Promise<void>((resolve) => {
          recorder.onstop = () => resolve();
          recorder.stop();
        });

        const blob = new Blob(chunks, { type: 'video/webm' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `darshan-animacion-${result?.videoId || 'youtube'}.webm`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
      } finally {
        setIsRecordingWebm(false);
        setIsPlaying(true);
      }
    }, [scenes, result?.videoId]);

    const handleGenerateAiVideoClip = useCallback(async () => {
      if (!result) return;
      const cleanPrompt = (
        videoPromptInput ||
        result.animationStoryboard?.videoPrompt ||
        result.coreThesis
      ).trim();
      if (!cleanPrompt) return;

      setIsGeneratingVideo(true);
      setVideoError(null);
      try {
        const refImages = useReferenceKeyframes
          ? result.illustrations
              .map((ill) => (ill.imageDataUrl ? parseDataUrlParts(ill.imageDataUrl) : null))
              .filter((x): x is { mimeType: string; data: string } => Boolean(x))
              .slice(0, 3)
          : [];

        const clip = await requestGenerateYouTubeAnimation({
          prompt: cleanPrompt,
          aspectRatio: result.aspectRatio,
          duration: videoDuration,
          resolution: videoResolution,
          traditionPreference: selectedTradition || result.selectedTradition,
          referenceImages: refImages,
        });
        setGeneratedVideo(clip);
        setAnimationStageView('ai_video');
      } catch (err: any) {
        setVideoError(err?.message || 'No se pudo generar el clip MP4 con Omni Flash.');
      } finally {
        setIsGeneratingVideo(false);
      }
    }, [result, videoPromptInput, videoDuration, videoResolution, useReferenceKeyframes]);

    const canvasDims =
      (result?.aspectRatio || aspectRatio) === '9:16'
        ? { width: 540, height: 960 }
        : { width: 960, height: 540 };

    const hasRasterRefs = Boolean(result?.illustrations.some((i) => Boolean(i.imageDataUrl)));

    return (
      <section
        id="youtube-visual-studio"
        className="rounded-2xl bg-[#090f1d] border border-slate-800/90 p-5 sm:p-6 space-y-6"
      >
        {/* Header Row */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800/80 pb-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5">
              <Youtube className="w-5 h-5 text-rose-400 shrink-0" />
              <h2 className="font-editorial text-xl sm:text-2xl font-bold text-white">
                Estudio Visual de Videos de YouTube
              </h2>
            </div>
            <p className="text-xs sm:text-sm text-slate-400">
              Analiza videos y tutoriales para comparar claridad pedagógica y generar ilustraciones IA, diagramas SVG y clips animados MP4 (Omni Flash).
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              const ex = EXAMPLE_VIDEOS[0];
              setYoutubeUrl(ex.url);
              setCustomFocus(ex.focus);
            }}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#0c1426] hover:bg-slate-800 border border-slate-700/80 text-xs font-medium text-slate-200 transition cursor-pointer whitespace-nowrap shrink-0"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span>Cargar ejemplo</span>
          </button>
        </div>

        {/* Input & Configuration Form */}
        <div className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
            <div className="lg:col-span-7 space-y-1.5">
              <label htmlFor="yt-url-input" className="block text-xs font-medium text-slate-300">
                Enlace del video de YouTube (watch, youtu.be o Shorts)
              </label>
              <input
                id="yt-url-input"
                type="url"
                value={youtubeUrl}
                onChange={(e) => setYoutubeUrl(e.target.value)}
                placeholder="https://www.youtube.com/watch?v=..."
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#070c18] border border-slate-700/90 focus:border-sky-400 text-sm text-white placeholder-slate-500 focus:outline-none"
              />
            </div>

            <div className="lg:col-span-5 space-y-1.5">
              <label htmlFor="yt-focus-input" className="block text-xs font-medium text-slate-300">
                Enfoque o detalle visual (opcional)
              </label>
              <input
                id="yt-focus-input"
                type="text"
                value={customFocus}
                onChange={(e) => setCustomFocus(e.target.value)}
                placeholder="Ej. Evaluar claridad paso a paso y simbolismo"
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#070c18] border border-slate-700/90 focus:border-sky-400 text-sm text-white placeholder-slate-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Controls Row */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            <div className="flex flex-wrap items-center gap-2.5">
              {/* Output Mode Selector */}
              <div className="flex items-center gap-1 p-1 bg-[#070c18] border border-slate-800 rounded-xl">
                {MODE_OPTIONS.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setOutputMode(m.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition whitespace-nowrap shrink-0 cursor-pointer ${
                      outputMode === m.id
                        ? 'bg-sky-400 text-slate-950 font-semibold'
                        : 'text-slate-300 hover:text-white'
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>

              {/* Aspect Ratio Selector */}
              <div className="flex items-center gap-1 p-1 bg-[#070c18] border border-slate-800 rounded-xl">
                {(['16:9', '9:16'] as YouTubeAspectRatio[]).map((ratio) => (
                  <button
                    key={ratio}
                    type="button"
                    onClick={() => setAspectRatio(ratio)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-mono transition whitespace-nowrap shrink-0 cursor-pointer ${
                      aspectRatio === ratio
                        ? 'bg-amber-400 text-slate-950 font-bold'
                        : 'text-slate-300 hover:text-white'
                    }`}
                  >
                    {ratio}
                  </button>
                ))}
              </div>

              {/* Image Model Tier Selector */}
              <div
                className="flex items-center gap-1 p-1 bg-[#070c18] border border-slate-800 rounded-xl"
                title="Calidad de generación de imágenes IA"
              >
                <button
                  type="button"
                  onClick={() => setImageQuality('flash_lite')}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition whitespace-nowrap shrink-0 cursor-pointer ${
                    imageQuality === 'flash_lite'
                      ? 'bg-emerald-400 text-slate-950 font-semibold'
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  IA Rápida
                </button>
                <button
                  type="button"
                  onClick={() => setImageQuality('nano_banana_2_1')}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition whitespace-nowrap shrink-0 cursor-pointer ${
                    imageQuality === 'nano_banana_2_1'
                      ? 'bg-amber-400 text-slate-950 font-semibold'
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  Alta Calidad 1K
                </button>
              </div>
            </div>

            <button
              type="button"
              disabled={isLoading || !youtubeUrl.trim()}
              onClick={() => handleAnalyze()}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-sky-400 hover:bg-sky-300 disabled:bg-slate-800 disabled:text-slate-500 text-slate-950 text-xs sm:text-sm font-bold transition cursor-pointer whitespace-nowrap shrink-0"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Analizando video y generando visuales IA...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>Analizar Video y Generar</span>
                </>
              )}
            </button>
          </div>

          {/* Visual Style Presets */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
            {STYLE_OPTIONS.map((st) => (
              <button
                key={st.id}
                type="button"
                onClick={() => setVisualStyle(st.id)}
                className={`p-3 rounded-xl border text-left transition cursor-pointer ${
                  visualStyle === st.id
                    ? 'bg-sky-500/10 border-sky-400/60 text-white'
                    : 'bg-[#070c18] border-slate-800 text-slate-300 hover:border-slate-700'
                }`}
              >
                <div className="text-xs font-semibold">{st.label}</div>
                <div className="text-[11px] text-slate-400 mt-0.5">{st.subtitle}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Error Banner */}
        {errorMessage && (
          <div className="p-4 rounded-xl bg-rose-950/40 border border-rose-500/30 text-rose-200 flex items-center gap-3 text-xs sm:text-sm">
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Analysis Results Workspace */}
        {result && (
          <div className="space-y-6 pt-3 border-t border-slate-800/80">
            {/* Video Overview Card */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-stretch bg-[#070c18] border border-slate-800 rounded-2xl p-4">
              <div className="md:col-span-4 rounded-xl overflow-hidden bg-slate-900 border border-slate-800 aspect-video md:aspect-auto flex items-center justify-center">
                {!thumbnailFailed && result.thumbnailUrl ? (
                  <img
                    src={result.thumbnailUrl}
                    alt={result.videoTitle}
                    referrerPolicy="no-referrer"
                    onError={() => setThumbnailFailed(true)}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center p-6 text-center gap-2 text-slate-400">
                    <Youtube className="w-8 h-8 text-rose-400" />
                    <span className="text-xs font-medium">{result.videoTitle}</span>
                  </div>
                )}
              </div>

              <div className="md:col-span-8 flex flex-col justify-between gap-3">
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
                    <span className="text-sky-300 font-medium">{result.channelName}</span>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono tabular-nums">{result.aspectRatio}</span>
                    <span aria-hidden="true">·</span>
                    <span>
                      {result.analyzedWithVideoStream
                        ? 'Análisis audiovisual directo'
                        : 'Análisis de contenido y transcripción'}
                    </span>
                  </div>

                  <h3 className="font-editorial text-lg sm:text-xl font-bold text-white">
                    {result.videoTitle}
                  </h3>

                  <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                    {result.coreThesis}
                  </p>

                  {result.keyHebrewTerms.length > 0 && (
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-300 pt-1">
                      {result.keyHebrewTerms.map((t, idx) => (
                        <span key={idx}>
                          <span className="font-hebrew text-amber-300 font-bold">{t.term}</span>{' '}
                          <span className="text-slate-400">
                            ({t.transliteration}: {t.meaning})
                          </span>
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2.5 pt-2">
                  {onSendTopicToDerasha && (
                    <button
                      type="button"
                      onClick={() => onSendTopicToDerasha(result.suggestedDerashaTopic)}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-bold transition cursor-pointer whitespace-nowrap"
                    >
                      <BookOpen className="w-3.5 h-3.5" />
                      <span>Desarrollar Drashá sobre este Video</span>
                    </button>
                  )}
                  <a
                    href={result.canonicalUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 text-xs font-medium transition whitespace-nowrap"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>Abrir en YouTube</span>
                  </a>
                </div>
              </div>
            </div>

            {/* Pedagogical Clarity Comparison: Video vs Animations */}
            {result.pedagogicalComparison && (
              <div className="rounded-2xl bg-[#070c18] border border-slate-800 p-4 sm:p-5 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <SlidersHorizontal className="w-4 h-4 text-sky-400 shrink-0" />
                    <h4 className="text-xs sm:text-sm font-bold text-white">
                      Evaluación de Claridad del Tutorial: Video Continuo vs. Animación por Escenas
                    </h4>
                  </div>
                  <span className="text-xs font-semibold text-amber-300">
                    Recomendación:{' '}
                    {result.pedagogicalComparison.recommendedFormat === 'animacion_escenica'
                      ? 'Animación Escénica Paso a Paso'
                      : result.pedagogicalComparison.recommendedFormat === 'video_continuo'
                      ? 'Video Continuo'
                      : 'Formato Híbrido (Animación + Video)'}
                  </span>
                </div>
                <p className="text-xs sm:text-sm text-slate-200 leading-relaxed">
                  {result.pedagogicalComparison.clarityVerdict}
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                  <div className="p-3 rounded-xl bg-[#090f1d] border border-slate-800/80 space-y-1">
                    <div className="text-[11px] font-semibold text-sky-300">
                      Fortalezas de Animaciones por Escenas
                    </div>
                    <p className="text-xs text-slate-300 leading-relaxed">
                      {result.pedagogicalComparison.animationStrengths}
                    </p>
                  </div>
                  <div className="p-3 rounded-xl bg-[#090f1d] border border-slate-800/80 space-y-1">
                    <div className="text-[11px] font-semibold text-amber-300">
                      Fortalezas del Video Continuo
                    </div>
                    <p className="text-xs text-slate-300 leading-relaxed">
                      {result.pedagogicalComparison.videoStrengths}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Ritual Tradition Preference Gate BEFORE Close-Up */}
            {result.traditionPreferenceGate?.requiresTraditionSelection && (
              <div
                className={`rounded-2xl border p-4 sm:p-5 space-y-3 ${
                  selectedTradition
                    ? 'bg-[#070c18] border-emerald-500/40'
                    : 'bg-amber-950/20 border-amber-400/50'
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    {selectedTradition ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    ) : (
                      <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0" />
                    )}
                    <h4 className="text-xs sm:text-sm font-bold text-white">
                      {selectedTradition
                        ? `Tradición activa para el close-up: ${
                            result.traditionPreferenceGate.traditions.find(
                              (t) => t.id === selectedTradition
                            )?.label
                          }`
                        : 'Antes de mostrar el close-up: ¿Qué tradición de amarre prefieres visualizar?'}
                    </h4>
                  </div>
                  {isApplyingTradition && (
                    <span className="inline-flex items-center gap-1.5 text-xs text-amber-300">
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Adaptando close-up...</span>
                    </span>
                  )}
                </div>

                <p className="text-xs text-slate-300 leading-relaxed">
                  {result.traditionPreferenceGate.reasonEs}
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 pt-1">
                  {result.traditionPreferenceGate.traditions.map((trad) => {
                    const isActive = selectedTradition === trad.id;
                    return (
                      <button
                        key={trad.id}
                        type="button"
                        disabled={isApplyingTradition}
                        onClick={() => handleSelectTradition(trad.id)}
                        className={`p-3 rounded-xl border text-left transition cursor-pointer disabled:opacity-60 space-y-1 ${
                          isActive
                            ? 'bg-emerald-500/15 border-emerald-400 text-white'
                            : 'bg-[#090f1d] border-slate-800 hover:border-amber-400/50 text-slate-200'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-bold">{trad.label}</span>
                          <span className="font-hebrew text-xs text-amber-300">
                            {trad.hebrewLabel}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400 leading-snug">
                          {trad.wrappingDetailEs}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Output Switcher Tabs */}
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-1 p-1 bg-[#070c18] border border-slate-800 rounded-xl">
                <button
                  type="button"
                  onClick={() => setActiveStudioTab('illustrations')}
                  className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition cursor-pointer whitespace-nowrap ${
                    activeStudioTab === 'illustrations'
                      ? 'bg-sky-400 text-slate-950'
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  <ImageIcon className="w-3.5 h-3.5" />
                  <span>Ilustraciones ({result.illustrations.length})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveStudioTab('animation')}
                  className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition cursor-pointer whitespace-nowrap ${
                    activeStudioTab === 'animation'
                      ? 'bg-amber-400 text-slate-950'
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  <Film className="w-3.5 h-3.5" />
                  <span>Animación y Video IA ({scenes.length} escenas)</span>
                </button>
              </div>
            </div>

            {/* TAB 1: AI RASTER & VECTOR ILLUSTRATIONS GALLERY */}
            {activeStudioTab === 'illustrations' && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {result.illustrations.map((ill) => {
                  const safeSvg = sanitizeClientSvg(ill.svgMarkup);
                  const activeLayer =
                    viewModeByCard[ill.id] || (ill.imageDataUrl ? 'raster' : 'svg');
                  const isRegenerating = regeneratingId === ill.id;
                  const isCloseUpLocked =
                    Boolean(result.traditionPreferenceGate?.requiresTraditionSelection) &&
                    !selectedTradition &&
                    ill.sceneNumber === result.traditionPreferenceGate?.closeUpSceneNumber;

                  return (
                    <article
                      key={ill.id}
                      className="rounded-2xl bg-[#070c18] border border-slate-800 overflow-hidden flex flex-col justify-between"
                    >
                      <div className="relative bg-[#050814] border-b border-slate-800/80">
                        {isCloseUpLocked ? (
                          <div
                            className={`w-full ${
                              result.aspectRatio === '9:16'
                                ? 'aspect-[9/16] max-h-80 mx-auto'
                                : 'aspect-video'
                            } flex flex-col items-center justify-center p-5 text-center gap-2 bg-[#070c18]`}
                          >
                            <ShieldAlert className="w-7 h-7 text-amber-400" />
                            <div className="text-xs font-bold text-white">
                              Close-up sujeto a tu tradición (Minhag)
                            </div>
                            <p className="text-[11px] text-slate-400 max-w-xs">
                              Elige arriba Ashkenazí, Sefardí o Jabad / Ari para revelar el plano cerrado del amarre en la mano.
                            </p>
                          </div>
                        ) : activeLayer === 'raster' && ill.imageDataUrl ? (
                          <img
                            src={ill.imageDataUrl}
                            alt={ill.title}
                            className={`w-full object-cover ${
                              result.aspectRatio === '9:16'
                                ? 'aspect-[9/16] max-h-80 mx-auto'
                                : 'aspect-video'
                            }`}
                          />
                        ) : (
                          <div
                            className={`w-full ${
                              result.aspectRatio === '9:16'
                                ? 'aspect-[9/16] max-h-80 mx-auto'
                                : 'aspect-video'
                            } overflow-hidden`}
                            dangerouslySetInnerHTML={{ __html: safeSvg }}
                          />
                        )}

                        {ill.imageDataUrl && (
                          <div className="absolute top-2.5 left-2.5 flex items-center gap-1 p-0.5 rounded-lg bg-slate-950/85 border border-slate-700/80">
                            <button
                              type="button"
                              onClick={() =>
                                setViewModeByCard((prev) => ({ ...prev, [ill.id]: 'raster' }))
                              }
                              className={`px-2 py-0.5 rounded text-[10px] font-semibold cursor-pointer ${
                                activeLayer === 'raster'
                                  ? 'bg-sky-400 text-slate-950'
                                  : 'text-slate-300 hover:text-white'
                              }`}
                            >
                              IA
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                setViewModeByCard((prev) => ({ ...prev, [ill.id]: 'svg' }))
                              }
                              className={`px-2 py-0.5 rounded text-[10px] font-semibold cursor-pointer ${
                                activeLayer === 'svg'
                                  ? 'bg-amber-400 text-slate-950'
                                  : 'text-slate-300 hover:text-white'
                              }`}
                            >
                              SVG
                            </button>
                          </div>
                        )}

                        <button
                          type="button"
                          onClick={() => setSelectedIllustration(ill)}
                          className="absolute top-2.5 right-2.5 p-2 rounded-lg bg-slate-950/80 hover:bg-slate-900 border border-slate-700/80 text-slate-200 transition cursor-pointer"
                          title="Ampliar ilustración"
                          aria-label={`Ampliar ilustración ${ill.sceneNumber}`}
                        >
                          <Maximize2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <div className="p-4 space-y-2.5 flex-1 flex flex-col justify-between">
                        <div className="space-y-1.5">
                          <div className="flex items-center gap-2 text-xs text-slate-400 font-mono tabular-nums flex-wrap">
                            <span>Escena {ill.sceneNumber}</span>
                            <span aria-hidden="true">·</span>
                            <span>{ill.timestamp}</span>
                            <span aria-hidden="true">·</span>
                            <span className="font-hebrew text-amber-300">{ill.hebrewCaption}</span>
                          </div>
                          <h4 className="font-editorial text-base font-bold text-white">
                            {ill.title}
                          </h4>
                          <p className="text-xs text-slate-300 leading-relaxed">
                            {ill.visualConcept}
                          </p>
                          <p className="text-[11px] text-slate-400 leading-relaxed">
                            {ill.symbolicMeaning}
                          </p>
                        </div>

                        <div className="space-y-2 pt-3 border-t border-slate-800/80">
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-1.5">
                              {ill.palette.map((hex, cIdx) => (
                                <span
                                  key={cIdx}
                                  className="w-4 h-4 rounded-sm border border-slate-700"
                                  style={{ backgroundColor: hex }}
                                  title={hex}
                                />
                              ))}
                            </div>
                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => handleDownloadSvg(ill)}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-[11px] font-medium text-slate-200 transition cursor-pointer whitespace-nowrap"
                              >
                                <Download className="w-3 h-3" />
                                <span>SVG</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDownloadPng(ill, activeLayer === 'raster')}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-sky-400/15 hover:bg-sky-400/25 border border-sky-400/40 text-[11px] font-semibold text-sky-300 transition cursor-pointer whitespace-nowrap"
                              >
                                <Download className="w-3 h-3" />
                                <span>PNG</span>
                              </button>
                            </div>
                          </div>

                          <button
                            type="button"
                            disabled={isRegenerating}
                            onClick={() => handleRegenerateIllustration(ill, 'nano_banana_2_1')}
                            className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#090f1d] hover:bg-slate-800 disabled:opacity-60 border border-slate-700/80 text-[11px] font-medium text-amber-300 transition cursor-pointer"
                          >
                            {isRegenerating ? (
                              <>
                                <Loader2 className="w-3 h-3 animate-spin" />
                                <span>Generando en 1K (Nano Banana 2.1)...</span>
                              </>
                            ) : (
                              <>
                                <Wand2 className="w-3 h-3" />
                                <span>
                                  {ill.imageModelUsed === 'gemini-nano-banana-2.1'
                                    ? 'Regenerar en Alta Calidad (1K)'
                                    : 'Generar / Mejorar en 1K (Nano Banana 2.1)'}
                                </span>
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}

            {/* TAB 2: TWO-ZONE ANIMATION STAGE, STORYBOARD & OMNI FLASH MP4 GENERATOR */}
            {activeStudioTab === 'animation' && scenes.length > 0 && (
              <div className="space-y-5">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
                  {/* Left Zone: Stage Switcher (Canvas Storyboard vs Omni Flash MP4) */}
                  <div className="lg:col-span-7 space-y-3">
                    {generatedVideo && (
                      <div className="flex items-center gap-1 p-1 bg-[#070c18] border border-slate-800 rounded-xl w-fit">
                        <button
                          type="button"
                          onClick={() => setAnimationStageView('canvas')}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
                            animationStageView === 'canvas'
                              ? 'bg-sky-400 text-slate-950'
                              : 'text-slate-300 hover:text-white'
                          }`}
                        >
                          Animación por Escenas (Canvas)
                        </button>
                        <button
                          type="button"
                          onClick={() => setAnimationStageView('ai_video')}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
                            animationStageView === 'ai_video'
                              ? 'bg-amber-400 text-slate-950'
                              : 'text-slate-300 hover:text-white'
                          }`}
                        >
                          Video Continuo IA (Omni Flash MP4)
                        </button>
                      </div>
                    )}

                    {animationStageView === 'ai_video' && generatedVideo ? (
                      <div className="space-y-3">
                        <div className="rounded-2xl overflow-hidden border border-amber-400/40 bg-[#050814]">
                          <video
                            src={generatedVideo.videoDataUrl}
                            controls
                            autoPlay
                            loop
                            playsInline
                            className={`w-full block ${
                              generatedVideo.aspectRatio === '9:16'
                                ? 'max-w-xs mx-auto aspect-[9/16]'
                                : 'aspect-video'
                            }`}
                          />
                        </div>
                        <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl bg-[#070c18] border border-slate-800 text-xs">
                          <div className="text-slate-300 font-mono tabular-nums">
                            {generatedVideo.modelUsed} · {generatedVideo.duration} ·{' '}
                            {generatedVideo.resolution}
                          </div>
                          <a
                            href={generatedVideo.videoDataUrl}
                            download={`darshan-omni-clip-${result.videoId}.mp4`}
                            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold transition"
                          >
                            <Download className="w-3.5 h-3.5" />
                            <span>Descargar Video (.mp4)</span>
                          </a>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="rounded-2xl overflow-hidden border border-slate-800 bg-[#050814]">
                          <canvas
                            ref={canvasRef}
                            width={canvasDims.width}
                            height={canvasDims.height}
                            className={`w-full block ${
                              result.aspectRatio === '9:16'
                                ? 'max-w-xs mx-auto aspect-[9/16]'
                                : 'aspect-video'
                            }`}
                          />
                        </div>

                        {/* Canvas Playback & WebM Export Controls */}
                        <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl bg-[#070c18] border border-slate-800">
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() =>
                                handleSelectScene(
                                  activeSceneIndex > 0 ? activeSceneIndex - 1 : scenes.length - 1
                                )
                              }
                              className="p-2 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 cursor-pointer"
                              title="Escena anterior"
                            >
                              <SkipBack className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setIsPlaying((p) => !p)}
                              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-bold cursor-pointer whitespace-nowrap"
                            >
                              {isPlaying ? (
                                <>
                                  <Pause className="w-3.5 h-3.5" />
                                  <span>Pausar</span>
                                </>
                              ) : (
                                <>
                                  <Play className="w-3.5 h-3.5" />
                                  <span>Reproducir</span>
                                </>
                              )}
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                handleSelectScene((activeSceneIndex + 1) % scenes.length)
                              }
                              className="p-2 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 cursor-pointer"
                              title="Siguiente escena"
                            >
                              <SkipForward className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                handleSelectScene(0);
                                setIsPlaying(true);
                              }}
                              className="p-2 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 cursor-pointer"
                              title="Reiniciar secuencia"
                            >
                              <RotateCcw className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setIsLooping((l) => !l)}
                              className={`p-2 rounded-lg border cursor-pointer ${
                                isLooping
                                  ? 'bg-sky-500/15 border-sky-400/50 text-sky-300'
                                  : 'bg-slate-900 border-slate-700 text-slate-400'
                              }`}
                              title="Repetir en bucle"
                            >
                              <Repeat className="w-4 h-4" />
                            </button>
                          </div>

                          <div className="flex items-center gap-2">
                            <div className="flex items-center gap-1 p-0.5 bg-slate-900 border border-slate-800 rounded-lg">
                              {([0.5, 1, 1.5] as const).map((spd) => (
                                <button
                                  key={spd}
                                  type="button"
                                  onClick={() => setPlaybackSpeed(spd)}
                                  className={`px-2 py-1 rounded text-[11px] font-mono tabular-nums cursor-pointer ${
                                    playbackSpeed === spd
                                      ? 'bg-slate-700 text-white font-semibold'
                                      : 'text-slate-400 hover:text-white'
                                  }`}
                                >
                                  {spd}x
                                </button>
                              ))}
                            </div>

                            <button
                              type="button"
                              disabled={isRecordingWebm}
                              onClick={handleExportAnimationWebm}
                              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-sky-400 hover:bg-sky-300 disabled:bg-slate-800 disabled:text-slate-400 text-slate-950 text-xs font-bold transition cursor-pointer whitespace-nowrap"
                            >
                              {isRecordingWebm ? (
                                <>
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                  <span>Grabando WebM...</span>
                                </>
                              ) : (
                                <>
                                  <Download className="w-3.5 h-3.5" />
                                  <span>Exportar WebM</span>
                                </>
                              )}
                            </button>
                          </div>
                        </div>
                      </>
                    )}

                    {/* Omni Flash AI Video Generator Panel */}
                    <div className="p-4 rounded-2xl bg-[#070c18] border border-slate-800 space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <Clapperboard className="w-4 h-4 text-amber-400 shrink-0" />
                          <h4 className="text-xs sm:text-sm font-bold text-white">
                            Generar Clip de Video Continuo con IA (Omni Flash · MP4)
                          </h4>
                        </div>
                        <span className="text-[11px] font-mono text-slate-400">
                          gemini-omni-1.2-flash
                        </span>
                      </div>

                      <textarea
                        rows={2}
                        value={videoPromptInput}
                        onChange={(e) => setVideoPromptInput(e.target.value)}
                        placeholder="Describe el clip de video animado a generar..."
                        className="w-full px-3 py-2 rounded-xl bg-[#050814] border border-slate-800 focus:border-amber-400 text-xs text-slate-200 placeholder-slate-500 focus:outline-none"
                      />

                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <div className="flex items-center gap-1 p-0.5 bg-slate-900 border border-slate-800 rounded-lg">
                            {(['6s', '10s'] as const).map((dur) => (
                              <button
                                key={dur}
                                type="button"
                                onClick={() => setVideoDuration(dur)}
                                className={`px-2.5 py-1 rounded text-[11px] font-mono cursor-pointer ${
                                  videoDuration === dur
                                    ? 'bg-amber-400 text-slate-950 font-bold'
                                    : 'text-slate-300 hover:text-white'
                                }`}
                              >
                                {dur}
                              </button>
                            ))}
                          </div>

                          <div className="flex items-center gap-1 p-0.5 bg-slate-900 border border-slate-800 rounded-lg">
                            {(['720p', '1080p'] as const).map((resOpt) => (
                              <button
                                key={resOpt}
                                type="button"
                                onClick={() => setVideoResolution(resOpt)}
                                className={`px-2.5 py-1 rounded text-[11px] font-mono cursor-pointer ${
                                  videoResolution === resOpt
                                    ? 'bg-sky-400 text-slate-950 font-bold'
                                    : 'text-slate-300 hover:text-white'
                                }`}
                              >
                                {resOpt}
                              </button>
                            ))}
                          </div>

                          {hasRasterRefs && (
                            <label className="inline-flex items-center gap-1.5 text-[11px] text-slate-300 cursor-pointer select-none">
                              <input
                                type="checkbox"
                                checked={useReferenceKeyframes}
                                onChange={(e) => setUseReferenceKeyframes(e.target.checked)}
                                className="accent-amber-400"
                              />
                              <span>Usar ilustraciones como fotogramas guía</span>
                            </label>
                          )}
                        </div>

                        <button
                          type="button"
                          disabled={
                            isGeneratingVideo ||
                            !videoPromptInput.trim() ||
                            (Boolean(result.traditionPreferenceGate?.requiresTraditionSelection) &&
                              !selectedTradition)
                          }
                          onClick={handleGenerateAiVideoClip}
                          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 disabled:bg-slate-800 disabled:text-slate-500 text-slate-950 text-xs font-bold transition cursor-pointer whitespace-nowrap"
                        >
                          {isGeneratingVideo ? (
                            <>
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              <span>Renderizando MP4 (puede tardar ~1 min)...</span>
                            </>
                          ) : result.traditionPreferenceGate?.requiresTraditionSelection &&
                            !selectedTradition ? (
                            <>
                              <ShieldAlert className="w-3.5 h-3.5" />
                              <span>Elige tu tradición arriba antes del video</span>
                            </>
                          ) : (
                            <>
                              <Clapperboard className="w-3.5 h-3.5" />
                              <span>Generar Video IA (.mp4)</span>
                            </>
                          )}
                        </button>
                      </div>

                      {videoError && (
                        <div className="p-3 rounded-lg bg-rose-950/40 border border-rose-500/30 text-rose-200 text-xs flex items-center gap-2">
                          <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                          <span>{videoError}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Right Zone: Interactive Storyboard Deck */}
                  <div className="lg:col-span-5 space-y-3">
                    <div className="p-3.5 rounded-xl bg-[#070c18] border border-slate-800 space-y-1">
                      <div className="text-xs font-semibold text-amber-300">
                        {result.animationStoryboard.title}
                      </div>
                      <p className="text-xs text-slate-400 leading-relaxed">
                        {result.animationStoryboard.overallTheme}
                      </p>
                    </div>

                    <div className="space-y-2">
                      {scenes.map((sc, idx) => {
                        const isActive = idx === activeSceneIndex;
                        return (
                          <button
                            key={sc.id}
                            type="button"
                            onClick={() => handleSelectScene(idx)}
                            className={`w-full text-left p-3 rounded-xl border transition cursor-pointer space-y-1.5 ${
                              isActive
                                ? 'bg-sky-500/10 border-sky-400/60'
                                : 'bg-[#070c18] border-slate-800 hover:border-slate-700'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2 text-xs">
                              <span className="font-mono tabular-nums text-sky-300 font-semibold">
                                Escena {sc.sceneNumber} · {sc.timestampRange}
                              </span>
                              <span className="font-hebrew text-amber-300">{sc.hebrewMotif}</span>
                            </div>
                            <div className="text-xs font-semibold text-white">{sc.headline}</div>
                            <p className="text-[11px] text-slate-400 leading-relaxed">
                              {sc.narrationCaption}
                            </p>
                            {isActive && (
                              <div className="h-1 w-full bg-slate-800 rounded-full overflow-hidden mt-1">
                                <div
                                  className="h-full bg-amber-400 transition-all duration-100"
                                  style={{ width: `${Math.round(sceneProgress * 100)}%` }}
                                />
                              </div>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Fullscreen Illustration Lightbox Modal */}
        {selectedIllustration && (
          <div
            className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-4"
            role="dialog"
            aria-modal="true"
          >
            <div className="max-w-4xl w-full rounded-2xl bg-[#090f1d] border border-slate-700 shadow-2xl overflow-hidden">
              <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-800">
                <div className="flex items-center gap-2 text-xs sm:text-sm">
                  <span className="font-mono tabular-nums text-sky-400">
                    Escena {selectedIllustration.sceneNumber}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span className="font-bold text-white">{selectedIllustration.title}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedIllustration(null)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="p-5 bg-[#050814] flex items-center justify-center">
                {selectedIllustration.imageDataUrl &&
                viewModeByCard[selectedIllustration.id] !== 'svg' ? (
                  <img
                    src={selectedIllustration.imageDataUrl}
                    alt={selectedIllustration.title}
                    className="max-h-[65vh] rounded-xl object-contain mx-auto"
                  />
                ) : (
                  <div
                    className="max-h-[65vh] w-full mx-auto"
                    dangerouslySetInnerHTML={{
                      __html: sanitizeClientSvg(selectedIllustration.svgMarkup),
                    }}
                  />
                )}
              </div>
              <div className="px-5 py-4 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3">
                <p className="text-xs text-slate-300 max-w-xl">
                  {selectedIllustration.symbolicMeaning}
                </p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleDownloadSvg(selectedIllustration)}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs font-medium text-white cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Descargar SVG</span>
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      handleDownloadPng(
                        selectedIllustration,
                        Boolean(selectedIllustration.imageDataUrl)
                      )
                    }
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-sky-400 hover:bg-sky-300 text-slate-950 text-xs font-bold cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Exportar PNG</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </section>
    );
  }
);
