let pyodide = null;


async function loadPyodideAndPackages() {
    // loadingModal: Show
    document.getElementById("loadingModal").style.display = "flex";

    pyodide = await loadPyodide({ indexURL: 'https://cdn.jsdelivr.net/pyodide/v0.23.4/full/' });
    await pyodide.loadPackage(['numpy']); //, 'matplotlib', 'Pillow']);  // Or any other required packages

        
    // This is *not* an optimal practice (loading files individually)
    // The correct practice is to create a zip archive, such as py/py.zip
    // Or install from pypi
    let pythonFiles = ['py/cairo.py', 'py/PIL.py', '../parameter.py', '../constants.py', '../render.py', '../curve.py', '../util.py', '../spirograph.py', '../harmonograph.py', 'py/flourish.py', 'py/pythonrender.py'];
    for (let file of pythonFiles) {
        let response = await fetch(file);
        let content = await response.text();
        
        // Write to Pyodide's virtual file system
        let filename = file.split('/').pop(); // get the last part of URL
        pyodide.FS.writeFile(filename, content);
    }

    
    // A better solution is to serve a py.zip
    // const zipResponse = await fetch("py/py.zip");
    // const zipBinary = await zipResponse.arrayBuffer();
    // pyodide.unpackArchive(zipBinary, "zip");

    
    // loadingModal: Hide
    document.getElementById("loadingModal").style.display = "none";

}

const button = document.getElementById("generateBtn");
pixelRatio = 2; //  || window.devicePixelRatio;

// Function to resize the canvas to full width and height
function resizeAndPrepareCanvas() {
    const canvas = document.getElementById("harmonographCanvas");

    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    // Calculate 80% of the viewport dimensions
    const canvasWidth = Math.floor(viewportWidth * 0.8);
    const canvasHeight = Math.floor(viewportHeight * 0.8);

    canvas.width = canvasWidth;
    canvas.height = canvasHeight;

    const ctx = canvas.getContext("2d");

    ctx.imageSmoothingEnabled = true;
    ctx.globalAlpha = 0.5;

    // Scale the photo for higher resolution
    const owidth = canvas.width;
    const oheight = canvas.height;
    canvas.width = owidth * pixelRatio;
    canvas.height = oheight * pixelRatio;
    ctx.scale(pixelRatio, pixelRatio);
    

    
    ctx.lineJoin = "round";
    ctx.lineCap = "round";

}


async function generateGraph() {



    const mycanvas = document.getElementById("harmonographCanvas");

    const ctx = mycanvas.getContext("2d");
    
    // Clear the canvas by filling it with a transparent color
    ctx.clearRect(-mycanvas.width, -mycanvas.height, mycanvas.width, mycanvas.height);

    const width = mycanvas.width / pixelRatio / pixelRatio;
    const height = mycanvas.height / pixelRatio / pixelRatio;

    pythonDrawElement = "harmonographCanvas"
    pythonDrawElement = null

    graphStyle = "harmonograph"
    if(document.querySelector('input[name="graphType"]:checked').value === "Spirograph") {
        graphStyle = "spirograph"
    }

    gears = null;
    mainCircleRadius = null;
    if (graphStyle == "spirograph"){
        mainCircleRadius = parseFloat(document.getElementById('mainCircleRadius').value);
        numGears = parseInt(document.getElementById('numGears').value);
        gears = []
        for (let i = 0; i < numGears; i++) {
            const gearDiv = document.getElementById('gearOptions').children[i];
            const gearRadius = parseFloat(gearDiv.querySelector('input[type="number"]:nth-child(1)').value);
            const penRadius = parseFloat(gearDiv.querySelector('input[type="number"]:nth-child(2)').value);
            const inside = gearDiv.querySelector('input[type="checkbox"]').checked;
            gears.push({
                gearRadius: gearRadius,
                penRadius: penRadius,
                inside: inside
            });
        }
    }

    randomSeed = false
    if (document.getElementById('randomSeedEnabled').checked){
        randomSeed = parseFloat(document.getElementById('randomSeed').value);
    }
    if (pyodide) {
        const setSysPathCode = `
            import sys

            # This is some pyodide magic: variables defined in the global scope can be imported
            from js import pixelRatio, pythonDrawElement, graphStyle, gears, mainCircleRadius, randomSeed

            sys.path.append('py')
            print("Initialized")
            
            import flourish

            # Set canvas_element only if you want this rendered in Python (slower)
            print(gears)
            flourish.generate(style = graphStyle, canvas_element = pythonDrawElement, scale_ratio = pixelRatio, main_circle_radius = mainCircleRadius, spirogears = gears, random_seed = randomSeed)
        `;
        await pyodide.runPython(setSysPathCode);

        drawCurve(curve_points_x.toJs(), curve_points_y.toJs())
    }
    
}

