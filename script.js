const canvas = document.getElementById("container");
const ctx = canvas.getContext("2d");
const collisionDisplay = document.getElementById("collisions");
const impulsePerCollisionDisplay = document.getElementById("impulse-per-collision");
const pressureEquationDisplay = document.getElementById("pressure-equation");

const pausePlayButton = document.getElementById("pause-play-button");
let isPaused = true;

const PVPausePlayButton = document.getElementById("PV-pause-play");
const PVClearButton = document.getElementById("PV-clear");
let PVPaused = true;
const showRMS = document.getElementById("show-rms");
const showMean = document.getElementById("show-mean");
const showMode = document.getElementById("show-mode");

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

let targetTemp = 300;
var heightFactor = 1;

const tempSlider = document.getElementById("temp-slider");
const tempNumberInput = document.getElementById("temp-number-input");
const moleSlider = document.getElementById("mole-slider");
const moleNumberInput = document.getElementById("mole-number-input");
const heightSlider = document.getElementById("height-slider");
const heightScaleDisplay = document.getElementById("height-scale");
const heightNumberInput = document.getElementById("height-number-input");

const BOLTZMANN_CONSTANT = 1.380649e-23;
const NITROGEN_MASS = 4.65e-26;
const AVAGADRO_NUMBER = 6.022e23;

const SECONDS_PER_FRAME = 1e-5;
const METERS_PER_PIXEL = 1e-3;
const SECONDS_PER_WINDOW = 0.001;
const SECONDS_PER_DISPLAY_WINDOW = 0.01;
const SECONDS_PER_PRESSURE_WINDOW = 5e-5;
const SECONDS_PER_PV_WINDOW = 0.005;
const NUM_REPRESENTING = AVAGADRO_NUMBER / 100;

const DEGREES_OF_FREEDOM = 2; //degrees of freedom

let numCollisions = 0;
let totalImpulse = 0;
const collisionTimes = [];
let collisionIndex = 0;

class Ball {
    constructor(x, y, radius = 10, fillColor = "black", vx = 1, vy = 1, vz = 1, mass = 1) {
        this.x = x;
        this.y = y;
        this.radius = radius;
        this.fillColor = fillColor;
        this.vx = vx;
        this.vy = vy;
        this.vz = vz;
        this.mass = mass;
        this.num = NUM_REPRESENTING;
        this.effMass = mass * NUM_REPRESENTING;
    }

    getSpeed() {
        return Math.sqrt(this.vx**2 + this.vy**2 + this.vz**2);
    }

    drawBall() {
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = this.fillColor;
        ctx.fill();
    }
    
    move() {
        this.x += this.vx * getSimulationSpeed() / METERS_PER_PIXEL;
        this.y += this.vy * getSimulationSpeed() / METERS_PER_PIXEL;
    }
}


function random(a, b) {
    return Math.random() * (b-a) + a;
}

const molecules = [];

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
                        ));
}

function addOrRemoveMolecules(newN) {
    const difference = newN - molecules.length;
    if (difference > 0) {
        for (let i = 0; i < difference; i ++) {
            addMolecule();
        }
    }
    else if (difference < 0) {
        for (let i = 0; i < -difference; i ++) {
            removeMolecule();
        } 
    }
}

function addMolecule() {
    createMolecule();
}

function removeMolecule() {
    if (molecules.length <= 1) {
        console.log("error, no more molecules to remove");
    }
    else {
        let idx = Math.floor(random(0,molecules.length));
        molecules.splice(idx,1);
    }
    tempRatio = targetTemp / calculateTemperature();
    for (const b of molecules) {
        changeSpeedToMatchTemp(b,tempRatio);
    }
}

function initialize() {
    for (let i = 0; i < STARTING_MOLECULES; i ++) {
        createMolecule();
    }
    updatePressureEquation();
    update();
}

