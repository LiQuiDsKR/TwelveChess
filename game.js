// game.js - Firebase 기반 십이장기 실시간 멀티플레이 최종 버전

import { db, ref, set, update, onValue, get, remove } from "./firebase-config.js";

const nickname = localStorage.getItem("nickname") || "익명";
const roomId = localStorage.getItem("roomId");

const playerNameDisplay = document.getElementById("player-name");
const opponentNameDisplay = document.getElementById("opponent-name");
const turnDisplay = document.getElementById("turn-display");
const message = document.getElementById("message");
const boardElement = document.getElementById("board");
const myCapturedEl = document.getElementById("my-captured");
const opponentCapturedEl = document.getElementById("opponent-captured");

playerNameDisplay.textContent = nickname;

const roomRef = ref(db, `games/${roomId}`);
const playerSlotRef = ref(db, `games/${roomId}/players`);
const boardRef = ref(db, `games/${roomId}/board`);
const ownersRef = ref(db, `games/${roomId}/owners`);
const turnRef = ref(db, `games/${roomId}/turn`);
const capturedRef = ref(db, `games/${roomId}/captured`);
const kingStatusRef = ref(db, `games/${roomId}/kingReached`);

let mySlot = null;
let opponentSlot = null;
let currentTurn = null;
let boardState = [];
let ownerState = [];
let capturedState = { player1: [], player2: [] };
let selectedCell = null;

async function joinRoom() {
  const snapshot = await get(playerSlotRef);
  const players = snapshot.val();

  if (!players || !players.player1) {
    mySlot = "player1";
    opponentSlot = "player2";
    await set(playerSlotRef, {
      player1: { nickname }
    });
  } else if (!players.player2) {
    mySlot = "player2";
    opponentSlot = "player1";
    await update(playerSlotRef, {
      player2: { nickname }
    });
  } else {
    alert("이미 두 명이 있는 방입니다.");
    window.location.href = "index.html";
    return;
  }

  listenForOpponent();
}

function listenForOpponent() {
  onValue(playerSlotRef, (snapshot) => {
    const players = snapshot.val();
    if (players && players[opponentSlot]) {
      opponentNameDisplay.textContent = players[opponentSlot].nickname;
      message.textContent = `상대가 입장했습니다. (${mySlot} 역할)`;
      initializeGame();
    } else {
      opponentNameDisplay.textContent = "(입장 대기 중)";
      message.textContent = "상대방을 기다리는 중입니다...";
    }
  });
}

const initialBoard = [
  ["相", "王", "將"],
  ["",   "子", ""],
  ["",   "子", ""],
  ["將", "王", "相"]
];

const initialOwners = [
  ["player1", "player1", "player1"],
  ["",        "player1", ""],
  ["",        "player2", ""],
  ["player2", "player2", "player2"]
];

async function initializeGame() {
  const boardSnap = await get(boardRef);

  if (!boardSnap.exists() && mySlot === "player1") {
    await set(boardRef, initialBoard);
    await set(ownersRef, initialOwners);
    await set(turnRef, "player1");
    await set(capturedRef, { player1: [], player2: [] });
    await remove(kingStatusRef);
  }

  renderBoard(); // HTML 셀 생성
    waitForReadyData().then(() => {
    watchTurn();
    watchBoard();     // boardState 설정 후 update 호출됨
    watchCaptured();  // capturedState 설정 후 update 호출됨
    watchKingStatus();
    });
}

function waitForReadyData() {
  return new Promise(resolve => {
    const check = async () => {
      const snap1 = await get(boardRef);
      const snap2 = await get(ownersRef);
      if (snap1.exists() && snap2.exists()) {
        resolve();
      } else {
        setTimeout(check, 100);
      }
    };
    check();
  });
}

function renderBoard() {
  boardElement.innerHTML = "";
  for (let row = 0; row < 4; row++) {
    for (let col = 0; col < 3; col++) {
      const cell = document.createElement("div");
      cell.className = "cell";
      cell.dataset.row = row;
      cell.dataset.col = col;
      cell.addEventListener("click", handleCellClick);
      boardElement.appendChild(cell);
    }
  }
}

function watchTurn() {
  onValue(turnRef, (snap) => {
    currentTurn = snap.val();
    turnDisplay.textContent = currentTurn === mySlot ? "내 차례" : "상대 차례";
  });
}

function watchBoard() {
  onValue(boardRef, (snap) => {
    boardState = snap.val();
    updateBoardDisplay();
  });
  onValue(ownersRef, (snap) => {
    ownerState = snap.val();
    updateBoardDisplay();
  });
}

function watchCaptured() {
  onValue(capturedRef, (snap) => {
    capturedState = snap.val();
    updateCapturedUI();
  });
}

function watchKingStatus() {
  onValue(kingStatusRef, async (snap) => {
    const data = snap.val();
    if (!data) return;
    if (data.player !== mySlot && data.survived === false) {
      await update(kingStatusRef, { survived: true });
    } else if (data.player !== mySlot && data.survived === true && currentTurn === mySlot) {
      endGame(`${nickname} 승리! 왕 생존 조건 충족`);
    }
  });
}

