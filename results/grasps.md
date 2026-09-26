# Real grasps (branch real-grasps, Kimi round 12)

Hasan watched the house tour: the hand closed well above every object and the object snapped up into it, and hands
still touched things. Measured at every grab (distance from the object's centre to where the fingers close):

| | grab gap | contacts > 2 mm (50 Hz replay) | house tasks done cleanly |
|---|---|---|---|
| before (palm target, 4 cm above the top, lifted until clear) | **12-19 cm** above the object | - | 47/47 (with those fake grabs) |
| after (grasp point between palm and curled fingers) | **0.2-1.2 cm** (cup 0.3, ball 1.2, soda can 0.2 - mesh model) | **0** on 47/47 tasks | **47/47** (capsule arms) |

Why it was wrong: the arm solver steered the palm, 12 cm from the wrist, and never used the wrist bend. The InMoov's
closed fingers curl back UP into a fist, so the fingertips ended above the palm, which was already above the object.

What does it now - all geometry, no learning (Kimi: learning would learn the same broken geometry):

1. **Grasp point, not palm.** The object is held between the palm and the curled fingers: the solver
   (`reach.solve_grasp`) puts the point halfway from the palm to where the closed fingertips meet on the object's
   centre, and lines the hand up with an approach direction. 6 joints: 5 arm + the wrist bend (0-90 deg) the old
   solver never used.
2. **Grasp candidates, checked on the body.** Approach tilted 0..-60 deg, turned 0/+-30/+-60 deg; each one checked
   with the hand half-curled on the way in (flat open fingers stuck into the counter), at the object, and closed.
   The surface under the object may be approached but never entered.
3. **Flat things are slid out.** This hand can't pinch: however far they close, the thumb and index tips stay 4.2 cm
   apart. So the knuckles (a fist) press on top and slide the object to the counter's front edge - or a container
   top's edge - and the hand wraps the half that sticks out over the air. Setting a flat thing down is the reverse:
   down half over the edge, then pushed in to its spot.
4. **Clutter.** What is in the way of the grasp or the slide is moved aside first; the base steps sideways (0,
   +-10, +-18 cm); either free hand is tried at each step.
5. **Letting go.** Open only half-curled, lift straight up at the grasp angle, relax the hand once tucked in - fully
   open fingers poked into the basket.
6. **No silent shortcuts.** If there is no clean way to set something down, it says so; the old unchecked fallback
   is how a hand ended 5 mm inside the sink.

Check it: `tools/grasp_suite.py --skeleton --replay` (every rule-planned task, done/problems, and contacts in the
replay). Pending: the same on the InMoov meshes (bulkier hands) - that run needs ~2 GB of free RAM. Planning is slow
now (~6 min for the 47 tasks; the sponge in the crowded kitchen takes ~50 s alone).
