/*
Screen + data architecture:
- uiScreen: playerMenu -> mainMenu -> mode
- appMode: sandbox | battle | deckbuilder
- localStorage keys:
  - cb_players: { players:[{id,name,createdAt,lastSeenAt}], lastPlayerId }
  - cb_save_<playerId>: { lastMode, sandboxState, lastBattleRoomId, updatedAt }
- Battle networking uses Socket.IO with a server-authoritative room state and client intents.
*/

(() => {
  const boot = () => {
    const root = document.getElementById("root");
    const subtitle = document.getElementById("subtitle");
    const dragLayer = document.getElementById("dragLayer");
    if (!root || !subtitle || !dragLayer) throw new Error("Missing required DOM roots");

    const PLAYER_KEY = "cb_players";
    const SAVE_PREFIX = "cb_save_";
    const ALL_ZONES = ["permanents", "lands", "hand", "stack", "deck", "graveyard"];
    const SHARED_ZONES = ["lands", "permanents", "stack"];
    const PRIVATE_ZONES = ["hand", "deck", "graveyard"];
    const demo = window.DEMO_STATE || { zones: { hand: [], lands: [], permanents: [] }, tapped: {}, tarped: {} };

    let uiScreen = "playerMenu";
    let appMode = null;
    let view = { type: "board" };
    let dragging = null;
    let inspector = null;

    let session = { playerId: null, playerName: null, role: null };
    let playerRegistry = loadPlayerRegistry();
    let saveTimer = null;

    let sandboxState = createSandboxState();

    let battleState = null;
    let battleRoomId = "";
    let battleClient = createBattleClient();

    const topBackBtn = document.createElement("button");
    topBackBtn.className = "topBackBtn";
    topBackBtn.textContent = "Back";
    document.querySelector(".topbar")?.insertBefore(topBackBtn, subtitle);
    topBackBtn.addEventListener("click", onBack);

    function uid() {
      return (window.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`);
    }

    function clone(x) { return JSON.parse(JSON.stringify(x)); }

    function createSeedDeck(offset = 0) {
      const seed = [200, 201, 202, 203, 204, 205, 210, 211, 212, 213, 220, 221, 222, 230, 231, 240, 241, 101, 102, 103, 104, 105];
      return seed.map((_, i) => seed[(i + offset) % seed.length]);
    }

    function createSandboxState() {
      return {
        zones: {
          permanents: [...(demo.zones?.permanents || [])],
          lands: [...(demo.zones?.lands || [])],
          hand: [...(demo.zones?.hand || [])],
          stack: [],
          deck: createSeedDeck(),
          graveyard: []
        },
        tapped: clone(demo.tapped || {}),
        tarped: clone(demo.tarped || {})
      };
    }

    function loadPlayerRegistry() {
      try {
        const parsed = JSON.parse(localStorage.getItem(PLAYER_KEY) || "{}");
        return {
          players: Array.isArray(parsed.players) ? parsed.players : [],
          lastPlayerId: parsed.lastPlayerId || null
        };
      } catch {
        return { players: [], lastPlayerId: null };
      }
    }

    function savePlayerRegistry() {
      localStorage.setItem(PLAYER_KEY, JSON.stringify(playerRegistry));
    }

    function getSaveKey(playerId) { return `${SAVE_PREFIX}${playerId}`; }

    function loadPlayerSave(playerId) {
      try {
        return JSON.parse(localStorage.getItem(getSaveKey(playerId)) || "{}");
      } catch {
        return {};
      }
    }

    function persistPlayerSaveDebounced() {
      if (!session.playerId) return;
      clearTimeout(saveTimer);
      saveTimer = setTimeout(() => {
        const prev = loadPlayerSave(session.playerId);
        const payload = {
          ...prev,
          lastMode: appMode || prev.lastMode || "sandbox",
          sandboxState,
          lastBattleRoomId: battleRoomId || prev.lastBattleRoomId || "",
          updatedAt: Date.now()
        };
        localStorage.setItem(getSaveKey(session.playerId), JSON.stringify(payload));
      }, 500);
    }

    function setActivePlayer(player) {
      session.playerId = player.id;
      session.playerName = player.name;
      player.lastSeenAt = Date.now();
      playerRegistry.lastPlayerId = player.id;
      savePlayerRegistry();
      const save = loadPlayerSave(player.id);
      sandboxState = save.sandboxState ? clone(save.sandboxState) : createSandboxState();
      appMode = null;
      uiScreen = "mainMenu";
      renderApp();
    }

    function createPlayer(name) {
      const trimmed = (name || "").trim();
      if (!trimmed) return;
      const existing = playerRegistry.players.find((p) => p.name.toLowerCase() === trimmed.toLowerCase());
      if (existing) return setActivePlayer(existing);
      const now = Date.now();
      const p = { id: uid(), name: trimmed, createdAt: now, lastSeenAt: now };
      playerRegistry.players.push(p);
      savePlayerRegistry();
      setActivePlayer(p);
    }

    function onBack() {
      if (uiScreen === "mode") {
        if (appMode === "sandbox") persistPlayerSaveDebounced();
        if (appMode === "battle") battleClient.leaveRoom();
        uiScreen = "mainMenu";
        appMode = null;
      } else if (uiScreen === "mainMenu") {
        uiScreen = "playerMenu";
      }
      renderApp();
    }

    function cardName(cardId) {
      return window.CARD_REPO?.[String(cardId)]?.name || `Card ${cardId}`;
    }

    function modeState() {
      return appMode === "battle" ? battleState : sandboxState;
    }

    function getZoneOwner(zoneKey) {
      if (appMode !== "battle") return "solo";
      return SHARED_ZONES.includes(zoneKey) ? "shared" : (session.role || "p1");
    }

    function getZone(zoneKey) {
      const s = modeState();
      if (!s) return [];
      if (appMode === "battle") {
        if (SHARED_ZONES.includes(zoneKey)) return s.sharedZones[zoneKey] || [];
        return s.players?.[session.role]?.zones?.[zoneKey] || [];
      }
      return s.zones[zoneKey] || [];
    }

    function setZone(zoneKey, arr) {
      const s = modeState();
      if (!s) return;
      if (appMode === "battle") {
        if (SHARED_ZONES.includes(zoneKey)) s.sharedZones[zoneKey] = arr;
        else s.players[session.role].zones[zoneKey] = arr;
      } else {
        s.zones[zoneKey] = arr;
        persistPlayerSaveDebounced();
      }
    }

    function toggleMark(cardId, kind) {
      const s = modeState();
      s[kind][cardId] = !s[kind][cardId];
      if (appMode === "battle") {
        battleClient.sendIntent("TOGGLE_TAP", { cardId, kind });
      } else {
        persistPlayerSaveDebounced();
      }
      renderApp();
    }

    function drawCard() {
      const deck = [...getZone("deck")];
      const hand = [...getZone("hand")];
      if (!deck.length) return;
      hand.unshift(deck.shift());
      setZone("deck", deck);
      setZone("hand", hand);
      if (appMode === "battle") battleClient.sendIntent("DRAW_CARD", { count: 1 });
      renderApp();
    }

    function moveCard(intentPayload, optimistic = true) {
      const { cardId, from, to } = intentPayload;
      if (!ALL_ZONES.includes(from.zone) || !ALL_ZONES.includes(to.zone)) return;
      const fromArr = [...getZone(from.zone)];
      const idx = fromArr.indexOf(cardId);
      if (idx < 0) return;
      fromArr.splice(idx, 1);
      const toArr = [...getZone(to.zone), cardId];
      setZone(from.zone, fromArr);
      setZone(to.zone, toArr);
      if (appMode === "battle" && optimistic) battleClient.sendIntent("MOVE_CARD", intentPayload);
      renderApp();
    }

    function canSeeZone(zoneKey) {
      if (appMode !== "battle") return true;
      if (SHARED_ZONES.includes(zoneKey)) return true;
      return PRIVATE_ZONES.includes(zoneKey);
    }

    function canDragFrom(zoneKey) {
      if (appMode !== "battle") return true;
      if (zoneKey === "deck") return false;
      return SHARED_ZONES.includes(zoneKey) || PRIVATE_ZONES.includes(zoneKey);
    }

    function canDropTo(fromZone, toZone) {
      if (appMode !== "battle") return true;
      if (toZone === "deck") return false;
      if (SHARED_ZONES.includes(fromZone) && toZone === "hand") return true;
      if (fromZone === "hand" && SHARED_ZONES.includes(toZone)) return true;
      if (SHARED_ZONES.includes(fromZone) && SHARED_ZONES.includes(toZone)) return true;
      return false;
    }

    function renderCard(cardId, zoneKey) {
      const card = document.createElement("div");
      card.className = "miniCard";
      card.textContent = String(cardId);
      card.title = cardName(cardId);
      const s = modeState();
      if (s?.tapped?.[cardId]) card.classList.add("tapped");
      if (s?.tarped?.[cardId]) card.classList.add("tarped");
      card.addEventListener("click", () => { inspector = { zoneKey, cardId }; renderApp(); });
      card.addEventListener("contextmenu", (e) => { e.preventDefault(); toggleMark(cardId, "tapped"); });
      card.draggable = canDragFrom(zoneKey);
      card.addEventListener("dragstart", () => { dragging = { cardId, from: zoneKey }; });
      card.addEventListener("dragend", () => { dragging = null; });
      return card;
    }

    function renderZone(zoneKey) {
      const zone = document.createElement("section");
      zone.className = `dropArea zone-${zoneKey}`;
      zone.dataset.zone = zoneKey;
      zone.dataset.owner = getZoneOwner(zoneKey);
      const label = document.createElement("div");
      label.className = "zoneMeta";
      label.textContent = `${zoneKey.toUpperCase()} (${getZone(zoneKey).length})`;
      label.addEventListener("dblclick", () => {
        if (!canSeeZone(zoneKey)) return;
        inspector = { zoneKey, cardId: null };
        renderApp();
      });
      zone.appendChild(label);

      const row = document.createElement("div");
      row.className = "slotRow";
      getZone(zoneKey).forEach((id) => row.appendChild(renderCard(id, zoneKey)));
      zone.appendChild(row);

      zone.addEventListener("dragover", (e) => {
        if (!dragging || !canDropTo(dragging.from, zoneKey)) return;
        e.preventDefault();
      });
      zone.addEventListener("drop", (e) => {
        e.preventDefault();
        if (!dragging || !canDropTo(dragging.from, zoneKey)) return;
        const payload = {
          cardId: dragging.cardId,
          from: { owner: getZoneOwner(dragging.from), zone: dragging.from },
          to: { owner: getZoneOwner(zoneKey), zone: zoneKey }
        };
        moveCard(payload, true);
      });

      return zone;
    }

    function renderInspector() {
      if (!inspector) return null;
      const overlay = document.createElement("div");
      overlay.className = "cbOverlay";
      overlay.addEventListener("click", (e) => {
        if (e.target === overlay) { inspector = null; renderApp(); }
      });
      const panel = document.createElement("div");
      panel.className = "cbPanel";
      const zoneCards = getZone(inspector.zoneKey);
      panel.innerHTML = `<h3>${inspector.zoneKey.toUpperCase()}</h3><p>${zoneCards.length} cards</p>`;
      zoneCards.forEach((id) => {
        const row = document.createElement("button");
        row.className = "menuBtn";
        row.textContent = `${id} • ${cardName(id)}`;
        panel.appendChild(row);
      });
      overlay.appendChild(panel);
      return overlay;
    }

    function renderBoard() {
      const wrap = document.createElement("div");
      wrap.className = "board";
      ["permanents", "lands", "hand", "stack", "deck", "graveyard"].forEach((z) => wrap.appendChild(renderZone(z)));

      const controls = document.createElement("div");
      controls.className = "menuCard";
      const drawBtn = document.createElement("button");
      drawBtn.className = "menuBtn";
      drawBtn.textContent = "Draw 1";
      drawBtn.onclick = drawCard;
      controls.appendChild(drawBtn);
      if (appMode === "battle") {
        const room = document.createElement("div");
        room.className = "zoneMeta";
        room.textContent = `Room ${battleRoomId} • You are ${session.role || "-"}`;
        controls.appendChild(room);
      }
      wrap.prepend(controls);
      return wrap;
    }

    async function ensureSocket() {
      if (window.io) return;
      await new Promise((resolve, reject) => {
        const s = document.createElement("script");
        s.src = "/socket.io/socket.io.js";
        s.onload = resolve;
        s.onerror = reject;
        document.body.appendChild(s);
      });
    }

    function createBattleClient() {
      let socket = null;
      return {
        async connect() {
          if (socket) return socket;
          await ensureSocket();
          socket = window.io("/battle");
          socket.on("room_state", ({ roomId, state, role }) => {
            battleRoomId = roomId || battleRoomId;
            if (role) session.role = role;
            battleState = state;
            renderApp();
          });
          socket.on("intent_rejected", () => {
            // server pushes authoritative state on rejects
          });
          return socket;
        },
        async createRoom() {
          const s = await this.connect();
          return new Promise((resolve) => {
            s.emit("create_room", { playerId: session.playerId, playerName: session.playerName }, (res) => {
              if (res?.ok) {
                battleRoomId = res.roomId;
                session.role = res.role;
                battleState = res.state;
                persistPlayerSaveDebounced();
              }
              resolve(res);
            });
          });
        },
        async joinRoom(roomId) {
          const s = await this.connect();
          return new Promise((resolve) => {
            s.emit("join_room", { roomId, playerId: session.playerId, playerName: session.playerName }, (res) => {
              if (res?.ok) {
                battleRoomId = res.roomId;
                session.role = res.role;
                battleState = res.state;
                persistPlayerSaveDebounced();
              }
              resolve(res);
            });
          });
        },
        sendIntent(type, payload) {
          if (!socket || !battleRoomId || !battleState) return;
          socket.emit("intent", {
            type,
            roomId: battleRoomId,
            playerId: session.playerId,
            clientActionId: uid(),
            baseVersion: battleState.version || 0,
            payload
          });
        },
        leaveRoom() {
          if (socket && battleRoomId) socket.emit("leave_room", { roomId: battleRoomId });
          battleRoomId = "";
          battleState = null;
          session.role = null;
        }
      };
    }

    function renderPlayerMenu() {
      subtitle.textContent = "Choose player";
      const card = document.createElement("div");
      card.className = "menuCard";
      card.innerHTML = "<h2>Player Menu</h2>";

      const list = document.createElement("div");
      playerRegistry.players
        .sort((a, b) => b.lastSeenAt - a.lastSeenAt)
        .forEach((p) => {
          const b = document.createElement("button");
          b.className = "menuBtn";
          b.textContent = `${p.name}`;
          b.onclick = () => setActivePlayer(p);
          list.appendChild(b);
        });
      if (!playerRegistry.players.length) {
        const empty = document.createElement("div");
        empty.className = "zoneMeta";
        empty.textContent = "No saved players yet.";
        list.appendChild(empty);
      }

      const input = document.createElement("input");
      input.className = "menuInput";
      input.placeholder = "Create new player name";
      const create = document.createElement("button");
      create.className = "menuBtn";
      create.textContent = "Create / Select";
      create.onclick = () => createPlayer(input.value);

      card.append(list, input, create);
      root.replaceChildren(card);
    }

    function renderMainMenu() {
      subtitle.textContent = `${session.playerName || "No player"}`;
      const card = document.createElement("div");
      card.className = "menuCard";
      card.innerHTML = "<h2>Main Menu</h2>";

      const sandboxBtn = document.createElement("button");
      sandboxBtn.className = "menuBtn";
      sandboxBtn.textContent = "Sandbox Mode";
      sandboxBtn.onclick = () => { inspector = null; appMode = "sandbox"; uiScreen = "mode"; renderApp(); };

      const battleBtn = document.createElement("button");
      battleBtn.className = "menuBtn";
      battleBtn.textContent = "2P Battle Mode";
      battleBtn.onclick = () => { appMode = "battle"; uiScreen = "mode"; renderApp(); };

      const deckBtn = document.createElement("button");
      deckBtn.className = "menuBtn";
      deckBtn.textContent = "Deckbuilder Mode";
      deckBtn.onclick = () => { appMode = "deckbuilder"; uiScreen = "mode"; renderApp(); };

      card.append(sandboxBtn, battleBtn, deckBtn);
      root.replaceChildren(card);
    }

    function renderBattleLobby(host) {
      const card = document.createElement("div");
      card.className = "menuCard";
      card.innerHTML = "<h3>Battle Room</h3>";

      const createBtn = document.createElement("button");
      createBtn.className = "menuBtn";
      createBtn.textContent = "Create room";
      createBtn.onclick = async () => {
        const res = await battleClient.createRoom();
        if (!res?.ok) alert(res?.error || "Failed to create room");
        renderApp();
      };

      const input = document.createElement("input");
      input.className = "menuInput";
      input.placeholder = "Join room code";
      input.value = loadPlayerSave(session.playerId).lastBattleRoomId || "";
      const joinBtn = document.createElement("button");
      joinBtn.className = "menuBtn";
      joinBtn.textContent = "Join room";
      joinBtn.onclick = async () => {
        const code = input.value.trim().toUpperCase();
        if (!code) return;
        const res = await battleClient.joinRoom(code);
        if (!res?.ok) alert(res?.error || "Join failed");
        renderApp();
      };

      card.append(createBtn, input, joinBtn);
      host.appendChild(card);
    }

    function renderModeScreen() {
      subtitle.textContent = `${session.playerName} • ${appMode}`;
      const wrap = document.createElement("div");
      wrap.className = "view";

      if (appMode === "deckbuilder") {
        const card = document.createElement("div");
        card.className = "menuCard";
        card.innerHTML = "<h2>Deckbuilder coming soon</h2>";
        wrap.appendChild(card);
      } else if (appMode === "battle") {
        if (!battleState) renderBattleLobby(wrap);
        else wrap.appendChild(renderBoard());
      } else {
        inspector = null;
        const frame = document.createElement("iframe");
        frame.className = "sandboxFrame";
        frame.src = `/sandbox.html?playerId=${encodeURIComponent(session.playerId || "")}`;
        frame.title = "Sandbox mode";
        wrap.appendChild(frame);
      }

      const panel = appMode === "sandbox" ? null : renderInspector();
      root.replaceChildren(wrap);
      if (panel) root.appendChild(panel);
    }

    function renderApp() {
      topBackBtn.style.visibility = (uiScreen === "playerMenu" || (uiScreen === "mode" && appMode === "sandbox")) ? "hidden" : "visible";
      if (uiScreen === "playerMenu") return renderPlayerMenu();
      if (uiScreen === "mainMenu") return renderMainMenu();
      return renderModeScreen();
    }

    if (playerRegistry.lastPlayerId) {
      const last = playerRegistry.players.find((p) => p.id === playerRegistry.lastPlayerId);
      if (last) setActivePlayer(last);
      else renderApp();
    } else {
      renderApp();
    }
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }
})();
