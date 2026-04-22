export type TestPhase =
  | 'waiting'
  | 'acuity'
  | 'color'
  | 'near'
  | 'astigmatism'
  | 'complete';

export interface AcuityLevel {
  label: string;
  sizeLevel: number;
  sizePx: number;
  diopters: number;
}

export interface Optotype {
  phase: string;
  letter: string;
  rotation: number;
  sizeLevel: number;
  sizePx: number;
  eye: 'right' | 'left' | 'both';
  acuityLabel: string;
}

export interface ScreeningResult {
  id?: number;
  patientName: string;
  rightDiopters: number;
  leftDiopters: number;
  colourDeficient: boolean;
  astigmatism: boolean;
  riskLevel: string;
  recommendation: string;
  createdAt?: string;
}
