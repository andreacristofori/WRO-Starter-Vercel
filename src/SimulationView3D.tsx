import React, { useMemo, Suspense, useState, useEffect } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls, useTexture, Html, Text } from '@react-three/drei';
import * as THREE from 'three';
import { SimulationState } from './types';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { Grid, Eye, Activity } from 'lucide-react';

function resolveColor(c?: string): string | undefined {
  if (!c) return c;
  if (c === 'green') return '#4ade80'; // Un verde più chiaro e moderno (Tailwind green-400)
  return c;
}

function SafeGLTFModel({ url, color, scale, objHeight, objId, radius }: { 
  url: string; 
  color?: string; 
  scale: number; 
  objHeight: number; 
  objId: string; 
  radius: number; 
}) {
  const [scene, setScene] = useState<THREE.Group | null>(null);
  const [error, setError] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [modelCenter, setModelCenter] = useState<THREE.Vector3>(new THREE.Vector3());

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(false);
    setScene(null);

    const loader = new GLTFLoader();
    loader.load(
      url,
      (gltf) => {
        if (!active) return;
        try {
          const clonedScene = gltf.scene.clone();
          const isAlbero = objId.toLowerCase().includes('albero');

          if (isAlbero) {
            const meshes: { mesh: THREE.Mesh; centerY: number }[] = [];
            clonedScene.traverse((child) => {
              if ((child as THREE.Mesh).isMesh) {
                const mesh = child as THREE.Mesh;
                mesh.geometry.computeBoundingBox();
                const bbox = mesh.geometry.boundingBox;
                if (bbox) {
                  const centerY = (bbox.min.y + bbox.max.y) / 2;
                  meshes.push({ mesh, centerY });
                }
              }
            });

            // Estraggo le coordinate Y centrali ordinate in modo ascendente per raggruppare i livelli
            const uniqueY = Array.from(
              new Set(meshes.map(m => Math.round(m.centerY * 10000) / 10000))
            ).sort((a, b) => a - b);

            meshes.forEach(({ mesh, centerY }) => {
              mesh.castShadow = true;
              mesh.receiveShadow = true;

              const roundedY = Math.round(centerY * 10000) / 10000;
              const levelIndex = uniqueY.indexOf(roundedY);

              // "il livello inferiore (levelIndex 0) e altri 2 livelli sopra esso (levelIndex 1 e 2) sono neri"
              let finalColor = color || '#4ade80';
              if (levelIndex >= 0 && levelIndex <= 2) {
                finalColor = '#000000'; // Nero
              } else {
                finalColor = '#4ade80'; // Verde
              }

              if (Array.isArray(mesh.material)) {
                mesh.material = mesh.material.map(m => {
                  const mc = m.clone();
                  if ('color' in mc) (mc as any).color.set(finalColor);
                  return mc;
                });
              } else if (mesh.material) {
                mesh.material = (mesh.material as THREE.Material).clone();
                if ('color' in mesh.material) {
                  (mesh.material as any).color.set(finalColor);
                }
              }
            });
          } else {
            clonedScene.traverse((child) => {
              if ((child as THREE.Mesh).isMesh) {
                const mesh = child as THREE.Mesh;
                mesh.castShadow = true;
                mesh.receiveShadow = true;

                if (color) {
                  const nameLower = mesh.name.toLowerCase();
                  const matLower = mesh.material && "name" in (mesh.material as any) ? ((mesh.material as any).name || "").toLowerCase() : "";
                  
                  const isToro = nameLower.includes('toro') || nameLower.includes('bull') || 
                                 matLower.includes('toro') || matLower.includes('bull');
                                 
                  let isBlack = false;
                  if (mesh.material && 'color' in (mesh.material as any)) {
                    const matColor = (mesh.material as any).color as THREE.Color;
                    if (matColor && matColor.r < 0.2 && matColor.g < 0.2 && matColor.b < 0.2) {
                      isBlack = true;
                    }
                  }

                  if (!isToro && !isBlack) {
                    if (Array.isArray(mesh.material)) {
                      mesh.material = mesh.material.map(m => {
                        const mc = m.clone();
                        if ('color' in mc) (mc as any).color.set(color);
                        return mc;
                      });
                    } else if (mesh.material) {
                      mesh.material = (mesh.material as THREE.Material).clone();
                      if ('color' in mesh.material) {
                        (mesh.material as any).color.set(color);
                      }
                    }
                  }
                }
              }
            });
          }

          const bbox = new THREE.Box3().setFromObject(clonedScene);
          const centerOfModel = new THREE.Vector3();
          bbox.getCenter(centerOfModel);
          setModelCenter(centerOfModel);

          setScene(clonedScene);
          setLoading(false);
        } catch (e) {
          console.error("Error configuration with GLTF model:", e);
          setError(true);
          setLoading(false);
        }
      },
      undefined,
      (err) => {
        if (!active) return;
        console.warn("La risorsa 3D non è stata caricata correttamente, uso il fallback 3D:", url, err);
        setError(true);
        setLoading(false);
      }
    );

    return () => {
      active = false;
    };
  }, [url, color, objId]);

  const isAlbero = objId.toLowerCase().includes('albero');

  if (error || loading || !scene) {
    return isAlbero ? (
      <TreeFallback height={objHeight} />
    ) : (
      <mesh castShadow receiveShadow>
        <boxGeometry args={[radius * 2, objHeight, radius * 2]} />
        <meshStandardMaterial color={color || '#888'} />
      </mesh>
    );
  }

  const isCenteredModel = url === '/CiboTartaruga.glb' || url === '/TartaBlender.glb' || url === '/ominoblender.glb' || url === '/Albero.gltf';

  return (
    <group scale={[scale, scale, scale]} position={[0, -objHeight / 2, 0]}>
      <primitive object={scene} position={isCenteredModel ? [-modelCenter.x, 0, -modelCenter.z] : [0, 0, 0]} />
    </group>
  );
}

