import math
from dataclasses import dataclass

import numpy as np

from curve import Curve
from render import ColorLine, ElegantLine
from parameter import GlobalParameter, Parameter, Parameterized, global_value
from util import abc


freq = GlobalParameter("freq")


@dataclass
class FullWave(Parameterized):
    freq: Parameter(
        name="frequency",
        key="f",
        default=2,
        adjacent_step=1,
        random=lambda rnd: rnd.randrange(*freq.get((1, 6, 1))),
    )
    amp: Parameter(
        name="amplitude",
        key="a",
        default=0.5,
        places=3,
        adjacent_step=0.2,
        random=lambda rnd: rnd.uniform(0.1, 1.0),
    )
    tweq: Parameter(
        name="frequency tweak",
        key="t",
        default=0.0,
        places=6,
        adjacent_step=0.0004,
        random=lambda rnd: rnd.gauss(0, 0.005),
    )
    phase: Parameter(
        name="phase",
        key="p",
        default=0.0,
        places=4,
        scale=2 * math.pi,
        adjacent_step=0.2,
        random=lambda rnd: rnd.uniform(0, 2 * math.pi),
    )

    def __call__(self, t, density=1):
        return self.amp * np.sin((self.freq * density + self.tweq) * t + self.phase)

    @classmethod
    def make_random(cls, name, rnd, limit=None):
        freqq = (1, 7, 1)
        if limit == "even":
            freqq = (2, 7, 2)
        elif limit == "odd":
            freqq = (1, 7, 2)

        with global_value(freq, freqq):
            return super().make_random(name, rnd)


@dataclass
class Ramp(Parameterized):
    stop: Parameter(
        name="stop",
        key="z",
        default=500,
    )

    def __call__(self, t):
        return t / self.stop


@dataclass
class TimeSpan(Parameterized):
    center: Parameter(
        name="center",
        key="c",
        default=900,
        adjacent_step=100,
    )
    width: Parameter(
        name="width",
        key="w",
        default=200,
        adjacent_step=50,
    )


STYLES = [
    ElegantLine(linewidth=3, alpha=1),
    ColorLine(lightness=0, linewidth=50, alpha=0.1),
    ColorLine(linewidth=10, alpha=0.5),
    ColorLine(linewidth=50, alpha=0.1),
]


@dataclass
class Harmonograph(Curve):
    density: Parameter(
        name="density",
        key="d",
        default=1.0,
        places=2,
        adjacent=lambda v: [v * 0.8 * 0.8, v * 0.8, v / 0.8, v / 0.8 / 0.8],
    )
    style: Parameter(
        name="style",
        key="s",
        default=0,
        adjacent=lambda _: list(range(len(STYLES))),
    )

    def __init__(self, name="", density=1.0, style=0):
        self.name = name
        self.density = density
        self.style = style
        self.dimensions = {}
        self.set_time_span(TimeSpan("ts", 900, 200))
        self.extras = set()
        self.render = STYLES[style]

    def add_dimension(self, name, waves, extra=False):
        self.dimensions[name] = waves
        if extra:
            self.extras.add(name)

    def set_ramp(self, ramp):
        self.ramp = ramp

    def set_time_span(self, timespan):
        self.timespan = timespan

    def points(self, dims, dt=0.01):
        ts_half = self.timespan.width // 2
        t = np.arange(
            start=self.timespan.center - ts_half,
            stop=self.timespan.center + ts_half,
            step=dt / self.density,
        )
        scale = len(self.dimensions["x"]) + 1
        pts = []
        for dim_name in dims:
            waves = self.dimensions[dim_name]
            val = 0.0
            for wave in waves:
                val += wave(t, self.density)
            val *= self.ramp(t)
            val /= scale
            
            pts.append(val)

        normalized = False
        if normalized:
            stacked_vals = np.vstack(pts)

            min_val = np.min(stacked_vals)
            max_val = np.max(stacked_vals)

            desired_min = -0.5
            desired_max = 0.5

            normalized_pts = desired_min + (desired_max - desired_min) * (stacked_vals - min_val) / (max_val - min_val)
            final_pts = normalized_pts
        else:
            final_pts = pts

        for pt in zip(*final_pts):
            yield pt

    def param_things(self):
        for dim_name, dim in self.dimensions.items():
            for wave in dim:
                yield wave, (dim_name if dim_name in self.extras else None)
        yield self, None
        yield self.timespan, None
        yield self.ramp, None

    @classmethod
    def make_from_short_params(cls, params):
        # Deduce the number of pendulums from the parameters
        xs = set(k[1] for k in params if k.startswith("x"))
        npend = len(xs)

        harm = cls.from_short_params("", params)
        harm.add_dimension(
            "x",
            [FullWave.from_short_params(f"x{abc(i)}", params) for i in range(npend)],
        )
        harm.add_dimension(
            "y",
            [FullWave.from_short_params(f"y{abc(i)}", params) for i in range(npend)],
        )
        harm.add_dimension("j", [FullWave.from_short_params("j", params)], extra=True)
        harm.add_dimension("k", [FullWave.from_short_params("k", params)], extra=True)
        harm.set_ramp(Ramp.from_short_params("r", params))
        harm.set_time_span(TimeSpan.from_short_params("ts", params))
        return harm

    @classmethod
    def make_random(cls, rnd, npend, syms, rampstop=500):
        sym = rnd.choice(syms)
        xlimit = ylimit = None
        if sym == "X":
            xlimit = "odd"
            ylimit = "even"
        elif sym == "Y":
            xlimit = "even"
            ylimit = "odd"
        elif sym == "R":
            xlimit = ylimit = "odd"
        harm = cls()
        harm.add_dimension(
            "x",
            [
                FullWave.make_random(f"x{abc(i)}", rnd, limit=xlimit)
                for i in range(npend)
            ],
        )
        harm.add_dimension(
            "y",
            [
                FullWave.make_random(f"y{abc(i)}", rnd, limit=ylimit)
                for i in range(npend)
            ],
        )
        harm.add_dimension("j", [FullWave.make_random("j", rnd)], extra=True)
        harm.add_dimension("k", [FullWave.make_random("k", rnd)], extra=True)
        harm.set_ramp(Ramp("r", rampstop))
        print("Setting timespan")
        harm.set_time_span(TimeSpan("ts", 1800, 400))

        return harm
