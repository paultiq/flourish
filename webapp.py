import functools
import random
import urllib.parse
from dataclasses import dataclass

from flask import Flask, request, render_template, render_template_string, send_file

from harmonograph import Harmonograph, Ramp, FullWave, TimeSpan
from render import draw_png, draw_svg, ColorLine, ElegantLine

app = Flask(__name__)

TheRender = functools.partial(ColorLine, linewidth=3.75, alpha=.5)
TheRender = functools.partial(ElegantLine, linewidth=.5, alpha=1)

@dataclass
class Thumb:
    harm: Harmonograph
    size: object

    def as_html(self):
        url = one_url("/one", self.harm)
        sx = self.size[0]
        sy = self.size[1]
        pngurl = one_url("/png", self.harm, sx=sx*2, sy=sy*2)
        return render_template_string(
            '''<span><a href="{{url}}"><div class="thumb"><img src={{pngurl}} width="{{sx}}" height="{{sy}}" /></div></a></span>''',
            url=url,
            pngurl=pngurl,
            sx=sx,
            sy=sy,
        )

@app.route("/")
def many():
    size = (192, 108)
    thumbs = []
    for _ in range(30):
        harm = make_random_harm(random)
        thumbs.append(Thumb(harm, size=size))
    return render_template("many.html", thumbs=thumbs)

def first_last(seq):
    l = list(seq)
    if l:
        return [seq[0], seq[-1]]
    else:
        return []

@app.route("/one")
def one():
    params = dict(request.args)
    harm = make_harm_from_short_params(params, npend=3)
    svg = draw_svg(TheRender(), harm=harm, size=(1920//2, 1080//2))
    params = list(harm.parameters())
    shorts = harm.short_parameters()
    param_display = []
    for paramdef, thing, val in params:
        name = thing.name + " " + paramdef.type.name
        adj_thumbs = []
        for adj in paramdef.type.adjacent(val):
            adj_params = dict(shorts)
            adj_key = thing.name + paramdef.type.key
            adj_params[adj_key] = paramdef.type.to_short(adj)
            adj_harm = make_harm_from_short_params(adj_params, npend=3)
            adj_thumbs.append(Thumb(adj_harm, size=(192, 108)))
        param_display.append((name, adj_thumbs))
    return render_template("one.html", svg=svg, params=params, param_display=param_display)

@app.route("/png")
def png():
    params = dict(request.args)
    harm = make_harm_from_short_params(params, npend=3)
    sx, sy = int(params.get("sx", 1920)), int(params.get("sy", 1080))
    png_bytes = draw_png(TheRender(), harm=harm, size=(sx, sy))
    return send_file(png_bytes, mimetype="image/png")

def one_url(route, harm, **kwargs):
    qargs = harm.short_parameters()
    qargs.update(kwargs)
    q = urllib.parse.urlencode(qargs)
    return f"{route}?" + q

def make_harm_from_short_params(params, npend):
    harm = Harmonograph()
    harm.add_dimension("x", [FullWave.from_short_params(f"x{i}", params) for i in range(npend)])
    harm.add_dimension("y", [FullWave.from_short_params(f"y{i}", params) for i in range(npend)])
    harm.add_dimension("z", [FullWave.from_short_params(f"z{i}", params) for i in range(npend)])
    harm.set_ramp(Ramp.from_short_params("ramp", params))
    harm.set_time_span(TimeSpan.from_short_params("ts", params))
    return harm

def make_random_harm(rnd, rampstop=500, npend=3):
    harm = Harmonograph()
    harm.add_dimension("x", [FullWave.make_random(f"x{i}", rnd) for i in range(npend)])
    harm.add_dimension("y", [FullWave.make_random(f"y{i}", rnd) for i in range(npend)])
    harm.add_dimension("z", [FullWave.make_random(f"z{i}", rnd) for i in range(npend)])
    harm.set_ramp(Ramp("ramp", rampstop))
    return harm
