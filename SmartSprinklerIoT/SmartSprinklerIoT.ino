#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h> // Instalirati preko Library Managera (v6.x)

// Wi-Fi podaci
const char* ssid = "YOUR_SSID";
const char* password = "YOUR_PASSWORD";

// Firebase podaci
const String firebaseHost = "https://sistemzalivanje-default-rtdb.europe-west1.firebasedatabase.app";
const String firebaseAuth = "9djHDyc87KmRpkPnJ2E9ydmwZtAbNouDBrZu0aZo";

// Pin releja (prilagoditi po potrebi, npr. GPIO 23)
const int RELAY_PIN = 23;

// Tajmer varijable
unsigned long timerInterval = 0; // u milisekundama
unsigned long timerStartMillis = 0;
bool timerActive = false;

void setup() {
  Serial.begin(115200);
  pinMode(RELAY_PIN, OUTPUT);
  digitalWrite(RELAY_PIN, LOW); // Početno isključeno

  // Povezivanje na Wi-Fi
  WiFi.begin(ssid, password);
  Serial.print("Povezivanje na Wi-Fi");
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\nPovezano na Wi-Fi!");
}

void loop() {
  if (WiFi.status() == WL_CONNECTED) {
    checkCommands();
    updateTimer();
  }
  delay(2000); // Provjera svake 2 sekunde
}

void checkCommands() {
  HTTPClient http;
  String url = firebaseHost + "/command.json?auth=" + firebaseAuth;
  
  http.begin(url);
  int httpResponseCode = http.GET();

  if (httpResponseCode > 0) {
    String payload = http.getString();
    // Uklanjanje navodnika koje Firebase vraća za string objekte
    payload.replace("\"", "");
    payload.trim();

    if (payload != "null" && payload != "") {
      Serial.println("Primljena komanda: " + payload);
      
      if (payload == "TOGGLE") {
        int currentState = digitalRead(RELAY_PIN);
        digitalWrite(RELAY_PIN, !currentState);
        timerActive = false; // Prekida se tajmer ako se ručno mijenja
        updateFirebaseStatus();
      } 
      else if (payload.startsWith("TIMER_")) {
        int seconds = payload.substring(6).toInt();
        if (seconds > 0) {
          digitalWrite(RELAY_PIN, HIGH);
          timerInterval = seconds * 1000UL;
          timerStartMillis = millis();
          timerActive = true;
          updateFirebaseStatus();
        }
      }

      // Očisti komandu na Firebase-u nakon izvršenja
      clearCommand();
    }
  }
  http.end();
}

void updateTimer() {
  if (timerActive) {
    if (millis() - timerStartMillis >= timerInterval) {
      digitalWrite(RELAY_PIN, LOW);
      timerActive = false;
      Serial.println("Tajmer istekao. Rele isključen.");
      updateFirebaseStatus();
    }
  }
}

void updateFirebaseStatus() {
  HTTPClient http;
  String url = firebaseHost + "/status.json?auth=" + firebaseAuth;

  http.begin(url);
  http.addHeader("Content-Type", "application/json");

  int currentState = digitalRead(RELAY_PIN);
  String jsonData = "{\"relay\":" + String(currentState == HIGH ? "true" : "false") + 
                    ",\"timerActive\":" + String(timerActive ? "true" : "false") + "}";

  int httpResponseCode = http.PUT(jsonData);
  if (httpResponseCode > 0) {
    Serial.println("Status uspješno ažuriran na Firebase-u.");
  } else {
    Serial.println("Greška pri ažuriranju statusa: " + String(httpResponseCode));
  }
  http.end();
}

void clearCommand() {
  HTTPClient http;
  String url = firebaseHost + "/command.json?auth=" + firebaseAuth;
  http.begin(url);
  http.PUT("null");
  http.end();
}