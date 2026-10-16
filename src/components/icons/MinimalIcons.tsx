import React from 'react';

export interface IconProps extends React.SVGProps<SVGSVGElement> {
  size?: number | string;
}

const BaseSvg: React.FC<IconProps> = ({ size = 14, className = '', children, ...props }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.25"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    {...props}
  >
    {children}
  </svg>
);

/** Isometric Technical Cube */
export const IconCube: React.FC<IconProps> = (props) => (
  <BaseSvg {...props}>
    <path d="M8 1.75L13.75 5V11L8 14.25L2.25 11V5L8 1.75Z" />
    <path d="M8 8V14.25" />
    <path d="M8 8L13.75 5" />
    <path d="M8 8L2.25 5" />
  </BaseSvg>
);

/** Orthographic Axis / Build Plate Prepare */
export const IconAxis: React.FC<IconProps> = (props) => (
  <BaseSvg {...props}>
    <path d="M8 2V8M8 8L13.2 11M8 8L2.8 11" />
    <circle cx="8" cy="8" r="1.25" />
    <path d="M6.5 3.5L8 2L9.5 3.5" />
  </BaseSvg>
);

/** Precision Layer Stack / Slicer */
export const IconLayers: React.FC<IconProps> = (props) => (
  <BaseSvg {...props}>
    <path d="M2 5.5L8 2.5L14 5.5L8 8.5L2 5.5Z" />
    <path d="M2 8.75L8 11.75L14 8.75" />
    <path d="M2 11.75L8 14.75L14 11.75" />
  </BaseSvg>
);

/** Continuous G-Code Toolpath / Extrusion Line */
export const IconToolpath: React.FC<IconProps> = (props) => (
  <BaseSvg {...props}>
    <path d="M2.5 4H11.5C12.6 4 13.5 4.9 13.5 6C13.5 7.1 12.6 8 11.5 8H4.5C3.4 8 2.5 8.9 2.5 10C2.5 11.1 3.4 12 4.5 12H13.5" />
    <circle cx="13.5" cy="12" r="1" fill="currentColor" />
  </BaseSvg>
);

/** Extruder Nozzle Schematic */
export const IconNozzle: React.FC<IconProps> = (props) => (
  <BaseSvg {...props}>
    <path d="M4.5 2H11.5V6.5L9.25 10.5H6.75L4.5 6.5V2Z" />
    <path d="M8 10.5V14" />
    <path d="M3 4.25H13" />
  </BaseSvg>
);

/** Tree Support / Structural Truss */
export const IconSupport: React.FC<IconProps> = (props) => (
  <BaseSvg {...props}>
    <path d="M2.5 3.5H13.5" />
    <path d="M8 13.5V7.5" />
    <path d="M8 9L4.5 3.5" />
    <path d="M8 9L11.5 3.5" />
    <path d="M5 13.5H11" />
  </BaseSvg>
);

/** Overhang Angle Inspection */
export const IconAngle: React.FC<IconProps> = (props) => (
  <BaseSvg {...props}>
    <path d="M2.5 13.5H13.5" />
    <path d="M2.5 13.5L11.5 3.5" />
    <path d="M8.5 13.5C8.5 11.2 7.4 9.5 5.8 8.5" />
  </BaseSvg>
);

/** Minimalist File Import / Upload */
export const IconImport: React.FC<IconProps> = (props) => (
  <BaseSvg {...props}>
    <path d="M8 10.5V2.5" />
    <path d="M5 5.25L8 2.25L11 5.25" />
    <path d="M2.5 10.5V12.5C2.5 13.05 2.95 13.5 3.5 13.5H12.5C13.05 13.5 13.5 13.05 13.5 12.5V10.5" />
  </BaseSvg>
);

/** Minimalist Export / G-code Download */
export const IconExport: React.FC<IconProps> = (props) => (
  <BaseSvg {...props}>
    <path d="M8 2.5V10.5" />
    <path d="M5 7.75L8 10.75L11 7.75" />
    <path d="M2.5 11V12.5C2.5 13.05 2.95 13.5 3.5 13.5H12.5C13.05 13.5 13.5 13.05 13.5 12.5V11" />
  </BaseSvg>
);

