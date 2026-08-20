#include <WiFi.h>
#include <WebServer.h>
#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>

// Uključujemo konfiguracijski fajl sa Wi-Fi podacima
#include "config.h"

#define SCREEN_WIDTH 128
#define SCREEN_HEIGHT 64

#define RELAY_PIN 19
#define BUTTON_PIN 0

WebServer server(80);
Adafruit_SSD1306 display(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, -1);

bool relayState = false;
bool lastButtonState = HIGH;

// Varijable za tajmer
bool timerActive = false;
unsigned long timerEndTime = 0;
int timerSecondsRemaining = 0;

void updateDisplay() {
  display.clearDisplay();
  display.setTextWrap(false); // Onemogućava prelamanje teksta
  display.setTextColor(SSD1306_WHITE);
  
  // IP adresa na vrhu
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
    
    // Status u jednom redu
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

// Omogućavanje CORS-a za GitHub Pages
void setCORS() {
  server.sendHeader("Access-Control-Allow-Origin", "*");
  server.sendHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  server.sendHeader("Access-Control-Allow-Headers", "*");
}

// REST API ENDPOINTI

void handleApiStatus() {
  setCORS();
  String json = "{";
  json += "\"relay\":" + String(relayState ? "true" : "false") + ",";
  json += "\"timerActive\":" + String(timerActive ? "true" : "false") + ",";
  json += "\"timerSeconds\":" + String(timerSecondsRemaining);
  json += "}";
  server.send(200, "application/json", json);
}

void handleApiToggle() {
  setCORS();
  relayState = !relayState;
  timerActive = false;
  digitalWrite(RELAY_PIN, relayState ? LOW : HIGH);
  updateDisplay();
  handleApiStatus();
}

void handleApiStartTimer() {
  setCORS();
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
  setCORS();
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

  // Spajanje na Wi-Fi koristeći varijable iz config.h
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }

  Serial.println("\nSpojeno na Hotspot!");
  Serial.print("IP Adresa: ");
  Serial.println(WiFi.localIP());

  // Rutiranje API zahtjeva
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
      relayState = true;
      digitalWrite(RELAY_PIN, LOW);
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