function RobotGLTFModel({ 
  url, 
  color, 
  width, 
  depth, 
  height 
}: { 
  url: string; 
  color?: string; 
  width: number; 
  depth: number; 
  height: number; 
}) {
  const [scene, setScene] = useState<THREE.Group | null>(null);
  const [error, setError] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [modelCenter, setModelCenter] = useState<THREE.Vector3>(new THREE.Vector3());
  const [modelSize, setModelSize] = useState<THREE.Vector3>(new THREE.Vector3(1, 1, 1));

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(false);
    setScene(null);

    const loader = new GLTFLoader();
    loader.load(
      url,
      (gltf) => {
        if (!active) return;
        try {
          const clonedScene = gltf.scene.clone();

          clonedScene.traverse((child) => {
            if ((child as THREE.Mesh).isMesh) {
              const mesh = child as THREE.Mesh;
              mesh.castShadow = true;
              mesh.receiveShadow = true;

              // Color all parts of the robot with the custom selected color
              if (color) {
                if (Array.isArray(mesh.material)) {
                  mesh.material = mesh.material.map(m => {
                    const mc = m.clone();
                    if ('color' in mc) (mc as any).color.set(color);
                    return mc;
                  });
                } else if (mesh.material) {
                  mesh.material = (mesh.material as THREE.Material).clone();
                  if ('color' in mesh.material) {
                    (mesh.material as any).color.set(color);
                  }
                }
              }
            }
          });

          const bbox = new THREE.Box3().setFromObject(clonedScene);
          const centerOfModel = new THREE.Vector3();
          bbox.getCenter(centerOfModel);

          const sizeOfModel = new THREE.Vector3();
          bbox.getSize(sizeOfModel);

          setModelCenter(centerOfModel);
          setModelSize(sizeOfModel);
          setScene(clonedScene);
          setLoading(false);
        } catch (e) {
          console.error("Error configuration with robot GLTF model:", e);
          setError(true);
          setLoading(false);
        }
      },
      undefined,
      (err) => {
        if (!active) return;
        console.warn("Could not load robot GLB, falling back:", url, err);
        setError(true);
        setLoading(false);
      }
    );

    return () => {
      active = false;
    };
  }, [url, color]);

  if (error || loading || !scene) {
    return (
      <mesh castShadow receiveShadow>
        <boxGeometry args={[width, height, depth]} />
        <meshStandardMaterial color={color || '#ff0000'} />
      </mesh>
    );
  }

  const scaleX = modelSize.x > 0 ? (width / modelSize.x) : 1;
  const scaleY = modelSize.y > 0 ? (height / modelSize.y) : 1;
  const scaleZ = modelSize.z > 0 ? (depth / modelSize.z) : 1;

  return (
    <group scale={[scaleX, scaleY, scaleZ]}>
      <primitive object={scene} position={[-modelCenter.x, -modelCenter.y, -modelCenter.z]} />
    </group>
  );
}

