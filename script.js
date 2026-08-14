const canvas = document.getElementById("container");
const ctx = canvas.getContext("2d");
const collisionDisplay = document.getElementById("collisions");
const impulsePerCollisionDisplay = document.getElementById("impulse-per-collision");
const pressureEquationDisplay = document.getElementById("pressure-equation");
const energyEquationDisplay = document.getElementById("energy-equation");
const entropyEquationDisplay = document.getElementById("entropy-equation");

Chart.register(ChartDataLabels);
Chart.defaults.plugins.datalabels.display = false;

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

const MAX_WIDTH_FACTOR = 2.0;
canvas.width = canvas.clientWidth;
canvas.height = canvas.clientHeight;
const MAX_WIDTH = canvas.width;
const startingWidth = canvas.width / MAX_WIDTH_FACTOR;
let rightWall = canvas.width / MAX_WIDTH_FACTOR;
let rightWallVelo = 0;
const RIGHT_WALL_MASS = 1;

const STARTING_TEMP = 300;

const tempSlider = document.getElementById("temp-slider");
const tempNumberInput = document.getElementById("temp-number-input");
const moleSlider = document.getElementById("mole-slider");
const moleNumberInput = document.getElementById("mole-number-input");
const widthSlider = document.getElementById("width-slider");
const widthScaleDisplay = document.getElementById("width-scale");
const widthNumberInput = document.getElementById("width-number-input");
const outsidePressureSlider = document.getElementById("outside-pressure-slider");
const outsidePressureInput = document.getElementById("outside-pressure-input");

const fireButton = document.getElementById("fire-button");
const iceButton = document.getElementById("ice-button");
const heaterButton = document.getElementById("heater-button");
const fridgeButton = document.getElementById("fridge-button");
const fireImage = document.getElementById("fire");
const iceImage = document.getElementById("ice");
const heaterImage = document.getElementById("heater");
const fridgeImage = document.getElementById("fridge");
let NEWTON_HEATING_CONSTANT = 1000;
let iceActive = false;
let fireActive = false;
let heaterActive = false;
let fridgeActive = false;
let iceTemp = 100;
let fireTemp = 500;
let heaterPower = 1e6;
let fridgePower = -1e6;

const fireValueDisplay = document.getElementById("fire-value");
const heaterValueDisplay = document.getElementById("heater-value");
const fridgeValueDisplay = document.getElementById("fridge-value");
const iceValueDisplay = document.getElementById("ice-value");

let totalHeat = 0;
let entropy = 0;
let initialInternalEnergy = 0;

const lockWallButton = document.getElementById("lock-wall-button");
let isLocked = true;
let outsidePressure;
const WALL_MOBILITY = 100;
let workByGas = 0;
let workOnGas = 0;

const BOLTZMANN_CONSTANT = 1.380649e-23;
const NITROGEN_MASS = 4.65e-26;
const AVAGADRO_NUMBER = 6.022e23;
const IDEAL_GAS_CONSTANT = BOLTZMANN_CONSTANT * AVAGADRO_NUMBER;
const PASCALS_PER_ATM = 101325;

const SECONDS_PER_FRAME = 1e-6;
const METERS_PER_PIXEL = 2.03e-4;
const SECONDS_PER_WINDOW = 100 * SECONDS_PER_FRAME;
const SECONDS_PER_DISPLAY_WINDOW = 1000 * SECONDS_PER_FRAME;
const SECONDS_PER_PRESSURE_WINDOW = 5 * SECONDS_PER_FRAME;
const SECONDS_PER_PV_WINDOW = 100 * SECONDS_PER_FRAME;
const NUM_REPRESENTING = AVAGADRO_NUMBER / 100;

const DEGREES_OF_FREEDOM = 2; //degrees of freedom

let numCollisions = 0;
let totalImpulse = 0;
const collisionTimes = [];
let collisionIndex = 0;

let isochoricTarget = null;
let isobaricTarget = null;


