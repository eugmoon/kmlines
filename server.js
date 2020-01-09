const express = require('express');
const app = express();
const { Server } = require('ws');

const PORT = process.env.PORT || 80;
const INDEX = '/index.html';

app.use(function (req, res) {
    if (req.originalUrl == '/')
        res.sendFile(INDEX, { root: __dirname });
    else
        res.sendFile(req.originalUrl, { root: __dirname });
});

const server = app.listen(PORT, () => {
    console.log(`Listening on port ${PORT}`)
});

const wss = new Server({ server });

wss.on('connection', (ws) => {
    console.log('Client connected');

    ws.on('close', () => console.log('Client disconnected'));

    ws.on('message', (msg) => {
        let message = JSON.parse(msg);
        let response;
        
        switch(message.msg) {
            case "INITIALIZE":
                player = "Player 1";
                response = {
                    id: message.id,
                    msg: message.msg,
                    body: {
                        newLine: null,
                        heading: player,
                        message: `Awaiting ${player}'s Move`
                    }
                };
                isFirstClick = true;
                isNewGame = true;
                isGameContinuing = true;
                clearGameBoard();
                ws.send(JSON.stringify(response));
                break;
            case "NODE_CLICKED":
                if (isFirstClick && isGameContinuing) {
                    if (!isNewGame && !isValidClick(isFirstClick, message.body.x, message.body.y)) {
                        response = {
                            id: message.id,
                            msg: "INVALID_START_NODE",
                            body: {
                                newLine: null,
                                heading: player,
                                message: "Not a valid starting position."
                            }
                        };
                    }
                    else {
                        response = {
                            id: message.id,
                            msg: "VALID_START_NODE",
                            body: {
                                newLine: null,
                                heading: player,
                                message: "Select a second node to complete the line."
                            }
                        };
                        startNode[0] = message.body.x;
                        startNode[1] = message.body.y;
                        isFirstClick = false;
                    }
                    ws.send(JSON.stringify(response));
                }
                else if (isGameContinuing) {
                    if (isValidClick(isFirstClick, message.body.x, message.body.y)) {
                        if (isGameContinuing)
                            player = player == "Player 1" ? "Player 2" : "Player 1";
                        updatePathEnds(isNewGame, message.body.x, message.body.y);
                        updateVisited(startNode[0], startNode[1], message.body.x, message.body.y);
                        if (isGameOver()) {
                            response = {
                                id: message.id,
                                msg: "GAME_OVER",
                                body: {
                                    newLine: {
                                        start: {
                                            x: startNode[0],
                                            y: startNode[1]
                                        },
                                        end: {
                                            x: message.body.x,
                                            y: message.body.y
                                        }
                                    },
                                    heading: "Game Over",
                                    message: `${player} Wins!`
                                }
                            };
                            ws.send(JSON.stringify(response));
                            isGameContinuing = false;
                            break;
                        }
                        response = {
                            id: message.id,
                            msg: "VALID_END_NODE",
                            body: {
                                newLine: {
                                    start: {
                                        x: startNode[0],
                                        y: startNode[1]
                                    },
                                    end: {
                                        x: message.body.x,
                                        y: message.body.y
                                    }
                                },
                                heading: player,
                                message: null
                            }
                        };
                        isFirstClick = true;
                        isNewGame = false;
                    }
                    else {
                        response = {
                            id: message.id,
                            msg: "INVALID_END_NODE",
                            body: {
                                newLine: null,
                                heading: player,
                                message: "Invalid move!"
                            }
                        };
                        isFirstClick = true;
                    }
                    ws.send(JSON.stringify(response));
                }
                break;
            default:
                break;
        }
    });
});

let diagonal = [];
for (let i = 0; i < 3; i++) {
    diagonal[i] = [];
    for (let j = 0; j < 3; j++) {
        diagonal[i][j] = false;
    }
}
let isGameContinuing = true;
let isNewGame = false;
let isFirstClick = true;
let pathEnds = {
    endAx: -1,
    endAy: -1,
    endBx: -1,
    endBy: -1
};
let player = "Player 1";
let startNode = [];
let visited = [];
for (let i = 0; i < 4; i++) {
    visited[i] = [];
    for (let j = 0; j < 4; j++) {
        visited[i][j] = false;
    }
}

function clearGameBoard() {
    for (let i = 0; i < 4; i++) {
        for (let j = 0; j < 4; j++) {
            visited[i][j] = false;
            if (i < 3 && j < 3)
                diagonal[i][j] = false;
        }
    }
}

function isBlocked(x, y) {
    if (x > 0 && y > 0 && !isVisited(x - 1, y - 1) && !isDiagonalCross(x - 1, y - 1))
        return false;
    else if (y > 0 && !isVisited(x, y - 1))
        return false;
    else if (x < 3 && y > 0 && !isVisited(x + 1, y - 1) && !isDiagonalCross(x, y - 1))
        return false;
    else if (x > 0 && !isVisited(x - 1, y))
        return false;
    else if (x < 3 && !isVisited(x + 1, y))
        return false;
    else if (x > 0 && y < 3 && !isVisited(x - 1, y + 1) && !isDiagonalCross(x - 1, y))
        return false;
    else if (y < 3 && !isVisited(x, y + 1))
        return false;
    else if (x < 3 && y < 3 && !isVisited(x + 1, y + 1) && !isDiagonalCross(x, y))
        return false;
    return true;
}

function isDiagonalCross(x, y) {
    return diagonal[x][y];
}

