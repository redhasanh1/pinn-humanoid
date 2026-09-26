"""Grasp habits that generalise by shape (Kimi round 13).

Planning a real grasp searches up to ~30 approach directions, each an IK solve and a collision check: a sponge in the
crowded kitchen took ~50 s. People don't search - they grab a mug the way they grabbed the last mug. So the robot
remembers, per SHAPE, the approach that worked (tilt, turn, height; separately for wrapping and for sliding flat things
out), and a new object - even one it has never touched - tries first what worked for the most similar remembered
shape. It is still checked on the body before it is used, and a Beta count per memory decides whether it is trusted
(the same rule as the other habits). Memory can only change the ORDER candidates are tried in, never skip the checks.

    mem = GraspMemory("logs/grasp_memory.json")
    home.GRASP_MEMORY = mem              # HomeBody uses it for picks and slides
"""
import json
import os

import numpy as np

from . import home

MIN_P = 0.6
FAR = 1.5              # shape distance beyond which a memory is not "similar"


def shape(o):
    """A few numbers describing what o looks like to the hand: kind (round / cylinder / box) and its size in cm."""
    typ, size = home.OBJECTS[o][2], [float(v) for v in home.OBJECTS[o][3].split()]
    h = 2 * home.OBJECTS[o][5]
    if typ == "sphere":
        w, d = 2 * size[0], 2 * size[0]
    elif typ == "cylinder":
        w, d = 2 * size[0], 2 * size[0]
    else:
        w, d = sorted([2 * size[0], 2 * size[1]], reverse=True)
    return {"kind": typ, "w": w * 100, "d": d * 100, "h": h * 100}


def distance(a, b):
    """Kind mismatch costs 1; sizes compared in log scale (a 4 cm and a 5 cm cup are close, a plate and a cup not)."""
    k = 0.0 if a["kind"] == b["kind"] else 1.0
    s = sum(abs(np.log(max(a[f], 0.5) / max(b[f], 0.5))) for f in ("w", "d", "h"))
    return k + s


class GraspMemory:
    def __init__(self, path=None):
        self.path = path
        self.items = []                   # {"what", "obj", "shape", "params", "wins", "tries"}
        if path and os.path.exists(path):
            with open(path) as f:
                self.items = json.load(f)
        self.hits = self.misses = 0

    def save(self):
        if self.path:
            os.makedirs(os.path.dirname(self.path) or ".", exist_ok=True)
            with open(self.path, "w") as f:
                json.dump(self.items, f, indent=1)

    def recall(self, what, o, exclude_self=False):
        """Params (tilt, yaw, dz or fist height) that worked for the most similar trusted shape, or None."""
        me = shape(o)
        best = None
        for it in self.items:
            if it["what"] != what or (exclude_self and it["obj"] == o):
                continue
            p = (it["wins"] + 1) / (it["tries"] + 2)
            if p < MIN_P:
                continue
            dist = distance(me, it["shape"])
            if dist < FAR and (best is None or dist < best[0]):
                best = (dist, it)
        return None if best is None else tuple(best[1]["params"])

    def learn(self, what, o, params, ok=True):
        params = [float(v) for v in params]
        for it in self.items:
            if it["what"] == what and it["obj"] == o and np.allclose(it["params"], params, atol=1e-3):
                it["tries"] += 1
                it["wins"] += int(ok)
                return
        self.items.append({"what": what, "obj": o, "shape": shape(o), "params": params,
                           "wins": int(ok), "tries": 1})
