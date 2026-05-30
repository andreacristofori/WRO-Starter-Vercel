import { SimulationState, RobotState, MapConfig } from './types';

// ------------- Color Sensing Logic -------------
const activeEngineInstances: SimulationEngine[] = [];

let cachedMapCanvas: HTMLCanvasElement | null = null;
let cachedMapCtx: CanvasRenderingContext2D | null = null;
let cachedMapId: string | null = null;
let cachedMapUrl: string | null = null;
let isImageLoading = false;

function loadMapImage(mapId: string, url: string) {
  if (isImageLoading) return;
  if (cachedMapId === mapId && cachedMapUrl === url) return;

  isImageLoading = true;
  
  const img = new Image();
  // Only set crossOrigin if loading from a remote external HTTP/HTTPS URL
  // Relative/local paths will fail under CORS in certain iframe settings if crossOrigin is set.
  if (url.startsWith('http://') || url.startsWith('https://')) {
    img.crossOrigin = 'anonymous';
  }
  
  img.onload = () => {
    cachedMapCanvas = document.createElement('canvas');
    cachedMapCanvas.width = img.width;
    cachedMapCanvas.height = img.height;
    cachedMapCtx = cachedMapCanvas.getContext('2d', { willReadFrequently: true });
    if (cachedMapCtx) {
        // Riempiamo di bianco prima di disegnare, così se l'immagine ha trasparenze, quelle diventano bianche
        cachedMapCtx.fillStyle = '#ffffff';
        cachedMapCtx.fillRect(0, 0, img.width, img.height);
        cachedMapCtx.drawImage(img, 0, 0);
    }
    
    cachedMapId = mapId;
    cachedMapUrl = url;
    isImageLoading = false;
    console.log(`Loaded map image for ${mapId} for color sensing.`);
    
    // Immediately calculate sensors with the loaded canvas and notify React state
    activeEngineInstances.forEach(engine => {
      engine.updateAllSensors();
    });
  };

  img.onerror = (e) => {
    console.error("Failed to load map image for color sensing", e);
    isImageLoading = false;
  };

  img.src = url;
}

function getClosestColorName(r: number, g: number, b: number) {
  // Check if it's generally dark (black)
  if (r < 80 && g < 80 && b < 80) return 'black';
  
  // WRO maps use saturated colors
  if (r > 150 && g > 150 && b > 150) return 'white';
  if (r > 150 && g < 100 && b < 100) return 'red';
  if (r < 100 && g > 150 && b < 100) return 'green';
  if (r < 100 && g < 100 && b > 150) return 'blue';
  if (r > 150 && g > 150 && b < 100) return 'yellow';
  
  const colors = {
    white: [255, 255, 255],
    black: [0, 0, 0],
    red: [255, 0, 0],
    green: [0, 255, 0],
    blue: [0, 0, 255],
    yellow: [255, 255, 0]
  };

  let minDistance = Infinity;
  let closest = 'white';

  for (const [name, rgb] of Object.entries(colors)) {
    const dist = Math.sqrt(
      Math.pow(r - rgb[0], 2) + Math.pow(g - rgb[1], 2) + Math.pow(b - rgb[2], 2)
    );
    if (dist < minDistance) {
      minDistance = dist;
      closest = name;
    }
  }

  return closest;
}

