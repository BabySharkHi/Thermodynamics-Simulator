const canvas = document.getElementById("container");
const ctx = canvas.getContext("2d");
const temperatureDisplay = document.getElementById("temperature");
const areaDisplay = document.getElementById("area");
const collisionDisplay = document.getElementById("collisions");
const impulsePerCollisionDisplay = document.getElementById("impulse-per-collision");
const pressureDisplay = document.getElementById("pressure");
const moleculeCountDisplay = document.getElementById("molecule-count");

const pausePlayButton = document.getElementById("pause-play-button");
let isPaused = true;

let curTime = 0.0;
const simSpeedButton = document.getElementById("sim-speed-button");
const simSpeedFactors = [0.1,0.2,0.5,1,2,5,10];
let simSpeedIndex = 3;
let simSpeedFactor = 1;
const simSpeedDisplay = document.getElementById("sim-speed");

const STARTING_MOLECULES = 200;

const maxHeightFactor = 2.0;
canvas.width = canvas.clientWidth;
canvas.height = canvas.clientHeight;
const maxHeight = canvas.height;
const startingHeight = canvas.height / maxHeightFactor;

const heightSlider = document.getElementById("height-slider");
const heightScaleDisplay = document.getElementById("height-scale");
var heightFactor = 1;

let curTemp = 300;

const tempSlider = document.getElementById("temp-slider");
const tempNumberInput = document.getElementById("temp-number-input");
const moleSlider = document.getElementById("mole-slider");
const moleNumberInput = document.getElementById("mole-number-input");

const BOLTZMANN_CONSTANT = 1.380649e-23;
const NITROGEN_MASS = 4.65e-26;
const AVAGADRO_NUMBER = 6.022e23;

const SECONDS_PER_FRAME = 1e-5;
const METERS_PER_PIXEL = 2.226e-3;
const SECONDS_PER_WINDOW = 0.01;

const DEGREES_OF_FREEDOM = 2; //degrees of freedom

let numCollisions = 0;
let totalImpulse = 0;
const collisionTimes = [];
let collisionIndex = 0;

class Ball {
    constructor(x, y, radius = 10, fillColor = "black", vx = 1, vy = 1, vz = 1, mass = 1, num = AVAGADRO_NUMBER) {
        this.x = x;
        this.y = y;
        this.radius = radius;
        this.fillColor = fillColor;
        this.vx = vx;
        this.vy = vy;
        this.vz = vz;
        this.mass = mass;
        this.num = num;
        this.effMass = mass * num;
    }
}

function random(a, b) {
    return Math.random() * (b-a) + a;
}

const molecules = [];
let N = 0;

document.getElementById("add-molecule")
        .addEventListener("click", addMolecule);

document.getElementById("remove-molecule")
        .addEventListener("click", removeMolecule);


function createMolecule() {
    let speed = calculateRMSFromTemp();
    let angle = Math.random() * 2 * Math.PI;
    molecules.push(new Ball(Math.random() * canvas.width,
                            Math.random() * canvas.height,
                            2,
                            "blue",
                            speed * Math.cos(angle),
                            speed * Math.sin(angle),
                            0,
                            NITROGEN_MASS,
                            AVAGADRO_NUMBER
                        ));
    N ++;
}

function addMolecule(num) {
    for (let i = 0; i < num; i ++) {
        createMolecule();
    }
}

function removeMolecule(num) {
    if (molecules.length - num <= 0) {
        console.log("error, no more molecules to remove");
    }
    else {
        for (let i = 0; i < num; i ++) {
            let idx = Math.floor(random(0,N));
            molecules.splice(idx,1);
            N--;
        }
        /*tempRatio = calculateTemperature() / curTemp;
        for (const b of molecules) {
            changeSpeedToMatchTemp(b,tempRatio);
        }*/
    }
}

function initialize() {
    for (let i = 0; i < STARTING_MOLECULES; i ++) {
        createMolecule();
    }

    update();
}

