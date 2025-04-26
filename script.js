// === Common variables and helpers

const { sin, cos, sqrt, PI, atan2, min, max, abs } = Math;
const HALF_PI = PI / 2, TWO_PI = PI * 2;
const SCREEN_SIZE = 720;

// === Inputs

var goingLeftInputPart = 0;
var goingRightInputPart = 0;
var jumpingInput = false;

const JUMP_KEY = ' ';
const LEFT_KEY = 'ArrowLeft';
const RIGHT_KEY = 'ArrowRight';
const SHIFT_LEFT_KEY = 'a';
const SHIFT_RIGHT_KEY = 'd';

document.onkeydown = e => onInputChange(e.key, true);
document.onkeyup = e => onInputChange(e.key, false);
function onInputChange(key, pressed) {
    if (key == JUMP_KEY) jumpingInput = pressed;
    if (key == LEFT_KEY) goingLeftInputPart = pressed ? -1 : 0;
    if (key == RIGHT_KEY) goingRightInputPart = pressed ? 1 : 0;
    if (pressed) {
        if (key == SHIFT_LEFT_KEY) shiftPerspective(-HALF_PI);
        if (key == SHIFT_RIGHT_KEY) shiftPerspective(HALF_PI);
    }
}

// === Game data

// defined as [r, g, b]
const colors = [
    [255, 255, 255], // 0 - player's cube
    [255,0,0], // 1 - player's red hat
    [240, 180, 60], // 2 - yellow platform
    [238, 75, 43], // 3 - red platform
    [110, 220, 230], // 4 - cyan platform
    [117, 185, 52], // 5 - green platform
]

