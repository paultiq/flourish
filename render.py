import colorsys
from io import BytesIO

import cairo

class Render:
    extras = []
    DTS = [(400, .02), (1000, .01), (9999999, .002)]

    def __init__(self, linewidth=5, alpha=1, bg=1):
        self.linewidth = linewidth
        self.alpha = alpha
        self.bg = bg

    def prep_context(self, surface, size):
        width, height = size
        ctx = cairo.Context(surface)
        ctx.rectangle(0, 0, width, height)
        ctx.set_source_rgba(self.bg, self.bg, self.bg, 1)
        ctx.fill()
        ctx.translate(width / 2, height / 2)
        ctx.set_line_width(width * self.linewidth / 10000)
        return ctx

    def draw(self, surface, size, harm):
        pass

    def dt(self, width):
        return lookup(width, self.DTS)

def lookup(x, choices):
    """
    Find the value in a lookup table where x < v.
    """
    for limit, choice in choices:
        if x < limit:
            return choice


class ElegantLine(Render):
    def __init__(self, gray=0, **kwargs):
        super().__init__(**kwargs)
        self.gray = gray
        # Cairo won't alpha a line over itself, so we can't use an alpha value
        # for this renderer, which draws the whole image as one line.
        assert self.alpha == 1

    def draw(self, surface, size, harm):
        npend = 3
        width, height = size
        dt = self.dt(width)
        ctx = self.prep_context(surface, size)
        ctx.set_source_rgb(self.gray, self.gray, self.gray)
        maxx = width / (npend + 1)
        maxy = height / (npend + 1)
        for i, (x, y) in enumerate(harm.points(["x", "y"], dt=dt)):
            if i == 0:
                ctx.move_to(x * maxx, y * maxy)
            else:
                ctx.line_to(x * maxx, y * maxy)
        ctx.stroke()

class ColorLine(Render):
    extras = ["j"]
    DTS = [(400, .04), (1000, .01), (9999999, .002)]

    def __init__(self, lightness=.5, **kwargs):
        super().__init__(**kwargs)
        self.lightness = lightness

    def draw(self, surface, size, harm):
        npend = 3
        width, height = size
        dt = self.dt(width)
        ctx = self.prep_context(surface, size)
        maxx = width / (npend + 1)
        maxy = height / (npend + 1)
        for i, (x, y, h) in enumerate(harm.points(["x", "y", "j"], dt=dt)):
            if i > 0:
                r, g, b = colorsys.hls_to_rgb(h, self.lightness, 1)
                ctx.set_source_rgba(r, g, b, self.alpha)
                ctx.move_to(x0 * maxx, y0 * maxy)
                ctx.line_to(x * maxx, y * maxy)
                ctx.stroke()
            x0, y0 = x, y


def draw_svg(harm, size, render=None):
    width, height = size
    if render is None:
        render = harm.render
    svgio = BytesIO()
    with cairo.SVGSurface(svgio, width, height) as surface:
        surface.set_document_unit(cairo.SVGUnit.PX)
        render.draw(surface, size, harm)
    return svgio.getvalue().decode("ascii")

def draw_png(harm, size, render=None):
    width, height = size
    if render is None:
        render = harm.render
    svgio = BytesIO()
    with cairo.ImageSurface(cairo.FORMAT_ARGB32, width, height) as surface:
        render.draw(surface, size, harm)
        pngio = BytesIO()
        surface.write_to_png(pngio)
    pngio.seek(0)
    return pngio
