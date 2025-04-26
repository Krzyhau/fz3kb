// === Common variables and helpers

const { sin, cos, sqrt, PI, atan2, min, max, abs, floor} = Math;
const HALF_PI = PI / 2, TWO_PI = PI * 2;
const SCREEN_SIZE = 720;
const EPSILON = 0.0001;

// === Inputs

var goingLeftInputPart = 0;
var goingRightInputPart = 0;
var jumpingInput = false;
var downInput = false;

const JUMP_KEY = ' ';
const GO_DOWN_KEY = 'ArrowDown';
const LEFT_KEY = 'ArrowLeft';
const RIGHT_KEY = 'ArrowRight';
const SHIFT_LEFT_KEY = 'a';
const SHIFT_RIGHT_KEY = 'd';

document.onkeydown = e => onInputChange(e.key, true);
document.onkeyup = e => onInputChange(e.key, false);
function onInputChange(key, pressed) {
    if (key == JUMP_KEY) jumpingInput = pressed;
    if (key == GO_DOWN_KEY) downInput = pressed;
    if (key == LEFT_KEY) goingLeftInputPart = pressed ? -1 : 0;
    if (key == RIGHT_KEY) goingRightInputPart = pressed ? 1 : 0;
    if (pressed) {
        if (key == SHIFT_LEFT_KEY) shiftPerspective(-HALF_PI);
        if (key == SHIFT_RIGHT_KEY) shiftPerspective(HALF_PI);
    }
}

// === Game data

// defined as [r, g, b]

const COLOR_ID_PLAYER_CUBE = 0;
const COLOR_ID_PLAYER_HAT = 1;
const COLOR_ID_YELLOW_PLATFORM = 2;
const COLOR_ID_RED_PLATFORM = 3;
const COLOR_ID_CYAN_PLATFORM = 4;
const COLOR_ID_GREEN_PLATFORM = 5;

const colors = [
    [255, 255, 255], // 0 - player's cube
    [255,0,0], // 1 - player's red hat
    [240, 180, 60], // 2 - yellow platform
    [238, 75, 43], // 3 - red platform
    [110, 220, 230], // 4 - cyan platform
    [117, 185, 52], // 5 - green platform
]


// saving space on repeating platform pattern
var topPyramidSlab = (step) => [10, 25 + step, -10, 15 - step * 2, 1, 15 - step * 2, COLOR_ID_YELLOW_PLATFORM];
// defined as [x, y, z, width, height, length, colorId, angle (optional)]
const platforms = [
    [0, -2, 2, 5, 1, 5, COLOR_ID_GREEN_PLATFORM],
    [0, 0, 2, 3, 3, 3, COLOR_ID_YELLOW_PLATFORM],
    [-5, 2, -2, 3, 3, 3, COLOR_ID_RED_PLATFORM],
    [5, 4, 5, 3, 3, 3, COLOR_ID_RED_PLATFORM],
    [1, 7, -5, 3, 3, 3, COLOR_ID_RED_PLATFORM],
    [1, 10, -5, 1, 3, 1, COLOR_ID_CYAN_PLATFORM],
    [1, 14, -5, 5, 1, 3, COLOR_ID_GREEN_PLATFORM],
    [7.5, 14, -5, 6, 1, 3, COLOR_ID_GREEN_PLATFORM],
    [10, 19.5, -10, 3, 7, 5, COLOR_ID_RED_PLATFORM],
    [10, 17, -7, 1, 1, 1, COLOR_ID_CYAN_PLATFORM],
    [10, 20, -13, 1, 1, 1, COLOR_ID_CYAN_PLATFORM],

    topPyramidSlab(0),
    topPyramidSlab(1),
    topPyramidSlab(2),
    topPyramidSlab(3),
    topPyramidSlab(4),
    topPyramidSlab(5),
]



// === Game logic

var playerX = 0;
var playerY = 0;
var playerZ = 0;
var playerHorizontalVelocity = 0; // player's velocity is always applied screen-space
var playerVerticalVelocity = 0;
var playerGrounded = false;

var respawnX = 0;
var respawnY = 0;
var respawnZ = 0;

// max distances player can teleport along screen depth without hitting a wall
var nearestFreeSpaceDiff;
var farthestFreeSpaceDiff;

// proposed teleportation distances along screen depth
var resolveForwardDiff;
var resolveBackwardDiff;
var resolveGroundDiff;
var resolveGroundHeightDiff;

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
        handleRespawning();
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
    if (playerGrounded && jumpingInput && !downInput) {
        playJumpSound();
        playerVerticalVelocity = 0.2;
    }
}

function handleGravity() {
    let gravity = playerVerticalVelocity > 0 && jumpingInput ? 0.005 : 0.015;
    playerVerticalVelocity -= gravity;
}

function applyPlayerMovement() {
    handleCollisions();

    playerX += playerHorizontalVelocity * cameraRightX;
    playerY += playerVerticalVelocity;
    playerZ += playerHorizontalVelocity * cameraRightZ;
}

function handleCollisions() {
    prepareCollisionVariables();
    platforms.forEach(handlePlatformCollision);
    resolveCollisions();
}

function prepareCollisionVariables() {
    playerGrounded = false;
    nearestFreeSpaceDiff = -Infinity;
    farthestFreeSpaceDiff = Infinity;
    resolveForwardDiff = 0;
    resolveBackwardDiff = 0;
    resolveGroundDiff = NaN;
    resolveGroundHeightDiff = NaN;
}