// defined as [x, y, z, width, height, length, angle, colorId]
const platforms = [
    [0, -2, 0, 3, 1, 3, 0, 2],
    [5, -1, 5, 1, 2, 3, 0, 3],
    [10, -2, 10, 3, 8, 3, 0, 4],
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

var cameraRightX;
var cameraRightZ;
var cameraForwardX;
var cameraForwardZ;

var shifting = false;
var shiftStart = 0;
var shiftDirection = 0;

var shiftTimer = 0;
var sinceTeleportTimer = 0;

setInterval(gameLoop, 15);
function gameLoop() {
    updateTimers();
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

function updateTimers() {
    sinceTeleportTimer += 0.01;
}

function updateCamera() {
    cameraRightX = cos(cameraAngle);
    cameraRightZ = sin(cameraAngle);
    cameraForwardX = -cameraRightZ;
    cameraForwardZ = cameraRightX;

    // ease camera horizontally
    cameraX += (playerX - cameraX) * 0.1;
    cameraZ += (playerZ - cameraZ) * 0.1;

    // target point slightly higher than player to keep them little bit below
    var targetCameraY = playerY + 0.2 * cameraSize;
    // easing only right after falling for a nice transition
    cameraY += (targetCameraY - cameraY) * min(1, sinceTeleportTimer);
}

function shiftPerspective(direction) {
    if (shifting) return;

    shifting = true;
    shiftTimer = 0
    shiftDirection = direction;
    shiftStart = cameraAngle;
    playShiftSound();
}

function shiftingUpdate() {
    let shiftSineProgress = -(cos(PI * shiftTimer) - 1) / 2;
    cameraAngle = shiftStart + shiftDirection * shiftSineProgress;

    shiftTimer += 0.02;
    if (shiftTimer > 1) {
        cameraAngle = (shiftStart + shiftDirection) % TWO_PI;
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
        playJumpSound();
        playerVerticalVelocity = 0.2;
    }
}

function handleGravity() {
    let gravity = playerVerticalVelocity > 0 && jumpingInput ? 0.005 : 0.015;
    playerVerticalVelocity -= gravity;
}

function applyPlayerMovement() {
    playerX += playerHorizontalVelocity * cameraRightX;
    playerZ += playerHorizontalVelocity * cameraRightZ;

    // handling collisions between x and y axis movement 
    // to improve jumping into corners
    handleCollisions();

    playerY += playerVerticalVelocity;
}

function handleCollisions() {
    playerGrounded = false;
    platforms.forEach(handlePlatformCollision);
}

function handlePlatformCollision(platform) {
    let [platformX, platformY, platformZ, width, height, length] = platform;
    
    let projectedWidth = abs(width * cameraRightX) + abs(length * cameraRightZ);
    let projectedLength = abs(length * cameraRightX) + abs(width * cameraRightZ);

    let widthDistanceThreshold = projectedWidth / 2 + 0.5;
    let heightDistanceThreshold = height / 2 + 0.5;
    let lengthDistanceThreshold = projectedLength / 2 + 0.5;

    let projectedXDelta = (platformX - playerX) * cameraRightX + (platformZ - playerZ) * cameraRightZ;
    let projectedXDeltaAbs = abs(projectedXDelta);
    
    if (projectedXDeltaAbs < widthDistanceThreshold) {
        let projectedYDeltaAbs = abs(playerY - platformY);
        let projectedYAfterMoveDeltaAbs = abs(playerY + playerVerticalVelocity - platformY);
        let projectedDepthDelta = (platformX - playerX) * cameraForwardX + (platformZ - playerZ) * cameraForwardZ;

        let correctionDistance = 0;
        
        let overlappingPlatform = projectedYDeltaAbs < heightDistanceThreshold;
        let willOverlapPlatformAfterMove = projectedYAfterMoveDeltaAbs < heightDistanceThreshold;
        
        if (overlappingPlatform) {
            let isBehindPlatformFrontFace = projectedDepthDelta < lengthDistanceThreshold;
            if (isBehindPlatformFrontFace) {
                correctionDistance = projectedDepthDelta - lengthDistanceThreshold;
            }
        }
        else if (willOverlapPlatformAfterMove) {
            playerY = platformY + heightDistanceThreshold
            playerVerticalVelocity = 0;
            playerGrounded = true;

            let isNotAbovePlatformHorizontally = abs(projectedDepthDelta) > lengthDistanceThreshold;
            if (isNotAbovePlatformHorizontally) {
                correctionDistance = projectedDepthDelta - lengthDistanceThreshold + 1;
            }
        }

        playerX += correctionDistance * cameraForwardX;
        playerZ += correctionDistance * cameraForwardZ;
    }
}

function checkSafetyTeleport() {
    if (playerY < -20) {
        teleportPlayer(0, 0, 0);
    }
}

function teleportPlayer(x, y, z) {
    playerX = x;
    playerY = y;
    playerZ = z;

    playerHorizontalVelocity = playerVerticalVelocity = 0;
    sinceTeleportTimer = 0;
    playKillSound();
}

// === Drawing

const ctx = document.body.children[0].getContext('2d');
var cubeDrawQueue = [];

function draw() {
    prepareScreen();
    drawPlatforms();
    drawPlayer();
    resolveDrawQueue();
}

function prepareScreen() {
    // set screen projection transform
    var offset = SCREEN_SIZE / 2;
    var scale = SCREEN_SIZE / cameraSize;
    ctx.setTransform(scale, 0, 0, -scale, offset, offset);

    // clear entire screen while keeping the transform
    ctx.fillStyle = '#141523';
    ctx.fillRect(-scale, -scale, scale * 2, scale * 2);
}

function drawPlatforms() {
    cubeDrawQueue.push(...platforms);
}

function drawPlayer() {
    // main player cube
    let playerAngleShiftingTilt = -sin(shiftTimer * 2 * shiftDirection) * 0.4;
    let playerAngle = cameraAngle + playerAngleShiftingTilt;
    cubeDrawQueue.push([
        playerX, playerY, playerZ,
        1, 1, 1,
        playerAngle, 0
    ]);
    
    // hat cube
    let hatFallingOffset = min(0, max(-0.25, playerVerticalVelocity));
    let hatOffsetX = -0.25 * cameraRightX;
    let hatOffsetY = 0.75 - hatFallingOffset;
    let hatOffsetZ = -0.25 * cameraRightZ;
    let hatAngle = cameraAngle * 2;
    cubeDrawQueue.push([
        playerX + hatOffsetX, playerY + hatOffsetY, playerZ + hatOffsetZ,
        0.5, 0.5, 0.5,
        hatAngle, 1
    ]);
}

function resolveDrawQueue() {
    sortDrawQueue();
    cubeDrawQueue.forEach(drawCube);
    cubeDrawQueue = [];
}

function sortDrawQueue() {
    // compares depth of cubes by doing (b-a).dot(cameraForward), 
    // essentially getting the difference of depth between their origin points
    cubeDrawQueue.sort((a, b) => (b[0] - a[0]) * cameraForwardX + (b[2] - a[2]) * cameraForwardZ);
}

function drawCube(cube) {
    let [worldX, worldY, worldZ, width, height, length, localAngle, colorId] = cube;

    let relativeX = worldX - cameraX;
    let relativeY = worldY - cameraY;
    let relativeZ = worldZ - cameraZ;

    let x = relativeX * cameraRightX + relativeZ * cameraRightZ;
    let y = relativeY;
    let angle = localAngle - cameraAngle;
    let color = colors[colorId];

    let halfTurnWrappedAngle = ((angle % PI) + PI) % PI;
    let quarterTurnWrappedAngle = halfTurnWrappedAngle % HALF_PI;
    
    let shouldSwitchSides = halfTurnWrappedAngle >= HALF_PI;
    if (shouldSwitchSides) [width, length] = [length, width];
    
    let edgeAngleDelta = atan2(width, length);

    const drawWall = (edgeAngle, size, dotProduct) => {
        let edgeAngleSin = sin(edgeAngle + quarterTurnWrappedAngle);
        let halfDiagonalSize = sqrt(width * width + length * length) / 2;
        let edgeWallOffset = edgeAngleSin * halfDiagonalSize;
        let wallSize = size * dotProduct;
        let shade = dotProduct * 0.7 + 0.3;

        ctx.fillStyle = `rgb(${color[0] * shade} ${color[1] * shade} ${color[2] * shade})`;
        ctx.fillRect(x + edgeWallOffset, y - height / 2, wallSize, height);
    }

    drawWall(PI + edgeAngleDelta, length, sin(quarterTurnWrappedAngle));
    drawWall(TWO_PI - edgeAngleDelta, width, cos(quarterTurnWrappedAngle));
}

// === Audio

const SAMPLE_RATE = 44100;

function playJumpSound() {
    playSound(0.4, t => sin(
        (880 + 600 * t) * t // frequency
    ) * min(t, 0.1 - t / 4, 0.1)); // volume
}

function playShiftSound() {
    playSound(0.9, t => sin(
            ((120 + shiftDirection * 15) + (sin(250 * t) + 1)) * 9 * t // frequency
        ) * min(t, (0.9 - t) / 5, 0.1) // volume
    );
}

function playKillSound() {
    playSound(0.2, t => sin(
        (3880 - 10000 * t) * t // frequency
    ) * min(t, 0.2 - t, 0.2)); // volume
}

function playSound(duration, func) {
    let audioCtx = new AudioContext();
    let samples = SAMPLE_RATE * duration;
    let buffer = audioCtx.createBuffer(1, samples, SAMPLE_RATE);
    let data = buffer.getChannelData(0);

    for (let i = 0; i < samples; i++) {
        data[i] = func(i / SAMPLE_RATE);
    }

    let source = audioCtx.createBufferSource();
    source.buffer = buffer;
    source.connect(audioCtx.destination);
    source.start();
}