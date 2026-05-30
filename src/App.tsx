import React, { useEffect, useState, useRef, useMemo } from 'react';
import { SimulationState, RobotState, FieldObject } from './types';
import { Play, Square, RotateCcw, Activity, Map as MapIcon, Code, Layout, Settings, Download, Upload, Trash2, HelpCircle, ShieldCheck } from 'lucide-react';
import { SimulationView3D } from './SimulationView3D';
import { ProgrammingView, ProgrammingViewHandle } from './ProgrammingView';
import { RobotEditorView } from './RobotEditorView';
import { SimulationEngine, getInitialState, updateRobotSensors, calculateScore, getRobotRotatedExtents, checkRobotObjectCollision } from './SimulationEngine';

export default function App() {
  const engineRef = useRef<SimulationEngine | null>(null);
  const [state, setState] = useState<SimulationState | null>(null);
  
  if (!engineRef.current) {
    const engine = new SimulationEngine();
    // Bind state updating to React
    engine.onStateUpdate = (newState) => {
      setState(newState);
    };
    engineRef.current = engine;
    
    // Trigger initial state
    engine.onStateUpdate(engine.getState());
  }

  const engine = engineRef.current;

  // Mock socket to avoid rewriting children right now
  const socket = useMemo(() => ({
    id: engine.robotId,
    connected: true,
    on: (event: string, cb: any) => {}, // Not used by children to receive state (they use props)
    off: (event: string, cb: any) => {},
    emit: (event: string, ...args: any[]) => {
      console.log("Mock Socket Emit:", event, args);
      switch (event) {
        case 'registerRobot':
          engine.registerRobot(args[0].name, args[0].color);
          if (args[1]) args[1]({ id: engine.robotId });
          break;
        case 'moveRobot':
          engine.moveRobot(args[0], args[1]);
          break;
        case 'updateRobotConfig':
          engine.updateRobotConfig(args[0], args[1]);
          break;
        case 'saveRobotConfig':
          engine.saveRobotConfig(args[0]);
          break;
        case 'addObject':
          engine.addObject(args[0]);
          break;
        case 'applyRobotBonus':
          engine.applyRobotBonus(args[0], args[1]);
          break;
        case 'teleportRobot':
          engine.teleportRobot(args[0], args[1]);
          break;
        case 'resetSingleRobot':
          engine.resetSingleRobot(args[0]);
          break;
        case 'startSimulation':
          engine.startProgram();
          break;
        case 'stopSimulation':
          engine.stopProgram();
          break;
        case 'finishSimulation':
          engine.finishSimulation();
          break;
        case 'resetSimulation':
          engine.reset();
          break;
      }
    }
  }), [engine]);

  const [activeTab, setActiveTab] = useState<'simulation' | 'programming' | 'robotEditor' | 'help'>('simulation');
  const [helpPage, setHelpPage] = useState<number>(1);
  const [isProgramRunning, setIsProgramRunning] = useState(false);
  const [isRestartActive, setIsRestartActive] = useState(false);
  const [hasCode, setHasCode] = useState(false);
  const programmingRef = useRef<ProgrammingViewHandle>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    // Auto-register a robot for the current session if none exists
    if (state && !state.robots[engine.robotId]) {
      engine.registerRobot('Main Robot', '#eab308');
    }
  }, [state?.robots, engine]);

  useEffect(() => {
    const computeScale = () => {
      if (!containerRef.current || !state || !state.maps[state.currentMapId]) return;
      const padding = 64; // 32px on each side
      const mapConf = state.maps[state.currentMapId];
      const availableWidth = containerRef.current.clientWidth - padding;
      const availableHeight = containerRef.current.clientHeight - padding;
      
      const widthRatio = availableWidth / mapConf.width;
      const heightRatio = availableHeight / mapConf.height;
      setScale(Math.min(widthRatio, heightRatio));
    };

    computeScale();
    window.addEventListener('resize', computeScale);
    return () => window.removeEventListener('resize', computeScale);
  }, [state?.currentMapId, state?.maps]);

  if (!state) {
    return <div className="flex h-screen items-center justify-center bg-gray-900 text-white italic">Connecting to simulation server...</div>;
  }

  const currentMap = state.maps[state.currentMapId];

  return (
    <div className="flex h-screen bg-gray-100 flex-col md:flex-row overflow-hidden">
      {/* Sidebar / Controls */}
      <div className="w-full md:w-80 bg-gray-800 p-6 flex flex-col space-y-5 z-10 border-r border-gray-700 overflow-y-auto max-h-screen">
        <div className="space-y-1">
          <h1 className="text-2xl font-black italic tracking-tighter text-white uppercase leading-none">Simulazione WRO</h1>
          <p className="text-[10px] font-bold text-blue-400 uppercase tracking-widest">STAARR - DREAMPUZZLE</p>
        </div>

        <div className="grid grid-cols-3 gap-2 bg-gray-900 p-1.5 rounded-2xl shadow-inner border border-gray-800">
          <button 
            onClick={() => setActiveTab('simulation')}
            className={`flex items-center justify-center py-2.5 rounded-xl text-[11px] font-black transition-all ${
              activeTab === 'simulation' ? 'bg-blue-600 text-white shadow-md' : 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white border border-gray-700'
            }`}
          >
            <Layout size={16} className="mr-2" />
            3D
          </button>
          <button 
            onClick={() => setActiveTab('programming')}
            className={`flex items-center justify-center py-2.5 rounded-xl text-[11px] font-black transition-all ${
              activeTab === 'programming' ? 'bg-blue-600 text-white shadow-md' : 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white border border-gray-700'
            }`}
          >
            <Code size={16} className="mr-2" />
            CODICE
          </button>
          <button 
            onClick={() => setActiveTab('robotEditor')}
            className={`flex items-center justify-center py-2.5 rounded-xl text-[11px] font-black transition-all ${
              activeTab === 'robotEditor' ? 'bg-blue-600 text-white shadow-md' : 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white border border-gray-700'
            }`}
          >
            <Settings size={16} className="mr-2" />
            ROBOT
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="bg-gray-900 p-4 rounded-xl border border-gray-700 flex flex-col justify-center">
            <div className="text-sm text-gray-500 uppercase tracking-wider font-semibold mb-1">Tempo</div>
            <div className="text-3xl font-mono text-green-400 font-black text-right">
              {Math.floor(state.timeRemaining / 60)}:{(state.timeRemaining % 60).toString().padStart(2, '0')}
            </div>
          </div>
          
          <div className="bg-gray-900 p-4 rounded-xl border border-gray-700 flex flex-col justify-center">
            <div className="text-sm text-gray-500 uppercase tracking-wider font-semibold mb-1">Punteggio</div>
            <div className="text-3xl font-mono text-green-400 font-black text-right">
              {state.score || 0}
            </div>
          </div>
        </div>

         <div className="grid grid-cols-4 gap-2">
          <button 
             onClick={() => programmingRef.current?.runCode()}
             disabled={isProgramRunning || !hasCode}
             className={`flex flex-col items-center justify-center p-3 rounded-xl transition-all shadow-md active:scale-95 ${
                 (isProgramRunning || !hasCode) ? 'bg-gray-700 text-gray-500 opacity-50 cursor-not-allowed' : 'bg-green-600 text-white hover:bg-green-700'
             }`}
          >
            <Play size={20} className="mb-1" />
            <span className="text-[10px] font-black uppercase tracking-tight">Avvia</span>
          </button>
          <button 
             onClick={() => programmingRef.current?.stopCode()}
             disabled={!isProgramRunning}
             className={`flex flex-col items-center justify-center p-3 rounded-xl transition-all shadow-md active:scale-95 ${
                 !isProgramRunning ? 'bg-gray-700 text-gray-500' : 'bg-red-600 text-white hover:bg-red-700'
             }`}
          >
            <Square size={20} className="mb-1" />
            <span className="text-[10px] font-black uppercase tracking-tight">Stop</span>
          </button>
          <button 
             onClick={() => programmingRef.current?.resetRobot()}
             className="flex flex-col items-center justify-center p-3 rounded-xl bg-gray-700 text-gray-300 hover:bg-gray-600 transition-all active:scale-95 shadow-sm"
          >
            <RotateCcw size={20} className="mb-1" />
            <span className="text-[10px] font-black uppercase tracking-tight">Reset</span>
          </button>
          <button 
             onClick={() => {
               const newValue = !isRestartActive;
               setIsRestartActive(newValue);
               programmingRef.current?.setForceRestart(newValue);
             }}
             className={`flex flex-col items-center justify-center p-3 rounded-xl text-white transition-all active:scale-95 shadow-sm ${
               isRestartActive ? 'bg-green-600' : 'bg-slate-600 hover:bg-slate-700'
             }`}
          >
            <RotateCcw size={20} className="mb-1" />
            <span className="text-[10px] font-black uppercase tracking-tight">New Run</span>
          </button>
        </div>

        {state.scoreBreakdown && state.scoreBreakdown.length > 0 && (
          <div className="bg-gray-900 p-3 rounded-xl border border-gray-700 text-xs text-gray-300 font-mono space-y-1 mt-2">
            <div className="text-[10px] text-gray-500 uppercase tracking-wider font-bold border-b border-gray-800 pb-1 mb-1">Dettaglio Punti</div>
            {state.scoreBreakdown.map((item, index) => {
              const parts = item.split(' = ');
              return (
                <div key={index} className="flex justify-between">
                  <span>{parts[0]}</span>
                  <span className="text-green-400 font-semibold">{parts[1] || ''}</span>
                </div>
              );
            })}
          </div>
        )}


        {/* Gestione Codice / Salva & Carica Codice */}
        <div className="flex-1 overflow-y-auto mt-4 space-y-4">
          {Object.values(state.robots).map(robot => (
            <div key={robot.id} className="bg-gray-900 border border-gray-800 rounded-xl p-4">
              <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-3">
                Sensori - Valori letti
              </div>
              <div className="space-y-2">
                {(() => {
                  const items = [];
                  if (robot.sensors?.distance != null) {
                    items.push(
                      <div key="dist0" className="flex justify-between items-center bg-gray-800 p-2 rounded-lg border border-gray-700">
                        <span className="text-xs font-semibold text-gray-300">SensoreDistanza 0</span>
                        <span className="text-xs font-mono font-bold px-2 py-1 bg-black text-blue-400 rounded">
                          {Math.round(robot.sensors.distance)} mm
                        </span>
                      </div>
                    );
                  }
                  if (robot.sensors?.color != null) {
                    items.push(
                      <div key="color0" className="flex justify-between items-center bg-gray-800 p-2 rounded-lg border border-gray-700">
                        <span className="text-xs font-semibold text-gray-300">SensoreColore 0</span>
                        <div className="flex items-center space-x-2">
                          <div className="w-3 h-3 rounded-full border border-gray-600" style={{ backgroundColor: robot.sensors.color }}></div>
                          <span className="text-xs font-mono font-bold px-2 py-1 bg-black text-blue-400 rounded">
                            {robot.sensors.color}
                          </span>
                        </div>
                      </div>
                    );
                  }
                  if (robot.customSensors && robot.customSensors.length > 0) {
                    robot.customSensors.forEach((sensor, idx) => {
                      const sameTypeIdx = robot.customSensors.slice(0, idx).filter(s => s.type === sensor.type).length + 1;
                      const label = sensor.type === 'color' ? `SensoreColore ${sameTypeIdx}` : `SensoreDistanza ${sameTypeIdx}`;
                      items.push(
                        <div key={sensor.id} className="flex justify-between items-center bg-gray-800 p-2 rounded-lg border border-gray-700">
                          <span className="text-xs font-semibold text-gray-300">
                            {label}
                          </span>
                          {sensor.type === 'color' ? (
                            <div className="flex items-center space-x-2">
                              <div className="w-3 h-3 rounded-full border border-gray-600" style={{ backgroundColor: (sensor.value as string) || 'white' }}></div>
                              <span className="text-xs font-mono font-bold px-2 py-1 bg-black text-blue-400 rounded">
                                {sensor.value || '---'}
                              </span>
                            </div>
                          ) : (
                            <span className="text-xs font-mono font-bold px-2 py-1 bg-black text-blue-400 rounded">
                              {sensor.value !== undefined ? Math.round(sensor.value as number) : '0'} mm
                            </span>
                          )}
                        </div>
                      );
                    });
                  }
                  
                  if (items.length === 0) {
                    return <div className="text-xs text-gray-500 italic px-2">Nessun sensore configurato</div>;
                  }
                  return items;
                })()}
              </div>
            </div>
          ))}
        </div>

        <div className="pt-4 border-t border-gray-700 mt-auto">
          <button 
            onClick={() => setActiveTab('help')}
            className={`flex items-center justify-center p-2.5 rounded-xl text-[11px] font-black transition-all w-full ${
              activeTab === 'help' ? 'bg-blue-600 text-white shadow-md' : 'bg-gray-700 text-gray-400 hover:bg-gray-700 hover:text-white border border-gray-700'
            }`}
          >
            <HelpCircle size={16} className="mr-2" />
            HELP
          </button>
        </div>
      </div>

      {/* Main Area */}
      <div className="flex-1 relative flex flex-col overflow-hidden bg-white">
          {/* Toolbar moved to ProgrammingView */}
          
          <div className={`flex-1 bg-gray-900 ${activeTab === 'simulation' ? 'block' : 'hidden'}`}>
            <SimulationView3D state={state} socket={socket} robotId={socket.id} />
          </div>
          <div className={`flex-1 ${activeTab === 'programming' ? 'block' : 'hidden'}`}>
            <ProgrammingView 
              ref={programmingRef}
              socket={socket} 
              state={state} 
              onRunStart={() => setActiveTab('simulation')} 
              onStatusChange={setIsProgramRunning}
              onSwitchToSimulation={() => setActiveTab('simulation')}
              onRestartDeactivated={() => setIsRestartActive(false)}
              onHasCodeChange={setHasCode}
            />
          </div>
          <div className={`flex-1 ${activeTab === 'robotEditor' ? 'block' : 'hidden'}`}>
             <RobotEditorView socket={socket} state={state} onSwitchToSimulation={() => setActiveTab('simulation')} />
          </div>
          <div className={`flex-1 overflow-y-auto bg-gray-50 p-8 border-l border-gray-200 ${activeTab === 'help' ? 'block' : 'hidden'}`}>
             <div className="max-w-3xl mx-auto bg-white p-8 rounded-2xl shadow-sm border border-gray-100 relative">
               {helpPage === 1 && (
                 <>
                   <div className="flex items-center mb-6">
                     <div className="p-3 bg-blue-100 text-blue-600 rounded-xl mr-4">
                       <HelpCircle size={28} />
                     </div>
                     <h2 className="text-2xl font-bold text-gray-800">Guida all'uso della Simulazione</h2>
                   </div>
                   
                   <div className="space-y-6 text-gray-600 text-sm leading-relaxed">
                     <section>
                       <p className="mb-4">Benvenuto nel simulatore WRO. Segui le istruzioni per familiarizzare con l'ambiente e iniziare a programmare il tuo robot.</p>
                     </section>

                     <section className="bg-gray-50 p-5 rounded-xl border border-gray-100">
                       <h3 className="text-lg font-bold text-gray-800 mb-3 flex items-center">
                         <Layout size={18} className="mr-2 text-blue-500" /> Sezioni Principali
                       </h3>
                       <ul className="space-y-3 ml-2">
                         <li className="flex items-start">
                           <span className="font-semibold text-gray-800 mr-2 min-w-24">3D:</span>
                           <span>Visualizza il robot in azione. Puoi muoverti nell'ambiente 3D trascinando il mouse e usare la rotellina per lo zoom.</span>
                         </li>
                         <li className="flex items-start">
                           <span className="font-semibold text-gray-800 mr-2 min-w-24">CODICE:</span>
                           <span>L'area in cui assembli i blocchi logici (Blockly) per creare il tuo programma. Trascina i blocchi dal menu di sinistra per costruire il codice che verrà eseguito dal tuo robot virtuale.</span>
                         </li>
                         <li className="flex items-start">
                           <span className="font-semibold text-gray-800 mr-2 min-w-24">ROBOT:</span>
                           <span>Configura i sensori del tuo robot. Controlla le porte e la disposizione di sensori di colore, distanza, ecc. Puoi gestire un robot con un sensore di distanza e fino a 3 sensori di colore.</span>
                         </li>
                       </ul>
                     </section>

                     <section className="bg-gray-50 p-5 rounded-xl border border-gray-100">
                       <h3 className="text-lg font-bold text-gray-800 mb-3 flex items-center">
                         <Play size={18} className="mr-2 text-green-500" /> Pulsanti di Controllo
                       </h3>
                       <ul className="space-y-3 ml-2">
                         <li className="flex items-start">
                           <span className="font-semibold text-gray-800 mr-2 min-w-24">AVVIA:</span>
                           <span>Carica i blocchi di codice sul robot e avvia la simulazione 3D.</span>
                         </li>
                         <li className="flex items-start">
                           <span className="font-semibold text-gray-800 mr-2 min-w-24">STOP:</span>
                           <span>Ferma temporaneamente il robot mantenendo lo stato attuale.</span>
                         </li>
                         <li className="flex items-start">
                           <span className="font-semibold text-gray-800 mr-2 min-w-24">RESET:</span>
                           <span>Riporta il robot esattamente alla posizione in cui si trovava ad inizio simulazione.</span>
                         </li>
                         <li className="flex items-start">
                           <span className="font-semibold text-gray-800 mr-2 min-w-24">NEW RUN:</span>
                           <span>Premi NEW RUN se intendi far ripartire il tuo robot quando raggiunge la casella start. In quel caso, quando raggiunge la casella, il robot farà lampeggiare il LED, e si posizionerà pronto a ripartire. Un guardiano ambientale sarà posizionato davanti a lui. Portai andare nella sezione codice, caricare un programma, e far ripartire il robot premendo avvia.</span>
                         </li>
                       </ul>
                     </section>
                     
                     <section>
                       <h3 className="text-lg font-bold text-gray-800 mb-2 mt-4">Valori letti dai sensori</h3>
                       <p>forniscono in tempo reale i valori di tutti i sensori.</p>
                       <h3 className="text-lg font-bold text-gray-800 mb-2 mt-4">Tempo e punteggio</h3>
                       <p>visualizzano il tempo rimanente al robot per compiere la missione, ed a fine gara il punteggio ottenuto.</p>
                     </section>
                   </div>
                   
                   <div className="mt-8 flex justify-between">
                     <button 
                       onClick={() => setActiveTab('simulation')}
                       className="bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold py-2 px-6 rounded-xl transition-colors shadow-sm"
                     >
                       Torna alla Simulazione
                     </button>
                     <button 
                       onClick={() => setHelpPage(2)}
                       className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-6 rounded-xl transition-colors shadow-sm"
                     >
                       Regolamento WRO Starter Virtuale →
                     </button>
                   </div>
                 </>
               )}

               {helpPage === 2 && (
                 <>
                   <div className="flex items-center mb-6">
                     <div className="p-3 bg-blue-100 text-blue-600 rounded-xl mr-4">
                       <HelpCircle size={28} />
                     </div>
                     <h2 className="text-2xl font-bold text-gray-800">Regolamento WRO Starter Virtuale</h2>
                   </div>
                   
                   <div className="space-y-6 text-gray-600 text-sm leading-relaxed">
                     <section>
                        <h3 className="text-lg font-bold text-gray-800 mb-3">Oggetti e posizionamento sul Campo RoboSTARTER</h3>
                        <p className="mb-4">
                          Sul campo di gara sono posizionati i seguenti oggetti:
                        </p>
                        <ul className="list-disc ml-6 space-y-2">
                          <li><strong>4 tartarughe</strong></li>
                          <li><strong>2 cibo ROSSO (adatto)</strong> da portare nell'area di stoccaggio (verde)</li>
                          <li><strong>2 cibo GIALLO (non adatto)</strong> da lasciare/rimettere all'interno del negozio</li>
                          <li><strong>2 cibo VERDE (adatto)</strong> in AREA START da portare nell'area di stoccaggio (verde)</li>
                          <li><strong>4 guardiani ambientali (in colore Blu)</strong> (che verranno man mano creati nell'area START)</li>
                          <li><strong>4 rifiuti dispersi (in colore Rosso)</strong></li>
                          <li><strong>4 alberi</strong> (Nelle loro aree, utilizzati per assegnare i punti bonus al termine della prova)</li>
                        </ul>

                        <h3 className="text-lg font-bold text-gray-800 mb-3 mt-8">TARTARUGHE</h3>
                        <p className="mb-4">
                          Le 4 tartarughe sono distribuite sul campo di gioco in diverse posizioni di partenza. Le abbiamo
                          colorate SOLO per distinguerle, anche se hanno lo stesso valore in termini di punteggio assegnato.
                        </p>

                        <h3 className="text-lg font-bold text-gray-800 mb-3 mt-8">CIBI (2 ROSSI + 2 GIALLI + 2 VERDI)</h3>
                        <p className="mb-2">
                          Bisogna nutrire le tartarughe ma non tutti i cibi vanno bene. I negozi mettono a disposizione
                          quello che hanno. I cibi ROSSI sono maturi e adatti alle tartarughe mentre quelli gialli non sono
                          adatti alle tartarughe.
                        </p>
                        <ul className="list-disc ml-6 space-y-2">
                          <li>I due cibi gialli posizionati di fronte a BAR e BOOK STORE</li>
                          <li>I due cibi ROSSI posizionati di fronte a FRUIT e PHARMACY</li>
                          <li>I due cibi VERDI posizionati nell'AREA START</li>
                        </ul>

                        <h3 className="text-lg font-bold text-gray-800 mb-3 mt-8">GUARDIANI AMBIENTALI (Blu-4x)</h3>
                        <p className="mb-4">
                          Ci sono 4 guardiani ambientali che partono dall'AREA START in basso a
                          sinistra. (vengono creati man mano davanti al robot all' avvio e ad ogni ripartenza) Vanno portati a monitorare le diverse aree.
                        </p>

                        <h3 className="text-lg font-bold text-gray-800 mb-3 mt-8">RIFIUTI DISPERSI (Rossi-4x)</h3>
                        <p className="mb-4">
                          Ci sono 4 rifiuti dispersi, trascinati in città dagli eventi meteo, che vanno rimossi. Sono sparsi sul
                          campo di gioco e vanno portati nell'area in alto a destra.
                        </p>

                        <h3 className="text-lg font-bold text-gray-800 mb-3 mt-8">ALBERI (4 x)</h3>
                        <p className="mb-4">
                          I 4 alberi si trovano nelle aree di riciclo. Si deve evitare di spostarli fuori dalle loro aree.
                        </p>
                     </section>
                   </div>
                   
                   <div className="mt-8 flex justify-between">
                     <div className="flex gap-4">
                       <button 
                         onClick={() => setActiveTab('simulation')}
                         className="bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold py-2 px-6 rounded-xl transition-colors shadow-sm"
                       >
                         Torna alla Simulazione
                       </button>
                     </div>
                     <button 
                       onClick={() => setHelpPage(3)}
                       className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-6 rounded-xl transition-colors shadow-sm"
                     >
                       Missioni →
                     </button>
                   </div>
                 </>
               )}

               {helpPage === 3 && (
                 <>
                   <div className="flex items-center mb-6">
                     <div className="p-3 bg-blue-100 text-blue-600 rounded-xl mr-4">
                       <HelpCircle size={28} />
                     </div>
                     <h2 className="text-2xl font-bold text-gray-800">Missioni</h2>
                   </div>
                   
                   <div className="space-y-6 text-gray-600 text-sm leading-relaxed">
                     <section>
                        <p className="mb-4">
                          Il vostro compito consiste in sei parti:
                        </p>
                        <ul className="list-disc ml-6 space-y-2">
                          <li><strong>Missione 1:</strong> Liberare le tartarughe in mare</li>
                          <li><strong>Missione 2:</strong> Stoccare i cibi per le tartarughe</li>
                          <li><strong>Missione 3:</strong> Posizionare i guardiani ambientali nei punti di monitoraggio</li>
                          <li><strong>Missione 4:</strong> Raccogliere i rifiuti dispersi e portarli all'ISOLA ECOLOGICA</li>
                          <li><strong>Missione 5:</strong> Parcheggiare il robot</li>
                          <li><strong>Missione 6:</strong> Raccogliere punti bonus</li>
                        </ul>

                        <h3 className="text-lg font-bold text-gray-800 mb-3 mt-8">Missione 1 - Liberare le tartarughe in mare</h3>
                        <div className="flex flex-col md:flex-row gap-6 items-start mb-4">
                          <p className="flex-1">
                            Le tartarughe devono venire ritrovate e portate al mare. Possono anche venire liberate
                            sulla spiaggia.
                          </p>
                          <img src="/missione1.png" alt="Mappa missione 1" className="w-1/4 md:w-1/6 rounded-lg shadow-sm border border-gray-200" />
                        </div>

                        <h3 className="text-lg font-bold text-gray-800 mb-3 mt-8">Missione 2: Nutrire le tartarughe</h3>
                        <div className="mb-4">
                          <p className="mb-4">
                            Le tartarughe, a lungo malnutrite, hanno bisogno di cibo. Tutti i negozi donano dei cibi ma non
                            tutti sono adatti alle tartarughe.
                          </p>
                          <p className="mb-2">Il compito del robot è:</p>
                          <ul className="list-disc ml-6 space-y-2 mb-6">
                            <li>distinguere i cibi (<strong>ROSSI</strong> e <strong>VERDI</strong> adatti alle tartarughe - <strong>GIALLI</strong> non adatti alle tartarughe)</li>
                            <li>I <strong>CIBI ROSSI</strong> vanno portati nell'<strong>AREA DI STOCCAGGIO</strong> verde, dove i volontari provvederanno a razionare per le tartarughe</li>
                            <li>I <strong>CIBI GIALLI</strong> vanno resi ai negozi. Ringraziamo i negozianti di aver voluto contribuire ma purtroppo non sono adatti. Come ringraziamento il robot deve <strong>Accendere il LED</strong> quando entra nel negozio.</li>
                            <li>I <strong>CIBI VERDI</strong> si trovano nella zona <strong>START</strong> e devono venire portati nella zona stoccaggio <strong>VERDE</strong></li>
                          </ul>
                          <img src="/missione_2.png" alt="Mappa missione 2" className="w-full md:w-3/4 rounded-lg shadow-sm border border-gray-200 mx-auto" />
                        </div>

                        <h3 className="text-lg font-bold text-gray-800 mb-3 mt-8">Missione 3: Posizionare i guardiani ambientali nei punti di monitoraggio</h3>
                        <div className="mb-4">
                          <p className="mb-4">
                            Alla partenza i guardiani ambientali sono posizionati nell' <strong>AREA START</strong>. Vengono creati, uno alla volta, ad ogni ripartenza del robot.
                          </p>
                          <p className="mb-2">Devono venire portati a sorvegliare per evitare altri problemi nelle seguenti AREE COLORATE:</p>
                          <ul className="list-disc ml-6 space-y-2 mb-6">
                            <li>zona negozi: nella <strong>FASCIA ROSSA</strong> (valgono anche i negozi stessi)</li>
                            <li>zona EDIFICIO: in qualsiasi parte (giardino, cortile o edificio)</li>
                            <li>Zona SPIAGGIA: in qualsiasi punto nel <strong>GIALLO</strong></li>
                            <li>Zona VERDE: area di stoccaggio</li>
                          </ul>
                          <img src="/missione3.png" alt="Mappa missione 3" className="w-full md:w-3/4 rounded-lg shadow-sm border border-gray-200 mx-auto" />
                        </div>

                        <h3 className="text-lg font-bold text-gray-800 mb-3 mt-8">Missione 4: Raccogliere i rifiuti dispersi e portarli all'ISOLA ECOLOGICA</h3>
                        <div className="mb-4">
                          <p className="mb-4">
                            I rifiuti sono stati trascinati in città dagli eventi meteo!<br />
                            Raccoglili e portali all'<strong>ISOLA ECOLOGICA</strong>, posizionata nell'angolo in alto a destra del campo (vedi immagine sopra).
                          </p>
                        </div>

                        <h3 className="text-lg font-bold text-gray-800 mb-3 mt-8">Missione 5 - Parcheggiare il robot</h3>
                        <div className="mb-4">
                          <p className="mb-4">
                            Alla fine del round, il robot deve trovarsi nell'area di destinazione. Il robot si considera nell'<strong>AREA START</strong> quando si sovrappone anche parzialmente. Attenzione: i punti per il parcheggio vengono assegnati solo se sono stati fatti altri punti sul campo (esclusi i punti degli alberi).
                          </p>
                          <img src="/missione5.png" alt="Mappa missione 5" className="w-1/4 md:w-1/6 rounded-lg shadow-sm border border-gray-200 mx-auto" />
                        </div>

                        <h3 className="text-lg font-bold text-gray-800 mb-3 mt-8">Missione 6 - Raccogliere punti bonus</h3>
                        <div className="mb-4">
                          <p className="mb-4">
                            Posizionare 4 alberi nelle AREE RICICLO. Si prendono punti se gli
                            alberi al termine del round toccano ancora una delle AREE RICICLO.
                          </p>
                          <img src="/missione6.png" alt="Mappa missione 6" className="w-1/4 md:w-1/6 rounded-lg shadow-sm border border-gray-200 mx-auto" />
                        </div>
                     </section>
                   </div>
                   
                   <div className="mt-8 flex justify-between">
                     <div className="flex gap-4">
                       <button 
                         onClick={() => setActiveTab('simulation')}
                         className="bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold py-2 px-6 rounded-xl transition-colors shadow-sm"
                       >
                         Torna alla Simulazione
                       </button>
                     </div>
                     <button 
                       onClick={() => setHelpPage(4)}
                       className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-6 rounded-xl transition-colors shadow-sm"
                     >
                       Punteggio assegnato →
                     </button>
                   </div>
                 </>
               )}

               {helpPage === 4 && (
                 <>
                   <div className="flex items-center gap-4 mb-8">
                     <div className="bg-blue-100 p-3 rounded-2xl text-blue-600">
                       <ShieldCheck className="w-8 h-8" />
                     </div>
                     <div>
                       <h2 className="text-3xl font-extrabold text-gray-900">Punteggio assegnato</h2>
                       <p className="text-gray-500 mt-1">Regole di punteggio e valutazione</p>
                     </div>
                   </div>
                   
                   <div className="bg-white rounded-3xl p-8 shadow-sm border border-gray-100">
                     <p className="text-gray-600 mb-6 text-lg">
                       <strong className="text-gray-900">Assegnazione punteggio</strong><br/>
                       I punti vengono assegnati a TUTTI gli oggetti del compito, se toccano completamente o
                       parzialmente la rispettiva area.
                     </p>
                     
                     <h3 className="text-2xl font-bold text-blue-600 mb-6">MISSIONI</h3>
                     
                     <div className="space-y-6">
                       <div className="bg-gray-50 p-4 rounded-xl">
                         <h4 className="font-bold text-gray-800 text-lg">Missione 1 - Liberare le tartarughe in mare</h4>
                         <ul className="list-disc ml-6 text-gray-600 mt-2 space-y-1">
                           <li>La tartaruga tocca l'AREA SPIAGGIA o MARE: <strong>20 punti</strong> ciascuna tartaruga.</li>
                         </ul>
                       </div>

                       <div className="bg-gray-50 p-4 rounded-xl">
                         <h4 className="font-bold text-gray-800 text-lg">Missione 2 - Stoccare i cibi per le tartarughe</h4>
                         <ul className="list-disc ml-6 text-gray-600 mt-2 space-y-1">
                           <li>Portare i cibi ROSSI l'area di stoccaggio VERDE: <strong>25 punti</strong> per ogni blocco di cibo.</li>
                           <li>Portare i cibi GIALLI nei rispettivi negozi: <strong>10 punti</strong> per ogni blocco di cibo.</li>
                           <li>Quando il robot entra nel negozio per riportare un CIBO GIALLO accende il LED: <strong>5 punti</strong> per ogni blocco di cibo.</li>
                           <li>Portare i cibi VERDI l'area di stoccaggio VERDE: <strong>10 punti</strong> per ogni blocco di cibo.</li>
                         </ul>
                       </div>

                       <div className="bg-gray-50 p-4 rounded-xl">
                         <h4 className="font-bold text-gray-800 text-lg">Missione 3 - Posizionare i guardiani ambientali a guardia delle diverse aree</h4>
                         <ul className="list-disc ml-6 text-gray-600 mt-2 space-y-1">
                           <li>Un guardiano ambientale tocca una delle AREE stabilite: <strong>15 punti</strong> per ogni guardiano posizionato.</li>
                         </ul>
                       </div>

                       <div className="bg-gray-50 p-4 rounded-xl">
                         <h4 className="font-bold text-gray-800 text-lg">Missione 4 - Raccogliere i rifiuti dispersi e portarli in ISOLA ECOLOGICA</h4>
                         <ul className="list-disc ml-6 text-gray-600 mt-2 space-y-1">
                           <li>Rifiuto disperso portato in ISOLA ECOLOGICA: <strong>20 punti</strong> per ogni rifiuto recuperato.</li>
                         </ul>
                       </div>

                       <div className="bg-gray-50 p-4 rounded-xl">
                         <h4 className="font-bold text-gray-800 text-lg">Missione 5 - Parcheggiare il robot</h4>
                         <ul className="list-disc ml-6 text-gray-600 mt-2 space-y-1">
                           <li>Il robot tocca l'area di partenza e di arrivo: <strong>20 punti</strong> (assegnati solo se sono stati fatti altri punti sul campo, esclusi i punti degli alberi).</li>
                         </ul>
                       </div>

                       <div className="bg-gray-50 p-4 rounded-xl">
                         <h4 className="font-bold text-gray-800 text-lg">Missione 6 - Raccogliere punti bonus</h4>
                         <ul className="list-disc ml-6 text-gray-600 mt-2 space-y-1">
                           <li>L'albero tocca la sua area alla fine del programma: <strong>10 punti</strong> per ogni albero.</li>
                         </ul>
                       </div>
                       
                       <div className="pt-4 border-t border-gray-200 mt-6 pb-2">
                         <p className="text-2xl font-bold text-gray-900 text-right uppercase">
                           Punteggio massimo: <span className="text-blue-600 ml-2">380</span>
                         </p>
                       </div>
                     </div>
                   </div>
                   
                   <div className="mt-8 flex justify-between">
                     <div className="flex gap-4">
                       <button 
                         onClick={() => setActiveTab('simulation')}
                         className="bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold py-2 px-6 rounded-xl transition-colors shadow-sm"
                       >
                         Torna alla Simulazione
                       </button>
                     </div>
                   </div>
                 </>
               )}
             </div>
          </div>
      </div>
    </div>
  );
}
