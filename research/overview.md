# How the robot learns

Every skill this robot has is learned, not programmed. It practises in a full physics simulation until it gets good, and only then runs on real motors.

## Simulation first
A real arm can attempt a throw a few hundred times before parts wear out. In simulation it attempts tens of thousands of throws overnight, in wind and from different positions, with nothing breaking. Every skill is developed there first.

## Learned, not hand-coded
The robot is given a goal and a score, never a motion. For throwing, the score is how close the ball lands to the hoop. A learning algorithm adjusts the arm's motion until the score is high. The resulting skill was discovered by the robot itself.

## Layered control
A single large model cannot react fast enough on its own, so control is split into layers that run at different speeds:

| Layer | Role | Rate |
|---|---|---|
| Brain | Reads the cameras and the instruction, plans the next 2 seconds | about 1 per second |
| Checker | Watches the plan and corrects mistakes mid-motion | several per second |
| Reflex | Learned fast skills: catch, cushion, release | 50 per second |
| Motors | Hold each joint at its target | every 20 ms |

## Hardware in progress
- InMoov hand, forearm and arm being 3D-printed at the Seneca Sandbox
- Finger servos, servo drivers and microcontroller wired on the bench
- Simulation, training and control code open source in this repository
