<div align="center">

# SANTAMAN
### *Explosive Holiday Cheer!*

[![License: ISC](https://img.shields.io/badge/License-ISC-blue.svg)](https://opensource.org/licenses/ISC)
![Node Version](https://img.shields.io/badge/node-%3E%3D14.0.0-brightgreen)
![Festive Level](https://img.shields.io/badge/festive-100%25-red)

**A chaotic, Christmas-themed multiplayer arena game where being on the Naughty List means getting blown up.**

[Features](#features) • [How to Play](#how-to-play) • [Installation](#installation) • [Contributing](#contributing)

</div>

---

## Overview

**Santaman** is a fast-paced, grid-based action game inspired by classic *Bomberman* mechanics. Players step into the snowy boots of Santa (and his rivals) to drop explosive presents, blast away snowdrifts, and outsmart opponents in a battle for holiday supremacy.

Whether you're playing locally with friends or hosting a server for a festive showdown, the goal is simple: **Be the last Santa standing!**

**[Play Online Demo](https://santaman.onrender.com/)**

## Features

*   **Multiplayer Mayhem:** Support for online multiplayer via `socket.io` and local hotseat multiplayer (up to 4 players).
*   **Festive Arsenal:**
    *   **Bombs:** Classic timed explosives to clear paths and eliminate foes.
    *   **Snowdrifts (Crates):** Destructible barriers hiding surprise presents.
*   **Power-Ups (found in Presents):**
    *   **Speed Boost:** Dash through the snow faster.
    *   **Extra Bombs:** Carry and drop more bombs simultaneously.
    *   **Firepower:** Increase the blast radius of your explosions.
    *   **The Grinch's Touch (Death):** Instantly eliminates the greedy collector.
*   **Ghost Mode:** Death isn't the end! Eliminated players return as ghosts to haunt the living (roam freely through walls).
*   **Bot Support:** Configurable AI opponents for solo or mixed play.

## How to Play

### Controls

#### Online Multiplayer
| Action | Key |
| :--- | :--- |
| **Move** | **W, A, S, D** or **Arrow Keys** |
| **Drop Bomb** | **Space** or **Q** |
| **Pause** | **Esc** |

#### Local Game (Local Multiplayer)
*Controls for up to 4 players on a single device.*

| Player | Movement | Drop Bomb |
| :---: | :---: | :---: |
| **P1** | **W, A, S, D** | **Q** |
| **P2** | **Arrow Keys** | **Enter** |
| **P3** | **I, J, K, L** | **U** |
| **P4** | **Numpad 8, 4, 5, 6** | **Numpad 0** |

### Game Modes

#### Online Multiplayer
1.  **Host a Game:**
    *   Enter your name and click **"Host Game"**.
    *   Share the generated **Room ID** with your friends.
    *   Wait for players to join in the lobby.
    *   Click **"Start Game"** when ready!
2.  **Join a Game:**
    *   Enter your name and the **Room ID** shared by the host.
    *   Click **"Join Game"**.

#### Local Game
*   Select **"Local Game"** from the main menu.
*   **Add Players:** Enter names for up to 4 human players.
*   **Add AI Opponents:** To play against the computer, simply check the **"Computer"** box next to any player slot. You can then configure the bot's difficulty and behavior.
*   Start the game instantly on one device!

### Objective
1.  **Drop Bombs** near snowdrifts to blow them up.
2.  **Collect Presents** dropped from destroyed snowdrifts to get power-ups.
3.  **Trap Opponents** in your blast radius—but don't blow yourself up!
4.  **Survive:** The last player on the map wins!

---

## Installation & Setup

### Prerequisites
*   [Docker](https://www.docker.com/)
*   `make` (optional, for simplified commands)

### Developer Quick Start (Docker)

1.  **Clone the Repository**
    ```bash
    git clone https://gitea.kood.tech/petrkubec/npc.git santaman
    cd santaman
    ```

2.  **Run with Make**
    ```bash
    make build
    make run
    ```
    *The server will start on `http://localhost:3000`*

3.  **Play!**
    Open your browser and navigate to `http://localhost:3000`.

### Other Commands
*   `make test`: Run tests inside Docker.
*   `make lint`: Run lint checks inside Docker.
*   `make stop`: Stop the running container.



---

## Tech Stack

*   **Backend:** Node.js, Express, Socket.io (Real-time communication)
*   **Frontend:** HTML5, CSS3, Vanilla JavaScript (DOM manipulations for rendering)
*   **Testing:** Jest
*   **Linting:** ESLint, Prettier

---

## Contributing

We welcome elves of all skill levels to help build Santaman!

1.  **Fork** the repository.
2.  **Create a Branch** for your feature or bugfix (`git checkout -b feature/snow-cannons`).
3.  **Commit** your changes with clear messages.
4.  **Test** your changes (`npm test`).
5.  **Push** to your branch and open a **Pull Request**.

Please ensure your code follows the festive style guide (run `npm run lint` before submitting!).

---

## Authors

*   **Petr Kubec**
*   **Pauno Komulainen**
*   **Christian Asseburg**

---

## License

This project is licensed under the **ISC License**. Feel free to use, modify, and distribute with attribution.

---

<div align="center">

**Happy Coding & Happy Holidays!**
Is your code ready to be wrapped?

</div>
