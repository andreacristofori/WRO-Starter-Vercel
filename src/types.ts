export interface Position {
  x: number;
  y: number;
}

export interface Sensor {
  id: string;
  type: 'distance' | 'color' | 'touch';
  x: number; // Offset from center
  y: number; // Offset from center
  value?: any; // Sensor reading
}

export interface RobotState {
  id: string;
  name: string;
  color: string;
  position: Position;
  rotation: number; // In degrees
  width: number;
  height: number;
  thickness: number;
  shape: 'rectangle' | 'circle' | 'custom';
  customPoints?: Position[];
  isShapeFinalized?: boolean;
  sensors?: {
    distance?: number; // Front ultrasonic sensor distance in mm
    color?: string; // Downward color sensor (hex or name)
  };
  customSensors: Sensor[];
  ledOn?: boolean;
  hasLeftStartArea?: boolean;
  hasReturnedToStart?: boolean;
  flashLedCount?: number;
}

export interface FieldObject {
  id: string;
  type: 'obstacle' | 'collectible' | 'target';
  position: Position;
  color?: string;
  modelUrl?: string;
  modelScale?: number;
  rotation?: number;
  radius?: number;
  width?: number;
  height?: number;
  collisionPoints?: Position[];
  collectedBy?: string; // Robot ID if collected
  droppedWithLed?: boolean;
  storedPoints?: number;
}

export interface StartZone {
  position: Position;
  width: number;
  height: number;
}

export interface MapConfig {
  id: string;
  name: string;
  imageUrl?: string;
  width: number;
  height: number;
  startZones: StartZone[];
  initialObjects: Record<string, FieldObject>;
  timerDuration?: number;
}

export interface SimulationState {
  currentMapId: string;
  maps: Record<string, MapConfig>;
  robots: Record<string, RobotState>;
  objects: Record<string, FieldObject>;
  status: 'idle' | 'running' | 'finished';
  timeRemaining: number;
  score: number;
  startAreaBonus?: number;
  treeBonus?: number;
  scoreBreakdown?: string[];
}

export interface ServerToClientEvents {
  stateUpdate: (state: SimulationState) => void;
  robotConnected: (robot: RobotState) => void;
  robotDisconnected: (id: string) => void;
  simulationStarted: () => void;
  simulationStopped: () => void;
  simulationFinished: () => void;
}

export interface ClientToServerEvents {
  // Client UI commands
  startSimulation: () => void;
  stopSimulation: () => void;
  finishSimulation: () => void;
  resetSimulation: () => void;
  changeMap: (mapId: string) => void;
  updateMapImage: (mapId: string, imageUrl: string) => void;
  
  // Robot API commands
  registerRobot: (data: { name: string; color: string }, callback: (res: { id: string }) => void) => void;
  moveRobot: (id: string, data: { x: number; y: number; rotation: number, ctrlPressed?: boolean }) => void;
  teleportRobot: (id: string, data: { x: number; y: number }) => void;
  resetSingleRobot: (id: string) => void;
  interactObject: (robotId: string, objectId: string, action: 'collect' | 'drop') => void;
  updateRobotConfig: (id: string, data: { color?: string; width?: number; height?: number; thickness?: number; shape?: 'rectangle' | 'circle' | 'custom'; customPoints?: Position[]; isShapeFinalized?: boolean; sensors?: any; customSensors?: any; ledOn?: boolean }) => void;
  saveRobotConfig: (id: string) => void;
  addObject: (data: { type: 'obstacle' | 'collectible' | 'target', modelUrl: string, position: Position, name: string }) => void;
}
