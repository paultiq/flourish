
from js import document

def draw_simple_line(canvas_id):
    """Example of drawing directly on a Canvas element directly from Python.
    """

    canvas = document.getElementById(canvas_id)
    ctx = canvas.getContext("2d")

    x1, y1 = 50, 150  # Starting point
    x2, y2 = 250, 150  # Ending point

    ctx.strokeStyle = "blue"
    ctx.lineWidth = 2

    def draw_horizontal_line(x1, x2, y):
        step = 1
        while x1 <= x2:
            ctx.beginPath()
            ctx.moveTo(x1, y)
            
            ctx.lineTo(x1 + step, y)
            ctx.stroke()
            
            x1 += step

    draw_horizontal_line(x1, x2, y1)
    print("Drawn")


def draw_points(xs, ys, scale_ratio, canvas_id):
    """
    Draws on the Canvas element.
    This is slow, because it's jumping between Python and Javascript for each call.
    Instead of this version, there's a native js draw_points() in main.js 
    """
    
    print("draw_points: Started")
    canvas = document.getElementById(canvas_id)
    ctx = canvas.getContext("2d")

    # FIXME: This "clear" wasn't clearing
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    width, height = canvas.width / scale_ratio/scale_ratio, canvas.height/scale_ratio/scale_ratio
    
    ctx.strokeStyle = "blue"
    ctx.lineWidth = .1

    offset_x = 0.5 * width
    offset_y = 0.5 * height

    for x, y in zip(xs, ys):
        ctx.lineTo(x * offset_x + offset_x, y * offset_y + offset_y)
    ctx.stroke()
    print("draw_points: Done")