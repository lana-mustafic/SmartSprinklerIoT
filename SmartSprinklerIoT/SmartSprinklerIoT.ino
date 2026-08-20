#include <WiFi.h>
#include <HTTPClient.h>
#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>

#include "config.h"

#define SCREEN_WIDTH 128
#define SCREEN_HEIGHT 64

#define RELAY_PIN 19
#define BUTTON_PIN 0

// Firebase REST API URL-ovi
const String FIREBASE_HOST = "https://sistemzalivanje-default-rtdb.europe-west1.firebasedatabase.app";
const String FIREBASE_AUTH = "9djHDyc87KmRpkPnJ2E9ydmwZtAbNouDBrZu0aZo";

Adafruit_SSD1306 display(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, -1);

bool relayState = false;
bool lastButtonState = HIGH;

bool timerActive = false;
unsigned long timerEndTime = 0;
int timerSecondsRemaining = 0;

unsigned long lastFirebasePoll = 0;
const long pollInterval = 500; // Provjera komandi svakih 500 ms kada je sistem slobodan

void updateDisplay() {
  display.clearDisplay();
  display.setTextWrap(false);
  display.setTextColor(SSD1306_WHITE);
  
  display.setTextSize(1);
  display.setCursor(0, 0);
  if (WiFi.status() == WL_CONNECTED) {
    display.print("CLOUD: Povezano");
  } else {
    display.print("Spajanje na Wi-Fi...");
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

void syncStateToFirebase() {
  if (WiFi.status() == WL_CONNECTED) {
    HTTPClient http;
    String url = FIREBASE_HOST + "/status.json?auth=" + FIREBASE_AUTH;
    http.begin(url);
    http.addHeader("Content-Type", "application/json");
    
    String json = "{\"relay\":" + String(relayState ? "true" : "false") + 
                  ",\"timerActive\":" + String(timerActive ? "true" : "false") + 
                  ",\"timerSeconds\":" + String(timerSecondsRemaining) + "}";
                  
    http.PUT(json);
    http.end();
  }
}

void checkFirebaseCommands() {
  if (WiFi.status() != WL_CONNECTED) return;

  HTTPClient http;
  String url = FIREBASE_HOST + "/command.json?auth=" + FIREBASE_AUTH;
  http.begin(url);
  
  int httpCode = http.GET();
  if (httpCode == HTTP_CODE_OK) {
    String payload = http.getString();
    payload.trim();

    if (payload != "null" && payload != "\"NONE\"") {
      if (payload == "\"TOGGLE\"") {
        relayState = !relayState;
        timerActive = false;
        digitalWrite(RELAY_PIN, relayState ? LOW : HIGH);
      } else if (payload.startsWith("\"TIMER_")) {
        int sec = payload.substring(7, payload.length() - 1).toInt();
        if (sec > 0) {
          timerSecondsRemaining = sec;
          timerEndTime = millis() + (sec * 1000UL);
          timerActive = true;
          relayState = true;
          digitalWrite(RELAY_PIN, LOW); // Pali relej
        }
      }

      // Ocisti komandu sa Firebase-a
      HTTPClient clearHttp;
      clearHttp.begin(FIREBASE_HOST + "/command.json?auth=" + FIREBASE_AUTH);
      clearHttp.addHeader("Content-Type", "application/json");
      clearHttp.PUT("\"NONE\"");
      clearHttp.end();

      updateDisplay();
      syncStateToFirebase();
    }
  }
  http.end();
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
  updateDisplay();
  syncStateToFirebase();
}

void loop() {
  // Provjeravaj komande SAMO ako tajmer NIJE aktivan (sprecava kocenje odbrojavanja)
  if (!timerActive) {
    if (millis() - lastFirebasePoll >= pollInterval) {
      lastFirebasePoll = millis();
      checkFirebaseCommands();
    }
  }

  // Lokalna logika tajmera - radi bez ikakvog mreznog kasnjenja
  if (timerActive) {
    long remaining = (long)(timerEndTime - millis()) / 1000;
    if (remaining <= 0) {
      timerActive = false;
      relayState = false;
      timerSecondsRemaining = 0;
      digitalWrite(RELAY_PIN, HIGH); // Gasi relej
      updateDisplay();
      syncStateToFirebase(); // Obavijesti Firebase da je gotovo
    } else if (remaining != timerSecondsRemaining) {
      timerSecondsRemaining = remaining;
      updateDisplay(); // Trenutno i glatko osvjezavanje SSD1306
    }
  }

  // Fizicko dugme na ESP32 (Pin 0)
  bool currentButtonState = digitalRead(BUTTON_PIN);
  if (lastButtonState == HIGH && currentButtonState == LOW) {
    delay(50);
    relayState = !relayState;
    timerActive = false;
    digitalWrite(RELAY_PIN, relayState ? LOW : HIGH);
    updateDisplay();
    syncStateToFirebase();
  }
  lastButtonState = currentButtonState;
}