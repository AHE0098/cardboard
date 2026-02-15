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

  const normalizeRole = (role) => (role === "p1" || role === "p2" ? role : null);

  return {
    async connect() {
      if (socket) return socket;
      await ensureSocket();
      socket = window.io("/battle");

      socket.on("room_state", ({ roomId, state, role }) => {
        const currentSession = api.getSession();
        const pid = currentSession.playerId;

        let derived = null;
        if (state?.players?.p1?.id === pid) derived = "p1";
        else if (state?.players?.p2?.id === pid) derived = "p2";

        const nextRole = role || derived || currentSession.role;

        // keep current viewRole unless it's empty
const prevRole = currentSession.role;      // what we thought before this message
let nextViewRole = api.getBattleViewRole();

// If we don't yet have a role (first join / fresh load), OR view was following old role,
// then snap view to the newly-determined role.
if (!prevRole || !nextViewRole || nextViewRole === prevRole) {
  nextViewRole = nextRole || nextViewRole || "p1";
}


        api.setBattleSession({
          roomId: roomId || api.getBattleRoomId(),
          role: nextRole,
          state,
          viewRole: nextViewRole
        });

        api.onBattleStateChanged();
      });

      socket.on("room_closed", ({ roomId }) => {
        if (roomId && roomId === api.getBattleRoomId()) {
          api.setBattleSession({ roomId: "", role: null, state: null, viewRole: "p1" });
          api.onBattleLeaveRoom();
          api.onBattleStateChanged();
        }
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
        s.emit(
          "create_room",
          {
            playerId: currentSession.playerId,
            playerName: currentSession.playerName,
            roomId: String(roomId || "").trim().toUpperCase()
          },
          (res) => {
            if (res?.ok) {
              api.setBattleSession({ roomId: res.roomId, role: res.role, state: res.state, viewRole: res.role });
              api.persistPlayerSaveDebounced();
            }
            resolve(res);
          }
        );
      });
    },

    async joinRoom(roomId, preferredRole = null) {
      const s = await this.connect();
      return new Promise((resolve) => {
        const currentSession = api.getSession();
        s.emit(
          "join_room",
          {
            roomId,
            preferredRole: normalizeRole(preferredRole),
            playerId: currentSession.playerId,
            playerName: currentSession.playerName
          },
          (res) => {
            if (res?.ok) {
              api.setBattleSession({ roomId: res.roomId, role: res.role, state: res.state, viewRole: res.role });
              api.persistPlayerSaveDebounced();
            }
            resolve(res);
          }
        );
      });
    },

    async deleteRoom(roomId) {
      const s = await this.connect();
      const normalized = String(roomId || "").trim().toUpperCase();
      return new Promise((resolve) => {
        s.emit("delete_room", { roomId: normalized }, resolve);
      });
    },

    async deleteAllRooms() {
      const s = await this.connect();
      return new Promise((resolve) => {
        s.emit("delete_all_rooms", {}, resolve);
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


  function renderBattleLobby({ host, lastBattleRoomId, openRooms = [], isBusy = false, onCreateRoom, onJoinRoom, onRefreshRooms, onDeleteRoom, onDeleteAllRooms }) {
    const card = document.createElement("div");
    card.className = "menuCard";
    card.innerHTML = "<h3>Battle Room</h3>";

    const input = document.createElement("input");
    input.className = "menuInput";
    input.placeholder = "Room code (create, join, delete)";
    input.value = lastBattleRoomId || "";

    const roleSelect = document.createElement("select");
    roleSelect.className = "menuInput";
    roleSelect.innerHTML = `
      <option value="p2">Join as Player 2</option>
      <option value="p1">Join as Player 1</option>
    `;

    const normalizeRoomCode = (value) => String(value || "").trim().toUpperCase();
    const findOpenRoom = (code) => openRooms.find((r) => r.roomId === normalizeRoomCode(code));

    const pickAvailableRole = (room, preferred) => {
      if (!room) return preferred;
      const wantP1 = preferred === "p1";
      const wantP2 = preferred === "p2";
      if (wantP1) {
        if (!room.p1) return "p1";
        if (!room.p2) return "p2";
        return null;
      }
      if (wantP2) {
        if (!room.p2) return "p2";
        if (!room.p1) return "p1";
        return null;
      }
      if (!room.p2) return "p2";
      if (!room.p1) return "p1";
      return null;
    };

    const syncRoleSelect = () => {
      const room = findOpenRoom(input.value);
      const p1Opt = roleSelect.querySelector('option[value="p1"]');
      const p2Opt = roleSelect.querySelector('option[value="p2"]');
      if (!p1Opt || !p2Opt) return;

      if (!room) {
        p1Opt.disabled = false;
        p2Opt.disabled = false;
        return;
      }

      p1Opt.disabled = !!room.p1;
      p2Opt.disabled = !!room.p2;
      const nextRole = pickAvailableRole(room, roleSelect.value);
      if (nextRole) roleSelect.value = nextRole;
    };

    const createBtn = document.createElement("button");
    createBtn.className = "menuBtn";
    createBtn.textContent = "Create room";
    createBtn.onclick = () => onCreateRoom(input.value.trim().toUpperCase());
    createBtn.disabled = !!isBusy;

    const joinBtn = document.createElement("button");
    joinBtn.className = "menuBtn";
    joinBtn.textContent = "Join room";
    joinBtn.onclick = () => onJoinRoom(input.value.trim().toUpperCase(), roleSelect.value);
    joinBtn.disabled = !!isBusy;

    const deleteBtn = document.createElement("button");
    deleteBtn.className = "menuBtn";
    deleteBtn.textContent = "Delete this game";
    deleteBtn.onclick = () => onDeleteRoom?.(input.value.trim().toUpperCase());
    deleteBtn.disabled = !!isBusy;

    const deleteAllBtn = document.createElement("button");
    deleteAllBtn.className = "menuBtn";
    deleteAllBtn.textContent = "Delete all games";
    deleteAllBtn.onclick = () => onDeleteAllRooms?.();
    deleteAllBtn.disabled = !!isBusy;

    input.addEventListener("keydown", (e) => {
      if (e.key !== "Enter") return;
      const roomCode = normalizeRoomCode(input.value);
      const room = findOpenRoom(roomCode);
      const safeRole = pickAvailableRole(room, roleSelect.value);
      if (!roomCode || !safeRole) return;
      roleSelect.value = safeRole;
      onJoinRoom(roomCode, safeRole);
    });
    input.addEventListener("input", syncRoleSelect);

    const hint = document.createElement("div");
    hint.className = "zoneMeta";
    hint.textContent = "Choose your player seat before joining. Rooms stay open until deleted.";

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
    refreshBtn.disabled = !!isBusy;

    const list = document.createElement("div");
    list.style.marginTop = "8px";
    if (!openRooms.length) {
      const empty = document.createElement("div");
      empty.textContent = "No open games right now.";
      empty.style.opacity = "0.8";
      list.appendChild(empty);
    } else {
      openRooms.forEach((room) => {
        const row = document.createElement("div");
        row.style.marginTop = "6px";

        const title = document.createElement("div");
        title.textContent = `${room.roomId} — ${room.p1 ? "P1 filled" : "P1 open"}, ${room.p2 ? "P2 filled" : "P2 open"}`;

        const joinP1 = document.createElement("button");
        joinP1.className = "menuBtn";
        joinP1.textContent = `Join ${room.roomId} as P1`;
        joinP1.disabled = !!room.p1 || !!isBusy;
        joinP1.onclick = () => onJoinRoom(room.roomId, "p1");

        const joinP2 = document.createElement("button");
        joinP2.className = "menuBtn";
        joinP2.textContent = `Join ${room.roomId} as P2`;
        joinP2.disabled = !!room.p2 || !!isBusy;
        joinP2.onclick = () => onJoinRoom(room.roomId, "p2");

        row.append(title, joinP1, joinP2);
        list.appendChild(row);
      });
    }

    listCard.append(listTitle, refreshBtn, list);

    if (isBusy) {
      const busy = document.createElement("div");
      busy.className = "zoneMeta";
      busy.style.marginTop = "8px";
      busy.textContent = "Working… please wait";
      card.appendChild(busy);
    }

    card.append(input, roleSelect, createBtn, joinBtn, deleteBtn, deleteAllBtn, hint, listCard);
    host.appendChild(card);
  }

  window.CardboardMeta = {
    createBattleClient,
    renderBattleLobby
  };
})();