let isothermalTarget = null;

const ADIABATIC_PRESSURE_CHANGE = 2e8;
let adiabaticTarget = null;


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

    changeSpeedToMatchTemp(oldTemp, newTemp) {
        let tempRatio = newTemp / oldTemp;
        let speedRatio = Math.sqrt(tempRatio)
        this.vx *= speedRatio;
        this.vy *= speedRatio;
        this.vz *= speedRatio;
    }
}


function random(a, b) {
    return Math.random() * (b-a) + a;
}

const molecules = [];

function createMolecule() {
    let speed = getRMSSpeed();
    let angle = Math.random() * 2 * Math.PI;
    molecules.push(new Ball(Math.random() * rightWall,
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
    let prevTemp = getTemperature();
    if (molecules.length <= 1) {
        console.log("error, no more molecules to remove");
    }
    else {
        let idx = Math.floor(random(0,molecules.length));
        molecules.splice(idx,1);
    }
    let curTemp = getTemperature();
    for (const b of molecules) {
        b.changeSpeedToMatchTemp(curTemp, prevTemp);
    }
}

function initialize() {
    for (let i = 0; i < STARTING_MOLECULES; i ++) {
        createMolecule();
    }
    initialInternalEnergy = getKineticEnergy();
    updatePressureEquation();
    updateEnergyEquation();
    updateEntropyEquation();
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

    //console.log(iceActive, fireActive);
    if (iceActive) {
        updateTempFromReservoir(iceTemp);
    }
    if (fireActive) {
        updateTempFromReservoir(fireTemp);
    }
    if (heaterActive) {
        updateTempFromPower(heaterPower);
    }
    if (fridgeActive) {
        updateTempFromPower(fridgePower);
    }
    
    updateIsochoricProcess();
    updateIsobaricProcess();
    updateAdiabaticProcess();

    if (!isLocked) {
        updateRightWall();
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
    return (rightWall * METERS_PER_PIXEL) * (canvas.height * METERS_PER_PIXEL);
}

function getKineticEnergy() {
    let totalKE = 0;
    for (const ball of molecules) {
        totalKE += 1/2 * ball.effMass * ball.getSpeed() ** 2;
    }
    return totalKE;
}

function getTemperature() {
    if (molecules.length == 0) return STARTING_TEMP;
    let totalKE = getKineticEnergy();
    return totalKE * 2 / (DEGREES_OF_FREEDOM * getMoles() * IDEAL_GAS_CONSTANT);
}

function calculateRMSFromTemp() {
    let temp = molecules.length == 0 ? STARTING_TEMP : getTemperature();
    return Math.sqrt(DEGREES_OF_FREEDOM * BOLTZMANN_CONSTANT * temp / NITROGEN_MASS);
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
    if (ball.x + ball.radius >= rightWall) {
        ball.x = ball.x - 2 * (ball.x + ball.radius - rightWall);
        ball.vx = -ball.vx;
        let impulse = 2 * ball.effMass * Math.abs(ball.vx);
        totalImpulse += impulse;
        numCollisions ++;
        collisionTimes.push({curTime, impulse});
    }
    if (ball.y - ball.radius <= 0) {
        ball.y = ball.radius - (ball.y - ball.radius);
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
    const T = getTemperature();
    const A = getArea();
    const n = getMoles();
    const P = getTheoreticalPressure();
    MathJax.typesetClear([pressureEquationDisplay]);
    pressureEquationDisplay.textContent = String.raw`
    \(P = \frac{nRT}{A}
        = \frac{(${n.toFixed(2)}\ \mathrm{mol})(${IDEAL_GAS_CONSTANT.toFixed(2)})(${T.toFixed(2)}\ \mathrm{K})}{${A.toPrecision(2)}\ \mathrm{m^2}}
        = ${P.toPrecision(3)}\ \mathrm{Pa}\)`;
    await MathJax.typesetPromise([pressureEquationDisplay]);
}

async function updateEntropyEquation() {
    MathJax.typesetClear([entropyEquationDisplay]);
    entropyEquationDisplay.textContent = String.raw`
    \(\Delta S = \int \frac{\mathrm dQ}{T} = ${entropy}\)`;
    await MathJax.typesetPromise([entropyEquationDisplay]);
}

async function updateEnergyEquation() {
    const netWorkByGas = workByGas - workOnGas;
    const predictedInternalEnergyChange = totalHeat - netWorkByGas;
    const measuredInternalEnergyChange =
        getKineticEnergy() - initialInternalEnergy;
    const energyResidual =
        measuredInternalEnergyChange - predictedInternalEnergyChange;

    MathJax.typesetClear([energyEquationDisplay]);
    energyEquationDisplay.textContent = String.raw`
    \(\text{First law:}\quad
      \Delta U = Q - W_{\mathrm{by\ gas}}
      = (${totalHeat.toFixed(3)}\ \mathrm{J})
      - (${netWorkByGas.toFixed(3)}\ \mathrm{J})
      = ${predictedInternalEnergyChange.toFixed(3)}\ \mathrm{J}\)
      <br>
      \(\Delta U_{\mathrm{measured}} = U-U_0
      = ${measuredInternalEnergyChange.toFixed(3)}\ \mathrm{J},\quad
      \text{difference} = ${energyResidual.toExponential(3)}\ \mathrm{J}\)`;
    await MathJax.typesetPromise([energyEquationDisplay]);
}

function getHeight() {
    return canvas.height * METERS_PER_PIXEL;
}

function getPerimeter() {
    return 2 * (canvas.height * METERS_PER_PIXEL) +
           2 * (rightWall * METERS_PER_PIXEL);
}

function getPressure() {
    return totalImpulse / (Math.min(curTime, SECONDS_PER_WINDOW) * getPerimeter());
}

function getTheoreticalPressureAtm() {
    return pascalToAtm(getTheoreticalPressure());
}

function atmToPascal(atm) {
    return atm * PASCALS_PER_ATM;
}

function pascalToAtm(pascals) {
    return pascals / PASCALS_PER_ATM;
}

function getTheoreticalPressure() {
    return (molecules.length * NUM_REPRESENTING * BOLTZMANN_CONSTANT * getTemperature()) / getArea();
}

function getMoles() {
    numMolecules = 0;
    for (const ball of molecules) {
        numMolecules += ball.num;
    }
    return numMolecules / AVAGADRO_NUMBER;
}

function getRMSSpeed() {
    //return Math.sqrt(DEGREES_OF_FREEDOM * BOLTZMANN_CONSTANT * getTemperature() / molecule[0].mass);
    if (molecules.length == 0) return calculateRMSFromTemp();
    let sumSquares = 0;
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
                            borderColor: "#2563eb",

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
                            borderColor: "#16a34a",

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
                            borderColor: "#9333ea",
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

function updateSpeedAnnotationVisibility() {
    const annotations =
        speedChart.options.plugins.annotation.annotations;

    annotations.rmsLine.display = showRMS.checked;
    annotations.arithmeticMeanLine.display = showMean.checked;
    annotations.modeLine.display = showMode.checked;
    speedChart.update("none");
}

[showRMS, showMean, showMode].forEach(option => {
    option.addEventListener("change", updateSpeedAnnotationVisibility);
});

updateSpeedAnnotationVisibility();

function updateSpeedChart() {
    const {bins: speedCounts, labels: xAxisLabels} = getSpeedCountsAndLabels();

    speedChart.data.datasets[0].data = speedCounts;
    speedChart.data.labels = xAxisLabels;
    speedChart.options.plugins.annotation.
               annotations.rmsLine.value = getBin(getRMSSpeed());
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
                    tension: 0,
                    datalabels: {
                        display: false
                    }
                },
                {
                    label: "Current",
                    data: [],
                    showLine: false,
                    pointRadius: 8,
                    pointHoverRadius: 10,
                    pointBackgroundColor: "darkblue",
                    pointBorderColor: "white",
                    pointBorderWidth: 3,
                    datalabels: {
                        display: true,
                        align: "top",
                        anchor: "end",
                        offset: 6,
                        color: "darkblue",
                        backgroundColor: "white",
                        borderColor: "darkblue",
                        borderWidth: 1,
                        borderRadius: 4,
                        padding: 4,
                        font: {
                            weight: "bold",
                            size: 12
                        },
                        formatter: point =>
                            `${point.temperature.toFixed(1)} K`
                    }
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
    const currentState = {
        x: getArea(),
        y: getTheoreticalPressure(),
        temperature: getTemperature()
    };

    PVDiagram.data.datasets[1].data = [currentState];

    if (!PVPaused) {
        PVData.push(currentState);
    }

    PVDiagram.update("none");
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

/*function getWidth() {
    return widthFactor * startingWidth;
}*/

function drawContainer() {
    /*ctx.fillStyle = "white";
    ctx.fillRect(rightWall,0,canvas.width-rightWall,canvas.height);*/
    ctx.beginPath();
    ctx.moveTo(rightWall, 0);
    ctx.lineTo(rightWall, canvas.height)
    ctx.lineWidth = 3;
    ctx.strokeStyle = "black";
    ctx.stroke();
}

document.querySelectorAll(".graph-toggle").forEach(button => {
    button.addEventListener("click", () => {
        const graphContent = document.getElementById(
            button.dataset.controls);
        graphContent.hidden = !graphContent.hidden;
        const msg = button.querySelector(".toggle-icon");
        msg.textContent = graphContent.hidden ? "+" : "-";
    })
})

widthSlider.addEventListener("input", function () {
    setWidth(2 ** Number(widthSlider.value) * startingWidth);
});

widthNumberInput.addEventListener("change", function () {
    setWidth(Number(widthNumberInput.value) * startingWidth);
});

function setWidth(newWidth) {
    if (!Number.isFinite(newWidth) || newWidth <= 0) return;

    const widthFactor = newWidth / startingWidth;
    rightWall = newWidth;
    widthSlider.value = Math.log2(widthFactor);
    widthNumberInput.value = widthFactor.toFixed(2);
    updatePVDiagram();
    updatePressureEquation();
    updateEnergyEquation();
    updateEntropyEquation();
}

moleSlider.addEventListener("input", function () {
    setMoles(Number(moleSlider.value));
});

moleNumberInput.addEventListener("change", function () {
    setMoles(Number(moleNumberInput.value));
});

function setMoles(newMoles) {
    newBallCount = newMoles * AVAGADRO_NUMBER / NUM_REPRESENTING;
    addOrRemoveMolecules(newBallCount);
    moleSlider.value = newMoles;
    moleNumberInput.value = newMoles.toFixed(2);
    updatePVDiagram();
    updatePressureEquation();
    updateEnergyEquation();
    updateEntropyEquation();
}

tempSlider.addEventListener("input", function () {
    const oldTemp = getTemperature();
    let newTemp = Number(tempSlider.value);
    setTemperature(oldTemp, newTemp);
});

tempNumberInput.addEventListener("change", function () {
    const oldTemp = getTemperature();
    newTemp = Number(tempNumberInput.value);
    setTemperature(oldTemp, newTemp);
})

function setTemperature(oldTemp, newTemp) {
    if (!Number.isFinite(oldTemp) || !Number.isFinite(newTemp) ||
        oldTemp <= 0 || newTemp <= 0) {
        console.error("Invalid temperature update", {
            oldTemp,
            newTemp,
            kineticEnergy: getKineticEnergy(),
            moles: getMoles()
        });
        return;
    }

    tempSlider.value = newTemp;
    tempNumberInput.value = newTemp;
    for (const b of molecules) {
        b.changeSpeedToMatchTemp(oldTemp, newTemp);
    }
    updatePVDiagram();
    updatePressureEquation();
    updateEnergyEquation();
    updateEntropyEquation();
}

outsidePressureSlider.addEventListener("input", function () {
    setOutsidePressure(Number(outsidePressureSlider.value));
});

outsidePressureInput.addEventListener("change", function () {
    setOutsidePressure(Number(outsidePressureInput.value));
});

function setOutsidePressure(atm) {
    outsidePressureSlider.value = atm;
    outsidePressureInput.value = atm;
    outsidePressure = atmToPascal(atm);
}

function togglePause() {
    isPaused = !isPaused;
    if (isPaused) {
        pausePlayButton.textContent = "▶️";
    }
    else {
        pausePlayButton.textContent = "⏸️";
    }
}
pausePlayButton.addEventListener("click", togglePause);

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

const heatControlImages = [
    fireImage,
    heaterImage,
    fridgeImage,
    iceImage
];

function deactivateHeatControls() {
    fireActive = false;
    iceActive = false;
    heaterActive = false;
    fridgeActive = false;
    heatControlImages.forEach(image => image.classList.remove("active"));
}

function toggleHeatControl(image, mode) {
    const wasActive = image.classList.contains("active");
    deactivateHeatControls();

    if (wasActive) return;

    image.classList.add("active");
    fireActive = mode === "fire";
    heaterActive = mode === "heater";
    fridgeActive = mode === "fridge";
    iceActive = mode === "ice";
}

fireButton.addEventListener("click", function () {
    toggleHeatControl(fireImage, "fire");
});

heaterButton.addEventListener("click", function () {
    toggleHeatControl(heaterImage, "heater");
});

fridgeButton.addEventListener("click", function () {
    toggleHeatControl(fridgeImage, "fridge");
});

iceButton.addEventListener("click", function () {
    toggleHeatControl(iceImage, "ice");
});


function updateTempFromReservoir(reservoirTemp) {
    let dt = getSimulationSpeed();
    let T = getTemperature();
    let n = getMoles();
    let dT = NEWTON_HEATING_CONSTANT * (reservoirTemp - T) * dt;
    let newTemp = Math.max(1, Math.min(T+dT, 1000));
    dT = newTemp - T;
    let dQ = DEGREES_OF_FREEDOM / 2 * n * IDEAL_GAS_CONSTANT * dT;
    totalHeat += dQ;
    //console.log(totalHeat, dT, dQ);
    setTemperature(T, newTemp);
    entropy += dQ * (1/T + 1/newTemp) / 2;
}

function updateTempFromPower(power) {
    const dt = getSimulationSpeed();
    const oldTemp = getTemperature();
    const heatCapacity =
        DEGREES_OF_FREEDOM / 2 * getMoles() * IDEAL_GAS_CONSTANT;
    const requestedHeat = power * dt;
    const unclampedTemp = oldTemp + requestedHeat / heatCapacity;
    const newTemp = Math.max(1, Math.min(unclampedTemp, 1000));
    const actualHeat = heatCapacity * (newTemp - oldTemp);

    totalHeat += actualHeat;
    entropy += actualHeat * (1 / oldTemp + 1 / newTemp) / 2;
    setTemperature(oldTemp, newTemp);
}

lockWallButton.addEventListener("click", toggleLockWall);

function toggleLockWall() {
    isLocked = !isLocked;
    lockWallButton.textContent = isLocked ? "🔓" : "🔒";
    const outsidePressureControls = document.getElementById(
        lockWallButton.dataset.controls);
    if (!isLocked) {
        setOutsidePressure(pascalToAtm(getTheoreticalPressure()));
    }
    outsidePressureControls.hidden = !outsidePressureControls.hidden;
}

function updateRightWall() {
    const oldPos = rightWall;
    const oldTemp = getTemperature();
    const dt = getSimulationSpeed();
    const insidePressure = getTheoreticalPressure();
    const pressureDifference = insidePressure - outsidePressure;
    //let acc = force / RIGHT_WALL_MASS; Actual physical 
    rightWallVelo = WALL_MOBILITY * pressureDifference;
    if (pressureDifference > 0) {
        rightWallVelo = Math.max(rightWallVelo, 10000);
    }
    else {
        rightWallVelo = Math.min(rightWallVelo, -10000);
    }
    if (rightWall <= startingWidth / 2) {
        rightWallVelo = Math.max(rightWallVelo, 0);
    }
    if (rightWall >= startingWidth * 2) {
        rightWallVelo = Math.min(rightWallVelo, 0);
    }
    rightWall = Math.min(startingWidth * 2, 
                Math.max(rightWall + rightWallVelo * dt, startingWidth / 2));
    const displacement = (rightWall - oldPos) * METERS_PER_PIXEL;
    const volumeChange = getHeight() * displacement;
    const workDoneByGas = insidePressure * volumeChange;
    const newInternalEnergy = getKineticEnergy() - workDoneByGas;

    if (workDoneByGas >= 0) {
        workByGas += workDoneByGas;
    }
    else {
        workOnGas += -workDoneByGas;
    }

    const newTemp = Math.max(
        1,
        newInternalEnergy * 2 /
            (DEGREES_OF_FREEDOM * getMoles() * IDEAL_GAS_CONSTANT)
    );
    setWidth(rightWall);
    setTemperature(oldTemp, newTemp);
}

const processButtons = document.querySelectorAll(".process-button");
const endProcessButton = document.getElementById("end-process-button");
const processStatus = document.getElementById("process-status");
let activeProcess = null;
let previousDisabledStates = new Map();

const processNames = {
    isochoric: "Constant Volume",
    isobaric: "Constant Pressure",
    isothermal: "Constant Temperature",
    adiabatic: "Adiabatic"
};

function startProcess(processName, selectedButton) {
    if (activeProcess !== null) return;

    activeProcess = processName;
    const adjustableControls = document.querySelectorAll("button, input");
    previousDisabledStates = new Map();

    adjustableControls.forEach(control => {
        previousDisabledStates.set(control, control.disabled);
        control.disabled = true;
    });

    selectedButton.classList.add("active");
    selectedButton.setAttribute("aria-pressed", "true");
    endProcessButton.disabled = false;
    processStatus.textContent = `${processNames[processName]} process running`;

    if (processName === "isochoric") {
        deactivateHeatControls();
        if (!isLocked) {
            toggleLockWall();
        }
        toggleHeatControl(fireImage, "fire");
        isochoricTarget = Math.min(1000, 1.5 * getTemperature());
    }

    if (processName === "isobaric") {
        deactivateHeatControls();
        if (isLocked) {
            toggleLockWall();
        }
        toggleHeatControl(fireImage, "fire");
        rightWallVelo = 0;
        isobaricTarget = Math.min(startingWidth * 2, 1.5 * rightWall);
    }

    if (processName === "adiabatic") {
        deactivateHeatControls();
        if (isLocked) {
            toggleLockWall();
        }
        rightWallVelo = 0;
        setOutsidePressure(getTheoreticalPressureAtm());
        adiabaticTarget = Math.min(
            startingWidth * 2,
            rightWall * 1.5
        );
    }

    if (isPaused) {
        togglePause();
    }
}

function endProcess() {
    if (activeProcess === "adiabatic") {
        rightWallVelo = 0;
        isLocked = true;
        lockWallButton.textContent = "🔒";
    }
    if (activeProcess === null) return;

    previousDisabledStates.forEach((wasDisabled, control) => {
        control.disabled = wasDisabled;
    });

    processButtons.forEach(button => {
        button.classList.remove("active");
        button.setAttribute("aria-pressed", "false");
    });

    activeProcess = null;
    previousDisabledStates.clear();
    endProcessButton.disabled = true;
    processStatus.textContent = "No process running";
    deactivateHeatControls();
}

processButtons.forEach(button => {
    button.setAttribute("aria-pressed", "false");
    button.addEventListener("click", function () {
        startProcess(button.dataset.process, button);
    });
});

endProcessButton.addEventListener("click", endProcess);

function updateIsochoricProcess() {
    if (activeProcess !== "isochoric") return;
    let T = getTemperature();
    console.log(isochoricTarget);
    if (T >= isochoricTarget) {
        setTemperature(T, isochoricTarget);
        endProcess();
    }
}

function updateIsobaricProcess() {
    if (activeProcess !== "isobaric") return;
    if (rightWall >= isobaricTarget) {
        rightWall = isobaricTarget;
        rightWallVelo = 0;
        endProcess();
    }
}

function updateAdiabaticProcess() {
    if (activeProcess !== "adiabatic") return;

    const dt = getSimulationSpeed();
    outsidePressure = Math.max(
        1,
        outsidePressure - ADIABATIC_PRESSURE_CHANGE * dt
    );
    //console.log(outsidePressure);
    
    const outsidePressureAtm = pascalToAtm(outsidePressure);
    outsidePressureSlider.value = outsidePressureAtm;
    outsidePressureInput.value = outsidePressureAtm;

    if (rightWall >= adiabaticTarget) {
        rightWall = adiabaticTarget;
        rightWallVelo = 0;
        endProcess();
    }
}
fireValueDisplay.textContent =
    `${fireTemp} K`;
heaterValueDisplay.textContent =
    `+${heaterPower.toLocaleString()} W`;
fridgeValueDisplay.textContent =
    `${fridgePower.toLocaleString()} W`;
iceValueDisplay.textContent =
    `${iceTemp} K`;

function setIceTemperature(newTemp) {
    iceTemp = newTemp;
    iceValueDisplay.textContent = `${iceTemp} K`;
}

function setFireTemperature(newTemp) {
    fireTemp = newTemp;
    fireValueDisplay.textContent = `${fireTemp} K`;
}

function setHeaterPower(newPower) {
    heaterPower = newPower;
    heaterValueDisplay.textContent =
        `+${heaterPower.toLocaleString()} W`;
}

function setFridgePower(newPower) {
    fridgePower = newPower;
    fridgeValueDisplay.textContent =
        `${fridgePower.toLocaleString()} W`;
}

function promptForNumber(message, curVal, minVal, maxVal) {
    const response = prompt(message, curVal);

    if (response === null) {
        return null;
    }

    const value = Number(response);
    if (!Number.isFinite(value) || value < minVal || value > maxVal) {
        alert("Please enter a valid number.");
        return null;
    }

    return value;
}

fireValueDisplay.addEventListener("click", function (event) {
    event.stopPropagation();
    const newTemp = promptForNumber(
        "New hot reservoir temperature in K:",
        fireTemp,
        iceTemp,
        1000
    );

    if (newTemp === null) return;
    setFireTemperature(newTemp);
});

heaterValueDisplay.addEventListener("click", function (event) {
    event.stopPropagation();
    const newPower = promptForNumber(
        "New heater power in watts:",
        heaterPower,
        0,
        1e9
    );

    if (newPower === null) return;
    setHeaterPower(newPower);
});

fridgeValueDisplay.addEventListener("click", function (event) {
    event.stopPropagation();
    const coolingPower = promptForNumber(
        "New refrigerator cooling power in watts:",
        Math.abs(fridgePower),
        0,
        1e9
    );

    if (coolingPower === null) return;
    setFridgePower(-coolingPower);
});

iceValueDisplay.addEventListener("click", function (event) {
    event.stopPropagation();
    const newTemp = promptForNumber(
        "New cold reservoir temperature in K:",
        iceTemp,
        1,
        fireTemp
    );

    if (newTemp === null) return;
    setIceTemperature(newTemp);
});

initialize();
