let pyodide = null;

// Globals
pixelRatio = 2; //  || window.devicePixelRatio;

const button = document.getElementById("generateBtn");

async function loadPyodideAndPackages() {
    // loadingModal: Show
    document.getElementById("loadingModal").style.display = "flex";

    pyodide = await loadPyodide({ indexURL: 'https://cdn.jsdelivr.net/pyodide/v0.24.0/full/' });
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
    const canvas = document.getElementById("canvasEl");

    if (canvas){
        const mycanvas = document.getElementById("canvasEl");
        const ctx = mycanvas.getContext("2d");

        // Clear the canvas by filling it with a transparent color
        ctx.clearRect(-mycanvas.width, -mycanvas.height, mycanvas.width, mycanvas.height);

        const width = mycanvas.width / pixelRatio / pixelRatio;
        const height = mycanvas.height / pixelRatio / pixelRatio;
    } else {
        // clear the svg
        const svgElem = document.getElementById("svgEl");
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
            curve_points_x, curve_points_y = flourish.generate(style = graphStyle, canvas_element = pythonDrawElement, scale_ratio = pixelRatio, main_circle_radius = mainCircleRadius, spirogears = gears, random_seed = randomSeed, dt = dt)
            print(f"# of data points: {len(curve_points_x)}")

            `;
        await pyodide.runPython(setSysPathCode);


        // pyodide.globals: provide access to Python global variables. 
        // TODO: Avoid storing the points as globals (call function directly)
        cpx = pyodide.globals.get("curve_points_x");
        cpy = pyodide.globals.get("curve_points_y");
        
        
        if (typeof cpx !== 'undefined') {

            if (canvas){
                if (document.getElementById('animated').checked){
                    drawCurve(cpx.toJs(), cpy.toJs(),  true);
                }
                else{
                    drawCurve(cpx.toJs(), cpy.toJs(), false);
                }
            } else {
                drawCurveSVG(cpx.toJs(), cpy.toJs());
            }
            cpx.destroy()
            cpy.destroy()
        }
    }

}

// Function to resize the canvas to full width and height
function resizeAndPrepareCanvas() {
    

    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    // Calculate 80% of the viewport dimensions
    const newWidth = Math.floor(viewportWidth * 0.8);
    const newHeight = Math.floor(viewportHeight * 0.8);

    const canvas = document.getElementById("canvasEl");
    const canvasTop = document.getElementById("canvasElTop");

    const svgElem = document.getElementById("svgEl");

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