function update() {
    collisionDisplay.textContent =
        `Number of collisions per second: ${(numCollisions / Math.min(curTime,SECONDS_PER_WINDOW)).toFixed(2)}`;

    impulsePerCollisionDisplay.textContent =
        `Impulse per collision: ${(totalImpulse / numCollisions).toFixed(2)}`;
    

    if (isPaused) {
        requestAnimationFrame(update);
        return;
    }
    const oldTime = curTime;
    curTime += getSimulationSpeed();
    if (Math.floor(oldTime / SECONDS_PER_PV_WINDOW) != Math.floor(curTime / SECONDS_PER_PV_WINDOW)) {
        updatePVDiagram();
    }
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
    for (const ball of molecules) {
        ball.move();
        updateWallCollision(ball);
        ball.drawBall();
    }
    
    drawContainer();

    for (let i = 0; i < molecules.length; i ++) {
        for (let j = i + 1; j < molecules.length; j ++) {
            updateBallBallCollision(molecules[i], molecules[j]);
        }
    }

    //Add and remove old pressure data
    if (curTime >= 10 * SECONDS_PER_PRESSURE_WINDOW && 
        Math.floor(curTime / SECONDS_PER_PRESSURE_WINDOW) != 
        Math.floor(oldTime / SECONDS_PER_PRESSURE_WINDOW)) {
            updatePressureChart();
        }

    updateSpeedChart();

    requestAnimationFrame(update);
}

function getArea() {
    return (canvas.width * METERS_PER_PIXEL) * (getHeight() * METERS_PER_PIXEL); 
}

function calculateTemperature() {
    let totalKE = 0;
    for (const ball of molecules) {
        totalKE += 1/2 * ball.mass * ball.getSpeed() ** 2;
    }

    return totalKE * 2 / (DEGREES_OF_FREEDOM * molecules.length * BOLTZMANN_CONSTANT);
}

function calculateRMSFromTemp() {
    return Math.sqrt(DEGREES_OF_FREEDOM * BOLTZMANN_CONSTANT * targetTemp / NITROGEN_MASS);
}

function changeSpeedToMatchTemp(ball, tempRatio) {
    ball.vx *= Math.sqrt(tempRatio);
    ball.vy *= Math.sqrt(tempRatio);
    ball.vz *= Math.sqrt(tempRatio);
}