function update() {

    const temperature = curTemp;
    temperatureDisplay.textContent = 
        `Temperature: ${temperature.toFixed(1)} K`;

    const area = getArea();
    areaDisplay.textContent = 
        `Area: ${area.toPrecision(3)} m^2`;
    
    const pressure = getPressure();
    pressureDisplay.textContent =
        `Pressure: ${pressure.toPrecision(3)} Pa`;
    
    moleculeCountDisplay.textContent =
        `Molecule Count: ${N}`;

    collisionDisplay.textContent =
        `Number of collisions per second: ${numCollisions / SECONDS_PER_WINDOW}`;

    impulsePerCollisionDisplay.textContent =
        `Impulse per collision: ${totalImpulse / numCollisions}`;
    if (isPaused) {
        requestAnimationFrame(update);
        return;
    }

    curTime += getSimulationSpeed();

    //Remove collisions
    while (collisionTimes.length > collisionIndex && 
        collisionTimes[collisionIndex].curTime < curTime - SECONDS_PER_WINDOW) {
            totalImpulse -= collisionTimes[collisionIndex].impulse;
            collisionIndex ++;
            numCollisions --;
        }
    
    if (collisionIndex >= 1000) {
        collisionTimes.splice(0, collisionIndex);
        collisionIndex = 0;
    }

    ctx.clearRect(0,0,canvas.width, canvas.height);
    for (const b of molecules) {
        drawBall(b);
        updateBall(b);
    }
    
    drawContainer();

    for (let i = 0; i < molecules.length; i ++) {
        for (let j = i + 1; j < molecules.length; j ++) {
            updateBallBallCollision(molecules[i], molecules[j]);
        }
    }

    updateSpeedChart();

    requestAnimationFrame(update);
}

function getSpeed(ball) {
    return Math.sqrt(ball.vx**2 + ball.vy**2 + ball.vz**2);
}

function getArea() {
    return (canvas.width * METERS_PER_PIXEL) * (getHeight() * METERS_PER_PIXEL); 
}

function calculateTemperature() {
    let totalKE = 0;
    for (const ball of molecules) {
        totalKE += 1/2 * ball.mass * getSpeed(ball) ** 2;
    }

    return totalKE * 2 / (DEGREES_OF_FREEDOM * N * BOLTZMANN_CONSTANT);
}

function calculateRMSFromTemp() {
    return Math.sqrt(DEGREES_OF_FREEDOM * BOLTZMANN_CONSTANT * curTemp / NITROGEN_MASS);
}

function changeSpeedToMatchTemp(ball, tempRatio) {
    ball.vx *= Math.sqrt(tempRatio);
    ball.vy *= Math.sqrt(tempRatio);
    ball.vz *= Math.sqrt(tempRatio);
}

function drawBall(ball) {
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
    ctx.fillStyle = ball.fillColor;
    ctx.fill();
}

function distance(x1,y1,x2,y2) {
    return Math.sqrt((x1-x2)**2 + (y1-y2)**2);
}

function updateBall(ball) {
    ball.x += ball.vx * getSimulationSpeed() / METERS_PER_PIXEL;
    ball.y += ball.vy * getSimulationSpeed() / METERS_PER_PIXEL;
    updateWallCollision(ball);
}

function updateWallCollision(ball) {
    if (ball.x - ball.radius <= 0) {
        ball.x = ball.radius - (ball.x - ball.radius);
        ball.vx = - ball.vx;
        let impulse = 2 * ball.effMass * Math.abs(ball.vx);
        totalImpulse += impulse;
        numCollisions ++;
        collisionTimes.push({curTime, impulse});
    }
    if (ball.x + ball.radius >= canvas.width) {
        ball.x = ball.x - 2 * (ball.x + ball.radius - canvas.width);
        ball.vx = -ball.vx;
        let impulse = 2 * ball.effMass * Math.abs(ball.vx);
        totalImpulse += impulse;
        numCollisions ++;
        collisionTimes.push({curTime, impulse});
    }
    if (ball.y - ball.radius <= getTopWall()) {
        ball.y = ball.y - 2 * (ball.y - ball.radius - getTopWall());
        ball.vy = -ball.vy;
        let impulse = 2 * ball.effMass * Math.abs(ball.vy);
        totalImpulse += impulse;
        numCollisions ++;
        collisionTimes.push({curTime, impulse});
    }
    if (ball.y + ball.radius >= canvas.height) {
        ball.y = ball.y - 2 * (ball.y + ball.radius - canvas.height);
        ball.vy = - ball.vy;
        let impulse = 2 * ball.effMass * Math.abs(ball.vy);
        totalImpulse += impulse;
        numCollisions ++;
        collisionTimes.push({curTime, impulse});
    }
}

