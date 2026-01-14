export const ClientToServerMessageType = {
  STOP: 0,
  START_MOVE_LEFT: 1,
  START_MOVE_RIGHT: 2,
  START_MOVE_UP: 3,
  START_MOVE_DOWN: 4,
  PLACE_BOMB: 5,
  // No maximum currently. Must match gameComms.fromPlayer.
};
