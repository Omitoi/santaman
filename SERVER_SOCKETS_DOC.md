# PPC Bomberman game - Server sockets communication documentation

Here is the list of all the commands that the server supports and the
signals it emits.

## Commands in the lobby

| Event          | Payload (client)                           | Who Sends                                         | Return value\*                                                       | What Happens Inside the Server                                                                                                                                                                                         |
| -------------- | ------------------------------------------ | ------------------------------------------------- | -------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **createGame** | `{ username: string }` _must be non‑empty_ | Any (becomes master)                              | `{ success:true, roomId:string, player:{ id:string, name:string } }` | Generates a unique `roomId`, stores a new entry in `games`, adds the master's socket to the Socket.IO room, records the master’s username, returns the `roomId` and the master’s player object.                        |
| **joinGame**   | `{ roomId:string, username:string }`       | Any non‑master client                             | `{ success:true, roomId:string, player:{ id:string, name:string } }` | Looks up the `roomId`. If the room exists, isn’t started, isn’t full, and the username is unique inside that room, the socket is added to the room, the username is stored, and a `playerJoined` broadcast is emitted. |
| **startGame**  | `{ roomId:string }`                        | Master client only (socket.id == stored masterId) | `{ success:true }`                                                   | Verifies the sender is the stored masterId, marks `started = true`, emits `gameStarted` to all participants – after this point `joinGame` will reject further attempts.                                                |

\* Note: if `success: false`, an additional field `error` with an error message is included (`{ success:false, error:string }`).

If a client **disconnects**, the server removes the socket from any rooms it belonged to. If the master leaves before the game starts, the whole room is cancelled and all remaining sockets are notified. Empty rooms are garbage‑collected.

## Signals emitted by the server

The `roomId` identifies the game (waiting to be started or ongoing). `playerId` is identical to `socket.id`.

| Signal                 | Room                     | Payload (JSON)                                                                                   | Notes                                                                                                                                                                      |
| ---------------------- | ------------------------ | ------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **playerJoined**       | `roomId`                 | `{ roomId:string, player:{ id:string, name:string }, roster:[{ id:..., name:... }], count:int }` | Sent after a successful `joinGame` (or after `createGame` for the master). `roster` holds the complete list of players in the room; `count` is the number of participants. |
| **playerLeft**         | `roomId`                 | `{ roomId:string, player:{ id:string, name:string }, roster:[{ id:..., name:... }], count:int }` | Emitted when a socket disconnects (or leaves).                                                                                                                             |
| **gameStarted**        | `roomId`                 | `{ roomId:string }`                                                                              | Emitted when the master calls `startGame`.                                                                                                                                 |
| **gameCancelled**      | `roomId`                 | `{ roomId:string, reason:string }`                                                               | Emitted if the master leaves before the game starts.                                                                                                                       |
| **error** _(optional)_ | `roomId` (if applicable) | `{ roomId:string, code:int, message:string. }`                                                   | Generic fallback for unexpected errors; front‑end can display `message`.                                                                                                   |
| **state**              | `roomId`                 | The value of gameEngine.getState()                                                               | Sent at the start of a game                                                                                                                                                |
| **G**                  | `roomId`                 | 4-byte message encoded/decoded in serverToClient.js                                              | Status updates sent from gameEngine via gameComms                                                                                                                          |

## Signals emitted by the client

The clients can send action messages during the game. The roomId and playerId are automatically
identified via the socket.

| Signal | Payload (JSON)     | Notes                                                                                                                                                      |
| ------ | ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **G**  | See clientToServer | These are individual actions usually corresponding to key presses. Movement should be indicated by a start message and concluded by sending a stop message |
