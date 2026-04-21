/**
 * PatientVRScene.jsx
 * ── Minimal Viro scene. Only 3D/spatial content goes here.
 * ── All 2D eye-panel content is rendered via StereoOverlay in PatientScreen.
 *    This avoids: "Attempted to add a non-Component child of type: [ReactViewGroup]"
 */
import React from 'react';
import { ViroScene, ViroAmbientLight } from '@reactvision/react-viro';

const PatientVRScene = () => (
  <ViroScene>
    <ViroAmbientLight color="#ffffff" intensity={200} />
    {/* Future 3D objects (e.g. ViroSphere, ViroBox) can be added here safely */}
  </ViroScene>
);

export default PatientVRScene;