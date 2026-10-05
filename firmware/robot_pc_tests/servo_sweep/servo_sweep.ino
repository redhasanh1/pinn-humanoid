// Servo test: MG996R on PCA9685 channel 0, slow sweep 0 -> 180 -> 0.
// Blue LED (GPIO2) toggles every step so you can see the code is running.
// Every sweep it re-checks the PCA9685 on I2C and prints FOUND / NOT FOUND.
#include <Wire.h>
#include <Adafruit_PWMServoDriver.h>

Adafruit_PWMServoDriver pca = Adafruit_PWMServoDriver(0x40);
const int LED = 2;
const int DIRECT = 13;   // bypass test: servo signal straight from ESP32 pin 13
const int CH = 0;
const int US_MIN = 500, US_MAX = 2500;

bool pcaFound() {
  Wire.beginTransmission(0x40);
  return Wire.endTransmission() == 0;
}

void writeAngle(int deg) {
  int us = map(deg, 0, 180, US_MIN, US_MAX);
  ledcWrite(DIRECT, (uint32_t)us * 16384 / 20000);
  for (int c = 0; c < 16; c++) pca.writeMicroseconds(c, map(deg, 0, 180, US_MIN, US_MAX));
}

void setup() {
  Serial.begin(115200);
  pinMode(LED, OUTPUT);
  Wire.begin(21, 22);
  pca.begin();
  pca.setOscillatorFrequency(25000000);
  pca.setPWMFreq(50);
  ledcAttach(DIRECT, 50, 14);   // 50 Hz, 14-bit
}

void loop() {
  bool ok = pcaFound();
  Serial.println(ok ? "PCA9685 FOUND at 0x40 - sweeping ALL 16 channels + pin 13" : "PCA9685 NOT FOUND - check SDA(21) SCL(22) VCC(3V3) GND jumpers");
  if (ok) { pca.setPWMFreq(50); }
  digitalWrite(LED, HIGH);  // LED ON while sweeping up
  for (int d = 0; d <= 180; d += 10) { writeAngle(d); delay(80); }
  digitalWrite(LED, LOW);   // LED OFF while sweeping down
  for (int d = 180; d >= 0; d -= 10) { writeAngle(d); delay(80); }
}
