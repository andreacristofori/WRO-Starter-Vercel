# WRO Starter Simulator

This is a real-time simulation server for the WRO Starter competition.

## Robot API

Your robots should connect to this server via **WebSocket** using standard `socket.io-client`.

### Connection
```javascript
import { io } from 'socket.io-client';
// Connect to the app URL
const socket = io('https://APP_URL'); 
```

### Events to Emit (Client -> Server)

- `registerRobot(data, callback)`: Register a new robot.
  - `data`: `{ name: 'MyRobot', color: '#ff0000' }`
  - `callback`: `(response) => { console.log(response.id) }`
- `moveRobot(robotId, positionData)`: Update robot position.
  - `positionData`: `{ x: 200, y: 150, rotation: 90 }`
- `interactObject(robotId, objectId, action)`: Interact with a field object.
  - `action`: `'collect'` or `'drop'`

### Events to Listens (Server -> Client)

- `stateUpdate(state)`: Sent on any change (movement, objects, timer).
- `simulationStarted()`: The simulation timer has begun.
- `simulationStopped()`: The simulation was stopped.

See `example-robot.ts` for a working client example!