// Function to draw a curve on the canvas
function drawCurve(xs, ys) {
    console.log("Num points = ", xs.length);
    const canvas = document.getElementById("harmonographCanvas");

    const ctx = canvas.getContext("2d");

    // The pixel ratio is used to increase density of the graph
    const awidth = canvas.width / pixelRatio;
    const aheight = canvas.height / pixelRatio;
    console.log("Drawing in JS")

    // Center point
    const offset_x = awidth / 2;  
    const offset_y = aheight / 2;

    ctx.clearRect(0, 0, awidth, aheight);

    // Shrink a little for margin
    const widthMultiplier = 0.7 * awidth / 2
    const heightMultipler = 0.7 * aheight / 2

    // Set style
    //ctx.strokeStyle = "blue";
    //ctx.lineWidth = .1;
    ctx.strokeStyle = document.getElementById('strokeStyle').value;
    ctx.lineWidth = document.getElementById('lineWidth').value;

    // Attempts to reduce aliasing. This seemed to help
    ctx.shadowOffsetX = 0
    ctx.shadowOffsetY = 0
    ctx.shadowBlur = 2
    ctx.shadowColor = ctx.strokeStyle


    ctx.beginPath();
    ctx.moveTo(xs[0] * widthMultiplier + offset_x, ys[0] * heightMultipler + offset_y);
    //ctx.translate(0.5, 0.5);  // attempt to improve aliasing, don't think it really helped

    for (let i = 1; i < xs.length; i++) {
        ctx.lineTo(xs[i] * widthMultiplier + offset_x, ys[i] * heightMultipler + offset_y);

    }

    ctx.stroke();
    console.log("Done in JS");
}

// Experimental: Function to draw a curve on the canvas with animation

function drawCurveAnimated(xs, ys) {
    const canvas = document.getElementById("harmonographCanvas");
    const ctx = canvas.getContext("2d");

    const width = canvas.width / pixelRatio / pixelRatio;
    const height = canvas.height / pixelRatio / pixelRatio;
    const offset_x = 0.5 * width;
    const offset_y = 0.5 * height;

    ctx.clearRect(0, 0, width, height);
    ctx.strokeStyle = "blue";
    ctx.lineWidth = 0.1;


    ctx.lineJoin = "round";
    ctx.lineCap = "round";

    let currentIndex = 1; // Start from the second point (index 1)

    function animate() {
        ctx.beginPath();
        ctx.moveTo(xs[0] * offset_x + offset_x, ys[0] * offset_y + offset_y);

        for (let i = 1; i <= currentIndex; i++) {
            ctx.lineTo(xs[i] * offset_x + offset_x, ys[i] * offset_y + offset_y);
        }

        ctx.stroke();

        if (currentIndex < xs.length - 1) {
            currentIndex++;
            requestAnimationFrame(animate); // Continue the animation
        } else {
            console.log("Done in JS");
        }
    }

    animate();
}

// Spirograph Options
function toggleSpirographOptions(show) {
    document.getElementById('spirographOptions').style.display = show ? 'block' : 'none';
}

function updateGearOptions() {
    const numGears = parseInt(document.getElementById('numGears').value);
    let gearOptionsHTML = '';

    for (let i = 1; i <= numGears; i++) {
        gearOptionsHTML += `
            <div>
                Gear ${i} - Gear Radius: <input type="number" value="0.06">
                Pen Radius: <input type="number" value="0.15">
                Inside: <input type="checkbox" value="True">
            </div>
        `;
    }

    document.getElementById('gearOptions').innerHTML = gearOptionsHTML;
}


window.onload = async function () {
    await loadPyodideAndPackages();

    document.getElementById("generateBtn").addEventListener("click", generateGraph);
    resizeAndPrepareCanvas();
    generateGraph()
}


window.addEventListener("resize", resizeAndPrepareCanvas);