function isGameOver() {
    if (isBlocked(pathEnds.endAx, pathEnds.endAy) && isBlocked(pathEnds.endBx, pathEnds.endBy))
        return true;
    return false;
}

function isOctoLinear(x, y) {
    if (x == startNode[0])
        return true;
    else if (y == startNode[1])
        return true;
    else if (Math.abs(x - startNode[0]) == Math.abs(y - startNode[1]))
        return true;
    return false;
}

function isValidClick(isLineStart, x, y) {
    if (isLineStart) {
        if (x == pathEnds.endAx && y == pathEnds.endAy)
            return true;
        else if (x == pathEnds.endBx && y == pathEnds.endBy)
            return true;
    }
    else {
        if (!isVisited(x, y) && isOctoLinear(x, y) && isValidMove(x, y))
            return true;
    }

    return false;
}

function isValidMove(x, y) {
    let result = false;

    if (x == startNode[0]) {
        result = true;
        if (y < startNode[1]) {
            for (let i = y; i < startNode[1]; i++) {
                if (isVisited(x, i)) {
                    result = false;
                }
            }
        }
        else if (y > startNode[1]) {
            for (let i = y; i > startNode[1]; i--) {
                if (isVisited(x, i)) {
                    result = false;
                }
            }
        }
        else if (y == startNode[1])
            result = false;
    }
    else if (y == startNode[1]) {
        result = true;
        if (x < startNode[0]) {
            for (let i = x; i < startNode[0]; i++) {
                if (isVisited(i, y)) {
                    result = false;
                }
            }
        }
        else if (x > startNode[0]) {
            for (let i = x; i > startNode[0]; i--) {
                if (isVisited(i, y)) {
                    result = false;
                }
            }
        }
    }
    else if (Math.abs(x - startNode[0]) == Math.abs(y - startNode[1])) {
        result = true;
        let left;
        if ((x < startNode[0] && y < startNode[1]) || (x > startNode[0] && y > startNode[1])) {
            left = x < startNode[0] ? x : startNode[0] + 1;
            let top = y < startNode[1] ? y : startNode[1] + 1;
            for (let i = 0; i < Math.abs(startNode[0] - x); i++) {
                if (isVisited(left + i, top + i)) {
                    result = false;
                }
                if (x < startNode[0] && isDiagonalCross(left + i, top + i)) {
                    result = false;
                }
                else if (x > startNode[0] && isDiagonalCross(left + i - 1, top + i - 1)) {
                    result = false;
                }
            }
        }
        else if ((x > startNode[0] && y < startNode[1]) || (x < startNode[0] && y > startNode[1])) {
            left = x < startNode[0] ? x : startNode[0] + 1;
            let bottom = y < startNode[1] ? startNode[1] - 1 : y;
            for (let i = 0; i < Math.abs(startNode[0] - x); i++) {
                if (isVisited(left + i, bottom - i)) {
                    result = false;
                }
                if (x < startNode[0] && isDiagonalCross(left + i, bottom - i - 1)) {
                    result = false;
                }
                else if (x > startNode[0] && isDiagonalCross(left + i - 1, bottom - i)) {
                    result = false;
                }
            }
        }
    }

    return result;
}

function isVisited(x, y) {
    return visited[x][y];
}

function updatePathEnds(isFirstMove, x, y) {
    if (isFirstMove) {
        pathEnds.endAx = startNode[0];
        pathEnds.endAy = startNode[1];
        pathEnds.endBx = x;
        pathEnds.endBy = y;
    }
    else {
        if (startNode[0] == pathEnds.endAx && startNode[1] == pathEnds.endAy) {
            pathEnds.endAx = x;
            pathEnds.endAy = y;
        }
        else {
            pathEnds.endBx = x;
            pathEnds.endBy = y;
        }
    }
}

function updateVisited(x1, y1, x2, y2) {
    if (x1 == x2) {
        if (y1 < y2) {
            for (let i = y1; i <= y2; i++) {
                visited[x1][i] = true;
            }
        }
        else if (y1 > y2) {
            for (let i = y1; i >= y2; i--) {
                visited[x1][i] = true;
            }
        }
    }
    else if (y1 == y2) {
        if (x1 < x2) {
            for (let i = x1; i <= x2; i++) {
                visited[i][y1] = true;
            }
        }
        else if (x1 > x2) {
            for (let i = x1; i >= x2; i--) {
                visited[i][y1] = true;
            }
        }
    }
    else if (Math.abs(x1 - x2) == Math.abs(y1 - y2)) {
        let left;
        if ((x1 < x2 && y1 < y2) || (x1 > x2 && y1 > y2)) {
            left = x1 < x2 ? x1 : x2;
            let top = y1 < y2 ? y1 : y2;
            for (let i = 0; i < Math.abs(x2 - x1); i++) {
                visited[left + i][top + i] = true;
                diagonal[left + i][top + i] = true;
            }
            visited[left + Math.abs(x2 - x1)][top + Math.abs(x2 - x1)] = true;
        }
        else if ((x1 > x2 && y1 < y2) || (x1 < x2 && y1 > y2)) {
            left = x1 < x2 ? x1 : x2;
            let bottom = y1 < y2 ? y2 : y1;
            for (let i = 0; i < Math.abs(x2 - x1); i++) {
                visited[left + i][bottom - i] = true;
                diagonal[left + i][bottom - i - 1] = true;
            }
            visited[left + Math.abs(x2 - x1)][bottom - Math.abs(x2 - x1)] = true;
        }
    }
}
