# Import required modules
import js
import numpy as np
from js import document, requestAnimationFrame
from pyodide.ffi import create_proxy
import random
#import numpy as np
from harmonograph import Harmonograph
from spirograph import Spirograph
from render import ElegantLine, ColorLine
import pythonrender
import math


# main.py
def get_points(style, dt, spirogears, main_circle_radius, random_seed):
    """Original code used numpy's RNG. This had hiccups in Pyodide: it was an easy switch to `random`, but not sure if important
    or useful to reconsider.  """

    if random_seed == 0 or random_seed is None or math.isnan(random_seed):
        # Since we can't get random_seed back out, let's generate one and print it to console
        print("Since we can't retrieve the default seed, let's generate a seed so we can print it")
        
        random_seed = random.random()
        document.getElementById('randomSeed').value = random_seed

    print(f"{random_seed=}")
    random.seed(random_seed)

    print("get_points: Started")
    if style == "spirograph" or style is False:
        print("Drawing Spirograph")
        print(f"{type(main_circle_radius)}")
        if main_circle_radius is None or math.isnan(main_circle_radius):
            main_circle_radius = random.random()

        if spirogears is None or len(spirogears) == 0:
            print("Generating random Spirograph")
            curve = Spirograph()
            curve.main_circle(main_circle_radius)

            gearr = random.random()

            num_gears = random.randint(1, 5)
            print(f"{main_circle_radius=} {num_gears=}")

            for i in range(num_gears):
                gearr = random.random() * random.random()
                penr = random.random() / 10
                inside = random.choice([True, False])
                print(f"Gear {i}: {gearr=} {penr=} {inside=}")
                curve.add_gear(gearr=gearr, penr=penr, inside=inside)
        else:
            curve = Spirograph()
            curve.main_circle(main_circle_radius)
            for g in spirogears:
                curve.add_gear(gearr=g.gearRadius, penr=g.penRadius, inside=g.inside)
    elif style == "random1": 
        # Not used, experimenting with different parameters
        curve = Harmonograph.make_random(random, npend=2, syms=['R', 'X', 'Y', 'N'])
    else:
        curve = Harmonograph.make_random(random, npend=2, syms=['X', 'Y', 'R'])
        
    xs = []
    ys = []

    # TODO: Change points() so it returns the points, rather than going from a List to a Generator and back to a List
    for x,y in curve.points(["x", "y"], dt):
        xs.append(x)
        ys.append(y)
    print("get_points: Done")
    return xs, ys

def generate(style = "harmonograph", canvas_element = "harmonographCanvas", scale_ratio = 1, dt = .002, spirogears = None, main_circle_radius = None, random_seed = None):
    print("Generating: Started")
    print(f"{style=}")
    xs, ys = get_points(style=style, dt=dt, spirogears=spirogears, main_circle_radius=main_circle_radius, random_seed = random_seed)

    if spirogears is not None:
        print(spirogears)
        
    print("Generating: Done")
    if canvas_element is None:
        # Pass the objects back to Javascript
        # In JS, these will be .toJS'd to js elements
        # instead of proxies... this could also be done here:

        # Normalize first
        stacked_vals = np.vstack((xs, ys))

        min_val = np.min(stacked_vals)
        max_val = np.max(stacked_vals)

        # Giving a little margin
        desired_min = 0.025
        desired_max = 0.975

        xs = desired_min + (desired_max - desired_min) * (xs - min_val) / (max_val - min_val)
        ys = desired_min + (desired_max - desired_min) * (ys - min_val) / (max_val - min_val)
        
        return xs, ys
    else:
        # If we have a canvas_element, we can draw the points directly here
        pythonrender.draw_points(xs, ys, scale_ratio, canvas_element)
        return None, None
    