function updateBoardDisplay() {
  if (!Array.isArray(boardState) || !Array.isArray(ownerState)) return;

  const cells = document.querySelectorAll(".cell");
  if (!cells || cells.length !== 12) return;

  cells.forEach(cell => {
    const row = parseInt(cell.dataset.row);
    const col = parseInt(cell.dataset.col);

    const rowData = Array.isArray(boardState[row]) ? boardState[row] : [];
    const ownerRow = Array.isArray(ownerState[row]) ? ownerState[row] : [];

    const piece = rowData[col] || "";
    const owner = ownerRow[col] || "";

    cell.textContent = piece;
    cell.className = "cell";
    if (owner === mySlot) cell.classList.add("lower");
    else if (owner === opponentSlot) cell.classList.add("upper");
  });
}

function updateCapturedUI() {
  if (!capturedState || typeof capturedState !== "object") {
    return;
  }

  const mine = Array.isArray(capturedState[mySlot]) ? capturedState[mySlot] : [];
  const opp = Array.isArray(capturedState[opponentSlot]) ? capturedState[opponentSlot] : [];

  myCapturedEl.innerHTML = mine.map(p => `<div class="captured-piece">${p}</div>`).join("");
  opponentCapturedEl.innerHTML = opp.map(p => `<div class="captured-piece">${p}</div>`).join("");
}

function isValidMove(piece, fromRow, fromCol, toRow, toCol, slot) {
  const dr = toRow - fromRow;
  const dc = toCol - fromCol;
  const absDr = Math.abs(dr);
  const absDc = Math.abs(dc);

  const isUpper = slot === "player1";
  const forward = isUpper ? 1 : -1;

  switch (piece) {
    case "相":
      return absDr === 1 && absDc === 1;

    case "將":
      return (absDr === 1 && dc === 0) || (absDc === 1 && dr === 0);

    case "王":
      return absDr <= 1 && absDc <= 1 && !(dr === 0 && dc === 0);

    case "子":
      return dr === forward && dc === 0;

    case "侯":
      return !(dr === forward && Math.abs(dc) === 1); // ↙ ↘ 제외한 7방향
      // 즉, 전방, 좌우, 뒤쪽 포함 7방향 가능
      // 侯는 왼아/오아 불가능
  }

  return false;
}


async function handleCellClick(e) {
  const row = parseInt(e.target.dataset.row);
  const col = parseInt(e.target.dataset.col);
  if (currentTurn !== mySlot) return;

  const targetPiece = (boardState[row] && boardState[row][col]) || "";
  const targetOwner = (ownerState[row] && ownerState[row][col]) || "";

  // 선택 해제
  if (selectedCell && selectedCell === e.target) {
    selectedCell.classList.remove("selected");
    selectedCell = null;
    return;
  }

  // 기물 선택
  if (!selectedCell) {
    if (targetPiece && targetOwner === mySlot) {
      selectedCell = e.target;
      selectedCell.classList.add("selected");
    }
    return;
  }

  // 기물 이동 시도
  const fromRow = parseInt(selectedCell.dataset.row);
  const fromCol = parseInt(selectedCell.dataset.col);
  const movingPiece = boardState[fromRow][fromCol];

  const isValid = isValidMove(movingPiece, fromRow, fromCol, row, col, mySlot);
  if (!isValid) {
    selectedCell.classList.remove("selected");
    selectedCell = null;
    return;
  }

  // 내 기물 자리에 이동 불가
  if (targetOwner === mySlot) {
    selectedCell.classList.remove("selected");
    selectedCell = null;
    return;
  }

  // 승급 (子 → 侯)
  const isUpper = mySlot === "player1";
  const isAtEnd = (isUpper && row === 3) || (!isUpper && row === 0);
  const placedPiece = (movingPiece === "子" && isAtEnd) ? "侯" : movingPiece;

  // 캡처 처리 (상대 기물일 경우만)
  if (targetPiece !== "" && targetOwner === opponentSlot) {
    capturedState[mySlot].push(targetPiece);
    await update(capturedRef, { [mySlot]: capturedState[mySlot] });
  }

  // 보드 상태 갱신
  boardState[row][col] = placedPiece;
  ownerState[row][col] = mySlot;
  boardState[fromRow][fromCol] = "";
  ownerState[fromRow][fromCol] = "";

  await set(boardRef, boardState);
  await set(ownersRef, ownerState);
  await set(turnRef, opponentSlot);
  await checkWinCondition();

  selectedCell.classList.remove("selected");
  selectedCell = null;
}

async function checkWinCondition() {
  if (!boardState || boardState.length !== 4) return;
  let upperKing = false;
  let lowerKing = false;

  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 3; c++) {
      const piece = (boardState[r] && boardState[r][c]) || "";
      const owner = (ownerState[r] && ownerState[r][c]) || "";

      if (piece === "왕") {
        if (owner === "player1") upperKing = true;
        if (owner === "player2") lowerKing = true;

        const reached = (owner === "player1" && r === 3) || (owner === "player2" && r === 0);
        if (reached) {
          await set(kingStatusRef, { player: owner, survived: false });
        }
      }
    }
  }

  if (!upperKing || !lowerKing) {
    endGame(`${nickname} 승리! 상대 왕 제거`);
  }
}

function endGame(msg) {
  message.textContent = msg;
  document.getElementById("restart-btn").style.display = "block";
}

document.getElementById("restart-btn").addEventListener("click", async () => {
  await set(boardRef, initialBoard);
  await set(ownersRef, initialOwners);
  await set(turnRef, "player1");
  await set(capturedRef, { player1: [], player2: [] });
  await remove(kingStatusRef);
  document.getElementById("restart-btn").style.display = "none";
});

joinRoom();