import React, { useRef } from 'react';
import { SimulationState, RobotState, Position } from './types';
import { Plus, Trash2, Settings, Save, Pencil, Eraser, Image as ImageIcon, X, Layout } from 'lucide-react';

// SVG visualization component
function RobotVisualization({ robot, refImage, color }: { robot: RobotState; refImage?: string; color?: string }) {
  const size = 400; // SVG viewBox size
  const center = size / 2;
  const sc = 0.85; // Magnified scaling factor (increased from 0.3 for a larger preview)
  const w = robot.width * sc;
  const h = robot.height * sc;
  const svgRef = useRef<SVGSVGElement>(null);
  
  const displayColor = color || robot.color;

  const lastPoint = robot.customPoints && robot.customPoints.length > 0 
    ? robot.customPoints[robot.customPoints.length - 1] 
    : null;

  return (
    <div className="relative">
      <svg 
        ref={svgRef}
        width={size} 
        height={size} 
        viewBox={`0 0 ${size} ${size}`} 
        className="bg-slate-950 rounded-lg border border-slate-800 shadow-inner"
      >
        {/* Futuristic Radar/CAD Engineering Grid Guidelines */}
        <circle cx={center} cy={center} r={60} fill="none" stroke="#1e293b" strokeWidth={1} strokeDasharray="3,6" />
        <circle cx={center} cy={center} r={120} fill="none" stroke="#1e293b" strokeWidth={1} strokeDasharray="3,6" />
        <circle cx={center} cy={center} r={180} fill="none" stroke="#1e293b" strokeWidth={1} strokeDasharray="3,6" />
        <line x1={center} y1={10} x2={center} y2={size - 10} stroke="#1e293b" strokeWidth={1} strokeDasharray="4,4" />
        <line x1={10} y1={center} x2={size - 10} y2={center} stroke="#1e293b" strokeWidth={1} strokeDasharray="4,4" />
        
        {/* Reference Image Background */}
        {refImage && (
          <image 
            href={refImage} 
            x={0} 
            y={0} 
            width={size} 
            height={size} 
            preserveAspectRatio="xMidYMid meet" 
            opacity={0.3}
          />
        )}
        
        {/* Main Robot Poly/Circle/Rect Shape */}
        {robot.shape === 'rectangle' ? (
          <rect x={center - w/2} y={center - h/2} width={w} height={h} fill={displayColor} stroke="#475569" strokeWidth={1.5} className="transition-all duration-300" />
        ) : robot.shape === 'circle' ? (
          <circle cx={center} cy={center} r={Math.min(w, h)/2} fill={displayColor} stroke="#475569" strokeWidth={1.5} className="transition-all duration-300" />
        ) : (
          <polygon 
            points={robot.customPoints?.map(p => `${center + p.x * sc},${center + p.y * sc}`).join(' ')}
            fill={displayColor}
            stroke="#475569"
            strokeWidth={2}
            className="transition-all duration-300"
          />
        )}

        {/* Existing Points for custom shape */}
        {robot.shape === 'custom' && robot.customPoints?.map((p, i) => (
          <circle key={i} cx={center + p.x * sc} cy={center + p.y * sc} r={3.5} fill="#38bdf8" stroke="white" strokeWidth={0.5} />
        ))}

        {/* Default Sensors (Distance & Color) Visualizations */}
        {robot.sensors && (() => {
          let frontY = h/2;
          if (robot.shape === 'custom' && robot.customPoints && robot.customPoints.length > 0) {
            frontY = Math.abs(Math.min(...robot.customPoints.map((p: any) => p.y)));
          }
          return (
          <>
            {/* 1. Default Distance Sensor (At Front Top Center) */}
            {robot.sensors.distance != null && (
              <g>
                {/* Visual laser rangefinder beam */}
                <line 
                  x1={center} 
                  y1={center - (frontY + 20) * sc} 
                  x2={center} 
                  y2={center - (frontY + 70) * sc} 
                  stroke="#ef4444" 
                  strokeWidth="2" 
                  strokeDasharray="3,3"
                  className="animate-pulse"
                />
                {/* Sleek industrial housing */}
                <rect 
                  x={center - 18} 
                  y={center - (frontY + 8) * sc} 
                  width={36} 
                  height={14} 
                  rx={3.5} 
                  fill="#1e293b" 
                  stroke="#475569" 
                  strokeWidth={1.5} 
                  className="shadow-lg"
                />
                {/* Sonic transducer rings & dark lenses */}
                <circle cx={center - 8} cy={center - (frontY + 1) * sc} r={4.5} fill="#475569" stroke="#94a3b8" strokeWidth={1} />
                <circle cx={center + 8} cy={center - (frontY + 1) * sc} r={4.5} fill="#475569" stroke="#94a3b8" strokeWidth={1} />
                <circle cx={center - 8} cy={center - (frontY + 1) * sc} r={2} fill="#0f172a" />
                <circle cx={center + 8} cy={center - (frontY + 1) * sc} r={2} fill="#0f172a" />
              </g>
            )}

            {/* 2. Default Color Sensor (Scans Downwards from Robot Center) */}
            {robot.sensors.color != null && (
              <g>
                {/* Glowing fuchsia sensor shield boundary */}
                <circle 
                  cx={center} 
                  cy={center} 
                  r={14} 
                  fill="#d946ef" 
                  stroke="#a21caf" 
                  strokeWidth={1.5} 
                  className="drop-shadow-[0_0_4px_rgba(217,70,239,0.5)]"
                />
                {/* The detected floor surface color display */}
                <circle 
                  cx={center} 
                  cy={center} 
                  r={8} 
                  fill={robot.sensors.color || 'white'} 
                  stroke="#fdf4ff" 
                  strokeWidth={2} 
                />
                {/* Lens specular gloss highlight */}
                <circle 
                  cx={center - 3} 
                  cy={center - 3} 
                  r={2} 
                  fill="white" 
                  opacity={0.85}
                />
              </g>
            )}
          </>
          );
        })()}

        {/* Custom Configured Sensors */}
        {robot.customSensors.map(sensor => (
          <g key={sensor.id}>
             {/* Sensor placement marker */}
             <circle 
               cx={center + sensor.y * sc} 
               cy={center - sensor.x * sc} 
               r={6} 
               fill={sensor.type === 'distance' ? '#3b82f6' : '#10b981'} 
               stroke="white" 
               strokeWidth={1.5} 
               className="shadow-md"
             />
             {sensor.type === 'distance' && (
                <line 
                  x1={center + sensor.y * sc} 
                  y1={center - sensor.x * sc} 
                  x2={center + sensor.y * sc} 
                  y2={center - sensor.x * sc - 30} 
                  stroke="#ef4444" 
                  strokeWidth="1.5" 
                  strokeDasharray="2,2"
                />
             )}
          </g>
        ))}
      </svg>
      {robot.shape === 'custom' && !robot.isShapeFinalized && (
        <div className="absolute top-2 right-2 bg-white/80 px-2 py-1 rounded text-[10px] font-bold text-slate-600 flex items-center shadow-sm pointer-events-none select-none">
          <Pencil size={10} className="mr-1" /> CLICCA PER DISEGNARE (Snap 30°)
        </div>
      )}
    </div>
  );
}

