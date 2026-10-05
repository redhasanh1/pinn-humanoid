// First test from Claude: blink the on-board LED and print over serial.
const int LED = 2;  // Freenove ESP32 / most ESP32 dev boards: on-board LED on GPIO 2

void setup() {
  Serial.begin(115200);
  pinMode(LED, OUTPUT);
}

void loop() {
  static unsigned long n = 0;
  digitalWrite(LED, HIGH);
  delay(300);
  digitalWrite(LED, LOW);
  delay(300);
  Serial.printf("robot alive, blink %lu\n", ++n);
}
