const http = require('http');
const WebSocket = require('ws');
const fs = require('fs');
const path = require('path');

const server = http.createServer((req, res) => {
    let filePath = '.' + req.url;
    if (filePath === './') {
        filePath = './index.html';
    }

    const extname = String(path.extname(filePath)).toLowerCase();
    const contentType = {
        '.html': 'text/html',
        '.js': 'text/javascript',
        '.css': 'text/css'
    }[extname] || 'application/octet-stream';

    fs.readFile(filePath, (error, content) => {
        if (error) {
            if (error.code === 'ENOENT') {
                res.writeHead(404);
                res.end('File not found');
            } else {
                res.writeHead(500);
                res.end('Internal server error: ' + error.code);
            }
        } else {
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(content, 'utf-8');
        }
    });
});

const wss = new WebSocket.Server({ server });

const clients = new Map();
let waitingPlayer = null;

wss.on('connection', (ws) => {
    ws.on('message', (message) => {
        const data = JSON.parse(message);
        
        if (data.type === 'nickname') {
            clients.set(ws, { nickname: data.nickname, ready: false });
            console.log(`새로운 플레이어 접속: ${data.nickname}`);
            
            if (!waitingPlayer) {
                waitingPlayer = ws;
                ws.send(JSON.stringify({ type: 'wait', message: '상대방을 기다리는 중...' }));
            } else {
                // 게임 시작
                waitingPlayer.send(JSON.stringify({ type: 'start', opponent: data.nickname, player: 'upper' }));
                ws.send(JSON.stringify({ type: 'start', opponent: clients.get(waitingPlayer).nickname, player: 'lower' }));
                waitingPlayer = null;
            }
        } else {
            // 게임 중 메시지 전달
            wss.clients.forEach(client => {
                if (client !== ws && client.readyState === WebSocket.OPEN) {
                    client.send(JSON.stringify(data));
                }
            });
        }
    });

    ws.on('close', () => {
        console.log(`플레이어 접속 종료: ${clients.get(ws)?.nickname}`);
        if (waitingPlayer === ws) {
            waitingPlayer = null;
        }
        clients.delete(ws);
    });
});

server.listen(8080, () => {
    console.log('서버가 http://localhost:8080 에서 실행 중입니다.');
});