function handlePlatformCollision(platform) {
    let [platformX, platformY, platformZ, width, height, length] = platform;
    
    let screenWidth = abs(width * cameraRightX) + abs(length * cameraRightZ);
    let screenHeight = height;
    let screenDepth = abs(length * cameraRightX) + abs(width * cameraRightZ);

    let screenCollisionThresholdX = screenWidth / 2 + 0.5;
    let screenCollisionThresholdY = screenHeight / 2 + 0.5;
    let screenCollisionThresholdZ = screenDepth / 2 + 0.5;

    let worldDiffX = platformX - playerX;
    let worldDiffY = platformY - playerY;
    let worldDiffZ = platformZ - playerZ;

    let screenDiffX = worldDiffX * cameraRightX + worldDiffZ * cameraRightZ;
    let screenDiffY = worldDiffY;
    let screenDiffZ = worldDiffX * cameraForwardX + worldDiffZ * cameraForwardZ;

    let overlapsX = abs(screenDiffX) < screenCollisionThresholdX;
    let overlapsY = abs(screenDiffY) < screenCollisionThresholdY;
    let overlapsZ = abs(screenDiffZ) < screenCollisionThresholdZ;

    let overlapsOnScreenAfterMove =
        abs(screenDiffX - playerHorizontalVelocity) <= screenCollisionThresholdX &&
        abs(screenDiffY - playerVerticalVelocity) <= screenCollisionThresholdY;

    let frontWallDiff = screenDiffZ - screenCollisionThresholdZ;
    let backWallDiff = screenDiffZ + screenCollisionThresholdZ;

    if (overlapsX && overlapsY && !overlapsZ) {
        // candidate for defining free space
        if (screenDiffZ < 0) {
            nearestFreeSpaceDiff = max(nearestFreeSpaceDiff, backWallDiff - EPSILON);
        } else {
            farthestFreeSpaceDiff = min(farthestFreeSpaceDiff, frontWallDiff + EPSILON);
        }
    }
    else if (!overlapsY && overlapsOnScreenAfterMove && playerVerticalVelocity < 0 && !(downInput && jumpingInput)) {
        // candidate for ground landing
        let nearestDepthOnGroundDiff =
            overlapsZ ? 0 : screenDiffZ > 0
            ? max(0, screenDiffZ - screenCollisionThresholdZ + 1)
            : min(0, screenDiffZ + screenCollisionThresholdZ - 1);
        
        let hasCloserGroundAlready = abs(resolveGroundDiff) < abs(nearestDepthOnGroundDiff);
        if (!hasCloserGroundAlready) {
            resolveGroundDiff = nearestDepthOnGroundDiff;
            resolveGroundHeightDiff = screenDiffY + screenCollisionThresholdY + EPSILON;
        }
    }
    else if (!(overlapsX && overlapsY) && overlapsOnScreenAfterMove) {
        // candidate for wall snapping
        resolveForwardDiff = min(resolveForwardDiff, frontWallDiff - EPSILON);
        resolveBackwardDiff = max(resolveBackwardDiff, backWallDiff + EPSILON);
    }
}

function resolveCollisions() {
    if (resolveGroundDiff > nearestFreeSpaceDiff && resolveGroundDiff < farthestFreeSpaceDiff) {
        if (resolveGroundDiff != 0) resolveForwardDiff = resolveGroundDiff;
        playerGrounded = true;
        playerY += resolveGroundHeightDiff;
        playerVerticalVelocity = 0;
    }

    let canResolveForward = resolveForwardDiff > nearestFreeSpaceDiff && resolveForwardDiff < farthestFreeSpaceDiff;
    let canResolveBackward = resolveBackwardDiff > nearestFreeSpaceDiff && resolveBackwardDiff < farthestFreeSpaceDiff;
    let resolveDiff = canResolveForward ? resolveForwardDiff : canResolveBackward ? resolveBackwardDiff : 0;
    
    playerX += resolveDiff * cameraForwardX;
    playerZ += resolveDiff * cameraForwardZ;
}

function handleRespawning() {
    if (playerGrounded) {
        respawnX = playerX;
        respawnY = playerY;
        respawnZ = playerZ;
    }

    if (playerVerticalVelocity < -0.65) {
        playKillSound();
        sinceTeleportTimer = 0;
        playerHorizontalVelocity = playerVerticalVelocity = 0;

        playerX = respawnX;
        playerY = respawnY;
        playerZ = respawnZ;
    }
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
        COLOR_ID_PLAYER_CUBE, playerAngle
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
        COLOR_ID_PLAYER_HAT, hatAngle
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
    let [worldX, worldY, worldZ, width, height, length, colorId, localAngle] = cube;

    let relativeX = worldX - cameraX;
    let relativeY = worldY - cameraY;
    let relativeZ = worldZ - cameraZ;

    let x = relativeX * cameraRightX + relativeZ * cameraRightZ;
    let y = relativeY;
    let angle = localAngle ?? 0 - cameraAngle;
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
        (880 + 600 * t) * t
    ) * min(t, 0.1 - t / 4, 0.1));
}

function playShiftSound() {
    playSound(0.9, t => sin(
            ((120 + shiftDirection * 15) + (sin(250 * t) + 1)) * 9 * t
        ) * min(t, (0.9 - t) / 5, 0.1)
    );
}

function playKillSound() {
    playSound(0.2, t => sin(
        (3880 - 10000 * t) * t
    ) * min(t, 0.2 - t, 0.2));
}

function playWinSound() {
    playSound(4.2, t => sin(
        (5000 - 1000 * (floor(t * 10 * sin(t * 0.51)) % 4))
        * t) * sin(t * 1777) * cos(t * 6000) * 0.1);
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