interface RobotEditorViewProps {
  socket: any;
  state: SimulationState;
  onSwitchToSimulation?: () => void;
}

export function RobotEditorView({ socket, state, onSwitchToSimulation }: RobotEditorViewProps) {
  const robots = Object.values(state.robots);
  const [refImages, setRefImages] = React.useState<Record<string, string>>({});

  const handleImageUpload = (id: string, file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      setRefImages(prev => ({ ...prev, [id]: e.target?.result as string }));
    };
    reader.readAsDataURL(file);
  };

  const traceImageShape = async (id: string, imageUrl: string) => {
    return new Promise<void>((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) return resolve();
        
        // Resize for consistent processing
        const maxDim = 300; // Increased
        let w = img.width;
        let h = img.height;
        if (w > h) {
          h = (h / w) * maxDim;
          w = maxDim;
        } else {
          w = (w / h) * maxDim;
          h = maxDim;
        }
        canvas.width = w;
        canvas.height = h;
        ctx.drawImage(img, 0, 0, w, h);
        
        const imgData = ctx.getImageData(0, 0, w, h);
        const data = imgData.data;
        const isSolid = (x: number, y: number) => {
          const ix = Math.floor(x);
          const iy = Math.floor(y);
          if (ix < 0 || ix >= w || iy < 0 || iy >= h) return false;
          const idx = (iy * w + ix) * 4;
          const r = data[idx], g = data[idx+1], b = data[idx+2], a = data[idx+3];
          if (a < 50) return false; // Transparent
          // Use luminance for better thresholding (0.299R + 0.587G + 0.114B)
          const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
          return luminance < 200; // Consider solid if darker than light grey
        };

        // Find center of mass and bounding box to normalize scale
        let sumX = 0, sumY = 0, count = 0;
        let minX = w, maxX = 0, minY = h, maxY = 0;
        for (let y = 0; y < h; y++) {
          for (let x = 0; x < w; x++) {
            if (isSolid(x, y)) {
              sumX += x; sumY += y; count++;
              if (x < minX) minX = x;
              if (x > maxX) maxX = x;
              if (y < minY) minY = y;
              if (y > maxY) maxY = y;
            }
          }
        }
        
        if (count === 0) return resolve();
        const centerX = sumX / count;
        const centerY = sumY / count;

        const actualMaxDim = Math.max(maxX - minX, maxY - minY);
        // Normalize the robot units so it fits nicely in the SVG (viewBox 400x400, scale 0.3)
        const robotScale = 400 / (actualMaxDim || 1); 

        // Radial scan with higher resolution (64 points)
        const points: Position[] = [];
        const steps = 64;
        const maxR = Math.max(w, h);
        
        for (let i = 0; i < steps; i++) {
          const angle = (i / steps) * Math.PI * 2;
          const dx = Math.cos(angle);
          const dy = Math.sin(angle);
          
          let lastR = 0;
          // Scan outwards to find the furthest solid pixel
          for (let r = 0; r < maxR; r += 0.5) {
            if (isSolid(centerX + dx * r, centerY + dy * r)) {
              lastR = r;
            }
          }
          
          if (lastR > 0) {
            points.push({
              x: (dx * lastR) * robotScale,
              y: (dy * lastR) * robotScale
            });
          }
        }

        // Simplify points if needed or just send them
        if (points.length > 3) {
          // Filter points that are essentially the same to reduce complexity
          const simplifiedPoints: Position[] = [];
          for (let i = 0; i < points.length; i++) {
             const p = points[i];
             const nextP = points[(i + 1) % points.length];
             const dist = Math.sqrt(Math.pow(p.x - nextP.x, 2) + Math.pow(p.y - nextP.y, 2));
             if (dist > 2) {
                simplifiedPoints.push(p);
             }
          }

          socket.emit('updateRobotConfig', id, { 
            customPoints: simplifiedPoints.length > 3 ? simplifiedPoints : points,
            shape: 'custom',
            isShapeFinalized: true 
          });
        }
        resolve();
      };
      img.src = imageUrl;
    });
  };

  const removeRefImage = (id: string) => {
    setRefImages(prev => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  };

  return (
    <div className="p-6 h-full overflow-y-auto bg-gray-50">
      
      {robots.length === 0 ? (
        <div className="text-gray-500 italic">No robots connected. Connect a robot to edit its configuration.</div>
      ) : (
        <div className="space-y-6">
          {robots.map((robot) => {
            const activeDistanceCount = (robot.sensors?.distance != null ? 1 : 0) + robot.customSensors.filter(s => s.type === 'distance').length;
            const activeColorCount = (robot.sensors?.color != null ? 1 : 0) + robot.customSensors.filter(s => s.type === 'color').length;
            const totalSensorsCount = activeDistanceCount + activeColorCount;

            return (
              <div key={robot.id} className="bg-slate-800 p-6 rounded-2xl shadow-xl border border-slate-700 text-slate-100">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                  
                  {/* LEFT COLUMN: VISUALIZATION & CONFIG (Size: 7/12) */}
                  <div className="lg:col-span-7 flex flex-col space-y-6">
                    <div className="flex items-center justify-between bg-slate-900/60 p-3 rounded-xl border border-slate-700">
                      <div className="flex items-center gap-3">
                        <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">Colore Robot</span>
                        <input 
                          type="color" 
                          value={robot.color} 
                          onChange={(e) => socket.emit('updateRobotConfig', robot.id, { color: e.target.value })}
                          className="w-10 h-10 rounded-full border border-slate-600 p-0 cursor-pointer shadow-sm overflow-hidden bg-transparent"
                          title="Cambia Colore Robot"
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <button 
                          onClick={() => socket.emit('saveRobotConfig', robot.id)}
                          className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-bold hover:bg-blue-500 transition active:scale-95 shadow-md"
                        >
                          <Save size={16} className="mr-2" /> Salva Config
                        </button>
                        {onSwitchToSimulation && (
                          <button
                            onClick={onSwitchToSimulation}
                            className="flex items-center px-3 py-1.5 rounded-lg bg-slate-600 hover:bg-slate-700 text-white font-bold text-xs transition-colors shadow-sm active:scale-95 animate-fade-in"
                          >
                            <Layout size={14} className="mr-1.5" />
                            3D
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center justify-center bg-slate-900/80 p-4 rounded-xl border border-slate-700/80">
                      <RobotVisualization 
                        key={`${robot.id}-${robot.color}`}
                        robot={robot} 
                        refImage={refImages[robot.id]}
                        color={robot.color}
                      />
                    </div>
                  
                    {/* Image upload section removed */}
                  </div>

                  {/* RIGHT COLUMN: ACTIVE SENSORS LIST (Size: 5/12) */}
                  <div className="lg:col-span-5 flex flex-col space-y-4 border-t lg:border-t-0 lg:border-l border-slate-755 pt-6 lg:pt-0 lg:pl-6 border-slate-700">
                    <div className="flex items-center justify-between border-b pb-3 border-slate-700">
                      <div className="flex flex-col">
                        <h4 className="text-sm font-bold text-slate-100 tracking-tight">Sensori Attivi</h4>
                        <span className="text-[11px] text-slate-400 font-medium">{totalSensorsCount} di 4 sensori configurati</span>
                      </div>
                      {totalSensorsCount > 0 && (
                        <button 
                          onClick={() => socket.emit('updateRobotConfig', robot.id, { sensors: null, customSensors: [] })}
                          className="text-[10px] text-red-400 font-bold hover:underline py-1 px-2 border border-red-900/40 rounded-md hover:bg-red-950/40 transition"
                        >
                          Rimuovi tutti
                        </button>
                      )}
                    </div>
                    
                    {/* Vertical list of sensors, one below the other */}
                    <div className="space-y-3 overflow-y-auto max-h-[460px] pr-1">
                      {/* Default Distance Sensor */}
                      {robot.sensors?.distance != null && (
                        <div className="flex items-center justify-between p-3 bg-blue-950/40 rounded-xl border border-blue-900/50 shadow-sm">
                          <div className="flex flex-col">
                            <span className="text-xs font-extrabold text-blue-300 uppercase tracking-widest">SensoreDistanza 0 (Default)</span>
                          </div>
                          <button 
                            onClick={() => {
                              if (robot.sensors) {
                                const { distance, ...rest } = robot.sensors;
                                socket.emit('updateRobotConfig', robot.id, { sensors: Object.keys(rest).length > 0 ? rest : null });
                              }
                            }}
                            className="p-1.5 text-red-400 hover:bg-red-950/40 rounded-lg transition"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      )}

                      {/* Default Color Sensor */}
                      {robot.sensors?.color != null && (
                        <div className="flex items-center justify-between p-3 bg-slate-900/40 rounded-xl border border-slate-700 shadow-sm">
                          <div className="flex flex-col">
                            <span className="text-xs font-extrabold text-slate-300 uppercase tracking-widest">SensoreColore 0 (Default)</span>
                          </div>
                          <button 
                            onClick={() => {
                              if (robot.sensors) {
                                const { color, ...rest } = robot.sensors;
                                socket.emit('updateRobotConfig', robot.id, { sensors: Object.keys(rest).length > 0 ? rest : null });
                              }
                            }}
                            className="p-1.5 text-red-400 hover:bg-red-950/40 rounded-lg transition"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      )}

                      {/* Custom Sensors */}
                      {robot.customSensors.map((sensor, idx) => {
                        const sameTypeIdx = robot.customSensors.slice(0, idx).filter(s => s.type === sensor.type).length + 1;
                        const isColor = sensor.type === 'color';
                        const label = isColor ? `SensoreColore ${sameTypeIdx}` : `SensoreDistanza ${sameTypeIdx}`;
                        
                        return (
                          <div key={sensor.id} className="flex flex-col p-3 bg-slate-900/40 rounded-xl border border-slate-700 shadow-sm space-y-2">
                            <div className="flex items-center justify-between">
                              <div className="flex flex-col">
                                <span className={`text-xs font-extrabold uppercase tracking-widest ${isColor ? 'text-slate-300' : 'text-blue-300'}`}>{label}</span>
                              </div>
                              <button 
                                onClick={() => {
                                  const newSensors = robot.customSensors.filter(s => s.id !== sensor.id);
                                  socket.emit('updateRobotConfig', robot.id, { customSensors: newSensors });
                                }}
                                className="p-1.5 text-red-400 hover:bg-red-950/40 rounded-lg transition"
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                            
                            <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-700/60">
                              <div className="flex items-center space-x-2">
                                <label className="text-[10px] text-slate-400 font-bold">X (mm):</label>
                                <input 
                                  type="number" 
                                  value={sensor.x}
                                  onChange={(e) => {
                                    const newSensors = robot.customSensors.map(s => 
                                      s.id === sensor.id ? { ...s, x: Number(e.target.value) } : s
                                    );
                                    socket.emit('updateRobotConfig', robot.id, { customSensors: newSensors });
                                  }}
                                  className="w-full text-xs p-1 bg-slate-800 border border-slate-700 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono text-slate-100"
                                />
                              </div>
                              <div className="flex items-center space-x-2">
                                <label className="text-[10px] text-slate-400 font-bold">Y (mm):</label>
                                <input 
                                  type="number" 
                                  value={sensor.y}
                                  onChange={(e) => {
                                    const newSensors = robot.customSensors.map(s => 
                                      s.id === sensor.id ? { ...s, y: Number(e.target.value) } : s
                                    );
                                    socket.emit('updateRobotConfig', robot.id, { customSensors: newSensors });
                                  }}
                                  className="w-full text-xs p-1 bg-slate-800 border border-slate-700 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono text-slate-100"
                                />
                              </div>
                            </div>
                          </div>
                        );
                      })}

                      {totalSensorsCount === 0 && (
                        <div className="text-xs text-slate-400 italic py-6 text-center border-2 border-dashed border-slate-700 rounded-xl bg-slate-900/20">
                          Nessun sensore configurato
                        </div>
                      )}
                    </div>

                    {/* Add Sensor Controls */}
                    <div className="space-y-3 pt-4 border-t border-slate-700 mt-auto">
                      <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest">Aggiungi Nuovo Sensore</div>
                      <div className="grid grid-cols-2 gap-2">
                        {/* Default Distance Button or Custom Distance Button */}
                        {robot.sensors?.distance == null ? (
                          <button 
                            disabled={totalSensorsCount >= 4 || activeDistanceCount >= 1}
                            onClick={() => socket.emit('updateRobotConfig', robot.id, { sensors: { ...robot.sensors, distance: 0 } })}
                            className={`flex items-center justify-center text-xs px-3 py-2.5 rounded-xl font-bold transition duration-200 ${
                              totalSensorsCount >= 4 || activeDistanceCount >= 1
                              ? 'bg-slate-900/40 text-slate-600 cursor-not-allowed border border-slate-800'
                              : 'bg-blue-950/60 text-blue-300 hover:bg-blue-900/60 border border-blue-900/50 active:scale-95'
                            }`}
                          >
                            <Plus size={14} className="mr-1" /> Distanza Default
                          </button>
                        ) : (
                          <button 
                            disabled={totalSensorsCount >= 4 || activeDistanceCount >= 1}
                            onClick={() => {
                              const newSensor = {
                                id: Math.random().toString(36).substr(2, 9),
                                type: 'distance' as const,
                                x: 0,
                                y: 0
                              };
                              socket.emit('updateRobotConfig', robot.id, { customSensors: [...robot.customSensors, newSensor] });
                            }}
                            className={`flex items-center justify-center text-xs px-3 py-2.5 rounded-xl font-bold transition duration-200 ${
                              totalSensorsCount >= 4 || activeDistanceCount >= 1
                              ? 'bg-slate-900/40 text-slate-600 cursor-not-allowed border border-slate-800'
                              : 'bg-blue-950/60 text-blue-300 hover:bg-blue-900/60 border border-blue-900/50 active:scale-95'
                            }`}
                          >
                            <Plus size={14} className="mr-1" /> Distanza
                          </button>
                        )}

                        {/* Default Color Button or Custom Color Button */}
                        {robot.sensors?.color == null ? (
                          <button 
                            disabled={totalSensorsCount >= 4 || activeColorCount >= 3}
                            onClick={() => socket.emit('updateRobotConfig', robot.id, { sensors: { ...robot.sensors, color: 'white' } })}
                            className={`flex items-center justify-center text-xs px-3 py-2.5 rounded-xl font-bold transition duration-200 ${
                              totalSensorsCount >= 4 || activeColorCount >= 3
                              ? 'bg-slate-900/40 text-slate-600 cursor-not-allowed border border-slate-800'
                              : 'bg-slate-900/60 text-slate-300 hover:bg-slate-800 border border-slate-700 active:scale-95'
                            }`}
                          >
                            <Plus size={14} className="mr-1" /> Colore Default
                          </button>
                        ) : (
                          <button 
                            disabled={totalSensorsCount >= 4 || activeColorCount >= 3}
                            onClick={() => {
                              const newSensor = {
                                id: Math.random().toString(36).substr(2, 9),
                                type: 'color' as const,
                                x: 0,
                                y: 0
                              };
                              socket.emit('updateRobotConfig', robot.id, { customSensors: [...robot.customSensors, newSensor] });
                            }}
                            className={`flex items-center justify-center text-xs px-3 py-2.5 rounded-xl font-bold transition duration-200 ${
                              totalSensorsCount >= 4 || activeColorCount >= 3
                              ? 'bg-slate-900/40 text-slate-600 cursor-not-allowed border border-slate-800'
                              : 'bg-slate-900/60 text-slate-300 hover:bg-slate-800 border border-slate-700 active:scale-95'
                            }`}
                          >
                            <Plus size={14} className="mr-1" /> Colore
                          </button>
                        )}
                      </div>

                      {/* Info / feedback text when limits are hit */}
                      {totalSensorsCount >= 4 && (
                        <p className="text-[10px] text-amber-500 font-medium text-center">Limite massimo di 4 sensori attivi raggiunto</p>
                      )}
                      {totalSensorsCount < 4 && activeDistanceCount >= 1 && (
                        <p className="text-[10px] text-slate-400 text-center">Massimo 1 sensore di distanza ammesso</p>
                      )}
                      {totalSensorsCount < 4 && activeColorCount >= 3 && (
                        <p className="text-[10px] text-slate-400 text-center">Massimo 3 sensori di colore ammessi</p>
                      )}
                    </div>

                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