function isPointInGreenArea(x: number, y: number): boolean {
  const vs = [
    [535, 435],
    [650, 550],
    [340, 860],
    [230, 745]
  ];
  let inside = false;
  for (let i = 0, j = vs.length - 1; i < vs.length; j = i++) {
    const xi = vs[i][0], yi = vs[i][1];
    const xj = vs[j][0], yj = vs[j][1];
    const intersect = ((yi > y) !== (yj > y))
        && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

function getMapPixelColor(mapId: string, mapConf: any, x: number, y: number): string {
  if (!mapConf.imageUrl) return 'white';
  
  if (cachedMapId !== mapId || cachedMapUrl !== mapConf.imageUrl) {
    loadMapImage(mapId, mapConf.imageUrl);
  }
  
  if (!cachedMapCanvas || !cachedMapCtx) return 'white';
  
  const px = Math.floor((x / mapConf.width) * cachedMapCanvas.width);
  const py = Math.floor((y / mapConf.height) * cachedMapCanvas.height);
  
  if (px < 0 || px >= cachedMapCanvas.width || py < 0 || py >= cachedMapCanvas.height) {
     return 'white';
  }
  
  try {
    const pixelData = cachedMapCtx.getImageData(px, py, 1, 1).data;
    return getClosestColorName(pixelData[0], pixelData[1], pixelData[2]);
  } catch (e) {
    console.error("Error reading map pixel color: ", e);
    return 'white';
  }
}
// -----------------------------------------------

const INITIAL_TIME = 120; // 2 minutes

const MAPS: Record<string, MapConfig> = {
  'robo-starter-italy': {
    id: 'robo-starter-italy',
    name: 'Robostarter Wro',
    imageUrl: '/TappetoStarter.png', // Default uploaded map image
    width: 2340,
    height: 1144,
    timerDuration: 300, // 5 minutes
    startZones: [
      { position: { x: 0, y: 800 }, width: 300, height: 343 }, // Approximate start zone
    ],
    initialObjects: {
      'turtle-food-green': {
        id: 'turtle-food-green',
        type: 'obstacle',
        position: { x: 220, y: 1005 },
        modelUrl: '/CiboTartaruga.glb',
        modelScale: 1,
        color: 'green',
        rotation: 90,
        radius: 30
      },
      'turtle-food-green-2': {
        id: 'turtle-food-green-2',
        type: 'obstacle',
        position: { x: 260, y: 955 },
        modelUrl: '/CiboTartaruga.glb',
        modelScale: 1,
        color: 'green',
        rotation: 90,
        radius: 30
      },
      'turtle-food-1': {
        id: 'turtle-food-1',
        type: 'obstacle',
        position: { x: 950, y: 985 },
        modelUrl: '/CiboTartaruga.glb',
        modelScale: 1,
        color: 'red'
      },
      'turtle-food-2': {
        id: 'turtle-food-2',
        type: 'obstacle',
        position: { x: 1550, y: 985 },
        modelUrl: '/CiboTartaruga.glb',
        modelScale: 1,
        color: 'red'
      },
      'turtle-food-3': {
        id: 'turtle-food-3',
        type: 'obstacle',
        position: { x: 1150, y: 985 },
        modelUrl: '/CiboTartaruga.glb',
        modelScale: 1,
        color: 'yellow'
      },
      'turtle-food-4': {
        id: 'turtle-food-4',
        type: 'obstacle',
        position: { x: 1750, y: 985 },
        modelUrl: '/CiboTartaruga.glb',
        modelScale: 1,
        color: 'yellow'
      },
      'albero-1': {
        id: 'albero-1',
        type: 'obstacle',
        position: { x: 1355, y: 562 },
        modelUrl: '/Albero.gltf',
        modelScale: 1.5,
        color: '#4ade80'
      },
      'albero-2': {
        id: 'albero-2',
        type: 'obstacle',
        position: { x: 1555, y: 562 },
        modelUrl: '/Albero.gltf',
        modelScale: 1.5,
        color: '#4ade80'
      },
      'albero-3': {
        id: 'albero-3',
        type: 'obstacle',
        position: { x: 1355, y: 662 },
        modelUrl: '/Albero.gltf',
        modelScale: 1.5,
        color: '#4ade80'
      },
      'albero-4': {
        id: 'albero-4',
        type: 'obstacle',
        position: { x: 1555, y: 662 },
        modelUrl: '/Albero.gltf',
        modelScale: 1.5,
        color: '#4ade80'
      },
      'omino': {
        id: 'omino',
        type: 'obstacle',
        position: { x: 240, y: 1035 },
        modelUrl: '/ominoblender.glb',
        modelScale: 0.0005,
        rotation: 180,
        radius: 10,
        collisionPoints: [{x: 0, y: -15}, {x: 0, y: 0}, {x: 0, y: 15}],
        color: '#0000ff'
      },
      'rifiuto-1': {
        id: 'rifiuto-1',
        type: 'obstacle',
        position: { x: 330, y: 526 },
        modelUrl: '/ominoblender.glb',
        modelScale: 0.0005,
        rotation: 180,
        radius: 10,
        collisionPoints: [{x: 0, y: -15}, {x: 0, y: 0}, {x: 0, y: 15}],
        color: '#ff0000'
      },
      'rifiuto-2': {
        id: 'rifiuto-2',
        type: 'obstacle',
        position: { x: 770, y: 1070 },
        modelUrl: '/ominoblender.glb',
        modelScale: 0.0005,
        rotation: 90,
        radius: 10,
        collisionPoints: [{x: 0, y: -15}, {x: 0, y: 0}, {x: 0, y: 15}],
        color: '#ff0000'
      },
      'rifiuto-3': {
        id: 'rifiuto-3',
        type: 'obstacle',
        position: { x: 2085, y: 626 },
        modelUrl: '/ominoblender.glb',
        modelScale: 0.0005,
        rotation: 180,
        radius: 10,
        collisionPoints: [{x: 0, y: -15}, {x: 0, y: 0}, {x: 0, y: 15}],
        color: '#ff0000'
      },
      'rifiuto-4': {
        id: 'rifiuto-4',
        type: 'obstacle',
        position: { x: 2016, y: 1038 },
        modelUrl: '/ominoblender.glb',
        modelScale: 0.0005,
        rotation: 90,
        radius: 10,
        collisionPoints: [{x: 0, y: -15}, {x: 0, y: 0}, {x: 0, y: 15}],
        color: '#ff0000'
      },
      'tarta-blender': {
        id: 'tarta-blender',
        type: 'obstacle',
        position: { x: 1345, y: 992 },
        modelUrl: '/TartaBlender.glb',
        modelScale: 0.0005,
        color: '#0000ff'
      },
      'tarta-blender-red': {
        id: 'tarta-blender-red',
        type: 'obstacle',
        position: { x: 965, y: 605 },
        modelUrl: '/TartaBlender.glb',
        modelScale: 0.0005,
        color: '#ff0000'
      },
      'tarta-blender-green': {
        id: 'tarta-blender-green',
        type: 'obstacle',
        position: { x: 957, y: 360 },
        modelUrl: '/TartaBlender.glb',
        modelScale: 0.0005,
        color: '#166534'
      },
      'tarta-blender-yellow': {
        id: 'tarta-blender-yellow',
        type: 'obstacle',
        position: { x: 1459, y: 159 },
        modelUrl: '/TartaBlender.glb',
        modelScale: 0.0005,
        color: '#facc15'
      }
    }
  },
  'blank-grid': {
    id: 'blank-grid',
    name: 'Blank Grid (Test)',
    width: 2362,
    height: 1143,
    timerDuration: 120, // 2 minutes
    startZones: [
      { position: { x: 0, y: 0 }, width: 400, height: 400 }
    ],
    initialObjects: {
      'turtle-food-green-blank': {
        id: 'turtle-food-green-blank',
        type: 'obstacle',
        position: { x: 220, y: 1005 },
        modelUrl: '/CiboTartaruga.glb',
        modelScale: 1,
        color: 'green',
        rotation: 90,
        radius: 30
      },
      'turtle-food-green-2-blank': {
        id: 'turtle-food-green-2-blank',
        type: 'obstacle',
        position: { x: 260, y: 955 },
        modelUrl: '/CiboTartaruga.glb',
        modelScale: 1,
        color: 'green',
        rotation: 90,
        radius: 30
      },
      'omino-blank': {
        id: 'omino-blank',
        type: 'obstacle',
        position: { x: 240, y: 1035 },
        modelUrl: '/ominoblender.glb',
        modelScale: 0.0005,
        rotation: 180,
        radius: 10,
        collisionPoints: [{x: 0, y: -15}, {x: 0, y: 0}, {x: 0, y: 15}],
        color: '#0000ff'
      },
      'rifiuto-1-blank': {
        id: 'rifiuto-1-blank',
        type: 'obstacle',
        position: { x: 330, y: 526 },
        modelUrl: '/ominoblender.glb',
        modelScale: 0.0005,
        rotation: 180,
        radius: 10,
        collisionPoints: [{x: 0, y: -15}, {x: 0, y: 0}, {x: 0, y: 15}],
        color: '#ff0000'
      },
      'rifiuto-2-blank': {
        id: 'rifiuto-2-blank',
        type: 'obstacle',
        position: { x: 770, y: 1070 },
        modelUrl: '/ominoblender.glb',
        modelScale: 0.0005,
        rotation: 90,
        radius: 10,
        collisionPoints: [{x: 0, y: -15}, {x: 0, y: 0}, {x: 0, y: 15}],
        color: '#ff0000'
      },
      'rifiuto-3-blank': {
        id: 'rifiuto-3-blank',
        type: 'obstacle',
        position: { x: 2085, y: 626 },
        modelUrl: '/ominoblender.glb',
        modelScale: 0.0005,
        rotation: 180,
        radius: 10,
        collisionPoints: [{x: 0, y: -15}, {x: 0, y: 0}, {x: 0, y: 15}],
        color: '#ff0000'
      },
      'rifiuto-4-blank': {
        id: 'rifiuto-4-blank',
        type: 'obstacle',
        position: { x: 2016, y: 1038 },
        modelUrl: '/ominoblender.glb',
        modelScale: 0.0005,
        rotation: 90,
        radius: 10,
        collisionPoints: [{x: 0, y: -15}, {x: 0, y: 0}, {x: 0, y: 15}],
        color: '#ff0000'
      },
      'tarta-blender-blank': {
        id: 'tarta-blender-blank',
        type: 'obstacle',
        position: { x: 1356, y: 991 },
        modelUrl: '/TartaBlender.glb',
        modelScale: 0.0005,
        color: '#0000ff'
      },
      'tarta-blender-red-blank': {
        id: 'tarta-blender-red-blank',
        type: 'obstacle',
        position: { x: 976, y: 604 },
        modelUrl: '/TartaBlender.glb',
        modelScale: 0.0005,
        color: '#ff0000'
      },
      'tarta-blender-green-blank': {
        id: 'tarta-blender-green-blank',
        type: 'obstacle',
        position: { x: 968, y: 359 },
        modelUrl: '/TartaBlender.glb',
        modelScale: 0.0005,
        color: '#166534'
      },
      'tarta-blender-yellow-blank': {
        id: 'tarta-blender-yellow-blank',
        type: 'obstacle',
        position: { x: 1459, y: 159 },
        modelUrl: '/TartaBlender.glb',
        modelScale: 0.0005,
        color: '#facc15'
      }
    }
  }
};

export const getInitialState = (mapId: string = 'robo-starter-italy'): SimulationState => {
  const map = MAPS[mapId];
  return {
    currentMapId: mapId,
    maps: MAPS,
    robots: {},
    objects: JSON.parse(JSON.stringify(map.initialObjects)), // Deep copy initial objects
    status: 'idle',
    timeRemaining: map.timerDuration || INITIAL_TIME,
    score: 0,
    startAreaBonus: 0,
    treeBonus: 0,
  };
};

let simulationState = getInitialState();
let timerInterval: NodeJS.Timeout | null = null;

export function getRobotRotatedExtents(robot: any, rotationDeg: number) {
  const theta = (rotationDeg * Math.PI) / 180;
  let localPoints: { x: number; y: number }[] = [];

  if (robot.shape === 'circle') {
    const r = Math.max(1, Math.min(robot.width || 150, robot.height || 150) / 2 - 20);
    return {
      minX: -r,
      maxX: r,
      minY: -r,
      maxY: r,
      maxRadius: r
    };
  } else if (robot.shape === 'custom' && robot.customPoints && robot.customPoints.length > 0) {
    let minPx = Infinity, maxPx = -Infinity, minPy = Infinity, maxPy = -Infinity;
    for (const p of robot.customPoints) {
      if (p.x < minPx) minPx = p.x;
      if (p.x > maxPx) maxPx = p.x;
      if (p.y < minPy) minPy = p.y;
      if (p.y > maxPy) maxPy = p.y;
    }
    const midX = (minPx + maxPx) / 2;
    const midY = (minPy + maxPy) / 2;
    
    localPoints = robot.customPoints.map((p: any) => ({
      x: -(p.y - midY) / 2.5,
      y: (p.x - midX) / 2.5
    }));
    // Wheels bounding for wall collisions
    let minLx = Infinity, maxLx = -Infinity, minLy = Infinity, maxLy = -Infinity;
    for (const lp of localPoints) {
      if (lp.x < minLx) minLx = lp.x;
      if (lp.x > maxLx) maxLx = lp.x;
      if (lp.y < minLy) minLy = lp.y;
      if (lp.y > maxLy) maxLy = lp.y;
    }
    localPoints.push({ x: minLx, y: minLy - 20 });
    localPoints.push({ x: maxLx, y: minLy - 20 });
    localPoints.push({ x: minLx, y: maxLy + 20 });
    localPoints.push({ x: maxLx, y: maxLy + 20 });
  } else {
    // Default / rectangle
    const lateralHalf = (robot.width || 150) / 2 + 20; // +20 for wheels per side
    const forwardHalf = (robot.height || 150) / 2;
    localPoints = [
      { x: -forwardHalf, y: -lateralHalf },
      { x: forwardHalf, y: -lateralHalf },
      { x: forwardHalf, y: lateralHalf },
      { x: -forwardHalf, y: lateralHalf }
    ];
  }

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  let maxRadiusSq = 0;

  const cosT = Math.cos(theta);
  const sinT = Math.sin(theta);

  for (const p of localPoints) {
    const rx = p.x * cosT - p.y * sinT;
    const ry = p.x * sinT + p.y * cosT;

    if (rx < minX) minX = rx;
    if (rx > maxX) maxX = rx;
    if (ry < minY) minY = ry;
    if (ry > maxY) maxY = ry;

    const distSq = p.x * p.x + p.y * p.y;
    if (distSq > maxRadiusSq) {
      maxRadiusSq = distSq;
    }
  }

  return {
    minX,
    maxX,
    minY,
    maxY,
    maxRadius: Math.sqrt(maxRadiusSq)
  };
}

export function calculateScore(simulationState: any) {
  let newScore = 0;
  let landfillRifiutiCount = 0;
  const breakdown: string[] = [];
  
  const map = simulationState.maps[simulationState.currentMapId];
  if (map) {
    for (const objId in simulationState.objects) {
      const obj = simulationState.objects[objId];
      if (obj.collectedBy) continue;
      
      let hasMoved = false;
      const initialObj = map.initialObjects[objId];
      if (initialObj) {
        const dxx = obj.position.x - initialObj.position.x;
        const dyy = obj.position.y - initialObj.position.y;
        if (dxx * dxx + dyy * dyy > 4) {
          hasMoved = true;
        }
      } else {
        hasMoved = true;
      }
      
      if (!hasMoved) continue;
      
      let objR = obj.radius || (obj.type === 'obstacle' ? 40 : 20);
      if (obj.modelUrl === '/CiboTartaruga.glb') objR = 12;
      if (obj.modelUrl === '/TartaBlender.glb') objR = 20;
      if (obj.modelUrl === '/ominoblender.glb') objR = 10;
      if (obj.modelUrl === '/Albero.gltf') objR = 15;
      if (obj.collisionPoints && obj.collisionPoints.length > 0) {
        let maxDist = 0;
        for (const pt of obj.collisionPoints) {
          const dist = Math.sqrt(pt.x * pt.x + pt.y * pt.y);
          if (dist > maxDist) maxDist = dist;
        }
        if (maxDist > objR) objR = maxDist;
      }
      const checkPoints = [
        { x: 0, y: 0 },
        { x: objR, y: 0 },
        { x: -objR, y: 0 },
        { x: 0, y: objR },
        { x: 0, y: -objR },
        { x: objR * 0.7, y: objR * 0.7 },
        { x: -objR * 0.7, y: objR * 0.7 },
        { x: objR * 0.7, y: -objR * 0.7 },
        { x: -objR * 0.7, y: -objR * 0.7 }
      ];
      
      let isOnGreen = false;
      let isInGreenStorageArea = false;
      let inStoreArea = false;
      for (const pt of checkPoints) {
          const px = Math.round(obj.position.x + pt.x);
          const py = Math.round(obj.position.y + pt.y);
          const color = getMapPixelColor(simulationState.currentMapId, map, px, py);
          if (color === 'green' || isPointInGreenArea(px, py)) {
              isOnGreen = true;
          }
          if (isPointInGreenArea(px, py)) {
              isInGreenStorageArea = true;
          }
      }
      
      // Controlliamo il centro per evitare che le posizioni iniziali a y=1000 (con raggio 30) contino da subito.
      const pxC = Math.round(obj.position.x);
      const pyC = Math.round(obj.position.y);
      
      const inStoreBox = (pxC >= 800 && pxC <= 1880 && pyC >= 1005 && pyC <= 1150);
      let edgeInStore = false;
      
      if (!inStoreBox && pyC < 1005) {
        // Se si trova sotto, assicuriamoci che l'oggetto sia stato almeno mosso (ad es. spostato dal robot)
        // Oppure semplicemente ignoriamo le piccole sovrapposizioni iniziali controllando solo se è ben dentro.
        if (pyC + (objR * 0.2) >= 1005 && pxC >= 800 && pxC <= 1880) { // Tolleranza ridotta a 0.2 (circa 6 pixel)
            edgeInStore = true;
        }
      } else if (!inStoreBox) {
         for (const pt of checkPoints) {
            const px = Math.round(obj.position.x + pt.x);
            const py = Math.round(obj.position.y + pt.y);
            if (px >= 800 && px <= 1880 && py >= 1005 && py <= 1150) {
                edgeInStore = true;
            }
         }
      }

      if (inStoreBox || (edgeInStore && obj.collectedBy === undefined && pyC !== 1000)) { 
          // pyC !== 1000 ignora i cibi nella loro esatta riga y=1000 iniziale
          inStoreArea = true;
      }
      
      if (!inStoreArea && obj.storedPoints !== undefined) {
          // Hysteresis: prevent score flickering if the object jitters on the boundary
          if (pxC >= 780 && pxC <= 1900 && pyC >= 990 && pyC <= 1170) {
              inStoreArea = true;
          }
      }
      
      let inBeachArea = false;
      for (const pt of checkPoints) {
           const px = Math.round(obj.position.x + pt.x);
           const py = Math.round(obj.position.y + pt.y);
           if (px >= 0 && px <= 400 && py >= 0 && py <= 500) {
               inBeachArea = true;
               break;
           }
      }

      if (objId.startsWith('turtle-food')) {
        if (obj.color === 'yellow') {
          if (inStoreArea) {
            if (obj.storedPoints === undefined) {
              let isLedOnAtDeposit = obj.droppedWithLed === true;
              
              if (!isLedOnAtDeposit) {
                // Se non era impostato via evento "drop", controlliamo se il robot ha il LED acceso in questo momento
                for (const robotId in simulationState.robots) {
                  if (simulationState.robots[robotId].ledOn) {
                    isLedOnAtDeposit = true;
                    break;
                  }
                }
              }
              
              obj.storedPoints = isLedOnAtDeposit ? 15 : 10;
            }

            if (obj.storedPoints === 15) {
              newScore += 15;
              breakdown.push('Cibo Giallo con LED = 15 punti');
            } else {
              newScore += 10;
              breakdown.push('Cibo Giallo = 10 punti');
            }
          } else {
            obj.storedPoints = undefined;
          }
        } else {
          if (isInGreenStorageArea && !inStoreArea) {
            if (obj.color === 'green') {
              newScore += 10;
              breakdown.push('Cibo Verde = 10 punti');
            } else if (obj.color === 'red') {
              newScore += 25;
              breakdown.push('Cibo Rosso = 25 punti');
            } else {
              newScore += 25;
              const colName = obj.color === 'yellow' ? 'Giallo' : obj.color === 'green' ? 'Verde' : obj.color === 'red' ? 'Rosso' : obj.color;
              breakdown.push(`Cibo ${colName} = 25 punti`);
            }
          }
        }
      } else if (objId.includes('tarta') && !objId.includes('food')) {
        if (inBeachArea) {
          newScore += 20;
          breakdown.push('Tartaruga = 20 punti');
        }
      } else if (objId.includes('omino')) {
        let scoredThisGuardian = false;
        
        if (isInGreenStorageArea) {
          newScore += 15;
          scoredThisGuardian = true;
          breakdown.push('Guardiano = 15 punti');
        } else if (inStoreArea) {
          newScore += 15;
          scoredThisGuardian = true;
          breakdown.push('Guardiano = 15 punti');
        } else {
          const closestX = Math.max(2045, Math.min(pxC, 2340));
          const closestY = Math.max(647, Math.min(pyC, 1150));
          const dx = pxC - closestX;
          const dy = pyC - closestY;
          const touchesBuildingArea = (dx * dx + dy * dy) <= (objR * objR);

          if (inBeachArea || touchesBuildingArea) {
            newScore += 15;
            scoredThisGuardian = true;
            breakdown.push('Guardiano = 15 punti');
          }
        }
      } else if (objId.includes('rifiuto')) {
        const inLandfillArea = 
          (pxC >= 2055 && pxC <= 2070 && pyC >= 0 && pyC <= 290) ||
          (pxC >= 0 && pxC <= 290 && pyC >= 2050 && pyC <= 2340) ||
          (pxC >= 2050 && pxC <= 2340 && pyC >= 0 && pyC <= 290);
          
        if (inLandfillArea) {
          if (landfillRifiutiCount < 4) {
            newScore += 20;
            landfillRifiutiCount++;
            breakdown.push('Rifiuto = 20 punti');
          }
        }
      }
    }
  }

  // Calculate End-of-Execution Bonuses
  let activeStartAreaBonus = 0;
  let computedTreeBonus = 0;

  if (simulationState.status === 'finished') {
    // 1. Trees that haven't moved or been damaged
    if (map && map.initialObjects) {
      for (const objId in map.initialObjects) {
        if (objId.startsWith('albero')) {
           const initialObj = map.initialObjects[objId];
           const currentObj = simulationState.objects[objId];
           if (currentObj) {
               const dx = currentObj.position.x - initialObj.position.x;
               const dy = currentObj.position.y - initialObj.position.y;
               const dist = Math.sqrt(dx * dx + dy * dy);
               const treeRadius = 15;
               const areaRadius = 40; // Assumed radius of the tree's starting area placeholder
               
               if (dist <= treeRadius + areaRadius) { 
                   computedTreeBonus += 10;
               }
           }
        }
      }
    }

    // 2. Parcheggio
    let anyRobotReturned = false;
    for (const rId in simulationState.robots) {
       const robot = simulationState.robots[rId];
       if (robot.hasLeftStartArea && robot.hasReturnedToStart) {
          anyRobotReturned = true;
          break;
       }
    }

    if (newScore > 0 && anyRobotReturned) { // asgn only if other points made
       activeStartAreaBonus = 20;
    }
    
    simulationState.treeBonus = computedTreeBonus;
    simulationState.startAreaBonus = activeStartAreaBonus;
  } else {
    // Override manual test values during run so they don't count until finish
    simulationState.treeBonus = 0;
    simulationState.startAreaBonus = 0;
  }

  if (activeStartAreaBonus > 0) {
    breakdown.push(`Parcheggio = ${activeStartAreaBonus} punti`);
  }
  if (computedTreeBonus > 0) {
    breakdown.push(`Alberi = ${computedTreeBonus} punti`);
  }
  
  const totalWithBonuses = newScore + activeStartAreaBonus + computedTreeBonus;
  
  const oldScore = simulationState.score;
  simulationState.score = totalWithBonuses;
  simulationState.scoreBreakdown = breakdown;
  
  if (oldScore !== totalWithBonuses) {
    console.log(`[SCORE UPDATE] Total: ${totalWithBonuses}. Breakdown: ${JSON.stringify(breakdown)}`);
  }
}

export function checkRobotObjectCollision(robot: any, obj: any, OBJ_RADIUS: number) {
  const dx = obj.position.x - robot.position.x;
  const dy = obj.position.y - robot.position.y;
  const dist = Math.sqrt(dx * dx + dy * dy);

  if (robot.shape === 'circle') {
    const r = Math.max(1, Math.min(robot.width || 150, robot.height || 150) / 2 + 20);
    const minD = r + OBJ_RADIUS;
    if (dist < minD) {
      let pushX = 0, pushY = 0;
      if (dist === 0) {
        pushX = minD;
      } else {
        const overlap = minD - dist;
        pushX = (dx / dist) * overlap;
        pushY = (dy / dist) * overlap;
      }
      return { colliding: true, pushX, pushY };
    }
    return { colliding: false, pushX: 0, pushY: 0 };
  } else if (robot.shape === 'custom' && robot.customPoints && robot.customPoints.length > 0) {
    const theta = (robot.rotation * Math.PI) / 180;
    const cosT = Math.cos(theta);
    const sinT = Math.sin(theta);
    
    let minPx = Infinity, maxPx = -Infinity, minPy = Infinity, maxPy = -Infinity;
    for (const p of robot.customPoints) {
      if (p.x < minPx) minPx = p.x;
      if (p.x > maxPx) maxPx = p.x;
      if (p.y < minPy) minPy = p.y;
      if (p.y > maxPy) maxPy = p.y;
    }
    const midX = (minPx + maxPx) / 2;
    const midY = (minPy + maxPy) / 2;

    const leftWheelPoints = [
      { localX: -60, localY: 75 },
      { localX: 0, localY: 75 },
      { localX: 0, localY: 95 },
      { localX: -60, localY: 95 }
    ];
    const rightWheelPoints = [
      { localX: -60, localY: -95 },
      { localX: 0, localY: -95 },
      { localX: 0, localY: -75 },
      { localX: -60, localY: -75 }
    ];

    const polygonsLocal = [
      robot.customPoints.map((p: any) => ({
        localX: -(p.y - midY) / 2.5,
        localY: (p.x - midX) / 2.5
      })),
      leftWheelPoints,
      rightWheelPoints
    ];

    let overallPushX = 0;
    let overallPushY = 0;
    let anyCollision = false;

    for (const poly of polygonsLocal) {
      const vertices = poly.map((pt: any) => {
        const rx = pt.localX * cosT - pt.localY * sinT;
        const ry = pt.localX * sinT + pt.localY * cosT;
        return {
          x: robot.position.x + rx,
          y: robot.position.y + ry
        };
      });

      let closestPt = { x: vertices[0].x, y: vertices[0].y };
      let minCustomDist = Infinity;
      let isInside = false;

      for (let i = 0; i < vertices.length; i++) {
        const p1 = vertices[i];
        const p2 = vertices[(i + 1) % vertices.length];

        const segDx = p2.x - p1.x;
        const segDy = p2.y - p1.y;
        const segLenSq = segDx * segDx + segDy * segDy;
        
        let t = 0;
        if (segLenSq > 0) {
          t = ((obj.position.x - p1.x) * segDx + (obj.position.y - p1.y) * segDy) / segLenSq;
          t = Math.max(0, Math.min(1, t));
        }

        const projX = p1.x + t * segDx;
        const projY = p1.y + t * segDy;
        
        const pDx = obj.position.x - projX;
        const pDy = obj.position.y - projY;
        const pDist = Math.sqrt(pDx * pDx + pDy * pDy);

        if (pDist < minCustomDist) {
          minCustomDist = pDist;
          closestPt = { x: projX, y: projY };
        }

        if (((p1.y > obj.position.y) !== (p2.y > obj.position.y)) &&
            (obj.position.x < (p2.x - p1.x) * (obj.position.y - p1.y) / (p2.y - p1.y + 1e-9) + p1.x)) {
          isInside = !isInside;
        }
      }

      const CUSTOM_PADDING = 10;
      const EFFECTIVE_RADIUS = OBJ_RADIUS + CUSTOM_PADDING;

      if (isInside) {
        const toBoundaryX = closestPt.x - obj.position.x;
        const toBoundaryY = closestPt.y - obj.position.y;
        const toBoundaryLen = Math.sqrt(toBoundaryX * toBoundaryX + toBoundaryY * toBoundaryY);
        
        let pushX = 0, pushY = 0;
        if (toBoundaryLen === 0) {
          pushX = EFFECTIVE_RADIUS;
        } else {
          const mult = 1 + EFFECTIVE_RADIUS / toBoundaryLen;
          pushX = toBoundaryX * mult;
          pushY = toBoundaryY * mult;
        }
        overallPushX += pushX;
        overallPushY += pushY;
        anyCollision = true;
      } else if (minCustomDist < EFFECTIVE_RADIUS) {
        const outDx = obj.position.x - closestPt.x;
        const outDy = obj.position.y - closestPt.y;
        const outDist = Math.sqrt(outDx * outDx + outDy * outDy);
        const overlap = EFFECTIVE_RADIUS - minCustomDist;
        let pushX = 0, pushY = 0;
        if (outDist === 0) {
          pushX = overlap;
        } else {
          pushX = (outDx / outDist) * overlap;
          pushY = (outDy / outDist) * overlap;
        }
        overallPushX += pushX;
        overallPushY += pushY;
        anyCollision = true;
      }
    }

    if (anyCollision) {
      return { colliding: true, pushX: overallPushX, pushY: overallPushY };
    }
    return { colliding: false, pushX: 0, pushY: 0 };
  } else {
    // Rectangle/Default
    const PADDING = 10; // Extra padding to prevent visual clipping
    const forwardHalf = (robot.height || 150) / 2 + PADDING;
    const lateralHalf = (robot.width || 150) / 2 + 20 + PADDING;
    const theta = (robot.rotation * Math.PI) / 180;
    const cosT = Math.cos(theta);
    const sinT = Math.sin(theta);
    
    const localX = dx * cosT + dy * sinT;
    const localY = -dx * sinT + dy * cosT;

    const closestX = Math.max(-forwardHalf, Math.min(forwardHalf, localX));
    const closestY = Math.max(-lateralHalf, Math.min(lateralHalf, localY));

    const diffX = localX - closestX;
    const diffY = localY - closestY;
    const localDist = Math.sqrt(diffX * diffX + diffY * diffY);

    if (localX >= -forwardHalf && localX <= forwardHalf && localY >= -lateralHalf && localY <= lateralHalf) {
      const dl = localX + forwardHalf;
      const dr = forwardHalf - localX;
      const dt = localY + lateralHalf;
      const db = lateralHalf - localY;
      const minVal = Math.min(dl, dr, dt, db);
      let pushLocalX = 0;
      let pushLocalY = 0;
      if (minVal === dl) {
        pushLocalX = -(dl + OBJ_RADIUS);
      } else if (minVal === dr) {
        pushLocalX = dr + OBJ_RADIUS;
      } else if (minVal === dt) {
        pushLocalY = -(dt + OBJ_RADIUS);
      } else {
        pushLocalY = db + OBJ_RADIUS;
      }
      const pushX = pushLocalX * cosT - pushLocalY * sinT;
      const pushY = pushLocalX * sinT + pushLocalY * cosT;
      return { colliding: true, pushX, pushY };
    } else if (localDist < OBJ_RADIUS) {
      const overlap = OBJ_RADIUS - localDist;
      let pushLocalX = 0;
      let pushLocalY = 0;
      if (localDist === 0) {
        pushLocalX = overlap;
      } else {
        pushLocalX = (diffX / localDist) * overlap;
        pushLocalY = (diffY / localDist) * overlap;
      }
      const pushX = pushLocalX * cosT - pushLocalY * sinT;
      const pushY = pushLocalX * sinT + pushLocalY * cosT;
      return { colliding: true, pushX, pushY };
    }

    return { colliding: false, pushX: 0, pushY: 0 };
  }
}

function calculateDistance(
  sensorX: number, 
  sensorY: number, 
  dirX: number, 
  dirY: number, 
  id: string, 
  map: MapConfig | undefined, 
  simulationState: SimulationState
) {
  let minDistance = 2000;

  if (map) {
    if (dirX > 0) minDistance = Math.min(minDistance, (map.width - sensorX) / dirX);
    if (dirX < 0) minDistance = Math.min(minDistance, (0 - sensorX) / dirX);
    if (dirY > 0) minDistance = Math.min(minDistance, (map.height - sensorY) / dirY);
    if (dirY < 0) minDistance = Math.min(minDistance, (0 - sensorY) / dirY);
  }

  Object.keys(simulationState.robots).forEach(otherId => {
    if (otherId === id) return;
    const other = simulationState.robots[otherId];
    const otherRadius = getRobotRotatedExtents(other, other.rotation).maxRadius;
    const dx = other.position.x - sensorX;
    const dy = other.position.y - sensorY;
    const distToCenter = Math.sqrt(dx * dx + dy * dy);
    const dot = dx * dirX + dy * dirY;
    if (dot > 0) {
      const perpDistSq = (distToCenter * distToCenter) - (dot * dot);
      if (perpDistSq < otherRadius * otherRadius) {
        minDistance = Math.min(minDistance, dot - otherRadius);
      }
    }
  });

  Object.values(simulationState.objects).forEach(obj => {
    if (obj.collectedBy) return;
    const dx = obj.position.x - sensorX;
    const dy = obj.position.y - sensorY;
    const distToCenter = Math.sqrt(dx * dx + dy * dy);
    const objR = obj.radius || (obj.type === 'obstacle' ? 40 : 20);
    const dot = dx * dirX + dy * dirY;
    if (dot > 0) {
      const perpDistSq = (distToCenter * distToCenter) - (dot * dot);
      if (perpDistSq < objR * objR) {
        minDistance = Math.min(minDistance, dot - objR);
      }
    }
  });

  return Math.max(0, Math.round(minDistance));
}

export function updateRobotSensors(robot: RobotState, map: MapConfig | undefined, simulationState: SimulationState) {
  const rad = (robot.rotation * Math.PI) / 180;
  const dirX = Math.cos(rad);
  const dirY = Math.sin(rad);

  // Helper to rotate relative coordinate to absolute
  const getAbsPos = (offsetX: number, offsetY: number) => {
    return {
      x: robot.position.x + offsetX * dirX - offsetY * dirY,
      y: robot.position.y + offsetX * dirY + offsetY * dirX
    };
  };

  // 1. Update Default Sensors (backward compatibility and simple bots)
  if (robot.sensors) {
    if (robot.sensors.distance != null) {
      let frontY = 0;
      if (robot.shape === 'custom' && robot.customPoints && robot.customPoints.length > 0) {
        frontY = Math.max(...robot.customPoints.map((p: any) => p.y)) / 2.5;
      } else {
        frontY = (robot.height || 150) / 2;
      }
      const sPos = getAbsPos(frontY - 20, 0); // Front center (pulled back slightly from edge)
      robot.sensors.distance = calculateDistance(sPos.x, sPos.y, dirX, dirY, robot.id, map, simulationState);
    }

    if (robot.sensors.color != null) {
      let color = map ? getMapPixelColor(simulationState.currentMapId, map, robot.position.x, robot.position.y) : 'white';
      if (isPointInGreenArea(robot.position.x, robot.position.y)) {
        color = 'green';
      }
      
      // Check if on object for color sensor
      let finalColor = color;
      Object.values(simulationState.objects).forEach((obj: any) => {
          if (obj.collectedBy) return;
          const dx = obj.position.x - robot.position.x;
          const dy = obj.position.y - robot.position.y;
          const dist = Math.sqrt(dx*dx + dy*dy);
          let objR = obj.radius || (obj.type === 'obstacle' ? 40 : 20);
          if (obj.modelUrl === '/CiboTartaruga.glb') objR = 12;
          if (obj.modelUrl === '/TartaBlender.glb') objR = 20;
          if (obj.modelUrl === '/ominoblender.glb') objR = 10;
          if (obj.modelUrl === '/Albero.gltf') objR = 15;
          if (dist < (objR + 35)) {
              if (obj.modelUrl !== '/Albero.gltf') {
                  finalColor = obj.color || 'gray';
              }
          }
      });
      robot.sensors.color = finalColor;
    }
  }

  // 2. Update Custom Sensors
  if (robot.customSensors) {
    robot.customSensors.forEach(sensor => {
      const sPos = getAbsPos(sensor.x, sensor.y);
      if (sensor.type === 'distance') {
        sensor.value = calculateDistance(sPos.x, sPos.y, dirX, dirY, robot.id, map, simulationState);
      } else if (sensor.type === 'color') {
        let color = map ? getMapPixelColor(simulationState.currentMapId, map, sPos.x, sPos.y) : 'white';
        if (isPointInGreenArea(sPos.x, sPos.y)) {
          color = 'green';
        }
        Object.values(simulationState.objects).forEach((obj: any) => {
          if (obj.collectedBy) return;
          const dx = obj.position.x - sPos.x;
          const dy = obj.position.y - sPos.y;
          const dist = Math.sqrt(dx*dx + dy*dy);
          let objR = obj.radius || (obj.type === 'obstacle' ? 40 : 20);
          if (obj.modelUrl === '/CiboTartaruga.glb') objR = 12;
          if (obj.modelUrl === '/TartaBlender.glb') objR = 20;
          if (obj.modelUrl === '/ominoblender.glb') objR = 10;
          if (obj.modelUrl === '/Albero.gltf') objR = 15;
          if (dist < (objR + 25)) {
              if (obj.modelUrl !== '/Albero.gltf') { // Ignore trees for color sensor to avoid false readings
                  color = obj.color || 'gray';
              }
          }
        });
        sensor.value = color;
      }
    });
  }
}

export class SimulationEngine {
    private state: SimulationState;
    private timerInterval: ReturnType<typeof setInterval> | null = null;
    public robotId: string = 'local-robot';
    public onStateUpdate: (state: SimulationState) => void = () => {};

    constructor() {
        this.state = getInitialState('robo-starter-italy');
        if (!activeEngineInstances.includes(this)) {
            activeEngineInstances.push(this);
        }
    }

    public updateAllSensors() {
        const map = this.state.maps[this.state.currentMapId];
        Object.values(this.state.robots).forEach(robot => {
            updateRobotSensors(robot, map, this.state);
        });
        this.emitUpdate();
    }

    public getState(): SimulationState {
        return this.state;
    }

    public setRobotId(id: string) {
        this.robotId = id;
    }

    public registerRobot(name: string, color: string) {
        const robot: RobotState = {
            id: this.robotId,
            name,
            color: color || '#eab308',
            position: { x: 120, y: 1000 },
            rotation: 0,
            width: 150,
            height: 150,
            thickness: 50,
            shape: 'custom',
            customPoints: [
              { x: -187.5, y: 137.5 },
              { x: -187.5, y: -312.5 },
              { x: -137.5, y: -312.5 },
              { x: -137.5, y: -187.5 },
              { x: 137.5, y: -187.5 },
              { x: 137.5, y: -312.5 },
              { x: 187.5, y: -312.5 },
              { x: 187.5, y: 137.5 }
            ],
            isShapeFinalized: true,
            sensors: { distance: 2000, color: 'white' },
            customSensors: [],
            hasLeftStartArea: false,
            hasReturnedToStart: false,
            flashLedCount: 0
        };
        
        const map = this.state.maps[this.state.currentMapId];
        updateRobotSensors(robot, map, this.state);
        
        this.state.robots[this.robotId] = robot;
        this.emitUpdate();
    }

    public addObject(data: any) {
        const objId = data.name.replace(/\s+/g, '-').toLowerCase() + '-' + Date.now();
        this.state.objects[objId] = {
            id: objId,
            type: data.type,
            position: data.position,
            modelUrl: data.modelUrl,
            rotation: 90,
            modelScale: 0.0005,
            radius: 10,
            collisionPoints: [{x: 0, y: -15}, {x: 0, y: 0}, {x: 0, y: 15}],
            color: '#0000ff'
        };
        this.emitUpdate();
    }

    public updateRobotConfig(id: string, data: any) {
        if (this.state.robots[id]) {
            const robot = this.state.robots[id];
            if ('width' in data) robot.width = data.width;
            if ('height' in data) robot.height = data.height;
            if ('thickness' in data) robot.thickness = data.thickness;
            if ('shape' in data) robot.shape = data.shape;
            if ('color' in data) robot.color = data.color;
            if ('customSensors' in data) robot.customSensors = data.customSensors;
            if ('sensors' in data) robot.sensors = data.sensors;
            if ('ledOn' in data) robot.ledOn = data.ledOn;
            if ('customPoints' in data) {
                robot.customPoints = data.customPoints;
                robot.isShapeFinalized = false;
            }
            const map = this.state.maps[this.state.currentMapId];
            updateRobotSensors(robot, map, this.state);
            this.emitUpdate();
        }
    }

    public saveRobotConfig(id: string) {
        if (this.state.robots[id]) {
            this.state.robots[id].isShapeFinalized = true;
            this.emitUpdate();
        }
    }

    public startTimer() {
        if (this.timerInterval) return;
        this.state.status = 'running';
        this.timerInterval = setInterval(() => {
            if (this.state.timeRemaining > 0) {
                this.state.timeRemaining--;
                this.emitUpdate();
            } else {
                this.state.status = 'finished';
                if (this.timerInterval) clearInterval(this.timerInterval);
                this.timerInterval = null;
                this.emitUpdate();
            }
        }, 1000);
    }
    
    public startProgram() {
        this.state.status = 'running';
        this.startTimer();
        this.emitUpdate();
    }
    
    public stopProgram() {
        this.state.status = 'idle';
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
        }
        this.emitUpdate();
    }

    public reset() {
        this.stopProgram();
        const curRobots = this.state.robots;
        this.state = getInitialState(this.state.currentMapId);
        for (const [id, oldR] of Object.entries(curRobots)) {
             this.state.robots[id] = { ...oldR, position: {x: 120, y: 1000}, rotation: 0, hasLeftStartArea: false, hasReturnedToStart: false, flashLedCount: 0 };
             updateRobotSensors(this.state.robots[id], this.state.maps[this.state.currentMapId], this.state);
        }
        this.emitUpdate();
    }
    
    public changeMap(mapId: string) {
        this.stopProgram();
        const curRobots = this.state.robots;
        this.state = getInitialState(mapId);
         for (const [id, oldR] of Object.entries(curRobots)) {
             this.state.robots[id] = { ...oldR, position: {x: 120, y: 1000}, rotation: 0, hasLeftStartArea: false, hasReturnedToStart: false, flashLedCount: 0 };
             updateRobotSensors(this.state.robots[id], this.state.maps[mapId], this.state);
        }
        this.emitUpdate();
    }

    public applyRobotBonus(id: string, bonusType: string) {
        if (bonusType === 'startArea') {
            this.state.startAreaBonus = 30;
        }
        if (bonusType === 'treeBonus') {
            this.state.treeBonus = 15;
        }
        calculateScore(this.state);
        this.emitUpdate();
    }

    public finishSimulation() {
        this.state.status = 'finished';
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
        }
        calculateScore(this.state);
        this.emitUpdate();
    }

    public teleportRobot(id: string, pos: {x: number, y: number}) {
        if (this.state.robots[id]) {
            this.state.robots[id].position = pos;
            this.emitUpdate();
        }
    }

    public resetSingleRobot(id: string) {
        if (this.state.robots[id]) {
            this.state.robots[id].position = { x: 120, y: 1000 };
            this.state.robots[id].rotation = 0;
            this.emitUpdate();
        }
    }

    public moveRobot(id: string, data: any) {
        if (!this.state.robots[id] || this.state.status !== 'running') return;
        
        const robot = this.state.robots[id];
        const oldPosition = { ...robot.position };
        const map = this.state.maps[this.state.currentMapId];
        const extents = getRobotRotatedExtents(robot, data.rotation ?? robot.rotation);
        
        if (map) {
          robot.position.x = Math.max(-extents.minX, Math.min(map.width - extents.maxX, data.x));
          robot.position.y = Math.max(-extents.minY, Math.min(map.height - extents.maxY, data.y));
        } else {
          robot.position.x = data.x;
          robot.position.y = data.y;
        }

        const inStartZone = (p: {x: number, y: number}) => p.x >= 20 && p.x <= 270 && p.y >= 875 && p.y <= 1140;
          
        const wasInStart = inStartZone(oldPosition);
        const nowInStart = inStartZone(robot.position);

        if (wasInStart && !nowInStart) {
          robot.hasLeftStartArea = true;
          robot.hasReturnedToStart = false;
        }

        if (robot.hasLeftStartArea && nowInStart) {
          robot.hasReturnedToStart = true;
        }

        const oldRotation = robot.rotation;
        robot.rotation = data.rotation;
        
        const oldTheta = (oldRotation * Math.PI) / 180;
        const cosT = Math.cos(oldTheta);
        const sinT = Math.sin(oldTheta);
        const newTheta = (robot.rotation * Math.PI) / 180;
        const newCosT = Math.cos(newTheta);
        const newSinT = Math.sin(newTheta);

        for (const objId in this.state.objects) {
          const obj = this.state.objects[objId];
          if (obj.collectedBy) continue;

          const diffX = obj.position.x - oldPosition.x;
          const diffY = obj.position.y - oldPosition.y;

          const locX = diffX * cosT + diffY * sinT;
          const locY = -diffX * sinT + diffY * cosT;

          const inLeftHorn = locX > -10 && locX < 95 && locY >= 50 && locY <= 70;
          const inRightHorn = locX > -10 && locX < 95 && locY >= -70 && locY <= -50;
          if (inLeftHorn || inRightHorn) {
             const deltaTransX = robot.position.x - oldPosition.x;
             const deltaTransY = robot.position.y - oldPosition.y;
             const deltaLocalX = deltaTransX * cosT + deltaTransY * sinT;
             
             if (deltaLocalX > -5 || Math.abs(robot.rotation - oldRotation) > 0.01) {
                const newDiffX = locX * newCosT - locY * newSinT;
                const newDiffY = locX * newSinT + locY * newCosT;
                obj.position.x = robot.position.x + newDiffX;
                obj.position.y = robot.position.y + newDiffY;
                
                if (obj.rotation !== undefined) {
                  obj.rotation += (robot.rotation - oldRotation);
                }
             }
          }
        }
        
        updateRobotSensors(robot, map, this.state);

        for (const objId in this.state.objects) {
          const obj = this.state.objects[objId];
          if (obj.collectedBy) continue;

          let OBJ_RADIUS = obj.radius || (obj.type === 'obstacle' ? 40 : 20);
          if (obj.modelUrl === '/CiboTartaruga.glb') OBJ_RADIUS = 12;
          if (obj.modelUrl === '/TartaBlender.glb') OBJ_RADIUS = 20;
          if (obj.modelUrl === '/ominoblender.glb') OBJ_RADIUS = 10;
          if (obj.modelUrl === '/Albero.gltf') OBJ_RADIUS = 15;
          
          if (obj.collisionPoints && obj.collisionPoints.length > 0) {
            const theta = (obj.rotation || 0) * Math.PI / 180;
            const cosT = Math.cos(theta);
            const sinT = Math.sin(theta);
            
            for (const pt of obj.collisionPoints) {
                const rotatedX = pt.x * cosT - pt.y * sinT;
                const rotatedY = pt.x * sinT + pt.y * cosT;
                const testObj = { position: { x: obj.position.x + rotatedX, y: obj.position.y + rotatedY } };
                const ptCollision = checkRobotObjectCollision(robot, testObj, OBJ_RADIUS);
                if (ptCollision.colliding) {
                     obj.position.x += ptCollision.pushX;
                     obj.position.y += ptCollision.pushY;
                }
            }
          } else {
            const collision = checkRobotObjectCollision(robot, obj, OBJ_RADIUS);
            if (collision.colliding) {
              obj.position.x += collision.pushX;
              obj.position.y += collision.pushY;
            }
          }

          if (map) {
            obj.position.x = Math.max(OBJ_RADIUS, Math.min(map.width - OBJ_RADIUS, obj.position.x));
            obj.position.y = Math.max(OBJ_RADIUS, Math.min(map.height - OBJ_RADIUS, obj.position.y));
          }
        }

        const objIds = Object.keys(this.state.objects);
        for (let iter = 0; iter < 3; iter++) {
          for (let i = 0; i < objIds.length; i++) {
            const objA = this.state.objects[objIds[i]];
            if (objA.collectedBy) continue;
            const radiusA = objA.radius || (objA.type === 'obstacle' ? 40 : 20);

            for (let j = i + 1; j < objIds.length; j++) {
              const objB = this.state.objects[objIds[j]];
              if (objB.collectedBy) continue;
              const radiusB = objB.radius || (objB.type === 'obstacle' ? 40 : 20);

              const dx = objB.position.x - objA.position.x;
              const dy = objB.position.y - objA.position.y;
              const dist = Math.sqrt(dx * dx + dy * dy);
              const minD = radiusA + radiusB;

              if (dist < minD && dist > 0.001) {
                const overlap = minD - dist;
                const pushX = (dx / dist) * (overlap / 2);
                const pushY = (dy / dist) * (overlap / 2);

                objA.position.x -= pushX;
                objA.position.y -= pushY;
                objB.position.x += pushX;
                objB.position.y += pushY;

                if (map) {
                  objA.position.x = Math.max(radiusA, Math.min(map.width - radiusA, objA.position.x));
                  objA.position.y = Math.max(radiusA, Math.min(map.height - radiusA, objA.position.y));
                  objB.position.x = Math.max(radiusB, Math.min(map.width - radiusB, objB.position.x));
                  objB.position.y = Math.max(radiusB, Math.min(map.height - radiusB, objB.position.y));
                }
              }
            }
          }
        }

        for (const oId in this.state.objects) {
          const o = this.state.objects[oId];
          if (oId.startsWith('turtle-food') && o.color === 'yellow' && !o.collectedBy) {
            let oR = o.radius || 20;
            if (o.modelUrl === '/CiboTartaruga.glb') oR = 12;
            if (o.modelUrl === '/TartaBlender.glb') oR = 20;
            if (o.modelUrl === '/ominoblender.glb') oR = 10;
            if (o.modelUrl === '/Albero.gltf') oR = 15;
            
            const pxC = Math.round(o.position.x);
            const pyC = Math.round(o.position.y);
            const inStoreBox = (pxC >= 800 && pxC <= 1880 && pyC >= 1005 && pyC <= 1150);
            let edgeInStore = false;
            
            if (!inStoreBox && pyC < 1005) {
                if (pyC + (oR * 0.2) >= 1005 && pxC >= 800 && pxC <= 1880) edgeInStore = true;
            } else if (!inStoreBox) {
                const pts = [
                  { x: 0, y: 0 }, { x: oR, y: 0 }, { x: -oR, y: 0 }, { x: 0, y: oR }, { x: 0, y: -oR },
                  { x: oR * 0.7, y: oR * 0.7 }, { x: -oR * 0.7, y: oR * 0.7 },
                  { x: oR * 0.7, y: -oR * 0.7 }, { x: -oR * 0.7, y: -oR * 0.7 }
                ];
                for (const pt of pts) {
                    const px = Math.round(o.position.x + pt.x);
                    const py = Math.round(o.position.y + pt.y);
                    if (px >= 800 && px <= 1880 && py >= 1005 && py <= 1150) edgeInStore = true;
                }
            }
            let isInsideNow = inStoreBox || (edgeInStore && pyC !== 1000);
            if (!isInsideNow && o.storedPoints !== undefined) {
               if (pxC >= 780 && pxC <= 1900 && pyC >= 990 && pyC <= 1170) isInsideNow = true;
            }
            
            if (isInsideNow) {
               if (o.storedPoints === undefined) {
                 let anyLedOn = false;
                 for (const rId in this.state.robots) {
                    if (this.state.robots[rId].ledOn) { anyLedOn = true; break; }
                 }
                 o.storedPoints = anyLedOn ? 15 : 10;
               }
            } else {
               o.storedPoints = undefined;
            }
          }
        }
        
        calculateScore(this.state);
        this.emitUpdate();
    }

    private emitUpdate() {
        this.onStateUpdate({ ...this.state });
    }
}
