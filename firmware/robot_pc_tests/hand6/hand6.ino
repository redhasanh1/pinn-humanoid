// 6 hand servos on PCA9685 ch0-5 with a GENTLE START so the power supply never trips.
//  1. At boot all 6 outputs are OFF (servos relaxed, no current burst). LED blinks slowly = waiting.
//  2. Plug the 6 V supply in, then press the ESP32's BOOT button (or send "go" over serial).
//  3. Servos switch on ONE AT A TIME, 0.6 s apart, each going to 90 (center). LED solid.
//  4. Then each finger moves on its own in turn: thumb, index, middle, ring, pinky, wrist.
//  Press BOOT again (or send "off") to relax all servos.
#include <Wire.h>
#include <Adafruit_PWMServoDriver.h>

Adafruit_PWMServoDriver pca(0x40);
const int LED = 2, BOOT_BTN = 0, N = 16;   // drive ALL 16 channels, so servos work on any column
const char *NAMES[N] = {"ch0","ch1","ch2","ch3","ch4","ch5","ch6","ch7","ch8","ch9","ch10","ch11","ch12","ch13","ch14","ch15"};
const int US_MIN = 500, US_MAX = 2500;
bool running = false;

void angle(int ch, int deg) { pca.writeMicroseconds(ch, map(deg, 0, 180, US_MIN, US_MAX)); }
void relax(int ch) { pca.setPWM(ch, 0, 4096); }              // full OFF: no pulses, servo goes limp

bool requested() {
  if (digitalRead(BOOT_BTN) == LOW) { delay(40); while (digitalRead(BOOT_BTN) == LOW) delay(10); return true; }
  if (Serial.available()) { String s = Serial.readStringUntil('\n'); s.trim(); return s == "go" || s == "off"; }
  return false;
}

void gentleStart() {
  Serial.println("gentle start: one channel every 0.3 s");
  for (int ch = 0; ch < N; ch++) {
    angle(ch, 90);
    Serial.printf("  ch%d %s ON at 90\n", ch, NAMES[ch]);
    delay(300);
  }
  running = true;
  digitalWrite(LED, HIGH);
}

void stopAll() {
  for (int ch = 0; ch < 16; ch++) relax(ch);
  running = false;
  Serial.println("all servos relaxed. Press BOOT (or send go) to start again.");
}

void setup() {
  Serial.begin(115200);
  Serial.setTimeout(50);
  pinMode(LED, OUTPUT);
  pinMode(BOOT_BTN, INPUT_PULLUP);
  Wire.begin(21, 22);
  pca.begin();
  pca.setOscillatorFrequency(25000000);
  pca.setPWMFreq(50);
  stopAll();
  Wire.beginTransmission(0x40);
  Serial.println(Wire.endTransmission() == 0 ? "PCA9685 FOUND. Plug in 6 V, then press BOOT." : "PCA9685 NOT FOUND - check SDA/SCL/VCC/GND");
}

void loop() {
  if (!running) {
    digitalWrite(LED, (millis() / 700) % 2);                 // slow blink = waiting
    if (requested()) gentleStart();
    return;
  }
  // Smooth staggered wave: every channel moves continuously, each one a bit behind the next,
  // so their start-up current never lines up. Range 40..140, one full cycle every 3 s.
  static unsigned long lastPrint = 0;
  float t = millis() / 1000.0;
  for (int ch = 0; ch < N; ch++) {
    float phase = ch * (2 * PI / N);
    angle(ch, 90 + (int)(50 * sin(2 * PI * t / 3.0 + phase)));
  }
  if (millis() - lastPrint > 3000) { Serial.println("wave running on all 16 channels"); lastPrint = millis(); }
  if (requested()) { stopAll(); return; }
  delay(20);
}
