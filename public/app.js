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
    if (!root || !subtitle) throw new Error("Missing required DOM roots");

    const PLAYER_KEY = "cb_players";
    const SAVE_PREFIX = "cb_save_";
    const ALL_ZONES = ["permanents", "lands", "hand", "stack", "deck", "graveyard"];
    const BATTLEFIELD_ZONES = ["lands", "permanents"];
    const SHARED_ZONES = ["stack"];
    const PRIVATE_ZONES = ["hand", "deck", "graveyard"];
    const PILE_ZONES = ["stack", "deck", "graveyard"];
    const demo = window.DEMO_STATE || { zones: { hand: [], lands: [], permanents: [] }, tapped: {}, tarped: {} };

    let uiScreen = "playerMenu";
    let appMode = null;
    let dragging = null;
    let inspector = null;
    let opponentFlipped = false;

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
      }, 400);
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

    function getOpponentRole() {
      return session.role === "p1" ? "p2" : "p1";
    }

    function isSharedZone(zoneKey) {
      return SHARED_ZONES.includes(zoneKey);
    }

    function isPrivateZone(zoneKey) {
      return PRIVATE_ZONES.includes(zoneKey);
    }

    function isBattlefieldZone(zoneKey) {
      return BATTLEFIELD_ZONES.includes(zoneKey);
    }

    function getZoneOwner(zoneKey, ownerRole = session.role) {
      if (appMode !== "battle") return "solo";
      return isSharedZone(zoneKey) ? "shared" : (ownerRole || session.role || "p1");
    }

    function getZone(zoneKey, ownerRole = session.role) {
      const s = modeState();
      if (!s) return [];
      if (appMode === "battle") {
        if (isSharedZone(zoneKey)) return s.sharedZones?.[zoneKey] || [];
        return s.players?.[ownerRole]?.zones?.[zoneKey] || [];
      }
      return s.zones?.[zoneKey] || [];
    }

    function setZone(zoneKey, arr, ownerRole = session.role) {
      const s = modeState();
      if (!s) return;
      if (appMode === "battle") {
        if (isSharedZone(zoneKey)) s.sharedZones[zoneKey] = arr;
        else s.players[ownerRole].zones[zoneKey] = arr;
      } else {
        s.zones[zoneKey] = arr;
        persistPlayerSaveDebounced();
      }
    }

    function canSeeZone(zoneKey, ownerRole = session.role) {
      if (appMode !== "battle") return true;
      if (isPrivateZone(zoneKey)) return ownerRole === session.role;
      return isSharedZone(zoneKey) || isBattlefieldZone(zoneKey);
    }

    function canDragFrom(zoneKey, ownerRole = session.role) {
      if (appMode !== "battle") return true;
      if (zoneKey === "deck") return false;
      if (!canSeeZone(zoneKey, ownerRole)) return false;
      if (!isSharedZone(zoneKey) && ownerRole !== session.role) return false;
      return true;
    }

    function canDropTo(fromZone, toZone, fromOwner = session.role, toOwner = session.role) {
      if (appMode !== "battle") return true;
      if (toZone === "deck") return false;
      if (!ALL_ZONES.includes(fromZone) || !ALL_ZONES.includes(toZone)) return false;
      const fromShared = isSharedZone(fromZone);
      const toShared = isSharedZone(toZone);
      if (!fromShared && fromOwner !== session.role) return false;
      if (!toShared && toOwner !== session.role) return false;
      if (isPrivateZone(fromZone) && isPrivateZone(toZone)) return fromOwner === toOwner;
      return true;
    }

    function toggleMark(cardId, kind) {
      const s = modeState();
      if (!s) return;
      s[kind][cardId] = !s[kind][cardId];
      if (appMode === "battle") {
        battleClient.sendIntent("TOGGLE_TAP", { cardId, kind });
      } else {
        persistPlayerSaveDebounced();
      }
      renderApp();
    }

    function drawCard(ownerRole = session.role) {
      if (appMode === "battle" && ownerRole !== session.role) return;
      const deck = [...getZone("deck", ownerRole)];
      const hand = [...getZone("hand", ownerRole)];
      if (!deck.length) return;
      hand.unshift(deck.shift());
      setZone("deck", deck, ownerRole);
      setZone("hand", hand, ownerRole);
      if (appMode === "battle") battleClient.sendIntent("DRAW_CARD", { count: 1, owner: ownerRole });
      renderApp();
    }

    function moveCard(intentPayload, optimistic = true) {
      const { cardId, from, to } = intentPayload;
      if (!ALL_ZONES.includes(from.zone) || !ALL_ZONES.includes(to.zone)) return;
      if (!canDropTo(from.zone, to.zone, from.owner, to.owner)) return;
      const fromArr = [...getZone(from.zone, from.owner || session.role)];
      const idx = fromArr.indexOf(cardId);
      if (idx < 0) return;
      fromArr.splice(idx, 1);
      const toArr = [...getZone(to.zone, to.owner || session.role), cardId];
      setZone(from.zone, fromArr, from.owner || session.role);
      setZone(to.zone, toArr, to.owner || session.role);
      if (appMode === "battle" && optimistic) battleClient.sendIntent("MOVE_CARD", intentPayload);
      renderApp();
    }

    function isPileZone(zoneKey) {
      return PILE_ZONES.includes(zoneKey);
    }

    function layoutHandFan(slotRowEl, cardIds) {
      const overlap = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--hand-overlap")) || 0.55;
      const rx = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--hand-arc-rx")) || 340;
      const ry = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--hand-arc-ry")) || 130;
      const arcY = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--hand-arc-y")) || 18;
      const niceMax = 7;
      const n = cardIds.length;
      const baseRange = 42;
      const range = baseRange * (1.15 - overlap);
      const niceN = Math.min(n, niceMax);
      const centerNice = (niceN - 1) / 2;
      const niceStep = niceN > 1 ? (range / centerNice) : 0;
      const extraStep = 7.5 * (0.95 - overlap);

      const cards = Array.from(slotRowEl.querySelectorAll(".miniCard"));
      cards.forEach((el, i) => {
        let thetaDeg;
        if (i < niceN) thetaDeg = (i - centerNice) * niceStep;
        else {
          const extra = i - (niceN - 1);
          thetaDeg = (niceN - 1 - centerNice) * niceStep + extra * extraStep;
        }
        const theta = (thetaDeg * Math.PI) / 180;
        const x = rx * Math.sin(theta);
        const y = ry * (1 - Math.cos(theta)) + arcY;
        const rot = thetaDeg * 0.9;
        el.style.zIndex = String(1000 + i);
        el.style.transform = `translate(-50%, 0) translate(${x}px, ${y}px) rotate(${rot}deg)`;
      });
    }

    function applyDropHandlers(zone, zoneKey, ownerRole = session.role) {
      zone.addEventListener("dragover", (e) => {
        if (!dragging || !canDropTo(dragging.from, zoneKey, dragging.owner || session.role, ownerRole)) return;
        e.preventDefault();
        zone.classList.add("active");
      });
      zone.addEventListener("dragleave", () => zone.classList.remove("active"));
      zone.addEventListener("drop", (e) => {
        e.preventDefault();
        zone.classList.remove("active");
        if (!dragging || !canDropTo(dragging.from, zoneKey, dragging.owner || session.role, ownerRole)) return;
        moveCard({
          cardId: dragging.cardId,
          from: { owner: dragging.owner || session.role, zone: dragging.from },
          to: { owner: ownerRole, zone: zoneKey }
        }, true);
      });
    }

    function renderCard(cardId, zoneKey, ownerRole = session.role) {
      const card = document.createElement("div");
      card.className = "miniCard";
      card.textContent = String(cardId);
      card.title = cardName(cardId);
      const s = modeState();
      if (s?.tapped?.[cardId]) card.classList.add("tapped");
      if (s?.tarped?.[cardId]) card.classList.add("tarped");
      card.addEventListener("click", () => { inspector = { zoneKey, ownerRole, cardId }; renderApp(); });
      card.addEventListener("contextmenu", (e) => {
        e.preventDefault();
        if (!canDragFrom(zoneKey, ownerRole)) return;
        toggleMark(cardId, "tapped");
      });
      card.addEventListener("dblclick", (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (zoneKey === "hand" || !canDragFrom(zoneKey, ownerRole)) return;
        toggleMark(cardId, e.shiftKey ? "tarped" : "tapped");
      });
      card.draggable = canDragFrom(zoneKey, ownerRole);
      card.addEventListener("dragstart", () => { dragging = { cardId, from: zoneKey, owner: ownerRole }; });
      card.addEventListener("dragend", () => { dragging = null; });
      return card;
    }

    function renderZone(zoneKey, ownerRole = session.role, opts = {}) {
      const zone = document.createElement("section");
      zone.className = `dropArea zone-${zoneKey}`;
      if (opts.mirrored) zone.classList.add("battleMirrorZone");
      if (opts.flipped) zone.classList.add("battleFlipZone");
      if (opts.compactPile) zone.classList.add("pileCompactTop");
      zone.dataset.zone = zoneKey;
      zone.dataset.owner = getZoneOwner(zoneKey, ownerRole);
      const zoneCards = getZone(zoneKey, ownerRole);

      if (isPileZone(zoneKey)) {
        zone.classList.add("isPile");
        const pile = document.createElement("div");
        pile.className = "pileSilhouette";
        const pileCard = document.createElement("div");
        pileCard.className = "miniCard pileCard";
        const count = document.createElement("div");
        count.className = "pileCount";
        count.textContent = String(zoneCards.length);
        pileCard.appendChild(count);
        pile.appendChild(pileCard);

        const label = document.createElement("div");
        label.className = "pileLabel";
        label.textContent = zoneKey === "stack" ? "THE STACK" : zoneKey.toUpperCase();
        zone.append(pile, label);

        if (zoneKey === "deck") {
          pileCard.addEventListener("click", (e) => {
            e.stopPropagation();
            if (!canSeeZone(zoneKey, ownerRole)) return;
            drawCard(ownerRole);
          });
          pileCard.addEventListener("dblclick", (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (!canSeeZone(zoneKey, ownerRole)) return;
            drawCard(ownerRole);
          });
        } else {
          pileCard.addEventListener("click", (e) => {
            e.stopPropagation();
            if (!canSeeZone(zoneKey, ownerRole)) return;
            inspector = { zoneKey, ownerRole, cardId: null };
            renderApp();
          });
        }

        applyDropHandlers(zone, zoneKey, ownerRole);
        return zone;
      }

      zone.addEventListener("click", () => {
        if (!canSeeZone(zoneKey, ownerRole)) return;
        inspector = { zoneKey, ownerRole, cardId: null };
        renderApp();
      });

      const row = document.createElement("div");
      row.className = "slotRow";
      zoneCards.forEach((id) => row.appendChild(renderCard(id, zoneKey, ownerRole)));
      if (zoneKey === "hand") layoutHandFan(row, zoneCards);
      zone.appendChild(row);
      applyDropHandlers(zone, zoneKey, ownerRole);
      return zone;
    }

    function renderInspector() {
      if (!inspector) return null;
      if (!canSeeZone(inspector.zoneKey, inspector.ownerRole)) return null;
      const overlay = document.createElement("div");
      overlay.className = "inspectorOverlay";
      overlay.addEventListener("click", (e) => {
        if (e.target === overlay) { inspector = null; renderApp(); }
      });
      const panel = document.createElement("div");
      panel.className = "inspectorTrack";
      const zoneCards = getZone(inspector.zoneKey, inspector.ownerRole);
      if (!zoneCards.length) {
        const empty = document.createElement("div");
        empty.className = "inspectorEmpty";
        empty.textContent = `${inspector.zoneKey.toUpperCase()} is empty`;
        panel.appendChild(empty);
      }
      zoneCards.forEach((id) => {
        const row = document.createElement("div");
        row.className = "inspectorCard";
        row.textContent = `${id}`;
        row.title = cardName(id);
        panel.appendChild(row);
      });
      const closeBtn = document.createElement("button");
      closeBtn.className = "inspectorCloseBtn";
      closeBtn.textContent = "Close";
      closeBtn.addEventListener("click", () => { inspector = null; renderApp(); });
      overlay.append(closeBtn, panel);
      return overlay;
    }

    function renderHiddenPrivateRow(ownerRole, label) {
      const hidden = document.createElement("div");
      hidden.className = "battleHiddenRow";
      hidden.innerHTML = `<strong>${label}</strong> · hidden zones`;
      PRIVATE_ZONES.forEach((zoneKey) => {
        const pill = document.createElement("span");
        pill.className = "battleHiddenPill";
        pill.textContent = `${zoneKey}: ${getZone(zoneKey, ownerRole).length}`;
        hidden.appendChild(pill);
      });
      return hidden;
    }

    function renderBattlefieldTrack(ownerRole, label, opts = {}) {
      const section = document.createElement("section");
      section.className = "battleTrack";
      const title = document.createElement("div");
      title.className = "zoneMeta";
      title.textContent = `${label} battlefield`;
      section.appendChild(title);
      section.appendChild(renderZone("permanents", ownerRole, opts));
      section.appendChild(renderZone("lands", ownerRole, opts));
      return section;
    }

    function renderBoard() {
      if (appMode !== "battle") {
        const wrap = document.createElement("div");
        wrap.className = "board";
        const piles = document.createElement("div");
        piles.className = "pilesBar";
        ["stack", "deck", "graveyard"].forEach((z) => piles.appendChild(renderZone(z)));
        wrap.appendChild(piles);
        ["permanents", "lands", "hand"].forEach((z) => wrap.appendChild(renderZone(z)));
        return wrap;
      }

      const myRole = session.role || "p1";
      const oppRole = getOpponentRole();
      const wrap = document.createElement("div");
      wrap.className = "board battleBoard";

      const topPrivate = document.createElement("div");
      topPrivate.className = "battleTopPrivate";
      const topMeta = document.createElement("div");
      topMeta.className = "zoneMeta";
      topMeta.textContent = "Your private zones";
      const stackArea = renderZone("stack", myRole, { compactPile: true });
      topPrivate.append(topMeta, renderZone("deck", myRole, { compactPile: true }), renderZone("graveyard", myRole, { compactPile: true }), stackArea);

      wrap.append(topPrivate, renderZone("hand", myRole), renderHiddenPrivateRow(oppRole, "Opponent"));

      const flipBtn = document.createElement("button");
      flipBtn.className = "menuBtn";
      flipBtn.textContent = opponentFlipped ? "Unflip opponent battlefield" : "Flip opponent battlefield";
      flipBtn.onclick = () => {
        opponentFlipped = !opponentFlipped;
        renderApp();
      };
      wrap.appendChild(flipBtn);

      wrap.appendChild(renderBattlefieldTrack(myRole, "Your"));
      wrap.appendChild(renderBattlefieldTrack(oppRole, "Opponent", { mirrored: true, flipped: opponentFlipped }));
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
          opponentFlipped = false;
        }
      };
    }

    function renderPlayerMenu() {
      subtitle.textContent = "Choose player";
      const card = document.createElement("div");
      card.className = "menuCard";
      card.innerHTML = "<h2>Player Menu</h2>";

      const list = document.createElement("div");
      playerRegistry.players.sort((a, b) => b.lastSeenAt - a.lastSeenAt).forEach((p) => {
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
      sandboxBtn.onclick = () => { appMode = "sandbox"; uiScreen = "mode"; renderApp(); };

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

      const hint = document.createElement("div");
      hint.className = "zoneMeta";
      hint.textContent = "Create a room and share the code with your opponent to join from another device.";
      card.append(createBtn, input, joinBtn, hint);
      host.appendChild(card);
    }

    function renderModeScreen() {
      if (appMode === "battle") {
        subtitle.textContent = battleRoomId
          ? `${session.playerName} • battle • Room ${battleRoomId} • ${session.role || "-"}`
          : `${session.playerName} • battle`;
      } else {
        subtitle.textContent = `${session.playerName} • ${appMode}`;
      }

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
        const frame = document.createElement("iframe");
        frame.className = "sandboxFrame";
        frame.src = `/sandbox.html?playerId=${encodeURIComponent(session.playerId || "")}`;
        frame.title = "Sandbox mode";
        wrap.appendChild(frame);
      }

      const panel = renderInspector();
      root.replaceChildren(wrap);
      if (panel) root.appendChild(panel);
    }

    function renderApp() {
      topBackBtn.style.visibility = uiScreen === "playerMenu" ? "hidden" : "visible";
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
