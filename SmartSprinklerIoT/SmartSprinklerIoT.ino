void updateDisplay() {
  display.clearDisplay();
  display.setTextSize(1);
  display.setTextColor(SSD1306_WHITE);
  
  // Prikaz IP adrese na vrhu ekrana
  display.setCursor(0, 0);
  if (WiFi.status() == WL_CONNECTED) {
    display.print("IP:");
    display.println(WiFi.localIP());
  } else {
    display.println("Spajanje na Wi-Fi...");
  }
  display.drawFastHLine(0, 10, 128, SSD1306_WHITE);

  if (timerActive) {
    display.setCursor(10, 20);
    display.print("TAJMER AKTIVAN:");
    display.setTextSize(2);
    display.setCursor(45, 38);
    display.print(timerSecondsRemaining);
    display.println("s");
  } else {
    display.setCursor(15, 20);
    display.print("STATUS RELEJA:");
    display.setTextSize(2);
    display.setCursor(10, 38);
    if (relayState) {
      display.println("[ UKLJUCEN ]");
    } else {
      display.println("[ ISKLJUCEN ]");
    }
  }
  display.display();
}