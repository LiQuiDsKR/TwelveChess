const board = document.getElementById('board');
const message = document.getElementById('message');

let gameState = [
    ['相', '王', '張'],
    ['', '子', ''],
    ['', '子', ''],
    ['張', '王', '相']
];

// 각 기물의 소유자를 추적하는 새로운 배열
let pieceOwners = [
    ['upper', 'upper', 'upper'],
    ['', 'upper', ''],
    ['', 'lower', ''],
    ['lower', 'lower', 'lower']
];

const pieces = {
    '王': '王',
    '相': '相',
    '張': '張',
    '子': '子',
    '候': '候'
};

let selectedCell = null;
let currentPlayer = 'lower';  // 'lower'로 변경
let selectedPiece = null;

let capturedPieces = {
    upper: [],
    lower: []
};

let kingInOpponentTerritory = null; // 'upper', 'lower', 또는 null
let kingSurvivalTurn = false;
let gameEnded = false;

const restartButton = document.getElementById('restart-button');
const resultModal = document.getElementById('result-modal');
const resultMessage = document.getElementById('result-message');
const closeModal = document.getElementById('close-modal');

// 플레이어 닉네임 가져오기
const playerNickname = localStorage.getItem('playerNickname') || '익명';

// 플레이어 정보 표시
const playerInfo = document.getElementById('player-info');
playerInfo.textContent = `플레이어: ${playerNickname}`;

// 이 부분을 추가합니다
function initializeBoard() {
    for (let row = 0; row < 4; row++) {
        for (let col = 0; col < 3; col++) {
            const cell = document.createElement('div');
            cell.className = 'cell';
            cell.dataset.row = row;
            cell.dataset.col = col;
            cell.addEventListener('click', handleCellClick);
            board.appendChild(cell);
        }
    }
    updateBoard();
}

function updateBoard() {
    const cells = document.querySelectorAll('.cell');
    cells.forEach(cell => {
        const row = parseInt(cell.dataset.row);
        const col = parseInt(cell.dataset.col);
        const piece = gameState[row][col];
        const owner = pieceOwners[row][col];
        
        // 위쪽 진영 기물은 뒤집어서 표시
        if (owner === 'upper') {
            cell.textContent = getRotatedChar(pieces[piece]) || '';
        } else {
            cell.textContent = pieces[piece] || '';
        }
        
        cell.className = 'cell ' + (owner || '');
    });
    updateCapturedPieces();
}

// 글자를 뒤집는 함수
function getRotatedChar(char) {
    const rotatedChars = {
        '王': '王', '相': '相', '張': '張', '子': '子', '候': '候'
    };
    return rotatedChars[char] || char;
}

function updateCapturedPieces() {
    const upperCaptured = document.getElementById('upper-captured');
    const lowerCaptured = document.getElementById('lower-captured');
    
    upperCaptured.innerHTML = capturedPieces.upper.map(piece => 
        `<div class="captured-piece upper">${getRotatedChar(piece)}</div>`
    ).join('');
    lowerCaptured.innerHTML = capturedPieces.lower.map(piece => 
        `<div class="captured-piece lower">${piece}</div>`
    ).join('');
    
    const capturedPieceElements = document.querySelectorAll('.captured-piece');
    capturedPieceElements.forEach(element => {
        element.addEventListener('click', handleCapturedPieceClick);
    });
}

let playerNumber;
const statusElement = document.getElementById('status');

const socket = new WebSocket('ws://' + window.location.host);

socket.addEventListener('open', () => {
    console.log('WebSocket 연결이 열렸습니다.');
    socket.send(JSON.stringify({ type: 'nickname', nickname: playerNickname }));
});

socket.addEventListener('message', async (event) => {
    const data = JSON.parse(event.data);

    if (data.type === 'wait') {
        statusElement.textContent = data.message;
    } else if (data.type === 'start') {
        statusElement.textContent = `게임 시작! 상대방: ${data.opponent}`;
        playerNumber = data.player;
        document.getElementById('player-number').textContent = playerNumber === 'upper' ? '위' : '아래';
        initializeBoard();
        if (playerNumber === 'upper') {
            rotateBoard();
        }
    } else if (data.type === 'move') {
        handleRemoteMove(data.move);
    } else if (data.type === 'place') {
        handleRemotePlace(data.place);
    }
});