function TreeFallback({ height }: { height: number }) {
  return (
    <group position={[0, -height / 2, 0]}>
      {/* Trunk */}
      <mesh castShadow receiveShadow position={[0, 0.1, 0]}>
        <cylinderGeometry args={[0.012, 0.016, 0.2, 8]} />
        <meshStandardMaterial color="#78350f" roughness={0.9} />
      </mesh>
      {/* Foliage */}
      <mesh castShadow receiveShadow position={[0, 0.25, 0]}>
        <coneGeometry args={[0.07, 0.2, 8]} />
        <meshStandardMaterial color="#166534" roughness={0.8} />
      </mesh>
      <mesh castShadow receiveShadow position={[0, 0.33, 0]}>
        <coneGeometry args={[0.05, 0.15, 8]} />
        <meshStandardMaterial color="#15803d" roughness={0.8} />
      </mesh>
    </group>
  );
}

function MatImage({ url, width, height, onClick }: { url: string, width: number, height: number, onClick?: (e: any) => void }) {
  const [texture, setTexture] = useState<THREE.Texture | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!url) {
      setError(true);
      return;
    }
    const loader = new THREE.TextureLoader();
    loader.load(
      url,
      (tex) => {
        tex.colorSpace = THREE.SRGBColorSpace;
        setTexture(tex);
        setError(false);
      },
      undefined,
      (err) => {
        console.error("Error loading texture:", url, err);
        setError(true);
      }
    );
  }, [url]);

  if (error || !texture) {
    return <Ground width={width} height={height} onClick={onClick} />;
  }

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[width/2, 0, height/2]} receiveShadow onClick={onClick}>
      <planeGeometry args={[width, height]} />
      <meshStandardMaterial map={texture} />
    </mesh>
  );
}

function Ground({ width, height, onClick }: { width: number, height: number, onClick?: (e: any) => void }) {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[width/2, -0.01, height/2]} receiveShadow onClick={onClick}>
      <planeGeometry args={[width, height]} />
      <meshStandardMaterial color="#333" />
    </mesh>
  );
}

function PerimeterWalls({ width, height }: { width: number, height: number }) {
  const wallHeight = 0.05; // 5 cm
  const thickness = 0.02;  // 2 cm wall thickness

  return (
    <group>
      {/* Top wall */}
      <mesh position={[width / 2, wallHeight / 2, -thickness / 2]} castShadow receiveShadow>
        <boxGeometry args={[width + thickness * 2, wallHeight, thickness]} />
        <meshStandardMaterial color="#1f2937" />
      </mesh>
      
      {/* Bottom wall */}
      <mesh position={[width / 2, wallHeight / 2, height + thickness / 2]} castShadow receiveShadow>
        <boxGeometry args={[width + thickness * 2, wallHeight, thickness]} />
        <meshStandardMaterial color="#1f2937" />
      </mesh>

      {/* Left wall */}
      <mesh position={[-thickness / 2, wallHeight / 2, height / 2]} castShadow receiveShadow>
        <boxGeometry args={[thickness, wallHeight, height]} />
        <meshStandardMaterial color="#1f2937" />
      </mesh>

      {/* Right wall */}
      <mesh position={[width + thickness / 2, wallHeight / 2, height / 2]} castShadow receiveShadow>
        <boxGeometry args={[thickness, wallHeight, height]} />
        <meshStandardMaterial color="#1f2937" />
      </mesh>
    </group>
  );
}

