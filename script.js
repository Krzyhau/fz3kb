const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const { sin, cos, sqrt, PI, atan2, min, max, abs } = Math;
const HALF_PI = PI / 2, TWO_PI = PI * 2;
const SCREEN_SIZE = canvas.width;

// === Inputs

var goingLeftInputPart = 0;
var goingRightInputPart = 0;
var jumpingInput = false;

const JUMP_KEY = ' ';
const LEFT_KEY = 'ArrowLeft';
const RIGHT_KEY = 'ArrowRight';
const SHIFT_LEFT_KEY = 'a';
const SHIFT_RIGHT_KEY = 'd';

document.onkeydown = e => {
    if (e.key == JUMP_KEY) jumpingInput = true;
    if (e.key == LEFT_KEY) goingLeftInputPart = -1;
    if (e.key == RIGHT_KEY) goingRightInputPart = 1;
    if (e.key == SHIFT_LEFT_KEY) shiftPerspective(HALF_PI);
    if (e.key == SHIFT_RIGHT_KEY) shiftPerspective(-HALF_PI);
}
document.onkeyup = e => {
    if (e.key == JUMP_KEY) jumpingInput = false;
    if (e.key == LEFT_KEY) goingLeftInputPart = 0;
    if (e.key == RIGHT_KEY) goingRightInputPart = 0;
}

// === Game data

const colors = [
    [255, 255, 255],
    [255,0,0],
    [240, 180, 60],
    [238, 75, 43],
    [110, 220, 230],
    [117, 185, 52],
]

const platforms = [
    [0, -1, 0, 3, 1, 3, 0, 2],
    [5, 1, 5, 1, 2, 3, 0, 3],
    [10, -3, 10, 3, 8, 3, 0, 4],
]

// === Game logic

var playerX = 0;
var playerY = 0;
var playerZ = 0;
var playerHorizontalVelocity = 0;
var playerVerticalVelocity = 0;
var playerGrounded = false;

var cameraX = 0;
var cameraY = 0;
var cameraZ = 0;
var cameraAngle = 0;
var cameraSize = 15;

var cameraForwardX;
var cameraForwardZ;

var shifting = false;
var shiftStart = 0;
var shiftEnd = 0;
var shiftTime = 0;
var shiftDirection = 0;
var timeSinceFell = 0;

setInterval(gameLoop, 15);
function gameLoop() {
    updateCamera();
    if (shifting) {
        shiftingUpdate();
    } else {
        preparePlayerMovement();
        applyPlayerMovement();
        checkSafetyTeleport();
    }
    draw();
}

function updateCamera() {
    cameraForwardX = cos(cameraAngle);
    cameraForwardZ = sin(cameraAngle);

    cameraX += (playerX - cameraX) * 0.1;
    cameraZ += (playerZ - cameraZ) * 0.1;
    var targetCameraY = playerY + 0.25 * cameraSize;
    cameraY += (targetCameraY - cameraY) * min(1, timeSinceFell * 0.5);
}

function shiftPerspective(direction) {
    if (shifting) return;

    shiftDirection = direction;
    shifting = true;
    shiftStart = cameraAngle;
    shiftEnd = cameraAngle + direction;
    shiftTime = 0
}

function shiftingUpdate() {
    let shiftSineProgress = -(cos(PI * shiftTime) - 1) / 2;
    cameraAngle = shiftStart + (shiftEnd - shiftStart) * shiftSineProgress;

    shiftTime += 0.02;
    if (shiftTime > 1) {
        cameraAngle = shiftEnd % TWO_PI;
        shifting = false;
    }
}

function preparePlayerMovement() {
    var movementInput = goingLeftInputPart + goingRightInputPart;
    playerHorizontalVelocity += movementInput * 0.04;
    playerHorizontalVelocity *= 0.7; // friction

    handleJumping();
    handleGravity();
}

function handleJumping() {
    if (playerGrounded && jumpingInput) {
        playerVerticalVelocity = 0.2;
    }
}

function handleGravity() {
    let gravity = playerVerticalVelocity > 0 && jumpingInput ? 0.005 : 0.015;
    playerVerticalVelocity -= gravity;
}

function applyPlayerMovement() {
    playerX += playerHorizontalVelocity * cameraForwardX;
    playerZ += playerHorizontalVelocity * -cameraForwardZ;

    // handling collisions between x and y axis movement to improve jumping into corners
    handleCollisions();

    playerY += playerVerticalVelocity;
}

function handleCollisions() {
    playerGrounded = false;
    platforms.forEach(platform => {
        checkCollision(platform);
    });
}

