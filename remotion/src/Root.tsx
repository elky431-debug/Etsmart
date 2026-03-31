import { Composition } from 'remotion';
import React from 'react';
import { EtsmartAd } from './EtsmartAd';
import { EtsmartAdH } from './EtsmartAdH';

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="EtsmartAd"
        component={EtsmartAd}
        durationInFrames={35 * 30}
        fps={30}
        width={1080}
        height={1920}
      />
      <Composition
        id="EtsmartAdH"
        component={EtsmartAdH}
        durationInFrames={35 * 30}
        fps={30}
        width={1920}
        height={1080}
      />
    </>
  );
};