function CameraController({ mapWidth, mapHeight, keySeed }: { mapWidth: number, mapHeight: number, keySeed: number }) {
  const { camera, size } = useThree();

  useEffect(() => {
    const persCamera = camera as THREE.PerspectiveCamera;
    if (!persCamera || !persCamera.fov) return;

    const fovRad = persCamera.fov * Math.PI / 180;
    
    // Vertical distance to fit the full map height plus bounds safely
    const distY = (mapHeight / 2) / Math.tan(fovRad / 2);

    // Horizontal distance to fit the full map width based on dynamic horizontal FOV
    const aspect = size.width / size.height;
    const distX = (mapWidth / 2) / (Math.tan(fovRad / 2) * aspect);

    // The maximum of distX and distY ensures both dimensions fit fully in the viewport.
    // We add a tiny 5% buffer (1.05 multiplier) so the boundary and walls are comfortably visible.
    const optimalDistance = Math.max(distX, distY) * 1.05;

    // Set camera position perfectly centered above the field
    camera.position.set(mapWidth / 2, optimalDistance, mapHeight / 2 + 0.001);
    camera.lookAt(mapWidth / 2, 0, mapHeight / 2);
    camera.updateProjectionMatrix();
  }, [mapWidth, mapHeight, size.width, size.height, camera, keySeed]);

  return null;
}

