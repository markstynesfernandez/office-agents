// palette.js — the one place colours live (spec: "One config file holds the palette"). Muted pastels, warm light
// platforms on a cooler, lighter backdrop so they separate; one soft accent per department, used as a floor tint and
// on the bevelled edge. Dark mode: deep blue-charcoal backdrop (not black), platforms lifted to a readable dark tone with
// a faint rim, glowing monitors and hub.
export const PALETTE = {
  light: {
    background: ['#fafcfe', '#e2e9f2'],   // vertical gradient, top -> bottom (cooler and lighter than the platforms)
    shadowOpacity: 0.2,                   // ground shadow catcher
    blobOpacity: 0.44,                     // soft drop shadow under each platform
    platform: '#ede6db',                   // warm light floor, tinted per department
    platformTint: 0.3,                    // how much of the department accent goes into the floor
    platformEdge: '#cfc4b4',               // darker bevelled edge (also tinted)
    rim: '#cfc5b6', rimOpacity: 0.0,       // rim line (dark mode only)
    walkway: '#dcd4c7',                    // a little darker than the platforms
    plinth: '#e8e2d8', plinthEdge: '#cfc6b8',
    desk: '#ffffff',
    deskLeg: '#dcd6cc',
    chair: '#c9c2b7',
    monitorFrame: '#3b3d42',
    glass: '#d4e6ee', glassOpacity: 0.34,
    plantPot: '#c8b49c',
    plantLeaf: '#93bf8d',
    worker: '#ecdccb',
    terminal: '#eceff3', terminalScreen: 0.55,
    hubCore: '#5f9fe6', hubGlow: 0.6,
    text: '#2b2a28',
    hemiSky: '#fff6e8', hemiGround: '#cdd6e4', hemiIntensity: 1.25,
    sunIntensity: 1.85, sunColour: '#fff3e0',
    rimLight: 0.0, exposure: 1.0, aoBlend: 0.8
  },
  dark: {
    background: ['#253045', '#151b28'],   // deep blue-charcoal
    shadowOpacity: 0.32,
    blobOpacity: 0.55,
    platform: '#3d4556',
    platformTint: 0.2,
    platformEdge: '#2b313e',
    rim: '#8fa6c8', rimOpacity: 0.55,
    walkway: '#404a5c',
    plinth: '#3a4252', plinthEdge: '#272d39',
    desk: '#c4c7cd',
    deskLeg: '#7e838d',
    chair: '#666c78',
    monitorFrame: '#16181d',
    glass: '#6f8ba0', glassOpacity: 0.28,
    plantPot: '#7a6a58',
    plantLeaf: '#6fa572',
    worker: '#c9b8a6',
    terminal: '#4a5263', terminalScreen: 0.9,
    hubCore: '#8fc0f2', hubGlow: 1.0,
    text: '#e7e4df',
    hemiSky: '#9aa9d6', hemiGround: '#2a3040', hemiIntensity: 1.05,
    sunIntensity: 0.95, sunColour: '#d6e0ff',
    rimLight: 0.9, exposure: 1.05, aoBlend: 0.6
  },
  // one soft accent per department (keyed by the department key from the office layout)
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
