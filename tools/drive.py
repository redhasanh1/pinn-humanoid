"""Drive the InMoov around the house yourself with the arrow keys (the camera stays yours: mouse / touchpad).

    .venv/Scripts/python tools/drive.py

    Up / Down      forward / back 10 cm (in the direction it faces)
    Left / Right   turn 15 degrees (hold to spin a full 360)
    Page Up / Down strafe left / right 10 cm
    Home           back to the start spot

Kinematic, like the task playback: the base joints (base_x, base_y, base_yaw) are set directly. There is no
collision stop yet, so it can drive through furniture.
"""
import math
import os
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from hand import home  # noqa: E402
from hand.inmoov_sim import build_model  # noqa: E402

STEP, TURN = 0.10, math.radians(15)
UP, DOWN, LEFT, RIGHT, PGUP, PGDN, HOME = 265, 264, 263, 262, 266, 267, 268


def main():
    import mujoco
    import mujoco.viewer
    m = build_model(extra=home.scene_xml(), mobile=True)
    d = mujoco.MjData(m)
    adr = {n: m.jnt_qposadr[m.joint(n).id] for n in ("base_x", "base_y", "base_yaw")}
    pose = [0.0, 0.0, 0.0]
    moved = [True]

    def key(k):
        x, y, yaw = pose
        fwd, left = (math.cos(yaw), math.sin(yaw)), (-math.sin(yaw), math.cos(yaw))
        if k in (UP, DOWN):
            s = STEP if k == UP else -STEP
            pose[0], pose[1] = x + s * fwd[0], y + s * fwd[1]
        elif k in (PGUP, PGDN):
            s = STEP if k == PGUP else -STEP
            pose[0], pose[1] = x + s * left[0], y + s * left[1]
        elif k in (LEFT, RIGHT):
            pose[2] = yaw + (TURN if k == LEFT else -TURN)
        elif k == HOME:
            pose[:] = [0.0, 0.0, 0.0]
        else:
            return
        moved[0] = True
        print(f"base x {pose[0]:+.2f} m  y {pose[1]:+.2f} m  facing {math.degrees(pose[2]) % 360:5.1f} deg", flush=True)

    print(__doc__.split("\n\n")[1], flush=True)
    with mujoco.viewer.launch_passive(m, d, key_callback=key) as v:
        v.cam.lookat[:] = (0.0, 0.5, 0.7)
        v.cam.distance, v.cam.azimuth, v.cam.elevation = 4.6, 90, -50
        while v.is_running():
            if moved[0]:
                for n, val in zip(adr, pose):
                    d.qpos[adr[n]] = val
                mujoco.mj_forward(m, d)
                moved[0] = False
            v.sync()
            time.sleep(0.02)


if __name__ == "__main__":
    main()