export function SimulationView3D({ state, socket, robotId }: { state: SimulationState, socket?: any, robotId?: string }) {
  const [showGrid, setShowGrid] = useState(false);
  const [showPhysics, setShowPhysics] = useState(false);
  const [keySeed, setKeySeed] = useState(0);
  const currentMap = state.maps[state.currentMapId];
  // scale mm to meters (1 unit = 1 meter)
  const scale = 0.001;
  const mapWidth = currentMap.width * scale;
  const mapHeight = currentMap.height * scale;

  const maxDim = Math.max(mapWidth, mapHeight);
  const cameraHeight = maxDim * 1.35;



  const handleFieldClick = (e: any) => {
    if (state.status !== 'idle' || !socket || !robotId) return;
    
    // Stop propagation to prevent multiple clicks if meshes overlap
    e.stopPropagation();
    
    const x = e.point.x / scale;
    const y = e.point.z / scale;
    
    socket.emit('teleportRobot', robotId, { x, y });
  };

  const currentRobot = robotId ? state.robots[robotId] : null;

  return (
    <div className="w-full h-full relative">
      <Canvas 
        key={`${state.currentMapId}-${mapWidth}-${mapHeight}-${keySeed}`}
        shadows 
        camera={{ position: [mapWidth / 2, cameraHeight, mapHeight / 2 + 0.001], fov: 41 }}
        style={{ background: '#111827' }}
      >
        <CameraController mapWidth={mapWidth} mapHeight={mapHeight} keySeed={keySeed} />
        <ambientLight intensity={0.8} />
      <directionalLight 
        position={[mapWidth * 0.55, 10, mapHeight * 0.55]} 
        intensity={1.8} 
        castShadow 
        shadow-mapSize={[2048, 2048]} 
        shadow-camera-left={-2}
        shadow-camera-right={mapWidth + 2}
        shadow-camera-top={mapHeight + 2}
        shadow-camera-bottom={-2}
      />
      
      {/* Perimeter Walls */}
      <PerimeterWalls width={mapWidth} height={mapHeight} />

      <Suspense fallback={<Ground width={mapWidth} height={mapHeight} onClick={handleFieldClick} />}>
        {currentMap.imageUrl ? (
          <MatImage url={currentMap.imageUrl} width={mapWidth} height={mapHeight} onClick={handleFieldClick} />
        ) : (
          <Ground width={mapWidth} height={mapHeight} onClick={handleFieldClick} />
        )}
      </Suspense>

      {/* Building Area Highlight (Zona Edificio) - Disabled */}
      {/* State currentMapId was previously here */}

      {/* Origin helpers */}
      <axesHelper args={[1]} position={[0, 0.01, 0]} />
      {showGrid && <gridHelper args={[5, 50]} position={[2.5, 0.005, 2.5]} />}







      {/* Objects */}
      {Object.values(state.objects).map(obj => {
        if (obj.collectedBy) return null;
        let radius = obj.radius !== undefined ? obj.radius * scale : (obj.type === 'obstacle' ? 0.04 : 0.02);
        if (obj.modelUrl === '/CiboTartaruga.glb') radius = 12 * scale;
        if (obj.modelUrl === '/TartaBlender.glb') radius = 20 * scale;
        if (obj.modelUrl === '/ominoblender.glb') radius = 10 * scale;
        if (obj.modelUrl === '/Albero.gltf') radius = 15 * scale;
        const objHeight = obj.type === 'obstacle' ? 0.08 : 0.04;
        
        return (
          <group 
            key={obj.id} 
            position={[obj.position.x * scale, objHeight / 2, obj.position.y * scale]}
            rotation={[0, obj.rotation ? (obj.rotation * Math.PI / 180) : 0, 0]}
          >
            {obj.modelUrl ? (
              <SafeGLTFModel
                url={obj.modelUrl}
                color={resolveColor(obj.color)}
                scale={obj.modelScale || scale}
                objHeight={objHeight}
                objId={obj.id}
                radius={radius}
              />
            ) : (
              <mesh castShadow receiveShadow>
                {obj.type === 'obstacle' ? (
                  <boxGeometry args={[radius * 2, objHeight, radius * 2]} />
                ) : (
                  <cylinderGeometry args={[radius, radius, objHeight, 16]} />
                )}
                <meshStandardMaterial color={resolveColor(obj.color) || '#fff'} />
              </mesh>
            )}
            {/* Physics debug */}
            {showPhysics && (
              <group>
                {obj.collisionPoints && obj.collisionPoints.length > 0 ? (
                  obj.collisionPoints.map((pt, i) => (
                    <mesh key={i} position={[pt.x * scale, -objHeight / 2 + 0.01, pt.y * scale]}>
                      <cylinderGeometry args={[radius + 10 * scale, radius + 10 * scale, 0.02, 32]} />
                      <meshBasicMaterial color="magenta" wireframe transparent opacity={0.8} />
                    </mesh>
                  ))
                ) : (
                  <mesh position={[0, -objHeight / 2 + 0.01, 0]}>
                    {obj.type === 'obstacle' ? (
                      <boxGeometry args={[radius * 2 + 10 * scale * 2, 0.02, radius * 2 + 10 * scale * 2]} />
                    ) : (
                      <cylinderGeometry args={[radius + 10 * scale, radius + 10 * scale, 0.02, 32]} />
                    )}
                    <meshBasicMaterial color="magenta" wireframe transparent opacity={0.8} />
                  </mesh>
                )}
              </group>
            )}
          </group>
        );
      })}

      {/* Robots */}
      {Object.values(state.robots).map(robot => {
        const w = robot.width * scale;
        const h = robot.height * scale;
        const visualHeight = (robot.thickness || 100) * scale;
        const wheelRadius = 0.03;
        const wheelThickness = 0.02;

        const bounds = (() => {
          const s = scale / 2.5;
          if (robot.shape === 'custom' && robot.customPoints && robot.customPoints.length > 0) {
            let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
            robot.customPoints.forEach(p => {
              const px = p.x * s;
              const py = p.y * s;
              if (px < minX) minX = px;
              if (px > maxX) maxX = px;
              if (py < minY) minY = py;
              if (py > maxY) maxY = py;
            });
            const midX = (minX + maxX) / 2;
            const midY = (minY + maxY) / 2;
            return { 
              minX: minX - midX, 
              maxX: maxX - midX, 
              minY: minY - midY, 
              maxY: maxY - midY, 
              width: maxX - minX, 
              depth: maxY - minY,
              originalMidX: midX,
              originalMidY: midY
            };
          }
          const radius = robot.shape === 'circle' ? Math.min(w, h) / 2 : 0;
          const actualW = robot.shape === 'circle' ? radius * 2 : w;
          const actualH = robot.shape === 'circle' ? radius * 2 : h;
          return { minX: -actualW/2, maxX: actualW/2, minY: -actualH/2, maxY: actualH/2, width: actualW, depth: actualH, originalMidX: 0, originalMidY: 0 };
        })();

        const customShape = (() => {
          if (robot.shape !== 'custom' || !robot.customPoints || robot.customPoints.length < 3) return null;
          const shape = new THREE.Shape();
          const s = scale / 2.5;
          const midX = 0;
          const midY = 0;
          
          shape.moveTo(robot.customPoints[0].x * s - midX, robot.customPoints[0].y * s - midY);
          for (let i = 1; i < robot.customPoints.length; i++) {
            shape.lineTo(robot.customPoints[i].x * s - midX, robot.customPoints[i].y * s - midY);
          }
          shape.closePath();
          return shape;
        })();
        
        return (
          <group 
            key={robot.id} 
            position={[robot.position.x * scale, visualHeight / 2, robot.position.y * scale]}
            rotation={[0, -robot.rotation * Math.PI / 180, 0]} 
          >
            {/* Base Group to align "Forward" with Positive X axis */}
            <group rotation={[0, Math.PI / 2, 0]}>
              {/* Robot Body */}
              <RobotGLTFModel 
                url="/robotblender.glb" 
                color={robot.color} 
                width={bounds.width} 
                depth={bounds.depth} 
                height={visualHeight} 
              />
              
              {/* Physics Hitboxes */}
              {showPhysics && (
                 <group>
                    {/* Catch area (Robots): split into left and right horns */}
                    {/* Left Horn Catch Area: locX -10 to +95, locY +50 to +70 */}
                    <mesh position={[60 * scale, -visualHeight/2 + 0.05, 42.5 * scale]}>
                      <boxGeometry args={[20 * scale, 0.05, 105 * scale]} />
                      <meshBasicMaterial color="#00ff00" wireframe transparent opacity={0.6} />
                    </mesh>
                    {/* Right Horn Catch Area: locX -10 to +95, locY -70 to -50 */}
                    <mesh position={[-60 * scale, -visualHeight/2 + 0.05, 42.5 * scale]}>
                      <boxGeometry args={[20 * scale, 0.05, 105 * scale]} />
                      <meshBasicMaterial color="#00ff00" wireframe transparent opacity={0.6} />
                    </mesh>

                    {/* Robot solid bounds (approximate fallback) */}
                    <mesh position={[0, -visualHeight/2 + 0.03, 0]}>
                      <boxGeometry args={[bounds.depth, 0.03, bounds.width]} />
                      <meshBasicMaterial color="red" wireframe transparent opacity={0.4} />
                    </mesh>
                 </group>
              )}

              {/* Wheels */}
              <group position={[bounds.minX - wheelThickness/2, -visualHeight/2 + wheelRadius, -0.03]} rotation={[0, 0, Math.PI / 2]}>
                {/* Tire/Rubber */}
                <mesh>
                  <cylinderGeometry args={[wheelRadius, wheelRadius, wheelThickness, 32]} />
                  <meshStandardMaterial color="white" />
                </mesh>
                {/* Rim */}
                <mesh>
                  <cylinderGeometry args={[wheelRadius - 0.005, wheelRadius - 0.005, wheelThickness + 0.001, 32]} />
                  <meshStandardMaterial color="#87ceeb" />
                </mesh>
              </group>
              
              <group position={[bounds.maxX + wheelThickness/2, -visualHeight/2 + wheelRadius, -0.03]} rotation={[0, 0, Math.PI / 2]}>
                {/* Tire/Rubber */}
                <mesh>
                  <cylinderGeometry args={[wheelRadius, wheelRadius, wheelThickness, 32]} />
                  <meshStandardMaterial color="white" />
                </mesh>
                {/* Rim */}
                <mesh>
                  <cylinderGeometry args={[wheelRadius - 0.005, wheelRadius - 0.005, wheelThickness + 0.001, 32]} />
                  <meshStandardMaterial color="#87ceeb" />
                </mesh>
              </group>

              {/* Custom Sensors Visualization */}
              {robot.customSensors?.map((sensor, idx) => {
                const sX = -sensor.y * scale; // Perpendicular (Right -> -Left)
                const sY = sensor.x * scale;  // Longitudinal (Forward -> Z)
                
                if (sensor.type === 'distance') {
                  const beamLen = (sensor.value || 0) * scale;
                  const sameTypeIdx = robot.customSensors.slice(0, idx).filter(s => s.type === sensor.type).length + 1;
                  const label = `Dist ${sameTypeIdx}`;
                  return (
                    <group 
                      key={sensor.id} 
                      position={[sX, visualHeight / 2 + 0.01, sY]}
                    >
                      {/* Sensor Housing */}
                      <mesh castShadow receiveShadow>
                        <boxGeometry args={[0.04, 0.02, 0.015]} />
                        <meshStandardMaterial color="#334155" />
                      </mesh>
                      <Html distanceFactor={0.5} position={[0, 0.03, 0]}>
                        <div className="bg-slate-800/80 text-white text-[8px] px-1 py-0.5 rounded backdrop-blur-sm whitespace-nowrap pointer-events-none">
                          {label}
                        </div>
                      </Html>
                      {/* Left Cylinder Eye */}
                      <mesh position={[-0.01, 0, 0.008]} rotation={[Math.PI / 2, 0, 0]} castShadow>
                        <cylinderGeometry args={[0.007, 0.007, 0.015, 12]} />
                        <meshStandardMaterial color="#94a3b8" />
                      </mesh>
                      {/* Right Cylinder Eye */}
                      <mesh position={[0.01, 0, 0.008]} rotation={[Math.PI / 2, 0, 0]} castShadow>
                        <cylinderGeometry args={[0.007, 0.007, 0.015, 12]} />
                        <meshStandardMaterial color="#94a3b8" />
                      </mesh>
                      
                      {/* Laser Beam Visualization */}
                      {state.status === 'running' && (
                        <mesh position={[0, 0, 0.01 + beamLen / 2]}>
                          <boxGeometry args={[0.002, 0.002, beamLen]} />
                          <meshBasicMaterial color="red" transparent opacity={0.6} />
                        </mesh>
                      )}
                    </group>
                  );
                }
                if (sensor.type === 'color') {
                   const sameTypeIdx = robot.customSensors.slice(0, idx).filter(s => s.type === sensor.type).length + 1;
                   const label = `Color ${sameTypeIdx}`;
                   
                   return (
                    <group 
                      key={sensor.id} 
                      position={[sX, -visualHeight / 2, sY]}
                    >
                      <mesh castShadow receiveShadow>
                        <boxGeometry args={[0.02, 0.02, 0.02]} />
                        <meshStandardMaterial color="red" />
                      </mesh>
                      <Html distanceFactor={0.5} position={[0, 0.03, 0]}>
                        <div className="bg-slate-800/80 text-white text-[8px] px-1 py-0.5 rounded backdrop-blur-sm whitespace-nowrap pointer-events-none">
                          {label}
                        </div>
                      </Html>
                      {/* Small glow showing the detected color beneath the red cube, looking down */}
                      <mesh position={[0, -0.012, 0]} rotation={[Math.PI / 2, 0, 0]}>
                        <cylinderGeometry args={[0.01, 0.01, 0.002, 16]} />
                        <meshStandardMaterial 
                          color={sensor.value || 'white'} 
                          emissive={sensor.value || 'white'} 
                          emissiveIntensity={1} 
                        />
                      </mesh>
                    </group>
                  );
                }
                return null;
              })}

              {/* The new robot model has built-in eye/face features, so no extra eyes needed here */}

              {/* Green LED on top of the robot */}
              <group position={[0, visualHeight / 2 - 0.02, -bounds.depth / 6 - 0.02]}>
                {/* LED Holder/Base */}
                <mesh castShadow receiveShadow position={[0, 0.005, 0]}>
                  <cylinderGeometry args={[0.008, 0.008, 0.01, 16]} />
                  <meshStandardMaterial color="#27272a" roughness={0.7} metalness={0.5} />
                </mesh>
                {/* LED Bulb */}
                <mesh castShadow position={[0, 0.014, 0]}>
                  <sphereGeometry args={[0.006, 16, 16]} />
                  <meshStandardMaterial 
                    color={robot.ledOn ? "#22c55e" : "#052e16"} 
                    emissive={robot.ledOn ? "#22c55e" : "#000000"} 
                    emissiveIntensity={robot.ledOn ? 2.0 : 0} 
                    roughness={0.2}
                  />
                </mesh>
                {/* Optional point light when LED is on to cast physical light */}
                {robot.ledOn && (
                  <pointLight 
                    position={[0, 0.025, 0]} 
                    color="#22c55e" 
                    intensity={0.5} 
                    distance={0.3} 
                    decay={2} 
                  />
                )}
              </group>

              {/* Default Sensors Visualization (if present) */}
              {robot.sensors && (
                <>
                  {/* Default Distance Sensor (Top front) */}
                  {robot.sensors?.distance != null && (
                    <group position={[0, visualHeight / 2 - 0.01, bounds.depth / 2 - 0.08]}>
                      {/* Sensor Housing */}
                      <mesh castShadow receiveShadow>
                        <boxGeometry args={[0.04, 0.02, 0.015]} />
                        <meshStandardMaterial color="#334155" />
                      </mesh>
                      <Html distanceFactor={0.5} position={[0, 0.03, 0]}>
                        <div className="bg-slate-800/80 text-white text-[8px] px-1 py-0.5 rounded backdrop-blur-sm whitespace-nowrap pointer-events-none">
                          Dist 0
                        </div>
                      </Html>
                      {/* Left Cylinder Eye */}
                      <mesh position={[-0.01, 0, 0.008]} rotation={[Math.PI / 2, 0, 0]} castShadow>
                        <cylinderGeometry args={[0.007, 0.007, 0.015, 12]} />
                        <meshStandardMaterial color="#94a3b8" />
                      </mesh>
                      {/* Right Cylinder Eye */}
                      <mesh position={[0.01, 0, 0.008]} rotation={[Math.PI / 2, 0, 0]} castShadow>
                        <cylinderGeometry args={[0.007, 0.007, 0.015, 12]} />
                        <meshStandardMaterial color="#94a3b8" />
                      </mesh>
                      
                      {/* Laser Beam Visualization for default sensor */}
                      {state.status === 'running' && (
                        <mesh position={[0, 0, 0.01 + (robot.sensors.distance * scale) / 2]}>
                          <boxGeometry args={[0.002, 0.002, (robot.sensors.distance || 0) * scale]} />
                          <meshBasicMaterial color="red" transparent opacity={0.6} />
                        </mesh>
                      )}
                    </group>
                  )}

                  {/* Default Color Sensor (Bottom side) */}
                  {robot.sensors?.color != null && (
                    <group position={[0, -visualHeight / 2, 0]}>
                      <mesh castShadow receiveShadow>
                        <boxGeometry args={[0.02, 0.02, 0.02]} />
                        <meshStandardMaterial color="red" />
                      </mesh>
                      <Html distanceFactor={0.5} position={[0, 0.03, 0]}>
                        <div className="bg-slate-800/80 text-white text-[8px] px-1 py-0.5 rounded backdrop-blur-sm whitespace-nowrap pointer-events-none">
                          Color 0
                        </div>
                      </Html>
                      {/* Small glow showing the detected color beneath the red cube, looking down */}
                      <mesh position={[0, -0.012, 0]} rotation={[Math.PI / 2, 0, 0]}>
                        <cylinderGeometry args={[0.01, 0.01, 0.002, 16]} />
                        <meshStandardMaterial 
                          color={robot.sensors.color || 'white'} 
                          emissive={robot.sensors.color || 'white'} 
                          emissiveIntensity={1} 
                        />
                      </mesh>
                    </group>
                  )}
                </>
              )}
            </group>
          </group>

        );
      })}

      {/* Controls */}
      <OrbitControls target={[mapWidth / 2, 0, mapHeight / 2]} />
    </Canvas>

    {/* Controls Floating Bar overlay */}
    <div className="absolute top-4 right-4 z-20 flex flex-col sm:flex-row sm:space-x-2 space-y-2 sm:space-y-0 pointer-events-auto">
      <button
        onClick={() => setKeySeed(prev => prev + 1)}
        className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-[10px] sm:text-xs font-semibold shadow-md transition-all border bg-gray-800/90 border-gray-700 text-gray-300 hover:bg-gray-700 hover:text-white cursor-pointer active:scale-95"
        title="Ripristina la vista dall'alto (default)"
      >
        <Eye size={14} />
        <span>Reset Vista</span>
      </button>

      <button
        onClick={() => setShowGrid(!showGrid)}
        className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-[10px] sm:text-xs font-semibold shadow-md transition-all border ${
          showGrid 
            ? 'bg-blue-600 border-blue-500 text-white hover:bg-blue-700 font-bold cursor-pointer' 
            : 'bg-gray-800/90 border-gray-700 text-gray-300 hover:bg-gray-700 hover:text-white cursor-pointer'
        }`}
        title="Attiva/Disattiva la griglia di riferimento nel simulatore"
      >
        <Grid size={14} />
        <span>Griglia</span>
      </button>


    </div>
  </div>
  );
}
