#include <WiFi.h>
#include <FirebaseESP32.h>
#include "config.h" // Učitava tajne podatke (WIFI_SSID, WIFI_PASSWORD, FIREBASE_HOST, FIREBASE_AUTH) iz lokalnog fajla

// ==========================================
// DEFINISANJE PINOVA I PROMJENLJIVIH
// ==========================================
#define RELAY_PIN 26   // Pin na koji je spojen IN1 releja

FirebaseData firebaseData;
FirebaseAuth auth;
FirebaseConfig config;

int soilMoisture = 35;      // Početna simulirana vlažnost u %
bool isAutoMode = true;     // Podrazumijevano AUTO mod
bool manualPumpState = false;

unsigned long previousMillis = 0;
const long interval = 3000; // Očitavanje i slanje na Firebase svakih 3 sekunde

void setup() {
  Serial.begin(115200);
  
  // Relej pin postavka (Active LOW - HIGH znači isključeno)
  pinMode(RELAY_PIN, OUTPUT);
  digitalWrite(RELAY_PIN, HIGH); 

  // Povezivanje na Wi-Fi
  Serial.print("Povezivanje na Wi-Fi: ");
  Serial.println(WIFI_SSID);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  
  while (WiFi.status() != WL_CONNECTED) {
    Serial.print(".");
    delay(500);
  }
  
  Serial.println("\nUspješno povezano na Wi-Fi!");
  Serial.print("IP Adresa: ");
  Serial.println(WiFi.localIP());

  // Povezivanje na Firebase
  config.host = FIREBASE_HOST;
  config.signer.tokens.legacy_token = FIREBASE_AUTH;

  Firebase.begin(&config, &auth);
  Firebase.reconnectWiFi(true);

  Serial.println("Firebase konekcija uspostavljena!");
}

void loop() {
  unsigned long currentMillis = millis();

  if (currentMillis - previousMillis >= interval) {
    previousMillis = currentMillis;

    // 1. Čitanje komandi sa Firebase-a
    if (Firebase.getBool(firebaseData, "/system/auto_mode")) {
      isAutoMode = firebaseData.boolData();
    }
    if (Firebase.getBool(firebaseData, "/system/manual_pump")) {
      manualPumpState = firebaseData.boolData();
    }

    // 2. Logika rada pumpe i simulacije vlažnosti
    if (isAutoMode) {
      // --- AUTOMATSKI MOD ---
      // Simulacija: ako pumpa radi vlaga raste, ako ne radi vlaga opada
      if (digitalRead(RELAY_PIN) == LOW) { // Relej uključen (LOW)
        soilMoisture += 5;
        if (soilMoisture > 80) soilMoisture = 80;
      } else { // Relej isključen (HIGH)
        soilMoisture -= 2;
        if (soilMoisture < 20) soilMoisture = 20;
      }

      // Ako je zemlja suha (< 40%), automatski uključi pumpu
      if (soilMoisture < 40) {
        digitalWrite(RELAY_PIN, LOW);  // PUMPA ON
        Firebase.setBool(firebaseData, "/system/pump_status", true);
      } else {
        digitalWrite(RELAY_PIN, HIGH); // PUMPA OFF
        Firebase.setBool(firebaseData, "/system/pump_status", false);
      }

    } else {
      // --- RUČNI (MANUAL) MOD ---
      if (manualPumpState) {
        digitalWrite(RELAY_PIN, LOW);  // PUMPA ON
        Firebase.setBool(firebaseData, "/system/pump_status", true);
      } else {
        digitalWrite(RELAY_PIN, HIGH); // PUMPA OFF
        Firebase.setBool(firebaseData, "/system/pump_status", false);
      }
    }

    // 3. Slanje stanja vlažnosti u Firebase
    Firebase.setInt(firebaseData, "/sensors/moisture", soilMoisture);

    // Ispis u Serial Monitor radi praćenja
    Serial.print("MOD: ");
    Serial.print(isAutoMode ? "AUTO" : "MANUAL");
    Serial.print(" | Vlažnost: ");
    Serial.print(soilMoisture);
    Serial.print("% | Pumpa: ");
    Serial.println((digitalRead(RELAY_PIN) == LOW) ? "UKLJUČENA" : "ISKLJUČENA");
  }
}