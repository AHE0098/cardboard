(() => {
  function ensureSocket() {
    if (window.io) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = "/socket.io/socket.io.js";
      s.onload = resolve;
      s.onerror = reject;
      document.body.appendChild(s);
    });
  }

  function createBattleClient(api) {
    let socket = null;
    return {
      async connect() {
        if (socket) return socket;
        await ensureSocket();
        socket = window.io("/battle");
        socket.on("room_state", ({ roomId, state, role }) => {
          const currentSession = api.getSession();
          const nextRole = role || currentSession.role;
          api.setBattleSession({ roomId: roomId || api.getBattleRoomId(), role: nextRole, state, viewRole: nextRole || api.getBattleViewRole() });
          api.onBattleStateChanged();
        });
        return socket;
      },
      async createRoom() {
        const s = await this.connect();
        return new Promise((resolve) => {
          const currentSession = api.getSession();
          s.emit("create_room", { playerId: currentSession.playerId, playerName: currentSession.playerName }, (res) => {
            if (res?.ok) {
              api.setBattleSession({ roomId: res.roomId, role: res.role, state: res.state, viewRole: res.role });
              api.persistPlayerSaveDebounced();
            }
            resolve(res);
          });
        });
      },
      async joinRoom(roomId) {
        const s = await this.connect();
        return new Promise((resolve) => {
          const currentSession = api.getSession();
          s.emit("join_room", { roomId, playerId: currentSession.playerId, playerName: currentSession.playerName }, (res) => {
            if (res?.ok) {
              api.setBattleSession({ roomId: res.roomId, role: res.role, state: res.state, viewRole: res.role });
              api.persistPlayerSaveDebounced();
            }
            resolve(res);
          });
        });
      },
      sendIntent(type, payload) {
        if (!socket || !api.getBattleRoomId() || !api.getBattleState()) return;
        const currentSession = api.getSession();
        const currentBattle = api.getBattleState();
        socket.emit("intent", {
          type,
          roomId: api.getBattleRoomId(),
          playerId: currentSession.playerId,
          clientActionId: api.uid(),
          baseVersion: currentBattle.version || 0,
          payload
        });
      },
      leaveRoom() {
        if (socket && api.getBattleRoomId()) socket.emit("leave_room", { roomId: api.getBattleRoomId() });
        api.setBattleSession({ roomId: "", role: null, state: null, viewRole: "p1" });
        api.onBattleLeaveRoom();
      }
    };
  }

  function renderBattleLobby({ host, lastBattleRoomId, onCreateRoom, onJoinRoom }) {
    const card = document.createElement("div");
    card.className = "menuCard";
    card.innerHTML = "<h3>Battle Room</h3>";

    const createBtn = document.createElement("button");
    createBtn.className = "menuBtn";
    createBtn.textContent = "Create room";
    createBtn.onclick = onCreateRoom;

    const input = document.createElement("input");
    input.className = "menuInput";
    input.placeholder = "Join room code";
    input.value = lastBattleRoomId || "";

    const joinBtn = document.createElement("button");
    joinBtn.className = "menuBtn";
    joinBtn.textContent = "Join room";
    joinBtn.onclick = () => onJoinRoom(input.value.trim().toUpperCase());

    const hint = document.createElement("div");
    hint.className = "zoneMeta";
    hint.textContent = "Create a room and share the code with your opponent to join from another device.";
    card.append(createBtn, input, joinBtn, hint);
    host.appendChild(card);
  }

  window.CardboardMeta = {
    createBattleClient,
    renderBattleLobby
  };
})();