function distance(x1,y1,x2,y2) {
    return Math.sqrt((x1-x2)**2 + (y1-y2)**2);
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

async function updatePressureEquation() {
    const T = calculateTemperature();
    const A = getArea();
    const R = BOLTZMANN_CONSTANT * AVAGADRO_NUMBER;
    const n = getMoles();
    const P = getTheoreticalPressure();
    MathJax.typesetClear([pressureEquationDisplay]);
    pressureEquationDisplay.textContent = String.raw`
    \(P = \frac{nRT}{A}
        = \frac{(${n.toFixed(2)}\ \mathrm{mol})(${R.toFixed(2)})(${T.toFixed(2)}\ \mathrm{K})}{${A.toFixed(2)}\ \mathrm{m^2}}
        = ${P.toPrecision(3)}\ \mathrm{Pa}\)`;
    await MathJax.typesetPromise([pressureEquationDisplay]);
}

function getPerimeter() {
    return 2 * (getHeight() * METERS_PER_PIXEL) + 
           2 * (canvas.width * METERS_PER_PIXEL);
}

function getPressure() {
    return totalImpulse / (Math.min(curTime, SECONDS_PER_WINDOW) * getPerimeter());
}

function getTheoreticalPressure() {
    return (molecules.length * NUM_REPRESENTING * BOLTZMANN_CONSTANT * targetTemp) / getArea();
}

function getMoles() {
    numMolecules = 0;
    for (const ball of molecules) {
        numMolecules += ball.num;
    }
    return numMolecules / AVAGADRO_NUMBER;
}

function getRMSSpeed() {
    //return Math.sqrt(DEGREES_OF_FREEDOM * BOLTZMANN_CONSTANT * calculateTemperature() / molecule[0].mass);
    var sumSquares = 0;
    for (const ball of molecules) {
        sumSquares += ball.getSpeed() ** 2;
    }
    return Math.sqrt(sumSquares / molecules.length);
}

function getMeanSpeed() {
    var sum = 0;
    for (const ball of molecules) {
        sum += ball.getSpeed();
    }
    return sum / molecules.length;
}

function getModeBin(intervalSize = 10, intervalCount = 100) {
    const {bins, labels} = getSpeedCountsAndLabels(intervalSize, intervalCount);
    let maxVal = 0;
    let maxBin = 0;
    for (let i = 0; i < bins.length; i ++) {
        if (bins[i] > maxVal) {
            maxBin = i;
            maxVal = bins[i];
        }
    }
    return maxBin;
}

function getBin(val, intervalSize = 10, intervalCount = 100) {
    return Math.min(intervalCount, 
                    Math.floor(val / intervalSize));
}

const speedGraphCanvas = document.getElementById("velocity-graph");

speedGraphCanvas.width = speedGraphCanvas.clientWidth;
speedGraphCanvas.height = speedGraphCanvas.clientHeight;


function getSpeedCountsAndLabels(intervalSize = 10, intervalCount = 100) {
    const bins = new Array(intervalCount+1).fill(0);
    const labels = new Array(intervalCount+1);

    for (let i = 0; i < intervalCount; i ++) {
        labels[i] = `[${intervalSize * i},${intervalSize * (i+1)}]`;
    }
    labels[intervalCount] = `>=${intervalSize * intervalCount}`;

    for (const ball of molecules) {
        //let idx = Math.floor(getSpeed(ball) / intervalSize);
        //idx = Math.min(idx, intervalCount);
        let idx = getBin(ball.getSpeed(), intervalSize, intervalCount);
        bins[idx] ++;
    }

    return {bins, labels};
}

function createSpeedGraph(intervalSize = 10, intervalCount = 100) {
    const {bins: speedCounts, labels: xAxisLabels} = getSpeedCountsAndLabels(intervalSize, intervalCount);
    return new Chart(speedGraphCanvas, {
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
                                content: "",
                                position: "center"
                            }
                        },

                        arithmeticMeanLine: {
                            type: "line",
                            scaleID: "x",
                            value: 0,
                            borderWidth: 2,

                            label: {
                                display: true,
                                content: "",
                                position: "start"
                            }
                        },

                        modeLine: {
                            type: "line",
                            scaleID: "x",
                            value: 0,
                            borderWidth:2,
                            label: {
                                display: true,
                                content: "Mode",
                                position: "end"
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
               annotations.rmsLine.value = getBin(calculateRMSFromTemp());
    speedChart.options.plugins.annotation.
               annotations.rmsLine.label.content = 
                    `RMS: ${getRMSSpeed().toFixed(1)} m/s`
    speedChart.options.plugins.annotation.
               annotations.arithmeticMeanLine.value = getBin(getMeanSpeed());
    speedChart.options.plugins.annotation.
               annotations.arithmeticMeanLine.label.content = 
                    `Mean: ${getMeanSpeed().toFixed(1)} m/s`
    speedChart.options.plugins.annotation.
            annotations.modeLine.value = getModeBin();
    speedChart.update();
}

const pressureChartCanvas = document.getElementById("pressure-chart");
pressureChartCanvas.height = pressureChartCanvas.clientHeight;
pressureChartCanvas.width = pressureChartCanvas.clientWidth;

pressureData = [];

function createPressureChart() {
    return chart = new Chart(pressureChartCanvas, {
        type: "scatter",
        data: {
            datasets: [
                {
                    label: "Measurements",
                    data: [],
                    showLine: true,
                    beginAtZero: true
                }
            ]
        },

        options: {
            scales: {
                x: {
                    beginAtZero: true,
                    max: SECONDS_PER_DISPLAY_WINDOW / SECONDS_PER_PRESSURE_WINDOW,
                    title: {
                        display: true,
                        text: "Pressure windows"
                    }
                },
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: "Pressure (Pa)"
                    }
                }
            },
            plugins: {
                annotation: {
                    annotations: {
                        theoreticalPressureLine: {
                            type: "line",
                            scaleID: "y",
                            value: 0,
                            borderWidth: 2
                        }
                    }
                }
            }
        }
    });
}

function updatePressureChart() {
    pressureData.push(getPressure());
    if (pressureData.length >= SECONDS_PER_DISPLAY_WINDOW / SECONDS_PER_PRESSURE_WINDOW) {
        pressureData.splice(0,1);
    }
    pressureChart.data.datasets[0].data = 
        pressureData.map((value, index) => ({
            x: index,
            y: value
        }));
    theoreticalPressure = getTheoreticalPressure();
    pressureChart.options.plugins.annotation.annotations.
                  theoreticalPressureLine.value = theoreticalPressure;
    pressureChart.update("none");
}

pressureChart = createPressureChart();

const PVDiagramCanvas = document.getElementById("PV-diagram");
PVDiagramCanvas.height = PVDiagramCanvas.clientHeight;
PVDiagramCanvas.width = PVDiagramCanvas.clientWidth;
const PVData = [];

function createPVDiagram() {
    return chart = new Chart(PVDiagramCanvas, {
        type: "scatter",

        data: {
            datasets: [
                {
                    label: "Measurements",
                    data: PVData,
                    showLine: true,
                    borderColor: "red",
                    borderWidth: 2,
                    pointRadius: 1,
                    tension: 0
                },
                {
                    label: "Current",
                    pointbackgroundcolor: "dark blue",
                    data: [],
                    showLine: false,
                    pointRadius: 4
                }
            ]
        },
        options: {
            scales: {
                x: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: "Area (m²)"
                    }
                },
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: "Pressure (Pa)"
                    }
                }
            }
        }
    })
}

