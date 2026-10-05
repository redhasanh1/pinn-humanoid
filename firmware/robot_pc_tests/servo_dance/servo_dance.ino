// Servo "dance" on pin 13: slow sweep, fast snaps, then a wave. LED double-blinks at each new move.
#include <ESP32Servo.h>
Servo s;
const int LED = 2, PIN = 13;

void blink2() { for (int i = 0; i < 2; i++) { digitalWrite(LED, HIGH); delay(80); digitalWrite(LED, LOW); delay(80); } }

void smooth(int from, int to, int ms) {          // glide from one angle to another over ms milliseconds
  int steps = abs(to - from);
  for (int i = 0; i <= steps; i++) { s.write(from + (to > from ? i : -i)); delay(ms / (steps ? steps : 1)); }
}

void setup() {
  Serial.begin(115200);
  pinMode(LED, OUTPUT);
  s.setPeriodHertz(50);
  s.attach(PIN, 500, 2500);
  s.write(90);
  delay(800);
}

void loop() {
  Serial.println("0: FULL SPEED 0 <-> 180 x6");
  blink2(); for (int i = 0; i < 6; i++) { s.write(0); delay(600); s.write(180); delay(600); }
  s.write(90); delay(800);

  Serial.println("1: slow glide 90 -> 0 -> 180 -> 90");
  blink2(); smooth(90, 0, 2000); smooth(0, 180, 4000); smooth(180, 90, 2000);

  Serial.println("2: fast snaps 45 / 135");
  blink2(); for (int i = 0; i < 4; i++) { s.write(45); delay(400); s.write(135); delay(400); }
  s.write(90); delay(500);

  Serial.println("3: wave 70 <-> 110");
  blink2(); for (int i = 0; i < 6; i++) { smooth(90, 70, 150); smooth(70, 110, 300); smooth(110, 90, 150); }
  delay(1000);
}
