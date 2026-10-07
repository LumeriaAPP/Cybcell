/**
 * What the device can afford. Phones get lighter rendering; weak devices (few cores or
 * little memory) skip the optional extras entirely so scrolling stays smooth.
 */
const nav = navigator as Navigator & { deviceMemory?: number };

/** Touch-first device: no hover, finger scrolling. */
export const touch = matchMedia('(pointer: coarse)').matches;

/** Old or budget hardware. */
export const weak = (nav.hardwareConcurrency ?? 8) <= 4 || (nav.deviceMemory ?? 8) <= 3;
