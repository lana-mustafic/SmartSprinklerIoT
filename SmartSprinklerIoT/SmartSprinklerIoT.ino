#include <WiFi.h>
#include <WebServer.h>
#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>

#include "config.h"

#define SCREEN_WIDTH 128
#define SCREEN_HEIGHT 64

#define RELAY_PIN 19
#define BUTTON_PIN 0

WebServer server(80);
Adafruit_SSD1306 display(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, -1);

bool relayState = false;
bool lastButtonState = HIGH;

bool timerActive = false;
unsigned long timerEndTime = 0;
int timerSecondsRemaining = 0;

void updateDisplay() {
  display.clearDisplay();
  display.setTextWrap(false);
  display.setTextColor(SSD1306_WHITE);
  
  display.setTextSize(1);
  display.setCursor(0, 0);
  if (WiFi.status() == WL_CONNECTED) {
    display.print("IP: ");
    display.println(WiFi.localIP());
  } else {
    display.println("Spajanje na Wi-Fi...");
  }
  display.drawFastHLine(0, 10, 128, SSD1306_WHITE);

  if (timerActive) {
    display.setCursor(18, 22);
    display.print("TAJMER AKTIVAN:");
    display.setTextSize(2);
    display.setCursor(45, 40);
    display.print(timerSecondsRemaining);
    display.println("s");
  } else {
    display.setCursor(20, 22);
    display.print("STATUS RELEJA:");
    
    display.setTextSize(1);
    display.setCursor(25, 42);
    if (relayState) {
      display.println("[ UKLJUCENO ]");
    } else {
      display.println("[ ISKLJUCENO ]");
    }
  }
  display.display();
}

// REST API ENDPOINTI (Bez duplih setCORS poziva)

void handleApiStatus() {
  server.sendHeader("Access-Control-Allow-Origin", "*");
  String json = "{\"relay\":" + String(relayState ? "true" : "false") + 
                ",\"timerActive\":" + String(timerActive ? "true" : "false") + 
                ",\"timerSeconds\":" + String(timerSecondsRemaining) + "}";
  server.send(200, "application/json", json);
}

void handleApiToggle() {
  server.sendHeader("Access-Control-Allow-Origin", "*");
  relayState = !relayState;
  timerActive = false;
  digitalWrite(RELAY_PIN, relayState ? LOW : HIGH);
  updateDisplay();
  handleApiStatus();
}

void handleApiStartTimer() {
  server.sendHeader("Access-Control-Allow-Origin", "*");
  if (server.hasArg("sec")) {
    int sec = server.arg("sec").toInt();
    if (sec > 0) {
      timerSecondsRemaining = sec;
      timerEndTime = millis() + (sec * 1000);
      timerActive = true;
      updateDisplay();
    }
  }
  handleApiStatus();
}

void handleOptions() {
  server.sendHeader("Access-Control-Allow-Origin", "*");
  server.sendHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  server.sendHeader("Access-Control-Allow-Headers", "*");
  server.send(204);
}

void setup() {
  Serial.begin(115200);

  pinMode(RELAY_PIN, OUTPUT);
  pinMode(BUTTON_PIN, INPUT_PULLUP);
  digitalWrite(RELAY_PIN, HIGH);

  Wire.begin(21, 22);
  display.begin(SSD1306_SWITCHCAPVCC, 0x3C);
  
  updateDisplay();

  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }

  Serial.println("\nSpojeno na Hotspot!");
  Serial.print("IP Adresa: ");
  Serial.println(WiFi.localIP());

  server.on("/api/status", HTTP_GET, handleApiStatus);
  server.on("/api/toggle", HTTP_GET, handleApiToggle);
  server.on("/api/start-timer", HTTP_GET, handleApiStartTimer);
  
  server.on("/api/status", HTTP_OPTIONS, handleOptions);
  server.on("/api/toggle", HTTP_OPTIONS, handleOptions);
  server.on("/api/start-timer", HTTP_OPTIONS, handleOptions);

  server.begin();
  updateDisplay();
}

void loop() {
  server.handleClient();

  if (timerActive) {
    long remaining = (timerEndTime - millis()) / 1000;
    if (remaining <= 0) {
      timerActive = false;
      relayState = false;
      digitalWrite(RELAY_PIN, HIGH);
      updateDisplay();
    } else if (remaining != timerSecondsRemaining) {
      timerSecondsRemaining = remaining;
      updateDisplay();
    }
  }

  bool currentButtonState = digitalRead(BUTTON_PIN);
  if (lastButtonState == HIGH && currentButtonState == LOW) {
    delay(50);
    relayState = !relayState;
    timerActive = false;
    digitalWrite(RELAY_PIN, relayState ? LOW : HIGH);
    updateDisplay();
  }
  lastButtonState = currentButtonState;
}