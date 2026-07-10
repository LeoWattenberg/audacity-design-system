export interface WaveformGeometryArgs {
  dataLength: number;
  clipFullDuration: number | undefined;
  clipTrimStart: number;
  clipDuration: number;
  pixelsPerSecond: number;
  clipStretchFactor: number;
}

export interface WaveformGeometry {
  samplesPerPixel: number;
  trimStartSample: number;
}

export function computeWaveformGeometry(args: WaveformGeometryArgs): WaveformGeometry {
  const fullDuration = args.clipFullDuration || (args.clipTrimStart + args.clipDuration);
  const detectedSampleRate = args.dataLength / fullDuration;
  const secondsPerPixel = 1 / args.pixelsPerSecond;
  const samplesPerPixel = (secondsPerPixel * detectedSampleRate) / args.clipStretchFactor;
  const trimStartSample = Math.floor(args.clipTrimStart * detectedSampleRate);
  return { samplesPerPixel, trimStartSample };
}
