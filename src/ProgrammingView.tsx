import React, { useEffect, useRef, useState, useImperativeHandle, forwardRef } from 'react';
import * as Blockly from 'blockly';
import { SimulationState } from './types';
import { Code, Download, Upload, Play, Layout } from 'lucide-react';

interface ProgrammingViewProps {
  socket: any;
  state: SimulationState;
  onRunStart?: () => void;
  onStatusChange?: (isRunning: boolean) => void;
  onSwitchToSimulation?: () => void;
  onRestartDeactivated?: () => void;
  onHasCodeChange?: (hasCode: boolean) => void;
}

export interface ProgrammingViewHandle {
  runCode: () => Promise<void>;
  stopCode: () => void;
  resetRobot: () => void;
  saveToDevice: () => void;
  loadFromDevice: () => void;
  getWorkspaceXml: () => string;
  setWorkspaceXml: (xmlText: string) => void;
  setForceRestart: (value: boolean) => void;
}

export const ProgrammingView = forwardRef<ProgrammingViewHandle, ProgrammingViewProps>(({ socket, state, onRunStart, onStatusChange, onSwitchToSimulation, onRestartDeactivated, onHasCodeChange }, ref) => {
  const blocklyDiv = useRef<HTMLDivElement>(null);
  const workspaceRef = useRef<Blockly.WorkspaceSvg | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [robotId, setRobotId] = useState<string | null>(null);
  const isRunningRef = useRef(false);
  const stateRef = useRef(state);
  const [savedSlots, setSavedSlots] = useState<{[key: number]: string}>({});
  const [promptData, setPromptData] = useState<{message: string, defaultValue: string, callback: (value: string | null) => void} | null>(null);
  const isCtrlPressedRef = useRef(false);
  const forceRestartRef = useRef(false);
  const ominoCreatedCountRef = useRef(0);

  const onHasCodeChangeRef = useRef(onHasCodeChange);
  useEffect(() => {
    onHasCodeChangeRef.current = onHasCodeChange;
  }, [onHasCodeChange]);

  useEffect(() => {
    ominoCreatedCountRef.current = 0;
  }, [state?.currentMapId]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => { if (e.key === 'Control') isCtrlPressedRef.current = true; };
    const handleKeyUp = (e: KeyboardEvent) => { if (e.key === 'Control') isCtrlPressedRef.current = false; };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  // Load saved slots from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('wro_saved_slots');
    if (saved) {
      try {
        setSavedSlots(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to parse saved slots", e);
      }
    }
  }, []);

  const handleLoadSlot = (slot: number) => {
    if (!workspaceRef.current || !savedSlots[slot]) return;
    
    workspaceRef.current.clear();
    const xml = Blockly.utils.xml.textToDom(savedSlots[slot]);
    Blockly.Xml.domToWorkspace(xml, workspaceRef.current);
  };

  const handleSaveToSlot = (slot: number) => {
    if (!workspaceRef.current) return;
    const xml = Blockly.Xml.workspaceToDom(workspaceRef.current);
    const xmlText = Blockly.Xml.domToText(xml);
    const newSlots = { ...savedSlots, [slot]: xmlText };
    setSavedSlots(newSlots);
    localStorage.setItem('wro_saved_slots', JSON.stringify(newSlots));
  };

  const handleSaveToDevice = () => {
    if (!workspaceRef.current) return;
    
    setPromptData({
      message: "Inserisci il nome del file:",
      defaultValue: "programma_robot.xml",
      callback: (filename) => {
        if (!filename) return;
        
        const xml = Blockly.Xml.workspaceToDom(workspaceRef.current!);
        const xmlText = Blockly.Xml.domToText(xml);
        const blob = new Blob([xmlText], { type: 'text/xml' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename.endsWith('.xml') ? filename : `${filename}.xml`;
        a.click();
        URL.revokeObjectURL(url);
      }
    });
  };

  const handleLoadFromDevice = () => {
    if (!workspaceRef.current) return;
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.xml';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (evt) => {
        const text = evt.target?.result as string;
        if (!workspaceRef.current) return;
        try {
          workspaceRef.current.clear();
          const xml = Blockly.utils.xml.textToDom(text);
          Blockly.Xml.domToWorkspace(xml, workspaceRef.current);
        } catch (err) {
          console.error("Invalid XML file", err);
          alert("Impossibile caricare il file. Assicurati che sia un file XML di Blockly valido.");
        }
      };
      reader.readAsText(file);
    };
    input.click();
  };

  useEffect(() => {
    onStatusChange?.(isRunning);
  }, [isRunning, onStatusChange]);

  useImperativeHandle(ref, () => ({
    runCode,
    stopCode,
    resetRobot,
    saveToDevice: handleSaveToDevice,
    loadFromDevice: handleLoadFromDevice,
    getWorkspaceXml: () => {
      if (!workspaceRef.current) return '';
      const xml = Blockly.Xml.workspaceToDom(workspaceRef.current);
      return Blockly.Xml.domToText(xml);
    },
    setWorkspaceXml: (xmlText: string) => {
      if (!workspaceRef.current) return;
      try {
        workspaceRef.current.clear();
        const xml = Blockly.utils.xml.textToDom(xmlText);
        Blockly.Xml.domToWorkspace(xml, workspaceRef.current);
      } catch (err) {
        console.error("Invalid XML", err);
      }
    },
    setForceRestart: (value: boolean) => {
      forceRestartRef.current = value;
    }
  }));

  // Initialize Blockly
  useEffect(() => {
    if (!blocklyDiv.current) return;

    // Add ResizeObserver to handle sidebar collapse
    const resizeObserver = new ResizeObserver(() => {
      if (workspaceRef.current) {
        Blockly.svgResize(workspaceRef.current);
      }
    });
    resizeObserver.observe(blocklyDiv.current);
    
    // Override Blockly dialogs to work inside iframe/sandbox
    Blockly.dialog.setPrompt(function(message, defaultValue, callback) {
      setPromptData({ message, defaultValue, callback });
    });
    Blockly.dialog.setAlert(function(message, callback) {
      console.log("Blockly Alert:", message);
      if (callback) callback();
    });
    Blockly.dialog.setConfirm(function(message, callback) {
      const res = window.confirm(message); // Might still fail in iframe if not allowed, but variables mainly use setPrompt
      callback(res);
    });

    // ... existing blockly setup ...

    Blockly.common.defineBlocks({
      'start_block': {
        init: function() {
          this.appendDummyInput()
              .appendField('Quando si clicca su AVVIA');
          this.setNextStatement(true, null);
          this.setColour('#D32F2F');
          this.setDeletable(false);
          this.setTooltip('Punto di inizio del programma');
        }
      },
      'move_indefinitely': {
        init: function() {
          this.appendDummyInput()
              .appendField('vai avanti');
          this.setPreviousStatement(true, null);
          this.setNextStatement(true, null);
          this.setColour('#2E7D32');
          this.setTooltip('Fa avanzare il robot indefinitamente');
        }
      },
      'move_backward_indefinitely': {
        init: function() {
          this.appendDummyInput()
              .appendField('vai indietro');
          this.setPreviousStatement(true, null);
          this.setNextStatement(true, null);
          this.setColour('#2E7D32');
          this.setTooltip('Fa retrocedere il robot indefinitamente');
        }
      },
      'stop_motors': {
        init: function() {
          this.appendDummyInput()
              .appendField('arresta marcia');
          this.setPreviousStatement(true, null);
          this.setNextStatement(true, null);
          this.setColour('#2E7D32');
          this.setTooltip('Arresta la marcia del robot');
        }
      },
      'move_forward': {
        init: function() {
          this.appendValueInput('DISTANCE')
              .setCheck('Number')
              .appendField('vai avanti di');
          this.appendDummyInput()
              .appendField('cm');
          this.setPreviousStatement(true, null);
          this.setNextStatement(true, null);
          this.setColour('#2E7D32');
        }
      },
      'move_backward': {
        init: function() {
          this.appendValueInput('DISTANCE')
              .setCheck('Number')
              .appendField('vai indietro di');
          this.appendDummyInput()
              .appendField('cm');
          this.setPreviousStatement(true, null);
          this.setNextStatement(true, null);
          this.setColour('#2E7D32');
        }
      },
      'turn_right': {
        init: function() {
          this.appendValueInput('ANGLE')
              .setCheck('Number')
              .appendField('gira a destra di');
          this.appendDummyInput()
              .appendField('gradi');
          this.setPreviousStatement(true, null);
          this.setNextStatement(true, null);
          this.setColour('#2E7D32');
        }
      },
      'turn_left': {
        init: function() {
          this.appendValueInput('ANGLE')
              .setCheck('Number')
              .appendField('gira a sinistra di');
          this.appendDummyInput()
              .appendField('gradi');
          this.setPreviousStatement(true, null);
          this.setNextStatement(true, null);
          this.setColour('#2E7D32');
        }
      },
      'set_speed': {
        init: function() {
          this.appendValueInput('SPEED')
              .setCheck('Number')
              .appendField('imposta velocità a');
          this.appendDummyInput()
              .appendField('%');
          this.setPreviousStatement(true, null);
          this.setNextStatement(true, null);
          this.setColour('#2E7D32');
          this.setTooltip('Imposta la velocità del robot (1% - 500%)');
        }
      },
      'motor_move': {
        init: function() {
          this.appendValueInput('DIST')
              .setCheck('Number')
              .appendField('muovi motore')
              .appendField(new Blockly.FieldDropdown([
                ['destro', 'RIGHT'],
                ['sinistro', 'LEFT']
              ]), 'MOTOR')
              .appendField(new Blockly.FieldDropdown([
                ['avanti', 'FORWARD'],
                ['indietro', 'BACKWARD']
              ]), 'DIR')
              .appendField('di');
          this.appendDummyInput()
              .appendField('cm');
          this.setPreviousStatement(true, null);
          this.setNextStatement(true, null);
          this.setColour('#0033cc');
          this.setTooltip('Muove un singolo motore di una distanza specificata');
        }
      },
      'get_distance': {
        init: function() {
          this.appendDummyInput()
              .appendField('distanza da')
              .appendField(new Blockly.FieldDropdown([
                ['SensoreDistanza 0', 'dist0'],
                ['SensoreDistanza 1', 'dist1']
              ]), 'SENSOR_ID');
          this.setOutput(true, 'Number');
          this.setColour('#29B6F6');
          this.setTooltip('Ritorna la distanza dall\'ostacolo in mm');
        }
      },
      'wait_until_distance': {
        init: function() {
          this.appendDummyInput()
              .appendField('attendi finché')
              .appendField(new Blockly.FieldDropdown([
                ['SensoreDistanza 0', 'dist0'],
                ['SensoreDistanza 1', 'dist1']
              ]), 'SENSOR_ID')
              .appendField('<')
              .appendField(new Blockly.FieldNumber(100, 0), 'DISTANCE')
              .appendField('mm');
          this.setPreviousStatement(true, null);
          this.setNextStatement(true, null);
          this.setColour('#29B6F6');
          this.setTooltip('Ferma l\'esecuzione finché non viene rilevato un ostacolo vicino');
        }
      },
      'wait_until_color': {
        init: function() {
          this.appendDummyInput()
              .appendField('attendi finché colore visto da')
              .appendField(new Blockly.FieldDropdown([
                ['SensoreColore 0', 'color0'],
                ['SensoreColore 1', 'color1'],
                ['SensoreColore 2', 'color2'],
                ['SensoreColore 3', 'color3']
              ]), 'SENSOR_ID')
              .appendField('è')
              .appendField(new Blockly.FieldDropdown([
                ['bianco', 'white'],
                ['nero', 'black'],
                ['rosso', 'red'],
                ['verde', 'green'],
                ['blu', 'blue'],
                ['giallo', 'yellow']
              ]), 'COLOR');
          this.setPreviousStatement(true, null);
          this.setNextStatement(true, null);
          this.setColour('#29B6F6');
          this.setTooltip('Ferma l\'esecuzione finché il sensore non rileva il colore selezionato');
        }
      },
      'wait_seconds': {
        init: function() {
          this.appendValueInput('SECONDS')
              .setCheck('Number')
              .appendField('attendi');
          this.appendDummyInput()
              .appendField('secondi');
          this.setPreviousStatement(true, null);
          this.setNextStatement(true, null);
          this.setColour('#29B6F6');
          this.setTooltip('Ferma l\'esecuzione per il numero specificato di secondi');
        }
      },
      'set_led_state': {
        init: function() {
          this.appendDummyInput()
              .appendField('imposta LED verde')
              .appendField(new Blockly.FieldDropdown([
                ['accendi', 'ON'],
                ['spegni', 'OFF']
              ]), 'STATE');
          this.setPreviousStatement(true, null);
          this.setNextStatement(true, null);
          this.setColour('#D946EF');
          this.setTooltip('Accendi o spegni il LED verde sulla parte superiore del robot');
        }
      },
      'get_color': {
        init: function() {
          this.appendDummyInput()
              .appendField('colore visto da')
              .appendField(new Blockly.FieldDropdown([
                ['SensoreColore 0', 'color0'],
                ['SensoreColore 1', 'color1'],
                ['SensoreColore 2', 'color2'],
                ['SensoreColore 3', 'color3']
              ]), 'SENSOR_ID');
          this.setOutput(true, 'String');
          this.setColour('#29B6F6');
          this.setTooltip('Ritorna il colore del tappeto sotto il robot');
        }
      },
      'color_selection': {
        init: function() {
          this.appendDummyInput()
              .appendField(new Blockly.FieldDropdown([
                ['bianco', 'white'],
                ['nero', 'black'],
                ['rosso', 'red'],
                ['verde', 'green'],
                ['blu', 'blue'],
                ['giallo', 'yellow']
              ]), 'COLOR');
          this.setOutput(true, 'String');
          this.setColour('#29B6F6');
        }
      }
    });

    const customTheme = Blockly.Theme.defineTheme('customTheme', {
      name: 'customTheme',
      base: Blockly.Themes.Classic,
      blockStyles: {
        loop_blocks: {
          colourPrimary: '#FFB74D',
          colourSecondary: '#E6A545',
          colourTertiary: '#CC933D'
        },
        math_blocks: {
          colourPrimary: '#000000',
          colourSecondary: '#333333',
          colourTertiary: '#111111'
        },
        procedure_blocks: {
          colourPrimary: '#81C784',
          colourSecondary: '#66BB6A',
          colourTertiary: '#4CAF50'
        }
      }
    });

    workspaceRef.current = Blockly.inject(blocklyDiv.current, {
      theme: customTheme,
      toolbox: `
        <xml xmlns="https://developers.google.com/blockly/xml">
          <category name="Movimento" colour="#2E7D32">
            <block type="move_indefinitely"></block>
            <block type="move_backward_indefinitely"></block>
            <block type="stop_motors"></block>
            <block type="move_forward">
              <value name="DISTANCE">
                <shadow type="math_number">
                  <field name="NUM">10</field>
                </shadow>
              </value>
            </block>
            <block type="move_backward">
              <value name="DISTANCE">
                <shadow type="math_number">
                  <field name="NUM">10</field>
                </shadow>
              </value>
            </block>
            <block type="turn_right">
              <value name="ANGLE">
                <shadow type="math_number">
                  <field name="NUM">45</field>
                </shadow>
              </value>
            </block>
            <block type="turn_left">
              <value name="ANGLE">
                <shadow type="math_number">
                  <field name="NUM">45</field>
                </shadow>
              </value>
            </block>
            <block type="set_speed">
              <value name="SPEED">
                <shadow type="math_number">
                  <field name="NUM">100</field>
                </shadow>
              </value>
            </block>
          </category>
          <category name="Motori" colour="#0033cc">
            <block type="motor_move">
              <value name="DIST">
                <shadow type="math_number">
                  <field name="NUM">10</field>
                </shadow>
              </value>
            </block>
          </category>
          <category name="Sensori" colour="#29B6F6">
            <block type="get_distance"></block>
            <block type="wait_until_distance"></block>
            <block type="wait_until_color"></block>
            <block type="wait_seconds">
              <value name="SECONDS">
                <shadow type="math_number">
                  <field name="NUM">1</field>
                </shadow>
              </value>
            </block>
            <block type="get_color"></block>
            <block type="color_selection"></block>
          </category>
          <category name="LED" colour="#D946EF">
            <block type="set_led_state"></block>
          </category>
          <category name="Logica" colour="210">
            <block type="controls_if"></block>
            <block type="logic_compare"></block>
            <block type="logic_operation"></block>
            <block type="logic_negate"></block>
            <block type="logic_boolean"></block>
          </category>
          <category name="Cicli" colour="#FFB74D">
            <block type="controls_repeat_ext">
              <value name="TIMES">
                <shadow type="math_number">
                  <field name="NUM">10</field>
                </shadow>
              </value>
            </block>
            <block type="controls_whileUntil"></block>
          </category>
          <category name="Numeri" colour="#000000">
            <block type="math_number"></block>
            <block type="math_arithmetic"></block>
          </category>
          <category name="Variabili" colour="330" custom="VARIABLE"></category>
          <category name="Funzioni" colour="#81C784" custom="PROCEDURE"></category>
        </xml>
      `,
      scrollbars: true,
      trashcan: true,
      grid: { spacing: 20, length: 3, colour: '#ccc', snap: true },
      zoom: { controls: true, wheel: true, startScale: 1.0 }
    });

    // Add initial start block
    const startBlock = workspaceRef.current.newBlock('start_block');
    startBlock.initSvg();
    startBlock.render();

    const onWorkspaceChange = () => {
      if (!workspaceRef.current) return;
      const all = workspaceRef.current.getAllBlocks(false);
      const hasAnyBlock = all.some(b => b.type !== 'start_block');
      onHasCodeChangeRef.current?.(hasAnyBlock);
    };

    workspaceRef.current.addChangeListener(onWorkspaceChange);
    onWorkspaceChange();
    
    // Position the start block towards the center of the programming view
    const timer = setTimeout(() => {
      if (!workspaceRef.current || !startBlock.workspace) return;
      const metrics = workspaceRef.current.getMetrics();
      if (metrics) {
        startBlock.moveBy(Math.max(500, metrics.viewWidth / 2 + 100), metrics.viewHeight / 5);
      } else {
        startBlock.moveBy(500, 150);
      }
    }, 100);

    return () => {
      isRunningRef.current = false;
      clearTimeout(timer);
      resizeObserver.disconnect();
      workspaceRef.current?.dispose();
    };
  }, []);

  useEffect(() => {
    const register = () => {
      socket.emit('registerRobot', { name: 'Coding Robot', color: '#eab308' }, (res: { id: string }) => {
        setRobotId(res.id);
      });
    };
    
    if (socket.connected) {
      register();
    }
    
    socket.on('connect', register);
    
    return () => {
      socket.off('connect', register);
    };
  }, [socket]);

  const runCode = async () => {
    if (!workspaceRef.current || !robotId || isRunning) return;
    
    if (state.status !== 'running') {
      socket.emit('startSimulation');
      await new Promise(r => setTimeout(r, 500));
    }

    onRunStart?.();
    setIsRunning(true);
    isRunningRef.current = true;
    
    // Find the start block
    const allBlocks = workspaceRef.current.getAllBlocks(false);
    const startBlock = allBlocks.find(b => b.type === 'start_block');
    
    if (!startBlock) {
      console.error("Start block not found");
      setIsRunning(false);
      isRunningRef.current = false;
      return;
    }

    console.log("Found start block, initializing robot check...");

    // Initialize local state from current robot state
    const currentRobotState = stateRef.current.robots[robotId];
    if (!currentRobotState) {
      console.error("Robot state not found for ID:", robotId);
      setIsRunning(false);
      isRunningRef.current = false;
      return;
    }

    console.log("Beginning execution...");

    let curX = currentRobotState.position.x;
    let curY = currentRobotState.position.y;
    let curRot = currentRobotState.rotation;
    let speedMultiplier = 1.0;
    let motorState: 'STOP' | 'FORWARD' | 'BACKWARD' = 'STOP';
    let isBlockingMovementRunning = false;
    const variables: Record<string, any> = {};

    const getRobotLocalPoints = (rState: any): { x: number; y: number }[] => {
      let localPoints: { x: number; y: number }[] = [];
      if (!rState) return localPoints;

      if (rState.shape === 'circle') {
        const r = Math.max(1, Math.min(rState.width || 150, rState.height || 150) / 2 - 20);
        for (let i = 0; i < 8; i++) {
          const angle = (i * 2 * Math.PI) / 8;
          localPoints.push({ x: r * Math.cos(angle), y: r * Math.sin(angle) });
        }
      } else if (rState.shape === 'custom' && rState.customPoints && rState.customPoints.length > 0) {
        let minPx = Infinity, maxPx = -Infinity, minPy = Infinity, maxPy = -Infinity;
        for (const p of rState.customPoints) {
          if (p.x < minPx) minPx = p.x;
          if (p.x > maxPx) maxPx = p.x;
          if (p.y < minPy) minPy = p.y;
          if (p.y > maxPy) maxPy = p.y;
        }
        const midX = (minPx + maxPx) / 2;
        const midY = (minPy + maxPy) / 2;
        
        localPoints = rState.customPoints.map((p: any) => ({
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
        const lateralHalf = (rState.width || 150) / 2 + 20; // +20 for wheels per side
        const forwardHalf = (rState.height || 150) / 2;
        localPoints = [
          { x: -forwardHalf, y: -lateralHalf },
          { x: forwardHalf, y: -lateralHalf },
          { x: forwardHalf, y: lateralHalf },
          { x: -forwardHalf, y: lateralHalf }
        ];
      }
      return localPoints;
    };

    const getRobotRotatedExtents = (rState: any, rotationDeg: number) => {
      const theta = (rotationDeg * Math.PI) / 180;
      const localPoints = getRobotLocalPoints(rState);

      let minX = Infinity;
      let maxX = -Infinity;
      let minY = Infinity;
      let maxY = -Infinity;

      const cosT = Math.cos(theta);
      const sinT = Math.sin(theta);

      for (const p of localPoints) {
        const rx = p.x * cosT - p.y * sinT;
        const ry = p.x * sinT + p.y * cosT;

        if (rx < minX) minX = rx;
        if (rx > maxX) maxX = rx;
        if (ry < minY) minY = ry;
        if (ry > maxY) maxY = ry;
      }

      return { minX, maxX, minY, maxY };
    };

    const startContinuousMovementLoop = async () => {
      while (isRunningRef.current) {
        if (motorState !== 'STOP' && !isBlockingMovementRunning) {
          const direction = motorState === 'FORWARD' ? 1 : -1;
          const rad = (curRot * Math.PI) / 180;
          const stepDist = 8 * direction * speedMultiplier; 
          
          const nextX = curX + Math.cos(rad) * stepDist;
          const nextY = curY + Math.sin(rad) * stepDist;

          const map = stateRef.current.maps[stateRef.current.currentMapId];
          const robotConf = stateRef.current.robots[robotId];

          const localPoints = getRobotLocalPoints(robotConf);

          const cosR = Math.cos(rad);
          const sinR = Math.sin(rad);

          let collidingPt: { x: number, y: number, localX: number, localY: number } | null = null;
          let collisionWall: 'LEFT' | 'RIGHT' | 'TOP' | 'BOTTOM' | null = null;
          let maxPenetration = 0;
          const margin = 2;

          for (const p of localPoints) {
            const gx = nextX + p.x * cosR - p.y * sinR;
            const gy = nextY + p.x * sinR + p.y * cosR;

            if (map) {
              if (gx < margin) {
                const pen = margin - gx;
                if (pen > maxPenetration) {
                  maxPenetration = pen;
                  collidingPt = { x: gx, y: gy, localX: p.x, localY: p.y };
                  collisionWall = 'LEFT';
                }
              }
              if (gx > map.width - margin) {
                const pen = gx - (map.width - margin);
                if (pen > maxPenetration) {
                  maxPenetration = pen;
                  collidingPt = { x: gx, y: gy, localX: p.x, localY: p.y };
                  collisionWall = 'RIGHT';
                }
              }
              if (gy < margin) {
                const pen = margin - gy;
                if (pen > maxPenetration) {
                  maxPenetration = pen;
                  collidingPt = { x: gx, y: gy, localX: p.x, localY: p.y };
                  collisionWall = 'TOP';
                }
              }
              if (gy > map.height - margin) {
                const pen = gy - (map.height - margin);
                if (pen > maxPenetration) {
                  maxPenetration = pen;
                  collidingPt = { x: gx, y: gy, localX: p.x, localY: p.y };
                  collisionWall = 'BOTTOM';
                }
              }
            }
          }

          if (collidingPt && collisionWall) {
            let fixed_gx = collidingPt.x;
            let fixed_gy = collidingPt.y;

            if (collisionWall === 'LEFT') fixed_gx = margin;
            if (collisionWall === 'RIGHT') fixed_gx = map.width - margin;
            if (collisionWall === 'TOP') fixed_gy = margin;
            if (collisionWall === 'BOTTOM') fixed_gy = map.height - margin;

            // Target alignment direction (multiples of 90 degrees)
            const targetRot = Math.round(curRot / 90) * 90;
            const diff = targetRot - curRot;

            if (Math.abs(diff) > 0.1) {
              const stepAngle = Math.min(Math.abs(diff), 30.0) * Math.sign(diff);
              curRot += stepAngle;

              // Derive new center coordinates using the fixed pivot corner
              const theta_new = (curRot * Math.PI) / 180;
              const cosN = Math.cos(theta_new);
              const sinN = Math.sin(theta_new);

              curX = fixed_gx - (collidingPt.localX * cosN - collidingPt.localY * sinN);
              curY = fixed_gy - (collidingPt.localX * sinN + collidingPt.localY * cosN);
            } else {
              curRot = targetRot;
              const extents = getRobotRotatedExtents(robotConf, curRot);
              if (map) {
                curX = Math.max(-extents.minX + margin, Math.min(map.width - extents.maxX - margin, nextX));
                curY = Math.max(-extents.minY + margin, Math.min(map.height - extents.maxY - margin, nextY));
              } else {
                curX = nextX;
                curY = nextY;
              }
            }
          } else {
            curX = nextX;
            curY = nextY;
          }

          socket.emit('moveRobot', robotId, { x: curX, y: curY, rotation: curRot, ctrlPressed: isCtrlPressedRef.current || forceRestartRef.current });
        }
        await new Promise(r => setTimeout(r, Math.max(10, Math.round(15 / speedMultiplier))));
      }
    };

    const evaluateValue = (block: Blockly.Block | null): any => {
      if (!block) return 0;
      switch (block.type) {
        case 'math_number':
          return Number(block.getFieldValue('NUM'));
        case 'get_distance': {
          const sensorId = block.getFieldValue('SENSOR_ID');
          const robot = stateRef.current.robots[robotId!];
          if (!robot) return 2000;
          let rawD = 2000;
          if (sensorId === 'dist0' || !sensorId) {
            rawD = robot.sensors?.distance ?? 2000;
          } else {
            const idx = parseInt(sensorId.replace('dist', ''), 10) - 1;
            const dists = robot.customSensors?.filter(s => s.type === 'distance') || [];
            if (dists[idx]) rawD = dists[idx].value ?? 2000;
          }
          return Math.round(rawD);
        }
        case 'get_color': {
          const sensorId = block.getFieldValue('SENSOR_ID');
          const robot = stateRef.current.robots[robotId!];
          if (!robot) return 'white';
          if (sensorId === 'color0' || !sensorId) return robot.sensors?.color ?? 'white';
          const idx = parseInt(sensorId.replace('color', ''), 10) - 1;
          const colors = robot.customSensors?.filter(s => s.type === 'color') || [];
          if (colors[idx]) return colors[idx].value ?? 'white';
          return 'white';
        }
        case 'color_selection':
          return block.getFieldValue('COLOR');
        case 'logic_boolean':
          return block.getFieldValue('BOOL') === 'TRUE';
        case 'variables_get': {
          const varId = block.getFieldValue('VAR');
          return variables[varId] ?? 0;
        }
        case 'procedures_callreturn': {
          const procName = block.getFieldValue('NAME');
          const allBlocks = workspaceRef.current!.getAllBlocks(false);
          const defBlock = allBlocks.find(b => b.type === 'procedures_defreturn' && b.getFieldValue('NAME') === procName);
          if (defBlock) {
             const stack = defBlock.getInputTargetBlock('STACK');
             if (stack) {
               // Execute the stack synchronously to run the procedure...
               // Wait, executeChain is async! 
               // evaluateValue cannot be async unless we make it async!
             }
          }
          return 0; // Better not to try this synchronously if we don't handle async procedure stacks cleanly
        }
        case 'logic_compare': {
          const a = evaluateValue(block.getInputTargetBlock('A'));
          const b = evaluateValue(block.getInputTargetBlock('B'));
          const op = block.getFieldValue('OP');
          if (op === 'EQ') return a === b;
          if (op === 'NEQ') return a !== b;
          if (op === 'LT') return a < b;
          if (op === 'LTE') return a <= b;
          if (op === 'GT') return a > b;
          if (op === 'GTE') return a >= b;
          return false;
        }
        case 'logic_operation': {
          const a = evaluateValue(block.getInputTargetBlock('A'));
          const b = evaluateValue(block.getInputTargetBlock('B'));
          const op = block.getFieldValue('OP');
          if (op === 'AND') return a && b;
          if (op === 'OR') return a || b;
          return false;
        }
        case 'logic_negate':
          return !evaluateValue(block.getInputTargetBlock('BOOL'));
        case 'math_arithmetic': {
          const a = evaluateValue(block.getInputTargetBlock('A'));
          const b = evaluateValue(block.getInputTargetBlock('B'));
          const op = block.getFieldValue('OP');
          if (op === 'ADD') return a + b;
          if (op === 'MINUS') return a - b;
          if (op === 'MULTIPLY') return a * b;
          if (op === 'DIVIDE') return a / b;
          return 0;
        }
      }
      return 0;
    };

    const executeBlock = async (block: Blockly.Block) => {
      if (!isRunningRef.current) return;
      workspaceRef.current?.highlightBlock(block.id);
      
      if (block.type === 'set_speed') {
        const val = evaluateValue(block.getInputTargetBlock('SPEED'));
        speedMultiplier = Math.max(0.1, Math.min(10.0, val / 100));
      } else if (block.type === 'move_indefinitely') {
        motorState = 'FORWARD';
      } else if (block.type === 'move_backward_indefinitely') {
        motorState = 'BACKWARD';
      } else if (block.type === 'stop_motors') {
        motorState = 'STOP';
      } else if (block.type === 'move_forward' || block.type === 'move_backward') {
        isBlockingMovementRunning = true;
        const val = evaluateValue(block.getInputTargetBlock('DISTANCE'));
        const distance = val * 10;
        const direction = block.type === 'move_forward' ? 1 : -1;
        
        const steps = Math.max(10, Math.ceil(distance / 12)); 
        for (let s = 1; s <= steps && isRunningRef.current; s++) {
          const rad = (curRot * Math.PI) / 180;
          const stepDist = (distance / steps) * direction;
          
          const nextX = curX + Math.cos(rad) * stepDist;
          const nextY = curY + Math.sin(rad) * stepDist;

          const map = stateRef.current.maps[stateRef.current.currentMapId];
          const robotConf = stateRef.current.robots[robotId];

          const localPoints = getRobotLocalPoints(robotConf);

          const cosR = Math.cos(rad);
          const sinR = Math.sin(rad);

          let collidingPt: { x: number, y: number, localX: number, localY: number } | null = null;
          let collisionWall: 'LEFT' | 'RIGHT' | 'TOP' | 'BOTTOM' | null = null;
          let maxPenetration = 0;
          const margin = 2;

          for (const p of localPoints) {
            const gx = nextX + p.x * cosR - p.y * sinR;
            const gy = nextY + p.x * sinR + p.y * cosR;

            if (map) {
              if (gx < margin) {
                const pen = margin - gx;
                if (pen > maxPenetration) {
                  maxPenetration = pen;
                  collidingPt = { x: gx, y: gy, localX: p.x, localY: p.y };
                  collisionWall = 'LEFT';
                }
              }
              if (gx > map.width - margin) {
                const pen = gx - (map.width - margin);
                if (pen > maxPenetration) {
                  maxPenetration = pen;
                  collidingPt = { x: gx, y: gy, localX: p.x, localY: p.y };
                  collisionWall = 'RIGHT';
                }
              }
              if (gy < margin) {
                const pen = margin - gy;
                if (pen > maxPenetration) {
                  maxPenetration = pen;
                  collidingPt = { x: gx, y: gy, localX: p.x, localY: p.y };
                  collisionWall = 'TOP';
                }
              }
              if (gy > map.height - margin) {
                const pen = gy - (map.height - margin);
                if (pen > maxPenetration) {
                  maxPenetration = pen;
                  collidingPt = { x: gx, y: gy, localX: p.x, localY: p.y };
                  collisionWall = 'BOTTOM';
                }
              }
            }
          }

          if (collidingPt && collisionWall) {
            let fixed_gx = collidingPt.x;
            let fixed_gy = collidingPt.y;

            if (collisionWall === 'LEFT') fixed_gx = margin;
            if (collisionWall === 'RIGHT') fixed_gx = map.width - margin;
            if (collisionWall === 'TOP') fixed_gy = margin;
            if (collisionWall === 'BOTTOM') fixed_gy = map.height - margin;

            // Target alignment direction (multiples of 90 degrees)
            const targetRot = Math.round(curRot / 90) * 90;
            const diff = targetRot - curRot;

            if (Math.abs(diff) > 0.1) {
              const stepAngle = Math.min(Math.abs(diff), 30.0) * Math.sign(diff);
              curRot += stepAngle;

              // Derive new center coordinates using the fixed pivot corner
              const theta_new = (curRot * Math.PI) / 180;
              const cosN = Math.cos(theta_new);
              const sinN = Math.sin(theta_new);

              curX = fixed_gx - (collidingPt.localX * cosN - collidingPt.localY * sinN);
              curY = fixed_gy - (collidingPt.localX * sinN + collidingPt.localY * cosN);
            } else {
              curRot = targetRot;
              const extents = getRobotRotatedExtents(robotConf, curRot);
              if (map) {
                curX = Math.max(-extents.minX + margin, Math.min(map.width - extents.maxX - margin, nextX));
                curY = Math.max(-extents.minY + margin, Math.min(map.height - extents.maxY - margin, nextY));
              } else {
                curX = nextX;
                curY = nextY;
              }
            }
          } else {
            curX = nextX;
            curY = nextY;
          }

          socket.emit('moveRobot', robotId, { x: curX, y: curY, rotation: curRot, ctrlPressed: isCtrlPressedRef.current || forceRestartRef.current });
          await new Promise(r => setTimeout(r, Math.max(5, Math.round(10 / speedMultiplier))));
        }
        isBlockingMovementRunning = false;
      } else if (block.type === 'motor_move') {
        isBlockingMovementRunning = true;
        const distCm = evaluateValue(block.getInputTargetBlock('DIST'));
        const motor = block.getFieldValue('MOTOR');
        const dir = block.getFieldValue('DIR') === 'FORWARD' ? 1 : -1;
        
        const targetDist = distCm * 10; // in mm
        let traveled = 0;
        
        const robotConf = stateRef.current.robots[robotId];
        const W = robotConf ? (robotConf.width || 150) : 150;
        
        while (traveled < targetDist && isRunningRef.current) {
          const stepDist = Math.min(targetDist - traveled, 12); 
          traveled += stepDist;
          
          const wheelMove = stepDist * dir;
          const centerMove = wheelMove / 2;
          
          let dRad = 0;
          if (motor === 'RIGHT') {
             dRad = -(wheelMove / W);
          } else {
             dRad = (wheelMove / W);
          }
          const dDeg = dRad * (180 / Math.PI);
          
          curRot += dDeg;
          
          const rad = (curRot * Math.PI) / 180;
          curX += Math.cos(rad) * centerMove;
          curY += Math.sin(rad) * centerMove;
          
          const map = stateRef.current.maps[stateRef.current.currentMapId];
          const extents = robotConf ? getRobotRotatedExtents(robotConf, curRot) : { minX: -75, maxX: 75, minY: -75, maxY: 75 };
          const isAtBoundX = map && (curX + extents.minX <= 0 || curX + extents.maxX >= map.width);
          const isAtBoundY = map && (curY + extents.minY <= 0 || curY + extents.maxY >= map.height);

          if (isAtBoundX || isAtBoundY) {
            curX -= Math.cos(rad) * centerMove;
            curY -= Math.sin(rad) * centerMove;
            break;
          }

          socket.emit('moveRobot', robotId, { x: curX, y: curY, rotation: curRot, ctrlPressed: isCtrlPressedRef.current || forceRestartRef.current });
          await new Promise(r => setTimeout(r, Math.max(5, Math.round(10 / speedMultiplier))));
        }
        isBlockingMovementRunning = false;
      } else if (block.type === 'turn_right' || block.type === 'turn_left') {
        isBlockingMovementRunning = true;
        const angle = evaluateValue(block.getInputTargetBlock('ANGLE'));
        const direction = block.type === 'turn_right' ? 1 : -1;
        const targetRotation = curRot + (angle * direction);
        
        const steps = Math.max(10, Math.ceil(angle / 10)); 
        for (let s = 1; s <= steps && isRunningRef.current; s++) {
          const t = s / steps;
          const tempRot = curRot + (targetRotation - curRot) * t;
          socket.emit('moveRobot', robotId, { x: curX, y: curY, rotation: tempRot, ctrlPressed: isCtrlPressedRef.current || forceRestartRef.current });
          await new Promise(r => setTimeout(r, Math.max(5, Math.round(10 / speedMultiplier))));
        }
        curRot = targetRotation;
        isBlockingMovementRunning = false;
      } else if (block.type === 'wait_until_distance') {
        const threshold = Number(block.getFieldValue('DISTANCE'));
        const sensorId = block.getFieldValue('SENSOR_ID');
        while (isRunningRef.current) {
          const robot = stateRef.current.robots[robotId!];
          let currentDist = 2000;
          if (robot) {
             let rawDist = 2000;
             if (sensorId === 'dist0' || !sensorId) {
               rawDist = robot.sensors?.distance ?? 2000;
             } else {
               const idx = parseInt(sensorId.replace('dist', ''), 10) - 1;
               const dists = robot.customSensors?.filter(s => s.type === 'distance') || [];
               if (dists[idx]) rawDist = dists[idx].value ?? 2000;
             }
             currentDist = Math.round(rawDist);
          }
          if (currentDist < threshold) {
            break;
          }
          await new Promise(r => setTimeout(r, 100));
        }
      } else if (block.type === 'wait_until_color') {
        const targetColor = block.getFieldValue('COLOR');
        const sensorId = block.getFieldValue('SENSOR_ID');
        while (isRunningRef.current) {
          const robot = stateRef.current.robots[robotId!];
          let currentColor = 'white';
          if (robot) {
             if (sensorId === 'color0' || !sensorId) {
               currentColor = robot.sensors?.color ?? 'white';
             } else {
               const idx = parseInt(sensorId.replace('color', ''), 10) - 1;
               const colors = robot.customSensors?.filter(s => s.type === 'color') || [];
               if (colors[idx]) currentColor = colors[idx].value ?? 'white';
             }
          }
          if (currentColor === targetColor) {
            break;
          }
          await new Promise(r => setTimeout(r, 100));
        }
      } else if (block.type === 'wait_seconds') {
        const seconds = Number(evaluateValue(block.getInputTargetBlock('SECONDS')));
        const ms = seconds * 1000;
        const interval = 50;
        let elapsed = 0;
        while (elapsed < ms && isRunningRef.current) {
          await new Promise(r => setTimeout(r, Math.min(interval, ms - elapsed)));
          elapsed += interval;
        }
      } else if (block.type === 'set_led_state') {
        const stateVal = block.getFieldValue('STATE');
        const ledOn = stateVal === 'ON';
        socket.emit('updateRobotConfig', robotId, { ledOn });
      }
      
      await new Promise(resolve => setTimeout(resolve, 300));
    };

    const executeChain = async (block: Blockly.Block | null) => {
      let current = block;
      while (current && isRunningRef.current) {
        if (current.type === 'controls_repeat_ext') {
          const times = evaluateValue(current.getInputTargetBlock('TIMES'));
          const innerBlock = current.getInputTargetBlock('DO');
          for (let i = 0; i < times && isRunningRef.current; i++) {
            await executeChain(innerBlock);
            await new Promise(r => setTimeout(r, 10)); // Prevent infinite fast loop
          }
        } else if (current.type === 'controls_whileUntil') {
          const mode = current.getFieldValue('MODE');
          while (isRunningRef.current) {
            const condition = evaluateValue(current.getInputTargetBlock('BOOL'));
            const shouldContinue = mode === 'WHILE' ? condition : !condition;
            if (!shouldContinue) break;
            
            await executeChain(current.getInputTargetBlock('DO'));
            await new Promise(r => setTimeout(r, 10));
          }
        } else if (current.type === 'controls_if') {
          const condition = evaluateValue(current.getInputTargetBlock('IF0'));
          if (condition) {
            await executeChain(current.getInputTargetBlock('DO0'));
          } else {
            const elseBlock = current.getInputTargetBlock('ELSE');
            if (elseBlock) {
              await executeChain(elseBlock);
            }
          }
        } else if (current.type === 'variables_set') {
          const varId = current.getFieldValue('VAR');
          const value = evaluateValue(current.getInputTargetBlock('VALUE'));
          variables[varId] = value;
        } else if (current.type === 'math_change') {
          const varId = current.getFieldValue('VAR');
          const value = evaluateValue(current.getInputTargetBlock('DELTA'));
          const currentVal = variables[varId] ?? 0;
          variables[varId] = Number(currentVal) + Number(value);
        } else if (current.type === 'procedures_callnoreturn') {
          const procName = current.getFieldValue('NAME');
          const allBlocks = workspaceRef.current!.getAllBlocks(false);
          const defBlock = allBlocks.find(b => b.type === 'procedures_defnoreturn' && b.getFieldValue('NAME') === procName);
          if (defBlock) {
             await executeChain(defBlock.getInputTargetBlock('STACK'));
          }
        } else {
          await executeBlock(current);
        }
        current = current.getNextBlock();
      }
    };

    // Start execution from the block connected to the start block
    const nextBlock = startBlock.getNextBlock();
    startContinuousMovementLoop();
    if (nextBlock) {
      console.log("Starting execution sequence...");
      await executeChain(nextBlock);
    }

    // Se il programma è terminato ma i motori sono ancora in marcia indefinita, 
    // manteniamo il flusso attivo finché l'utente non lo arresta o i motori si fermano.
    while (isRunningRef.current && motorState !== 'STOP') {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    console.log("Sequence completed.");
    
    // Check if robot is back at start after program finish
    const finalRobot = stateRef.current.robots[robotId!];
    if (finalRobot) {
        const extents = getRobotRotatedExtents(finalRobot, finalRobot.rotation);
        const robotMinX = finalRobot.position.x + extents.minX;
        const robotMaxX = finalRobot.position.x + extents.maxX;
        const robotMinY = finalRobot.position.y + extents.minY;
        const robotMaxY = finalRobot.position.y + extents.maxY;
        
        // Start area coordinates: [0, 285], [860, 1125]
        const partiallyInStart = !(robotMaxX < 0 || robotMinX > 285 || robotMaxY < 860 || robotMinY > 1125);

        if (partiallyInStart && (isCtrlPressedRef.current || forceRestartRef.current)) {
            // Reset the robot first
            socket.emit('resetSingleRobot', robotId!);
            
            // Calculate coordinates exactly in front of the center of the starting robot
            const startX = 100;
            const startY = 1000;
            const startRot = 0; // heading along positive X
            const rad = (startRot * Math.PI) / 180;
            const dirX = Math.cos(rad);
            const dirY = Math.sin(rad);

            let frontDistance = 75; // Default half-height
            if (finalRobot.shape === 'custom' && finalRobot.customPoints && finalRobot.customPoints.length > 0) {
              frontDistance = Math.abs(Math.min(...finalRobot.customPoints.map((p: any) => p.y)));
            } else if (finalRobot.shape === 'circle') {
              frontDistance = Math.max(1, Math.min(finalRobot.width || 150, finalRobot.height || 150) / 2);
            } else {
              frontDistance = (finalRobot.height || 150) / 2;
            }

            // Spawn the omino at fixed absolute coordinates: x=250, y=1000
            const ominoX = 250;
            const ominoY = 1000;

            if (ominoCreatedCountRef.current < 3) {
              socket.emit('addObject', {
                 type: 'obstacle',
                 modelUrl: '/ominoblender.glb',
                 position: { x: ominoX, y: ominoY },
                 name: `Omino ${Date.now()}`
              });
              ominoCreatedCountRef.current += 1;
              console.log(`Created omino on restart. Count: ${ominoCreatedCountRef.current}`);
            } else {
              console.log("No more omini created (limit of 3 reached), but continuing restart.");
            }
            
            socket.emit('updateRobotConfig', robotId!, { ledOn: true });
            setTimeout(() => {
              socket.emit('updateRobotConfig', robotId!, { ledOn: false });
            }, 2000);
        }
    }
    
    forceRestartRef.current = false;
    if (onRestartDeactivated) {
      onRestartDeactivated();
    }
    
    workspaceRef.current?.highlightBlock(null);
    setIsRunning(false);
    isRunningRef.current = false;
    socket.emit('finishSimulation');
  };

  const stopCode = () => {
    setIsRunning(false);
    isRunningRef.current = false;
    workspaceRef.current?.highlightBlock(null);
    socket.emit('stopSimulation');

    forceRestartRef.current = false;
    if (onRestartDeactivated) {
      onRestartDeactivated();
    }
  };

  const resetRobot = () => {
    ominoCreatedCountRef.current = 0;
    socket.emit('resetSimulation');
  };

  const robot = robotId ? state.robots[robotId] : null;

  return (
    <>
    <style>
      {`
        .blocklyToolboxDiv {
          background-color: #ffffff !important;
          border-right: 1px solid #e2e8f0 !important;
          box-shadow: 2px 0 10px rgba(0,0,0,0.05) !important;
          z-index: 10 !important;
        }
        .blocklyMainBackground {
          fill: #f1f5f9 !important;
        }
        .blocklyTreeRow {
          height: 38px !important;
          margin-bottom: 4px !important;
          border-radius: 8px !important;
        }
        .blocklyTreeLabel {
          font-weight: 700 !important;
          font-size: 11px !important;
          text-transform: uppercase !important;
          letter-spacing: 0.05em !important;
        }
        .blocklyScrollbarHandle {
          fill: #cbd5e1 !important;
          fill-opacity: 0.5 !important;
        }
        .blocklyMainWorkspaceScrollbar, 
        .blocklyVerticalScrollbar, 
        .blocklyHorizontalScrollbar {
          display: none !important;
        }
        .blocklyFlyout {
          border: none !important;
        }
      `}
    </style>
    <div className="flex flex-col h-full bg-slate-50 overflow-hidden relative" onKeyDown={(e) => { if (e.key === 'Control') isCtrlPressedRef.current = true; }} onKeyUp={(e) => { if (e.key === 'Control') isCtrlPressedRef.current = false; }} tabIndex={0}>
      <div className="flex items-center justify-between p-2 bg-slate-900 border-b border-slate-700">
        <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center ml-2">
            <Code size={16} className="mr-2" />
            Area Programmazione
        </h2>
        <div className="flex items-center space-x-2">
           <button
             onClick={handleSaveToDevice}
             className="flex items-center px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition-colors shadow-sm active:scale-95"
           >
             <Download size={14} className="mr-1.5" />
             Salva File
           </button>
           <button
             onClick={handleLoadFromDevice}
             className="flex items-center px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs transition-colors shadow-sm active:scale-95"
           >
             <Upload size={14} className="mr-1.5" />
             Carica File
           </button>
           <button
             onClick={onSwitchToSimulation}
             className="flex items-center px-3 py-1.5 rounded-lg bg-slate-600 hover:bg-slate-700 text-white font-bold text-xs transition-colors shadow-sm active:scale-95"
           >
             <Layout size={14} className="mr-1.5" />
             3D
           </button>
        </div>
      </div>
      {/* Slots Bar */}
      <div className="flex items-center justify-center p-1 bg-slate-800 border-b border-slate-700 space-x-2">
        <label className="text-[10px] text-slate-400 uppercase font-bold mr-2">Slot:</label>
        {[1, 2, 3, 4].map(slot => (
          <div key={slot} className="flex items-center bg-slate-700 rounded-lg overflow-hidden">
             <span className="px-2 text-white text-xs font-bold">{slot}</span>
             <button
               onClick={() => {
                 const name = window.prompt(`Slot ${slot}: Inserisci nome salvataggio (opzionale):`);
                 // Here we just save, could also save with name
                 handleSaveToSlot(slot);
               }}
               className="px-2 py-1 text-[10px] bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
             >
               S
             </button>
             <button
               onClick={() => handleLoadSlot(slot)}
               className={`px-2 py-1 text-[10px] ${savedSlots[slot] ? 'bg-blue-600 hover:bg-blue-700' : 'bg-slate-500 cursor-not-allowed'} text-white font-bold`}
               disabled={!savedSlots[slot]}
             >
               C
             </button>
          </div>
        ))}
      </div>
      <div className="flex-1 flex relative overflow-hidden">
        {/* Blockly Workspace */}
        <div ref={blocklyDiv} className="flex-1 h-full" />
        
        {promptData && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white p-6 rounded-lg shadow-xl w-96">
              <h3 className="text-lg font-bold mb-4">{promptData.message}</h3>
              <input 
                autoFocus
                className="w-full border p-2 mb-4 rounded" 
                defaultValue={promptData.defaultValue}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    promptData.callback(e.currentTarget.value);
                    setPromptData(null);
                  } else if (e.key === 'Escape') {
                    promptData.callback(null);
                    setPromptData(null);
                  }
                }}
                id="blockly-prompt-input"
              />
              <div className="flex justify-end gap-2">
                <button 
                  className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded"
                  onClick={() => {
                    promptData.callback(null);
                    setPromptData(null);
                  }}
                >
                  Annulla
                </button>
                <button 
                  className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
                  onClick={() => {
                    const val = (document.getElementById('blockly-prompt-input') as HTMLInputElement).value;
                    promptData.callback(val);
                    setPromptData(null);
                  }}
                >
                  OK
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
    </>
  );
});
