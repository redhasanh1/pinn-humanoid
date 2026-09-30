# Physics-informed learning

## The problem
A standard neural network learns only from examples. Given a few noisy measurements of a thrown ball, it fits a curve through them that is wrong everywhere in between. Reliable behaviour normally needs large amounts of data, and real robots cannot collect much.

## The approach
A physics-informed neural network (PINN) is trained on two objectives at once:

**loss = data error + λ × physics error**

- **Data error:** distance from the measurements.
- **Physics error:** how far the prediction breaks the laws of motion (for a ball: acceleration = gravity + air drag), evaluated at hundreds of points where no measurement exists.

The model is pushed toward answers that match the data and are physically possible. Physics fills the gaps between measurements, so far fewer examples are needed. The interactive demo on the home page shows this on a thrown ball.

## Applications in this robot
1. **Prediction.** Catching depends on where the ball will be, not where it is. The catch controller predicts the ball's arc from gravity and velocity.
2. **Plan checking.** A plan that pushes an object through the table or demands impossible arm acceleration has a high physics error and is rejected before any motor moves.
3. **Data efficiency.** A model of the robot and its surroundings trained mostly in simulation, refined with a small amount of real data, with physics keeping it consistent.

## Current work
- Physics-based trajectory prediction running inside the catch skill.
- Next: a learned object-dynamics model with a physics loss, used to score the brain's plans.