function updateBallBallCollision(ball1, ball2) {
    const dx = ball2.x - ball1.x;
    const dy = ball2.y - ball1.y;

    const distance = Math.sqrt(dx * dx + dy * dy);
    const minimumDistance = ball1.radius + ball2.radius;

    if (distance > minimumDistance || distance === 0) {
        return;
    }

    const nx = dx / distance;
    const ny = dy / distance;

    const overlap = minimumDistance - distance;
    const totalMass = ball1.mass + ball2.mass;

    const ball1Movement =
        overlap * (ball2.mass / totalMass);

    const ball2Movement =
        overlap * (ball1.mass / totalMass);

    ball1.x -= nx * ball1Movement;
    ball1.y -= ny * ball1Movement;

    ball2.x += nx * ball2Movement;
    ball2.y += ny * ball2Movement;

    const relativeVx = ball2.vx - ball1.vx;
    const relativeVy = ball2.vy - ball1.vy;

    const relativeNormalSpeed =
        relativeVx * nx + relativeVy * ny;

    if (relativeNormalSpeed >= 0) {
        return;
    }

    const impulse =
        -(2 * relativeNormalSpeed) /
        (1 / ball1.mass + 1 / ball2.mass);

    ball1.vx -= (impulse / ball1.mass) * nx;
    ball1.vy -= (impulse / ball1.mass) * ny;

    ball2.vx += (impulse / ball2.mass) * nx;
    ball2.vy += (impulse / ball2.mass) * ny;
}

function getPerimeter() {
    return 2 * (canvas.height * METERS_PER_PIXEL) + 
           2 * (canvas.width * METERS_PER_PIXEL);
}

function getPressure() {
    return totalImpulse / (SECONDS_PER_WINDOW * getPerimeter());
}

function getRMSSpeed(intervals,) {
    //return Math.sqrt(DEGREES_OF_FREEDOM * BOLTZMANN_CONSTANT * calculateTemperature() / molecule[0].mass);
    var sumSquares = 0;
    for (const ball of molecules) {
        sumSquares += getSpeed(ball) ** 2;
    }
    return Math.sqrt(sumSquares / N);
}

function getBin(val, intervalSize = 10, intervalCount = 100) {
    return Math.min(intervalCount, 
                    Math.floor(val / intervalSize));
}

const graphCanvas = document.getElementById("velocity-graph");

graphCanvas.width = graphCanvas.clientWidth;
graphCanvas.height = graphCanvas.clientHeight;

function getSpeedCountsAndLabels(intervalSize = 10, intervalCount = 100) {
    const bins = new Array(intervalCount+1).fill(0);
    const labels = new Array(intervalCount+1);

    for (let i = 0; i < intervalCount; i ++) {
        labels[i] = `[${intervalSize * i},${intervalSize * (i+1)}]`;
    }
    labels[intervalCount] = `>=${intervalSize * intervalCount}`;

    for (const ball of molecules) {
        let idx = Math.floor(getSpeed(ball) / intervalSize);
        idx = Math.min(idx, intervalCount);
        bins[idx] ++;
    }

    return {bins, labels};
}