function checkCollision(platform) {
    let [platformX, platformY, platformZ, width, height, length] = platform;

    let projectedPlayerX = playerX * cameraForwardX - playerZ * cameraForwardZ;
    let platformProjectedX = platformX * cameraForwardX - platformZ * cameraForwardZ;
    
    let projectedWidth = abs(width * cameraForwardX) + abs(length * cameraForwardZ);
    let projectedLength = abs(length * cameraForwardX) + abs(width * cameraForwardZ);

    let projectedXDelta = abs(projectedPlayerX - platformProjectedX);
    let projectedYDelta = abs(playerY + 0.5 - platformY);
    let projectedYDeltaAfterMove = abs(playerY + playerVerticalVelocity + 0.5 - platformY);

    if (projectedXDelta < projectedWidth / 2 + 0.5) {
        let projectedPlayerDepth = playerZ * cameraForwardX + playerX * cameraForwardZ;
        let platformProjectedDepth = platformZ * cameraForwardX + platformX * cameraForwardZ;
        let projectedDepthDelta = projectedPlayerDepth - platformProjectedDepth;

        if (projectedYDelta < height / 2 + 0.5) {
            if (projectedDepthDelta > 0) {
                projectedDepthDelta += projectedLength / 2 + 0.5;
                playerX -= (projectedDepthDelta) * cameraForwardZ;
                playerZ -= (projectedDepthDelta) * cameraForwardX;
            }
            
        } else if (projectedYDeltaAfterMove < height / 2 + 0.5) {
            playerY = platformY + height / 2;
            playerVerticalVelocity = 0;
            playerGrounded = true;

            if (abs(projectedDepthDelta) > projectedLength / 2 + 0.5) {
                projectedDepthDelta += projectedLength / 2 - 0.5;
                playerX -= (projectedDepthDelta) * cameraForwardZ;
                playerZ -= (projectedDepthDelta) * cameraForwardX;
            }
        }
    }
}

function checkSafetyTeleport() {
    timeSinceFell += 0.02;
    if (playerY < -20) {
        timeSinceFell = 0;
        playerY = 0;
        playerX = 0;
        playerZ = 0;
        playerHorizontalVelocity = 0;
        playerVerticalVelocity = 0;
    }
}

// === Drawing

var cubeDrawQueue = [];

function draw() {
    ctx.resetTransform();
    ctx.fillStyle = '#141523';
    ctx.fillRect(0, 0, SCREEN_SIZE, SCREEN_SIZE);

    ctxApplyCameraProjection();
    drawPlatforms();
    drawPlayer();
    resolveDrawQueue();
    
}

function ctxApplyCameraProjection() {
    ctx.scale(SCREEN_SIZE, SCREEN_SIZE);
    ctx.translate(0.5, 0.5);
    ctx.scale(1 / cameraSize, -1 / cameraSize);
}

function drawPlayer() {
    let playerAngle = -cameraAngle - sin(shiftTime * 2 * shiftDirection) * 0.4;
    cubeDrawQueue.push([playerX, playerY + 0.5, playerZ, 1, 1, 1, playerAngle, 0]);
    let hatOffsetX = - 0.25 * cameraForwardX;
    let hatOffsetY = 1.25 - min(0, max(-0.25, playerVerticalVelocity));
    let hatOffsetZ = 0.25 * cameraForwardZ;
    let hatAngle = cameraAngle * -2;
    cubeDrawQueue.push([playerX + hatOffsetX, playerY + hatOffsetY, playerZ + hatOffsetZ, 0.5, 0.5, 0.5, hatAngle, 1]);
}

function drawPlatforms() {
    platforms.forEach(platform => cubeDrawQueue.push(platform));
}

function resolveDrawQueue() {
    sortDrawQueue();
    cubeDrawQueue.forEach(cube => drawCube(cube));
    cubeDrawQueue = [];
}

function sortDrawQueue() {
    // compares depth of cubes by doing (b-a).dot(cameraForward), 
    // essentially getting the difference of depth between their origin points
    cubeDrawQueue.sort((a, b) => (b[0] - a[0]) * cameraForwardZ + (b[2] - a[2]) * cameraForwardX);
}

function drawCube(cube) {
    let [worldX, worldY, worldZ, width, height, length, localAngle, colorId] = cube;

    let relativeX = worldX - cameraX;
    let relativeY = worldY - cameraY;
    let relativeZ = worldZ - cameraZ;

    let x = relativeX * cameraForwardX - relativeZ * cameraForwardZ;
    let y = relativeY;
    let angle = localAngle + cameraAngle;
    let color = colors[colorId];

    let halfTurnWrappedAngle = ((angle % PI) + PI) % PI;
    let quarterTurnWrappedAngle = halfTurnWrappedAngle % HALF_PI;
    
    let shouldSwitchSides = halfTurnWrappedAngle >= HALF_PI;
    if (shouldSwitchSides) [width, length] = [length, width];
    
    let halfDiagonalSize = sqrt(width * width + length * length) / 2;
    let angleCos = cos(quarterTurnWrappedAngle);
    let angleSin = sin(quarterTurnWrappedAngle);
    let edgeAngleDelta = atan2(width, length);

    let leftEdgeAngleSin = sin((PI + edgeAngleDelta + quarterTurnWrappedAngle));
    let leftWallEdgeOffset = leftEdgeAngleSin * halfDiagonalSize;
    let leftWallSize = angleSin * length;
    let leftWallShading = angleSin * 0.7 + 0.3;

    setWallColor(color, leftWallShading);
    ctx.fillRect(x + leftWallEdgeOffset, y - height / 2, leftWallSize, height);

    let rightEdgeAngleSin = sin((TWO_PI - edgeAngleDelta + quarterTurnWrappedAngle));
    let rightWallEdgeOffset = rightEdgeAngleSin * halfDiagonalSize;
    let rightWallSize = angleCos * width;
    let rightWallShading = angleCos * 0.7 + 0.3;

    setWallColor(color, rightWallShading);
    ctx.fillRect(x + rightWallEdgeOffset, y - height / 2, rightWallSize, height);
}

function setWallColor(color, shade) {
    ctx.fillStyle = `rgb(${color[0] * shade} ${color[1] * shade} ${color[2] * shade})`;
}