function updatePVDiagram() {
    if (!PVPaused) {
        PVData.push(
        {
            x: getArea(),
            y: getTheoreticalPressure()
        });
        PVDiagram.data.datasets[1].data = [
            PVData[PVData.length-1]
        ];
        PVDiagram.update();
    }
}

PVPausePlayButton.addEventListener("click", function () {
    PVPaused = !PVPaused;
    if (PVPaused) {
        PVPausePlayButton.textContent = "▶️";
    }
    else {
        PVPausePlayButton.textContent = "⏸️";
    }
});

PVClearButton.addEventListener("click", function () {
    PVData.length = 0;
    PVDiagram.update();
    PVPaused = true;
    PVPausePlayButton.textContent = "▶️";
})

PVDiagram = createPVDiagram();

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
    heightNumberInput.value = heightFactor.toFixed(2);
    updatePVDiagram();
    updatePressureEquation();
});

heightNumberInput.addEventListener("change", function () {
    heightFactor = Number(heightNumberInput.value);
    heightSlider.value = Math.log2(heightFactor);
    updatePVDiagram();
    updatePressureEquation();
})

moleSlider.addEventListener("input", function () {
    newN = 100 * Number(moleSlider.value);
    addOrRemoveMolecules(newN);
    moleNumberInput.value = newN / 100;
    updatePVDiagram();
    updatePressureEquation();
});

moleNumberInput.addEventListener("change", function () {
    newN = 100 * Number(moleNumberInput.value);
    addOrRemoveMolecules(newN);
    moleSlider.value = newN / 100;
    updatePVDiagram();
    updatePressureEquation();
})

tempSlider.addEventListener("input", function () {
    const oldTemp = targetTemp;
    targetTemp = Number(tempSlider.value);
    for (const b of molecules) {
        changeSpeedToMatchTemp(b, targetTemp / oldTemp);
    }
    tempNumberInput.value = targetTemp;
    updatePVDiagram();
    updatePressureEquation();
});

tempNumberInput.addEventListener("change", function () {
    const oldTemp = targetTemp;
    targetTemp = Number(tempNumberInput.value);
    for (const b of molecules) {
        changeSpeedToMatchTemp(b, targetTemp / oldTemp);
    }
    tempSlider.value = targetTemp;
    updatePVDiagram();
    updatePressureEquation();
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
});

initialize();