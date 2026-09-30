# Why fast inference matters

Robot foundation models typically make about one decision per second. That is enough to plan a grasp, but too slow to notice a cup slipping and correct it before it falls.

## The checker
A large vision-language model watches the robot and evaluates, several times per second, whether the task is going to plan. When a grasp slips or a plan is wrong, it re-plans mid-motion.

This requires a large model answering well within a second, many times per second. We will be using **Cerebras** inference for this layer.

## The experiment
Run the same tasks with the checker at 0.5, 2 and 10 evaluations per second and measure success rate against evaluation speed. This isolates how much faster reasoning improves a robot's reliability.

## On the robot
Everything that must happen within milliseconds runs on board: servo control, safety stops and learned reflexes such as catching. The fast checker adds judgement on top of them.
