// scene/bakedlook.js — R3a: what the baked rooms share with the page's procedural ones, in one place. The Blender build
// (scripts/build-office.mjs) bakes with these values and writes them into the manifest; the page draws the procedural
// rooms' floor with the same oak texture at the same scale, and colours the baked rooms' walls per theme from the
// manifest. tests/baked-room.test.mjs checks the committed manifest still equals what this module gives, so a palette
// or atlas change shows up as a stale bake. No DOM: the build imports it in Node.
import * as THREE from 'three';
import { PALETTE } from '../config/palette.js';
import { ATLAS, atlasUV } from './textures.js';

export const BAKED_ROOMS = ['design', 'office'];           // phase 1 of the roll-out (R3a); Research, lounge, atrium later
export const FLOOR_OAK = { tile: 2.2, colour: '#a47f58', texture: 'textures/floor.jpg' };   // one mid-tone oak, every room

const hex = (c) => '#' + c.getHexString();
// the procedural rooms' wall colour (rooms.js): the theme's wall, tinted towards the department's accent
export const wallColour = (p, key) => hex(new THREE.Color(p.wall).lerp(new THREE.Color(PALETTE.departments[key] || PALETTE.departments.default), p.wallTint));

// themed materials: warm-white walls (with the department tint, as the procedural rooms) for the day bake and the
// light theme; dark walls for the evening bake and the dark theme only
export function themedColours(keys = BAKED_ROOMS) {
  const one = (p) => ({ cap: p.wallCap, skirting: p.baseboard, ...Object.fromEntries(keys.map((k) => ['wall_' + k, wallColour(p, k)])) });
  return { day: one(PALETTE.light), evening: one(PALETTE.dark) };
}

export function bakedLook(keys = BAKED_ROOMS) {
  return {
    floor: { ...FLOOR_OAK },
    themed: themedColours(keys),
    atlas: { board: atlasUV(ATLAS.board), white: atlasUV(ATLAS.white), art: ATLAS.art.map(atlasUV) }
  };
}
