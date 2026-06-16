import * as faceapi from "face-api.js";

// Modelos carregados a partir de CDN (jsdelivr), evitando empacotar
// os arquivos de pesos (~6MB) junto com o frontend.
const MODEL_URL = "https://cdn.jsdelivr.net/npm/face-api.js@0.22.2/weights";

let modelsLoaded = false;
let loadingPromise: Promise<void> | null = null;

export async function loadFaceModels(): Promise<void> {
  if (modelsLoaded) return;
  if (loadingPromise) return loadingPromise;

  loadingPromise = (async () => {
    await Promise.all([
      faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
      faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
      faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
    ]);
    modelsLoaded = true;
  })();

  return loadingPromise;
}

const DETECTOR_OPTIONS = new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.5 });

// Detecta um rosto em um elemento de vídeo/imagem e retorna o descritor facial (128 números)
export async function getFaceDescriptor(input: HTMLVideoElement | HTMLImageElement | HTMLCanvasElement): Promise<Float32Array | null> {
  await loadFaceModels();
  const result = await faceapi
    .detectSingleFace(input, DETECTOR_OPTIONS)
    .withFaceLandmarks()
    .withFaceDescriptor();
  return result?.descriptor ?? null;
}

export function descriptorToString(descriptor: Float32Array): string {
  return JSON.stringify(Array.from(descriptor));
}

export function stringToDescriptor(str: string): Float32Array {
  return new Float32Array(JSON.parse(str));
}

// Distância euclidiana entre dois descritores. Quanto menor, mais semelhante.
// Um limiar (threshold) de ~0.5 costuma indicar a mesma pessoa.
export const FACE_MATCH_THRESHOLD = 0.5;

export function faceDistance(a: Float32Array, b: Float32Array): number {
  return faceapi.euclideanDistance(a, b);
}

// Encontra o funcionário com o descritor mais próximo, dentro do limiar de tolerância
export function findBestMatch<T extends { face_descriptor?: string | null }>(
  descriptor: Float32Array,
  candidates: T[],
  threshold: number = FACE_MATCH_THRESHOLD
): { candidate: T; distance: number } | null {
  let best: { candidate: T; distance: number } | null = null;
  for (const candidate of candidates) {
    if (!candidate.face_descriptor) continue;
    try {
      const stored = stringToDescriptor(candidate.face_descriptor);
      const distance = faceDistance(descriptor, stored);
      if (distance <= threshold && (!best || distance < best.distance)) {
        best = { candidate, distance };
      }
    } catch {
      // descritor inválido, ignora
    }
  }
  return best;
}
