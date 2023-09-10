let pyodide = null;

// Globals
pixelRatio = 2; //  || window.devicePixelRatio;
marginPercent = 0.02

const button = document.getElementById("generateBtn");

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

async function generateGraph() {

    animationId = animationId + 1;
    pythonDrawElement = null;
    const canvas = document.getElementById("harmonographCanvas");

    if (canvas){
        const mycanvas = document.getElementById("harmonographCanvas");
        const ctx = mycanvas.getContext("2d");

        // Clear the canvas by filling it with a transparent color
        ctx.clearRect(-mycanvas.width, -mycanvas.height, mycanvas.width, mycanvas.height);

        const width = mycanvas.width / pixelRatio / pixelRatio;
        const height = mycanvas.height / pixelRatio / pixelRatio;
    } else {
        // clear the svg
        const svgElem = document.getElementById("harmonographSVG");
        while (svgElem.firstChild) {
            svgElem.removeChild(svgElem.firstChild);
        }

        pixelRatio = 1 // FIXME: maybe devicePixelRatio, need to test
        // SVG
    }

    graphStyle = "harmonograph";
    if(document.querySelector('input[name="graphType"]:checked').value === "Spirograph") {
        graphStyle = "spirograph";
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

    dt = parseFloat(document.getElementById('dt').value);
    

    // Ideas: 
    // - Make an endless animation: generate N points at a time, then call curve.draw_more() to draw next set
    // - Fade out older points
    // - Coloring
    //
    if (pyodide) {
        const setSysPathCode = `
            import sys

            # This is some pyodide magic: variables defined in the global scope can be imported
            from js import pixelRatio, pythonDrawElement, graphStyle, gears, mainCircleRadius, randomSeed, dt

            sys.path.append('py')
            print("Initialized")
            
            import flourish

            # Set canvas_element only if you want this rendered in Python (slower)
            print(gears)
            curve_points_x, curve_points_y, minX, maxX, minY, maxY = flourish.generate(style = graphStyle, canvas_element = pythonDrawElement, scale_ratio = pixelRatio, main_circle_radius = mainCircleRadius, spirogears = gears, random_seed = randomSeed, dt = dt)
            print(f"# of data points: {len(curve_points_x)}")
            `;
        await pyodide.runPython(setSysPathCode);


        // pyodide.globals: provide access to Python global variables. 
        // TODO: Avoid storing the points as globals (call function directly)
        cpx = pyodide.globals.get("curve_points_x");
        cpy = pyodide.globals.get("curve_points_y");
        
        minX = pyodide.globals.get("minX");
        maxX = pyodide.globals.get("maxX");
        
        minY = pyodide.globals.get("minY");
        maxY = pyodide.globals.get("maxY");
        
        if (typeof cpx !== 'undefined') {

            if (canvas){
                if (document.getElementById('animated').checked){
                    drawCurve(cpx.toJs(), cpy.toJs(), minX, maxX, minY, maxY, true);
                }
                else{
                    drawCurve(cpx.toJs(), cpy.toJs(), minX, maxX, minY, maxY, false);
                }
            } else {

                drawCurveSVG(cpx.toJs(), cpy.toJs(), minX, maxX, minY, maxY);

            }
            cpx.destroy()
            cpy.destroy()
        }
    }

}

let animationId = 0;
// Experimental: Function to draw a curve on the canvas with animation
function drawCurve(xs, ys, minX, maxX, minY, maxY, animation) {
    // Parameters/Variables:
    // xs / ys: lists of points used for drawing
    // animationId: used to detect cancellation of animation
    // canvas: Layer to draw the harmonograph
    // canvasTop: The layer to draw the leading "dot", if displayed. 
    // marginPercent: Add margins around the figure
    
    // Functionality
    // The canvases size is scaled down by pixel ratio to improve picture quality
    // xScale/yScale are used to scale the xs and ys to 0-1, so the entire figure fits / fills the view area
    //
    // animationInterval: Animation is triggered once per animationInterval. A higher number is faster.

    const myId = animationId;

    const canvas = document.getElementById("harmonographCanvas");
    const canvasTop = document.getElementById("harmonographCanvasTop");

    const ctx = canvas.getContext("2d");
    const ctxTop = canvasTop.getContext("2d");
    
    const awidth = canvas.width / pixelRatio;
    const aheight = canvas.height / pixelRatio;

    const marginX = marginPercent * awidth;  // 2% of width
    const marginY = marginPercent * aheight; // 2% of height

    const xScale = (awidth - 2 * marginX) / (maxX - minX);
    const yScale = (aheight - 2 * marginY) / (maxY - minY);

    ctx.clearRect(0, 0, awidth, aheight);
    
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
    ctx.shadowBlur = 2;
    ctx.shadowColor = ctx.strokeStyle;

    let currentPoint = 0;
    ctx.strokeStyle = document.getElementById('strokeStyle').value;
    ctx.lineWidth = document.getElementById('lineWidth').value;
    showDot = document.getElementById('showDots').checked;
    animationInterval = parseFloat(document.getElementById('animationInterval').value);

    console.log("Animation interval: ", animationInterval, "xScale: ", xScale, ", yScale: ", yScale);

    if (animation) {
        let continueDrawing = true;

        function draw() {
            if (!continueDrawing) return; 
            if (animationId != myId) {
                console.log("animationId changed, drawing cancelled");
                ctxTop.clearRect(0, 0, awidth, aheight);
                continueDrawing = false;
                return;
            }

            let drawCounter = 0;
            while (currentPoint < xs.length - 1 && drawCounter < animationInterval) {
                ctx.beginPath();
                ctx.moveTo(marginX + (xs[currentPoint] - minX) * xScale, marginY + (ys[currentPoint] - minY) * yScale);
                ctx.lineTo(marginX + (xs[currentPoint + 1] - minX) * xScale, marginY + (ys[currentPoint + 1] - minY) * yScale);
                ctx.stroke();

                if (showDot) {
                    ctxTop.clearRect(0, 0, awidth, aheight);
                    ctxTop.fillStyle = "red";
                    ctxTop.beginPath();
                    dotsize = 5;
                    ctxTop.arc(marginX + (xs[currentPoint + 1] - minX) * xScale, marginY + (ys[currentPoint + 1] - minY) * yScale, dotsize, 0, 2 * Math.PI);
                    ctxTop.fill();
                }

                drawCounter++;
                currentPoint++;
            }

            if (currentPoint >= xs.length - 1) {
                continueDrawing = false;  // Stop the drawing when done
            }

            if (continueDrawing) {
                requestAnimationFrame(draw);  // Schedule the next frame
            }
        }

        // Start the animation
        draw();
    } else {
        ctx.beginPath();
        ctx.moveTo(marginX + (xs[0] - minX) * xScale, marginY + (ys[0] - minY) * yScale);
    
        for (let i = 1; i < xs.length; i++) {
            ctx.lineTo(marginX + (xs[i] - minX) * xScale, marginY + (ys[i] - minY) * yScale);
        }
    
        ctx.stroke();
        console.log("Done in JS");
    }
}



function drawCurveSVG(xs, ys, minX, maxX, minY, maxY) {
    console.log("Num points = ", xs.length);

    const svgElem = document.getElementById("harmonographSVG");
    
    const viewBoxValues = svgElem.getAttribute('viewBox').split(' ').map(parseFloat);
    const viewBoxWidth = viewBoxValues[2];
    const viewBoxHeight = viewBoxValues[3];

    const awidth = viewBoxWidth; // parseFloat(svgElem.getAttribute('width'));
    const aheight = viewBoxHeight; // parseFloat(svgElem.getAttribute('height'));
    console.log("Drawing in SVG");

    const marginX = 0.02 * awidth;  // 2% of width
    const marginY = 0.02 * aheight; // 2% of height

    const effectiveWidth = awidth - 2 * marginX;
    const effectiveHeight = aheight - 2 * marginY;
    
    const xScale = effectiveWidth / (maxX - minX);
    const yScale = effectiveHeight / (maxY - minY);
    
    const xOffset = -minX * xScale + marginX;
    const yOffset = -minY * yScale + marginY;
    
    // Blur filter setup
    const filterElem = document.createElementNS("http://www.w3.org/2000/svg", "filter");
    filterElem.setAttribute('id', 'slightblur');
    const blurElem = document.createElementNS("http://www.w3.org/2000/svg", "feGaussianBlur");
    blurElem.setAttribute('in', 'SourceGraphic');
    blurElem.setAttribute('stdDeviation', '0.5');
    filterElem.appendChild(blurElem);
    svgElem.appendChild(filterElem);

    let pathData = `M ${(xs[0] * xScale) + xOffset} ${(ys[0] * yScale) + yOffset}`;
    
    for (let i = 1; i < xs.length; i++) {
        pathData += ` L ${(xs[i] * xScale) + xOffset} ${(ys[i] * yScale) + yOffset}`;
    }

    const pathElem = document.createElementNS("http://www.w3.org/2000/svg", "path");
    pathElem.setAttribute('d', pathData);
    pathElem.setAttribute('stroke', document.getElementById('strokeStyle').value);
    pathElem.setAttribute('stroke-width', document.getElementById('lineWidth').value);
    pathElem.setAttribute('fill', 'none');

    pathElem.setAttribute('shape-rendering', 'geometricPrecision'); 


    pathElem.setAttribute('filter', 'url(#slightblur)'); 
    pathElem.setAttribute('filter', 'url(#betterAA)');
    pathElem.setAttribute('filter', 'url(#softEdgeFilter)');

    svgElem.appendChild(pathElem);
    console.log("Done in SVG");
}

// Function to resize the canvas to full width and height
function resizeAndPrepareCanvas() {
    

    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    // Calculate 80% of the viewport dimensions
    const newWidth = Math.floor(viewportWidth * 0.8);
    const newHeight = Math.floor(viewportHeight * 0.8);

    const canvas = document.getElementById("harmonographCanvas");
    const canvasTop = document.getElementById("harmonographCanvasTop");

    const svgElem = document.getElementById("harmonographSVG");

    if (canvas){

        // Calculate 80% of the viewport dimensions
        const canvasWidth = newWidth;
        const canvasHeight = newHeight;

        canvas.width = canvasWidth;
        canvas.height = canvasHeight;

        const ctx = canvas.getContext("2d");

        ctx.imageSmoothingEnabled = true;
        ctx.globalAlpha = 0.5;
        ctx.antiAlias = true

        // Scale the photo for higher resolution
        const owidth = canvas.width;
        const oheight = canvas.height;
        canvas.width = owidth * pixelRatio;
        canvas.height = oheight * pixelRatio;
        ctx.scale(pixelRatio, pixelRatio);
        

        
        ctx.lineJoin = "round";
        ctx.lineCap = "round";
    }
    
    if (canvasTop){

        // Calculate 80% of the viewport dimensions
        const canvasWidth = newWidth;
        const canvasHeight = newHeight;

        canvasTop.width = canvasWidth;
        canvasTop.height = canvasHeight;

        const ctx2 = canvasTop.getContext("2d");

        ctx2.imageSmoothingEnabled = true;
        ctx2.globalAlpha = 0.5;
        ctx2.antiAlias = true

        // Scale the photo for higher resolution
        const owidth = canvasTop.width;
        const oheight = canvasTop.height;
        canvasTop.width = owidth * pixelRatio;
        canvasTop.height = oheight * pixelRatio;
        ctx2.scale(pixelRatio, pixelRatio);
        
        ctx2.lineJoin = "round";
        ctx2.lineCap = "round";
    }

    if (svgElem) {
        svgElem.setAttribute('width', newWidth);
        svgElem.setAttribute('height', newHeight);

        // Scale up to increase drawing clarity
        svgElem.setAttribute('viewBox', `0 0 ${pixelRatio*newWidth} ${pixelRatio*newHeight}`);

        if (true){
            // Testing SVG Filters to try to improve quality. 
            const filterElem = document.createElementNS("http://www.w3.org/2000/svg", "filter");
            filterElem.setAttribute('id', 'betterAA');
            const feComponentTransfer = document.createElementNS("http://www.w3.org/2000/svg", "feComponentTransfer");
            const funcA = document.createElementNS("http://www.w3.org/2000/svg", "feFuncA");
            funcA.setAttribute('type', 'linear');
            funcA.setAttribute('slope', '1.2');
            feComponentTransfer.appendChild(funcA);
            filterElem.appendChild(feComponentTransfer);
            svgElem.appendChild(filterElem);
            //svgElem.setAttribute('viewBox', `0 0 ${newWidth} ${newHeight}`);
        }

        if (!document.getElementById('softEdgeFilter')) {
            const defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
            
            const filter = document.createElementNS("http://www.w3.org/2000/svg", "filter");
            filter.setAttribute('id', 'softEdgeFilter');
            
            const blur = document.createElementNS("http://www.w3.org/2000/svg", "feGaussianBlur");
            blur.setAttribute('in', 'SourceAlpha');
            blur.setAttribute('stdDeviation', '2');
            
            const composite = document.createElementNS("http://www.w3.org/2000/svg", "feComposite");
            composite.setAttribute('in', 'SourceGraphic');
            
            filter.appendChild(blur);
            filter.appendChild(composite);
            defs.appendChild(filter);
            
            svgElem.appendChild(defs);
        }
        
    }
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