function rotateBoard() {
    board.style.transform = 'rotate(180deg)';
    Array.from(board.children).forEach(cell => {
        cell.style.transform = 'rotate(180deg)';
    });
    document.getElementById('upper-captured').style.order = '2';
    document.getElementById('lower-captured').style.order = '1';
}

function handleCellClick(event) {
    if (gameEnded || currentPlayer !== playerNumber) return;

    const cell = event.target;
    const row = parseInt(cell.dataset.row);
    const col = parseInt(cell.dataset.col);

    if (selectedPiece) {
        if (isValidPlacement(row, col)) {
            placePiece(selectedPiece, row, col);
            sendMessage({ type: 'place', place: { piece: selectedPiece, row, col } });
            selectedPiece = null;
        }
    } else if (selectedCell) {
        movePiece(selectedCell, { row, col });
        sendMessage({ type: 'move', move: { from: selectedCell.dataset, to: { row, col } } });
        selectedCell.classList.remove('selected');
        selectedCell = null;

        if (kingInOpponentTerritory) {
            if ((kingInOpponentTerritory === 'upper' && currentPlayer === 'upper') ||
                (kingInOpponentTerritory === 'lower' && currentPlayer === 'lower')) {
                kingSurvivalTurn = true;
            }
        }

        checkWinCondition();
    } else {
        const owner = pieceOwners[row][col];
        if (owner === currentPlayer) {
            cell.classList.add('selected');
            selectedCell = cell;
        }
    }
}

function movePiece(fromCell, to) {
    const fromRow = parseInt(fromCell.dataset.row);
    const fromCol = parseInt(fromCell.dataset.col);
    const piece = gameState[fromRow][fromCol];
    const owner = pieceOwners[fromRow][fromCol];

    if (isValidMove(piece, fromRow, fromCol, to.row, to.col)) {
        if (pieceOwners[to.row][to.col] === owner) {
            return;
        }

        // 상대방 기물을 잡은 경우
        if (gameState[to.row][to.col] !== '') {
            const capturedPiece = gameState[to.row][to.col] === '候' ? '子' : gameState[to.row][to.col];
            capturedPieces[owner].push(capturedPiece);
        }

        // '자'가 상대방 진영 끝에 도달하면 '후'로 변경
        if (piece === '子') {
            if ((owner === 'upper' && to.row === 3) || (owner === 'lower' && to.row === 0)) {
                gameState[to.row][to.col] = '候';
            } else {
                gameState[to.row][to.col] = piece;
            }
        } else {
            gameState[to.row][to.col] = piece;
        }

        gameState[fromRow][fromCol] = '';
        pieceOwners[to.row][to.col] = owner;
        pieceOwners[fromRow][fromCol] = '';

        updateBoard();
        
        // 왕이 상대방 진영에 들어갔는지 확인
        if (piece === '王') {
            if (owner === 'upper' && to.row === 3) {
                kingInOpponentTerritory = 'upper';
                kingSurvivalTurn = false;
            } else if (owner === 'lower' && to.row === 0) {
                kingInOpponentTerritory = 'lower';
                kingSurvivalTurn = false;
            } else {
                kingInOpponentTerritory = null;
                kingSurvivalTurn = false;
            }
        }

        if (checkWinCondition()) {
            // 게임이 끝났으므로 더 이상의 턴 변경 메시지를 표시하지 않음
        } else {
            currentPlayer = currentPlayer === 'upper' ? 'lower' : 'upper';
            updateTurnMessage();
        }
    }
}