function createSpeedGraph(intervalSize = 10, intervalCount = 100) {
    const {bins: speedCounts, labels: xAxisLabels} = getSpeedCountsAndLabels();
    return new Chart(graphCanvas, {
        type: "bar",
        data: {
            labels: xAxisLabels,
            datasets: [
                {
                    label: "Speed Intervals",
                    data: speedCounts,
                    borderWidth: 1,
                    borderColor: "turquoise"
                }
            ]
        },
        options: {
            responsive: true,
            plugins: {
                title: {
                    display: true,
                    text: "Speed Distribution"
                },

                legend: {
                    display: true
                },

                annotation: {
                    annotations: {
                        rmsLine: {
                            type: "line",
                            scaleID: "x",
                            value: 0,
                            borderWidth: 2,

                            label: {
                                display: true,
                                content: "RMS speed"
                            }
                        }
                    }
                }
            }, 
            scales: {
                x: {
                    title: {
                        display: true,
                        text: "Speed (m/s)"
                    }
                },
                y: {
                    beginAtZero: true,

                    title: {
                        display: true,
                        text: "Number of Molecules"
                    }
                }
            }
        }
    });
}

const speedChart = createSpeedGraph();

function updateSpeedChart() {
    const {bins: speedCounts, labels: xAxisLabels} = getSpeedCountsAndLabels();

    speedChart.data.datasets[0].data = speedCounts;
    speedChart.data.labels = xAxisLabels;
    speedChart.options.plugins.annotation.
               annotations.rmsLine.value = getBin(getRMSSpeed());
    speedChart.options.plugins.annotation.
               annotations.rmsLine.label.content = 
                    `RMS: ${getRMSSpeed().toFixed(1)} m/s`
    speedChart.update();
}

function getHeight() {
    return heightFactor * startingHeight;
}

function getTopWall() {
    return canvas.height - getHeight();
}

function drawContainer() {
    topWall = getTopWall();
    ctx.fillStyle = "white";
    ctx.fillRect(0,0,canvas.width, topWall);


    ctx.beginPath();
    ctx.moveTo(0, topWall);
    ctx.lineTo(canvas.width, topWall)
    ctx.lineWidth = 3;
    ctx.strokeStyle = "black";
    ctx.stroke();
}

heightSlider.addEventListener("input", function () {
    heightFactor = 2 ** Number(heightSlider.value);
    heightScaleDisplay.textContent = 
        `${heightFactor.toFixed(2)}x`;
    }
);

moleSlider.addEventListener("input", function () {
    newN = Number(moleSlider.value);
    if (newN > N) {
        addMolecule(newN-N);
    }
    else if (N > newN) {
        removeMolecule(N-newN);
    }
    N = newN;
    moleNumberInput.value = N;
});



moleNumberInput.addEventListener("change", function () {
    newN = Number(moleNumberInput.value);
    if (newN > N) {
        addMolecule(newN-N);
    }
    else if (N > newN) {
        removeMolecule(N-newN);
    }
    N = newN;
    moleSlider.value = N;
})

tempSlider.addEventListener("input", function () {
    newTemp = Number(tempSlider.value);
    for (const b of molecules) {
        changeSpeedToMatchTemp(b, newTemp / curTemp);
    }
    tempNumberInput.value = newTemp;
});

tempNumberInput.addEventListener("change", function () {
    newTemp = Number(tempNumberInput.value);
    for (const b of molecules) {
        changeSpeedToMatchTemp(b, newTemp / oldTemp);
    }
    tempSlider.value = newTemp;
})

pausePlayButton.addEventListener("click", function () {
    isPaused = !isPaused;
    if (isPaused) {
        pausePlayButton.textContent = "▶️";
    }
    else {
        pausePlayButton.textContent = "⏸️";
    }
});

function getSimulationSpeed() {
    return simSpeedFactor * SECONDS_PER_FRAME;
}

simSpeedButton.addEventListener("click", function () {
    simSpeedIndex = (simSpeedIndex + 1) % simSpeedFactors.length;
    simSpeedFactor = simSpeedFactors[simSpeedIndex];
    simSpeedButton.textContent = `${simSpeedFactor}x`;
    simSpeedDisplay.textContent = 
        `1 frame = ${getSimulationSpeed().toPrecision(1)} seconds`;
})

initialize();