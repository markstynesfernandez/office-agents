// palette.js — the one place colours live (spec: "One config file holds the palette"). Redesign R1:
// light mode: warm white walls with a soft department tint, a light wood floor, pale stone in the atrium, daylight from
//   one side; LED strips read as pale aluminium profiles and give no glow.
// dark mode: charcoal walls, a warm wood floor, dark rugs, warm LED strips (emissive lines plus soft additive washes),
//   glowing monitors and desk lamps. One warm accent (ledGlowColour / --accent) runs through the scene and the UI.
export const PALETTE = {
  light: {
    background: ['#f6f3ee', '#e2dcd2'],   // vertical gradient, top -> bottom
    shadowOpacity: 0.16, blobOpacity: 0.32,
    slabEdge: '#d8d0c3', slabFoot: '#c4baab',
    tile: '#ede9e2', wood: '#f2d6ae',      // multiplied by the plank / tile textures
    wall: '#f7f2ea', wallTint: 0.15, wallCap: '#d3cabd', baseboard: '#e8e1d5',
    rug: '#c4bbae', rugBorder: '#aca291', loungeRug: '#ddd4c6', loungeRugBorder: '#c6baa8',
    shelf: '#f1ebe1', shelfBack: '#e7e0d5', shelfObject: '#cbbfae', label: '#f6f3ec',
    potSmall: '#d9cdbb', leafSmall: '#82ad7b',
    frame: '#3a3633', mat: '#f8f5ef',
    metal: '#2f3034', leather: '#b77a50', sofa: '#d8cec0', sofaBase: '#bfb4a5', lampShade: '#2f3034', bulb: '#fff3dc', lampGlow: '#ffd9a0',
    led: '#efeae2', ledGlow: 0, ledGlowColour: '#ffb15f',
    seam: '#a0988c', locker: '#cdcac4', credenza: '#ebe5db', woodSolid: '#c99c6b', whiteboardFrame: '#babdc2',
    closetFloor: '#bdbab5', closetWall: '#dedad3', closetLED: '#e9f2ff', rackLedA: '#79d98f', rackLedB: '#f0c35a',
    plinth: '#ece6dd', plinthEdge: '#d3cabd', inlay: '#cdbfa9', plaza: '#e3dcd1',
    deskTop: '#ddba90', deskMetal: '#2e2f33', chair: '#45464c', monitorFrame: '#2b2c30', keyboard: '#e6e3de', trousers: '#4a4d55',
    plantPot: '#dacfbf', plantPotTall: '#cfc6b9', plantLeaf: '#7dab76', plantLeafTall: '#6e9f6a',
    worker: '#ecdccb',
    terminal: '#d3d6db', terminalScreen: 0.55,
    hubCore: '#5f9fe6', hubGlow: 0.6,
    screenPool: 0, lampPool: 0,
    text: '#2b2a28',
    hemiSky: '#fff7ec', hemiGround: '#d6cfc3', hemiIntensity: 1.2,
    sunIntensity: 2.0, sunColour: '#fff1dc',
    exposure: 1.0, aoBlend: 0.85
  },
  dark: {
    background: ['#2a2a2d', '#111113'],   // charcoal
    shadowOpacity: 0.3, blobOpacity: 0.45,
    slabEdge: '#1d1d20', slabFoot: '#151517',
    tile: '#7a756e', wood: '#eab47c',
    wall: '#3c3d42', wallTint: 0.08, wallCap: '#111113', baseboard: '#232427',
    rug: '#4a4a4e', rugBorder: '#36363a', loungeRug: '#403d3a', loungeRugBorder: '#2f2d2b',
    shelf: '#26262a', shelfBack: '#303034', shelfObject: '#3b3a37', label: '#d9d4ca',
    potSmall: '#4b4844', leafSmall: '#5f9a63',
    frame: '#141414', mat: '#e8e2d8',
    metal: '#18191c', leather: '#93603e', sofa: '#5b5a61', sofaBase: '#38383d', lampShade: '#1b1b1e', bulb: '#ffd89c', lampGlow: '#ffae5e',
    led: '#ffd394', ledGlow: 1.0, ledGlowColour: '#ffab58',
    seam: '#19191b', locker: '#55565c', credenza: '#38383d', woodSolid: '#a06f47', whiteboardFrame: '#575a60',
    closetFloor: '#222225', closetWall: '#2a2b2f', closetLED: '#a4d2ff', rackLedA: '#5fe08a', rackLedB: '#ffcc66',
    plinth: '#4a4846', plinthEdge: '#2c2c2f', inlay: '#806a4c', plaza: '#605b55',
    deskTop: '#c99769', deskMetal: '#141518', chair: '#3a3b40', monitorFrame: '#111215', keyboard: '#2d2e32', trousers: '#2e3036',
    plantPot: '#4a4743', plantPotTall: '#3f3d3a', plantLeaf: '#5e9b63', plantLeafTall: '#4f8a56',
    worker: '#dccab6',
    terminal: '#34373c', terminalScreen: 0.9,
    hubCore: '#8fc0f2', hubGlow: 1.0,
    screenPool: 0.55, lampPool: 0.9,
    text: '#e7e4df',
    hemiSky: '#d9ccbc', hemiGround: '#3b342d', hemiIntensity: 1.35,
    sunIntensity: 1.5, sunColour: '#ffd9b0',
    exposure: 1.05, aoBlend: 0.7
  },
  // one soft accent per department (keyed by the department key from the office layout): card edges, wall tint
  departments: {
    research: '#8fb5d6',
    design: '#c7a4d6',
    office: '#a9cfa6',
    default: '#d9c48f'
  },
  status: {
    idle: '#9aa3ad',
    working: '#4fbf73',
    waiting: '#e8b53e',
    error: '#e2584d'
  },
  // services rack: status light colours (owner vocabulary, round 1)
  serviceStatus: {
    configured: '#4fbf73',
    manual: '#6f93d8',
    offline: '#e2584d',
    unknown: '#9aa3ad'
  },
  services: {
    anthropic: '#d9956a',
    openrouter: '#7f9cf5',
    realesrgan: '#8fb3c8',
    etsy: '#f08a5d',
    mock: '#b9b4c9'
  }
};