function isValidMove(piece, fromRow, fromCol, toRow, toCol) {
    const rowDiff = toRow - fromRow;
    const colDiff = toCol - fromCol;
    const owner = pieceOwners[fromRow][fromCol];

    switch (piece) {
        case '王':
            return Math.abs(rowDiff) <= 1 && Math.abs(colDiff) <= 1;
        case '相':
            return Math.abs(rowDiff) === 1 && Math.abs(colDiff) === 1;
        case '張':
            return (Math.abs(rowDiff) === 1 && colDiff === 0) || (rowDiff === 0 && Math.abs(colDiff) === 1);
        case '子':
            return (owner === 'upper' && rowDiff === 1 && colDiff === 0) || 
                   (owner === 'lower' && rowDiff === -1 && colDiff === 0);
        case '候':
            if (owner === 'upper') {
                // 위쪽 플레이어의 '후'는 위쪽 두 대각선을 제외한 방향으로 이동
                return (Math.abs(rowDiff) <= 1 && Math.abs(colDiff) <= 1) && !(rowDiff === -1 && Math.abs(colDiff) === 1);
            } else {
                // 아래쪽 플레이어의 '후'는 아래쪽 두 대각선을 제외한 방향으로 이동
                return (Math.abs(rowDiff) <= 1 && Math.abs(colDiff) <= 1) && !(rowDiff === 1 && Math.abs(colDiff) === 1);
            }
    }
    return false;
}

function isValidPlacement(row, col) {
    if (currentPlayer === 'upper' && row === 3) return false;
    if (currentPlayer === 'lower' && row === 0) return false;
    return gameState[row][col] === '';
}

function placePiece(piece, row, col) {
    gameState[row][col] = piece;
    pieceOwners[row][col] = currentPlayer;
    
    const index = capturedPieces[currentPlayer].indexOf(piece);
    capturedPieces[currentPlayer].splice(index, 1);
    
    updateBoard();
    currentPlayer = currentPlayer === 'upper' ? 'lower' : 'upper';
    updateTurnMessage();
}

function handleCapturedPieceClick(event) {
    if (selectedCell) {
        selectedCell.classList.remove('selected');
        selectedCell = null;
    }
    
    const piece = event.target.textContent;
    const owner = event.target.classList.contains('upper') ? 'upper' : 'lower';
    
    if (owner === currentPlayer) {
        selectedPiece = piece;
        message.textContent = `${piece}를 배치할 위치를 선택하세요.`;
    }
}

function checkWinCondition() {
    let upperKing = false;
    let lowerKing = false;

    for (let row = 0; row < 4; row++) {
        for (let col = 0; col < 3; col++) {
            if (gameState[row][col] === '王') {
                if (pieceOwners[row][col] === 'upper') {
                    upperKing = true;
                } else if (pieceOwners[row][col] === 'lower') {
                    lowerKing = true;
                }
            }
        }
    }

    if (!upperKing || !lowerKing || (kingInOpponentTerritory && kingSurvivalTurn)) {
        gameEnded = true;
        restartButton.style.display = 'block';
        return true;
    }

    return false;
}

function restartGame() {
    // 게임 상태 초기화
    gameState = [
        ['相', '王', '張'],
        ['', '子', ''],
        ['', '子', ''],
        ['張', '王', '相']
    ];
    pieceOwners = [
        ['upper', 'upper', 'upper'],
        ['', 'upper', ''],
        ['', 'lower', ''],
        ['lower', 'lower', 'lower']
    ];
    currentPlayer = 'lower';
    kingInOpponentTerritory = null;
    kingSurvivalTurn = false;
    gameEnded = false;
    capturedPieces = { upper: [], lower: [] };

    // UI 초기화
    updateBoard();
    updateTurnMessage();
    if (resultModal) {
        resultModal.style.display = 'none';
    }
    gameEnded = false;  // 게임 종료 상태 해제
}

// 이벤트 리스너 추가
restartButton.addEventListener('click', restartGame);

// 초기 게임 설정
initializeBoard();
updateTurnMessage();

window.addEventListener('click', function(event) {
    if (event.target == resultModal) {
        resultModal.style.display = 'none';
    }
});

function sendMessage(message) {
    socket.send(JSON.stringify(message));
}

function handleRemoteMove(move) {
    const fromCell = document.querySelector(`[data-row="${move.from.row}"][data-col="${move.from.col}"]`);
    movePiece(fromCell, move.to);
}

function handleRemotePlace(place) {
    placePiece(place.piece, place.row, place.col);
}

function updateTurnMessage() {
    const messageElement = document.getElementById('message');
    if (currentPlayer === playerNumber) {
        messageElement.textContent = '당신의 차례입니다.';
    } else {
        messageElement.textContent = '상대방의 차례입니다.';
    }
}
