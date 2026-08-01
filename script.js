const canvas = document.getElementById("container");
const ctx = canvas.getContext("2d");
const temperatureDisplay = document.getElementById("temperature");
const areaDisplay = document.getElementById("area");
const pressureDisplay = document.getElementById("pressure");
const moleculeCountDisplay = document.getElementById("molecule-count");

canvas.width = canvas.clientWidth;
canvas.height = canvas.clientHeight;

const BOLTZMANN_CONSTANT = 1.380649e-23;
const NITROGEN_MASS = 4.65e-26;

const SECONDS_PER_FRAME = 1e-7;
const METERS_PER_PIXEL = 1e-5;
const SECONDS_PER_WINDOW = 1e-4;

const DEGREES_OF_FREEDOM = 2; //degrees of freedom

let curSeconds = 0;
let totalImpulse = 0;

class Ball {
    constructor(x, y, radius = 10, fillColor = "black", vx = 1, vy = 1, mass = 1) {
        this.x = x;
        this.y = y;
        this.radius = radius;
        this.fillColor = fillColor;
        this.vx = vx;
        this.vy = vy;
        this.mass = mass;
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

for (let i = 0; i < 200; i ++) {
    createMolecule();
}

function createMolecule() {
    molecules.push(new Ball(Math.random() * canvas.width,
                            Math.random() * canvas.height,
                            2,
                            "blue",
                            random(-100,100),//random(-500),
                            random(-100,100),//random(-500,500),
                            NITROGEN_MASS));
    N ++;
}

function addMolecule() {
    createMolecule();
}

function removeMolecule() {
    if (molecules.length == 0) {
        console.log("error, no more molecules to remove");
    }
    else {
        let idx = Math.floor(random(0,N));
        molecules.splice(idx,1);
        N--;
    }
}

function update() {
    curSeconds += SECONDS_PER_FRAME;
    if (curSeconds > SECONDS_PER_WINDOW) {
        curSeconds -= SECONDS_PER_WINDOW;
        totalImpulse = 0;
    }
    ctx.clearRect(0,0,canvas.width, canvas.height);
    for (const b of molecules) {
        drawBall(b);
        updateBall(b);
    }
    for (let i = 0; i < molecules.length; i ++) {
        for (let j = i + 1; j < molecules.length; j ++) {
            updateBallBallCollision(molecules[i], molecules[j]);
        }
    }

    const temperature = calculateTemperature();
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

    const {bins: speedCounts, labels: xAxisLabels} = getSpeedCountsAndLabels();
    speedChart.data.datasets[0].data = speedCounts;
    speedChart.data.labels = xAxisLabels;
    speedChart.options.plugins.annotation.
               annotations.rmsLine.value = getRMSSpeed();
    speedChart.options.plugins.annotation.
               annotations.rmsLine.label.content = 
                    `RMS: ${getRMSSpeed().toFixed(1)} m/s`
    speedChart.update();

    requestAnimationFrame(update);
}

function getSpeed(ball) {
    return Math.sqrt(ball.vx**2 + ball.vy**2);
}

function getArea() {
    return (canvas.width * METERS_PER_PIXEL) * (canvas.height * METERS_PER_PIXEL); 
}

function calculateTemperature() {
    let totalKE = 0;
    for (const ball of molecules) {
        totalKE += 1/2 * ball.mass * getSpeed(ball) ** 2;
    }

    return totalKE * 2 / (DEGREES_OF_FREEDOM * N * BOLTZMANN_CONSTANT);
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
    ball.x += ball.vx * SECONDS_PER_FRAME / METERS_PER_PIXEL;
    ball.y += ball.vy * SECONDS_PER_FRAME / METERS_PER_PIXEL;
    updateWallCollision(ball);
}

function updateWallCollision(ball) {
    if (ball.x - ball.radius <= 0) {
        ball.x = ball.radius - (ball.x - ball.radius);
        ball.vx = - ball.vx;
        totalImpulse += 2 * ball.mass * Math.abs(ball.vx);
    }
    if (ball.x + ball.radius >= canvas.width) {
        ball.x = ball.x - (ball.x + ball.radius - canvas.width);
        ball.vx = -ball.vx;
        totalImpulse += 2 * ball.mass * Math.abs(ball.vx);
    }
    if (ball.y - ball.radius <= 0) {
        ball.y = ball.radius - (ball.y - ball.radius);
        ball.vy = -ball.vy;
        totalImpulse += 2 * ball.mass * Math.abs(ball.vy);
    }
    else if (ball.y + ball.radius >= canvas.height) {
        ball.y = ball.y - (ball.y + ball.radius - canvas.height);
        ball.vy = - ball.vy;
        totalImpulse += 2 * ball.mass * Math.abs(ball.vy);
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
    return totalImpulse / (curSeconds * getPerimeter());
}

function getRMSSpeed() {
    //return Math.sqrt(DEGREES_OF_FREEDOM * BOLTZMANN_CONSTANT * calculateTemperature() / molecule[0].mass);
    var sumSquares = 0;
    for (const ball of molecules) {
        sumSquares += getSpeed(ball) ** 2;
    }
    return Math.sqrt(sumSquares / N);
}

const graphCanvas = document.getElementById("velocity-graph");

graphCanvas.width = graphCanvas.clientWidth;
graphCanvas.height = graphCanvas.clientHeight;

function getSpeedCountsAndLabels(intervalSize = 10, intervalCount = 100) {
    const bins = new Array(intervalCount).fill(0);
    const labels = new Array(intervalCount);

    for (let i = 0; i < intervalCount; i ++) {
        labels[i] = `[${intervalSize * i},${intervalSize * (i+1)}]`;
    }

    for (const ball of molecules) {
        let idx = Math.floor(getSpeed(ball) / intervalSize);
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

update();