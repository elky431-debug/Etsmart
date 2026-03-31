import { Audio, interpolate, useCurrentFrame, useVideoConfig, staticFile } from 'remotion';
import React from 'react';

export const BackgroundAudio: React.FC = () => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();

  const volume = interpolate(
    frame,
    [0, 30, durationInFrames - 60, durationInFrames],
    [0, 0.6, 0.6, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  );

  return React.createElement(Audio, {
    src: staticFile('audio.mp3'),
    volume,
  });
};
