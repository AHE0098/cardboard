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
    let openRooms = [];
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
        socket.on("rooms_list", ({ rooms }) => {
          openRooms = Array.isArray(rooms) ? rooms : [];
          api.onRoomsListChanged?.(openRooms);
        });
        return socket;
      },
      async refreshRoomsList() {
        const s = await this.connect();
        s.emit("rooms_list_request", {});
        return openRooms;
      },
      getOpenRooms() {
        return [...openRooms];
      },
      async createRoom(roomId = "") {
        const s = await this.connect();
        return new Promise((resolve) => {
          const currentSession = api.getSession();
          s.emit("create_room", {
            playerId: currentSession.playerId,
            playerName: currentSession.playerName,
            roomId: String(roomId || "").trim().toUpperCase()
          }, (res) => {
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

  function renderBattleLobby({ host, lastBattleRoomId, openRooms = [], onCreateRoom, onJoinRoom, onRefreshRooms }) {
    const card = document.createElement("div");
    card.className = "menuCard";
    card.innerHTML = "<h3>Battle Room</h3>";

    const input = document.createElement("input");
    input.className = "menuInput";
    input.placeholder = "Room code (create or join)";
    input.value = lastBattleRoomId || "";

    const createBtn = document.createElement("button");
    createBtn.className = "menuBtn";
    createBtn.textContent = "Create room";
    createBtn.onclick = () => onCreateRoom(input.value.trim().toUpperCase());

    const joinBtn = document.createElement("button");
    joinBtn.className = "menuBtn";
    joinBtn.textContent = "Join room";
    joinBtn.onclick = () => onJoinRoom(input.value.trim().toUpperCase());

    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") onJoinRoom(input.value.trim().toUpperCase());
    });

    const hint = document.createElement("div");
    hint.className = "zoneMeta";
    hint.textContent = "Type a room code to create a named room or join an existing one.";

    const listCard = document.createElement("div");
    listCard.className = "zoneMeta";
    listCard.style.marginTop = "12px";

    const listTitle = document.createElement("div");
    listTitle.style.fontWeight = "600";
    listTitle.textContent = "Open games";

    const refreshBtn = document.createElement("button");
    refreshBtn.className = "menuBtn";
    refreshBtn.style.marginTop = "8px";
    refreshBtn.textContent = "Refresh open games";
    refreshBtn.onclick = () => onRefreshRooms?.();

    const list = document.createElement("div");
    list.style.marginTop = "8px";
    if (!openRooms.length) {
      const empty = document.createElement("div");
      empty.textContent = "No open games right now.";
      empty.style.opacity = "0.8";
      list.appendChild(empty);
    } else {
      openRooms.forEach((room) => {
        const btn = document.createElement("button");
        btn.className = "menuBtn";
        btn.style.width = "100%";
        btn.style.marginTop = "6px";
        btn.textContent = `Join ${room.roomId}`;
        btn.onclick = () => onJoinRoom(room.roomId);
        list.appendChild(btn);
      });
    }

    listCard.append(listTitle, refreshBtn, list);

    card.append(input, createBtn, joinBtn, hint, listCard);
    host.appendChild(card);
  }

  window.CardboardMeta = {
    createBattleClient,
    renderBattleLobby
  };
})();
