# Build tracker (right arm)

- `PRINT_LOG.txt` - all 24 print plates with status (DONE / TODAY / TODO), who prints what, and the plan per day.
- `FINAL_PARTS_CHECKLIST.txt` - every screw, part and electronic, with what is owned, ordered or still to buy, plus returns.
- `HOME_DEPOT_LIST.txt` - bolts to pick up at Home Depot Dufferin (SKUs, aisle).
- `ROBOT_PC.txt` - the robot PC (ESP32 host): hardware, what is installed, and what was tested.
- `prints/` - the plate files for each print day (.3mf with settings built in; gcode stays local, too big).

Firmware tests flashed from the robot PC live in `firmware/robot_pc_tests/`
(blink, single-servo sweeps, pin-13 loopback check, and `hand6`: gentle-start PCA9685 driver for the hand servos).