/** Archive / Model Library Grid */
export const IconArchive: React.FC<IconProps> = (props) => (
  <BaseSvg {...props}>
    <rect x="2.25" y="2.25" width="4.75" height="4.75" rx="0.75" />
    <rect x="9" y="2.25" width="4.75" height="4.75" rx="0.75" />
    <rect x="2.25" y="9" width="4.75" height="4.75" rx="0.75" />
    <rect x="9" y="9" width="4.75" height="4.75" rx="0.75" />
  </BaseSvg>
);

/** Neural / Generative Mesh Node (Replaces generic Sparkles) */
export const IconMeshGen: React.FC<IconProps> = (props) => (
  <BaseSvg {...props}>
    <polygon points="8,2 13.5,5.2 13.5,10.8 8,14 2.5,10.8 2.5,5.2" />
    <circle cx="8" cy="8" r="1.5" />
    <path d="M8 2V6.5M13.5 5.2L9.3 7.2M13.5 10.8L9.3 8.8M8 14V9.5M2.5 10.8L6.7 8.8M2.5 5.2L6.7 7.2" />
  </BaseSvg>
);

/** Terminal / CLI Engine */
export const IconTerminal: React.FC<IconProps> = (props) => (
  <BaseSvg {...props}>
    <rect x="2" y="2.5" width="12" height="11" rx="1.5" />
    <path d="M4.75 6.25L7.25 8L4.75 9.75" />
    <path d="M8.5 9.75H11.25" />
  </BaseSvg>
);

/** Inspection Check / Quality Metric */
export const IconCheckShield: React.FC<IconProps> = (props) => (
  <BaseSvg {...props}>
    <path d="M8 2L13 3.8V7.8C13 10.9 10.8 13.1 8 14C5.2 13.1 3 10.9 3 7.8V3.8L8 2Z" />
    <path d="M5.75 8L7.25 9.5L10.5 6.25" />
  </BaseSvg>
);

/** Precision Sliders / Process Parameters */
export const IconSliders: React.FC<IconProps> = (props) => (
  <BaseSvg {...props}>
    <path d="M2.5 4.5H13.5" />
    <path d="M2.5 8H13.5" />
    <path d="M2.5 11.5H13.5" />
    <circle cx="5.5" cy="4.5" r="1.4" fill="var(--bg-panel, #111)" />
    <circle cx="10.5" cy="8" r="1.4" fill="var(--bg-panel, #111)" />
    <circle cx="6.5" cy="11.5" r="1.4" fill="var(--bg-panel, #111)" />
  </BaseSvg>
);

/** Velocity / Speed Gauge */
export const IconVelocity: React.FC<IconProps> = (props) => (
  <BaseSvg {...props}>
    <path d="M3 12C2.3 10.9 2 9.6 2 8.2C2 4.8 4.7 2 8 2C11.3 2 14 4.8 14 8.2C14 9.6 13.7 10.9 13 12" />
    <path d="M8 8.5L11.2 5.3" />
    <circle cx="8" cy="8.5" r="1.2" />
  </BaseSvg>
);

/** Thermal / Temperature Schematic */
export const IconThermal: React.FC<IconProps> = (props) => (
  <BaseSvg {...props}>
    <path d="M6.5 3.5V9.2C5.6 9.7 5 10.6 5 11.7C5 13.3 6.3 14.5 8 14.5C9.7 14.5 11 13.3 11 11.7C11 10.6 10.4 9.7 9.5 9.2V3.5C9.5 2.7 8.8 2 8 2C7.2 2 6.5 2.7 6.5 3.5Z" />
    <circle cx="8" cy="11.7" r="1.2" fill="currentColor" />
  </BaseSvg>
);

/** Extrusion Flow / Rheology */
export const IconFlow: React.FC<IconProps> = (props) => (
  <BaseSvg {...props}>
    <path d="M8 2.25C8 2.25 3.5 7.2 3.5 10.2C3.5 12.6 5.5 14.25 8 14.25C10.5 14.25 12.5 12.6 12.5 10.2C12.5 7.2 8 2.25 8 2.25Z" />
  </BaseSvg>
);

