import React from "react";
import { Composition } from "remotion";
import { MaruVideo, TOTAL } from "./maru/Video";

const FPS = 30;
export const Root: React.FC = () => (
  <>
    <Composition id="maru-horizontal" component={MaruVideo} durationInFrames={TOTAL} fps={FPS} width={1920} height={1080} />
    <Composition id="maru-vertical" component={MaruVideo} durationInFrames={TOTAL} fps={FPS} width={1080} height={1920} />
  </>
);
