// Servo on pin 13 + self-check: jumper pin 13 -> pin 34, the ESP32 measures its own servo pulse.
// Expected: period ~20000 us (50 Hz), pulse 500..2500 us following the angle.
#include <ESP32Servo.h>
Servo s;
const int LED = 2, OUT = 13, IN = 34;
void setup() {
  Serial.begin(115200);
  pinMode(LED, OUTPUT);
  pinMode(IN, INPUT);
  s.setPeriodHertz(50);
  s.attach(OUT, 500, 2500);
}
void check(int a) {
  s.write(a);
  delay(300);
  unsigned long hi = pulseIn(IN, HIGH, 50000);
  unsigned long lo = pulseIn(IN, LOW, 50000);
  Serial.printf("angle %3d -> pulse %4lu us, period %5lu us  %s\n", a, hi, hi + lo,
                hi == 0 ? "NO SIGNAL on pin 34 (jumper 13->34 missing?)" :
                (hi + lo > 19000 && hi + lo < 21000) ? "OK 50Hz" : "WRONG FREQ");
}
void loop() {
  digitalWrite(LED, HIGH); check(0);
  digitalWrite(LED, LOW);  check(90);
  digitalWrite(LED, HIGH); check(180);
  digitalWrite(LED, LOW);  check(90);
}
