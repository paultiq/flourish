
let animationId = 0;
// Experimental: Function to draw a curve on the canvas with animation
function drawCurve(xs, ys, animation) {
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

    const canvas = document.getElementById("canvasEl");
    const canvasTop = document.getElementById("canvasElTop");

    const ctx = canvas.getContext("2d");
    const ctxTop = canvasTop.getContext("2d");
    
    const awidth = canvas.width / pixelRatio;
    const aheight = canvas.height / pixelRatio;

    //const xScale = (awidth - 2 * marginX) / (maxX - minX);
    //const yScale = (aheight - 2 * marginY) / (maxY - minY);

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

    console.log("Animation interval: ", animationInterval);

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
                ctx.moveTo(awidth*(xs[currentPoint]), aheight*(ys[currentPoint]));
                ctx.lineTo(awidth*(xs[currentPoint + 1]), aheight*(ys[currentPoint + 1]));
                ctx.stroke();

                if (showDot) {
                    ctxTop.clearRect(0, 0, awidth, aheight);
                    ctxTop.fillStyle = "red";
                    ctxTop.beginPath();
                    dotsize = 5;
                    ctxTop.arc(awidth*(xs[currentPoint + 1]), aheight*(ys[currentPoint + 1]), dotsize, 0, 2 * Math.PI);
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
        ctx.moveTo(awidth*(xs[0]), aheight*(ys[0]));
    
        for (let i = 1; i < xs.length; i++) {
            ctx.lineTo(awidth*(xs[i]), aheight*(ys[i]));
        }
    
        ctx.stroke();
        console.log("Done in JS");
    }
}

function drawCurveSVG(xs, ys) {
    console.log("Num points = ", xs.length);

    const svgElem = document.getElementById("svgEl");

    const viewBoxValues = svgElem.getAttribute('viewBox').split(' ').map(parseFloat);
    const viewBoxWidth = viewBoxValues[2];
    const viewBoxHeight = viewBoxValues[3];

    const awidth = viewBoxWidth; // parseFloat(svgElem.getAttribute('width'));
    const aheight = viewBoxHeight; // parseFloat(svgElem.getAttribute('height'));
    console.log("Drawing in SVG");

    // Blur filter setup
    const filterElem = document.createElementNS("http://www.w3.org/2000/svg", "filter");
    filterElem.setAttribute('id', 'slightblur');
    const blurElem = document.createElementNS("http://www.w3.org/2000/svg", "feGaussianBlur");
    blurElem.setAttribute('in', 'SourceGraphic');
    blurElem.setAttribute('stdDeviation', '0.5');
    filterElem.appendChild(blurElem);
    svgElem.appendChild(filterElem);

    let pathData = `M ${awidth * (xs[0])} ${(aheight * ys[0])}`;

    for (let i = 1; i < xs.length; i++) {
        pathData += ` L ${(awidth * xs[i])} ${(aheight* ys[i])}`;
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
