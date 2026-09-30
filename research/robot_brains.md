# Robot foundation models

The robot's brain is a vision-language-action model: camera images and an instruction in, arm motion out. We run these models on a cloud GPU and connect them to the simulation over the internet, the same setup the physical robot will use.

| Model | Developer | Result |
|---|---|---|
| **π0.5** | Physical Intelligence | Solved **25 of 26** table-top tasks it had never been shown, through our cloud link. The InMoov reproduced its motions in simulation. |
| **GR00T N1.7** | NVIDIA | Humanoid foundation model, running on our cloud link at **0.4 to 0.8 s** per decision. Its table-top version completed its tasks through our pipeline. |
| **SmolVLA** | Hugging Face | Compact language-guided model, used for early table-top experiments. |
| **ACT** | Stanford | Small task-specific policy, used to validate the pipeline. |

## Findings
- Foundation models transfer across tasks, but each new robot body needs training on its own data. The simulation generates that data.
- One decision per second suits planning. Fast skills such as catching are learned separately and run on the robot.
- Cloud inference works in practice: the robot streams camera frames and receives motion back.

## Next
Record InMoov demonstrations in simulation (reach, grasp, place) and fine-tune GR00T on them, so it controls the InMoov directly.
