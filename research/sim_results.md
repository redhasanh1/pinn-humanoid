# What it learned in simulation

All results below come from a full physics simulation (MuJoCo) of the InMoov: gravity, contact, friction and force-limited motors. No motion is scripted. Each skill was learned from a score.

## Throwing
- **Start:** random arm swings, the ball landing more than a metre short.
- **Learned:** the full swing and release timing. The best throw passes **0.1 cm** from the centre of the rim.
- **Adapting:** a new position and gusty wind on every throw. The robot learned a single skill that adjusts to both. At 90% difficulty (hoop moved up to 36 cm, wind up to 5.4 m/s) the best skill scores 6 to 7 of every 8.
- **Now:** training against a regulation-style hoop above the robot's head (2.5 m). The fixed shot is already learned.
- Every attempt is logged (position, wind, arm motion, result): tens of thousands of throws, ready as training data.

## Catching
- The hand predicts where a lobbed ball will arrive and moves there at servo speed.
- It stops the ball in the palm on nearly every throw. The current training target is holding it through a shake test.

## Grasping
- Next skill in training: picking up household objects with the five-finger hand, starting with blocks and cups, then round objects.

## Method
- **Honest physics:** force-limited motors and stiff contact models, so nothing passes through anything and the results hold up.
- **Resumable training:** state is saved every round, so training continues exactly where it stopped.
