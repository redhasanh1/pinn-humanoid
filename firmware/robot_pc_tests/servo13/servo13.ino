// Plain ESP32Servo library sweep on pin 13. LED on GPIO2 blinks FAST (5x per second) so you know this code is running.
#include <ESP32Servo.h>
Servo s;
const int LED = 2;
void setup() {
  pinMode(LED, OUTPUT);
  s.setPeriodHertz(50);
  s.attach(13, 500, 2500);
}
void loop() {
  for (int a = 0; a <= 180; a += 2) { s.write(a); digitalWrite(LED, (a / 10) % 2); delay(15); }
  for (int a = 180; a >= 0; a -= 2) { s.write(a); digitalWrite(LED, (a / 10) % 2); delay(15); }
}