/** API Key / Token Access */
export const IconKeyMinimal: React.FC<IconProps> = (props) => (
  <BaseSvg {...props}>
    <circle cx="5.5" cy="8" r="3" />
    <path d="M8.5 8H14" />
    <path d="M11.5 8V10.5" />
    <path d="M13.5 8V10" />
  </BaseSvg>
);

/** Camera Aperture / Timelapse */
export const IconAperture: React.FC<IconProps> = (props) => (
  <BaseSvg {...props}>
    <circle cx="8" cy="8" r="5.75" />
    <circle cx="8" cy="8" r="2.25" />
    <path d="M8 2.25L10 5.75M13.75 8L10.25 10M8 13.75L6 10.25M2.25 8L5.75 6" />
  </BaseSvg>
);

/** Sun / Light Mode */
export const IconSun: React.FC<IconProps> = (props) => (
  <BaseSvg {...props}>
    <circle cx="8" cy="8" r="3" />
    <path d="M8 1.75V3M8 13V14.25M1.75 8H3M13 8H14.25M3.58 3.58L4.46 4.46M11.54 11.54L12.42 12.42M12.42 3.58L11.54 4.46M4.46 11.54L3.58 12.42" />
  </BaseSvg>
);

/** Moon / Dark Mode */
export const IconMoon: React.FC<IconProps> = (props) => (
  <BaseSvg {...props}>
    <path d="M13.2 10.2C12.4 10.5 11.5 10.7 10.5 10.7C6.8 10.7 3.8 7.7 3.8 4C3.8 3.2 4 2.4 4.3 1.8C2.4 2.8 1.2 4.8 1.2 7.2C1.2 10.8 4.1 13.7 7.7 13.7C10.3 13.7 12.5 12.2 13.2 10.2Z" />
  </BaseSvg>
);

/** Chevron / Directional Arrows */
export const IconChevronDown: React.FC<IconProps> = (props) => (
  <BaseSvg {...props}>
    <path d="M4.25 6.25L8 10L11.75 6.25" />
  </BaseSvg>
);

export const IconChevronUp: React.FC<IconProps> = (props) => (
  <BaseSvg {...props}>
    <path d="M4.25 9.75L8 6L11.75 9.75" />
  </BaseSvg>
);

export const IconChevronLeft: React.FC<IconProps> = (props) => (
  <BaseSvg {...props}>
    <path d="M9.75 4.25L6 8L9.75 11.75" />
  </BaseSvg>
);

export const IconChevronRight: React.FC<IconProps> = (props) => (
  <BaseSvg {...props}>
    <path d="M6.25 4.25L10 8L6.25 11.75" />
  </BaseSvg>
);

/** Play / Pause / Reset Minimalist Transport */
export const IconPlay: React.FC<IconProps> = (props) => (
  <BaseSvg {...props}>
    <polygon points="4.5,3 12.5,8 4.5,13" fill="currentColor" stroke="none" />
  </BaseSvg>
);

export const IconPause: React.FC<IconProps> = (props) => (
  <BaseSvg {...props}>
    <rect x="4.25" y="3" width="2.5" height="10" rx="0.5" fill="currentColor" stroke="none" />
    <rect x="9.25" y="3" width="2.5" height="10" rx="0.5" fill="currentColor" stroke="none" />
  </BaseSvg>
);

export const IconReset: React.FC<IconProps> = (props) => (
  <BaseSvg {...props}>
    <path d="M3 8C3 5.24 5.24 3 8 3C10.76 3 13 5.24 13 8C13 10.76 10.76 13 8 13C6.1 13 4.45 11.95 3.6 10.4" />
    <path d="M2.75 5.5V3H5.25" />
  </BaseSvg>
);

export const IconClose: React.FC<IconProps> = (props) => (
  <BaseSvg {...props}>
    <path d="M4 4L12 12M12 4L4 12" />
  </BaseSvg>
);
